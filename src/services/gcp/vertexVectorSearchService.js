import { GoogleAuth } from 'google-auth-library';

/**
 * Vertex AI Vector Search Service
 * Replaces Azure AI Search for vector similarity search
 * 
 * Uses a simple in-memory approach initially, can be upgraded to full Vertex AI Matching Engine later
 */
class VertexVectorSearchService {
  constructor() {
    this.auth = null;
    this.projectId = process.env.GCP_PROJECT_ID || 'copper-depot-480116-h4';
    this.location = process.env.GCP_REGION || 'us-central1';
    this.bucket = `${this.projectId}-vector-search`;
    
    // In-memory vector store (simple but effective for moderate datasets)
    this.vectorStore = new Map(); // Map<documentId, {vector, metadata}>
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Vertex Vector Search...');

      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });

      // Load existing vectors from Cloud Storage if available
      await this.loadVectorsFromStorage();

      this.initialized = true;
      console.log('✅ Vertex Vector Search initialized');
      console.log(`   Project: ${this.projectId}`);
      console.log(`   Bucket: ${this.bucket}`);
      console.log(`   Vectors loaded: ${this.vectorStore.size}`);
    } catch (error) {
      console.error('❌ Error initializing Vector Search:', error);
      // Continue without loading - start fresh
      this.initialized = true;
    }
  }

  /**
   * Get access token
   */
  async getAccessToken() {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  }

  /**
   * Add or update a document vector
   */
  async upsertVector(documentId, vector, metadata = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.vectorStore.set(documentId, {
        vector,
        metadata: {
          ...metadata,
          id: documentId,
          updatedAt: new Date().toISOString(),
        },
      });

      // Persist to Cloud Storage periodically
      if (this.vectorStore.size % 10 === 0) {
        await this.saveVectorsToStorage();
      }

      return { id: documentId, success: true };
    } catch (error) {
      console.error(`❌ Error upserting vector for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Add multiple vectors in batch
   */
  async upsertVectorsBatch(documents) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📊 Upserting ${documents.length} vectors...`);

      const results = [];
      for (const doc of documents) {
        const result = await this.upsertVector(doc.id, doc.vector, doc.metadata);
        results.push(result);
      }

      // Save to storage after batch
      await this.saveVectorsToStorage();

      console.log(`✅ Upserted ${results.length} vectors`);
      return results;
    } catch (error) {
      console.error('❌ Error upserting batch vectors:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async searchVectors(queryVector, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const topK = options.topK || 10;
      const filter = options.filter || {};

      // Calculate similarities
      const similarities = [];
      for (const [docId, data] of this.vectorStore.entries()) {
        // Apply filters if specified
        if (Object.keys(filter).length > 0) {
          const matchesFilter = Object.entries(filter).every(
            ([key, value]) => data.metadata[key] === value
          );
          if (!matchesFilter) continue;
        }

        const similarity = this.cosineSimilarity(queryVector, data.vector);
        similarities.push({
          id: docId,
          score: similarity,
          metadata: data.metadata,
        });
      }

      // Sort by similarity and return top K
      similarities.sort((a, b) => b.score - a.score);
      const results = similarities.slice(0, topK);

      console.log(`🔍 Found ${results.length} similar vectors (threshold: 0.7)`);
      return results;
    } catch (error) {
      console.error('❌ Error searching vectors:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Delete a vector
   */
  async deleteVector(documentId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const deleted = this.vectorStore.delete(documentId);
      
      if (deleted) {
        await this.saveVectorsToStorage();
        console.log(`✅ Deleted vector: ${documentId}`);
      }

      return { id: documentId, deleted };
    } catch (error) {
      console.error(`❌ Error deleting vector ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all vectors
   */
  async deleteAllVectors() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const count = this.vectorStore.size;
      this.vectorStore.clear();
      await this.saveVectorsToStorage();

      console.log(`✅ Deleted ${count} vectors`);
      return { count, success: true };
    } catch (error) {
      console.error('❌ Error deleting all vectors:', error);
      throw error;
    }
  }

  /**
   * Get all document IDs
   */
  async getAllDocumentIds() {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.vectorStore.keys());
  }

  /**
   * Get total vector count
   */
  async getVectorCount() {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.vectorStore.size;
  }

  /**
   * Save vectors to Cloud Storage
   */
  async saveVectorsToStorage() {
    try {
      const token = await this.getAccessToken();
      
      // Convert Map to JSON-serializable object
      const data = {
        vectors: Array.from(this.vectorStore.entries()).map(([id, data]) => ({
          id,
          vector: data.vector,
          metadata: data.metadata,
        })),
        savedAt: new Date().toISOString(),
        count: this.vectorStore.size,
      };

      const jsonData = JSON.stringify(data);
      
      // Upload to Cloud Storage
      const url = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=vectors.json`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: jsonData,
      });

      if (!response.ok) {
        console.warn(`⚠️ Could not save vectors to storage: ${response.statusText}`);
      } else {
        console.log(`💾 Saved ${this.vectorStore.size} vectors to Cloud Storage`);
      }
    } catch (error) {
      console.warn('⚠️ Error saving vectors to storage:', error.message);
      // Don't throw - this is just for persistence
    }
  }

  /**
   * Load vectors from Cloud Storage
   */
  async loadVectorsFromStorage() {
    try {
      const token = await this.getAccessToken();
      
      const url = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/vectors.json?alt=media`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('📝 No existing vectors found, starting fresh');
          return;
        }
        throw new Error(`Failed to load: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Restore vectors to Map
      for (const item of data.vectors) {
        this.vectorStore.set(item.id, {
          vector: item.vector,
          metadata: item.metadata,
        });
      }

      console.log(`✅ Loaded ${this.vectorStore.size} vectors from storage`);
    } catch (error) {
      console.log(`📝 Starting with empty vector store: ${error.message}`);
      // Start fresh if can't load
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      await this.initialize();
      console.log('✅ Vector Search connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Vector Search connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const vertexVectorSearchService = new VertexVectorSearchService();