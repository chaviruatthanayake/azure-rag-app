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

      const prompt = `You are a highly accurate AI assistant that answers questions STRICTLY based on provided document content.

==================================================
DOCUMENT CONTENT (Your ONLY source of information):
==================================================
${context}

==================================================
USER'S QUESTION: ${question}
==================================================

CRITICAL RULES (Follow EXACTLY):

1. READ THE DOCUMENT CONTENT ABOVE THOROUGHLY
   - The content includes text extracted from PDFs, Word docs, Excel files, images (via OCR), and videos (via transcription)
   - File names show the source: [Source X: filename.ext (type)]
   - THIS IS YOUR PRIMARY AND ONLY SOURCE - Use it!

2. ANSWER STRATEGY:
   
   A) IF the document content CONTAINS the answer:
      ✓ Provide a detailed, accurate answer
      ✓ Quote or reference specific information from the documents
      ✓ Mention which file(s) the information came from
      ✓ Be specific and comprehensive
   
   B) IF the document content is RELATED but doesn't fully answer:
      ✓ Start with: "Based on the documents, here's what I found: [info from docs]"
      ✓ Then add: "To fully answer your question: [general knowledge]"
      ✓ Clearly separate what's from docs vs. general knowledge
   
   C) IF the document content is NOT RELATED at all:
      ✓ Say: "The provided documents don't contain information about [topic]."
      ✓ Then offer: "However, I can provide general information: [helpful answer]"

3. FOR DIFFERENT FILE TYPES:
   - Images (PNG/JPG): The content shows text extracted via OCR
   - Videos (MP4/MOV): The content shows transcribed speech and visible text
   - Documents (PDF/DOCX): The content shows the actual document text
   - Spreadsheets (XLSX): The content shows data from all sheets

4. FOR "HOW-TO" QUESTIONS:
   - First check if documents contain instructions
   - If yes: Use those instructions
   - If no: Provide standard how-to steps with clear disclaimer

5. QUALITY REQUIREMENTS:
   ✓ Be accurate - Never make up information
   ✓ Be specific - Use actual details from documents
   ✓ Be helpful - Provide actionable information
   ✓ Be honest - Admit when documents don't contain the answer
   ✓ Be clear - Use proper formatting (bullets, numbers, sections)

6. LANGUAGE: Respond in ${language}

==================================================
YOUR ANSWER (Following all rules above):
==================================================`;

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
      
      // 2. Search for relevant documents (get top 10 for better context)
      const searchResults = await searchService.searchDocuments(questionEmbedding, 10);

      if (searchResults.length === 0) {
        return {
          answer: 'No relevant documents found. Please upload documents first or sync from Google Drive.',
          sources: [],
          usedInternetSearch: false,
          usedGemini: true,
          language
        };
      }

      console.log(`📚 Building context from ${searchResults.length} unique documents...`);

      // 3. Build rich context from search results
      const context = searchResults
        .map((doc, idx) => {
          const preview = doc.content.length > 2000 ? doc.content.substring(0, 2000) + '...' : doc.content;
          return `[Source ${idx + 1}: ${doc.fileName} (${doc.fileType})]\n${preview}`;
        })
        .join('\n\n---\n\n');

      console.log(`📝 Context built: ${context.length} characters from ${searchResults.length} sources`);

      // 4. Generate answer with Gemini
      const answer = await this.generateAnswerWithGemini(question, context, language);

      // 5. Return result with only top 5 sources for UI display
      return {
        answer,
        sources: searchResults.slice(0, 5), // Only show top 5 in UI
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