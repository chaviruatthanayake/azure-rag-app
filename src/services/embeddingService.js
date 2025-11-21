import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

// Initialize Azure OpenAI for embeddings only
const openaiClient = new OpenAIClient(
  process.env.AZURE_OPENAI_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
);

class EmbeddingService {
  
  /**
   * Generate embeddings using Azure OpenAI (to match existing 1536-dim index)
   */
  async generateEmbeddings(texts) {
    try {
      // Ensure texts is an array
      if (!Array.isArray(texts)) {
        texts = [texts];
      }

      console.log(`🔄 Generating embeddings for ${texts.length} texts using Azure OpenAI...`);

      const deploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';

      const response = await openaiClient.getEmbeddings(deploymentName, texts);

      const embeddings = response.data.map(item => item.embedding);

      console.log(`✅ Generated ${embeddings.length} embeddings (dimension: ${embeddings[0].length})`);
      return embeddings;

    } catch (error) {
      console.error('Error generating embeddings with Azure OpenAI:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Generate single embedding
   */
  async generateEmbedding(text) {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }
}

export const embeddingService = new EmbeddingService();