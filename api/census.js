export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { endpoint } = req.body;
    const apiKey = process.env.VITE_CENSUS_API_KEY;
    
    // Ensure we append the key correctly depending on existing query parameters
    const fetchUrl = endpoint.includes('?') 
      ? `${endpoint}&key=${apiKey}` 
      : `${endpoint}?key=${apiKey}`;

    const response = await fetch(fetchUrl);
    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Census Proxy fetch failed' });
  }
}
