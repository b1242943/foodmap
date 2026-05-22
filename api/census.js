export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Safely parse the body whether it arrives as a string or an object
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const endpoint = body?.endpoint;

    if (!endpoint) {
      throw new Error('No endpoint provided in the request body from the frontend.');
    }

    // 2. Verify the Environment Variable actually exists in the runtime
    const apiKey = process.env.VITE_CENSUS_API_KEY;
    if (!apiKey) {
      throw new Error('Vercel backend cannot find the VITE_CENSUS_API_KEY environment variable.');
    }

    const fetchUrl = endpoint.includes('?') 
      ? `${endpoint}&key=${apiKey}` 
      : `${endpoint}?key=${apiKey}`;

    const response = await fetch(fetchUrl);

    // 3. If the government server fails, read it as text so it doesn't crash the JSON parser
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Census API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    // 4. Send the EXACT error message back to the frontend console
    res.status(500).json({ error: 'Census Proxy failed', details: error.message });
  }
}
