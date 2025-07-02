// File: backend/routes/summary.js

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process');
const path = require('path');
const UserManager = require('../utils/userManager'); // UserManager is crucial for database integration

// --- HELPER FUNCTION: Extracts YouTube Video ID from a URL ---
function getYouTubeVideoId(url) {
    const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}
// --- END HELPER FUNCTION ---

// --- FUNCTIONS FOR TRANSCRIPT PROCESSING ---

// Detect language from transcript (simple heuristic)
const detectLanguage = (text) => {
    // Safely get first 500 chars for better detection
    const sampleText = text.substring(0, Math.min(500, text.length)).toLowerCase(); 
    // More robust language detection can be done with dedicated libraries if needed later
    if (/\b(the|and|is|are|was|were|you|your|this|that|it|to)\b/.test(sampleText)) {
        return 'English';
    } else if (/\b(el|la|es|son|fue|fueron|tu|su|este|esta|un|una)\b/.test(sampleText)) {
        return 'Spanish';
    } else if (/\b(le|la|est|sont|était|étaient|tu|votre|ce|cette|un|une)\b/.test(sampleText)) {
        return 'French';
    } else if (/\b(der|die|das|ist|und|auf|ein|eine)\b/.test(sampleText)) {
        return 'German';
    } else if (/\b(da|e|il|a|di|che)\b/.test(sampleText)) {
        return 'Italian';
    }
    return 'English'; // Default to English if no clear match
};

// Create optimized single prompt for all summaries
function createUniversalPrompt(transcriptText, videoLanguage = 'English') {
    return `You are an expert video content analyzer. (but don't mention this in the summary to be displayed!). Please create a comprehensive summary of this video transcript in ${videoLanguage}.

TRANSCRIPT:
${transcriptText}

SUMMARY REQUIREMENTS:
- Write the entire summary in ${videoLanguage}
- Create a well-structured summary with clear paragraphs
- Include an overview of the main topic
- List the key points and important information
- Mention any notable examples or demonstrations
- Provide clear conclusions and takeaways
- Keep the summary informative but concise (300-500 words)
- Use proper formatting with line breaks between sections

Please provide a complete, professional summary that captures the essence of the video content.`;
}

// Function to validate and potentially truncate the transcript length
// Increased maxLength for Gemini 2.5 Flash which supports 1M tokens.
// 400,000 characters is roughly 100,000 tokens, leaving plenty of room for output.
function validateTranscriptLength(transcript, maxLength = 400000) { // Adjusted maxLength
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

        if (!userId) { // Ensure userId is present for UserManager
            return res.status(400).json({ 
                error: 'Missing required field: userId' 
            });
        }

        // Validate YouTube URL format using getYouTubeVideoId
        const videoId = getYouTubeVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({
                error: 'Invalid YouTube video URL format. Please provide a valid YouTube video URL.'
            });
        }
        req.videoId = videoId; // Attach videoId to request for later use
        next(); // Proceed to the next middleware/route handler
    };

    // Main route for YouTube video summarization.
    router.post('/youtube', validateSummaryRequest, async (req, res) => {
        const { videoUrl, userId } = req.body;
        const videoId = req.videoId; // Get videoId from validation middleware
        
        console.log(`🎥 Received summary request for: ${videoUrl} from user: ${userId}`);
        console.log(`🆔 Video ID extracted: ${videoId}`);
        
        try {
            // Step 1: User rate limiting and access control.
            const { canProceed, limitMessage } = await userManager.canMakeSummaryRequest(userId);
            if (!canProceed) {
                console.warn(`⚠️ User ${userId} limit reached. Message: ${limitMessage}`);
                return res.status(403).json({ success: false, code: 'LIMIT_REACHED', message: limitMessage });
            }

            // Step 2: Define paths for the Python script and its interpreter.
            const pythonScriptPath = path.join(__dirname, '..', 'scripts', 'script.py'); //
            const pythonInterpreter = process.platform === 'win32' 
                ? path.join(__dirname, '..', 'scripts', 'transcript-env', 'Scripts', 'python.exe') // Path for Windows
                : path.join(__dirname, '..', 'scripts', 'transcript-env', 'bin', 'python');    // Path for Linux/macOS

            let fullTranscript = ''; // Stores the transcript output from Python.
            let pythonErrorOutput = '';    // Stores any errors from the Python script's stderr.

            // Step 3: Spawn the Python subprocess.
            const pythonProcess = spawn(pythonInterpreter, [pythonScriptPath, videoId]); //

            // Capture standard output (transcript data) from the Python script.
            pythonProcess.stdout.on('data', (data) => {
                fullTranscript += data.toString();
            });

            // Capture standard error (error messages) from the Python script.
            pythonProcess.stderr.on('data', (data) => {
                pythonErrorOutput += data.toString();
            });

            // Step 4: Handle Python script completion or errors.
            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error('Python script exited with code', code);
                        console.error('stderr:', pythonErrorOutput);
                        if (pythonErrorOutput.includes('ModuleNotFoundError')) {
                            // Specific error for Python environment not set up correctly
                            return reject(new Error('PYTHON_ENV_ERROR: Required Python modules not found. Ensure `pip install youtube-transcript-api` has been run.'));
                        }
                        if (pythonErrorOutput.includes('Could not retrieve a transcript') || pythonErrorOutput.includes('No transcript found')) {
                             // Specific error for videos without transcripts or unsupported languages
                            return reject(new Error('TRANSCRIPT_NOT_AVAILABLE_PYTHON: Transcript not available for this video, or language not supported by YouTube API.'));
                        }
                        if (pythonErrorOutput.includes('You provided an invalid video id')) {
                            return reject(new Error('INVALID_VIDEO_ID_PYTHON: Python script received an invalid video ID.'));
                        }
                        // Generic Python error
                        return reject(new Error('PYTHON_SCRIPT_FAILED: Failed to fetch transcript from YouTube. The video might be private or restricted.'));
                    }
                    console.log('✅ Transcript fetched successfully by Python script.');
                    resolve();
                });
                pythonProcess.on('error', (err) => {
                    console.error('❌ Failed to start python subprocess:', err); //
                    reject(new Error('PYTHON_PROCESS_ERROR: Failed to start transcript service. Ensure Python and dependencies are installed and accessible.'));
                });
            });

            // --- Enhanced Transcript Validation ---
            // If transcript is empty or very short after successful Python execution, treat as failure.
            if (!fullTranscript || fullTranscript.trim().length < 50) { 
                console.error('❌ Transcript data is empty or too short after Python script execution.');
                throw new Error('TRANSCRIPT_EMPTY_OR_TOO_SHORT: Transcript is empty or too short. Language might not be supported, or content is minimal.');
            }
            console.log(`📄 Transcript fetched by Python: ${fullTranscript.length} characters`); //

            // Step 5: Validate and potentially truncate the transcript length.
            let processedTranscript;
            try {
                processedTranscript = validateTranscriptLength(fullTranscript); // This will throw if too long
            } catch (lengthError) {
                if (lengthError.message === 'TRANSCRIPT_TOO_LONG') {
                    return res.status(413).json({ 
                        success: false, 
                        error: 'This video is too long to summarize. Please try a shorter video.', 
                        code: 'TRANSCRIPT_TOO_LONG'
                    });
                } else {
                    throw lengthError; // Re-throw other unexpected errors
                }
            }
            console.log(`📄 Transcript processed: ${processedTranscript.length} characters`);

            // Step 6: Detect language and prepare prompt.
            const videoLanguage = detectLanguage(processedTranscript); //
            console.log(`🌍 Detected language: ${videoLanguage}`); //

            console.log('🤖 Sending transcript to Gemini for summarization...');

            // Step 7: Generate summary using the Gemini AI model.
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash", 
                generationConfig: {
                    temperature: 0.3,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 8000, //
                }
            });

            const prompt = createUniversalPrompt(processedTranscript, videoLanguage); //
            const result = await model.generateContent(prompt);

            const response = await result.response;
            if (!response || !response.text()) {
                console.error('DEBUG: Gemini response.text() returned null or empty string.'); //
                throw new Error('GEMINI_NO_RESPONSE: No valid response received from Gemini (or empty summary).');
            }

            const summary = response.text();
            console.log(`📝 Summary generated: ${summary ? summary.length : 0} characters`); //

            if (!summary || summary.trim().length < 20) { 
                console.error('Generated summary is too short or empty, likely a content or model issue.'); //
                throw new Error('SUMMARY_TOO_SHORT: Generated summary is too short or empty. Please try another video or adjust model settings.');
            }

            // Step 8: Update user summary count after a successful summary generation.
            await userManager.incrementSummaryCount(userId);

            console.log(`✅ Summary generated successfully (${summary.length} characters)`); //

            // Send the successful summary back to the frontend with detailed metadata.
            res.json({
                success: true,
                summary: summary,
                metadata: {
                    videoUrl,
                    videoId,
                    summaryLength: summary.length,
                    transcriptLength: fullTranscript.length, //
                    processedTranscriptLength: processedTranscript.length,
                    detectedLanguage: videoLanguage, //
                    model: "gemini-2.5-flash", //
                    timestamp: new Date().toISOString(),
                    method: "python-transcript-node-gemini-summarization" //
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
            } else if (error.message.includes('TRANSCRIPT_NOT_AVAILABLE_PYTHON') || error.message.includes('TRANSCRIPT_EMPTY_OR_TOO_SHORT')) {
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
            } else if (error.message.includes('INVALID_VIDEO_ID_PYTHON') || error.message.includes('Invalid YouTube video URL')) {
                statusCode = 400;
                errorMessage = 'Invalid YouTube video URL provided.';
                errorCode = 'INVALID_VIDEO_URL';
            } else if (error.message.includes('PYTHON_PROCESS_ERROR')) {
                statusCode = 500;
                errorMessage = 'Backend service error: Python process could not be started. Check backend setup.';
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