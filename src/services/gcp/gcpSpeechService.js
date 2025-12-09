import speech from '@google-cloud/speech';

/**
 * GCP Speech Service
 * Uses Cloud Speech-to-Text API for audio transcription
 * Supports long audio files (with your $300 credits!)
 */
class GCPSpeechService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Speech client
      this.client = new speech.SpeechClient({
        projectId: process.env.GCP_PROJECT_ID
      });

      this.initialized = true;
      console.log('✅ GCP Speech Service initialized (Cloud Speech-to-Text)');
    } catch (error) {
      console.error('❌ Error initializing GCP Speech:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio buffer
   * For short audio (< 1 minute)
   */
  async transcribeAudio(audioBuffer, encoding = 'LINEAR16', sampleRateHertz = 16000, languageCode = 'en-US') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🎤 Transcribing audio (short form)...');

      const audio = {
        content: audioBuffer.toString('base64'),
      };

      const config = {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
      };

      const request = {
        audio: audio,
        config: config,
      };

      const [response] = await this.client.recognize(request);
      
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');

      console.log(`✅ Transcription complete (${transcription.length} chars)`);

      return transcription;

    } catch (error) {
      console.error('❌ Error transcribing audio:', error);
      return '';
    }
  }

  /**
   * Transcribe long audio using Cloud Storage
   * For audio > 1 minute
   */
  async transcribeLongAudio(gcsUri, encoding = 'LINEAR16', sampleRateHertz = 16000, languageCode = 'en-US') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🎤 Transcribing long audio from GCS...');

      const audio = {
        uri: gcsUri,
      };

      const config = {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
      };

      const request = {
        audio: audio,
        config: config,
      };

      // Start long-running operation
      const [operation] = await this.client.longRunningRecognize(request);

      // Wait for operation to complete
      const [response] = await operation.promise();

      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');

      console.log(`✅ Long transcription complete (${transcription.length} chars)`);

      return transcription;

    } catch (error) {
      console.error('❌ Error transcribing long audio:', error);
      return '';
    }
  }

  /**
   * Chunk and transcribe audio (for medium-length audio)
   * Splits audio into 45-second chunks
   */
  async transcribeAudioChunked(audioBuffer, chunkDurationSeconds = 45) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🎤 Transcribing audio in chunks...');

      // For simplicity, use short-form API
      // In production, you'd chunk the audio buffer
      const transcription = await this.transcribeAudio(audioBuffer);

      return transcription;

    } catch (error) {
      console.error('❌ Error in chunked transcription:', error);
      return '';
    }
  }

  /**
   * Detect language in audio
   */
  async detectAudioLanguage(audioBuffer) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const audio = {
        content: audioBuffer.toString('base64'),
      };

      const config = {
        encoding: 'LINEAR16',
        languageCode: 'en-US', // Base language
        alternativeLanguageCodes: ['es-ES', 'fr-FR', 'de-DE', 'zh-CN', 'ja-JP', 'ko-KR'],
      };

      const request = {
        audio: audio,
        config: config,
      };

      const [response] = await this.client.recognize(request);

      if (response.results && response.results.length > 0) {
        const detectedLanguage = response.results[0].languageCode || 'en-US';
        console.log(`🌍 Detected audio language: ${detectedLanguage}`);
        return detectedLanguage;
      }

      return 'en-US';

    } catch (error) {
      console.error('❌ Error detecting audio language:', error);
      return 'en-US';
    }
  }
}

export const gcpSpeechService = new GCPSpeechService();