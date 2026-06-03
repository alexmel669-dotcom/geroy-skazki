import { setCors } from './_middleware/cors.js';

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
    
    console.log(`📊 Analytics: ${events.length} events received`);
    
    return res.status(200).json({ 
      success: true, 
      processed: events.length 
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
