// File: backend/routes/summary.js

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process');
const path = require('path');
const UserManager = require('../utils/userManager');

// --- NEW HELPER FUNCTION: Extracts YouTube Video ID from a URL ---
// This function is crucial because the 'youtube-transcript-api' Python library
// expects only the video ID, not the full URL.
function getYouTubeVideoId(url) {
    // This regular expression safely extracts the 11-character video ID
    // from various YouTube URL formats (watch, youtu.be, embed, etc.).
    const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    // If a match is found, return the captured video ID; otherwise, return null.
    return (match && match[1]) ? match[1] : null;
}
// --- END NEW HELPER FUNCTION ---

// --- NEW HELPER FUNCTION: Creates comprehensive AI prompt for summarization ---
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
// --- END NEW HELPER FUNCTION ---


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
            // Checks if the user is allowed to make a summary request based on their tier/limits.
            const { canProceed, limitMessage } = await userManager.canMakeSummaryRequest(userId);
            if (!canProceed) {
                console.warn(`⚠️ User ${userId} limit reached. Message: ${limitMessage}`);
                // If limit is reached, send a 403 Forbidden response.
                return res.status(403).json({ success: false, code: 'LIMIT_REACHED', message: limitMessage });
            }

            // --- CRITICAL CHANGE 1: Extract Video ID from URL ---
            // This is the direct fix for the "invalid video id" error from the Python script.
            // It ensures that only the 11-character video ID is passed to the Python library.
            const videoId = getYouTubeVideoId(videoUrl);
            if (!videoId) {
                console.error('❌ Invalid YouTube URL provided:', videoUrl);
                // If the URL is not valid or no ID can be extracted, return a 400 Bad Request.
                return res.status(400).json({ success: false, code: 'INVALID_VIDEO_URL', message: 'Invalid YouTube video URL provided. Please ensure it is a valid YouTube video link.' });
            }
            console.log(`Extracted video ID: ${videoId}`);
            // --- END CRITICAL CHANGE 1 ---

            // Step 2: Define paths for the Python script and its interpreter.
            // `pythonScriptPath` points to your transcript fetching script.
            const pythonScriptPath = path.join(__dirname, '..', 'scripts', 'script.py'); // Corrected in previous step.

            // --- CRITICAL CHANGE 2: Explicitly define Python Interpreter Path ---
            // This is the robust way to handle the 'ModuleNotFoundError' and ensure
            // Node.js uses the Python interpreter from your virtual environment.
            // It makes your application more stable and less dependent on the shell's PATH.
            const pythonInterpreter = process.platform === 'win32' 
                ? path.join(__dirname, '..', 'scripts', 'transcript-env', 'Scripts', 'python.exe') // Path for Windows
                : path.join(__dirname, '..', 'scripts', 'transcript-env', 'bin', 'python3');    // Path for Linux/macOS
            // --- END CRITICAL CHANGE 2 ---

            let transcriptData = ''; // Stores the transcript output from Python.
            let pythonError = '';    // Stores any errors from the Python script's stderr.

            // Step 3: Spawn the Python subprocess.
            // We now pass the explicit `pythonInterpreter` and the extracted `videoId`.
            const pythonProcess = spawn(pythonInterpreter, [pythonScriptPath, videoId]);

            // Capture standard output (transcript data) from the Python script.
            pythonProcess.stdout.on('data', (data) => {
                transcriptData += data.toString();
            });

            // Capture standard error (error messages) from the Python script.
            pythonProcess.stderr.on('data', (data) => {
                pythonError += data.toString();
            });

            // Step 4: Handle Python script completion or errors.
            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error('Python script exited with code', code);
                        console.error('stderr:', pythonError);
                        // Enhance error messages based on Python's output for better debugging/frontend display.
                        if (pythonError.includes('ModuleNotFoundError')) {
                            // This case should ideally not happen now with `pythonInterpreter` explicit path.
                            return reject(new Error('Python environment setup error: Missing `youtube_transcript_api` module. Please ensure Python dependencies are installed in your virtual environment.'));
                        }
                        if (pythonError.includes('You provided an invalid video id') || pythonError.includes('Could not retrieve a transcript')) {
                            // Specific error if Python fails due to an invalid ID or unavailable transcript.
                            return reject(new Error('Failed to fetch transcript: Invalid video URL or transcript not available for this video (e.g., private video, no captions).'));
                        }
                        // Generic error for other Python script failures.
                        return reject(new Error('Failed to fetch transcript from YouTube.'));
                    }
                    console.log('✅ Transcript fetched successfully.');
                    resolve();
                });
                // Handle errors if Node.js can't even start the Python process (e.g., interpreter path is wrong).
                pythonProcess.on('error', (err) => {
                    console.error('❌ Failed to start python subprocess:', err);
                    reject(new Error('Failed to start transcript service. Ensure Python and dependencies are installed.'));
                });
            });

            // If transcriptData is still empty after successful Python execution, it's an unexpected scenario.
            if (!transcriptData) {
                console.error('❌ Transcript data is empty after Python script execution.');
                throw new Error('No transcript found for this video or transcript fetching failed silently.');
            }

            // Step 5: Validate and potentially truncate the transcript length.
            // This is important for staying within the AI model's context window limits.
            const MAX_TRANSCRIPT_LENGTH = 15000; // Adjust as needed for Gemini 1.5 Flash context window
            if (transcriptData.length > MAX_TRANSCRIPT_LENGTH) {
                console.warn(`⚠️ Transcript too long (${transcriptData.length} chars). Truncating to ${MAX_TRANSCRIPT_LENGTH} chars.`);
                transcriptData = transcriptData.substring(0, MAX_TRANSCRIPT_LENGTH);
            }

            // Step 6: Construct the prompt for the Generative AI model.
            // For now, we'll hardcode 'English' as the video language.
           // If your application later supports multi-language transcripts, you could pass it dynamically.
           const prompt = createUniversalPrompt(transcriptData, 'English');

            // Step 7: Generate summary using the Gemini AI model.
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or gemini-1.5-pro for higher quality

            console.log('Sending prompt to Gemini API...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const summary = response.text();

            // Step 8: Update user summary count after a successful summary generation.
            await userManager.incrementSummaryCount(userId);

            console.log(`✅ Summary generated successfully for user ${userId}.`);
            // Send the successful summary back to the frontend.
            res.json({ success: true, summary: summary });

        } catch (error) {
            // Global error handling for the summarization process.
            console.error('🔥 Global error during summarization process:', error);
            
            // Map specific errors to frontend-friendly codes and messages.
            if (error.message.includes('LIMIT_REACHED')) {
                return res.status(403).json({ success: false, code: 'LIMIT_REACHED', message: error.message });
            } else if (error.message.includes('No transcript found') || error.message.includes('Failed to fetch transcript')) {
                // Catches errors related to transcript fetching issues (including invalid video ID from Python).
                return res.status(500).json({ success: false, code: 'TRANSCRIPT_FETCH_FAILED', message: error.message });
            } else if (error.message.includes('API key not configured') || error.message.includes('Failed to start transcript service')) {
                return res.status(500).json({ success: false, code: 'API_KEY_MISSING_OR_SERVICE_ERROR', message: error.message });
            } else if (error.message.includes('Python environment setup error')) {
                // Catches explicit Python environment issues.
                return res.status(500).json({ success: false, code: 'PYTHON_ENV_ERROR', message: error.message });
            } else if (error.message.includes('Invalid YouTube video URL')) { // New code for Node.js-side URL validation
                return res.status(400).json({ success: false, code: 'INVALID_VIDEO_URL', message: error.message });
            }
            // Fallback for any other unexpected errors.
            res.status(500).json({ success: false, code: 'GENERIC_ERROR', message: 'An unexpected error occurred during summarization: ' + error.message });
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

    return router; // Return the configured router.
};