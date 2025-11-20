import { docIntelligenceClient, containerClient } from '../config/azureClients.js';
import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import os from 'os';

const execAsync = promisify(exec);

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
   * Extract text from document (PDF, DOCX, XLSX, images)
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

      else if (
        fileType === 'application/pdf' ||
        fileType.startsWith('image/')
      ) {
        console.log('🧠 Using Azure Document Intelligence for PDF/image');
        const poller = await docIntelligenceClient.beginAnalyzeDocument(
          'prebuilt-document',
          fileBuffer,
          { contentType: fileType }
        );

        const result = await poller.pollUntilDone();

        if (result.paragraphs) {
          extractedText = result.paragraphs.map(p => p.content).join('\n\n');
        }

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

        pageCount = result.pages ? result.pages.length : 0;
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
      // FFmpeg returns non-zero exit code, but we can still check output
      return error.stdout && error.stdout.includes('Audio:');
    }
  }

  /**
   * Extract frames from video for OCR analysis
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

      // Save video
      fs.writeFileSync(videoPath, videoBuffer);

      // Extract 1 frame per second (adjust fps for more/fewer frames)
      // -vf fps=1/5 means 1 frame every 5 seconds (adjust as needed)
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vf fps=1/5 "${framesDir}/frame-%03d.jpg" -y`;
      
      console.log('🔧 Extracting frames with FFmpeg...');
      await execAsync(ffmpegCommand);

      // Get all extracted frames
      const frameFiles = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .map(f => path.join(framesDir, f));

      console.log(`✅ Extracted ${frameFiles.length} frames`);

      // Clean up video file
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
   * Perform OCR on video frames using Azure Document Intelligence
   */
  async performOCROnFrames(frameFiles) {
    try {
      console.log(`📸 Performing OCR on ${frameFiles.length} frames...`);

      let allText = '';
      let processedFrames = 0;

      // Process frames (limit to avoid too many API calls)
      const framesToProcess = frameFiles.slice(0, Math.min(frameFiles.length, 10)); // Max 10 frames

      for (const framePath of framesToProcess) {
        try {
          const frameBuffer = fs.readFileSync(framePath);
          
          console.log(`🔍 OCR on frame ${processedFrames + 1}/${framesToProcess.length}...`);

          const poller = await docIntelligenceClient.beginAnalyzeDocument(
            'prebuilt-read',
            frameBuffer,
            { contentType: 'image/jpeg' }
          );

          const result = await poller.pollUntilDone();

          if (result.content && result.content.trim().length > 0) {
            allText += `\n\n=== Frame ${processedFrames + 1} ===\n${result.content}`;
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
      return ''; // Return empty string on error, don't fail entire process
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

      // Save video
      fs.writeFileSync(videoPath, videoBuffer);
      
      // Check if video has audio
      const hasAudio = await this.videoHasAudio(videoPath);
      
      if (!hasAudio) {
        console.log('⚠️ Video has no audio track');
        // Clean up
        try {
          fs.unlinkSync(videoPath);
        } catch (e) {}
        return null;
      }

      console.log('✅ Video has audio track, extracting...');

      // Extract audio
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${audioPath}"`;
      
      await execAsync(ffmpegCommand);
      console.log(`✅ Audio extracted to: ${audioPath}`);

      // Read audio file
      const audioBuffer = fs.readFileSync(audioPath);

      // Clean up
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
      return null; // Return null instead of throwing, we'll try visual analysis
    }
  }

  /**
   * Transcribe audio using Azure Speech REST API
   */
  async transcribeAudioWithRestAPI(audioBuffer) {
    try {
      console.log(`🎤 Transcribing audio with REST API...`);

      const speechKey = process.env.AZURE_SPEECH_KEY;
      const speechRegion = process.env.AZURE_SPEECH_REGION;

      if (!speechKey || !speechRegion) {
        throw new Error('Azure Speech credentials not configured');
      }

      const endpoint = `https://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;

      const response = await axios.post(endpoint, audioBuffer, {
        headers: {
          'Ocp-Apim-Subscription-Key': speechKey,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Accept': 'application/json'
        },
        params: {
          'language': 'en-US',
          'format': 'detailed'
        },
        timeout: 120000
      });

      if (response.data.RecognitionStatus === 'Success') {
        const transcript = response.data.DisplayText;
        console.log(`✅ Audio transcription: ${transcript.length} characters`);
        return transcript;
      } else {
        console.log(`⚠️ Transcription status: ${response.data.RecognitionStatus}`);
        return '';
      }

    } catch (error) {
      console.error('Error transcribing audio:', error.message);
      return ''; // Return empty string, don't fail
    }
  }

  /**
   * Process video comprehensively - audio + visual analysis
   */
  async processVideo(file) {
    let framesDir = null;
    
    try {
      console.log(`🎬 Processing video: ${file.originalname}`);

      // 1. Upload video to blob storage
      const { blobName, url } = await this.uploadToBlob(file, file.originalname);

      let audioTranscript = '';
      let visualText = '';

      // 2. Try audio transcription
      console.log('🎵 Step 1: Attempting audio extraction...');
      const audioBuffer = await this.extractAudioFromVideo(file.buffer, file.originalname);
      
      if (audioBuffer) {
        console.log('🎤 Step 2: Transcribing audio...');
        audioTranscript = await this.transcribeAudioWithRestAPI(audioBuffer);
      } else {
        console.log('⏭️ Skipping audio transcription (no audio track)');
      }

      // 3. Extract frames and perform OCR
      console.log('🎞️ Step 3: Extracting video frames for visual analysis...');
      const { frameFiles, framesDir: extractedFramesDir } = await this.extractFramesFromVideo(file.buffer, file.originalname);
      framesDir = extractedFramesDir;

      if (frameFiles && frameFiles.length > 0) {
        console.log('📸 Step 4: Performing OCR on video frames...');
        visualText = await this.performOCROnFrames(frameFiles);
      } else {
        console.log('⚠️ No frames extracted');
      }

      // 4. Combine audio and visual text
      let combinedText = '';
      
      if (audioTranscript && audioTranscript.trim().length > 0) {
        combinedText += `=== Audio Transcript ===\n${audioTranscript}\n\n`;
      }
      
      if (visualText && visualText.trim().length > 0) {
        combinedText += `=== Visual Content (OCR from video frames) ===\n${visualText}`;
      }

      // If neither worked, create descriptive text
      if (combinedText.trim().length === 0) {
        combinedText = `Video file: ${file.originalname}\n\nThis video was processed but contains no detectable audio or visible text. The video may contain:\n- Visual content without text\n- Silent animations or demonstrations\n- Content that requires manual review\n\nFile information:\n- Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB\n- Format: ${file.mimetype}\n- Uploaded: ${new Date().toISOString()}`;
      }

      console.log(`✅ Combined content: ${combinedText.length} characters`);
      console.log(`   - Audio: ${audioTranscript.length} chars`);
      console.log(`   - Visual: ${visualText.length} chars`);

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

      // 5. Chunk the combined text
      const chunks = this.chunkText(combinedText);

      // 6. Detect language
      const language = this.detectLanguage(combinedText);

      return {
        id: uuidv4(),
        fileName: file.originalname,
        fileType: file.mimetype,
        blobName,
        blobUrl: url,
        text: combinedText,
        chunks,
        tables: [],
        pageCount: null,
        language,
        uploadDate: new Date().toISOString(),
        chunkCount: chunks.length,
        isVideo: true,
        hasAudio: audioTranscript.length > 0,
        hasVisualText: visualText.length > 0,
        durationSeconds: null
      };

    } catch (error) {
      // Clean up on error
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
      
      const { blobName, url } = await this.uploadToBlob(file, file.originalname);
      const { text, tables, pageCount } = await this.extractText(file.buffer, file.mimetype);
      const language = this.detectLanguage(text);
      const chunks = this.chunkText(text);

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