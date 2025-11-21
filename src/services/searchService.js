import { searchClient } from '../config/azureClients.js';
import { embeddingService } from './embeddingService.js';

class SearchService {
  
  /**
   * Search documents using vector similarity
   * @param {Array|string} queryInput - Either an embedding vector (array) or text (string)
   * @param {number} topK - Number of results to return
   */
  async searchDocuments(queryInput, topK = 5) {
    try {
      let queryEmbedding;

      // Check if input is already an embedding (array of numbers)
      if (Array.isArray(queryInput) && queryInput.length > 0 && typeof queryInput[0] === 'number') {
        console.log(`🔍 Using provided embedding vector (dimension: ${queryInput.length})`);
        queryEmbedding = queryInput;
      } 
      // If it's a string, generate embedding
      else if (typeof queryInput === 'string') {
        console.log(`🔍 Generating embedding for query: "${queryInput.substring(0, 50)}..."`);
        queryEmbedding = await embeddingService.generateEmbedding(queryInput);
      } 
      // Invalid input
      else {
        throw new Error(`Invalid query input. Expected string or number array, got: ${typeof queryInput}`);
      }

      // Perform vector search
      console.log(`🔍 Searching with vector (dimension: ${queryEmbedding.length})...`);
      
      const searchResults = await searchClient.search('*', {
        vectorSearchOptions: {
          queries: [{
            kind: 'vector',
            vector: queryEmbedding,
            kNearestNeighborsCount: topK,
            fields: ['contentVector']
          }]
        },
        select: ['id', 'content', 'fileName', 'fileType', 'language', 'metadata'],
        top: topK
      });

      const results = [];
      for await (const result of searchResults.results) {
        results.push({
          id: result.document.id,
          content: result.document.content,
          fileName: result.document.fileName,
          fileType: result.document.fileType,
          language: result.document.language,
          score: result.score || 0,
          metadata: result.document.metadata
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
   * Index a document with its content and embeddings
   */
  async indexDocument(document) {
    try {
      console.log(`📊 Indexing ${document.chunks.length} chunks...`);

      const documentsToIndex = document.chunks.map((chunk, index) => ({
        id: `${document.id}-chunk-${index}`,
        content: chunk.text,
        contentVector: chunk.embedding,
        fileName: document.fileName,
        fileType: document.fileType,
        language: document.language,
        metadata: {
          blobName: document.blobName,
          chunkIndex: index,
          totalChunks: document.chunks.length,
          pageCount: document.pageCount
        }
      }));

      await searchClient.uploadDocuments(documentsToIndex);
      console.log(`✅ Indexed ${documentsToIndex.length} documents`);

      return {
        success: true,
        indexed: documentsToIndex.length
      };

    } catch (error) {
      console.error('Error indexing document:', error);
      throw error;
    }
  }

  /**
   * Delete documents by file name
   */
  async deleteDocumentsByFileName(fileName) {
    try {
      // Search for all documents with this filename
      const searchResults = await searchClient.search('*', {
        filter: `fileName eq '${fileName}'`,
        select: ['id']
      });

      const idsToDelete = [];
      for await (const result of searchResults.results) {
        idsToDelete.push({ id: result.document.id });
      }

      if (idsToDelete.length > 0) {
        await searchClient.deleteDocuments(idsToDelete);
        console.log(`✅ Deleted ${idsToDelete.length} chunks for ${fileName}`);
      }

      return {
        success: true,
        deleted: idsToDelete.length
      };

    } catch (error) {
      console.error('Error deleting documents:', error);
      throw error;
    }
  }

  /**
   * Get all unique file names from index
   */
  async getAllDocuments() {
    try {
      const searchResults = await searchClient.search('*', {
        select: ['fileName', 'fileType', 'language', 'metadata'],
        top: 1000
      });

      const documents = [];
      const seen = new Set();

      for await (const result of searchResults.results) {
        const fileName = result.document.fileName;
        if (!seen.has(fileName)) {
          seen.add(fileName);
          
          // Try to get upload date from metadata
          let uploadDate = null;
          if (result.document.metadata && result.document.metadata.uploadDate) {
            uploadDate = result.document.metadata.uploadDate;
          }

          documents.push({
            fileName: result.document.fileName,
            fileType: result.document.fileType,
            language: result.document.language,
            uploadDate: uploadDate
          });
        }
      }

      return documents;

    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }
}

export const searchService = new SearchService();