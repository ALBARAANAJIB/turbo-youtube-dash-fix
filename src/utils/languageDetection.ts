// Ultra-simplified language detection that actually works
export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
}

// Simple, reliable language detection with German priority
export function detectLanguageFromVideoContent(): LanguageDetectionResult {
  console.log('Starting ultra-simple language detection with German priority...');
  
  let detectedLanguage = 'English';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const sources: string[] = [];

  try {
    // PRIORITY 1: Check for German content EVERYWHERE - most aggressive
    const germanResult = detectGermanContent();
    if (germanResult.isGerman) {
      console.log('GERMAN DETECTED with high confidence');
      return {
        detectedLanguage: 'German',
        confidence: 'high',
        sources: ['german-priority-detection']
      };
    }

    // PRIORITY 2: Check video captions/subtitles - most reliable for other languages
    const captionResult = detectFromCaptions();
    if (captionResult.language) {
      console.log('Language detected from captions:', captionResult.language);
      return {
        detectedLanguage: captionResult.language,
        confidence: 'high',
        sources: ['video-captions']
      };
    }

    // PRIORITY 3: Check for non-Latin scripts
    const scriptResult = detectFromCharacterScript();
    if (scriptResult.language) {
      console.log('Language detected from script:', scriptResult.language);
      return {
        detectedLanguage: scriptResult.language,
        confidence: 'high',
        sources: ['character-script']
      };
    }

    // PRIORITY 4: Simple text analysis
    const textResult = detectFromSimpleText();
    if (textResult.language) {
      console.log('Language detected from text:', textResult.language);
      return {
        detectedLanguage: textResult.language,
        confidence: textResult.confidence,
        sources: ['text-analysis']
      };
    }

  } catch (error) {
    console.error('Language detection error:', error);
  }

  console.log('Final detection result:', { detectedLanguage, confidence, sources });
  
  return { detectedLanguage, confidence, sources };
}

// Aggressive German detection
function detectGermanContent() {
  const title = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string')?.textContent || '';
  const description = document.querySelector('#description-inline-expander .ytd-text-inline-expander')?.textContent?.substring(0, 500) || '';
  const channel = document.querySelector('#channel-name a, .ytd-channel-name a')?.textContent || '';
  const comments = Array.from(document.querySelectorAll('#content-text')).map(el => el.textContent).join(' ').substring(0, 300);
  
  const allText = `${title} ${description} ${channel} ${comments}`.toLowerCase();
  
  // Super aggressive German detection patterns
  const germanIndicators = [
    // Common German words
    /\b(der|die|das|und|ist|ich|du|er|sie|es|wir|ihr|mit|von|zu|auf|in|für|über|durch|nach|vor|bei|um|ohne|gegen|während|seit|bis|aber|oder|denn|sondern|wenn|dass|weil|obwohl|damit|falls|bevor|nachdem|statt|außer|innerhalb|außerhalb)\b/g,
    
    // German umlauts and ß
    /[äöüß]/g,
    
    // German compound words and verbs
    /\b(können|sollen|müssen|dürfen|mögen|wollen|haben|sein|werden|machen|gehen|kommen|sehen|sagen|denken|glauben|wissen|verstehen|sprechen|hören|lesen|schreiben|arbeiten|leben|spielen|lernen|fahren|fliegen|kaufen|verkaufen|essen|trinken|schlafen)\b/g,
    
    // German-specific constructions
    /\b(wie|was|wo|wann|warum|wer|welche|welcher|welches|diese|dieser|dieses|jede|jeder|jedes|alle|alles|noch|schon|immer|nie|heute|gestern|morgen|hier|dort|jetzt|dann|also|sehr|mehr|weniger|gut|besser|schlecht|schlechter|groß|größer|klein|kleiner)\b/g,
    
    // German YouTube-specific terms
    /\b(video|kanal|abonnieren|abonniert|kommentar|kommentare|gefällt|mag|teilen|anschauen|schauen|deutschen?|germany|deutschland)\b/g
  ];
  
  let germanScore = 0;
  
  germanIndicators.forEach(pattern => {
    const matches = allText.match(pattern);
    if (matches) {
      germanScore += matches.length;
      console.log(`German pattern matched: ${matches.length} times`);
    }
  });
  
  // Check channel name for German indicators
  if (channel.toLowerCase().includes('deutsch') || channel.toLowerCase().includes('german')) {
    germanScore += 10;
  }
  
  // Check URL for German indicators
  if (window.location.href.includes('&hl=de') || window.location.href.includes('gl=DE')) {
    germanScore += 5;
  }
  
  console.log(`German detection score: ${germanScore}`);
  
  // Much lower threshold for German detection
  return { isGerman: germanScore >= 1 }; // Even 1 German indicator triggers German
}

// Keep existing functions but simplified
function detectFromCaptions() {
  const captionElements = document.querySelectorAll('.ytp-menuitem, .captions-text, [class*="caption"]');
  
  for (const element of captionElements) {
    const text = element.textContent?.toLowerCase() || '';
    
    if (text.includes('русский') || text.includes('russian')) {
      return { language: 'Russian', confidence: 9 };
    }
    if (text.includes('español') || text.includes('spanish')) {
      return { language: 'Spanish', confidence: 9 };
    }
    if (text.includes('français') || text.includes('french')) {
      return { language: 'French', confidence: 9 };
    }
  }
  
  return { language: null, confidence: 0 };
}

function detectFromCharacterScript() {
  const title = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string')?.textContent || '';
  const description = document.querySelector('#description-inline-expander .ytd-text-inline-expander')?.textContent?.substring(0, 300) || '';
  const combinedText = `${title} ${description}`;

  // Check for non-Latin scripts
  if (/[\u0400-\u04ff]/g.test(combinedText)) {
    return { language: 'Russian', confidence: 9 };
  }
  if (/[\u4e00-\u9fff]/g.test(combinedText)) {
    return { language: 'Chinese', confidence: 9 };
  }
  if (/[\u3040-\u309f\u30a0-\u30ff]/g.test(combinedText)) {
    return { language: 'Japanese', confidence: 9 };
  }
  if (/[\uac00-\ud7af]/g.test(combinedText)) {
    return { language: 'Korean', confidence: 9 };
  }
  if (/[\u0600-\u06ff]/g.test(combinedText)) {
    return { language: 'Arabic', confidence: 9 };
  }

  return { language: null, confidence: 0 };
}

function detectFromSimpleText() {
  const title = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string')?.textContent?.toLowerCase() || '';
  const channel = document.querySelector('#channel-name a, .ytd-channel-name a')?.textContent?.toLowerCase() || '';
  
  // Spanish detection
  if (/\b(el|la|de|que|y|en|un|es|se|no|te|lo|muy|pero|como|todo|también|hasta|desde|cuando|donde|porque|si|solo|ya|español|spain)\b/g.test(`${title} ${channel}`)) {
    return { language: 'Spanish', confidence: 'medium' as const };
  }

  // French detection
  if (/\b(le|la|les|de|du|des|et|ou|en|avec|par|pour|comme|que|se|lui|ce|un|une|est|sont|mais|si|non|très|plus|tout|français|france)\b/g.test(`${title} ${channel}`)) {
    return { language: 'French', confidence: 'medium' as const };
  }

  return { language: null, confidence: 'low' as const };
}

// Generate enhanced prompt with language consistency
export function getEnhancedLanguagePrompt(detailLevel: string, languageResult: LanguageDetectionResult): string {
  const { detectedLanguage, confidence, sources } = languageResult;
  
  return `ABSOLUTE LANGUAGE REQUIREMENT: Write EVERYTHING in ${detectedLanguage}. Every single word must be in ${detectedLanguage}.

DETECTED LANGUAGE: ${detectedLanguage}
Detection confidence: ${confidence}
Sources used: ${sources.join(', ')}

CRITICAL INSTRUCTIONS:
- Use ONLY ${detectedLanguage} for the entire response
- ALL headers, content, and conclusions must be in ${detectedLanguage}
- NO English words or phrases allowed (unless target language is English)
- Complete the summary with a proper conclusion in ${detectedLanguage}

${detailLevel === 'quick' ? 
  `Create a concise summary (200-300 words) entirely in ${detectedLanguage}.` : 
  `Create a comprehensive analysis (500-700 words) entirely in ${detectedLanguage}.`}

Structure your response with clear sections in ${detectedLanguage} and end with a complete conclusion in ${detectedLanguage}.

FINAL VERIFICATION: Before responding, ensure every word is in ${detectedLanguage}.`;
}
