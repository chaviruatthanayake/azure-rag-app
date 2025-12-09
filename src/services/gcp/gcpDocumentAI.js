import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { PDFDocument } from 'pdf-lib';

/**
 * GCP Document AI Service - NO LIMITS VERSION
 * Automatically splits PDFs > 15 pages into chunks
 */
class GCPDocumentAIService {
  constructor() {
    this.client = null;
    this.projectId = null;
    this.location = 'us';
    this.processorId = null;
  }

  async initialize() {
    if (this.client) return;

    try {
      this.projectId = process.env.GCP_PROJECT_ID;
      this.processorId = process.env.GCP_DOCUMENT_AI_PROCESSOR_ID;

      if (!this.projectId) {
        throw new Error('GCP_PROJECT_ID not found in environment');
      }

      if (!this.processorId) {
        throw new Error('GCP_DOCUMENT_AI_PROCESSOR_ID not found. Create a processor in Document AI console.');
      }

      this.client = new DocumentProcessorServiceClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });

      console.log('✅ GCP Document AI initialized');
      console.log(`   Project: ${this.projectId}`);
      console.log(`   Processor: ${this.processorId}`);
    } catch (error) {
      console.error('❌ Error initializing GCP Document AI:', error.message);
      throw error;
    }
  }

  /**
   * Split PDF into chunks of max 15 pages each
   */
  async splitPDF(pdfBuffer, maxPages = 15) {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    
    if (totalPages <= maxPages) {
      return [pdfBuffer]; // No need to split
    }

    console.log(`📄 PDF has ${totalPages} pages, splitting into chunks of ${maxPages} pages...`);

    const chunks = [];
    for (let i = 0; i < totalPages; i += maxPages) {
      const newPdf = await PDFDocument.create();
      const endPage = Math.min(i + maxPages, totalPages);
      
      const pages = await newPdf.copyPages(pdfDoc, Array.from({ length: endPage - i }, (_, idx) => i + idx));
      pages.forEach(page => newPdf.addPage(page));
      
      const pdfBytes = await newPdf.save();
      chunks.push(Buffer.from(pdfBytes));
      
      console.log(`   Created chunk ${chunks.length}: pages ${i + 1}-${endPage}`);
    }

    return chunks;
  }

  /**
   * Process a single PDF chunk with Document AI
   */
  async processPDFChunk(pdfBuffer) {
    const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;

    const request = {
      name,
      rawDocument: {
        content: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const [result] = await this.client.processDocument(request);
    const { document } = result;

    return {
      text: document.text || '',
      pageCount: document.pages?.length || 0
    };
  }

  /**
   * Extract text from PDF using Document AI
   * Automatically handles PDFs of any size by splitting
   */
  async extractTextFromPDF(fileBuffer) {
    await this.initialize();

    try {
      console.log('📄 Processing PDF with Document AI...');

      // Split PDF into chunks if needed
      const chunks = await this.splitPDF(fileBuffer, 15);

      let allText = '';
      let totalPages = 0;

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        console.log(`   Processing chunk ${i + 1}/${chunks.length}...`);
        
        const result = await this.processPDFChunk(chunks[i]);
        allText += result.text + '\n\n';
        totalPages += result.pageCount;
      }

      console.log(`✅ Extracted ${allText.length} characters from ${totalPages} pages`);

      return {
        text: allText,
        pageCount: totalPages,
        tables: []
      };
    } catch (error) {
      console.error('❌ Error processing PDF with Document AI:', error.message);
      throw error;
    }
  }

  /**
   * Extract text from image using Document AI
   */
  async extractTextFromImage(fileBuffer, mimeType = 'image/jpeg') {
    await this.initialize();

    try {
      const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;

      console.log('🖼️  Processing image with Document AI...');

      const request = {
        name,
        rawDocument: {
          content: fileBuffer.toString('base64'),
          mimeType,
        },
      };

      const [result] = await this.client.processDocument(request);
      const { document } = result;

      const text = document.text || '';

      console.log(`✅ Extracted ${text.length} characters from image`);

      return {
        text,
        pageCount: 1
      };
    } catch (error) {
      console.error('❌ Error processing image with Document AI:', error.message);
      throw error;
    }
  }

  /**
   * Extract text from any document (PDF or image)
   */
  async extractText(fileBuffer, mimeType) {
    if (mimeType === 'application/pdf') {
      return await this.extractTextFromPDF(fileBuffer);
    } else if (mimeType.startsWith('image/')) {
      return await this.extractTextFromImage(fileBuffer, mimeType);
    } else {
      throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  }
}

export const gcpDocumentAIService = new GCPDocumentAIService();