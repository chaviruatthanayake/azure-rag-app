import { searchService } from './searchService.js';
import { embeddingService } from './embeddingService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

class RAGService {
  
  /**
   * Generate answer using Gemini (for ALL questions)
   */
  async generateAnswerWithGemini(question, context, language) {
    try {
      console.log('🤖 Using Gemini for answer generation...');

      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const prompt = `You are a highly accurate AI assistant. Your job is to answer questions using the DOCUMENT CONTENT provided below.

==================================================
DOCUMENT CONTENT (Your SOURCE of truth):
==================================================
${context}

==================================================
USER'S QUESTION: ${question}
==================================================

CRITICAL RULES - READ CAREFULLY:

1. EXAMINE THE DOCUMENT CONTENT ABOVE:
   - Look at the [Source X: filename.ext (type)] headers
   - Read the actual content under each source
   - Note the file types: PDF, MP4 (video), PNG (image), DOCX, etc.

2. IDENTIFY WHAT FILES YOU HAVE:
   - Count how many sources are listed above
   - List the file names and their types
   - Note if there are videos (mp4, mov), images (png, jpg), or documents (pdf, docx)

3. HANDLE EMPTY CONTENT:
   - If a source shows "[No content available]" or has very little text:
     * For videos: Say "Video file exists but no audio/visual text was extracted (possibly silent or unclear)"
     * For images: Say "Image file exists but no readable text was detected (possibly no text or unclear)"
     * For PDFs: Say "Document exists but content could not be extracted"
   - Still LIST the file as existing, just note content limitations

4. ANSWER THE QUESTION:
   
   A) If question asks "what videos/images/documents do I have?":
      → LIST all files of that type from the sources above
      → Include file names even if content is empty
      → Note which have content and which don't
      → Example: "You have 3 videos: [list with content status]"
   
   B) If question asks about content in specific file types:
      → Use the actual content from those file sources
      → For videos: Mention transcribed audio and visible text (if available)
      → For images: Mention OCR extracted text (if available)
      → If empty: Explain that file exists but content couldn't be extracted
   
   C) If question asks general "what's in these documents?":
      → Summarize ALL sources above
      → Group by type (videos, images, documents)
      → For each file: describe content OR note if empty
   
   D) If documents don't answer the question:
      → Say "Based on the provided documents: [what you found]"
      → Then add: "However, to fully answer: [general knowledge]"

5. FILE TYPE MEANINGS:
   - video/mp4, video/quicktime = Video files (audio transcription + frame OCR)
   - image/png, image/jpeg = Images (OCR text extraction)
   - application/pdf = PDF documents (full text)
   - application/vnd.openxmlformats = Word/Excel documents

6. BE SPECIFIC AND HONEST:
   ✓ Use actual file names from sources
   ✓ Quote or reference specific content when available
   ✓ Admit when content is empty or unclear
   ✓ Don't ignore sources - acknowledge ALL of them
   ✓ If there are videos in sources, LIST THEM even if content is empty

7. FORMAT: Answer in ${language}

==================================================
YOUR DETAILED ANSWER (using the sources above):
==================================================`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      console.log(`✅ Gemini generated ${answer.length} characters`);
      return answer;

    } catch (error) {
      console.error('Error with Gemini:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Main method to generate answers
   */
  async generateAnswer(question, language = 'english') {
    try {
      console.log(`💬 Generating answer for: "${question}"`);
      console.log(`🔧 Using: Azure OpenAI (embeddings) + Gemini (answers)`);

      // Check if question is asking about specific file types
      const questionLower = question.toLowerCase();
      const asksAboutVideos = questionLower.includes('video') || questionLower.includes('mp4') || questionLower.includes('recording');
      const asksAboutImages = questionLower.includes('image') || questionLower.includes('png') || questionLower.includes('jpg') || questionLower.includes('picture');
      const asksAboutDocuments = questionLower.includes('document') || questionLower.includes('pdf') || questionLower.includes('file');

      // 1. Generate embedding for the question
      const questionEmbedding = await embeddingService.generateEmbedding(question);
      
      // 2. Search for relevant documents
      let searchResults = await searchService.searchDocuments(questionEmbedding, 10);

      // 3. If asking about specific file types and we don't have any, get documents of that type
      if (searchResults.length > 0) {
        const hasVideos = searchResults.some(r => r.fileType && r.fileType.includes('video'));
        const hasImages = searchResults.some(r => r.fileType && r.fileType.includes('image'));
        
        // If asking about videos but search didn't find videos, get all video documents
        if (asksAboutVideos && !hasVideos) {
          console.log('📹 Question is about videos but search didn\'t find any, getting all videos...');
          const videoFiles = await searchService.getDocumentsByFileType('video');
          if (videoFiles.length > 0) {
            console.log(`✅ Found ${videoFiles.length} video files with content`);
            // Add videos to the beginning of search results
            searchResults = [...videoFiles.slice(0, 5), ...searchResults.slice(0, 5)];
          }
        }
        
        // If asking about images but search didn't find images, get all image documents
        if (asksAboutImages && !hasImages) {
          console.log('🖼️ Question is about images but search didn\'t find any, getting all images...');
          const imageFiles = await searchService.getDocumentsByFileType('image');
          if (imageFiles.length > 0) {
            console.log(`✅ Found ${imageFiles.length} image files with content`);
            searchResults = [...imageFiles.slice(0, 5), ...searchResults.slice(0, 5)];
          }
        }
      }

      if (searchResults.length === 0) {
        return {
          answer: 'No relevant documents found. Please upload documents first or sync from Google Drive.',
          sources: [],
          usedInternetSearch: false,
          usedGemini: true,
          language
        };
      }

      console.log(`📚 Building context from ${searchResults.length} unique documents...`);

      // 4. Build rich context from search results
      const context = searchResults
        .map((doc, idx) => {
          // Handle missing content field
          const content = doc.content || doc.text || '';
          
          if (!content || content.trim().length === 0) {
            console.log(`⚠️ Warning: No content for ${doc.fileName}`);
            return `[Source ${idx + 1}: ${doc.fileName} (${doc.fileType})]\n[No content available - file was processed but no text could be extracted]`;
          }
          
          // For very short content (< 50 chars), show it all
          if (content.length < 50) {
            console.log(`⚠️ Warning: Minimal content for ${doc.fileName} (${content.length} chars)`);
            return `[Source ${idx + 1}: ${doc.fileName} (${doc.fileType})]\nContent: ${content}`;
          }
          
          // For longer content, show preview
          const preview = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
          return `[Source ${idx + 1}: ${doc.fileName} (${doc.fileType})]\n${preview}`;
        })
        .join('\n\n---\n\n');

      console.log(`📝 Context built: ${context.length} characters from ${searchResults.length} sources`);

      // 5. Generate answer with Gemini
      const answer = await this.generateAnswerWithGemini(question, context, language);

      // 6. Return result with only top 5 sources for UI display
      return {
        answer,
        sources: searchResults.slice(0, 5), // Only show top 5 in UI
        usedInternetSearch: false,
        usedGemini: true,
        model: GEMINI_MODEL,
        language
      };

    } catch (error) {
      console.error('Error in generateAnswer:', error);
      throw error;
    }
  }

  /**
   * Translate answer (using Gemini)
   */
  async translateAnswer(answer, targetLanguage) {
    try {
      if (targetLanguage === 'english') {
        return answer;
      }

      console.log(`🌍 Translating to ${targetLanguage} using Gemini...`);
      
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `Translate the following text to ${targetLanguage}. Preserve all formatting including line breaks, bullet points, and code blocks:

${answer}

Translated text:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const translatedAnswer = response.text();
      
      console.log(`✅ Translation completed`);
      return translatedAnswer;
      
    } catch (error) {
      console.error('Error translating:', error);
      return answer; // Return original if translation fails
    }
  }
}

export const ragService = new RAGService();