import { searchService } from './searchService.js';
import { gcpEmbeddingService } from './gcp/gcpEmbeddingService.js';
import { gcpChatService } from './gcp/gcpChatService.js';
import { gcpTranslationService } from './gcp/gcpTranslationService.js';

class RAGService {
  
  /**
   * Calculate similarity between two strings (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Extract file name from question if user mentions a specific file
   */
  extractFileName(question) {
    const patterns = [
      /(?:in|about|from|explain|describe|summarize|tell me about)\s+(?:the\s+)?(?:file|document|pdf|content in)?\s*["""]?([^"""\n]+?\.(pdf|docx|xlsx|pptx|txt|mp4|mov|avi|png|jpg|jpeg))["""]?/i,
      /["""]([^"""\n]+?\.(pdf|docx|xlsx|pptx|txt|mp4|mov|avi|png|jpg|jpeg))["""]?/i,
      /([A-Z][^.]*?\.(pdf|docx|xlsx|pptx|txt|mp4|mov|avi|png|jpg|jpeg))/i
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match) {
        let fileName = match[1].trim();
        fileName = fileName.replace(/["""]/g, '');
        fileName = fileName.replace(/^(the |file |document |content in |about )/i, '');
        return fileName;
      }
    }

    return null;
  }

  /**
   * Main method to generate answers - 100% GCP with web search fallback
   */
  async generateAnswer(question, language = 'english', embeddingService = null, searchServiceParam = null) {
    try {
      console.log(`💬 Generating answer for: "${question}"`);
      console.log(`🔧 Using: Vertex AI (embeddings) + Vertex AI Gemini (chat)`);

      // Use passed services or defaults
      const embedSvc = embeddingService || gcpEmbeddingService;
      const searchSvc = searchServiceParam || searchService;

      // 1. Detect question language using Cloud Translation
      const questionLanguage = await gcpTranslationService.detectLanguage(question);
      console.log(`🌍 Question language: ${gcpTranslationService.getLanguageName(questionLanguage)}`);

      // 2. Translate question to English if needed
      let searchQuestion = question;
      let translated = false;
      
      if (questionLanguage !== 'en') {
        console.log(`🌐 Translating question to English for search...`);
        const translationResult = await gcpTranslationService.translateToEnglish(question, questionLanguage);
        searchQuestion = translationResult.translatedText;
        translated = translationResult.translated;
        console.log(`✅ Translated question: "${searchQuestion}"`);
      }

      // 3. Check if user is asking about a specific file
      const fileNameMatch = this.extractFileName(question);
      if (fileNameMatch) {
        console.log(`📄 User asking about specific file: ${fileNameMatch}`);
      }

      // Check if question is about specific file types
      const questionLower = searchQuestion.toLowerCase();
      const asksAboutVideos = questionLower.includes('video') || questionLower.includes('mp4') || questionLower.includes('recording');
      const asksAboutImages = questionLower.includes('image') || questionLower.includes('png') || questionLower.includes('jpg') || questionLower.includes('picture');

      // 4. Generate embedding using Vertex AI
      console.log(`🔢 Generating embedding with Vertex AI...`);
      const questionEmbedding = await embedSvc.generateEmbedding(searchQuestion);
      
      // 5. Search for relevant documents
      let searchResults = await searchSvc.searchDocuments(questionEmbedding, { top: 10 });

      // 6. Filter to specific file if mentioned
      if (fileNameMatch && searchResults.length > 0) {
        const specificFileResults = searchResults.filter(r => {
          const doc = r.document || r;
          if (!doc.fileName) return false;
          
          const fileName = doc.fileName.toLowerCase();
          const mentioned = fileNameMatch.toLowerCase();
          
          const fileNameWithoutExt = fileName.replace(/\.(pdf|docx|xlsx|pptx|txt|mp4|mov|avi|png|jpg|jpeg)$/i, '');
          const mentionedWithoutExt = mentioned.replace(/\.(pdf|docx|xlsx|pptx|txt|mp4|mov|avi|png|jpg|jpeg)$/i, '');
          
          return fileNameWithoutExt.includes(mentionedWithoutExt) || 
                 mentionedWithoutExt.includes(fileNameWithoutExt) ||
                 this.calculateSimilarity(fileNameWithoutExt, mentionedWithoutExt) > 0.7;
        });
        
        if (specificFileResults.length > 0) {
          console.log(`✅ Filtered to specific file: Found ${specificFileResults.length} chunks from "${fileNameMatch}"`);
          searchResults = specificFileResults;
        } else {
          console.log(`⚠️ File "${fileNameMatch}" not found in search results, using all results`);
        }
      }

      // 7. Handle file type specific queries
      if (searchResults.length > 0) {
        const hasVideos = searchResults.some(r => {
          const doc = r.document || r;
          return doc.fileType && doc.fileType.includes('video');
        });
        const hasImages = searchResults.some(r => {
          const doc = r.document || r;
          return doc.fileType && doc.fileType.includes('image');
        });
        
        if (asksAboutVideos && !hasVideos) {
          console.log('📹 Question is about videos but search didn\'t find any, getting all videos...');
          const videoFiles = await searchSvc.getDocumentsByFileType('video');
          if (videoFiles.length > 0) {
            console.log(`✅ Found ${videoFiles.length} video files with content`);
            searchResults = [...videoFiles.slice(0, 5), ...searchResults.slice(0, 5)];
          }
        }
        
        if (asksAboutImages && !hasImages) {
          console.log('🖼️ Question is about images but search didn\'t find any, getting all images...');
          const imageFiles = await searchSvc.getDocumentsByFileType('image');
          if (imageFiles.length > 0) {
            console.log(`✅ Found ${imageFiles.length} image files with content`);
            searchResults = [...imageFiles.slice(0, 5), ...searchResults.slice(0, 5)];
          }
        }
      }

      if (searchResults.length === 0) {
        return {
          answer: 'No relevant documents found. Please upload documents first or sync from Google Drive.',
          source: 'system',
          sources: [],
          usedGemini: true,
          usedInternetSearch: false,
          model: 'gemini-2.0-flash-exp',
          language: questionLanguage
        };
      }

      console.log(`📚 Building context from ${searchResults.length} unique documents...`);

      // 8. Build context from search results
      const context = searchResults
        .map((result, idx) => {
          const doc = result.document || result;
          const content = doc.content || doc.text || '';
          const fileName = doc.fileName || 'Unknown';
          const fileType = doc.fileType || 'unknown';
          
          if (!content || content.trim().length === 0) {
            console.log(`⚠️ Warning: No content for ${fileName}`);
            return `[Source ${idx + 1}: ${fileName} (${fileType})]\n[No content available - file was processed but no text could be extracted]`;
          }
          
          if (content.length < 50) {
            console.log(`⚠️ Warning: Minimal content for ${fileName} (${content.length} chars)`);
            return `[Source ${idx + 1}: ${fileName} (${fileType})]\nContent: ${content}`;
          }
          
          const preview = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
          return `[Source ${idx + 1}: ${fileName} (${fileType})]\n${preview}`;
        })
        .join('\n\n---\n\n');

      console.log(`📝 Context built: ${context.length} characters from ${searchResults.length} sources`);

      // 9. Generate answer with Gemini (in English) - with web search fallback
      console.log(`🤖 Generating answer with Gemini...`);
      
      // Get unique sources for web search saving
      const sources = searchResults.slice(0, 5).map(r => r.document || r);
      
      // Call chatService with web search capability
      const answerResult = await gcpChatService.generateAnswer(
        searchQuestion, 
        context,
        [], // conversation history
        sources, // sources for relevance check
        embedSvc, // for saving web results
        searchSvc // for indexing web results
      );

      // Extract answer text (handle both string and object responses)
      let answerText;
      let answerSource = 'documents';
      
      if (typeof answerResult === 'object' && answerResult.answer) {
        answerText = answerResult.answer;
        answerSource = answerResult.source || 'documents';
      } else {
        answerText = answerResult;
      }

      // 10. Translate answer back to user's language if needed
      let finalAnswer = answerText;
      if (questionLanguage !== 'en') {
        console.log(`🌐 Translating answer to ${gcpTranslationService.getLanguageName(questionLanguage)}...`);
        finalAnswer = await gcpTranslationService.translateFromEnglish(answerText, questionLanguage);
        console.log(`✅ Answer translated to user's language`);
      }

      // 11. Return result with sources properly formatted
      return {
        answer: finalAnswer,
        source: answerSource, // 'documents' or 'web_search'
        sources: sources,
        usedGemini: true,
        usedInternetSearch: answerSource === 'web_search',
        model: 'gemini-2.0-flash-exp',
        language: questionLanguage,
        translatedFrom: questionLanguage !== 'en' ? 'en' : null,
        detectedLanguage: questionLanguage,
        questionTranslated: translated
      };

    } catch (error) {
      console.error('Error in generateAnswer:', error);
      throw error;
    }
  }
}

export const ragService = new RAGService();