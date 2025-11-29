import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { embeddingService } from './embeddingService.js';

// Initialize Azure Search Client
const searchClient = new SearchClient(
  process.env.AZURE_SEARCH_ENDPOINT,
  process.env.AZURE_SEARCH_INDEX_NAME,
  new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY)
);

class SearchService {
  
  /**
   * Search documents using vector similarity
   */
  async searchDocuments(queryInput, topK = 10) {
    try {
      let queryEmbedding;

      // Check if input is already an embedding vector
      if (Array.isArray(queryInput) && queryInput.length > 0 && typeof queryInput[0] === 'number') {
        console.log(`🔍 Using provided embedding vector (dimension: ${queryInput.length})`);
        queryEmbedding = queryInput;
      } 
      // If string, generate embedding
      else if (typeof queryInput === 'string') {
        const preview = queryInput.length > 50 ? queryInput.substring(0, 50) + '...' : queryInput;
        console.log(`🔍 Generating embedding for: "${preview}"`);
        queryEmbedding = await embeddingService.generateEmbedding(queryInput);
      } 
      else {
        throw new Error(`Invalid query input type: ${typeof queryInput}`);
      }

      // Vector search with higher K for better recall
      console.log(`🔍 Searching with vector (${queryEmbedding.length}-dim) for top ${topK} results...`);
      
      const searchResults = await searchClient.search('*', {
        vectorSearchOptions: {
          queries: [{
            kind: 'vector',
            vector: queryEmbedding,
            kNearestNeighborsCount: topK * 2, // Get more candidates for better filtering
            fields: ['contentVector']
          }]
        },
        select: ['id', 'content', 'fileName', 'fileType', 'language', 'uploadDate', 'metadata'],
        top: topK
      });

      const results = [];
      const seenFiles = new Set(); // Track files to avoid duplicates
      
      for await (const result of searchResults.results) {
        // Skip if we've already seen this file
        if (seenFiles.has(result.document.fileName)) {
          continue;
        }
        
        seenFiles.add(result.document.fileName);
        
        // Parse metadata if it's a JSON string
        let metadata = result.document.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }

        results.push({
          id: result.document.id,
          content: result.document.content,
          fileName: result.document.fileName,
          fileType: result.document.fileType,
          language: result.document.language,
          uploadDate: result.document.uploadDate,
          score: result.score || 0,
          metadata: metadata
        });
        
        // Stop if we have enough unique results
        if (results.length >= topK) {
          break;
        }
      }

      console.log(`✅ Found ${results.length} unique documents (filtered from duplicates)`);
      return results;

    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  /**
   * Index document chunks
   */
  async indexDocument(document) {
    try {
      console.log(`📊 Indexing ${document.chunks.length} chunks for: ${document.fileName}`);

      const documentsToIndex = document.chunks.map((chunk, index) => {
        const metadataObj = {
          blobName: document.blobName,
          chunkIndex: index,
          totalChunks: document.chunks.length,
          pageCount: document.pageCount || null,
          uploadDate: document.uploadDate || new Date().toISOString(),
          hasAudio: document.hasAudio || false,
          hasVisualText: document.hasVisualText || false
        };

        return {
          id: `${document.id}-chunk-${index}`,
          content: chunk.text || '',
          contentVector: chunk.embedding,
          fileName: document.fileName,
          fileType: document.fileType,
          language: document.language || 'english',
          uploadDate: metadataObj.uploadDate,
          // Metadata as JSON string (Azure Search requirement)
          metadata: JSON.stringify(metadataObj)
        };
      });

      const result = await searchClient.uploadDocuments(documentsToIndex);
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
   * Alias for backward compatibility
   */
  async indexDocuments(document) {
    return this.indexDocument(document);
  }

  /**
   * Delete documents by filename
   */
  async deleteDocumentsByFileName(fileName) {
    try {
      const searchResults = await searchClient.search('*', {
        filter: `fileName eq '${fileName.replace(/'/g, "''")}'`,
        select: ['id']
      });

      const idsToDelete = [];
      for await (const result of searchResults.results) {
        idsToDelete.push({ id: result.document.id });
      }

      if (idsToDelete.length > 0) {
        await searchClient.deleteDocuments(idsToDelete);
        console.log(`✅ Deleted ${idsToDelete.length} chunks for: ${fileName}`);
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
   * Get all documents of a specific file type (with content)
   */
  async getDocumentsByFileType(fileType) {
    try {
      console.log(`🔍 Getting all ${fileType} files...`);
      
      // Get all documents and filter by file type in memory
      const allDocs = await this.getAllDocuments();
      const filteredDocs = allDocs.filter(doc => 
        doc.fileType && doc.fileType.includes(fileType)
      );
      
      console.log(`✅ Found ${filteredDocs.length} ${fileType} files`);
      return filteredDocs;

    } catch (error) {
      console.error('Error getting documents by file type:', error);
      throw error;
    }
  }

  /**
   * Get all unique documents (with ALL chunks combined)
   */
  async getAllDocuments() {
    try {
      const searchResults = await searchClient.search('*', {
        select: ['id', 'content', 'fileName', 'fileType', 'language', 'uploadDate'],
        top: 1000
      });

      const fileChunks = new Map(); // fileName -> array of chunks

      // Collect all chunks for each file
      for await (const result of searchResults.results) {
        const fileName = result.document.fileName;
        
        if (!fileChunks.has(fileName)) {
          fileChunks.set(fileName, {
            chunks: [],
            fileType: result.document.fileType,
            language: result.document.language,
            uploadDate: result.document.uploadDate,
            id: result.document.id
          });
        }
        
        // Add chunk content (with debug logging)
        const chunkContent = result.document.content || '';
        if (chunkContent) {
          console.log(`📝 ${fileName}: chunk has ${chunkContent.length} chars`);
          fileChunks.get(fileName).chunks.push(chunkContent);
        } else {
          console.log(`⚠️ ${fileName}: chunk is EMPTY`);
        }
      }

      // Combine chunks for each file
      const documents = [];
      for (const [fileName, data] of fileChunks.entries()) {
        const combinedContent = data.chunks.join('\n\n');
        console.log(`📊 ${fileName}: Total ${combinedContent.length} chars from ${data.chunks.length} chunks`);
        documents.push({
          id: data.id,
          fileName: fileName,
          fileType: data.fileType,
          language: data.language,
          uploadDate: data.uploadDate,
          content: combinedContent,
          score: 0
        });
      }

      console.log(`✅ Retrieved ${documents.length} unique documents with combined content`);
      return documents;

    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }
}

export const searchService = new SearchService();