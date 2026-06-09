export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { context, message, timestamp, appVersion } = req.body;
    console.error(`📋 [ERROR LOG] ${timestamp} | ${context} | v${appVersion}`);
    console.error(`   ${message}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Log error handler failed:', error);
    return res.status(500).json({ error: 'Logging failed' });
  }
}
