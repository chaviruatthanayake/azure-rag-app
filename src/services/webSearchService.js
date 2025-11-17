import axios from 'axios';
import { searchClient } from '../config/azureClients.js';
import { embeddingService } from './embeddingService.js';
import { v4 as uuidv4 } from 'uuid';

export class WebSearchService {
  
  /**
   * Search the web using Bing Search API
   */
  async searchWeb(query) {
    try {
      console.log(`🌐 Searching web for: "${query}"`);
      
      if (!process.env.BING_SEARCH_API_KEY) {
        console.warn('⚠️ Bing Search API key not configured');
        return [];
      }

      const response = await axios.get(
        `${process.env.BING_SEARCH_ENDPOINT}`,
        {
          params: {
            q: query,
            count: 5,
            mkt: 'en-US'
          },
          headers: {
            'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY
          }
        }
      );

      const results = response.data.webPages?.value || [];
      
      return results.map(result => ({
        title: result.name,
        url: result.url,
        snippet: result.snippet,
        datePublished: result.dateLastCrawled
      }));
    } catch (error) {
      console.error('Error searching web:', error.message);
      return [];
    }
  }

  /**
   * Index web search results back to knowledge base
   */
  async indexWebResults(query, webResults) {
    try {
      console.log(`📥 Indexing ${webResults.length} web results to knowledge base...`);
      
      const documents = [];
      
      for (const result of webResults) {
        const content = `${result.title}\n\n${result.snippet}`;
        const embedding = await embeddingService.generateEmbedding(content);
        
        documents.push({
          id: `web-${uuidv4()}`,
          content: content,
          contentVector: embedding,
          fileName: `Web Search: ${query}`,
          fileType: 'web_search',
          language: 'english',
          uploadDate: new Date(),
          metadata: JSON.stringify({
            source: 'internet',
            url: result.url,
            query: query,
            datePublished: result.datePublished
          })
        });
      }

      if (documents.length > 0) {
        await searchClient.uploadDocuments(documents);
        console.log(`✅ Indexed ${documents.length} web results`);
      }

      return documents.length;
    } catch (error) {
      console.error('Error indexing web results:', error);
      // Don't throw - indexing failure shouldn't break the response
      return 0;
    }
  }

  /**
   * Fetch full content from a URL (for more detailed indexing)
   */
  async fetchWebContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Basic HTML text extraction (in production, use a proper HTML parser)
      const text = response.data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return text;
    } catch (error) {
      console.error(`Error fetching web content from ${url}:`, error.message);
      return null;
    }
  }
}

export const webSearchService = new WebSearchService();