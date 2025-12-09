import pkg from 'pg';
const { Pool } = pkg;
import { embeddingService } from './embeddingService.js';

/**
 * Cloud SQL Search Service - 100% GCP
 * PostgreSQL with pgvector extension for vector similarity search
 */
export class CloudSQLSearchService {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    if (this.pool) return;

    try {
      const config = {
        host: process.env.CLOUD_SQL_HOST || '/cloudsql/' + process.env.CLOUD_SQL_CONNECTION_NAME,
        database: process.env.CLOUD_SQL_DATABASE || 'ragdb',
        user: process.env.CLOUD_SQL_USER || 'postgres',
        password: process.env.CLOUD_SQL_PASSWORD,
        max: 5
      };

      // If not using Cloud SQL socket, use TCP
      if (process.env.CLOUD_SQL_HOST && !process.env.CLOUD_SQL_HOST.startsWith('/cloudsql/')) {
        config.port = process.env.CLOUD_SQL_PORT || 5432;
      }

      this.pool = new Pool(config);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('✅ Cloud SQL (PostgreSQL) initialized');
      console.log(`   Database: ${config.database}`);
    } catch (error) {
      console.error('❌ Error initializing Cloud SQL:', error.message);
      throw error;
    }
  }

  /**
   * Index a document with embeddings
   */
  async indexDocument(documentId, text, embeddings, metadata = {}) {
    await this.initialize();

    try {
      console.log(`📝 Indexing "${documentId}" in Cloud SQL`);

      // Validate text
      if (Array.isArray(text)) {
        console.error('❌ ERROR: text is an array, not a string!');
        text = 'Error: embedding was passed instead of text';
      }
      if (typeof text !== 'string') {
        text = String(text);
      }

      // Generate embedding for the text
      const textEmbedding = await embeddingService.generateEmbedding(text);

      // Prepare embedding as PostgreSQL array format
      const embeddingStr = '[' + textEmbedding.join(',') + ']';

      const query = `
        INSERT INTO documents (id, content, embedding, file_name, file_type, language, upload_date, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          file_name = EXCLUDED.file_name,
          file_type = EXCLUDED.file_type,
          language = EXCLUDED.language,
          upload_date = EXCLUDED.upload_date,
          metadata = EXCLUDED.metadata
      `;

      const values = [
        documentId,
        text,
        embeddingStr,
        metadata.fileName || null,
        metadata.fileType || null,
        metadata.language || null,
        metadata.uploadDate || new Date(),
        JSON.stringify(metadata)
      ];

      await this.pool.query(query, values);

      // Index chunks if provided
      if (embeddings && embeddings.length > 0) {
        for (let i = 0; i < embeddings.length; i++) {
          const chunkId = `${documentId}_chunk_${i}`;
          const chunkEmbeddingStr = '[' + embeddings[i].join(',') + ']';
          
          await this.pool.query(query, [
            chunkId,
            text,
            chunkEmbeddingStr,
            metadata.fileName || null,
            metadata.fileType || null,
            metadata.language || null,
            metadata.uploadDate || new Date(),
            JSON.stringify({ ...metadata, chunkIndex: i })
          ]);
        }
      }

      console.log(`✅ Document indexed successfully: ${documentId}`);
      return true;
    } catch (error) {
      console.error('Error indexing document:', error);
      throw error;
    }
  }

  /**
   * Search for documents using text query
   */
  async search(query, options = {}) {
    await this.initialize();

    try {
      const { top = 5 } = options;

      // Validate query
      if (Array.isArray(query)) {
        throw new Error('Query must be text, not an embedding array');
      }
      if (typeof query !== 'string') {
        query = String(query);
      }

      console.log('🔍 Searching with text query:', query.substring(0, 100));

      // Generate embedding for query
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      return await this.vectorSearch(queryEmbedding, options);
    } catch (error) {
      console.error('Error searching:', error);
      throw error;
    }
  }

  /**
   * Vector search using pre-computed embedding
   */
  async vectorSearch(embedding, options = {}) {
    await this.initialize();

    try {
      const { top = 5 } = options;

      if (!Array.isArray(embedding)) {
        throw new Error('Embedding must be an array of numbers');
      }

      console.log(`🔍 Vector search with embedding of length ${embedding.length}`);

      const embeddingStr = '[' + embedding.join(',') + ']';

      // Use cosine distance for similarity search
      const query = `
        SELECT 
          id,
          content,
          file_name as "fileName",
          file_type as "fileType",
          language,
          upload_date as "uploadDate",
          metadata,
          1 - (embedding <=> $1::vector) as score
        FROM documents
        WHERE content IS NOT NULL AND content != ''
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `;

      const result = await this.pool.query(query, [embeddingStr, top]);

      console.log(`📊 Raw results from DB: ${result.rows.length} rows`);
      
      // Log first result for debugging
      if (result.rows.length > 0) {
        console.log(`   First result - ID: ${result.rows[0].id}, Content length: ${result.rows[0].content?.length || 0}`);
      }

      const results = result.rows.map(row => {
        let parsedMetadata = {};
        
        // Safely parse metadata
        if (row.metadata) {
          try {
            if (typeof row.metadata === 'string') {
              parsedMetadata = JSON.parse(row.metadata);
            } else if (typeof row.metadata === 'object') {
              parsedMetadata = row.metadata;
            }
          } catch (e) {
            console.warn('Could not parse metadata for document:', row.id);
            parsedMetadata = {};
          }
        }

        // Get fileName from file_name column OR from metadata
        const fileName = row.fileName || parsedMetadata.fileName || 'Unknown Document';

        return {
          score: row.score,
          document: {
            id: row.id,
            content: row.content || '',
            fileName: fileName,
            fileType: row.fileType || parsedMetadata.fileType,
            language: row.language,
            uploadDate: row.uploadDate,
            ...parsedMetadata
          }
        };
      });

      console.log(`✅ Found ${results.length} results with content`);
      
      // Log first result fileName for debugging
      if (results.length > 0) {
        console.log(`   First result fileName: "${results[0].document.fileName}"`);
      }
      
      return results;
    } catch (error) {
      console.error('Error in vector search:', error);
      throw error;
    }
  }

  /**
   * Search documents - main entry point
   */
  async searchDocuments(query, options = {}) {
    console.log('🔍 searchDocuments called with:', {
      queryType: typeof query,
      queryIsArray: Array.isArray(query),
      queryPreview: Array.isArray(query) ? 
        `[${query.slice(0, 3).join(', ')}...]` : 
        (typeof query === 'string' ? query.substring(0, 100) : query)
    });

    if (Array.isArray(query)) {
      console.log('🔢 Using vectorSearch (query is already an embedding)');
      return await this.vectorSearch(query, options);
    }
    
    if (typeof query === 'string') {
      console.log('📝 Using text search (will generate embedding)');
      return await this.search(query, options);
    }

    throw new Error(`Invalid query type: ${typeof query}. Must be string or array.`);
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(documentId) {
    await this.initialize();

    try {
      const query = 'DELETE FROM documents WHERE id = $1 OR id LIKE $2';
      await this.pool.query(query, [documentId, `${documentId}_chunk_%`]);
      console.log(`✅ Document deleted: ${documentId}`);
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get all documents (excluding chunks)
   */
  async getAllDocuments() {
    await this.initialize();

    try {
      const query = `
        SELECT DISTINCT 
          id,
          content,
          file_name as "fileName",
          file_type as "fileType",
          language,
          upload_date as "uploadDate",
          metadata
        FROM documents
        WHERE id NOT LIKE '%_chunk_%'
        ORDER BY upload_date DESC
      `;

      const result = await this.pool.query(query);

      // Create a Map to ensure we only get one entry per fileName
      const uniqueDocs = new Map();

      result.rows.forEach(row => {
        let parsedMetadata = {};
        
        // Safely parse metadata
        if (row.metadata) {
          try {
            if (typeof row.metadata === 'string') {
              parsedMetadata = JSON.parse(row.metadata);
            } else if (typeof row.metadata === 'object') {
              parsedMetadata = row.metadata;
            }
          } catch (e) {
            console.warn('Could not parse metadata for document:', row.id);
            parsedMetadata = {};
          }
        }

        // Get fileName from file_name column OR from metadata
        const fileName = row.fileName || parsedMetadata.fileName || 'Unknown Document';

        // Only keep the first occurrence of each fileName
        if (!uniqueDocs.has(fileName)) {
          uniqueDocs.set(fileName, {
            id: row.id,
            fileName: fileName,
            fileType: row.fileType || parsedMetadata.fileType,
            language: row.language || parsedMetadata.language,
            uploadDate: row.uploadDate || parsedMetadata.uploadDate,
            ...parsedMetadata
          });
        }
      });

      return Array.from(uniqueDocs.values());
    } catch (error) {
      console.error('Error getting all documents:', error);
      return [];
    }
  }

  /**
   * Get document count
   */
  async getDocumentCount() {
    await this.initialize();
    const result = await this.pool.query('SELECT COUNT(DISTINCT id) as count FROM documents WHERE id NOT LIKE \'%_chunk_%\'');
    return result.rows[0].count;
  }

  /**
   * Close connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export const searchService = new CloudSQLSearchService();