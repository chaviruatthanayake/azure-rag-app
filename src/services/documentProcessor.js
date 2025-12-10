import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import os from 'os';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const unlinkAsync = promisify(fs.unlink);

/**
 * Simplified Document Processor
 * Uses:
 * - pdfjs-dist for PDFs (FREE, more reliable)
 * - Gemini 2.0 for videos (FREE)
 * - mammoth for DOCX (FREE)
 * - xlsx for Excel (FREE)
 */
export class DocumentProcessor {
  
  constructor() {
    this.genAI = null;
  }

  async initializeGemini() {
    if (this.genAI) return;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini initialized for video processing');
  }

  /**
   * Extract text from PDF using pdfjs-dist
   */
  async extractPdfText(buffer) {
    try {
      const data = new Uint8Array(buffer);
      const loadingTask = getDocument({ data });
      const pdfDocument = await loadingTask.promise;
      
      let fullText = '';
      const numPages = pdfDocument.numPages;
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return { text: fullText, numpages: numPages };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw error;
    }
  }

  /**
   * Extract text from document
   */
  async extractText(fileBuffer, fileType) {
    try {
      console.log(`📄 Extracting text from ${fileType}...`);

      let extractedText = '';
      let tables = [];
      let pageCount = 0;

      if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log('📝 Using mammoth to extract DOCX');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value || '';
        pageCount = 1;
      }

      else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        console.log('📊 Using xlsx to extract EXCEL');
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        workbook.SheetNames.forEach((sheetName, idx) => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;

          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim().length === 0) return;

          extractedText += `\n\n=== Sheet ${idx + 1}: ${sheetName} ===\n`;
          extractedText += csv;
        });

        pageCount = workbook.SheetNames.length;
      }

      else if (fileType === 'application/pdf') {
        console.log('📄 Using pdfjs-dist for PDF extraction (FREE)');
        
        try {
          const result = await this.extractPdfText(fileBuffer);
          extractedText = result.text;
          pageCount = result.numpages;
          
          console.log(`✅ Extracted ${extractedText.length} chars from ${pageCount} pages`);
        } catch (pdfError) {
          console.error('Error with PDF extraction:', pdfError);
          extractedText = 'PDF could not be parsed.';
          pageCount = 1;
        }
      }

      else if (fileType.startsWith('image/')) {
        console.log('🖼️  Skipping image OCR (not needed per client)');
        extractedText = 'Image file - OCR not implemented in simplified version.';
        pageCount = 1;
      }

      else if (fileType === 'video/mp4' || fileType === 'video/quicktime' || fileType === 'video/x-msvideo') {
        console.log('🎬 Processing video with Gemini 2.0...');
        const tempFile = {
          buffer: fileBuffer,
          originalname: 'video.' + (fileType === 'video/mp4' ? 'mp4' : fileType === 'video/quicktime' ? 'mov' : 'avi'),
          mimetype: fileType
        };
        const videoResult = await this.processVideoWithGemini(tempFile);
        extractedText = videoResult.text;
        pageCount = 0;
      }

      else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      console.log(`✅ Extracted ${extractedText.length} characters from document`);

      return {
        text: extractedText,
        tables,
        pageCount
      };
    } catch (error) {
      console.error('Error extracting text:', error);
      throw error;
    }
  }

  /**
   * Process video using Gemini 2.0
   */
  async processVideoWithGemini(file) {
    await this.initializeGemini();

    try {
      console.log(`🎬 Processing video with Gemini 2.0: ${file.originalname}`);

      const base64Video = file.buffer.toString('base64');
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp' 
      });

      const prompt = `Analyze this video comprehensively and provide:

1. A detailed description of all visual content you see (people, objects, text, scenes, actions)
2. A complete transcription of any spoken audio or dialogue
3. Any text visible in the video (signs, captions, overlays, etc.)
4. The main topic or purpose of the video

Be thorough and include all relevant details.`;

      console.log('🤖 Sending video to Gemini 2.0 for analysis...');

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Video,
            mimeType: file.mimetype
          }
        },
        { text: prompt }
      ]);

      const response = result.response;
      const analysisText = response.text();

      console.log(`✅ Gemini analysis complete: ${analysisText.length} characters`);

      if (!analysisText || analysisText.trim().length === 0) {
        return {
          text: `Video file: ${file.originalname}\n\nGemini could not analyze this video.`,
          language: 'en',
          pageCount: 0
        };
      }

      const formattedText = `=== Video Analysis: ${file.originalname} ===\n\n${analysisText}`;

      return {
        text: formattedText,
        language: 'en',
        pageCount: 0
      };

    } catch (error) {
      console.error('Error processing video with Gemini:', error);
      
      return {
        text: `Video file: ${file.originalname}\n\nVideo processing failed: ${error.message}`,
        language: 'en',
        pageCount: 0
      };
    }
  }

  /**
   * Chunk text into smaller pieces
   */
  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }

    console.log(`✅ Created ${chunks.length} chunks from text`);
    return chunks;
  }

  /**
   * Detect language
   */
  detectLanguage(text) {
    const languages = {
      'english': /^[a-zA-Z0-9\s.,!?;:'"()-]+$/,
      'spanish': /[áéíóúñÁÉÍÓÚÑ]/,
      'french': /[àâäæçéèêëïîôùûüÿœÀÂÄÆÇÉÈÊËÏÎÔÙÛÜŸŒ]/,
      'german': /[äöüßÄÖÜ]/,
      'chinese': /[\u4e00-\u9fa5]/,
      'arabic': /[\u0600-\u06FF]/,
      'russian': /[\u0400-\u04FF]/
    };

    for (const [lang, pattern] of Object.entries(languages)) {
      if (pattern.test(text.substring(0, 500))) {
        return lang;
      }
    }

    return 'english';
  }

  /**
   * Process complete document
   */
  async processDocument(file) {
    try {
      console.log(`📄 Processing document: ${file.originalname}`);
      
      const { text, tables, pageCount } = await this.extractText(file.buffer, file.mimetype);
      const language = this.detectLanguage(text);
      const chunks = this.chunkText(text);

      return {
        id: uuidv4(),
        fileName: file.originalname,
        fileType: file.mimetype,
        text,
        chunks,
        tables,
        pageCount,
        language,
        uploadDate: new Date().toISOString(),
        chunkCount: chunks.length
      };
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }
}

export const documentProcessor = new DocumentProcessor();