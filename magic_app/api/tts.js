import { setCors } from './_middleware/cors.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Заглушка — в реальном проекте здесь запрос к Yandex SpeechKit
    return res.status(200).json({ 
      audioUrl: null,
      message: 'TTS service available'
    });

  } catch (error) {
    console.error('TTS error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
