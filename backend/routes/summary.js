// File: backend/routes/summary.js

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process');
const path = require('path');
const UserManager = require('../utils/userManager'); // Ensure this path is correct

function getYouTubeVideoId(url) {
    const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}

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

module.exports = (pool) => {
    const router = express.Router();
    // Initialize UserManager with the database pool to handle user-specific logic.
    const userManager = new UserManager(pool); // userManager instance created here

    console.log('🔑 API Key loaded:', process.env.GOOGLE_AI_API_KEY ? 'Yes (length: ' + process.env.GOOGLE_AI_API_KEY.length + ')' : 'No');

    if (!process.env.GOOGLE_AI_API_KEY) {
        console.error('❌ GOOGLE_AI_API_KEY is not set in environment variables!');
        console.error('💡 Please check your .env file in the backend directory');
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

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
        next();
    };

    router.post('/youtube', validateSummaryRequest, async (req, res) => {
        const { videoUrl, userId } = req.body;
        console.log(`🎥 Received summary request for: ${videoUrl} from user: ${userId}`);

        // --- DIAGNOSTIC LOGGING ---
        console.log('--- Inside router.post ---');
        console.log('Type of userManager at start:', typeof userManager);
        console.log('Does userManager have canMakeSummaryRequest?', typeof userManager.canMakeSummaryRequest === 'function');
        console.log('Does userManager have recordSummaryRequest?', typeof userManager.recordSummaryRequest === 'function');
        // --- END DIAGNOSTIC LOGGING ---

        try {
            // Changed from destructuring to direct assignment
            const checkResult = await userManager.canMakeSummaryRequest(userId);
            const canProceed = checkResult.canProceed;
            const limitMessage = checkResult.message; // Directly access the message property
            console.log(`After canMakeSummaryRequest: canProceed=${canProceed}, limitMessage=${limitMessage}`);

            if (!canProceed) {
                console.warn(`⚠️ User ${userId} limit reached. Message: ${limitMessage}`);
                return res.status(403).json({ success: false, code: 'LIMIT_REACHED', message: limitMessage });
            }

            const videoId = getYouTubeVideoId(videoUrl);
            if (!videoId) {
                console.error('❌ Invalid YouTube URL provided:', videoUrl);
                return res.status(400).json({ success: false, code: 'INVALID_VIDEO_URL', message: 'Invalid YouTube video URL provided. Please ensure it is a valid YouTube video link.' });
            }
            console.log(`Extracted video ID: ${videoId}`);

            const pythonScriptPath = path.join(__dirname, '..', 'scripts', 'script.py');
            const pythonInterpreter = process.platform === 'win32'
                ? path.join(__dirname, '..', 'scripts', 'transcript-env', 'Scripts', 'python.exe')
                : path.join(__dirname, '..', 'scripts', 'transcript-env', 'bin', 'python3');

            let transcriptData = '';
            let pythonError = '';

            const pythonProcess = spawn(pythonInterpreter, [pythonScriptPath, videoId]);

            pythonProcess.stdout.on('data', (data) => {
                transcriptData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                pythonError += data.toString();
            });

            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error('❌ Python script exited with code', code);
                        console.error('stderr:', pythonError);
                        if (pythonError.includes('ModuleNotFoundError')) {
                            return reject(new Error('Python environment setup error: Missing `youtube_transcript_api` module. Please ensure Python dependencies are installed in your virtual environment located at `backend/scripts/transcript-env`.'));
                        }
                        if (pythonError.includes('You provided an invalid video id') || pythonError.includes('Could not retrieve a transcript')) {
                            return reject(new Error('Failed to fetch transcript: Invalid video URL or transcript not available for this video (e.g., private video, no captions).'));
                        }
                        return reject(new Error('Failed to fetch transcript from YouTube.'));
                    }
                    console.log('✅ Transcript fetched successfully.');
                    resolve();
                });
                pythonProcess.on('error', (err) => {
                    console.error('❌ Failed to start python subprocess:', err);
                    reject(new Error('Failed to start transcript service. Ensure Python and dependencies are installed.'));
                });
            });

            if (!transcriptData) {
                console.error('❌ Transcript data is empty after Python script execution.');
                throw new Error('No transcript found for this video or transcript fetching failed silently.');
            }

            const MAX_TRANSCRIPT_LENGTH = 15000;
            if (transcriptData.length > MAX_TRANSCRIPT_LENGTH) {
                console.warn(`⚠️ Transcript too long (${transcriptData.length} chars). Truncating to ${MAX_TRANSCRIPT_LENGTH} chars.`);
                transcriptData = transcriptData.substring(0, MAX_TRANSCRIPT_LENGTH);
            }

            const prompt = createUniversalPrompt(transcriptData, 'English');

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            console.log('Sending prompt to Gemini API...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const summary = response.text();

            // --- DIAGNOSTIC LOGGING ---
            console.log('--- Before recordSummaryRequest ---');
            console.log('Type of userManager:', typeof userManager);
            console.log('Does userManager still have canMakeSummaryRequest?', typeof userManager.canMakeSummaryRequest === 'function');
            console.log('Does userManager still have recordSummaryRequest?', typeof userManager.recordSummaryRequest === 'function');
            // --- END DIAGNOSTIC LOGGING ---

            await userManager.recordSummaryRequest(userId);

            console.log(`✅ Summary generated successfully for user ${userId}.`);
            res.json({ success: true, summary: summary });

        } catch (error) {
            console.error('🔥 Global error during summarization process:', error);

            if (error.message.includes('LIMIT_REACHED')) {
                // Now, limitMessage should be correctly passed through
                return res.status(403).json({ success: false, code: 'LIMIT_REACHED', message: error.message });
            } else if (error.message.includes('No transcript found') || error.message.includes('Failed to fetch transcript')) {
                return res.status(500).json({ success: false, code: 'TRANSCRIPT_FETCH_FAILED', message: error.message });
            } else if (error.message.includes('API key not configured') || error.message.includes('Failed to start transcript service')) {
                return res.status(500).json({ success: false, code: 'API_KEY_MISSING_OR_SERVICE_ERROR', message: error.message });
            } else if (error.message.includes('Python environment setup error')) {
                return res.status(500).json({ success: false, code: 'PYTHON_ENV_ERROR', message: error.message });
            } else if (error.message.includes('Invalid YouTube video URL')) {
                return res.status(400).json({ success: false, code: 'INVALID_VIDEO_URL', message: error.message });
            }
            res.status(500).json({ success: false, code: 'GENERIC_ERROR', message: 'An unexpected error occurred during summarization: ' + error.message });
        }
    });

    router.post('/upgrade-to-pioneer', async (req, res) => {
        return res.status(200).json({
            success: false,
            message: 'Pioneer Access is a limited-time offer coming soon to early supporters!',
            code: 'FEATURE_INACTIVE'
        });
    });

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