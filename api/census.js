export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Safely parse request body whether stringified or object
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const queryPath = body?.queryPath;

    if (!queryPath) {
      throw new Error('No queryPath provided in the request body from the frontend.');
    }

    // 2. Strip any accidental base URLs/proxies the frontend might have sent
    let cleanPath = queryPath.replace(/^(https?:\/\/[^\/]+)?\/api\/census/, '');
    
    // Ensure it has a leading slash to avoid joining like "/data2022/..."
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    // 3. Verify Env Key
    const apiKey = process.env.VITE_CENSUS_API_KEY;
    if (!apiKey) {
      throw new Error('Vercel backend cannot find the VITE_CENSUS_API_KEY environment variable.');
    }

    const baseUrl = 'https://api.census.gov/data';
    const fetchUrl = (baseUrl + cleanPath).includes('?') 
      ? `${baseUrl}${cleanPath}&key=${apiKey}` 
      : `${baseUrl}${cleanPath}?key=${apiKey}`;

    // Phase 3 Logging
    console.log("Attempting to fetch:", fetchUrl);

    // 4. Fetch as raw text first (safeguard against HTML error crashes)
    const response = await fetch(fetchUrl);
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
