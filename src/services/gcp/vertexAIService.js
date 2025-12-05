import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';

/**
 * Vertex AI Service - Complete replacement for Azure OpenAI
 * Handles chat generation and embeddings using Google Vertex AI
 */
class VertexAIService {
  constructor() {
    this.vertexAI = null;
    this.generativeModel = null;
    this.auth = null;
    this.projectId = process.env.GCP_PROJECT_ID || 'copper-depot-480116-h4';
    this.location = process.env.GCP_REGION || 'us-central1';
    this.initialized = false;
  }

  /**
   * Initialize Vertex AI client
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Vertex AI...');

      // Initialize auth
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });

      // Initialize Vertex AI
      this.vertexAI = new VertexAI({
        project: this.projectId,
        location: this.location,
      });

      // Initialize generative model (Gemini)
      this.generativeModel = this.vertexAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.95,
        },
      });

      this.initialized = true;
      console.log('✅ Vertex AI initialized successfully');
      console.log(`   Project: ${this.projectId}`);
      console.log(`   Location: ${this.location}`);
      console.log(`   Chat Model: gemini-1.5-flash`);
      console.log(`   Embedding Model: text-embedding-004`);
    } catch (error) {
      console.error('❌ Error initializing Vertex AI:', error);
      throw error;
    }
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken() {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  }

  /**
   * Generate embeddings for text using Vertex AI text-embedding-004
   * Returns 768-dimensional vector (same as Azure OpenAI text-embedding-ada-002)
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

      return embedding; // Returns 768-dimensional vector
    } catch (error) {
      console.error('❌ Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📊 Generating embeddings for ${texts.length} texts...`);

      const embeddings = [];
      const batchSize = options.batchSize || 5;

      // Process in batches to avoid rate limits
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
   * Generate chat response using Gemini
   */
  async generateResponse(prompt, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const request = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      // Override temperature if provided
      if (options.temperature !== undefined) {
        this.generativeModel.generationConfig.temperature = options.temperature;
      }

      const result = await this.generativeModel.generateContent(request);
      const response = result.response;
      
      return {
        text: response.candidates[0].content.parts[0].text,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      console.error('❌ Error generating response:', error);
      throw error;
    }
  }

  /**
   * Generate streaming response
   */
  async *generateResponseStream(prompt, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const request = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      const streamingResult = await this.generativeModel.generateContentStream(request);

      for await (const chunk of streamingResult.stream) {
        const text = chunk.candidates[0].content.parts[0].text;
        yield text;
      }
    } catch (error) {
      console.error('❌ Error generating streaming response:', error);
      throw error;
    }
  }

  /**
   * Chat with context (conversation history)
   */
  async chat(messages, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Convert messages to Gemini format
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const request = { contents };

      const result = await this.generativeModel.generateContent(request);
      const response = result.response;
      
      return {
        role: 'assistant',
        content: response.candidates[0].content.parts[0].text,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      console.error('❌ Error in chat:', error);
      throw error;
    }
  }

  /**
   * Test connection to Vertex AI
   */
  async testConnection() {
    try {
      await this.initialize();
      const testResponse = await this.generateResponse('Hello, this is a test.');
      console.log('✅ Vertex AI connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Vertex AI connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const vertexAIService = new VertexAIService();