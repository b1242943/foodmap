export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    let endpoint = body?.endpoint;

    // 1. Auto-correct if the frontend accidentally sent the relative proxy path
    if (endpoint && endpoint.startsWith('/api/census')) {
      endpoint = endpoint.replace('/api/census', 'https://api.census.gov/data');
    }

    if (!endpoint || !endpoint.startsWith('http')) {
      throw new Error(`Invalid endpoint provided: ${endpoint}`);
    }

    const apiKey = process.env.VITE_CENSUS_API_KEY;
    const fetchUrl = endpoint.includes('?') 
      ? `${endpoint}&key=${apiKey}` 
      : `${endpoint}?key=${apiKey}`;

    // 2. Fetch and read as RAW TEXT first to prevent JSON crashes
    const response = await fetch(fetchUrl);
    const rawText = await response.text(); 

    if (!response.ok) {
      throw new Error(`API Status ${response.status}: ${rawText.substring(0, 200)}`);
    }

    // 3. Safely attempt to parse the text into JSON
    try {
      const data = JSON.parse(rawText);
      return res.status(200).json(data);
    } catch (err) {
      throw new Error(`Received HTML instead of JSON. HTML Snippet: ${rawText.substring(0, 200)}`);
    }

  } catch (error) {
    res.status(500).json({ error: 'Census Proxy failed', details: error.message });
  }
}
