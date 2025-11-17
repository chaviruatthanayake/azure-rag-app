import { openAIClient } from '../config/azureClients.js';
import { searchService } from './searchService.js';
import { webSearchService } from './webSearchService.js';

export class RAGService {
  /**
   * Generate answer using RAG pipeline
   */
  async generateAnswer(question, targetLanguage = 'english') {
    try {
      console.log(`💬 Generating answer for: "${question}"`);

      // Step 1: search your knowledge base
      const relevantDocs = await searchService.searchDocuments(question, 5);
      console.log(`🔎 RAG: got ${relevantDocs.length} docs from search`);

      let usedInternetSearch = false;
      let sources = [];

      // If we found docs in the index, build context from them
      if (relevantDocs && relevantDocs.length > 0) {
        const context = relevantDocs
          .map((doc, idx) => {
            return `Source ${idx + 1} (${doc.fileName}):\n${doc.content}`;
          })
          .join('\n\n---\n\n');

        sources = relevantDocs.map((doc, idx) => ({
          id: doc.id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          language: doc.language,
          score: doc.score,
          metadata: doc.metadata
        }));

        const messages = [
          {
            role: 'system',
            content:
              'You are an AI assistant that answers questions strictly based on the provided document excerpts. ' +
              'Use ONLY the information in the sources. If they do not contain the answer, say you do not know.'
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nSources:\n${context}`
          }
        ];

        const completion = await openAIClient.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
          messages,
          temperature: 0.2
        });

        const answer = completion.choices[0].message.content;
        const translatedAnswer = await this.translateAnswer(answer, targetLanguage);

        return {
          success: true,
          question,
          answer: translatedAnswer,
          sources,
          usedInternetSearch,
          language: targetLanguage,
          timestamp: new Date().toISOString()
        };
      }

      // If no docs found in the index, optionally fall back to web search
      console.log('⚠️ No relevant documents found in knowledge base');

      let webResults = [];
      const bingKey = process.env.BING_SEARCH_API_KEY;

      // Only try web search if a real Bing key is configured
      if (bingKey && !bingKey.toLowerCase().startsWith('your_')) {
        console.log(`🌐 Searching web for: "${question}"`);
        webResults = await webSearchService.searchWeb(question, targetLanguage);
        usedInternetSearch = webResults.length > 0;
      } else {
        console.log('🌐 Skipping web search (BING_SEARCH_API_KEY not configured)');
      }

      const webContext = webResults
        .map((r, idx) => `Web Result ${idx + 1} (${r.title}):\n${r.snippet}`)
        .join('\n\n---\n\n');

      const messages = [
        {
          role: 'system',
          content:
            'You are an AI assistant. Answer the question using ONLY the given context. ' +
            'If the context is empty or does not contain the answer, say you do not have enough information.'
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nContext:\n${
            webContext || '(no relevant documents available)'
          }`
        }
      ];

      const completion = await openAIClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
        messages,
        temperature: 0.3
      });

      const answer = completion.choices[0].message.content;
      const translatedAnswer = await this.translateAnswer(answer, targetLanguage);

      return {
        success: true,
        question,
        answer: translatedAnswer,
        sources: webResults,
        usedInternetSearch,
        language: targetLanguage,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating answer:', error);
      throw error;
    }
  }

  /**
   * Translate answer to target language
   * (currently a no-op; hook in Azure Translator later)
   */
  async translateAnswer(answer, targetLanguage) {
    return answer;
  }
}

export const ragService = new RAGService();
