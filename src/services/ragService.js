import { searchService } from './searchService.js';
import { embeddingService } from './embeddingService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

// Initialize Azure OpenAI Client
const azureOpenAIClient = new OpenAIClient(
  process.env.AZURE_OPENAI_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
);

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-pro';

class RAGService {
  
  /**
   * Check if query needs advanced reasoning (Gemini)
   */
  isComplexQuery(query) {
    const complexPatterns = [
      /how to/i,
      /how do i/i,
      /how can i/i,
      /how should i/i,
      /what are the steps/i,
      /guide me/i,
      /teach me/i,
      /explain how/i,
      /walk me through/i,
      /show me how/i,
      /help me (to|with)/i,
      /can you help/i,
      /give me (steps|instructions|guidance)/i,
      /what's the process/i,
      /what is the process/i
    ];

    return complexPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Generate answer using Gemini (for complex reasoning)
   */
  async generateAnswerWithGemini(question, context, language) {
    try {
      if (!genAI) {
        console.warn('⚠️ Gemini not configured, falling back to Azure OpenAI');
        return this.generateAnswerWithAzureOpenAI(question, context, language);
      }

      console.log('🤖 Using Gemini for advanced reasoning...');

      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const prompt = `You are an expert AI assistant helping users with practical questions based on their documents.

CONTEXT FROM USER'S DOCUMENTS:
${context}

USER QUESTION:
${question}

INSTRUCTIONS:
1. **If the question asks "how to" do something:** Provide clear, step-by-step instructions. Be practical and specific.
2. **For Excel/spreadsheet questions:** Give actual steps, formulas, or code examples.
3. **For document editing questions:** Provide actionable steps the user can follow.
4. **Use the context wisely:** Reference what you found in the documents, then provide practical guidance beyond just what's in the documents.
5. **Be comprehensive:** If the user is asking how to do something with their files, explain:
   - How to download/access the file (if needed)
   - Step-by-step process
   - Specific tools or commands to use
   - Code examples if relevant
   - Tips or best practices

6. **If information is partially in documents:** Use that as a starting point, then provide complete guidance.
7. **Format clearly:** Use bullet points, numbered lists, code blocks, and sections for readability.

IMPORTANT: Answer in ${language}.

YOUR HELPFUL ANSWER:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      console.log(`✅ Gemini generated ${answer.length} characters`);
      return answer;

    } catch (error) {
      console.error('Error with Gemini:', error.message);
      console.log('⚠️ Falling back to Azure OpenAI');
      return this.generateAnswerWithAzureOpenAI(question, context, language);
    }
  }

  /**
   * Generate answer using Azure OpenAI (for simple queries)
   */
  async generateAnswerWithAzureOpenAI(question, context, language) {
    try {
      console.log('🤖 Using Azure OpenAI for answer generation...');

      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';

      const messages = [
        { 
          role: 'system', 
          content: `You are a helpful AI assistant that answers questions based on the provided context.
If the information is not in the context, say "Information not found in the provided documents."
Answer in ${language}.`
        },
        { 
          role: 'user', 
          content: `Context from documents:\n${context}\n\nQuestion: ${question}\n\nAnswer:`
        }
      ];

      const response = await azureOpenAIClient.getChatCompletions(
        deploymentName,
        messages,
        {
          maxTokens: 1500,
          temperature: 0.7
        }
      );

      const answer = response.choices[0].message.content;
      console.log(`✅ Azure OpenAI generated ${answer.length} characters`);
      return answer;

    } catch (error) {
      console.error('Error with Azure OpenAI:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Main method to generate answer with intelligent AI selection
   */
  async generateAnswer(question, language = 'english', forceGemini = null) {
    try {
      console.log(`💬 Generating answer for: "${question}"`);

      // 1. Generate embeddings for the question
      const questionEmbedding = await embeddingService.generateEmbeddings([question]);
      
      // 2. Search for relevant documents
      console.log('🔍 Searching for relevant documents...');
      const searchResults = await searchService.searchDocuments(
        questionEmbedding[0],
        5 // Top 5 results
      );

      console.log(`✅ Found ${searchResults.length} relevant documents`);

      if (searchResults.length === 0) {
        return {
          answer: 'No relevant documents found. Please upload documents first.',
          sources: [],
          usedInternetSearch: false,
          usedGemini: false,
          language
        };
      }

      // 3. Build context from search results
      const context = searchResults
        .map((doc, idx) => {
          return `[Source ${idx + 1}: ${doc.fileName}]\n${doc.content}`;
        })
        .join('\n\n---\n\n');

      // 4. Decide which AI to use
      const isComplex = this.isComplexQuery(question);
      const shouldUseGemini = forceGemini !== null 
        ? forceGemini 
        : (isComplex && genAI !== null);

      let answer;
      
      if (shouldUseGemini) {
        console.log('💡 Complex "how-to" query detected → Using Gemini');
        answer = await this.generateAnswerWithGemini(question, context, language);
      } else {
        console.log('📝 Simple query → Using Azure OpenAI');
        answer = await this.generateAnswerWithAzureOpenAI(question, context, language);
      }

      // 5. Return result
      return {
        answer,
        sources: searchResults,
        usedInternetSearch: false,
        usedGemini: shouldUseGemini,
        language
      };

    } catch (error) {
      console.error('Error in generateAnswer:', error);
      throw error;
    }
  }

  /**
   * Translate answer to different language (placeholder)
   */
  async translateAnswer(answer, targetLanguage) {
    // If you have Azure Translator configured, implement translation here
    // For now, just return the answer as-is
    console.log(`🌍 Translation to ${targetLanguage} requested (not implemented)`);
    return answer;
  }

  /**
   * Get answer with internet search fallback (placeholder for future)
   */
  async generateAnswerWithInternetFallback(question, language = 'english') {
    try {
      // First try regular RAG
      const result = await this.generateAnswer(question, language);
      
      // If no good answer found, could add internet search here
      if (result.sources.length === 0) {
        console.log('📡 Could use internet search here (not implemented)');
      }
      
      return result;
    } catch (error) {
      console.error('Error with fallback:', error);
      throw error;
    }
  }
}

export const ragService = new RAGService();