import { v2 } from '@google-cloud/translate';

/**
 * GCP Translation Service
 * Replaces Azure Translator with Google Cloud Translation API
 */
class GCPTranslationService {
  constructor() {
    this.translate = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔧 Initializing GCP Translation Service...');

      this.translate = new v2.Translate();

      this.initialized = true;
      console.log('✅ GCP Translation Service initialized');
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
        return 'en';
      }

      const [detection] = await this.translate.detect(text);
      
      console.log(`🌍 Detected language: ${detection.language}`);
      
      return detection.language;

    } catch (error) {
      console.error('❌ Error detecting language:', error);
      return 'en'; // Default to English
    }
  }

  /**
   * Translate text to target language
   */
  async translateText(text, targetLanguage, sourceLanguage = null) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!text || text.trim().length === 0) {
        return {
          translatedText: text,
          detectedSourceLanguage: sourceLanguage || 'en',
          wasTranslated: false
        };
      }

      console.log(`🌐 Translating from ${sourceLanguage || 'auto'} to ${targetLanguage}...`);

      const options = {
        to: targetLanguage,
      };

      if (sourceLanguage) {
        options.from = sourceLanguage;
      }

      const [translation] = await this.translate.translate(text, options);

      return {
        translatedText: translation,
        detectedSourceLanguage: sourceLanguage || 'auto',
        wasTranslated: true
      };

    } catch (error) {
      console.error('❌ Error translating text:', error);
      return {
        translatedText: text,
        detectedSourceLanguage: sourceLanguage || 'unknown',
        wasTranslated: false,
        error: error.message
      };
    }
  }

  /**
   * Translate to English (common use case)
   */
  async translateToEnglish(text, sourceLanguage = null) {
    try {
      // If already English, don't translate
      if (!sourceLanguage) {
        sourceLanguage = await this.detectLanguage(text);
      }

      if (sourceLanguage === 'en') {
        console.log('⏭️  Text already in English, skipping translation');
        return {
          translatedText: text,
          detectedSourceLanguage: 'en',
          wasTranslated: false
        };
      }

      console.log(`🌐 Translating from ${sourceLanguage} to English...`);

      // For long texts, translate in chunks
      if (text.length > 5000) {
        return await this.translateLongText(text, 'en', sourceLanguage);
      }

      const result = await this.translateText(text, 'en', sourceLanguage);
      
      console.log(`✅ Translated ${text.length} chars from ${sourceLanguage} to English`);
      
      return result;

    } catch (error) {
      console.error('❌ Error translating to English:', error);
      return {
        translatedText: text,
        detectedSourceLanguage: sourceLanguage || 'unknown',
        wasTranslated: false,
        error: error.message
      };
    }
  }

  /**
   * Translate long text in chunks
   */
  async translateLongText(text, targetLanguage, sourceLanguage = null) {
    try {
      const chunkSize = 4000; // Safe chunk size
      const chunks = [];

      // Split into chunks
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
      }

      console.log(`   Translating ${chunks.length} chunks...`);

      const translatedChunks = [];

      for (let i = 0; i < chunks.length; i++) {
        console.log(`   Translating chunk ${i + 1}/${chunks.length}...`);
        const result = await this.translateText(chunks[i], targetLanguage, sourceLanguage);
        translatedChunks.push(result.translatedText);
      }

      const translatedText = translatedChunks.join('');

      console.log(`✅ Translated ${text.length} chars from ${sourceLanguage} to ${targetLanguage}`);

      return {
        translatedText,
        detectedSourceLanguage: sourceLanguage || 'auto',
        wasTranslated: true
      };

    } catch (error) {
      console.error('❌ Error translating long text:', error);
      return {
        translatedText: text,
        detectedSourceLanguage: sourceLanguage || 'unknown',
        wasTranslated: false,
        error: error.message
      };
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
      return languages;

    } catch (error) {
      console.error('❌ Error getting supported languages:', error);
      return [];
    }
  }

  /**
   * Get language name from code
   */
  getLanguageName(languageCode) {
    const languageNames = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'zh-Hans': 'Chinese (Simplified)',
      'zh-Hant': 'Chinese (Traditional)',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'tr': 'Turkish',
      'nl': 'Dutch',
      'pl': 'Polish',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'ro': 'Romanian',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'id': 'Indonesian',
      'ms': 'Malay',
      'uk': 'Ukrainian',
      'he': 'Hebrew',
      'el': 'Greek',
      'bg': 'Bulgarian',
      'sr': 'Serbian',
      'hr': 'Croatian',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'lt': 'Lithuanian',
      'lv': 'Latvian',
      'et': 'Estonian'
    };

    return languageNames[languageCode] || languageCode;
  }
}

export const gcpTranslationService = new GCPTranslationService();