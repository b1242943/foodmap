export default async function handler(req, res) {
  const allowedOrigins = ['https://foodmap-ruby.vercel.app', 'http://localhost:3000'];
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

    // 2. Type Checking — defensively handle req.body arriving as a raw string
    // rather than a pre-parsed object (matches the same guard in api/census.js).
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const query = body?.query;
    if (typeof query !== 'string' || !query) {
      return res.status(400).json({ error: 'No valid query string provided in the request body.' });
    }

    // 3. Hard 8-second upstream timeout — stays under Vercel free-tier's 10s limit.
    //    Overpass can stall on geographically isolated peninsulas (e.g. Far Rockaway 11691).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const overpassBody = 'data=' + encodeURIComponent(query);

    let response;
    try {
      response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'FoodMap-CivicTech/1.0 (foodmap-ruby.vercel.app)'
        },
        body: overpassBody,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      // AbortError means our 8s timeout fired before Overpass responded.
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({
          error: 'UPSTREAM_TIMEOUT',
          message: 'The map data service took too long to respond for this location. Please try a smaller search area.',
        });
      }
      throw fetchErr; // Re-throw unexpected network errors
    } finally {
      clearTimeout(timeoutId);
    }

    // 4. Read as raw text first — Overpass returns HTML error pages (not JSON) when overloaded.
    //    Calling .json() directly on an HTML body throws a cryptic SyntaxError.
    const rawText = await response.text();

    if (!response.ok) {
      // Overpass uses 429 for rate limiting and 504 for timeouts
      const clientFacing = response.status === 429
        ? 'The map data service is temporarily rate-limited. Please wait 30 seconds and try again.'
        : 'The map data service returned an error for this location.';
      return res.status(response.status).json({
        error: 'UPSTREAM_ERROR',
        message: clientFacing,
        upstreamStatus: response.status,
      });
    }

    // 5. Safely parse — guard against HTML slipping through with a 200 status
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('[overpass] Non-JSON response snippet:', rawText.substring(0, 200));
      return res.status(502).json({
        error: 'INVALID_UPSTREAM_RESPONSE',
        message: 'Received an unexpected response from the map data service.',
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('[overpass] Unhandled error:', error.message);
    return res.status(500).json({
      error: 'PROXY_ERROR',
      message: 'An internal error occurred. Please try again.',
    });
  }
}
