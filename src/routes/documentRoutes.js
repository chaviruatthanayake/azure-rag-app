import express from 'express';
import multer from 'multer';
import { documentProcessor } from '../services/documentProcessor.js';
import { embeddingService } from '../services/embeddingService.js';
import { searchService } from '../services/searchService.js';

const router = express.Router();

// Multer configuration - NO SIZE LIMIT
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity, // No limit - process any size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/bmp',
      'image/webp',
      // Videos
      'video/mp4',
      'video/mpeg',
      'video/x-m4v',
      'video/quicktime',       // .mov
      'video/x-msvideo',       // .avi
      'video/x-matroska',      // .mkv
      'video/webm'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, Word, Excel, Images, and Videos are supported.`));
    }
  }
});

/**
 * Helper function to estimate processing time
 */
function estimateProcessingTime(fileSize, fileType) {
  const sizeMB = fileSize / (1024 * 1024);
  
  if (fileType.startsWith('video/')) {
    // Videos: ~1 minute per 10MB
    return Math.ceil(sizeMB / 10);
  } else if (fileType === 'application/pdf') {
    // PDFs: ~30 seconds per 10MB
    return Math.ceil(sizeMB / 20);
  } else {
    // Other files: ~10 seconds per 10MB
    return Math.ceil(sizeMB / 60);
  }
}

/**
 * Helper function to check if file is a video
 */
function isVideoFile(mimetype) {
  return mimetype.startsWith('video/');
}

/**
 * POST /api/documents/upload
 * Upload and process a document (including videos)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileSize = req.file.size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    const estimatedMinutes = estimateProcessingTime(fileSize, req.file.mimetype);
    
    console.log(`📤 Upload request received: ${req.file.originalname}`);
    console.log(`📊 File size: ${fileSizeMB} MB`);
    console.log(`⏱️  Estimated processing time: ~${estimatedMinutes} minute(s)`);

    // Send early response for large files
    if (fileSizeMB > 100) {
      console.log(`⚠️  Large file detected (${fileSizeMB} MB). This will take approximately ${estimatedMinutes} minutes to process.`);
      // Note: In production, you'd want to implement a job queue system
      // For now, we'll process synchronously but warn the user
    }

    // Determine if this is a video file
    const isVideo = isVideoFile(req.file.mimetype);

    // Step 1: Process document (or video)
    let processedDoc;
    if (isVideo) {
      console.log(`🎬 Processing video file...`);
      processedDoc = await documentProcessor.processVideo(req.file);
    } else {
      console.log(`📄 Processing document file...`);
      processedDoc = await documentProcessor.processDocument(req.file);
    }

    // Step 2: Generate embeddings for all chunks
    console.log(`🧠 Generating embeddings for ${processedDoc.chunks.length} chunks...`);
    const embeddings = await embeddingService.generateEmbeddings(processedDoc.chunks);

    // Step 3: Index in Azure AI Search
    console.log(`🔍 Indexing document in Azure AI Search...`);
    await searchService.indexDocuments(processedDoc, embeddings);

    console.log(`✅ Successfully processed and indexed: ${req.file.originalname}`);

    // Build response
    const response = {
      success: true,
      message: isVideo 
        ? 'Video uploaded, transcribed, and indexed successfully' 
        : 'Document uploaded and indexed successfully',
      document: {
        id: processedDoc.id,
        fileName: processedDoc.fileName,
        fileType: processedDoc.fileType,
        fileSize: `${fileSizeMB} MB`,
        language: processedDoc.language,
        chunkCount: processedDoc.chunkCount,
        uploadDate: processedDoc.uploadDate
      },
      processing: {
        actualProcessingTime: `Completed`,
        estimatedTime: `~${estimatedMinutes} minute(s)`
      }
    };

    // Add video-specific info
    if (isVideo && processedDoc.durationSeconds) {
      response.video = {
        durationSeconds: processedDoc.durationSeconds,
        durationMinutes: (processedDoc.durationSeconds / 60).toFixed(2),
        transcriptLength: processedDoc.text.length
      };
    } else if (!isVideo && processedDoc.pageCount) {
      response.document.pageCount = processedDoc.pageCount;
    }

    res.json(response);
    
  } catch (error) {
    console.error('Upload error:', error);
    
    // Provide detailed error messages
    let errorMessage = 'Failed to upload document';
    let errorDetails = error.message;
    
    if (error.message.includes('transcribe')) {
      errorMessage = 'Failed to transcribe video';
      errorDetails = 'Video transcription service encountered an error. Please ensure the video has clear audio.';
    } else if (error.message.includes('extract')) {
      errorMessage = 'Failed to extract text from document';
    } else if (error.message.includes('embedding')) {
      errorMessage = 'Failed to generate embeddings';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      message: errorDetails,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

/**
 * GET /api/documents/info
 * Get information about supported file types and limits
 */
router.get('/info', (req, res) => {
  res.json({
    supportedFileTypes: {
      documents: ['PDF', 'DOCX', 'DOC', 'XLSX', 'XLS'],
      images: ['JPEG', 'JPG', 'PNG', 'TIFF', 'BMP', 'WebP'],
      videos: ['MP4', 'MOV', 'AVI', 'MKV', 'WebM', 'MPEG']
    },
    fileSizeLimit: 'No limit - all file sizes supported',
    processingTimes: {
      smallFiles: 'Under 10MB: ~10-30 seconds',
      mediumFiles: '10-100MB: ~1-5 minutes',
      largeFiles: 'Over 100MB: ~5-20 minutes',
      videos: 'Depends on length and size: ~1 minute per 10MB'
    },
    recommendations: {
      videos: 'For best results, use videos with clear audio',
      largeFiles: 'Large files (>100MB) will take longer - please be patient',
      formats: 'MP4 and MOV formats are recommended for videos'
    }
  });
});

export { router as documentRouter };