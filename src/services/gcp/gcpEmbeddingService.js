import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GCP Embedding Service - Using Gemini Embedding Model
 * Uses the same API key as Gemini chat (100% FREE)
 */
export class GCPEmbeddingService {
  constructor() {
    this.genAI = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found in environment');
      }

      this.genAI = new GoogleGenerativeAI(apiKey);

      console.log('✅ GCP Embedding Service initialized (Gemini)');
      console.log(`   Model: text-embedding-004 (768-dim, FREE)`);

      this.initialized = true;
    } catch (error) {
      console.error('❌ Error initializing GCP Embedding Service:', error.message);
      throw error;
    }
  }

  /**
   * Generate embedding using Gemini API
   */
  async generateEmbedding(text) {
    await this.initialize();

    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Text must be a non-empty string');
      }

      // Truncate if too long
      const maxLength = 10000;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

      // Use Gemini's embedding model
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });

      const result = await model.embedContent(truncatedText);
      const embedding = result.embedding.values;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response');
      }

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts) {
    await this.initialize();

    try {
      if (!Array.isArray(texts)) {
        throw new Error('Texts must be an array');
      }

      console.log(`🔢 Generating ${texts.length} embeddings using Gemini...`);

      const embeddings = [];

      // Process in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        
        embeddings.push(...batchEmbeddings);
        
        // Small delay between batches
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Generated ${embeddings.length} embeddings (768-dim each)`);
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1, embedding2) {
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      throw new Error('Embeddings must be arrays');
    }
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

export const gcpEmbeddingService = new GCPEmbeddingService();