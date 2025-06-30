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
    router.post('/youtube', validateSummaryRequest, async (req, res) => {
        try {
            // Check API key again before processing
            if (!process.env.GOOGLE_AI_API_KEY) {
                return res.status(500).json({
                    success: false,
                    error: 'API key not configured on server'
                });
            }

            const { videoUrl } = req.body;
            const userId = req.userId; // From middleware
            const videoId = extractVideoId(videoUrl);
            
            console.log(`📹 Processing video: ${videoUrl} for user: ${userId}`);
            console.log(`🆔 Video ID extracted: ${videoId}`);
            
            if (!videoId) {
                return res.status(400).json({
                    success: false,
                    error: 'Could not extract video ID from URL'
                });
            }

            // NEW: Check user rate limits before processing
            const rateLimitCheck = await userManager.canMakeSummaryRequest(userId, 3);
            
            if (!rateLimitCheck.canProceed) {
                return res.status(403).json({
                    success: false,
                    error: 'Daily summary limit reached',
                    message: 'You have reached your daily limit of 3 free summaries. Upgrade to Pioneer for unlimited access!',
                    limitReached: true,
                    isPioneer: false,
                    remainingCount: 0
                });
            }

            // --- NEW: Call Python Script for Transcript Fetching ---
            let fullTranscript = '';
            try {
                console.log('📝 Calling Python script to fetch video transcript...');
                const pythonScriptPath = path.join(__dirname, '..', 'scripts', 'script.py');
                const pythonExecutablePath = path.join(__dirname, '..', 'scripts', 'transcript-env', 'bin', 'python');
                const pythonProcess = spawn(pythonExecutablePath, [pythonScriptPath, videoId]);

                let pythonOutput = '';
                let pythonErrorOutput = '';

                pythonProcess.stdout.on('data', (data) => {
                    pythonOutput += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    pythonErrorOutput += data.toString();
                });

                await new Promise((resolve, reject) => {
                    pythonProcess.on('close', (code) => {
                        if (code === 0) {
                            fullTranscript = pythonOutput.trim();
                            resolve();
                        } else {
                            console.error(`❌ Python script exited with code ${code}. Error: ${pythonErrorOutput || 'No error output from Python'}`);
                            reject(new Error(`Failed to fetch transcript (Python error): ${pythonErrorOutput || 'Unknown Python error'}`));
                        }
                    });
                    pythonProcess.on('error', (err) => {
                        console.error(`❌ Failed to start Python process: ${err.message}`);
                        reject(new Error(`Backend script error: ${err.message}. Is Python installed and in your PATH?`));
                    });
                });

                if (!fullTranscript) {
                    throw new Error('Python script returned no transcript data.');
                }

                console.log(`📄 Transcript fetched by Python: ${fullTranscript.length} characters`);

            } catch (transcriptError) {
                console.error(`❌ Error fetching transcript via Python for ${videoId}:`, transcriptError);
                return res.status(500).json({
                    success: false,
                    error: 'Could not fetch video transcript. It might be unavailable, private, or the backend script failed.',
                    details: transcriptError.message
                });
            }

            // Apply transcript length validation
            let processedTranscript;
            try {
                processedTranscript = validateTranscriptLength(fullTranscript);
            } catch (lengthError) {
                if (lengthError.message === 'TRANSCRIPT_TOO_LONG') {
                    return res.status(413).json({
                        success: false,
                        error: 'This video is too long to summarize. Please try a shorter video.',
                        details: 'Transcript exceeds maximum processing length for the model.'
                    });
                } else {
                    throw lengthError;
                }
            }

            // Detect language from transcript (simple heuristic)
            const detectLanguage = (text) => {
                const sampleText = text.substring(0, Math.min(500, text.length)).toLowerCase();
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
                return 'English';
            };

            const videoLanguage = detectLanguage(processedTranscript);
            console.log(`🌍 Detected language: ${videoLanguage}`);

            console.log('🤖 Sending transcript to Gemini for summarization...');

            // Use Gemini to summarize the transcript
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.3,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 8000,
                }
            });

            const prompt = createUniversalPrompt(processedTranscript, videoLanguage);
            const result = await model.generateContent(prompt);

            console.log('DEBUG: Gemini result object:', JSON.stringify(result, null, 2));
            const response = await result.response;
            console.log('DEBUG: Gemini response object:', JSON.stringify(response, null, 2));

            if (!response || !response.text()) {
                if (response && typeof response.text === 'function') {
                    const textContent = response.text();
                    if (textContent === null || textContent.trim() === '') {
                        console.error('DEBUG: Gemini response.text() returned null or empty string.');
                    }
                } else {
                    console.error('DEBUG: Gemini response object is null/undefined or missing text() method.');
                }
                throw new Error('No valid response received from Gemini (or empty summary).');
            }

            const summary = response.text();
            console.log(`📝 Summary generated: ${summary ? summary.length : 0} characters`);

            if (!summary || summary.trim().length < 20) {
                throw new Error('Generated summary is too short or empty. Adjust prompt or model settings.');
            }

            // NEW: Increment user's daily summary count after successful summarization
            await userManager.incrementSummaryCount(userId);

            console.log(`✅ Summary generated successfully (${summary.length} characters)`);

            // Return successful response with rate limit info
            res.json({
                success: true,
                summary: summary,
                rateLimitInfo: {
                    isPioneer: rateLimitCheck.isPioneer,
                    remainingCount: rateLimitCheck.remainingCount - 1, // Subtract 1 since we just used one
                    dailyLimit: rateLimitCheck.isPioneer ? -1 : 3
                },
                metadata: {
                    videoUrl,
                    videoId,
                    summaryLength: summary.length,
                    transcriptLength: fullTranscript.length,
                    processedTranscriptLength: processedTranscript.length,
                    detectedLanguage: videoLanguage,
                    model: "gemini-2.5-flash",
                    timestamp: new Date().toISOString(),
                    method: "python-transcript-node-gemini-summarization"
                }
            });

        } catch (error) {
            console.error('🔥 Global error during summarization process:', error);
            res.status(500).json({
                success: false,
                error: 'An unexpected server error occurred during summarization.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    // NEW: Get user stats endpoint
    router.get('/user/:userId/stats', async (req, res) => {
        try {
            const { userId } = req.params;
            const stats = await userManager.getUserStats(userId);
            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            console.error('❌ Error getting user stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user statistics'
            });
        }
    });

    // NEW: Upgrade user to pioneer endpoint (for testing/admin)
    router.post('/user/:userId/upgrade', async (req, res) => {
        try {
            const { userId } = req.params;
            const upgradedUser = await userManager.upgradeToPioneer(userId);
            res.json({
                success: true,
                message: 'User upgraded to Pioneer status',
                user: upgradedUser
            });
        } catch (error) {
            console.error('❌ Error upgrading user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to upgrade user'
            });
        }
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
