import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import os from 'os';
import Tesseract from 'tesseract.js';
import { gcpSpeechService } from './gcp/gcpSpeechService.js';
import { gcpDocumentAIService } from './gcp/gcpDocumentAI.js';

const execAsync = promisify(exec);

/**
 * Document Processor - 100% GCP
 * Uses:
 * - Google Cloud Document AI for PDF/image OCR
 * - Cloud Speech-to-Text for audio transcription
 * - Tesseract.js for video frame OCR
 * - mammoth for DOCX
 * - xlsx for Excel
 * NO AZURE AT ALL!
 */
export class DocumentProcessor {
  
  constructor() {
    // All GCP services
  }

  /**
   * Extract text from document (PDF, DOCX, XLSX, images, videos)
   * 100% GCP + Open Source
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
        console.log('📄 Using GCP Document AI for PDF extraction');
        
        try {
          const result = await gcpDocumentAIService.extractTextFromPDF(fileBuffer);
          extractedText = result.text;
          pageCount = result.pageCount;
          
          console.log(`✅ Extracted ${extractedText.length} chars from ${pageCount} pages`);
        } catch (docAIError) {
          console.error('Error with Document AI:', docAIError);
          extractedText = 'PDF could not be parsed with Document AI.';
          pageCount = 1;
        }
      }

      else if (fileType.startsWith('image/')) {
        console.log('🖼️  Using GCP Document AI for image OCR');
        
        try {
          const result = await gcpDocumentAIService.extractTextFromImage(fileBuffer, fileType);
          extractedText = result.text;
          pageCount = 1;
          
          console.log(`✅ Extracted ${extractedText.length} chars from image`);
        } catch (docAIError) {
          console.error('Error with Document AI:', docAIError);
          extractedText = 'Image OCR failed with Document AI.';
          pageCount = 1;
        }
      }

      else if (fileType === 'video/mp4' || fileType === 'video/quicktime' || fileType === 'video/x-msvideo') {
        console.log('🎬 Processing video file...');
        const tempFile = {
          buffer: fileBuffer,
          originalname: 'video.' + (fileType === 'video/mp4' ? 'mp4' : fileType === 'video/quicktime' ? 'mov' : 'avi'),
          mimetype: fileType
        };
        const videoResult = await this.processVideo(tempFile);
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
   * Check if video has audio track
   */
  async videoHasAudio(videoPath) {
    try {
      const { stdout } = await execAsync(`ffmpeg -i "${videoPath}" 2>&1`);
      return stdout.includes('Audio:');
    } catch (error) {
      return error.stdout && error.stdout.includes('Audio:');
    }
  }

  /**
   * Extract frames from video for analysis
   */
  async extractFramesFromVideo(videoBuffer, originalFileName) {
    try {
      console.log(`🎞️ Extracting frames from video: ${originalFileName}`);

      const tempDir = path.join(os.tmpdir(), 'video-processing');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const videoId = uuidv4();
      const videoPath = path.join(tempDir, `${videoId}-input.mp4`);
      const framesDir = path.join(tempDir, `${videoId}-frames`);
      
      if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir, { recursive: true });
      }

      fs.writeFileSync(videoPath, videoBuffer);

      // Extract 1 frame every 5 seconds
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vf fps=1/5 "${framesDir}/frame-%03d.jpg" -y`;
      
      console.log('🔧 Extracting frames with FFmpeg...');
      await execAsync(ffmpegCommand);

      const frameFiles = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .map(f => path.join(framesDir, f));

      console.log(`✅ Extracted ${frameFiles.length} frames`);

      try {
        fs.unlinkSync(videoPath);
      } catch (e) {
        console.warn('Could not delete temp video');
      }

      return { frameFiles, framesDir };

    } catch (error) {
      console.error('Error extracting frames:', error);
      throw new Error(`Frame extraction failed: ${error.message}`);
    }
  }

  /**
   * Perform OCR on video frames using Tesseract.js (open source)
   */
  async performDocumentAIOCR(frameFiles) {
  console.log(`🔍 Performing OCR on ${frameFiles.length} frames with Document AI...`);

  let allText = '';
  let successfulFrames = 0;

  for (let i = 0; i < frameFiles.length; i++) {
    try {
      const frameBuffer = fs.readFileSync(frameFiles[i]);
      const result = await gcpDocumentAIService.extractTextFromImage(frameBuffer, 'image/jpeg');
      
      if (result.text && result.text.trim().length > 10) {
        allText += `\n\n=== Frame ${i + 1} ===\n${result.text}`;
        successfulFrames++;
      }
    } catch (error) {
      console.warn(`Frame ${i + 1} failed:`, error.message);
    }
  }

  return allText;
}
  /**
   * Extract audio from video using FFmpeg
   */
  async extractAudioFromVideo(videoBuffer, originalFileName) {
    try {
      console.log(`🎵 Extracting audio from video: ${originalFileName}`);

      const tempDir = path.join(os.tmpdir(), 'video-processing');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const videoId = uuidv4();
      const videoPath = path.join(tempDir, `${videoId}-input.mp4`);
      const audioPath = path.join(tempDir, `${videoId}-audio.wav`);

      fs.writeFileSync(videoPath, videoBuffer);
      
      const hasAudio = await this.videoHasAudio(videoPath);
      
      if (!hasAudio) {
        console.log('⚠️ Video has no audio track');
        try {
          fs.unlinkSync(videoPath);
        } catch (e) {}
        return null;
      }

      console.log('✅ Video has audio track, extracting...');

      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${audioPath}"`;
      
      await execAsync(ffmpegCommand);
      console.log(`✅ Audio extracted to: ${audioPath}`);

      const audioBuffer = fs.readFileSync(audioPath);

      try {
        fs.unlinkSync(videoPath);
        fs.unlinkSync(audioPath);
        console.log('🗑️ Cleaned up temp audio files');
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up temp files');
      }

      return audioBuffer;

    } catch (error) {
      console.error('Error extracting audio:', error);
      return null;
    }
  }

  /**
   * Process video - audio + OCR
   * Uses Cloud Speech-to-Text and Tesseract.js
   * 100% GCP + Open Source
   */
  async processVideo(file) {
    let framesDir = null;
    
    try {
      console.log(`🎬 Processing video: ${file.originalname}`);

      let audioTranscript = '';
      let ocrText = '';

      // 1. Try audio transcription with Cloud Speech-to-Text (up to 1 minute)
      console.log('🎵 Step 1: Attempting audio extraction...');
      const audioBuffer = await this.extractAudioFromVideo(file.buffer, file.originalname);
      
      if (audioBuffer) {
        const audioSize = audioBuffer.length;
        const estimatedDuration = audioSize / (16000 * 2);
        
        if (estimatedDuration <= 60) {
          console.log('🎤 Step 2: Transcribing audio with Cloud Speech-to-Text...');
          const transcription = await gcpSpeechService.transcribeAudio(audioBuffer, 'LINEAR16', 16000, 'en-US');
          audioTranscript = transcription || '';
        } else {
          console.log(`⏭️  Skipping audio transcription (estimated ${estimatedDuration.toFixed(1)}s > 60s limit)`);
        }
      } else {
        console.log('⏭️ Skipping audio transcription (no audio track)');
      }

      // 2. Extract frames and perform OCR with Tesseract
      console.log('🎞️ Step 3: Extracting video frames for analysis...');
      const { frameFiles, framesDir: extractedFramesDir } = await this.extractFramesFromVideo(file.buffer, file.originalname);
      framesDir = extractedFramesDir;

      if (frameFiles && frameFiles.length > 0) {
        console.log('📸 Step 4: Performing OCR on video frames (open source Tesseract)...');
        ocrText = await this.performDocumentAIOCR(frameFiles);
      } else {
        console.log('⚠️ No frames extracted');
      }

      // 3. Combine all content
      let combinedText = '';
      
      if (audioTranscript && audioTranscript.trim().length > 0) {
        combinedText += `=== Audio Transcript ===\n${audioTranscript}\n\n`;
      }
      
      if (ocrText && ocrText.trim().length > 0) {
        combinedText += `=== Visual Content (OCR from video frames) ===\n${ocrText}\n`;
      }

      if (combinedText.trim().length === 0) {
        combinedText = `Video file: ${file.originalname}\n\nThis video was processed but contains no detectable audio (or audio > 60s) and no visible text in frames.`;
      }

      console.log(`✅ Combined content: ${combinedText.length} characters`);

      // Clean up frames
      if (framesDir) {
        try {
          const frameFiles = fs.readdirSync(framesDir);
          frameFiles.forEach(f => {
            fs.unlinkSync(path.join(framesDir, f));
          });
          fs.rmdirSync(framesDir);
          console.log('🗑️ Cleaned up frame files');
        } catch (cleanupError) {
          console.warn('⚠️ Could not clean up frames');
        }
      }

      const chunks = this.chunkText(combinedText);
      const language = this.detectLanguage(combinedText);

      return {
        id: uuidv4(),
        fileName: file.originalname,
        fileType: file.mimetype,
        text: combinedText,
        chunks,
        tables: [],
        pageCount: null,
        language,
        uploadDate: new Date().toISOString(),
        chunkCount: chunks.length,
        isVideo: true,
        hasAudio: audioTranscript.length > 0,
        hasVisualText: ocrText.length > 0,
        durationSeconds: null
      };

    } catch (error) {
      if (framesDir) {
        try {
          const frameFiles = fs.readdirSync(framesDir);
          frameFiles.forEach(f => {
            fs.unlinkSync(path.join(framesDir, f));
          });
          fs.rmdirSync(framesDir);
        } catch (e) {}
      }
      
      console.error('Error processing video:', error);
      throw new Error(`Video processing failed: ${error.message}`);
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
   * Process complete document pipeline
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