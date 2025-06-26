// File: backend/routes/summary.js

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process'); // NEW: For running Python script
const path = require('path'); // NEW: For resolving Python script path

const router = express.Router();

// Debug API key loading
console.log('🔑 API Key loaded:', process.env.GOOGLE_AI_API_KEY ? 'Yes (length: ' + process.env.GOOGLE_AI_API_KEY.length + ')' : 'No');

// Validate API key exists
if (!process.env.GOOGLE_AI_API_KEY) {
  console.error('❌ GOOGLE_AI_API_KEY is not set in environment variables!');
  console.error('💡 Please check your .env file in the backend directory');
}

// Initialize Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Input validation middleware
const validateSummaryRequest = (req, res, next) => {
  const { videoUrl } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ 
      error: 'Missing required field: videoUrl' 
    });
  }
  
  // Updated regex to be more robust for various YouTube URL formats, including your custom ones
  // It now specifically includes 'youtube.com' and 'youtu.be' as well as your custom domains
  const youtubeUrlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|http:\/\/googleusercontent\.com\/youtube\.com\/(?:3|4|5)\/)([^"&?\/\s]{11})/;
  if (!youtubeUrlRegex.test(videoUrl)) {
    return res.status(400).json({ 
      error: 'Invalid YouTube URL format. Please provide a valid YouTube video URL.' 
    });
  }
  
  next();
};

// Extract video ID from YouTube URL
function extractVideoId(url) {
  // Same regex as in validateSummaryRequest to ensure consistency
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|http:\/\/googleusercontent\.com\/youtube\.com\/(?:3|4|5)\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Create optimized single prompt for all summaries
function createUniversalPrompt(transcriptText, videoLanguage = 'English') {
  return `You are an expert video content analyzer. Please create a comprehensive summary of this video transcript in ${videoLanguage}.

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

// NEW: This function will now purely check length and throw an error for the MVP
// Adjust maxLength based on Gemini's actual context window for your chosen model.
// For gemini-pro (1.0), it's 32,768 tokens. For newer models (like 1.5 Flash/Pro), it's 1M tokens.
// A rough estimate is 1 token = ~4 characters.
// So, for 1M tokens, maxLength would be around 4,000,000 characters.
// If you are using 'gemini-2.5-flash-preview-05-20', check its exact context window.
// Let's use 100,000 as an example for older models or a conservative limit.
// YOU MUST SET THIS `maxLength` according to your specific Gemini model's token limit.
function validateTranscriptLength(transcript, maxLength = 100000) {
  if (transcript.length > maxLength) {
    throw new Error('TRANSCRIPT_TOO_LONG'); // Custom error to catch later
  }
  return transcript; // If it's within limits, return it
}

// Main YouTube video summarization endpoint
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
    const videoId = extractVideoId(videoUrl);
    
    console.log(`📹 Processing video: ${videoUrl}`);
    console.log(`🆔 Video ID extracted: ${videoId}`);
    
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract video ID from URL'
      });
    }

    // --- NEW: Call Python Script for Transcript Fetching ---
    let fullTranscript = '';
    try {
      console.log('📝 Calling Python script to fetch video transcript...');
      // path.join correctly resolves the path regardless of OS
      // __dirname is the current directory of summary.js (backend/routes/)
      // '..' goes up one level to backend/
      // 'scripts' goes into the scripts folder
      // 'script.py' is your Python file
      const pythonScriptPath = path.join(__dirname, '..', 'scripts', 'script.py');
      
      // Path to your virtual environment's python executable
const pythonExecutablePath = path.join(__dirname, '..', 'scripts', 'transcript-env', 'bin', 'python'); 

// Now use this explicit path in the spawn call
const pythonProcess = spawn(pythonExecutablePath, [pythonScriptPath, videoId]);

      let pythonOutput = ''; // Captures stdout (the transcript)
      let pythonErrorOutput = ''; // Captures stderr (errors from Python)

      pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        pythonErrorOutput += data.toString();
      });

      await new Promise((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            // Python script exited successfully
            fullTranscript = pythonOutput.trim(); // Trim whitespace
            resolve();
          } else {
            // Python script exited with an error
            console.error(`❌ Python script exited with code ${code}. Error: ${pythonErrorOutput || 'No error output from Python'}`);
            reject(new Error(`Failed to fetch transcript (Python error): ${pythonErrorOutput || 'Unknown Python error'}`));
          }
        });
        pythonProcess.on('error', (err) => {
          // Error starting the Python process itself (e.g., 'python' command not found)
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
      // General error for transcript fetching issues
      return res.status(500).json({
        success: false,
        error: 'Could not fetch video transcript. It might be unavailable, private, or the backend script failed.',
        details: transcriptError.message
      });
    }

    // --- Apply your "too long" check here ---
    let processedTranscript;
    try {
      processedTranscript = validateTranscriptLength(fullTranscript); // This will throw if too long
    } catch (lengthError) {
      if (lengthError.message === 'TRANSCRIPT_TOO_LONG') {
        return res.status(413).json({ // 413 Request Entity Too Large
          success: false,
          error: 'This video is too long to summarize. Please try a shorter video.',
          details: 'Transcript exceeds maximum processing length for the model.'
        });
      } else {
        throw lengthError; // Re-throw other unexpected errors
      }
    }

    // Detect language from transcript (simple heuristic)
    const detectLanguage = (text) => {
      const sampleText = text.substring(0, Math.min(500, text.length)).toLowerCase(); // Safely get first 500 chars for better detection
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

    const videoLanguage = detectLanguage(processedTranscript);
    console.log(`🌍 Detected language: ${videoLanguage}`);

    console.log('🤖 Sending transcript to Gemini for summarization...');

    // Use Gemini to summarize the transcript
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Confirm your chosen model here
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8000, // <--- INCREASE THIS VALUE SIGNIFICANTLY (e.g., from 1000 to 4000)
      }
    });

    const prompt = createUniversalPrompt(processedTranscript, videoLanguage);
    const result = await model.generateContent(prompt);

    console.log('DEBUG: Gemini result object:', JSON.stringify(result, null, 2)); // Log the full result object
    const response = await result.response;
    console.log('DEBUG: Gemini response object:', JSON.stringify(response, null, 2)); // Log the full response object

    if (!response || !response.text()) {
      // Check if response exists, and if it has a text() method that returns a non-empty string
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

    if (!summary || summary.trim().length < 20) { // Check if summary is meaningful
      throw new Error('Generated summary is too short or empty. Adjust prompt or model settings.');
    }

    console.log(`✅ Summary generated successfully (${summary.length} characters)`);

    // Return successful response
    res.json({
      success: true,
      summary: summary,
      metadata: {
        videoUrl,
        videoId,
        summaryLength: summary.length,
        transcriptLength: fullTranscript.length,
        processedTranscriptLength: processedTranscript.length,
        detectedLanguage: videoLanguage,
        model: "gemini-2.5-flash", // Confirm model
        timestamp: new Date().toISOString(),
        method: "python-transcript-node-gemini-summarization" // Updated method name
      }
    });

  } catch (error) {
    console.error('🔥 Global error during summarization process:', error);
    // General error handling for any other unexpected issues
    res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during summarization.',
      // Only expose details in development mode for security
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    const testModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Confirm your model
    const result = await testModel.generateContent("Say 'Backend API with transcript-based summarization is working!' in a friendly way.");
    const response = await result.response;
    
    res.json({
      success: true,
      message: 'Backend API is working correctly!',
      geminiResponse: response.text(),
      model: "gemini-2.5-flash", // Confirm model
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

module.exports = router;