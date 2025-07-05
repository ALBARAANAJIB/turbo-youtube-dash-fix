// File: backend/routes/summary.js

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process');
const path = require('path');
const UserManager = require('../utils/userManager'); // UserManager is crucial for database integration

// --- NEW HELPER FUNCTION: Extracts YouTube Video ID from a URL ---
// This function is crucial because the 'youtube-transcript-api' Python library
// expects only the video ID, not the full URL.
function getYouTubeVideoId(url) {
    const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}
// --- END NEW HELPER FUNCTION ---

// --- FUNCTIONS FOR TRANSCRIPT PROCESSING ---

// This function will now purely check length and throw an error for the MVP
// Adjust maxLength based on Gemini's actual context window for your chosen model.
// For gemini-1.5-flash/pro, it's 1M tokens. A rough estimate is 1 token = ~4 characters.
// So, for 1M tokens, maxLength would be around 4,000,000 characters.
// Let's use a conservative 200,000 as an example for now, but you can increase it.
function validateTranscriptLength(transcript, maxLength = 300000) {
    if (transcript.length > maxLength) {
        throw new Error('TRANSCRIPT_TOO_LONG'); // Custom error to catch later
    }
    return transcript; // If it's within limits, return it
}

// --- END FUNCTIONS FOR TRANSCRIPT PROCESSING ---


module.exports = (pool) => {
    const router = express.Router();
    // Initialize UserManager with the database pool to handle user-specific logic.
    const userManager = new UserManager(pool);

    // Debugging output for API key status. This helps confirm environment variable loading.
    console.log('🔑 API Key loaded:', process.env.GOOGLE_AI_API_KEY ? 'Yes (length: ' + process.env.GOOGLE_AI_API_KEY.length + ')' : 'No');

    // Critical check: If API key is missing, log an error to guide the developer.
    if (!process.env.GOOGLE_AI_API_KEY) {
        console.error('❌ GOOGLE_AI_API_KEY is not set in environment variables!');
        console.error('💡 Please check your .env file in the backend directory');
    }

    // Initialize the Google Generative AI client with the API key.
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

    // Middleware to validate incoming request body for required fields.
    const validateSummaryRequest = (req, res, next) => {
        const { videoUrl, userId } = req.body;

        if (!videoUrl) {
            return res.status(400).json({ 
                error: 'Missing required field: videoUrl'
            });
        }

        if (!userId) {
            return res.status(400).json({ 
                error: 'Missing required field: userId' 
            });
        }
        // If all required fields are present, proceed to the next middleware/route handler.
        next();
    };

    // Main route for YouTube video summarization.
    router.post('/youtube', validateSummaryRequest, async (req, res) => {
        const { videoUrl, userId } = req.body;
        console.log(`🎥 Received summary request for: ${videoUrl} from user: ${userId}`);

        try {
            // Step 1: User rate limiting and access control.
            const { canProceed, limitMessage } = await userManager.canMakeSummaryRequest(userId);
            if (!canProceed) {
                console.warn(`⚠️ User ${userId} limit reached. Message: ${limitMessage}`);
                return res.status(403).json({ success: false, code: 'LIMIT_REACHED', message: limitMessage });
            }

            // Step 2: Extract Video ID from URL using our helper.
            const videoId = getYouTubeVideoId(videoUrl);
            if (!videoId) {
                console.error('❌ Invalid YouTube URL provided:', videoUrl);
                return res.status(400).json({ success: false, code: 'INVALID_VIDEO_URL', message: 'Invalid YouTube video URL provided. Please ensure it is a valid YouTube video link.' });
            }
            console.log(`Extracted video ID: ${videoId}`);

            // Step 3: Define paths for the Python script and its interpreter.
            const pythonScriptPath = path.join(__dirname, '..', 'scripts', 'script.py');
            const pythonInterpreter = process.platform === 'win32' 
                ? path.join(__dirname, '..', 'scripts', 'transcript-env', 'Scripts', 'python.exe') // Path for Windows
                : path.join(__dirname, '..', 'scripts', 'transcript-env', 'bin', 'python');    // Path for Linux/macOS

            let transcriptData = ''; // Stores the transcript output from Python.
            let pythonError = '';    // Stores any errors from the Python script's stderr.

            // Step 4: Spawn the Python subprocess.
            const pythonProcess = spawn(pythonInterpreter, [pythonScriptPath, videoId]);

            // Capture standard output (transcript data) from the Python script.
            pythonProcess.stdout.on('data', (data) => {
                transcriptData += data.toString();
            });

            // Capture standard error (error messages) from the Python script.
            pythonProcess.stderr.on('data', (data) => {
                pythonError += data.toString();
            });

            // Step 5: Handle Python script completion or errors.
            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error('Python script exited with code', code);
                        console.error('stderr:', pythonError);
                        if (pythonError.includes('ModuleNotFoundError')) {
                            // Specific error for Python environment not set up correctly
                            return reject(new Error('PYTHON_ENV_ERROR: Required Python modules not found.'));
                        }
                        if (pythonError.includes('Could not retrieve a transcript') || pythonError.includes('No transcript found')) {
                             // Specific error for videos without transcripts or unsupported languages
                            return reject(new Error('TRANSCRIPT_NOT_AVAILABLE: Transcript not available for this video or language not supported.'));
                        }
                        if (pythonError.includes('You provided an invalid video id')) {
                            return reject(new Error('INVALID_VIDEO_ID: Python script received an invalid video ID.'));
                        }
                        // Generic Python error
                        return reject(new Error('PYTHON_SCRIPT_FAILED: Failed to fetch transcript from YouTube.'));
                    }
                    console.log('✅ Transcript fetched successfully.');
                    resolve();
                });
                pythonProcess.on('error', (err) => {
                    console.error('❌ Failed to start python subprocess:', err);
                    reject(new Error('PYTHON_PROCESS_ERROR: Failed to start transcript service. Ensure Python and dependencies are installed.'));
                });
            });

            // --- CRITICAL CHANGE: ENHANCED TRANSCRIPT VALIDATION ---
            // If transcript is empty or very short after successful Python execution, treat as failure.
            if (!transcriptData || transcriptData.trim().length < 50) { // Increased threshold from 0 to 50
                console.error('❌ Transcript data is empty or too short after Python script execution.');
                throw new Error('TRANSCRIPT_NOT_AVAILABLE: Transcript is empty or too short. Language might not be supported, or content is minimal.');
            }
            // --- END CRITICAL CHANGE ---

            // Step 6: Validate and potentially truncate the transcript length.
            let processedTranscript;
            try {
                processedTranscript = validateTranscriptLength(transcriptData); 
            } catch (lengthError) {
                if (lengthError.message === 'TRANSCRIPT_TOO_LONG') {
                    return res.status(413).json({ 
                        success: false, 
                        error: 'This video is too long to summarize. Please try a shorter video.', 
                        code: 'TRANSCRIPT_TOO_LONG'
                    });
                } else {
                    throw lengthError; 
                }
            }
            console.log(`📄 Transcript processed: ${processedTranscript.length} characters`);

            // --- CRITICAL CHANGE: REMOVED detectLanguage AND HARDCODED TO ENGLISH ---
            const videoLanguage = 'English'; // Summarize in English, regardless of detected language
            console.log(`🌍 Summary language set to: ${videoLanguage}`);

            console.log('🤖 Sending transcript to Gemini for summarization...');

            // Step 7: Generate summary using the Gemini AI model.
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash", 
                generationConfig: {
                    temperature: 0.3,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 8000, 
                }
            });

            // Create the prompt. We no longer pass videoLanguage to createUniversalPrompt as it's hardcoded to English.
            // However, the prompt itself still expects the language to be 'English'.
            const prompt = `You are an expert video content analyzer. (but don't mention this in the summary to be displayed!). Please create a comprehensive summary of this video transcript in detail and conversation flow style.

TRANSCRIPT:
${processedTranscript}

SUMMARY REQUIREMENTS:
- Write the entire summary in English
- Create a well-structured summary with clear paragraphs
- Include an overview of the main topic
- List the key points and important information
- Mention any notable examples or demonstrations
- Provide clear conclusions and takeaways
- Keep the summary informative but concise (300-500 words)
- Use proper formatting with line breaks between sections

Please provide a complete, professional summary that captures the essence of the video content.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;

            if (!response || !response.text()) {
                console.error('DEBUG: Gemini response.text() returned null or empty string.');
                throw new Error('GEMINI_NO_RESPONSE: No valid response received from Gemini (or empty summary).');
            }

            const summary = response.text();
            console.log(`📝 Summary generated: ${summary ? summary.length : 0} characters`);

            if (!summary || summary.trim().length < 20) { 
                console.error('Generated summary is too short or empty, likely a content or model issue.');
                throw new Error('SUMMARY_TOO_SHORT: Generated summary is too short or empty. Please try another video or adjust model settings.');
            }

            // Step 8: Update user summary count after a successful summary generation.
            await userManager.incrementSummaryCount(userId);

            console.log(`✅ Summary generated successfully (${summary.length} characters)`);

            // Send the successful summary back to the frontend with detailed metadata.
            res.json({
                success: true,
                summary: summary,
                metadata: {
                    videoUrl,
                    videoId,
                    summaryLength: summary.length,
                    transcriptLength: transcriptData.length,
                    processedTranscriptLength: processedTranscript.length,
                    detectedLanguage: videoLanguage, // Still report as 'English'
                    model: "gemini-2.5-flash", 
                    timestamp: new Date().toISOString(),
                    method: "python-transcript-node-gemini-summarization" 
                }
            });

        } catch (error) {
            // Global error handling for the summarization process.
            console.error('🔥 Global error during summarization process:', error);
            
            // Map specific errors to frontend-friendly codes and messages.
            let statusCode = 500;
            let errorMessage = 'An unexpected error occurred during summarization.';
            let errorCode = 'GENERIC_ERROR';

            if (error.message.includes('LIMIT_REACHED')) {
                statusCode = 403;
                errorMessage = error.message;
                errorCode = 'LIMIT_REACHED';
            } else if (error.message.includes('TRANSCRIPT_NOT_AVAILABLE')) {
                statusCode = 404; // Not Found or No Content
                errorMessage = 'Transcript not available for this video, or language is not supported. Please try a different video.';
                errorCode = 'TRANSCRIPT_NOT_AVAILABLE';
            } else if (error.message.includes('PYTHON_ENV_ERROR')) {
                statusCode = 500;
                errorMessage = 'Backend setup error: Python environment issues. Please contact support.';
                errorCode = 'PYTHON_ENV_ERROR';
            } else if (error.message.includes('PYTHON_SCRIPT_FAILED')) {
                statusCode = 500;
                errorMessage = 'Backend error: Failed to retrieve transcript from YouTube. The video might be private or restricted.';
                errorCode = 'PYTHON_SCRIPT_FAILED';
            } else if (error.message.includes('INVALID_VIDEO_ID')) {
                statusCode = 400;
                errorMessage = 'Invalid YouTube video ID provided.';
                errorCode = 'INVALID_VIDEO_ID';
            } else if (error.message.includes('PYTHON_PROCESS_ERROR')) {
                statusCode = 500;
                errorMessage = 'Backend service error: Python process could not be started.';
                errorCode = 'PYTHON_PROCESS_ERROR';
            } else if (error.message.includes('TRANSCRIPT_TOO_LONG')) {
                statusCode = 413;
                errorMessage = 'This video is too long to summarize. Please try a shorter video.';
                errorCode = 'TRANSCRIPT_TOO_LONG';
            } else if (error.message.includes('GEMINI_NO_RESPONSE')) {
                statusCode = 500;
                errorMessage = 'Failed to get a summary from the AI. The content might be problematic for summarization.';
                errorCode = 'GEMINI_NO_RESPONSE';
            } else if (error.message.includes('SUMMARY_TOO_SHORT')) {
                statusCode = 500;
                errorMessage = 'The generated summary was too short or empty, indicating an issue with the video content or AI response.';
                errorCode = 'SUMMARY_TOO_SHORT';
            } else if (error.message.includes('API key not configured') || error.message.includes('Failed to start transcript service')) {
                 // This catches the case where GOOGLE_AI_API_KEY is fundamentally missing
                 statusCode = 500;
                 errorMessage = 'Server configuration error: AI API key is missing.';
                 errorCode = 'API_KEY_MISSING_OR_SERVICE_ERROR';
            } else if (error.message.includes('Invalid YouTube video URL')) {
                statusCode = 400;
                errorMessage = error.message; // Use the message from getYouTubeVideoId
                errorCode = 'INVALID_VIDEO_URL';
            }
            
            res.status(statusCode).json({ success: false, code: errorCode, message: errorMessage });
        }
    });

    // Endpoint for upgrading user to pioneer status (currently returning 'coming soon').
    router.post('/upgrade-to-pioneer', async (req, res) => {
        return res.status(200).json({
            success: false,
            message: 'Pioneer Access is a limited-time offer coming soon to early supporters!',
            code: 'FEATURE_INACTIVE'
        });
    });

    // Test endpoint to verify API connectivity and Gemini AI responsiveness.
    router.get('/test', async (req, res) => {
        try {
            if (!process.env.GOOGLE_AI_API_KEY) {
                return res.status(500).json({
                    success: false,
                    error: 'API key not configured'
                });
            }

            const testModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
            const result = await testModel.generateContent("Say 'Backend API with transcript-based summarization is working!' in a friendly way.");
            const response = await result.response;
            
            res.json({
                success: true,
                message: 'Backend API is working correctly!',
                geminiResponse: response.text(),
                model: "gemini-2.5-flash", 
                method: "transcript-based-summarization"
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'API connection failed',
                details: error.message
            });
        }
    });

    return router; 
};