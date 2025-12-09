import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GCP Chat Service - Using Google AI Studio API
 * Uses the GEMINI_API_KEY from .env instead of Vertex AI
 */
export class GCPChatService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.apiKey = null;
  }

  async initialize() {
    if (this.genAI) return;

    try {
      this.apiKey = process.env.GEMINI_API_KEY;

      if (!this.apiKey) {
        throw new Error('GEMINI_API_KEY not found in environment');
      }

      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Use gemini-2.0-flash-exp (your env has this model)
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
      this.model = this.genAI.getGenerativeModel({ model: modelName });

      console.log('✅ GCP Chat Service initialized (Google AI Studio)');
      console.log(`   Model: ${modelName}`);
    } catch (error) {
      console.error('❌ Error initializing GCP Chat:', error.message);
      throw error;
    }
  }

  /**
   * Generate an answer using Gemini
   */
  async generateAnswer(question, context, conversationHistory = []) {
    await this.initialize();

    try {
      console.log('🤖 Generating answer with Gemini (AI Studio API)...');

      const systemPrompt = `You are a helpful AI assistant that provides detailed, accurate answers based on the provided context.

IMPORTANT RULES:
1. Answer based on the context provided below
2. Be thorough and detailed in your response - include all relevant information from the context
3. If the context contains visual content from OCR or video frames, combine information from multiple frames to give a complete answer
4. Structure your answer clearly with proper formatting when needed
5. If information is incomplete or unclear, mention what you found and what might be missing
6. Only say you don't have information if the context is completely unrelated to the question

CONTEXT:
${context}

QUESTION: ${question}

Provide a comprehensive, well-structured answer based on the context above.`;

      const result = await this.model.generateContent(systemPrompt);
      const response = result.response;
      const answer = response.text();

      console.log('✅ Answer generated successfully');

      return answer;
    } catch (error) {
      console.error('❌ Error generating answer:', error);
      throw error;
    }
  }

  /**
   * Stream answer generation (for real-time responses)
   */
  async streamAnswer(question, context, onChunk) {
    await this.initialize();

    try {
      const systemPrompt = `You are a helpful AI assistant. Answer based on this context:\n\n${context}\n\nQuestion: ${question}`;

      const result = await this.model.generateContentStream(systemPrompt);

      let fullText = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        if (onChunk) onChunk(chunkText);
      }

      return fullText;
    } catch (error) {
      console.error('Error streaming answer:', error);
      throw error;
    }
  }
}

export const gcpChatService = new GCPChatService();