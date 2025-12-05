import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import os from 'os';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { gcpVisionService } from './gcp/gcpVisionService.js';
import { gcpSpeechService } from './gcp/gcpSpeechService.js';

const execAsync = promisify(exec);

/**
 * Document Processor - 100% GCP (NO Azure)
 * Uses:
 * - Gemini Vision for PDF/image OCR
 * - Google Cloud Speech for audio transcription
 * - Gemini for video frame analysis
 */
export class DocumentProcessor {
  
  constructor() {
    this.genAI = null;
    this.visionModel = null;
  }

  /**
   * Initialize Gemini Vision for video analysis
   */
  async initializeVision() {
    if (this.visionModel) return;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️  GEMINI_API_KEY not found, skipping vision analysis');
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.visionModel = this.genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
      });
      
      console.log('✅ Gemini Vision initialized for video analysis');
    } catch (error) {
      console.warn('⚠️  Could not initialize Gemini Vision:', error.message);
    }
  }

  /**
   * Extract text from document (PDF, DOCX, XLSX, images)
   * NO AZURE - Uses GCP Vision Service
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

      else if (fileType === 'application/pdf' || fileType.startsWith('image/')) {
        console.log('🧠 Using Gemini Vision for PDF/image OCR');
        const result = await gcpVisionService.analyzeDocument(fileBuffer, fileType);
        extractedText = result.text || '';
        pageCount = result.pageCount || 1;

        if (result.tables && result.tables.length > 0) {
          tables = result.tables;
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
   * Analyze video frames with Gemini Vision to describe actions and context
   */
  async analyzeFramesWithVision(frameFiles) {
    try {
      if (!this.visionModel) {
        console.log('⏭️  Skipping vision analysis (Gemini Vision not initialized)');
        return '';
      }

      console.log(`🎬 Analyzing video frames with Gemini Vision...`);

      const maxFrames = 8;
      const selectedFrames = this.selectKeyFrames(frameFiles, maxFrames);
      
      console.log(`   Analyzing ${selectedFrames.length} key frames for actions and context...`);

      let visionText = '\n\n=== Video Visual Analysis (AI Vision) ===\n\n';
      let frameDescriptions = [];

      for (let i = 0; i < selectedFrames.length; i++) {
        const framePath = selectedFrames[i];
        
        try {
          const imageBuffer = fs.readFileSync(framePath);
          const base64Image = imageBuffer.toString('base64');

          const prompt = `Analyze this video frame and describe in 2-3 sentences:
1. What actions or movements are happening
2. What objects, equipment, or tools are visible
3. The context or setting

Be concise and focus on technical details if this appears technical.`;

          const result = await this.visionModel.generateContent([
            prompt,
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
          ]);

          const response = await result.response;
          const description = response.text().trim();

          frameDescriptions.push({
            frame: i + 1,
            description
          });

          console.log(`   ✅ Frame ${i + 1}/${selectedFrames.length} analyzed`);

        } catch (frameError) {
          console.warn(`   ⚠️  Frame ${i + 1} analysis failed:`, frameError.message);
        }
      }

      if (frameDescriptions.length > 0) {
        visionText += 'Video Content Description:\n\n';
        frameDescriptions.forEach(({ frame, description }) => {
          visionText += `Frame ${frame}: ${description}\n\n`;
        });

        console.log(`✅ Vision analysis complete: ${frameDescriptions.length} frames described`);
        return visionText;
      } else {
        console.log('⚠️  No frames could be analyzed with vision');
        return '';
      }

    } catch (error) {
      console.error('❌ Error in vision analysis:', error);
      return '';
    }
  }

  /**
   * Select key frames evenly distributed
   */
  selectKeyFrames(framePaths, maxFrames) {
    if (framePaths.length <= maxFrames) {
      return framePaths;
    }

    const step = Math.floor(framePaths.length / maxFrames);
    const selectedFrames = [];

    for (let i = 0; i < maxFrames; i++) {
      const index = i * step;
      if (index < framePaths.length) {
        selectedFrames.push(framePaths[index]);
      }
    }

    return selectedFrames;
  }

  /**
   * Perform OCR on video frames using Gemini Vision
   */
  async performOCROnFrames(frameFiles) {
    try {
      console.log(`📸 Performing OCR on ${frameFiles.length} frames with Gemini Vision...`);

      let allText = '';
      let processedFrames = 0;

      const framesToProcess = frameFiles.slice(0, Math.min(frameFiles.length, 10));

      for (const framePath of framesToProcess) {
        try {
          const frameBuffer = fs.readFileSync(framePath);
          
          console.log(`🔍 OCR on frame ${processedFrames + 1}/${framesToProcess.length}...`);

          const result = await gcpVisionService.extractTextFromImage(frameBuffer, 'image/jpeg');

          if (result.text && result.text.trim().length > 0) {
            allText += `\n\n=== Frame ${processedFrames + 1} ===\n${result.text}`;
            processedFrames++;
          }

        } catch (frameError) {
          console.warn(`⚠️ Could not process frame ${processedFrames + 1}:`, frameError.message);
        }
      }

      console.log(`✅ OCR completed on ${processedFrames} frames, extracted ${allText.length} characters`);

      return allText;

    } catch (error) {
      console.error('Error performing OCR on frames:', error);
      return '';
    }
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
   * Process video comprehensively - audio + OCR + AI vision analysis
   * NO AZURE - Uses GCP Speech and Gemini Vision
   */
  async processVideo(file) {
    let framesDir = null;
    
    try {
      console.log(`🎬 Processing video: ${file.originalname}`);

      await this.initializeVision();

      let audioTranscript = '';
      let ocrText = '';
      let visionText = '';

      // 1. Try audio transcription with GCP Speech
      console.log('🎵 Step 1: Attempting audio extraction...');
      const audioBuffer = await this.extractAudioFromVideo(file.buffer, file.originalname);
      
      if (audioBuffer) {
        console.log('🎤 Step 2: Transcribing audio with Google Cloud Speech...');
        const transcription = await gcpSpeechService.transcribeAudio(audioBuffer, {
          encoding: 'LINEAR16',
          sampleRate: 16000,
          language: 'en-US'
        });
        audioTranscript = transcription.text || '';
      } else {
        console.log('⏭️ Skipping audio transcription (no audio track)');
      }

      // 2. Extract frames
      console.log('🎞️ Step 3: Extracting video frames for analysis...');
      const { frameFiles, framesDir: extractedFramesDir } = await this.extractFramesFromVideo(file.buffer, file.originalname);
      framesDir = extractedFramesDir;

      if (frameFiles && frameFiles.length > 0) {
        // 3. Perform OCR on frames with Gemini Vision
        console.log('📸 Step 4: Performing OCR on video frames...');
        ocrText = await this.performOCROnFrames(frameFiles);

        // 4. Analyze frames with Gemini Vision for actions and context
        console.log('🎬 Step 5: Analyzing video content with AI Vision...');
        visionText = await this.analyzeFramesWithVision(frameFiles);
      } else {
        console.log('⚠️ No frames extracted');
      }

      // 5. Combine all content
      let combinedText = '';
      
      if (audioTranscript && audioTranscript.trim().length > 0) {
        combinedText += `=== Audio Transcript ===\n${audioTranscript}\n\n`;
      }
      
      if (ocrText && ocrText.trim().length > 0) {
        combinedText += `=== Visual Content (OCR from video frames) ===\n${ocrText}\n`;
      }

      if (visionText && visionText.trim().length > 0) {
        combinedText += visionText;
      }

      if (combinedText.trim().length === 0) {
        combinedText = `Video file: ${file.originalname}\n\nThis video was processed but contains no detectable audio or visible text.`;
      }

      console.log(`✅ Combined content: ${combinedText.length} characters`);
      console.log(`   - Audio: ${audioTranscript.length} chars`);
      console.log(`   - OCR: ${ocrText.length} chars`);
      console.log(`   - Vision: ${visionText.length} chars`);

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
        hasVisionAnalysis: visionText.length > 0,
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