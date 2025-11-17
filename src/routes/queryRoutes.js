import express from 'express';
import { ragService } from '../services/ragService.js';

const router = express.Router();

/**
 * POST /api/query
 * Ask a question and get RAG-based answer
 */
router.post('/', async (req, res) => {
  try {
    const { question, language = 'english' } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log(`❓ Query received: "${question}" (language: ${language})`);

    // Generate answer using RAG
    const result = await ragService.generateAnswer(question, language);

    // Translate if needed
    let finalAnswer = result.answer;
    if (language !== 'english') {
      finalAnswer = await ragService.translateAnswer(result.answer, language);
    }

    res.json({
      success: true,
      question,
      answer: finalAnswer,
      sources: result.sources,
      usedInternetSearch: result.usedInternetSearch,
      language: result.language,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      message: error.message 
    });
  }
});

/**
 * POST /api/query/batch
 * Process multiple questions at once
 */
router.post('/batch', async (req, res) => {
  try {
    const { questions, language = 'english' } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Questions array is required' });
    }

    console.log(`❓ Batch query received: ${questions.length} questions`);

    const results = await Promise.all(
      questions.map(async (question) => {
        try {
          const result = await ragService.generateAnswer(question, language);
          let finalAnswer = result.answer;
          
          if (language !== 'english') {
            finalAnswer = await ragService.translateAnswer(result.answer, language);
          }

          return {
            question,
            answer: finalAnswer,
            sources: result.sources,
            usedInternetSearch: result.usedInternetSearch,
            success: true
          };
        } catch (error) {
          return {
            question,
            error: error.message,
            success: false
          };
        }
      })
    );

    res.json({
      success: true,
      count: results.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Batch query error:', error);
    res.status(500).json({ 
      error: 'Failed to process batch queries',
      message: error.message 
    });
  }
});

export { router as queryRouter };