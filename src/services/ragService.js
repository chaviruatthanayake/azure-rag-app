import { searchService } from './searchService.js';
import { embeddingService } from './embeddingService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

class RAGService {
  
  /**
   * Generate answer using Gemini (for ALL questions)
   */
  async generateAnswerWithGemini(question, context, language) {
    try {
      console.log('🤖 Using Gemini for answer generation...');

      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const prompt = `You are an expert AI assistant helping users with questions about their documents.

CONTEXT FROM USER'S DOCUMENTS:
${context}

USER QUESTION:
${question}

INSTRUCTIONS:
1. **Answer based on the context provided above**
2. **For "how-to" questions:** Provide clear, step-by-step instructions with specific details
3. **For Excel/Word/document questions:** Give practical guidance with actual steps, formulas, or commands
4. **For video content questions:** Reference what was shown/said in the video
5. **Be comprehensive and practical:**
   - Use information from the context
   - Provide actionable steps
   - Include specific tools, commands, formulas, or code when relevant
   - Add tips and best practices
6. **If the answer requires general knowledge beyond the documents:** 
   - State what you found in the documents
   - Then provide general guidance, clearly noting it's general knowledge
7. **If information is NOT in the documents at all:** Say "Information not found in the provided documents"
8. **Format clearly:** Use sections, bullet points, numbered steps, and code blocks for readability

IMPORTANT: Answer in ${language}.

YOUR DETAILED ANSWER:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      console.log(`✅ Gemini generated ${answer.length} characters`);
      return answer;

    } catch (error) {
      console.error('Error with Gemini:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Main method to generate answers
   */
  async generateAnswer(question, language = 'english') {
    try {
      console.log(`💬 Generating answer for: "${question}"`);
      console.log(`🔧 Using: Azure OpenAI (embeddings) + Gemini (answers)`);

      // 1. Generate embedding for the question
      const questionEmbedding = await embeddingService.generateEmbedding(question);
      
      // 2. Search for relevant documents
      const searchResults = await searchService.searchDocuments(questionEmbedding, 5);

      if (searchResults.length === 0) {
        return {
          answer: 'No relevant documents found. Please upload documents first.',
          sources: [],
          usedInternetSearch: false,
          usedGemini: true,
          language
        };
      }

      console.log(`📚 Building context from ${searchResults.length} documents...`);

      // 3. Build context from search results
      const context = searchResults
        .map((doc, idx) => {
          return `[Source ${idx + 1}: ${doc.fileName} (${doc.fileType})]\n${doc.content}`;
        })
        .join('\n\n---\n\n');

      // 4. Generate answer with Gemini
      const answer = await this.generateAnswerWithGemini(question, context, language);

      // 5. Return result
      return {
        answer,
        sources: searchResults,
        usedInternetSearch: false,
        usedGemini: true,
        model: GEMINI_MODEL,
        language
      };

    } catch (error) {
      console.error('Error in generateAnswer:', error);
      throw error;
    }
  }

  /**
   * Translate answer (using Gemini)
   */
  async translateAnswer(answer, targetLanguage) {
    try {
      if (targetLanguage === 'english') {
        return answer;
      }

      console.log(`🌍 Translating to ${targetLanguage} using Gemini...`);
      
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `Translate the following text to ${targetLanguage}. Preserve all formatting including line breaks, bullet points, and code blocks:

${answer}

Translated text:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const translatedAnswer = response.text();
      
      console.log(`✅ Translation completed`);
      return translatedAnswer;
      
    } catch (error) {
      console.error('Error translating:', error);
      return answer; // Return original if translation fails
    }
  }
}

export const ragService = new RAGService();