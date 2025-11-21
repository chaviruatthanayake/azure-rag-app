import { openAIClient } from '../config/azureClients.js';

export class EmbeddingService {
  
  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text) {
    try {
      const response = await openAIClient.embeddings.create({
        input: text,
        model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts) {
    try {
      console.log(`🔄 Generating embeddings for ${texts.length} texts...`);
      
      // Azure OpenAI has a limit of 16 texts per request
      const batchSize = 16;
      const embeddings = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await openAIClient.embeddings.create({
          input: batch,
          model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
        });

        embeddings.push(...response.data.map(d => d.embedding));
      }

      console.log(`✅ Generated ${embeddings.length} embeddings`);
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

export const embeddingService = new EmbeddingService();