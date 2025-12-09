import { Translate } from '@google-cloud/translate/build/src/v2/index.js';

/**
 * GCP Translation Service
 * Uses Cloud Translation API (with your $300 credits!)
 * Supports 100+ languages
 */
class GCPTranslationService {
  constructor() {
    this.translate = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Cloud Translation client
      this.translate = new Translate({
        projectId: process.env.GCP_PROJECT_ID
      });

      this.initialized = true;
      console.log('✅ GCP Translation Service initialized (Cloud Translation API)');
    } catch (error) {
      console.error('❌ Error initializing GCP Translation:', error);
      throw error;
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!text || text.trim().length === 0) {
        return 'en'; // Default to English
      }

      const [detection] = await this.translate.detect(text);
      const languageCode = detection.language;

      console.log(`🌍 Detected language: ${languageCode}`);

      return languageCode;

    } catch (error) {
      console.error('❌ Error detecting language:', error);
      return 'en'; // Fallback to English
    }
  }

  /**
   * Translate text to English
   */
  async translateToEnglish(text, sourceLanguage = null) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!text || text.trim().length === 0) {
        return { translatedText: '', sourceLanguage: 'en' };
      }

      // Detect language if not provided
      if (!sourceLanguage) {
        sourceLanguage = await this.detectLanguage(text);
      }

      // If already English, return as is
      if (sourceLanguage === 'en') {
        return {
          translatedText: text,
          sourceLanguage: 'en',
          translated: false
        };
      }

      console.log(`🌍 Translating from ${sourceLanguage} to English...`);

      const [translation] = await this.translate.translate(text, {
        from: sourceLanguage,
        to: 'en'
      });

      console.log(`✅ Translation complete (${translation.length} chars)`);

      return {
        translatedText: translation,
        sourceLanguage: sourceLanguage,
        translated: true
      };

    } catch (error) {
      console.error('❌ Error translating to English:', error);
      // Return original text on error
      return {
        translatedText: text,
        sourceLanguage: sourceLanguage || 'unknown',
        translated: false,
        error: error.message
      };
    }
  }

  /**
   * Translate text to target language
   */
  async translateFromEnglish(text, targetLanguage) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!text || text.trim().length === 0) {
        return text;
      }

      // If target is English, return as is
      if (targetLanguage === 'en') {
        return text;
      }

      console.log(`🌍 Translating from English to ${targetLanguage}...`);

      const [translation] = await this.translate.translate(text, {
        from: 'en',
        to: targetLanguage
      });

      console.log(`✅ Translation complete (${translation.length} chars)`);

      return translation;

    } catch (error) {
      console.error('❌ Error translating from English:', error);
      // Return original text on error
      return text;
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const [languages] = await this.translate.getLanguages();
      
      return languages.map(lang => ({
        code: lang.code,
        name: lang.name
      }));

    } catch (error) {
      console.error('❌ Error getting supported languages:', error);
      return [];
    }
  }

  /**
   * Language code to name mapping
   */
  getLanguageName(code) {
    const languageNames = {
      'en': 'English',
      'zh': 'Chinese',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'ru': 'Russian',
      'hi': 'Hindi',
      'ta': 'Tamil',
      'te': 'Telugu',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'ms': 'Malay',
      'tr': 'Turkish',
      'pl': 'Polish',
      'nl': 'Dutch',
      'sv': 'Swedish'
    };

    return languageNames[code] || code;
  }
}

export const gcpTranslationService = new GCPTranslationService();