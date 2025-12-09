import { gcpEmbeddingService } from './gcp/gcpEmbeddingService.js';

/**
 * Embedding Service Wrapper
 * Uses GCP Vertex AI embeddings
 */
class EmbeddingService {
  // No initialize needed - gcpEmbeddingService handles it internally
  
  async generateEmbedding(text) {
    return await gcpEmbeddingService.generateEmbedding(text);
  }

  async generateEmbeddings(texts) {
    return await gcpEmbeddingService.generateEmbeddings(texts);
  }
}

export const embeddingService = new EmbeddingService();