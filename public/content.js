// Enhanced YouTube extension with professional design and advanced long video summarization
function injectSummarizationPanel() {
  // Check if we're on a YouTube video page
  if (!window.location.href.includes('youtube.com/watch')) {
    return;
  }

  // Remove existing panel if it exists
  const existingPanel = document.getElementById('youtube-enhancer-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  // Wait for YouTube's secondary column to load
  const secondaryColumn = document.querySelector('#secondary');
  if (!secondaryColumn) {
    setTimeout(injectSummarizationPanel, 1000);
    return;
  }

  // Create the professional summarization panel
  const panel = document.createElement('div');
  panel.id = 'youtube-enhancer-panel';
  panel.innerHTML = `
    <div style="
      background: #ffffff;
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    ">
      <!-- Professional Header -->
      <div style="
        background: #f9fafb;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #e5e7eb;
      ">
        <div style="
          width: 20px;
          height: 20px;
          background: #f3f4f6;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #374151;
          font-weight: 600;
          border: 1px solid #d1d5db;
        ">AI</div>
        <h3 style="
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          letter-spacing: -0.025em;
        ">Video Summary</h3>
      </div>
      
      <!-- Content -->
      <div style="padding: 20px;">
        <!-- Mode Selector -->
        <div style="margin-bottom: 16px;">
          <select id="detail-level" style="
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 13px;
            background: #ffffff;
            color: #111827;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
            appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" viewBox=\"0 0 10 10\"><path d=\"M8 3L5 6 2 3\" stroke=\"%23666\" stroke-width=\"1.5\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>');
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 36px;
          ">
            <option value="quick">Quick Summary</option>
            <option value="detailed" selected>Detailed Summary</option>
          </select>
        </div>
        
        <button id="summarize-video-btn" style="
          width: 100%;
          background: #f9fafb;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
          font-family: inherit;
          letter-spacing: -0.025em;
        " onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af'" 
           onmouseout="this.style.background='#f9fafb'; this.style.borderColor='#d1d5db'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Generate Summary</span>
        </button>
        
        <div id="summary-loading" style="
          display: none;
          text-align: center;
          padding: 24px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #f3f4f6;
        ">
          <div style="
            width: 16px;
            height: 16px;
            border: 2px solid #f3f4f6;
            border-top: 2px solid #6b7280;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 12px;
          "></div>
          <div style="
            font-size: 12px; 
            color: #6b7280;
            font-weight: 400;
          " id="loading-message">Analyzing video content...</div>
        </div>
        
        <div id="summary-content" style="
          display: none;
          background: #ffffff;
          border-radius: 8px;
          border: 1px solid #f3f4f6;
          overflow: hidden;
        "></div>
      </div>
    </div>
    
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      #detail-level:focus {
        outline: none;
        border-color: #6b7280;
        box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
      }
    </style>
  `;

  // Insert the panel at the top of the secondary column
  secondaryColumn.insertBefore(panel, secondaryColumn.firstChild);

  // Add event listeners
  const summarizeBtn = document.getElementById('summarize-video-btn');
  const loadingDiv = document.getElementById('summary-loading');
  const contentDiv = document.getElementById('summary-content');
  const loadingMessage = document.getElementById('loading-message');
  const detailLevelSelect = document.getElementById('detail-level');

  summarizeBtn?.addEventListener('click', async () => {
    const currentUrl = window.location.href;
    const detailLevel = detailLevelSelect.value;
    
    // Show loading
    summarizeBtn.style.display = 'none';
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    try {
      await summarizeVideo(currentUrl, detailLevel, loadingMessage, contentDiv, loadingDiv, summarizeBtn);
    } catch (error) {
      console.error('Error:', error);
      showError(contentDiv, loadingDiv, summarizeBtn, error.message);
    }
  });
}

// Enhanced language detection with multiple strategies
function detectVideoLanguage() {
  const sources = [];
  let detectedLanguage = 'English';
  let confidence = 'low';

  try {
    // Strategy 1: Check HTML lang attribute
    const htmlLang = document.documentElement.lang;
    const languageMap = {
      'en': 'English', 'en-US': 'English', 'en-GB': 'English',
      'de': 'German', 'de-DE': 'German',
      'es': 'Spanish', 'es-ES': 'Spanish', 'es-MX': 'Spanish',
      'fr': 'French', 'fr-FR': 'French', 'fr-CA': 'French',
      'it': 'Italian', 'it-IT': 'Italian',
      'pt': 'Portuguese', 'pt-BR': 'Portuguese', 'pt-PT': 'Portuguese',
      'ja': 'Japanese', 'ja-JP': 'Japanese',
      'ko': 'Korean', 'ko-KR': 'Korean',
      'zh': 'Chinese', 'zh-CN': 'Chinese', 'zh-TW': 'Chinese', 'zh-HK': 'Chinese',
      'ar': 'Arabic', 'ar-SA': 'Arabic',
      'ru': 'Russian', 'ru-RU': 'Russian',
      'hi': 'Hindi', 'hi-IN': 'Hindi',
      'th': 'Thai', 'th-TH': 'Thai',
      'vi': 'Vietnamese', 'vi-VN': 'Vietnamese',
      'tr': 'Turkish', 'tr-TR': 'Turkish',
      'pl': 'Polish', 'pl-PL': 'Polish',
      'nl': 'Dutch', 'nl-NL': 'Dutch'
    };
    
    if (htmlLang && languageMap[htmlLang]) {
      detectedLanguage = languageMap[htmlLang];
      sources.push('html-lang');
      confidence = 'medium';
    }

    // Strategy 2: Analyze video title
    const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string');
    const title = titleElement?.textContent || '';
    
    // Strategy 3: Check video description
    const descriptionElement = document.querySelector('#description-inline-expander .ytd-text-inline-expander, #description .content');
    const description = descriptionElement?.textContent?.substring(0, 300) || '';
    
    // Strategy 4: Analyze channel information
    const channelElement = document.querySelector('#channel-name a, .ytd-channel-name a');
    const channelName = channelElement?.textContent || '';
    
    // Strategy 5: Check video captions/subtitles if available
    const captionButtons = document.querySelectorAll('.ytp-menuitem[role="menuitemcheckbox"]');
    let captionLanguages = [];
    captionButtons.forEach(btn => {
      const text = btn.textContent?.toLowerCase() || '';
      if (text.includes('chinese') || text.includes('中文')) captionLanguages.push('Chinese');
      if (text.includes('japanese') || text.includes('日本語')) captionLanguages.push('Japanese');
      if (text.includes('korean') || text.includes('한국어')) captionLanguages.push('Korean');
      if (text.includes('spanish') || text.includes('español')) captionLanguages.push('Spanish');
      if (text.includes('french') || text.includes('français')) captionLanguages.push('French');
      if (text.includes('german') || text.includes('deutsch')) captionLanguages.push('German');
    });

    if (captionLanguages.length > 0) {
      detectedLanguage = captionLanguages[0];
      sources.push('captions');
      confidence = 'high';
    }

    // Strategy 6: Enhanced text analysis with better Unicode support
    const combinedText = `${title} ${description} ${channelName}`.toLowerCase();
    
    const languagePatterns = {
      'Chinese': {
        patterns: [
          /[\u4e00-\u9fff]/g, // Chinese characters
          /[\u3400-\u4dbf]/g, // CJK Extension A
          /\b(的|和|在|是|有|了|我|你|他|她|它|们|这|那|一个|可以|会|要|不|也|都|很|更|最)\b/g
        ],
        weight: 3
      },
      'Japanese': {
        patterns: [
          /[\u3040-\u309f]/g, // Hiragana
          /[\u30a0-\u30ff]/g, // Katakana
          /[\u4e00-\u9faf]/g, // Kanji (subset)
          /\b(の|に|は|を|が|で|と|から|まで|より|て|だ|です|である|する|した|している)\b/g
        ],
        weight: 3
      },
      'Korean': {
        patterns: [
          /[\uac00-\ud7af]/g, // Hangul syllables
          /[\u1100-\u11ff]/g, // Hangul Jamo
          /\b(의|이|가|를|에|와|과|은|는|로|으로|에서|부터|까지|하고|그리고|하지만|그러나)\b/g
        ],
        weight: 3
      },
      'Arabic': {
        patterns: [
          /[\u0600-\u06ff]/g, // Arabic script
          /\b(في|من|إلى|على|عن|مع|هذا|هذه|ذلك|تلك|التي|الذي|كان|كانت|يكون|تكون)\b/g
        ],
        weight: 3
      },
      'Russian': {
        patterns: [
          /[\u0400-\u04ff]/g, // Cyrillic script
          /\b(и|в|на|с|не|это|что|как|он|она|они|мы|вы|я|был|была|были|быть|иметь)\b/g
        ],
        weight: 3
      },
      'Thai': {
        patterns: [
          /[\u0e00-\u0e7f]/g, // Thai script
          /\b(และ|หรือ|ใน|ที่|เป็น|มี|จะ|ได้|แล้ว|นี้|นั้น|เขา|เธอ|ผม|ฉัน|คุณ)\b/g
        ],
        weight: 3
      },
      'German': {
        patterns: [
          /\b(der|die|das|und|oder|ich|du|er|sie|es|wir|ihr|sie|ein|eine|einen|mit|von|zu|auf|in|an|für|über|durch|nach|vor|bei|um|ohne|gegen|trotz|während|seit|bis|statt|außer|innerhalb|außerhalb)\b/g,
          /[äöüß]/g
        ],
        weight: 2
      },
      'Spanish': {
        patterns: [
          /\b(el|la|los|las|de|del|y|o|en|con|por|para|como|que|se|le|lo|un|una|es|son|pero|si|no|muy|más|todo|todos|esta|este|están|fue|ser|estar|ter|fazer|ir|ver|dar|saber|querer|poder|dizer|cada|outro|mismo|tanto|menos|algo)\b/g,
          /[ñáéíóúü]/g
        ],
        weight: 2
      },
      'French': {
        patterns: [
          /\b(le|la|les|de|du|des|et|ou|en|avec|par|pour|comme|que|se|lui|ce|un|une|est|sont|mais|si|non|très|plus|tout|tous|cette|ces|était|être|avoir|faire|aller|voir|donner|savoir|vouloir|pouvoir|dire|chaque|autre|même|tant|moins|quelque)\b/g,
          /[àâäéèêëïîôùûüÿç]/g
        ],
        weight: 2
      },
      'Portuguese': {
        patterns: [
          /\b(o|a|os|as|de|da|do|das|dos|e|ou|em|com|por|para|como|que|se|lhe|um|uma|é|são|mas|se|não|muito|mais|todo|todos|esta|este|foram|ser|estar|ter|fazer|ir|ver|dar|saber|querer|poder|dizer|cada|outro|mesmo|tanto|menos|algo)\b/g,
          /[ãõáéíóúâêîôûàèç]/g
        ],
        weight: 2
      },
      'English': {
        patterns: [
          /\b(the|and|or|in|on|at|to|for|of|with|by|from|as|that|this|these|those|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|a|an|but|if|not|very|more|all|some|any|each|other|same|so|much|less|something)\b/g
        ],
        weight: 1
      }
    };
    
    let maxScore = 0;
    let bestLanguage = 'English';
    
    for (const [lang, config] of Object.entries(languagePatterns)) {
      let score = 0;
      config.patterns.forEach(pattern => {
        const matches = combinedText.match(pattern);
        if (matches) {
          score += matches.length * config.weight;
        }
      });
      
      if (score > maxScore) {
        maxScore = score;
        bestLanguage = lang;
      }
    }
    
    if (maxScore > 2) {
      detectedLanguage = bestLanguage;
      sources.push('text-analysis');
      confidence = maxScore > 8 ? 'high' : 'medium';
    }
    
    console.log('Enhanced language detection:', { 
      detectedLanguage, 
      confidence, 
      sources, 
      score: maxScore,
      captionLanguages,
      htmlLang 
    });
    
  } catch (error) {
    console.error('Language detection error:', error);
  }
  
  return { detectedLanguage, confidence, sources };
}

// Enhanced prompt with better language consistency
function getAdvancedPrompt(detailLevel, isLongVideo = false, videoDuration = '') {
  const languageResult = detectVideoLanguage();
  
  const baseInstructions = `CRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in ${languageResult.detectedLanguage}.

ENHANCED LANGUAGE DETECTION (Confidence: ${languageResult.confidence}):
- Detected from sources: ${languageResult.sources.join(', ')}
- Target language: ${languageResult.detectedLanguage}
- ABSOLUTE REQUIREMENT: Write EVERYTHING in ${languageResult.detectedLanguage}
- NO mixed languages allowed - complete consistency required
- ALL headers, content, and conclusions must be in ${languageResult.detectedLanguage}

Special handling for music/artistic content:
- If minimal speech, focus on visual storytelling and artistic elements
- Describe musical style, production quality, and emotional impact
- Comment on any available lyrics or vocal performances
- Analyze the overall aesthetic and creative direction

LANGUAGE CONSISTENCY CHECK:
Before writing each section, confirm you are using ${languageResult.detectedLanguage}.
This applies to: titles, headings, content, transitions, and conclusions.`;

  if (isLongVideo) {
    return `${baseInstructions}

This is a LONG VIDEO (${videoDuration || '50+ minutes'}). Provide comprehensive analysis in ${languageResult.detectedLanguage}.

STRUCTURE (all in ${languageResult.detectedLanguage}):

**Video Overview:**
- Content type and main theme
- Key elements and context

**Main Segments & Progression:**
Break into logical segments:

**Early Section (0-20%):**
- Initial setup and introduction
- Key early elements

**Development Phase (20-60%):**
- Major developments and progression
- Important moments and changes

**Climax & Resolution (60-100%):**
- Peak moments and conclusion
- Final outcomes and impact

**Key Highlights:**
- Most significant moments
- Memorable elements and impact

**Final Analysis:**
- Overall assessment and significance
- Lasting impact and conclusion

${detailLevel === 'quick' ? 
  `Provide this structure in 300-400 words in ${languageResult.detectedLanguage}.` : 
  `Provide this structure in 600-800 words in ${languageResult.detectedLanguage} with detailed analysis.`}

Remember: Use ONLY ${languageResult.detectedLanguage} throughout your entire response.`;
  }

  const wordCount = detailLevel === 'quick' ? '150-250' : '400-600';
  return `${baseInstructions}

Create a ${detailLevel} summary (${wordCount} words) in ${languageResult.detectedLanguage}.

${detailLevel === 'quick' ? 
  `Summarize main points with clear structure in ${languageResult.detectedLanguage}.` : 
  `Cover topics thoroughly with organized sections in ${languageResult.detectedLanguage}.`}

Structure with clear headings, all in ${languageResult.detectedLanguage}.

FINAL CHECK: Ensure every word is in ${languageResult.detectedLanguage}.`;
}

async function summarizeVideo(videoUrl, detailLevel, loadingMessage, contentDiv, loadingDiv, summarizeBtn) {
  const API_KEY = 'AIzaSyDxQpk6jmBsM5lsGdzRJKokQkwSVTk5sRg';
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

  try {
    // Enhanced video duration detection
    const videoDuration = getVideoDuration();
    const isLongVideo = checkIfLongVideo(videoDuration);
    
    const messages = {
      quick: isLongVideo ? 'Analyzing long video structure and key segments...' : 'Creating comprehensive overview...',
      detailed: isLongVideo ? 'Processing long video segments with detailed analysis...' : 'Analyzing content thoroughly...'
    };
    
    loadingMessage.textContent = messages[detailLevel] || 'Processing video...';
    
    // Enhanced configuration with higher token limits and better handling
    const requestBody = {
      contents: [
        {
          parts: [
            { text: getAdvancedPrompt(detailLevel, isLongVideo, videoDuration) },
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
        temperature: 0.01, // Very low for consistency
        maxOutputTokens: isLongVideo ? 
          (detailLevel === 'quick' ? 700 : 1800) : 
          (detailLevel === 'quick' ? 500 : 1200),
        topP: 0.05,
        topK: 1,
        candidateCount: 1,
        responseMimeType: "text/plain",
        stopSequences: []
      },
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

    console.log('Making enhanced API request for', isLongVideo ? `long video (${videoDuration})` : 'standard video...');

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
      
      if (response.status === 429) {
        throw new Error('High demand detected 🌟 Please try again in a few minutes');
      }
      if (response.status === 400) {
        if (errorText.includes('Video too long') || errorText.includes('INVALID_ARGUMENT')) {
          throw new Error('Video processing limit reached 📹 Try Quick mode or a shorter video');
        }
        throw new Error('Video format issue 🎬 Please try a different video');
      }
      if (response.status >= 500) {
        throw new Error('Server taking a break ☕ Please try again shortly');
      }
      throw new Error('Service busy 🌸 Please try again in a moment');
    }

    const data = await response.json();
    console.log('API Response received:', data);
    
    let summary = '';
    let isPartial = false;
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      summary = data.candidates[0].content.parts[0].text.trim();
      
      // Check if response was truncated due to max tokens
      if (data.candidates[0].finishReason === 'MAX_TOKENS') {
        isPartial = true;
        console.log('Response truncated due to max tokens, attempting to complete...');
        
        // Try to get a completion with a follow-up request for the ending
        try {
          const languageResult = detectVideoLanguage();
          const completionRequest = {
            contents: [
              {
                parts: [
                  { 
                    text: `Complete this summary that was cut off. Provide ONLY the missing conclusion/ending in ${languageResult.detectedLanguage}. Do not repeat the existing content. Here's what we have so far: "${summary.slice(-200)}"\n\nProvide a proper conclusion that wraps up the summary naturally in ${languageResult.detectedLanguage}.` 
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.01,
              maxOutputTokens: 250,
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
              isPartial = false;
              console.log('Successfully completed truncated summary');
            }
          }
        } catch (completionError) {
          console.log('Could not complete truncated summary, proceeding with partial content');
        }
      }
    } else {
      // Handle specific finish reasons
      if (data?.candidates?.[0]?.finishReason) {
        const reason = data.candidates[0].finishReason;
        console.log('Finish reason:', reason);
        
        if (reason === 'SAFETY') {
          throw new Error('Content needs special handling 🛡️ Try a different video');
        } else if (reason === 'RECITATION') {
          throw new Error('Copyright considerations detected 📄 Try a different video');
        } else if (reason === 'OTHER') {
          throw new Error('Processing issue detected 🔧 Please try again');
        }
      }
      
      if (!summary) {
        throw new Error('Processing incomplete 🤔 Please try again');
      }
    }

    // Ensure we have substantial content
    if (summary && summary.length > 50) {
      showSuccess(contentDiv, loadingDiv, summarizeBtn, summary, detailLevel, isPartial);
    } else {
      throw new Error('Summary too brief 📝 Please try again with different settings');
    }
  } catch (error) {
    console.error('Error in summarizeVideo:', error);
    if (error.message.includes('fetch') || error.message.includes('network')) {
      throw new Error('Connection issue 🌐 Please check internet and try again');
    }
    throw error;
  }
}

// Enhanced video duration detection
function getVideoDuration() {
  const durationElement = document.querySelector('.ytp-time-duration');
  if (durationElement) {
    return durationElement.textContent;
  }
  
  // Alternative selectors
  const altDuration = document.querySelector('#movie_player .ytp-time-duration');
  if (altDuration) {
    return altDuration.textContent;
  }
  
  return '';
}

// Improved long video detection
function checkIfLongVideo(duration = '') {
  if (!duration) {
    duration = getVideoDuration();
  }
  
  if (duration) {
    const parts = duration.split(':');
    if (parts.length >= 3) { // Hours:Minutes:Seconds format
      return true;
    } else if (parts.length === 2) { // Minutes:Seconds format
      const minutes = parseInt(parts[0]);
      return minutes >= 50;
    }
  }
  
  // Fallback: check if video player indicates long content
  const videoElement = document.querySelector('video');
  if (videoElement && videoElement.duration) {
    return videoElement.duration >= 3000; // 50 minutes in seconds
  }
  
  return false;
}

function showSuccess(contentDiv, loadingDiv, summarizeBtn, summary, detailLevel, isPartial = false) {
  loadingDiv.style.display = 'none';
  
  const detailLabels = {
    quick: 'Quick Summary',
    detailed: 'Detailed Summary'
  };
  
  // Add partial indicator if needed
  const titleText = detailLabels[detailLevel] || 'Summary';
  const finalTitle = isPartial ? `${titleText} (Auto-completed)` : titleText;
  
  contentDiv.innerHTML = `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #f3f4f6;
    ">
      <strong style="
        color: #111827; 
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.025em;
      ">${finalTitle}</strong>
      <div style="display: flex; gap: 8px; align-items: center;">
        ${isPartial ? '<span style="font-size: 10px; color: #6b7280; background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">✓ Completed</span>' : ''}
        <button id="copy-summary" style="
          background: #ffffff;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 5px;
          padding: 5px 10px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: inherit;
        ">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          Copy
        </button>
      </div>
    </div>
    <div style="
      padding: 16px;
      line-height: 1.7;
      font-size: 14px;
      color: #111827;
      max-height: 500px;
      overflow-y: auto;
      word-wrap: break-word;
      word-break: break-word;
      white-space: pre-wrap;
      font-weight: 400;
      letter-spacing: -0.025em;
      background: #ffffff;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f1f5f9;
    " id="summary-text">${summary}</div>
  `;
  
  // Enhanced scrollbar styling for webkit browsers
  const summaryText = document.getElementById('summary-text');
  if (summaryText) {
    const style = document.createElement('style');
    style.textContent = `
      #summary-text::-webkit-scrollbar {
        width: 6px;
      }
      #summary-text::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
      }
      #summary-text::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      #summary-text::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add copy functionality
  const copyBtn = document.getElementById('copy-summary');
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summary);
      copyBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
      copyBtn.style.color = '#059669';
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          Copy
        `;
        copyBtn.style.color = '#374151';
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  });
  
  contentDiv.style.display = 'block';
  summarizeBtn.style.display = 'block';
}

function showError(contentDiv, loadingDiv, summarizeBtn, errorMessage) {
  loadingDiv.style.display = 'none';
  
  contentDiv.innerHTML = `
    <div style="
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    ">
      <div style="
        font-size: 16px;
        margin-bottom: 8px;
      ">😔</div>
      <div style="
        font-weight: 600; 
        margin-bottom: 6px; 
        font-size: 13px;
        color: #dc2626;
      ">Something went wrong</div>
      <div style="
        font-size: 12px; 
        line-height: 1.4; 
        color: #991b1b;
        margin-bottom: 12px;
      ">${errorMessage}</div>
      <button onclick="document.getElementById('summarize-video-btn').click()" style="
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 500;
        font-family: inherit;
      ">🔄 Try Again</button>
    </div>
  `;
  
  contentDiv.style.display = 'block';
  summarizeBtn.style.display = 'block';
}

// Inject liked videos page functionality
function injectLikedVideosButtons() {
  if (!window.location.href.includes('youtube.com/playlist?list=LL')) {
    return;
  }

  const existingButtons = document.getElementById('youtube-enhancer-liked-buttons');
  if (existingButtons) {
    existingButtons.remove();
  }

  // Wait for the playlist header to load
  const playlistHeader = document.querySelector('#header.ytd-playlist-header-renderer');
  if (!playlistHeader) {
    setTimeout(injectLikedVideosButtons, 1000);
    return;
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'youtube-enhancer-liked-buttons';
  buttonContainer.innerHTML = `
    <div style="
      display: flex;
      gap: 12px;
      margin-top: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;
    ">
      <button id="fetch-liked-videos" style="
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
      " onmouseover="this.style.background='#f3f4f6'" 
         onmouseout="this.style.background='#f9fafb'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Fetch Videos
      </button>
      
      <button id="export-liked-videos" style="
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
      " onmouseover="this.style.background='#f3f4f6'" 
         onmouseout="this.style.background='#f9fafb'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Export Data
      </button>
    </div>
  `;

  playlistHeader.appendChild(buttonContainer);

  // Add event listeners
  document.getElementById('fetch-liked-videos')?.addEventListener('click', () => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ action: 'fetchLikedVideos' });
    }
  });

  document.getElementById('export-liked-videos')?.addEventListener('click', () => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ action: 'exportData' });
    }
  });
}

// Initialize based on page type
function initializeExtension() {
  if (window.location.href.includes('youtube.com/watch')) {
    injectSummarizationPanel();
  } else if (window.location.href.includes('youtube.com/playlist?list=LL')) {
    injectLikedVideosButtons();
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeExtension, 2000);
  });
} else {
  setTimeout(initializeExtension, 2000);
}

// Handle navigation changes
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    setTimeout(initializeExtension, 2000);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showToast') {
      // Handle any toast messages if needed
    }
    return true;
  });
}
