import { vertexVectorSearchService } from './gcp/vertexVectorSearchService.js';
import { embeddingService } from './embeddingService.js';

/**
 * Search Service - 100% GCP (NO Azure)
 * Uses Vertex Vector Search only
 */
class SearchService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Search Service...');

      await embeddingService.initialize();
      await vertexVectorSearchService.initialize();
      
      console.log('✅ Using GCP Vector Search');

      this.initialized = true;
    } catch (error) {
      console.error('❌ Error initializing search service:', error);
      throw error;
    }
  }

  /**
   * Index a document
   */
  async indexDocument(documentId, text, metadata) {
    console.log('🔍 indexDocument called with:', {
      documentId: typeof documentId === 'object' ? '[OBJECT]' : documentId,
      textType: typeof text,
      textLength: typeof text === 'string' ? text.length : 'N/A',
      textPreview: typeof text === 'string' ? text.substring(0, 100) : JSON.stringify(text).substring(0, 100),
      metadata: metadata ? Object.keys(metadata) : 'none'
    });

    if (!this.initialized) {
      await this.initialize();
    }

    // Handle if called with object (fix for incorrect calls)
    if (typeof documentId === 'object') {
      console.warn('⚠️  indexDocument called with object, extracting fields');
      const doc = documentId;
      documentId = doc.id || doc.fileId || doc.documentId;
      text = doc.text || doc.content || text;
      metadata = doc.metadata || metadata || {};
    }

    // Ensure text is a string and not empty
    const textContent = typeof text === 'string' ? text : (text?.content || text?.text || '');
    
    if (!textContent || textContent.trim().length === 0) {
      console.error(`❌ Empty text for document ${documentId}`);
      return { id: documentId, success: false, error: 'Empty content' };
    }

    console.log(`📝 Indexing "${documentId}" with ${textContent.length} characters`);

    // Use GCP
    const embedding = await embeddingService.generateEmbedding(textContent);
    return await vertexVectorSearchService.upsertVector(documentId, embedding, {
      ...metadata,
      text: textContent,
      content: textContent,
      fileName: metadata.fileName || documentId,
    });
  }

  /**
   * Index documents in batch
   */
  async indexDocumentsBatch(documents) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use GCP
    const texts = documents.map(doc => doc.text);
    const embeddings = await embeddingService.generateEmbeddingsBatch(texts);
    
    const vectorDocs = documents.map((doc, i) => ({
      id: doc.id,
      vector: embeddings[i],
      metadata: {
        ...doc.metadata,
        text: doc.text,
        content: doc.text,
      },
    }));

    return await vertexVectorSearchService.upsertVectorsBatch(vectorDocs);
  }

  /**
   * Search for documents
   */
  async search(query, topK = 10) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use GCP
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    return await vertexVectorSearchService.searchVectors(queryEmbedding, { topK });
  }

  /**
   * Get all documents
   */
  async getAllDocuments() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use GCP
    const documentIds = await vertexVectorSearchService.getAllDocumentIds();
    return documentIds.map(id => ({ id, fileName: id }));
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use GCP
    return await vertexVectorSearchService.deleteVector(documentId);
  }

  /**
   * Delete all documents
   */
  async deleteAllDocuments() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use GCP
    return await vertexVectorSearchService.deleteAllVectors();
  }

  /**
   * Get all document IDs
   */
  async getAllDocumentIds() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use GCP
    return await vertexVectorSearchService.getAllDocumentIds();
  }

  /**
   * Get document count
   */
  async getDocumentCount() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use GCP
    return await vertexVectorSearchService.getVectorCount();
  }

  /**
   * Search documents (alias for search method)
   */
  async searchDocuments(query, options = {}) {
    return await this.search(query, options.top || options.topK || 10);
  }
}

export const searchService = new SearchService();