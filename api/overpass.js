export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Translate the clean JSON from the frontend into the URL-encoded string Overpass demands
    const overpassBody = 'data=' + encodeURIComponent(req.body.query);
    
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
