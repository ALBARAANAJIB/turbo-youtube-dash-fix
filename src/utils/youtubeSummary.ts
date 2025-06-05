
const API_KEY = 'AIzaSyDxQpk6jmBsM5lsGdzRJKokQkwSVTk5sRg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

export async function summarizeYouTubeVideo(videoUrl: string): Promise<string> {
  try {
    const requestBody = {
      contents: [
        {
          parts: [
            { text: "Please provide a comprehensive summary of what's happening in this video." },
            {
              fileData: {
                fileUri: videoUrl,
                mimeType: "video/youtube"
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
      }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response format from Gemini API');
    }
  } catch (error) {
    console.error('Error summarizing video:', error);
    throw error;
  }
}
