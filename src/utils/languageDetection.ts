
// Enhanced language detection utility for YouTube videos
export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
}

// Map common language codes to full names
const LANGUAGE_MAP: { [key: string]: string } = {
  'en': 'English',
  'en-US': 'English',
  'en-GB': 'English',
  'de': 'German',
  'de-DE': 'German',
  'es': 'Spanish',
  'es-ES': 'Spanish',
  'fr': 'French',
  'fr-FR': 'French',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'ru': 'Russian',
  'hi': 'Hindi'
};

// Detect language from YouTube page metadata
export function detectLanguageFromPageMetadata(): LanguageDetectionResult {
  const sources: string[] = [];
  let detectedLanguage = 'English'; // Default fallback
  let confidence: 'high' | 'medium' | 'low' = 'low';

  try {
    // Check video title language
    const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
    const title = titleElement?.textContent || '';
    
    // Check video description
    const descriptionElement = document.querySelector('#description-inline-expander .ytd-text-inline-expander');
    const description = descriptionElement?.textContent?.substring(0, 500) || '';
    
    // Check channel language/location
    const channelElement = document.querySelector('#channel-name a');
    const channelName = channelElement?.textContent || '';
    
    // Check page language attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang && LANGUAGE_MAP[htmlLang]) {
      detectedLanguage = LANGUAGE_MAP[htmlLang];
      sources.push('page-lang');
      confidence = 'medium';
    }
    
    // Analyze text content for language patterns
    const combinedText = `${title} ${description} ${channelName}`.toLowerCase();
    
    // Simple language detection based on character patterns and common words
    const languagePatterns = {
      'German': {
        patterns: [/\b(der|die|das|und|oder|ich|du|er|sie|es|wir|ihr|sie|ein|eine|einen|mit|von|zu|auf|in|an|für|über|durch|nach|vor|bei|um|ohne|gegen|trotz|während|seit|bis|statt|außer|innerhalb|außerhalb)\b/g,
                  /[äöüß]/g],
        weight: 2
      },
      'Spanish': {
        patterns: [/\b(el|la|los|las|de|del|y|o|en|con|por|para|como|que|se|le|lo|un|una|es|son|pero|si|no|muy|más|todo|todos|esta|este|esta|están|fue|ser|estar|tener|hacer|ir|ver|dar|saber|querer|poder|decir|cada|otro|mismo|tanto|menos|algo)\b/g,
                  /[ñáéíóúü]/g],
        weight: 2
      },
      'French': {
        patterns: [/\b(le|la|les|de|du|des|et|ou|en|avec|par|pour|comme|que|se|lui|ce|un|une|est|sont|mais|si|non|très|plus|tout|tous|cette|ces|était|être|avoir|faire|aller|voir|donner|savoir|vouloir|pouvoir|dire|chaque|autre|même|tant|moins|quelque)\b/g,
                  /[àâäéèêëïîôùûüÿç]/g],
        weight: 2
      },
      'English': {
        patterns: [/\b(the|and|or|in|on|at|to|for|of|with|by|from|as|that|this|these|those|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|a|an|but|if|not|very|more|all|some|any|each|other|same|so|much|less|something)\b/g],
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
    
    if (maxScore > 3) {
      detectedLanguage = bestLanguage;
      sources.push('text-analysis');
      confidence = maxScore > 10 ? 'high' : 'medium';
    }
    
    // Check video category/tags if available
    const categoryElements = document.querySelectorAll('#meta-contents #category a');
    categoryElements.forEach(el => {
      const categoryText = el.textContent?.toLowerCase() || '';
      if (categoryText.includes('musik') || categoryText.includes('musik')) {
        sources.push('category-music');
      }
    });
    
    console.log('Language detection result:', { detectedLanguage, confidence, sources, maxScore });
    
  } catch (error) {
    console.error('Error in language detection:', error);
  }
  
  return {
    detectedLanguage,
    confidence,
    sources
  };
}

// Get enhanced prompt with language detection
export function getEnhancedLanguagePrompt(detailLevel: string, languageResult: LanguageDetectionResult): string {
  const { detectedLanguage, confidence } = languageResult;
  
  const basePrompt = `CRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in ${detectedLanguage}. 

LANGUAGE REQUIREMENTS (CONFIDENCE: ${confidence.toUpperCase()}):
- Detected language: ${detectedLanguage}
- Write EVERYTHING in ${detectedLanguage} - headers, content, conclusion
- NO mixed languages allowed
- NO English if the detected language is not English
- Match the language exactly throughout your entire response

If this is primarily a music video or has limited speech:
- Focus on visual elements, music style, artistic direction
- Describe the mood, atmosphere, and production quality
- Comment on any lyrics or vocal elements if present
- Analyze the video's artistic and emotional impact

${detailLevel === 'quick' ? 
  `Provide a concise summary (200-300 words) in ${detectedLanguage} with clear structure.` : 
  `Provide a detailed analysis (500-700 words) in ${detectedLanguage} with comprehensive coverage.`}

Structure your response with clear sections but write EVERYTHING in ${detectedLanguage}.`;

  return basePrompt;
}
