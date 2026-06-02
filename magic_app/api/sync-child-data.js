import { setCors } from './_cors.js';
import { verifyAuth } from './_auth.js';
import { checkRateLimit, getRateLimitKey } from './_rateLimit.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Rate limiting
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit('sync_' + clientKey, 10, 60000)) {
    return res.status(429).json({ error: 'Too many sync requests' });
  }
  
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { 
      childName, 
      childAge, 
      character,
      fearStats, 
      bravery, 
      mood, 
      hunger, 
      energy,
      conversationHistory 
    } = req.body;
    
    if (!childName) {
      return res.status(400).json({ error: 'childName is required' });
    }
    
    // В реальном проекте: сохранение в MongoDB/PostgreSQL
    console.log('💾 Sync for user:', user.userId);
    console.log('  Child:', childName, childAge, 'лет');
    console.log('  Character:', character);
    console.log('  Stats:', { bravery, mood, hunger, energy });
    console.log('  Fears:', fearStats);
    console.log('  History length:', conversationHistory?.length || 0);
    
    // Эмулируем задержку сети в development
    if (process.env.NODE_ENV === 'development') {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return res.status(200).json({ 
      success: true,
      syncedAt: new Date().toISOString(),
      stats: {
        bravery,
        mood,
        hunger,
        energy
      }
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: 'Sync failed' });
  }
}
