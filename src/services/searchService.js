import { searchClient } from '../config/azureClients.js';
import { embeddingService } from './embeddingService.js';

export class SearchService {
  
  /**
   * Index document chunks in Azure AI Search
   */
  async indexDocuments(processedDoc, embeddings) {
    try {
      console.log(`📊 Indexing ${processedDoc.chunks.length} chunks...`);
      
      const documents = processedDoc.chunks.map((chunk, index) => ({
        id: `${processedDoc.id}-chunk-${index}`,
        content: chunk,
        contentVector: embeddings[index],
        fileName: processedDoc.fileName,
        fileType: processedDoc.fileType,
        language: processedDoc.language,
        uploadDate: new Date(processedDoc.uploadDate),
        metadata: JSON.stringify({
          blobName: processedDoc.blobName,
          chunkIndex: index,
          totalChunks: processedDoc.chunks.length,
          pageCount: processedDoc.pageCount
        })
      }));

      const result = await searchClient.uploadDocuments(documents);
      console.log(`✅ Indexed ${result.results.length} documents`);
      
      return result;
    } catch (error) {
      console.error('Error indexing documents:', error);
      throw error;
    }
  }

  /**
   * Search for relevant documents using hybrid search (vector + keyword)
   */
  async searchDocuments(query, topK = 5) {
    try {
      console.log(`🔍 Searching for: "${query}"`);

      // Generate embedding for query
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Pure vector (hybrid) search – no semantic ranker
      const searchResults = await searchClient.search(query, {
        vectorSearchOptions: {
          queries: [
            {
              kind: 'vector',
              vector: queryEmbedding,
              fields: ['contentVector'],
              kNearestNeighborsCount: topK
            }
          ]
        },
        select: ['id', 'content', 'fileName', 'fileType', 'language', 'metadata'],
        top: topK
        // ❌ Removed:
        // queryType: 'semantic',
        // semanticSearchOptions: { configurationName: 'semantic-config' }
      });

      const results = [];
      for await (const result of searchResults.results) {
        results.push({
          id: result.document.id,
          content: result.document.content,
          fileName: result.document.fileName,
          fileType: result.document.fileType,
          language: result.document.language,
          score: result.score,
          metadata: JSON.parse(result.document.metadata || '{}')
        });
      }

      console.log(`✅ Found ${results.length} relevant documents`);
      return results;
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  /**
   * Delete all chunks associated with a document
   */
  async deleteDocumentChunks(documentId) {
    try {
      // Search for all chunks with this document ID prefix
      const searchResults = await searchClient.search('*', {
        filter: `search.ismatch('${documentId}*', 'id')`,
        select: ['id']
      });

      const idsToDelete = [];
      for await (const result of searchResults.results) {
        idsToDelete.push(result.document.id);
      }

      if (idsToDelete.length > 0) {
        const documents = idsToDelete.map(id => ({ id }));
        await searchClient.deleteDocuments(documents);
        console.log(`✅ Deleted ${idsToDelete.length} chunks from search index`);
      }

      return idsToDelete.length;
    } catch (error) {
      console.error('Error deleting document chunks:', error);
      throw error;
    }
  }

  /**
   * List all indexed documents
   */
  async listDocuments() {
    try {
      const results = await searchClient.search('*', {
        select: ['fileName', 'fileType', 'uploadDate', 'language'],
        top: 100
      });

      const documents = new Map();
      
      for await (const result of results.results) {
        const fileName = result.document.fileName;
        if (!documents.has(fileName)) {
          documents.set(fileName, {
            fileName,
            fileType: result.document.fileType,
            uploadDate: result.document.uploadDate,
            language: result.document.language
          });
        }
      }

      return Array.from(documents.values());
    } catch (error) {
      console.error('Error listing documents:', error);
      throw error;
    }
  }
}

export const searchService = new SearchService();