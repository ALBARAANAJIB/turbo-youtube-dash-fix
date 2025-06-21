
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { YoutubeTranscript } = require('youtube-transcript');

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
  
  if (!videoUrl.includes('youtube.com/watch') && !videoUrl.includes('youtu.be/')) {
    return res.status(400).json({ 
      error: 'Invalid YouTube URL format' 
    });
  }
  
  next();
};

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu.be\/)([^"&?\/\s]{11})/;
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

// Truncate transcript if too long (to stay within token limits)
function truncateTranscript(transcript, maxLength = 8000) {
  if (transcript.length <= maxLength) {
    return transcript;
  }
  
  // Truncate and add indicator
  const truncated = transcript.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('. ');
  
  if (lastSentence > maxLength * 0.8) {
    return truncated.substring(0, lastSentence + 1) + '\n\n[Note: Transcript truncated for processing]';
  }
  
  return truncated + '...\n\n[Note: Transcript truncated for processing]';
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

    try {
      console.log('📝 Fetching video transcript...');
      
      // Fetch transcript using youtube-transcript
      const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (!transcriptArray || transcriptArray.length === 0) {
        throw new Error('No transcript available for this video');
      }
      
      // Combine transcript parts into single text
      const fullTranscript = transcriptArray.map(item => item.text).join(' ');
      console.log(`📄 Transcript fetched: ${fullTranscript.length} characters`);
      
      // Truncate if necessary
      const processedTranscript = truncateTranscript(fullTranscript);
      console.log(`✂️ Processed transcript: ${processedTranscript.length} characters`);
      
      // Detect language from transcript (simple heuristic)
      const detectLanguage = (text) => {
        // Simple language detection based on common words
        const sampleText = text.substring(0, 200).toLowerCase();
        if (/\b(the|and|is|are|was|were|you|your|this|that)\b/.test(sampleText)) {
          return 'English';
        } else if (/\b(el|la|es|son|fue|fueron|tu|su|este|esta)\b/.test(sampleText)) {
          return 'Spanish';
        } else if (/\b(le|la|est|sont|était|étaient|tu|votre|ce|cette)\b/.test(sampleText)) {
          return 'French';
        }
        return 'English'; // Default to English
      };
      
      const videoLanguage = detectLanguage(processedTranscript);
      console.log(`🌍 Detected language: ${videoLanguage}`);
      
      console.log('🤖 Sending transcript to Gemini for summarization...');
      
      // Use Gemini to summarize the transcript
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-preview-05-20",
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1000,
        }
      });

      const prompt = createUniversalPrompt(processedTranscript, videoLanguage);
      const result = await model.generateContent(prompt);
      
      console.log('📝 Checking Gemini response...');
      const response = await result.response;
      
      if (!response) {
        throw new Error('No response received from Gemini');
      }

      const summary = response.text();
      console.log(`📝 Summary generated: ${summary ? summary.length : 0} characters`);

      if (!summary || summary.trim().length < 20) {
        throw new Error('Generated summary is too short or empty');
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
          model: "gemini-2.5-flash-preview-05-20",
          timestamp: new Date().toISOString(),
          method: "transcript-based-summarization"
        }
      });
      
    } catch (error) {
      console.error('❌ Error with transcript processing or Gemini:', error);
      
      // Handle specific error types
      if (error.message.includes('No transcript available') || error.message.includes('Transcript disabled')) {
        return res.status(400).json({
          success: false,
          error: 'This video does not have transcripts available. Please try a different video.',
          details: error.message
        });
      }
      
      if (error.message.includes('Video unavailable') || error.message.includes('private')) {
        return res.status(400).json({
          success: false,
          error: 'Video is not accessible. It may be private, unlisted, or deleted.',
          details: error.message
        });
      }

      if (error.message.includes('quota') || error.message.includes('limit')) {
        return res.status(429).json({
          success: false,
          error: 'API quota exceeded. Please try again later.',
          details: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to process video summary',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing video summary:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test endpoint for API connectivity
router.get('/test', async (req, res) => {
  try {
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'API key not configured'
      });
    }

    const testModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" }); 
    const result = await testModel.generateContent("Say 'Backend API with transcript-based summarization is working!' in a friendly way.");
    const response = await result.response;
    
    res.json({
      success: true,
      message: 'Backend API is working correctly!',
      geminiResponse: response.text(),
      model: "gemini-2.5-flash-preview-05-20",
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
