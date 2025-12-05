import { hybridGCPService } from './gcp/hybridGCPService.js';
import { searchService } from './searchService.js';

/**
 * Query Service - Uses Gemini for answers
 */
async function answerQuestion(question, options = {}) {
  try {
    // 1. Search for relevant documents
    console.log(`🔍 Searching for: "${question}"`);
    const searchResults = await searchService.search(question, options.topK || 5);
    
    if (searchResults.length === 0) {
      return {
        answer: "I couldn't find any relevant documents to answer your question.",
        sources: [],
        confidence: 0,
      };
    }

    // 2. Build context from search results
    const context = searchResults
      .map((result, i) => `[${i + 1}] ${result.metadata.text || result.metadata.content}`)
      .join('\n\n');

    // 3. Create prompt for Gemini
    const prompt = `You are a helpful assistant that answers questions based on the provided context.

Context:
${context}

Question: ${question}

Instructions:
- Answer based ONLY on the context provided above
- If the context doesn't contain enough information, say so
- Cite the source numbers [1], [2], etc. when referencing specific information
- Be concise and accurate

Answer:`;

    // 4. Generate answer with Gemini
    console.log('🤖 Generating answer with Gemini...');
    const response = await hybridGCPService.generateResponse(prompt);

    // 5. Return structured response
    return {
      answer: response.text,
      sources: searchResults.map(r => ({
        id: r.id,
        score: r.score,
        ...r.metadata,
      })),
      confidence: searchResults[0]?.score || 0,
      usage: response.usage,
    };
  } catch (error) {
    console.error('❌ Error answering question:', error);
    throw error;
  }
}

export { answerQuestion };