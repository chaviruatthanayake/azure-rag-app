import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Hybrid GCP Service
 * - Uses existing Gemini API for chat (already working)
 * - Uses Vertex AI for embeddings (more reliable)
 */
class HybridGCPService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.auth = null;
    this.projectId = process.env.GCP_PROJECT_ID || 'copper-depot-480116-h4';
    this.location = process.env.GCP_REGION || 'us-central1';
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.initialized = false;
  }

  /**
   * Initialize service
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Hybrid GCP Service...');

      // Initialize Gemini API (for chat)
      if (!this.geminiApiKey) {
        throw new Error('GEMINI_API_KEY not found in environment');
      }

      this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' 
      });

      // Initialize auth for Vertex AI embeddings
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });

      this.initialized = true;
      console.log('✅ Hybrid GCP Service initialized');
      console.log(`   Chat: Gemini API (${process.env.GEMINI_MODEL || 'gemini-1.5-flash'})`);
      console.log(`   Embeddings: Vertex AI (text-embedding-004)`);
    } catch (error) {
      console.error('❌ Error initializing service:', error);
      throw error;
    }
  }

  /**
   * Get access token for Vertex AI
   */
  async getAccessToken() {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  }

  /**
   * Generate embeddings using Vertex AI
   */
  async generateEmbeddings(text, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const model = 'text-embedding-004';
      const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:predict`;

      const request = {
        instances: [{ content: text }],
      };

      const token = await this.getAccessToken();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding request failed: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const embedding = data.predictions[0].embeddings.values;

      return embedding; // 768 dimensions
    } catch (error) {
      console.error('❌ Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings in batch
   */
  async generateEmbeddingsBatch(texts, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📊 Generating embeddings for ${texts.length} texts...`);

      const embeddings = [];
      const batchSize = options.batchSize || 5;

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map(text => this.generateEmbeddings(text, options));
        const batchEmbeddings = await Promise.all(batchPromises);
        embeddings.push(...batchEmbeddings);

        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`   Progress: ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
      }

      console.log(`✅ Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('❌ Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate chat response using Gemini API
   */
  async generateResponse(prompt, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        text,
        usage: {
          promptTokens: 0, // Gemini API doesn't return token counts
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      console.error('❌ Error generating response:', error);
      throw error;
    }
  }

  /**
   * Chat with context
   */
  async chat(messages, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Convert messages to prompt
      const prompt = messages.map(msg => {
        if (msg.role === 'user') return `User: ${msg.content}`;
        if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
        return msg.content;
      }).join('\n\n');

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        role: 'assistant',
        content: text,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      console.error('❌ Error in chat:', error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      await this.initialize();
      
      // Test chat
      console.log('Testing Gemini API chat...');
      const chatResponse = await this.generateResponse('Hello!');
      console.log('✅ Chat works:', chatResponse.text.substring(0, 50) + '...');
      
      // Test embeddings
      console.log('Testing Vertex AI embeddings...');
      const embedding = await this.generateEmbeddings('Test text');
      console.log(`✅ Embeddings work: ${embedding.length} dimensions`);
      
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const hybridGCPService = new HybridGCPService();