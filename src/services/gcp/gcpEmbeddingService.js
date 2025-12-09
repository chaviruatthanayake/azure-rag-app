import { VertexAI } from '@google-cloud/vertexai';

/**
 * GCP Embedding Service
 * Uses Vertex AI text-embedding-004 (with your $300 credits - NO rate limits!)
 */
class GCPEmbeddingService {
  constructor() {
    this.vertexAI = null;
    this.model = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const projectId = process.env.GCP_PROJECT_ID;
      const location = process.env.GCP_REGION || 'us-central1';

      if (!projectId) {
        throw new Error('GCP_PROJECT_ID not found in environment');
      }

      this.vertexAI = new VertexAI({
        project: projectId,
        location: location
      });

      this.initialized = true;
      console.log('✅ GCP Embedding Service initialized (Vertex AI)');
      console.log(`   Project: ${projectId}, Region: ${location}`);
      console.log('   Model: text-embedding-004');
    } catch (error) {
      console.error('❌ Error initializing GCP Embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using Vertex AI text-embedding-004
   * Returns 768-dimensional vectors
   */
  async generateEmbeddings(texts) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Validate inputs
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts must be a non-empty array');
      }

      // Filter and validate
      const validTexts = texts.filter(text => {
        if (!text || typeof text !== 'string') {
          console.warn('⚠️ Skipping invalid text:', typeof text, JSON.stringify(text));
          return false;
        }
        const trimmed = text.trim();
        if (trimmed.length === 0) {
          console.warn('⚠️ Skipping empty text');
          return false;
        }
        return true;
      }).map(text => text.trim());

      if (validTexts.length === 0) {
        throw new Error('No valid texts after filtering');
      }

      console.log(`🔢 Generating ${validTexts.length} embeddings using Vertex AI...`);

      // Use Vertex AI Embeddings API
      const url = `https://${process.env.GCP_REGION || 'us-central1'}-aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_REGION || 'us-central1'}/publishers/google/models/text-embedding-004:predict`;

      // Get auth token
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();

      // Prepare instances
      const instances = validTexts.map(text => ({
        content: text,
        task_type: 'RETRIEVAL_DOCUMENT'
      }));

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: instances
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vertex AI Embeddings API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      // Extract embeddings (768 dimensions)
      const embeddings = data.predictions.map(pred => pred.embeddings.values);

      console.log(`✅ Generated ${embeddings.length} embeddings (768-dim each)`);

      return embeddings;

    } catch (error) {
      console.error('❌ Error generating embeddings:', error);
      throw error;
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

export const gcpEmbeddingService = new GCPEmbeddingService();