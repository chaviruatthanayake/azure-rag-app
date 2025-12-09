import { VertexAI } from '@google-cloud/vertexai';

/**
 * GCP Vision Service
 * Uses Vertex AI Gemini (with GCP credits - NO rate limits!)
 * Handles PDF, images, and document OCR
 */
class GCPVisionService {
  constructor() {
    this.vertexAI = null;
    this.model = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const projectId = process.env.GCP_PROJECT_ID;
      const location = process.env.GCP_REGION || 'us-central1';

      if (!projectId) {
        throw new Error('GCP_PROJECT_ID not found in environment');
      }

      // Initialize Vertex AI (uses Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS)
      this.vertexAI = new VertexAI({
        project: projectId,
        location: location
      });

      // Use Gemini 1.5 Flash for vision tasks (stable and fast)
      this.model = this.vertexAI.getGenerativeModel({
        model: 'gemini-1.5-flash-001'
      });

      this.initialized = true;
      console.log('✅ GCP Vision Service initialized (Vertex AI)');
      console.log(`   Project: ${projectId}, Region: ${location}`);
    } catch (error) {
      console.error('❌ Error initializing GCP Vision:', error);
      throw error;
    }
  }

  /**
   * Extract text from image using Vertex AI Gemini (NO rate limits with credits!)
   */
  async extractTextFromImage(imageBuffer, mimeType = 'image/jpeg') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const base64Image = imageBuffer.toString('base64');

      const prompt = `Extract ALL text from this image. 
- Include ALL visible text exactly as it appears
- Preserve formatting, line breaks, and structure
- If it's a table, format it clearly
- If there's no text, say "No text found"

Return ONLY the extracted text, nothing else.`;

      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      };

      const result = await this.model.generateContent(request);
      const response = result.response;
      const text = response.candidates[0].content.parts[0].text.trim();

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
   * Extract text from PDF using Vertex AI Gemini
   */
  async extractTextFromPDF(pdfBuffer) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const base64PDF = pdfBuffer.toString('base64');

      const prompt = `Extract ALL text content from this PDF document.
- Include all text from all pages
- Preserve structure and formatting
- Include table data if present
- Number pages if multiple pages exist

Return the complete text content.`;

      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64PDF,
                },
              },
            ],
          },
        ],
      };

      const result = await this.model.generateContent(request);
      const response = result.response;
      const text = response.candidates[0].content.parts[0].text.trim();

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
        text: 'PDF processing error. Please check your Vertex AI setup.',
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

      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      };

      const result = await this.model.generateContent(request);
      const response = result.response;
      const text = response.candidates[0].content.parts[0].text.trim();

      // Parse tables from response
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