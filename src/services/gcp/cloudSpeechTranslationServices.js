import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { v2 } from '@google-cloud/translate';

/**
 * Cloud Speech Service
 * Replaces Azure Speech for speech-to-text and text-to-speech
 */
class CloudSpeechService {
  constructor() {
    this.speechClient = null;
    this.ttsClient = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Cloud Speech...');

      this.speechClient = new SpeechClient();
      this.ttsClient = new TextToSpeechClient();

      this.initialized = true;
      console.log('✅ Cloud Speech initialized');
    } catch (error) {
      console.error('❌ Error initializing Cloud Speech:', error);
      throw error;
    }
  }

  /**
   * Speech to text
   */
  async speechToText(audioBuffer, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: options.encoding || 'LINEAR16',
          sampleRateHertz: options.sampleRate || 16000,
          languageCode: options.language || 'en-US',
          enableAutomaticPunctuation: true,
        },
      };

      const [response] = await this.speechClient.recognize(request);
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');

      return {
        text: transcription,
        confidence: response.results[0]?.alternatives[0]?.confidence || 0,
      };
    } catch (error) {
      console.error('❌ Error in speech-to-text:', error);
      throw error;
    }
  }

  /**
   * Text to speech
   */
  async textToSpeech(text, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const request = {
        input: { text },
        voice: {
          languageCode: options.language || 'en-US',
          ssmlGender: options.gender || 'NEUTRAL',
        },
        audioConfig: {
          audioEncoding: options.encoding || 'MP3',
        },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);
      return response.audioContent;
    } catch (error) {
      console.error('❌ Error in text-to-speech:', error);
      throw error;
    }
  }
}

/**
 * Cloud Translation Service
 * Replaces Azure Translator
 */
class CloudTranslationService {
  constructor() {
    this.translate = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Cloud Translation...');

      this.translate = new v2.Translate();

      this.initialized = true;
      console.log('✅ Cloud Translation initialized');
    } catch (error) {
      console.error('❌ Error initializing Cloud Translation:', error);
      throw error;
    }
  }

  /**
   * Translate text
   */
  async translateText(text, targetLanguage, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const [translation] = await this.translate.translate(text, {
        to: targetLanguage,
        from: options.sourceLanguage || undefined,
      });

      return {
        text: translation,
        detectedSourceLanguage: options.sourceLanguage || 'auto',
      };
    } catch (error) {
      console.error('❌ Error translating text:', error);
      throw error;
    }
  }

  /**
   * Detect language
   */
  async detectLanguage(text) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const [detection] = await this.translate.detect(text);
      return {
        language: detection.language,
        confidence: detection.confidence || 0,
      };
    } catch (error) {
      console.error('❌ Error detecting language:', error);
      throw error;
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
      throw error;
    }
  }
}

// Export singleton instances
export const cloudSpeechService = new CloudSpeechService();
export const cloudTranslationService = new CloudTranslationService();