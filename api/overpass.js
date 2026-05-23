export default async function handler(req, res) {
  const allowedOrigins = ['https://foodmap-ruby.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Payload Size Limit
    if (req.body && JSON.stringify(req.body).length > 5000) {
      return res.status(413).json({ error: 'Payload Too Large' });
    }

    // 2. Type Checking
    const query = req.body?.query;
    if (typeof query !== 'string' || !query) {
      throw new Error('No valid query string provided in the request body.');
    }

    // Translate the clean JSON from the frontend into the URL-encoded string Overpass demands
    const overpassBody = 'data=' + encodeURIComponent(query);
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'FoodMap-CivicTech/1.0 (foodmap-ruby.vercel.app)'
      },
      body: overpassBody
    });
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy fetch failed' });
  }
}
