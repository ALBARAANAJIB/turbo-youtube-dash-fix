
// Simplified and reliable AI video summarization
const API_KEY = 'AIzaSyDxQpk6jmBsM5lsGdzRJKokQkwSVTk5sRg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

import { detectLanguageFromVideoContent } from './languageDetection';

// Create a focused prompt that enforces language consistency
function createLanguageConsistentPrompt(detailLevel: string) {
  const languageResult = detectLanguageFromVideoContent();
  const targetLanguage = languageResult.detectedLanguage;
  const wordCount = detailLevel === 'quick' ? '200-300' : '500-700';
  
  console.log('Creating prompt for language:', targetLanguage, 'with confidence:', languageResult.confidence);
  
  return `CRITICAL LANGUAGE INSTRUCTION: You MUST write your ENTIRE response in ${targetLanguage}. Every single word must be in ${targetLanguage}.

LANGUAGE ENFORCEMENT RULES:
- Target language: ${targetLanguage}
- Detection confidence: ${languageResult.confidence}
- Sources: ${languageResult.sources.join(', ')}
- ZERO tolerance for language mixing
- ALL content including headers, body, and conclusion must be in ${targetLanguage}

TASK: Create a ${detailLevel} video summary (${wordCount} words) in ${targetLanguage}.

STRUCTURE (all in ${targetLanguage}):
${detailLevel === 'quick' ? `
- Brief overview in ${targetLanguage}
- Main points (3-4 key items) in ${targetLanguage}
- Clear conclusion in ${targetLanguage}
` : `
- Introduction and context in ${targetLanguage}
- Detailed content analysis in ${targetLanguage}
- Key insights and takeaways in ${targetLanguage}
- Comprehensive conclusion in ${targetLanguage}
`}

COMPLETION REQUIREMENTS:
- Must end with proper conclusion in ${targetLanguage}
- No abrupt endings or incomplete thoughts
- Full coherent summary from start to finish in ${targetLanguage}

FINAL CHECK: Before submitting, verify EVERY word is in ${targetLanguage}.`;
}

export async function summarizeYouTubeVideo(videoUrl: string, detailLevel: 'quick' | 'detailed' = 'detailed'): Promise<string> {
  try {
    console.log(`Starting summarization for ${videoUrl} in ${detailLevel} mode`);
    
    const generationConfig = {
      temperature: 0.01, // Ultra-low for consistency
      maxOutputTokens: detailLevel === 'quick' ? 600 : 1200,
      topP: 0.05,
      topK: 1,
      candidateCount: 1,
      stopSequences: [],
      responseMimeType: "text/plain"
    };

    const requestBody = {
      contents: [
        {
          parts: [
            { text: createLanguageConsistentPrompt(detailLevel) },
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
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    console.log('Making API request with simplified language enforcement...');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      
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
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      summary = data.candidates[0].content.parts[0].text.trim();
      
      // Check if truncated and try to complete
      if (data.candidates[0].finishReason === 'MAX_TOKENS') {
        console.log('Response truncated, attempting completion...');
        try {
          const completed = await completeTruncatedSummary(summary);
          if (completed) summary = completed;
        } catch (e) {
          console.log('Could not complete, using partial content');
        }
      }
      
      if (summary && summary.length > 50) {
        console.log('Summary generated successfully, length:', summary.length);
        return summary;
      }
    }
    
    // Handle specific finish reasons
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

// Simple completion for truncated summaries
async function completeTruncatedSummary(incompleteSummary: string): Promise<string | null> {
  const languageResult = detectLanguageFromVideoContent();
  const targetLang = languageResult.detectedLanguage;
  
  const completionPrompt = `Complete this ${targetLang} summary with a proper conclusion.

Incomplete summary ending: "${incompleteSummary.slice(-200)}"

Provide ONLY the missing conclusion in ${targetLang}:
- Brief wrap-up of main points
- Clear final statement
- Maximum 60 words
- Use ONLY ${targetLang}`;

  try {
    const completionRequest = {
      contents: [{ parts: [{ text: completionPrompt }] }],
      generationConfig: {
        temperature: 0.01,
        maxOutputTokens: 150,
        topP: 0.05
      }
    };
    
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completionRequest)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const completion = data.candidates[0].content.parts[0].text.trim();
        return incompleteSummary + (incompleteSummary.endsWith('.') ? ' ' : '. ') + completion;
      }
    }
  } catch (error) {
    console.error('Completion failed:', error);
  }
  
  return null;
}

export { summarizeYouTubeVideo as default };
