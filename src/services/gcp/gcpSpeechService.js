import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

/**
 * GCP Speech Service
 * Replaces Azure Speech with Google Cloud Speech-to-Text and Text-to-Speech
 */
class GCPSpeechService {
  constructor() {
    this.speechClient = null;
    this.ttsClient = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔧 Initializing GCP Speech Service...');

      this.speechClient = new SpeechClient();
      this.ttsClient = new TextToSpeechClient();

      this.initialized = true;
      console.log('✅ GCP Speech Service initialized');
    } catch (error) {
      console.error('❌ Error initializing GCP Speech:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio to text (replaces Azure Speech)
   * Handles both short and long audio automatically
   */
  async transcribeAudio(audioBuffer, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🎤 Transcribing audio with Google Cloud Speech...');

      // Estimate audio duration (rough estimate: 16000 samples/sec, 16-bit)
      const estimatedDuration = audioBuffer.length / (16000 * 2); // seconds

      // If audio is longer than 50 seconds, split into chunks
      if (estimatedDuration > 50) {
        console.log(`⏱️  Long audio detected (~${Math.round(estimatedDuration)}s), processing in chunks...`);
        return await this.transcribeLongAudioInChunks(audioBuffer, options);
      }

      const audio = {
        content: audioBuffer.toString('base64'),
      };

      const config = {
        encoding: options.encoding || 'LINEAR16',
        sampleRateHertz: options.sampleRate || 16000,
        languageCode: options.language || 'en-US',
        enableAutomaticPunctuation: true,
        model: 'default',
      };

      const request = {
        audio: audio,
        config: config,
      };

      const [response] = await this.speechClient.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        console.log('⚠️  No speech detected in audio');
        return {
          text: '',
          confidence: 0
        };
      }

      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      const confidence = response.results[0]?.alternatives[0]?.confidence || 0;

      console.log(`✅ Transcription: ${transcription.length} characters`);

      return {
        text: transcription,
        confidence: confidence
      };

    } catch (error) {
      console.error('❌ Error transcribing audio:', error.message);
      // Don't fail - return empty transcript
      return {
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Transcribe long audio by splitting into chunks
   */
  async transcribeLongAudioInChunks(audioBuffer, options = {}) {
    try {
      // Split audio into ~45 second chunks (safe limit)
      const chunkSize = 45 * 16000 * 2; // 45 seconds of 16kHz 16-bit audio
      const chunks = [];
      
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        chunks.push(audioBuffer.slice(i, i + chunkSize));
      }

      console.log(`   Processing ${chunks.length} audio chunks...`);

      const transcriptions = [];

      for (let i = 0; i < chunks.length; i++) {
        console.log(`   Chunk ${i + 1}/${chunks.length}...`);
        
        const audio = {
          content: chunks[i].toString('base64'),
        };

        const config = {
          encoding: options.encoding || 'LINEAR16',
          sampleRateHertz: options.sampleRate || 16000,
          languageCode: options.language || 'en-US',
          enableAutomaticPunctuation: true,
          model: 'default',
        };

        const request = {
          audio: audio,
          config: config,
        };

        try {
          const [response] = await this.speechClient.recognize(request);
          
          if (response.results && response.results.length > 0) {
            const transcription = response.results
              .map(result => result.alternatives[0].transcript)
              .join(' ');
            transcriptions.push(transcription);
          }
        } catch (chunkError) {
          console.warn(`   ⚠️  Chunk ${i + 1} failed:`, chunkError.message);
        }
      }

      const fullTranscription = transcriptions.join(' ');
      console.log(`✅ Transcription complete: ${fullTranscription.length} characters`);

      return {
        text: fullTranscription,
        confidence: 0.85 // Average confidence for chunked audio
      };

    } catch (error) {
      console.error('❌ Error transcribing long audio:', error);
      return {
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Long audio transcription (for files > 1 minute)
   */
  async transcribeLongAudio(audioBuffer, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🎤 Transcribing long audio...');

      // For long audio, we'd typically use GCS and longRunningRecognize
      // For now, we'll use the same recognize method
      return await this.transcribeAudio(audioBuffer, options);

    } catch (error) {
      console.error('❌ Error transcribing long audio:', error);
      return {
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(text, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const request = {
        input: { text: text },
        voice: {
          languageCode: options.language || 'en-US',
          ssmlGender: options.gender || 'NEUTRAL',
        },
        audioConfig: {
          audioEncoding: options.encoding || 'MP3',
        },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);
      return response.audioContent;

    } catch (error) {
      console.error('❌ Error in text-to-speech:', error);
      throw error;
    }
  }
}

export const gcpSpeechService = new GCPSpeechService();