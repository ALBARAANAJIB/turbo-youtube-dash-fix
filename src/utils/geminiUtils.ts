
// Enhanced AI video summarization with user-friendly error handling and consistent language detection

const API_KEY = 'AIzaSyDxQpk6jmBsM5lsGdzRJKokQkwSVTk5sRg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Unified prompt for consistent language matching
const getUnifiedPrompt = (detailLevel: string) => {
  const wordCount = detailLevel === 'quick' ? '150-250' : '400-600';
  
  return `CRITICAL: Respond ONLY in the video's spoken language. Match the language exactly.

Watch this video and write a ${detailLevel} summary (${wordCount} words) in the EXACT same language as the video content.

Rules:
- If video is Arabic → write EVERYTHING in Arabic
- If video is English → write EVERYTHING in English  
- If video is Spanish → write EVERYTHING in Spanish
- If video is German → write EVERYTHING in German
- If video is French → write EVERYTHING in French

${detailLevel === 'quick' ? 'Summarize the main points briefly.' : 'Cover main topics, key points, and important details thoroughly.'}

NO ENGLISH if video is not in English. NO mixed languages. Match the video language perfectly.`;
};

export async function summarizeYouTubeVideo(videoUrl: string, detailLevel: 'quick' | 'detailed' = 'detailed'): Promise<string> {
  try {
    console.log(`Starting enhanced summarization for ${videoUrl} with mode: ${detailLevel}`);
    
    const generationConfig = {
      temperature: 0.1, // Very low for consistency
      maxOutputTokens: detailLevel === 'quick' ? 350 : 800,
      topP: 0.1,
      topK: 1,
      candidateCount: 1
    };

    const requestBody = {
      contents: [
        {
          parts: [
            { text: getUnifiedPrompt(detailLevel) },
            {
              fileData: {
                fileUri: videoUrl,
                mimeType: "video/youtube"
              }
            }
          ]
        }
      ],
      generationConfig,
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };

    console.log('Making enhanced API request...');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      
      // User-friendly error messages
      if (response.status === 429) {
        throw new Error('We\'re experiencing high demand right now 🌟 Please try again in a few minutes - we appreciate your patience!');
      }
      
      if (response.status === 400 && errorText.includes('Video too long')) {
        throw new Error('This video is quite lengthy 📹 Try using Quick mode for better results, or wait a moment and try again.');
      }
      
      if (response.status >= 500) {
        throw new Error('Our servers are taking a quick break ☕ Please try again in a few minutes - thanks for understanding!');
      }
      
      throw new Error('Something went wrong on our end 🔧 Please give us a moment and try again shortly.');
    }

    const data = await response.json();
    console.log('API Response received');
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const summary = data.candidates[0].content.parts[0].text.trim();
      
      if (summary && summary.length > 30) {
        console.log('Summary extracted successfully, length:', summary.length);
        return summary;
      }
    }
    
    // Handle specific finish reasons with friendly messages
    if (data?.candidates?.[0]?.finishReason) {
      const reason = data.candidates[0].finishReason;
      if (reason === 'SAFETY') {
        throw new Error('This content needs special handling 🛡️ Please try a different video or contact us if this seems wrong.');
      } else if (reason === 'MAX_TOKENS') {
        throw new Error('This video has lots to say! 📚 Try Quick mode for longer videos, or we can break it down for you.');
      } else if (reason === 'RECITATION') {
        throw new Error('This content has copyright considerations 📄 Please try a different video for the best experience.');
      }
    }
    
    throw new Error('We couldn\'t process this right now 🤔 Please try again in a moment - sometimes a fresh start helps!');
    
  } catch (error) {
    console.error('Error in summarizeYouTubeVideo:', error);
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      throw new Error('Connection hiccup detected 🌐 Please check your internet and try again - we\'ll be here when you\'re ready!');
    }
    
    throw error;
  }
}

// Export for backward compatibility
export { summarizeYouTubeVideo as default };
