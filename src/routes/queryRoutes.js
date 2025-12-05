import { answerQuestion } from '../services/queryService.js';

router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const result = await answerQuestion(question);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error in query endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});