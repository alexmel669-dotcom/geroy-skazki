import { setCors } from './_cors.js';
import { verifyAuth } from './_auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array required' });
    }
    
    // В реальном проекте: сохранение в БД (ClickHouse, PostgreSQL и т.д.)
    // Сейчас просто логируем
    if (process.env.NODE_ENV !== 'production') {
      events.forEach(event => {
        console.log('📊 Analytics:', {
          type: event.event_type,
          userId: event.user_id?.substring(0, 10) + '...',
          child: event.child_name,
          timestamp: event.event_data?.timestamp
        });
      });
    }
    
    // Агрегация в памяти для демо
    const summary = {
      total: events.length,
      types: events.reduce((acc, e) => {
        acc[e.event_type] = (acc[e.event_type] || 0) + 1;
        return acc;
      }, {}),
      uniqueUsers: new Set(events.map(e => e.user_id)).size,
      timestamp: new Date().toISOString()
    };
    
    return res.status(200).json({ 
      success: true, 
      processed: events.length,
      summary 
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
