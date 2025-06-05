
// Enhanced AI video summarization with anti-truncation measures and improved prompting

const API_KEY = 'AIzaSyDxQpk6jmBsM5lsGdzRJKokQkwSVTk5sRg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Enhanced prompt with explicit completion requirements
const getUnifiedPrompt = (detailLevel: string) => {
  const wordCount = detailLevel === 'quick' ? '200-300' : '500-700';
  
  return `CRITICAL: Respond ONLY in the video's spoken language. Match the language exactly.

COMPLETION REQUIREMENT: You MUST provide a complete summary with proper conclusion. Do not stop mid-sentence.

Watch this video and write a ${detailLevel} summary (${wordCount} words) in the EXACT same language as the video content.

Structure Requirements:
${detailLevel === 'quick' ? `
- **Main Topic**: Brief overview
- **Key Points**: 3-4 main points covered
- **Conclusion**: Clear wrap-up of the content
` : `
- **Introduction**: Context and main theme
- **Core Content**: Detailed breakdown of main topics
- **Key Insights**: Important takeaways and concepts
- **Conclusion**: Summary of overall message and significance
`}

Language Rules:
- If video is Arabic → write EVERYTHING in Arabic
- If video is English → write EVERYTHING in English  
- If video is Spanish → write EVERYTHING in Spanish
- If video is German → write EVERYTHING in German
- If video is French → write EVERYTHING in French

IMPORTANT: Always end with a proper conclusion. Do not leave sentences incomplete.`;
};

export async function summarizeYouTubeVideo(videoUrl: string, detailLevel: 'quick' | 'detailed' = 'detailed'): Promise<string> {
  try {
    console.log(`Starting enhanced anti-truncation summarization for ${videoUrl} with mode: ${detailLevel}`);
    
    const generationConfig = {
      temperature: 0.05, // Low for consistency
      maxOutputTokens: detailLevel === 'quick' ? 500 : 1000, // Increased limits
      topP: 0.1,
      topK: 1,
      candidateCount: 1,
      stopSequences: [] // Remove any stop sequences
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

    console.log('Making enhanced API request with anti-truncation measures...');
    
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
    
    let summary = '';
    let needsCompletion = false;
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      summary = data.candidates[0].content.parts[0].text.trim();
      
      // Check if response was truncated
      if (data.candidates[0].finishReason === 'MAX_TOKENS') {
        needsCompletion = true;
        console.log('Response truncated, attempting completion...');
      }
      
      // Also check if summary ends abruptly (no proper conclusion)
      const lastSentence = summary.split('.').pop()?.trim() || '';
      if (lastSentence.length > 50 && !lastSentence.includes('conclusion') && !lastSentence.includes('summary') && !lastSentence.includes('overall')) {
        needsCompletion = true;
        console.log('Summary appears incomplete, attempting completion...');
      }
      
      // Attempt completion if needed
      if (needsCompletion && summary.length > 100) {
        try {
          const completionPrompt = `Complete this ${detailLevel} summary that was cut off. Provide ONLY the missing conclusion/ending in the same language. Do not repeat existing content.

Current summary: "${summary.slice(-300)}"

Provide a natural conclusion that properly wraps up the summary. Start directly with the continuation.`;

          const completionRequest = {
            contents: [{ parts: [{ text: completionPrompt }] }],
            generationConfig: {
              temperature: 0.05,
              maxOutputTokens: 150,
              topP: 0.1
            }
          };
          
          const completionResponse = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completionRequest)
          });
          
          if (completionResponse.ok) {
            const completionData = await completionResponse.json();
            if (completionData?.candidates?.[0]?.content?.parts?.[0]?.text) {
              const completion = completionData.candidates[0].content.parts[0].text.trim();
              summary += (summary.endsWith('.') || summary.endsWith('!') || summary.endsWith('?') ? ' ' : '. ') + completion;
              console.log('Successfully completed summary');
            }
          }
        } catch (completionError) {
          console.log('Could not complete summary, proceeding with available content');
        }
      }
      
      if (summary && summary.length > 50) {
        console.log('Summary extracted successfully, length:', summary.length);
        return summary;
      }
    }
    
    // Handle specific finish reasons with friendly messages
    if (data?.candidates?.[0]?.finishReason) {
      const reason = data.candidates[0].finishReason;
      if (reason === 'SAFETY') {
        throw new Error('This content needs special handling 🛡️ Please try a different video or contact us if this seems wrong.');
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
