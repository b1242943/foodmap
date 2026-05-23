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

    // 2. Safely parse request body whether stringified or object
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const queryPath = body?.queryPath;

    if (typeof queryPath !== 'string' || !queryPath) {
      throw new Error('No valid queryPath string provided in the request body from the frontend.');
    }

    // 3. Sanitization (Whitelist allowed characters)
    if (!/^[a-zA-Z0-9-_\/\?=\.:\*\%&]+$/.test(queryPath)) {
      throw new Error('Invalid queryPath format. Contains disallowed characters.');
    }

    // 4. Strip any accidental base URLs/proxies the frontend might have sent
    let cleanPath = queryPath.replace(/^(https?:\/\/[^\/]+)?\/api\/census/, '');
    
    // Ensure it has a leading slash to avoid joining like "/data2022/..."
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    // 5. Verify Env Key (Removed VITE_ prefix)
    const apiKey = process.env.CENSUS_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Census API Key');
    }

    const baseUrl = 'https://api.census.gov/data';
    const fetchUrl = baseUrl + cleanPath + (cleanPath.includes('?') ? '&' : '?') + 'key=' + apiKey;

    // Phase 3 Logging
    console.log("Attempting to fetch:", fetchUrl);

    // 4. Fetch as raw text first (safeguard against HTML error crashes)
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
      }
    });
    const rawText = await response.text(); 

    if (!response.ok) {
      throw new Error(`API Status ${response.status}: ${rawText.substring(0, 200)}`);
    }

    // 5. Parse and return
    try {
      const data = JSON.parse(rawText);
      return res.status(200).json(data);
    } catch (err) {
      throw new Error(`Received HTML/Text instead of JSON. Snippet: ${rawText.substring(0, 200)}`);
    }

  } catch (error) {
    res.status(500).json({ error: 'Census Proxy failed', details: error.message });
  }
}
