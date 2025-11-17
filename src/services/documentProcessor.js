import { docIntelligenceClient, containerClient } from '../config/azureClients.js';
import { v4 as uuidv4 } from 'uuid';

export class DocumentProcessor {
  
  /**
   * Upload document to Azure Blob Storage
   */
  async uploadToBlob(file, fileName) {
    try {
      const blobName = `${uuidv4()}-${fileName}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype
        }
      });

      console.log(`✅ Uploaded ${fileName} to blob storage`);
      return {
        blobName,
        url: blockBlobClient.url
      };
    } catch (error) {
      console.error('Error uploading to blob:', error);
      throw error;
    }
  }

  /**
   * Extract text from document using Azure Document Intelligence
   */
  async extractText(fileBuffer, fileType) {
  try {
    console.log(`📄 Extracting text from ${fileType}...`);
    
    // Call Document Intelligence with the raw file bytes (no URL needed)
    const poller = await docIntelligenceClient.beginAnalyzeDocument(
      'prebuilt-document',
      fileBuffer,
      {
        contentType: fileType
      }
    );

    const result = await poller.pollUntilDone();
    
    let extractedText = '';
    let tables = [];

    // Extract paragraphs
    if (result.paragraphs) {
      extractedText = result.paragraphs.map(p => p.content).join('\n\n');
    }

    // Extract tables (keep your existing logic)
    if (result.tables) {
      tables = result.tables.map(table => {
        const rows = [];
        let currentRow = [];
        let currentRowIndex = -1;

        table.cells.forEach(cell => {
          if (cell.rowIndex !== currentRowIndex) {
            if (currentRow.length > 0) {
              rows.push(currentRow);
            }
            currentRow = [];
            currentRowIndex = cell.rowIndex;
          }
          currentRow.push(cell.content);
        });

        if (currentRow.length > 0) {
          rows.push(currentRow);
        }

        return {
          rowCount: table.rowCount,
          columnCount: table.columnCount,
          cells: rows
        };
      });

      tables.forEach((table, index) => {
        extractedText += `\n\n=== Table ${index + 1} ===\n`;
        table.cells.forEach(row => {
          extractedText += row.join(' | ') + '\n';
        });
      });
    }

    console.log(`✅ Extracted ${extractedText.length} characters from document`);
    
    return {
      text: extractedText,
      tables,
      pageCount: result.pages ? result.pages.length : 0
    };
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}


  /**
   * Chunk text into smaller pieces for embedding
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
   * Detect language of text
   */
  detectLanguage(text) {
    // Simple language detection based on character sets
    // For production, use Azure Text Analytics API
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

    return 'english'; // default
  }

  /**
   * Process complete document pipeline
   */
  async processDocument(file) {
    try {
      console.log(`🔄 Processing document: ${file.originalname}`);
      
      // 1. Upload to blob storage
      const { blobName, url } = await this.uploadToBlob(file, file.originalname);

      // 2. Extract text
      const { text, tables, pageCount } = await this.extractText(file.buffer, file.mimetype);

      // 3. Detect language
      const language = this.detectLanguage(text);

      // 4. Chunk text
      const chunks = this.chunkText(text);

      // 5. Return processed data
      return {
        id: uuidv4(),
        fileName: file.originalname,
        fileType: file.mimetype,
        blobName,
        blobUrl: url,
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

  /**
   * Delete document from blob storage
   */
  async deleteDocument(blobName) {
    try {
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();
      console.log(`✅ Deleted ${blobName} from blob storage`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
}

export const documentProcessor = new DocumentProcessor();