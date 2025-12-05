import { gcpTranslationService } from './gcp/gcpTranslationService.js';

/**
 * Translator Service - Wrapper for GCP Translation
 * Replaces Azure Translator completely
 */
class TranslatorService {
  
  async initialize() {
    return await gcpTranslationService.initialize();
  }

  async detectLanguage(text) {
    return await gcpTranslationService.detectLanguage(text);
  }

  async translateToEnglish(text, sourceLanguage = null) {
    return await gcpTranslationService.translateToEnglish(text, sourceLanguage);
  }

  async translateText(text, targetLanguage, sourceLanguage = null) {
    return await gcpTranslationService.translateText(text, targetLanguage, sourceLanguage);
  }

  getLanguageName(languageCode) {
    return gcpTranslationService.getLanguageName(languageCode);
  }

  async getSupportedLanguages() {
    return await gcpTranslationService.getSupportedLanguages();
  }
}

export const translatorService = new TranslatorService();