import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { documentProcessor } from './services/documentProcessor.js';
import { embeddingService } from './services/embeddingService.js';
import { searchService } from './services/searchService.js';
import { ragService } from './services/ragService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Serve static files (UI) if public folder exists
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// ===================================
// DOCUMENT ROUTES
// ===================================

// Upload document
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log(`📄 Processing document: ${req.file.originalname}`);

    // Extract text from document
    const extractedData = await documentProcessor.extractText(
      req.file.buffer,
      req.file.mimetype
    );

    if (!extractedData.text || extractedData.text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No content could be extracted from the document'
      });
    }

    console.log(`✅ Extracted ${extractedData.text.length} characters`);

    // Chunk text
    const chunks = documentProcessor.chunkText(extractedData.text);
    console.log(`✅ Created ${chunks.length} chunks`);

    // Detect language
    const language = documentProcessor.detectLanguage(extractedData.text);

    // Generate embeddings
    console.log(`🧠 Generating embeddings for ${chunks.length} chunks...`);
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await embeddingService.generateEmbeddings(chunkTexts);

    // Prepare document for indexing
    const document = {
      id: Date.now().toString(),
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      language: language,
      blobName: `${Date.now()}-${req.file.originalname}`,
      pageCount: extractedData.pageCount || null,
      uploadDate: new Date().toISOString(),
      chunks: chunks.map((chunk, index) => ({
        text: chunk.text,
        embedding: embeddings[index]
      }))
    };

    // Index in Azure Search
    console.log(`🔍 Indexing document in Azure AI Search...`);
    await searchService.indexDocument(document);

    console.log(`✅ Successfully processed and indexed: ${req.file.originalname}`);

    res.json({
      success: true,
      message: 'Document uploaded and processed successfully',
      document: {
        id: document.id,
        fileName: document.fileName,
        fileType: document.fileType,
        language: document.language,
        chunks: chunks.length,
        uploadDate: document.uploadDate
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document',
      message: error.message
    });
  }
});

// List all documents
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await searchService.getAllDocuments();
    
    res.json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list documents',
      message: error.message
    });
  }
});

// Delete document
app.delete('/api/documents/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await searchService.deleteDocumentsByFileName(filename);
    
    res.json({
      success: true,
      message: 'Document deleted successfully',
      deleted: result.deleted
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

// Delete all documents
app.delete('/api/documents', async (req, res) => {
  try {
    console.log('🗑️ Deleting all documents...');
    
    // Get all documents
    const documents = await searchService.getAllDocuments();
    
    if (documents.length === 0) {
      return res.json({
        success: true,
        message: 'No documents to delete',
        deleted: 0
      });
    }
    
    // Delete each document
    let totalDeleted = 0;
    for (const doc of documents) {
      console.log(`🗑️ Deleting: ${doc.fileName}`);
      const result = await searchService.deleteDocumentsByFileName(doc.fileName);
      totalDeleted += result.deleted;
    }
    
    console.log(`✅ Deleted ${totalDeleted} total chunks from ${documents.length} documents`);
    
    res.json({
      success: true,
      message: 'All documents deleted successfully',
      documentsDeleted: documents.length,
      chunksDeleted: totalDeleted
    });
  } catch (error) {
    console.error('Error deleting all documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete all documents',
      message: error.message
    });
  }
});

// ===================================
// QUERY ROUTES
// ===================================

// Query documents
app.post('/api/query', async (req, res) => {
  try {
    const { question, language = 'english' } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    console.log(`💬 Processing query: "${question}"`);

    const result = await ragService.generateAnswer(question, language);

    res.json({
      success: true,
      question,
      answer: result.answer,
      sources: result.sources,
      usedInternetSearch: result.usedInternetSearch || false,
      usedGemini: result.usedGemini || true,
      model: result.model || 'gemini-2.5-flash',
      language,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message
    });
  }
});

// Batch query
app.post('/api/query/batch', async (req, res) => {
  try {
    const { questions, language = 'english' } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: 'Questions array is required'
      });
    }

    console.log(`💬 Processing ${questions.length} batch queries`);

    const results = await Promise.all(
      questions.map(async (question) => {
        try {
          const result = await ragService.generateAnswer(question, language);
          return {
            question,
            answer: result.answer,
            sources: result.sources,
            success: true
          };
        } catch (error) {
          return {
            question,
            error: error.message,
            success: false
          };
        }
      })
    );

    res.json({
      success: true,
      count: questions.length,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch query',
      message: error.message
    });
  }
});

// ===================================
// GOOGLE DRIVE ROUTES (if available)
// ===================================

// Try to load Google Drive service
let googleDriveAvailable = false;
let driveSyncService = null;

try {
  const driveSyncModule = await import('./services/driveSyncService.js');
  driveSyncService = driveSyncModule.driveSyncService;
  googleDriveAvailable = true;
  console.log('✅ Google Drive service loaded');
} catch (error) {
  console.log('⚠️ Google Drive service not available (optional)');
}

if (googleDriveAvailable && driveSyncService) {
  // Sync from Google Drive (backend only)
  app.post('/api/drive/sync', async (req, res) => {
    try {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!folderId) {
        return res.status(400).json({
          success: false,
          error: 'Google Drive folder ID not configured'
        });
      }

      console.log('📥 Received sync request');
      const result = await driveSyncService.syncFromDrive(folderId);
      res.json(result);

    } catch (error) {
      console.error('Error in sync endpoint:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync from Google Drive',
        message: error.message
      });
    }
  });

  // Check for new files (only syncs new/modified files)
  app.post('/api/drive/check-new', async (req, res) => {
    try {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!folderId) {
        return res.status(400).json({
          success: false,
          error: 'Google Drive folder ID not configured'
        });
      }

      console.log('🔍 Checking for new files...');
      const result = await driveSyncService.syncFromDrive(folderId);
      
      // Customize response for "check new" context
      res.json({
        success: result.success,
        newFiles: result.processed,
        skipped: result.skipped,
        errors: result.errors,
        total: result.total,
        message: result.processed > 0 
          ? `Found and processed ${result.processed} new/modified file(s)` 
          : 'No new files found',
        duration: result.duration
      });

    } catch (error) {
      console.error('Error checking for new files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check for new files',
        message: error.message
      });
    }
  });

  // Get sync status
  app.get('/api/drive/status', async (req, res) => {
    try {
      const status = driveSyncService.getSyncStatus();
      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      console.error('Error getting sync status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status',
        message: error.message
      });
    }
  });

  // Clear cache
  app.post('/api/drive/clear-cache', async (req, res) => {
    try {
      driveSyncService.clearCache();
      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        message: error.message
      });
    }
  });
}

// ===================================
// HEALTH CHECK
// ===================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      googleDrive: googleDriveAvailable && !!process.env.GOOGLE_DRIVE_FOLDER_ID,
      azureOpenAI: !!process.env.AZURE_OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      azureSearch: !!process.env.AZURE_SEARCH_API_KEY
    }
  });
});

// Catch-all route
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('API is running. UI not available.');
    }
  });
});

// ===================================
// START SERVER
// ===================================

app.listen(PORT, async () => {
  console.log('==========================================');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📝 Environment:', process.env.NODE_ENV || 'development');
  console.log('==========================================');
  console.log('📋 Available endpoints:');
  console.log('   GET  /                      - UI Dashboard (if available)');
  console.log('   GET  /health                - Health check');
  if (googleDriveAvailable) {
    console.log('   POST /api/drive/sync        - Full sync (backend only)');
    console.log('   POST /api/drive/check-new   - Check for new files');
    console.log('   GET  /api/drive/status      - Get sync status');
    console.log('   POST /api/drive/clear-cache - Clear sync cache');
  }
  console.log('   POST /api/query             - Query documents');
  console.log('   POST /api/query/batch       - Batch query');
  console.log('   POST /api/documents/upload  - Upload document');
  console.log('   GET  /api/documents         - List documents');
  console.log('   DELETE /api/documents/:name - Delete document');
  console.log('   DELETE /api/documents       - Delete all documents');
  console.log('==========================================');
  console.log('🔧 Configuration:');
  console.log(`   Google Drive: ${googleDriveAvailable && process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Azure OpenAI: ${process.env.AZURE_OPENAI_API_KEY ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`   Azure Search: ${process.env.AZURE_SEARCH_API_KEY ? '✅ Connected' : '❌ Not configured'}`);
  console.log('==========================================');

  // Auto-sync on startup if Google Drive is configured
  if (googleDriveAvailable && process.env.GOOGLE_DRIVE_FOLDER_ID) {
    console.log('');
    console.log('🔄 Starting initial Google Drive sync...');
    try {
      const result = await driveSyncService.syncFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
      if (result.success) {
        console.log(`✅ Initial sync completed: ${result.processed} documents processed, ${result.skipped} skipped`);
      } else {
        console.log(`⚠️ Initial sync failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`⚠️ Initial sync error: ${error.message}`);
    }
    console.log('==========================================');
  }
});

export default app;