import { hybridGCPService } from './gcp/hybridGCPService.js';

/**
 * Embedding Service - Now uses Vertex AI
 */
class EmbeddingService {
  async initialize() {
    return await hybridGCPService.initialize();
  }

  async generateEmbedding(text) {
    return await hybridGCPService.generateEmbeddings(text);
  }

  // Alias for compatibility - handles both single text and arrays
  async generateEmbeddings(texts) {
    // If single text, return single embedding
    if (typeof texts === 'string') {
      return await this.generateEmbedding(texts);
    }
    // If array, generate batch
    return await hybridGCPService.generateEmbeddingsBatch(texts);
  }

  async generateEmbeddingsBatch(texts) {
    return await hybridGCPService.generateEmbeddingsBatch(texts);
  }
}

export const embeddingService = new EmbeddingService();