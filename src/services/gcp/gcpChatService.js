import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Enhanced Chat Service with Web Search Fallback
 * 
 * Flow:
 * 1. Try to answer from documents
 * 2. If no relevant info found, search the web
 * 3. Save web results to database for future use
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
   * Check if the retrieved context is relevant to the question
   */
  isContextRelevant(question, context, sources) {
    // If no sources or context is too short, likely not relevant
    if (!sources || sources.length === 0 || context.length < 100) {
      console.log('   ❌ No sources or minimal context');
      return false;
    }

    // Extract key terms from question (ignore common words)
    const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'to', 'is', 'in', 'what', 'where', 'when', 'why', 'can', 'you', 'please', 'tell', 'me', 'about']);
    const questionTerms = question.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    console.log(`   📝 Key question terms: ${questionTerms.slice(0, 5).join(', ')}...`);
    
    const contextLower = context.toLowerCase();
    const matchedTerms = questionTerms.filter(term => contextLower.includes(term));
    
    console.log(`   ✓ Matched terms: ${matchedTerms.length}/${questionTerms.length}`);
    
    // Stricter threshold: need at least 50% of key terms to match
    // AND at least 3 matched terms for longer questions
    const relevanceRatio = matchedTerms.length / questionTerms.length;
    const hasMinimumMatches = matchedTerms.length >= Math.min(3, questionTerms.length);
    
    const isRelevant = relevanceRatio >= 0.5 && hasMinimumMatches;
    
    console.log(`   ${isRelevant ? '✅' : '❌'} Relevance: ${(relevanceRatio * 100).toFixed(0)}%, Min matches: ${hasMinimumMatches}`);
    
    return isRelevant;
  }

  /**
   * Search the web using Google Search grounding
   */
  async searchWeb(question) {
    try {
      console.log('🌐 Searching the web for information...');
      
      // Use Gemini with Google Search grounding (correct syntax)
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        tools: [{ 
          googleSearch: {}  // ← Changed from googleSearchRetrieval to googleSearch
        }]
      });

      const prompt = `Search the web and provide detailed information about: ${question}

Please include:
1. Step-by-step instructions if it's a procedure
2. Safety warnings if applicable
3. Technical specifications if relevant
4. Best practices

Be thorough and accurate.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const answer = response.text();

      console.log('✅ Web search completed');
      
      return {
        answer,
        source: 'web_search',
        query: question
      };
    } catch (error) {
      console.error('❌ Web search failed:', error);
      
      // Fallback: if web search fails, use Gemini without search
      console.log('⚠️ Falling back to Gemini without web search...');
      try {
        const fallbackModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const fallbackPrompt = `Based on your training knowledge, provide detailed information about: ${question}

Please include:
1. Step-by-step instructions if it's a procedure
2. Safety warnings if applicable
3. Technical specifications if relevant
4. Best practices

Note: This answer is based on general knowledge, not real-time web search.`;

        const fallbackResult = await fallbackModel.generateContent(fallbackPrompt);
        const fallbackAnswer = fallbackResult.response.text();
        
        console.log('✅ Generated answer from Gemini knowledge base');
        
        return {
          answer: `⚠️ *Web search unavailable - answer based on AI knowledge:*\n\n${fallbackAnswer}`,
          source: 'web_search_fallback',
          query: question
        };
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  /**
   * Save web search results to database for future use
   */
  async saveWebSearchToDatabase(question, answer, embeddingService, searchService) {
    try {
      console.log('💾 Saving web search results to database...');

      // Generate embedding for the question and answer
      const contentToEmbed = `Question: ${question}\n\nAnswer: ${answer}`;
      const embedding = await embeddingService.generateEmbedding(contentToEmbed);

      // Create a document structure that matches your indexDocument expectations
      const documentId = `web_search_${Date.now()}`;
      const fileName = `Web Search: ${question.substring(0, 50)}...`;
      
      // Prepare chunks in the format expected by indexDocument
      const chunks = [{
        text: answer,
        embedding: embedding  // This is already an array
      }];

      // Create metadata
      const metadata = {
        source: 'web_search',
        query: question,
        timestamp: new Date().toISOString(),
        language: 'en',
        fileType: 'text/plain'
      };

      // Index using the same format as regular documents
      await searchService.indexDocument({
        id: documentId,
        fileName: fileName,
        fileType: 'text/plain',
        language: 'en',
        blobName: fileName,
        pageCount: 1,
        uploadDate: new Date().toISOString(),
        chunks: chunks,
        metadata: metadata
      });

      console.log('✅ Web search results saved to database');
      
      return documentId;
    } catch (error) {
      console.error('❌ Failed to save web search results:', error);
      // Don't throw - we still want to return the answer even if saving fails
    }
  }

  /**
   * Generate answer with web search fallback
   */
  async generateAnswer(question, context, conversationHistory = [], sources = null, embeddingService = null, searchService = null) {
    await this.initialize();

    try {
      // Check if context is relevant
      const hasRelevantContext = this.isContextRelevant(question, context, sources);

      console.log(`🔍 Context relevance: ${hasRelevantContext ? 'YES' : 'NO'}`);

      let finalAnswer = '';
      let answerSource = 'documents';

      if (hasRelevantContext) {
        // Answer from documents
        console.log('🤖 Generating answer from documents...');
        
        const systemPrompt = `You are a technical documentation AI assistant specializing in HP Indigo printers and related equipment.

CONTEXT FROM DOCUMENTS:
${context}

USER QUESTION: ${question}

Provide a detailed, accurate answer based on the context above. Include step-by-step instructions, safety warnings, and technical details as relevant.`;

        const result = await this.model.generateContent(systemPrompt);
        finalAnswer = result.response.text();
        answerSource = 'documents';

      } else {
        // Context not relevant - search the web
        console.log('⚠️ No relevant information in documents');
        console.log('🌐 Falling back to web search...');

        const webResult = await this.searchWeb(question);
        finalAnswer = webResult.answer;
        answerSource = 'web_search';

        // Save to database for future use
        if (embeddingService && searchService) {
          await this.saveWebSearchToDatabase(question, finalAnswer, embeddingService, searchService);
        }

        // Add note about source
        finalAnswer = `ℹ️ *Information retrieved from web search (not found in your documents):*\n\n${finalAnswer}\n\n---\n*This information has been saved to the database for future reference.*`;
      }

      console.log('✅ Answer generated successfully');
      console.log(`📊 Source: ${answerSource}`);

      return {
        answer: finalAnswer,
        source: answerSource
      };

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
      const systemPrompt = `You are a technical documentation AI assistant. Answer based on the provided context.

CONTEXT:
${context}

QUESTION: ${question}

Provide a detailed answer:`;

      const result = await this.model.generateContentStream(systemPrompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (onChunk) {
          onChunk(chunkText);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error streaming answer:', error);
      throw error;
    }
  }
}

export const gcpChatService = new GCPChatService();