// Enhanced AI video summarization with anti-truncation measures and improved prompting

const API_KEY = 'AIzaSyDxQpk6jmBsM5lsGdzRJKokQkwSVTk5sRg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Enhanced prompt with improved language detection
const getUnifiedPrompt = (detailLevel: string, languageHint?: string) => {
  const wordCount = detailLevel === 'quick' ? '200-300' : '500-700';
  const targetLanguage = languageHint || 'the video\'s spoken language';
  
  return `CRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in ${targetLanguage}. 

ENHANCED LANGUAGE DETECTION:
- Target language: ${targetLanguage}
- Write EVERYTHING in ${targetLanguage} - headers, content, conclusion
- NO mixed languages allowed - maintain complete consistency
- If this is a music video with limited speech, focus on visual and artistic elements

COMPLETION REQUIREMENT: Provide a complete summary with proper conclusion.

Create a ${detailLevel} summary (${wordCount} words) in ${targetLanguage}.

Structure Requirements:
${detailLevel === 'quick' ? `
- **Main Topic**: Brief overview in ${targetLanguage}
- **Key Points**: 3-4 main points in ${targetLanguage}
- **Conclusion**: Clear wrap-up in ${targetLanguage}
` : `
- **Introduction**: Context and theme in ${targetLanguage}
- **Core Content**: Detailed breakdown in ${targetLanguage}
- **Key Insights**: Important takeaways in ${targetLanguage}
- **Conclusion**: Summary and significance in ${targetLanguage}
`}

Special considerations for music/artistic content:
- Describe visual storytelling and artistic direction
- Comment on musical style and production quality
- Analyze emotional impact and aesthetic choices
- Include any lyrical content or vocal performances

IMPORTANT: Always end with a proper conclusion in ${targetLanguage}. No incomplete sentences.`;
};

export async function summarizeYouTubeVideo(videoUrl: string, detailLevel: 'quick' | 'detailed' = 'detailed', languageHint?: string): Promise<string> {
  try {
    console.log(`Enhanced summarization for ${videoUrl} with mode: ${detailLevel}, language hint: ${languageHint}`);
    
    const generationConfig = {
      temperature: 0.02,
      maxOutputTokens: detailLevel === 'quick' ? 600 : 1200,
      topP: 0.05,
      topK: 1,
      candidateCount: 1,
      stopSequences: []
    };

    const requestBody = {
      contents: [
        {
          parts: [
            { text: getUnifiedPrompt(detailLevel, languageHint) },
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

    console.log('Making enhanced API request with language detection...');
    
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
      
      if (response.status === 429) {
        throw new Error('High demand detected 🌟 Please try again in a few minutes');
      }
      
      if (response.status === 400 && errorText.includes('Video too long')) {
        throw new Error('Video is quite lengthy 📹 Try Quick mode for better results');
      }
      
      if (response.status >= 500) {
        throw new Error('Servers taking a break ☕ Please try again shortly');
      }
      
      throw new Error('Service busy 🌸 Please try again in a moment');
    }

    const data = await response.json();
    console.log('API Response received');
    
    let summary = '';
    let needsCompletion = false;
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      summary = data.candidates[0].content.parts[0].text.trim();
      
      if (data.candidates[0].finishReason === 'MAX_TOKENS') {
        needsCompletion = true;
        console.log('Response truncated, attempting completion...');
      }
      
      const lastSentence = summary.split('.').pop()?.trim() || '';
      if (lastSentence.length > 50 && !lastSentence.includes('conclusion') && !lastSentence.includes('summary')) {
        needsCompletion = true;
        console.log('Summary appears incomplete, attempting completion...');
      }
      
      if (needsCompletion && summary.length > 100) {
        try {
          const completionPrompt = `Complete this ${detailLevel} summary that was cut off. Provide ONLY the missing conclusion/ending in ${languageHint || 'the same language'}. Do not repeat existing content.

Current summary: "${summary.slice(-300)}"

Provide a natural conclusion in ${languageHint || 'the same language'}.`;

          const completionRequest = {
            contents: [{ parts: [{ text: completionPrompt }] }],
            generationConfig: {
              temperature: 0.02,
              maxOutputTokens: 200,
              topP: 0.05
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
    
    if (data?.candidates?.[0]?.finishReason) {
      const reason = data.candidates[0].finishReason;
      if (reason === 'SAFETY') {
        throw new Error('Content needs special handling 🛡️ Try a different video');
      } else if (reason === 'RECITATION') {
        throw new Error('Copyright considerations detected 📄 Try a different video');
      }
    }
    
    throw new Error('Processing incomplete 🤔 Please try again');
    
  } catch (error) {
    console.error('Error in summarizeYouTubeVideo:', error);
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      throw new Error('Connection issue 🌐 Please check internet and try again');
    }
    
    throw error;
  }
}

// Export for backward compatibility
export { summarizeYouTubeVideo as default };
