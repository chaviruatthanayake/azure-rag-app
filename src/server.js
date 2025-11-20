import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { documentRouter } from './routes/documentRoutes.js';
import { queryRouter } from './routes/queryRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for file uploads - NO SIZE LIMIT
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity, // Remove file size limit - handle all sizes
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
      cb(new Error(`Invalid file type: ${file.mimetype}. Supported types: PDF, Word, Excel, Images (JPEG, PNG, TIFF, BMP, WebP), Videos (MP4, MOV, AVI, MKV, WebM)`));
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Azure RAG API is running',
    version: '2.0.0',
    endpoints: {
      upload: 'POST /api/documents/upload',
      query: 'POST /api/query',
      list: 'GET /api/documents',
      delete: 'DELETE /api/documents/:id'
    },
    supportedFileTypes: {
      documents: ['PDF', 'DOCX', 'DOC', 'XLSX', 'XLS'],
      images: ['JPEG', 'JPG', 'PNG', 'TIFF', 'BMP', 'WebP'],
      videos: ['MP4', 'MOV', 'AVI', 'MKV', 'WebM', 'MPEG']
    },
    notes: {
      fileSize: 'No size limit - large files will take longer to process',
      videoProcessing: 'Videos are transcribed using Azure Speech Service',
      largeFiles: 'Files over 100MB may take several minutes to process'
    }
  });
});

app.use('/api/documents', documentRouter);
app.use('/api/query', queryRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'This should not happen - contact support if you see this message'
      });
    }
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`📦 File upload: NO SIZE LIMIT`);
  console.log(`🎬 Video transcription: ENABLED`);
});

export default app;