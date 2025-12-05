import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

/**
 * Video Vision Analyzer
 * Uses Gemini Vision to analyze video frames and describe actions, movements, and context
 */
class VideoVisionAnalyzer {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found');
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash' 
      });

      this.initialized = true;
      console.log('✅ Video Vision Analyzer initialized');
    } catch (error) {
      console.error('❌ Error initializing Video Vision Analyzer:', error);
      throw error;
    }
  }

  /**
   * Analyze video frames to describe actions, movements, and context
   */
  async analyzeFrames(framePaths, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`🎬 Analyzing ${framePaths.length} frames with Gemini Vision...`);

      // Select key frames to analyze (avoid analyzing too many frames)
      const maxFrames = options.maxFrames || 10;
      const selectedFrames = this.selectKeyFrames(framePaths, maxFrames);

      console.log(`   Analyzing ${selectedFrames.length} key frames...`);

      const frameAnalyses = [];

      for (let i = 0; i < selectedFrames.length; i++) {
        const framePath = selectedFrames[i];
        
        try {
          const analysis = await this.analyzeFrame(framePath, i + 1);
          frameAnalyses.push(analysis);
          console.log(`   ✅ Frame ${i + 1}/${selectedFrames.length} analyzed`);
        } catch (error) {
          console.error(`   ⚠️  Frame ${i + 1} analysis failed:`, error.message);
        }
      }

      // Generate overall video summary
      const summary = this.generateVideoSummary(frameAnalyses);

      console.log(`✅ Video vision analysis complete`);

      return {
        frameAnalyses,
        summary,
        totalFrames: framePaths.length,
        analyzedFrames: frameAnalyses.length,
      };

    } catch (error) {
      console.error('❌ Error analyzing frames:', error);
      throw error;
    }
  }

  /**
   * Analyze a single frame
   */
  async analyzeFrame(framePath, frameNumber) {
    try {
      // Read frame as base64
      const imageBuffer = fs.readFileSync(framePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `Analyze this video frame and describe:
1. What actions or movements are happening
2. What objects, equipment, or tools are visible
3. The context or setting of the scene
4. Any important details or procedures being shown

Be concise but specific. Focus on technical details if this appears to be an instructional or technical video.`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
      ]);

      const response = await result.response;
      const description = response.text();

      return {
        frameNumber,
        description: description.trim(),
      };

    } catch (error) {
      console.error(`Error analyzing frame ${frameNumber}:`, error);
      throw error;
    }
  }

  /**
   * Select key frames to analyze (evenly distributed)
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
   * Generate overall video summary from frame analyses
   */
  generateVideoSummary(frameAnalyses) {
    if (frameAnalyses.length === 0) {
      return 'No visual analysis available.';
    }

    // Combine all descriptions
    const allDescriptions = frameAnalyses
      .map(f => f.description)
      .join('\n\n');

    // Create summary
    const summary = `=== Video Visual Summary ===\n\n${allDescriptions}`;

    return summary;
  }

  /**
   * Format analysis results for indexing
   */
  formatForIndexing(analysisResult) {
    const { frameAnalyses, summary } = analysisResult;

    let formatted = '\n\n=== Video Visual Analysis ===\n\n';
    
    // Add frame-by-frame descriptions
    for (const frame of frameAnalyses) {
      formatted += `Frame ${frame.frameNumber}:\n${frame.description}\n\n`;
    }

    // Add overall summary
    formatted += `\nOverall Summary:\n${summary}\n`;

    return formatted;
  }
}

export const videoVisionAnalyzer = new VideoVisionAnalyzer();