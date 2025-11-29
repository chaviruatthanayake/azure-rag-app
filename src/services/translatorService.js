import axios from 'axios';

/**
 * Azure Translator Service
 * Translates content to/from different languages
 */
export class TranslatorService {
  constructor() {
    this.translatorKey = process.env.AZURE_TRANSLATOR_KEY;
    this.translatorEndpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
    this.translatorRegion = process.env.AZURE_TRANSLATOR_REGION || 'eastus';
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text) {
    try {
      if (!this.translatorKey) {
        console.log('⚠️ Azure Translator not configured, using basic detection');
        return this.basicLanguageDetection(text);
      }

      const response = await axios.post(
        `${this.translatorEndpoint}/detect?api-version=3.0`,
        [{ text: text.substring(0, 1000) }], // Use first 1000 chars
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.translatorKey,
            'Ocp-Apim-Subscription-Region': this.translatorRegion,
            'Content-Type': 'application/json'
          }
        }
      );

      const detectedLanguage = response.data[0].language;
      console.log(`🌍 Detected language: ${detectedLanguage}`);
      return detectedLanguage;

    } catch (error) {
      console.error('Error detecting language:', error.message);
      return this.basicLanguageDetection(text);
    }
  }

  /**
   * Basic language detection (fallback)
   */
  basicLanguageDetection(text) {
    const languages = {
      'es': /[áéíóúñÁÉÍÓÚÑ]/, // Spanish
      'fr': /[àâäæçéèêëïîôùûüÿœÀÂÄÆÇÉÈÊËÏÎÔÙÛÜŸŒ]/, // French
      'de': /[äöüßÄÖÜ]/, // German
      'zh': /[\u4e00-\u9fa5]/, // Chinese
      'ar': /[\u0600-\u06FF]/, // Arabic
      'ru': /[\u0400-\u04FF]/, // Russian
      'ja': /[\u3040-\u309F\u30A0-\u30FF]/, // Japanese
      'ko': /[\uAC00-\uD7AF]/, // Korean
      'hi': /[\u0900-\u097F]/, // Hindi
      'ta': /[\u0B80-\u0BFF]/, // Tamil
      'te': /[\u0C00-\u0C7F]/, // Telugu
      'si': /[\u0D80-\u0DFF]/, // Sinhala
    };

    const sample = text.substring(0, 500);
    
    for (const [lang, pattern] of Object.entries(languages)) {
      if (pattern.test(sample)) {
        return lang;
      }
    }

    return 'en'; // Default to English
  }

  /**
   * Translate text to English (for indexing)
   */
  async translateToEnglish(text, sourceLanguage) {
    try {
      // If already English, return as-is
      if (sourceLanguage === 'en') {
        console.log('✅ Text already in English, no translation needed');
        return {
          translatedText: text,
          originalLanguage: 'en',
          wasTranslated: false
        };
      }

      if (!this.translatorKey) {
        console.log('⚠️ Azure Translator not configured, storing in original language');
        return {
          translatedText: text,
          originalLanguage: sourceLanguage,
          wasTranslated: false
        };
      }

      console.log(`🌐 Translating from ${sourceLanguage} to English...`);

      // Split text into chunks (Azure Translator has 50,000 char limit per request)
      const chunks = this.splitTextForTranslation(text, 45000);
      const translatedChunks = [];

      for (let i = 0; i < chunks.length; i++) {
        console.log(`   Translating chunk ${i + 1}/${chunks.length}...`);
        
        const response = await axios.post(
          `${this.translatorEndpoint}/translate?api-version=3.0&from=${sourceLanguage}&to=en`,
          [{ text: chunks[i] }],
          {
            headers: {
              'Ocp-Apim-Subscription-Key': this.translatorKey,
              'Ocp-Apim-Subscription-Region': this.translatorRegion,
              'Content-Type': 'application/json'
            }
          }
        );

        translatedChunks.push(response.data[0].translations[0].text);
      }

      const translatedText = translatedChunks.join('\n\n');
      console.log(`✅ Translated ${text.length} chars from ${sourceLanguage} to English`);

      return {
        translatedText,
        originalLanguage: sourceLanguage,
        wasTranslated: true
      };

    } catch (error) {
      console.error('Error translating text:', error.message);
      // Return original text if translation fails
      return {
        translatedText: text,
        originalLanguage: sourceLanguage,
        wasTranslated: false,
        error: error.message
      };
    }
  }

  /**
   * Translate answer from English to target language
   */
  async translateAnswer(englishAnswer, targetLanguage) {
    try {
      // If target is English, return as-is
      if (targetLanguage === 'en') {
        return englishAnswer;
      }

      if (!this.translatorKey) {
        console.log('⚠️ Azure Translator not configured, returning English answer');
        return englishAnswer;
      }

      console.log(`🌐 Translating answer to ${targetLanguage}...`);

      const response = await axios.post(
        `${this.translatorEndpoint}/translate?api-version=3.0&from=en&to=${targetLanguage}`,
        [{ text: englishAnswer }],
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.translatorKey,
            'Ocp-Apim-Subscription-Region': this.translatorRegion,
            'Content-Type': 'application/json'
          }
        }
      );

      const translatedAnswer = response.data[0].translations[0].text;
      console.log(`✅ Translated answer to ${targetLanguage}`);
      return translatedAnswer;

    } catch (error) {
      console.error('Error translating answer:', error.message);
      return englishAnswer; // Return English if translation fails
    }
  }

  /**
   * Split text into chunks for translation
   */
  splitTextForTranslation(text, maxChunkSize) {
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks = [];
    let currentChunk = '';

    // Split by paragraphs to keep context
    const paragraphs = text.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= maxChunkSize) {
        currentChunk += paragraph + '\n\n';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph + '\n\n';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get language name from code
   */
  getLanguageName(code) {
    const languages = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'hi': 'Hindi',
      'ta': 'Tamil',
      'te': 'Telugu',
      'si': 'Sinhala',
      'pt': 'Portuguese',
      'it': 'Italian',
      'nl': 'Dutch',
      'pl': 'Polish',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai'
    };

    return languages[code] || code;
  }
}

export const translatorService = new TranslatorService();