// File: backend/routes/summary.js

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process');
const path = require('path');
const UserManager = require('../utils/userManager');

// Export a function that takes 'pool' as an argument
module.exports = (pool) => {
    const router = express.Router();
    
    // Initialize UserManager with database pool
    const userManager = new UserManager(pool);

    // Debug API key loading
    console.log('🔑 API Key loaded:', process.env.GOOGLE_AI_API_KEY ? 'Yes (length: ' + process.env.GOOGLE_AI_API_KEY.length + ')' : 'No');

    // Validate API key exists
    if (!process.env.GOOGLE_AI_API_KEY) {
        console.error('❌ GOOGLE_AI_API_KEY is not set in environment variables!');
        console.error('💡 Please check your .env file in the backend directory');
    }

    // Initialize Gemini AI client
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

    // Input validation middleware - NOW INCLUDES userId
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

        // Validate YouTube URL
        const youtubeUrlRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*(?:[?&]v=)|shorts\/)|youtu\.be\/|http:\/\/googleusercontent\.com\/youtube\.com\/(?:3|4|5)\/)([a-zA-Z0-9_-]{11})/;
        const match = videoUrl.match(youtubeUrlRegex);

        if (!match) {
            return res.status(400).json({ 
                error: 'Invalid YouTube video URL format. Please provide a valid YouTube video URL.' 
            });
        }

        req.videoId = match[1];
        req.userId = userId;
        next();
    };

    // Extract video ID from YouTube URL
    function extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|http:\/\/googleusercontent\.com\/youtube\.com\/(?:3|4|5)\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

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

    function validateTranscriptLength(transcript, maxLength = 100000) {
        if (transcript.length > maxLength) {
            throw new Error('TRANSCRIPT_TOO_LONG');
        }
        return transcript;
    }

    // Main YouTube video summarization endpoint - NOW WITH RATE LIMITING
    // In backend/routes/summary.js
// ... (after genAI initialization and validateSummaryRequest middleware)

// Main summarization endpoint
router.post('/youtube', async (req, res) => {
    const { videoUrl, userId } = req.body; // userId is now expected from frontend

    // Basic validation (already in validateSummaryRequest, but good to have a fallback)
    if (!videoUrl || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: videoUrl or userId'
        });
    }

    let user; // Declare user variable outside try block for wider scope if needed
    try {
        // Step 1: Get or create the user in the database
        user = await userManager.getOrCreateUser(userId);

        // Step 2: Check if the user is a pioneer (currently always FALSE as per our plan)
        const isPioneer = user.is_pioneer;

        // Step 3: Implement free tier limits for non-pioneer users (ACTIVE NOW)
        if (!isPioneer) {
            const canSummarize = await userManager.canMakeSummaryRequest(userId, 3); // 3 summaries per day free limit

            if (!canSummarize) {
                console.log(`❌ User ${userId} has reached their daily summary limit.`);
                return res.status(403).json({
                    success: false,
                    error: 'Daily summary limit reached. Consider upgrading for unlimited access!',
                    code: 'LIMIT_REACHED' // Custom error code for frontend
                });
            }
            // If canSummarize is true, incrementSummaryCount is handled within canMakeSummaryRequest
        }

        // Step 4: Proceed with YouTube transcript fetching
        const pythonScriptPath = path.join(__dirname, '..', 'python', 'script.py'); // Adjust path as needed
        let transcript = '';

        const pythonProcess = spawn('python3', [pythonScriptPath, videoUrl]);

        pythonProcess.stdout.on('data', (data) => {
            transcript += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Python script exited with code ${code}`);
                    return reject(new Error('Failed to fetch transcript from YouTube.'));
                }
                resolve();
            });
        });

        // Step 5: Validate and summarize the transcript
        const validatedTranscript = validateTranscriptLength(transcript); // Use the updated function below
        console.log(`Transcripts fetched, length: ${validatedTranscript.length}`);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Summarize the following YouTube video transcript. Focus on key ideas, main arguments, and important conclusions. The summary should be concise and no longer than 500 words:\n\n${validatedTranscript}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const geminiResponse = response.text();

        res.json({
            success: true,
            summary: geminiResponse,
            model: "gemini-2.5-flash",
            method: "transcript-based-summarization"
        });

    } catch (error) {
        console.error('🔥 Global error during summarization process:', error);
        let errorMessage = 'An unexpected server error occurred during summarization.';
        let errorCode = 'SERVER_ERROR';

        if (error.message.includes('TRANSCRIPT_TOO_LONG')) {
            errorMessage = 'Video transcript is too long to summarize.';
            errorCode = 'TRANSCRIPT_TOO_LONG';
        } else if (error.message.includes('Failed to fetch transcript')) {
            errorMessage = 'Could not fetch video transcript. It might be unavailable or private.';
            errorCode = 'TRANSCRIPT_FETCH_FAILED';
        } else if (error.message.includes('API key not configured')) {
             errorMessage = 'API key for summarization is not configured on the backend.';
             errorCode = 'API_KEY_MISSING';
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            code: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ... (Existing test endpoint and upgrade-user endpoint)

    // NEW: Upgrade user to pioneer endpoint (for testing/admin)
   router.post('/upgrade-user', async (req, res) => {
    // For launch: Keep this endpoint returning a "coming soon" message
    return res.status(200).json({
        success: false,
        message: 'Pioneer Access is a limited-time offer coming soon to early supporters!',
        code: 'FEATURE_INACTIVE'
    });

    // ... (The actual upgrade logic, commented out or removed for now)
});

    // Test endpoint for API connectivity (keep as is)
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
