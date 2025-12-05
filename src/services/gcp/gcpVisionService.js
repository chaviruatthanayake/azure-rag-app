import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GCP Vision Service
 * Replaces Azure Document Intelligence with Gemini Vision API
 * Handles PDF, images, and document OCR
 */
class GCPVisionService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found in environment');
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
      });

      this.initialized = true;
      console.log('✅ GCP Vision Service initialized');
    } catch (error) {
      console.error('❌ Error initializing GCP Vision:', error);
      throw error;
    }
  }

  /**
   * Sleep/delay function for rate limiting
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract text from image using Gemini Vision with rate limiting
   */
  async extractTextFromImage(imageBuffer, mimeType = 'image/jpeg') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Add 8 second delay between API calls (7.5 requests/minute = safe)
      console.log('   ⏳ Waiting 8s to avoid rate limits...');
      await this.sleep(8000);

      const base64Image = imageBuffer.toString('base64');

      const prompt = `Extract ALL text from this image. 
- Include ALL visible text exactly as it appears
- Preserve formatting, line breaks, and structure
- If it's a table, format it clearly
- If there's no text, say "No text found"

Return ONLY the extracted text, nothing else.`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text().trim();

      return {
        text: text === 'No text found' ? '' : text,
        confidence: 0.95,
        language: 'en'
      };

    } catch (error) {
      console.error('❌ Error extracting text from image:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF by converting to images
   * Note: This is a simplified version. For production, consider using pdf-parse or similar
   */
  async extractTextFromPDF(pdfBuffer) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // For PDFs, we'll use a simpler approach with Gemini
      // Convert PDF buffer to base64 and let Gemini handle it
      const base64PDF = pdfBuffer.toString('base64');

      const prompt = `Extract ALL text content from this PDF document.
- Include all text from all pages
- Preserve structure and formatting
- Include table data if present
- Number pages if multiple pages exist

Return the complete text content.`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64PDF,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text().trim();

      // Estimate page count from content
      const pageCount = (text.match(/Page \d+/gi) || []).length || 1;

      return {
        text,
        pageCount,
        paragraphs: text.split('\n\n').filter(p => p.trim().length > 0),
        tables: []
      };

    } catch (error) {
      console.error('❌ Error extracting text from PDF:', error);
      // Fallback: return basic info
      return {
        text: 'PDF processing requires additional setup. Please install pdf-parse package.',
        pageCount: 0,
        paragraphs: [],
        tables: []
      };
    }
  }

  /**
   * Analyze document structure
   */
  async analyzeDocument(buffer, mimeType) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (mimeType === 'application/pdf') {
        return await this.extractTextFromPDF(buffer);
      } else if (mimeType.startsWith('image/')) {
        const result = await this.extractTextFromImage(buffer, mimeType);
        return {
          text: result.text,
          pageCount: 1,
          paragraphs: result.text.split('\n\n').filter(p => p.trim().length > 0),
          tables: []
        };
      } else {
        throw new Error(`Unsupported document type: ${mimeType}`);
      }

    } catch (error) {
      console.error('❌ Error analyzing document:', error);
      throw error;
    }
  }

  /**
   * Extract tables from document
   */
  async extractTables(buffer, mimeType) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const base64Data = buffer.toString('base64');

      const prompt = `Extract ALL tables from this document.
For each table:
1. Identify the table structure (rows and columns)
2. Extract all cell contents
3. Format as: Table 1: [row1: cell1 | cell2], [row2: cell1 | cell2], etc.

If no tables, return "No tables found".`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text().trim();

      // Parse tables from response
      // This is a simplified version - enhance based on your needs
      const tables = [];
      if (!text.includes('No tables found')) {
        tables.push({
          rowCount: 0,
          columnCount: 0,
          cells: text
        });
      }

      return tables;

    } catch (error) {
      console.error('❌ Error extracting tables:', error);
      return [];
    }
  }

  /**
   * OCR on video frame
   */
  async performOCR(imageBuffer, mimeType = 'image/jpeg') {
    return await this.extractTextFromImage(imageBuffer, mimeType);
  }
}

export const gcpVisionService = new GCPVisionService();