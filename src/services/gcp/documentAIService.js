import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { GoogleAuth } from 'google-auth-library';

/**
 * Document AI Service
 * Replaces Azure Document Intelligence for OCR and document processing
 */
class DocumentAIService {
  constructor() {
    this.client = null;
    this.auth = null;
    this.projectId = process.env.GCP_PROJECT_ID || 'copper-depot-480116-h4';
    this.location = process.env.GCP_DOC_AI_LOCATION || 'us';
    this.processorId = process.env.GCP_DOC_AI_PROCESSOR_ID || null;
    this.initialized = false;
  }

  /**
   * Initialize Document AI client
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Document AI...');

      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });

      this.client = new DocumentProcessorServiceClient();

      // If no processor ID, create one
      if (!this.processorId) {
        console.log('⚠️  No processor ID found, will create on first use');
      }

      this.initialized = true;
      console.log('✅ Document AI initialized');
      console.log(`   Project: ${this.projectId}`);
      console.log(`   Location: ${this.location}`);
    } catch (error) {
      console.error('❌ Error initializing Document AI:', error);
      throw error;
    }
  }

  /**
   * Create OCR processor if not exists
   */
  async ensureProcessor() {
    if (this.processorId) {
      return this.processorId;
    }

    try {
      const parent = `projects/${this.projectId}/locations/${this.location}`;
      
      const [processor] = await this.client.createProcessor({
        parent,
        processor: {
          displayName: 'RAG Document Processor',
          type: 'OCR_PROCESSOR',
        },
      });

      this.processorId = processor.name.split('/').pop();
      console.log(`✅ Created processor: ${this.processorId}`);
      
      return this.processorId;
    } catch (error) {
      console.error('❌ Error creating processor:', error);
      throw error;
    }
  }

  /**
   * Process document and extract text
   */
  async processDocument(fileBuffer, mimeType, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await this.ensureProcessor();

      const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;

      const request = {
        name,
        rawDocument: {
          content: fileBuffer.toString('base64'),
          mimeType,
        },
      };

      console.log(`📄 Processing document with Document AI...`);
      
      const [result] = await this.client.processDocument(request);
      const { document } = result;

      // Extract text
      const text = document.text || '';

      // Extract pages info
      const pages = document.pages?.map(page => ({
        pageNumber: page.pageNumber,
        width: page.dimension?.width,
        height: page.dimension?.height,
        blocks: page.blocks?.length || 0,
        paragraphs: page.paragraphs?.length || 0,
        lines: page.lines?.length || 0,
        tokens: page.tokens?.length || 0,
      })) || [];

      console.log(`✅ Document processed: ${text.length} chars, ${pages.length} pages`);

      return {
        text,
        pages,
        language: document.pages?.[0]?.detectedLanguages?.[0]?.languageCode || 'en',
        confidence: this.calculateAverageConfidence(document),
        raw: document,
      };
    } catch (error) {
      console.error('❌ Error processing document:', error);
      throw error;
    }
  }

  /**
   * Process PDF document
   */
  async processPDF(pdfBuffer, options = {}) {
    return this.processDocument(pdfBuffer, 'application/pdf', options);
  }

  /**
   * Process image document
   */
  async processImage(imageBuffer, mimeType, options = {}) {
    return this.processDocument(imageBuffer, mimeType, options);
  }

  /**
   * Calculate average confidence from document
   */
  calculateAverageConfidence(document) {
    const pages = document.pages || [];
    if (pages.length === 0) return 0;

    let totalConfidence = 0;
    let count = 0;

    for (const page of pages) {
      for (const block of page.blocks || []) {
        if (block.layout?.confidence) {
          totalConfidence += block.layout.confidence;
          count++;
        }
      }
    }

    return count > 0 ? totalConfidence / count : 0;
  }

  /**
   * Extract tables from document
   */
  async extractTables(fileBuffer, mimeType) {
    try {
      const result = await this.processDocument(fileBuffer, mimeType);
      const tables = [];

      for (const page of result.raw.pages || []) {
        for (const table of page.tables || []) {
          const tableData = {
            pageNumber: page.pageNumber,
            rows: [],
          };

          // Extract table structure
          for (const row of table.bodyRows || []) {
            const rowData = [];
            for (const cell of row.cells || []) {
              rowData.push(this.getTextFromLayout(cell.layout, result.raw.text));
            }
            tableData.rows.push(rowData);
          }

          tables.push(tableData);
        }
      }

      return tables;
    } catch (error) {
      console.error('❌ Error extracting tables:', error);
      throw error;
    }
  }

  /**
   * Get text from layout object
   */
  getTextFromLayout(layout, fullText) {
    if (!layout || !layout.textAnchor) return '';
    
    const segments = layout.textAnchor.textSegments || [];
    let text = '';
    
    for (const segment of segments) {
      const start = parseInt(segment.startIndex) || 0;
      const end = parseInt(segment.endIndex) || fullText.length;
      text += fullText.substring(start, end);
    }
    
    return text;
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      await this.initialize();
      console.log('✅ Document AI connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Document AI connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const documentAIService = new DocumentAIService();