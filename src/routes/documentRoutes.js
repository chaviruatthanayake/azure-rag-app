import express from 'express';
import multer from 'multer';
import { documentProcessor } from '../services/documentProcessor.js';
import { embeddingService } from '../services/embeddingService.js';
import { searchService } from '../services/searchService.js';

const router = express.Router();

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Videos are not supported. Only Word, Excel, PDF, and Images are allowed.'));
    }
  }
});

/**
 * POST /api/documents/upload
 * Upload and process a document
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📤 Upload request received: ${req.file.originalname}`);

    // Step 1: Process document
    const processedDoc = await documentProcessor.processDocument(req.file);

    // Step 2: Generate embeddings for all chunks
    const embeddings = await embeddingService.generateEmbeddings(processedDoc.chunks);

    // Step 3: Index in Azure AI Search
    await searchService.indexDocuments(processedDoc, embeddings);

    res.json({
      success: true,
      message: 'Document uploaded and indexed successfully',
      document: {
        id: processedDoc.id,
        fileName: processedDoc.fileName,
        fileType: processedDoc.fileType,
        language: processedDoc.language,
        chunkCount: processedDoc.chunkCount,
        pageCount: processedDoc.pageCount,
        uploadDate: processedDoc.uploadDate
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload document',
      message: error.message 
    });
  }
});

/**
 * GET /api/documents
 * List all indexed documents
 */
router.get('/', async (req, res) => {
  try {
    const documents = await searchService.listDocuments();
    res.json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ 
      error: 'Failed to list documents',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its chunks
 */
router.delete('/:id', async (req, res) => {
  try {
    const documentId = req.params.id;
    
    // Delete from search index
    const deletedCount = await searchService.deleteDocumentChunks(documentId);
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} chunks from knowledge base`,
      documentId
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ 
      error: 'Failed to delete document',
      message: error.message 
    });
  }
});

export { router as documentRouter };