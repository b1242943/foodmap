import Papa from "papaparse";

// Load and cache the SNAP CSV once
let snapDataCache = null;
export async function loadSnapCSV() {
  if (snapDataCache) return snapDataCache;
  return new Promise((resolve, reject) => {
    Papa.parse("/snap_retailers.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        snapDataCache = results.data;
        resolve(snapDataCache);
      },
      error: reject,
    });
  });
}

let feedingAmericaCache = null;
export async function loadFeedingAmericaCSV() {
  if (feedingAmericaCache) return feedingAmericaCache;
  return new Promise((resolve, reject) => {
    Papa.parse("/feeding_america_foodbanks.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        feedingAmericaCache = results.data;
        resolve(feedingAmericaCache);
      },
      error: reject,
    });
  });
}

// Hard cap on how far an offline/local fallback record (SNAP, food pantries) may be
// from the search origin, regardless of bbox/county matching upstream. Prevents a loose
// zip/county match (e.g. Far Rockaway 11693 matching a Manhattan "New York County" pantry)
// from ever reaching the map.
export const MAX_LOCAL_RADIUS_MILES = 5;

export function getSnapNearby(snapData, lat, lon, radiusMeters = 5000, bbox = null, zipMatch = null) {
  const R = 6371000;
  return snapData.filter((row) => {
    const rlat = parseFloat(row.Latitude);
    const rlon = parseFloat(row.Longitude);
    if (isNaN(rlat) || isNaN(rlon)) return false;

    // Exact strict filtering if the user searched for a zip code
    if (zipMatch) {
      const rowZip = (row.Zip_Code || "").toString().trim().slice(0, 5);
      if (rowZip !== zipMatch) return false;
    }

    if (parseFloat(haversineDistance(lat, lon, rlat, rlon)) > MAX_LOCAL_RADIUS_MILES) return false;

    if (bbox) {
      if (rlat < bbox[0] || rlat > bbox[2] || rlon < bbox[1] || rlon > bbox[3]) return false;
      return true;
    }
    const dLat = ((rlat - lat) * Math.PI) / 180;
    const dLon = ((rlon - lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((rlat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return dist <= radiusMeters;
  });
}

export function getFoodbanksNearby(foodbankData, countyName, lat, lon) {
  if (!countyName) return [];
  return foodbankData.filter(row => {
    const matchesCounty = row.ServiceArea && row.ServiceArea.toLowerCase().includes(countyName.toLowerCase());
    if (!matchesCounty) return false;

    const rlat = parseFloat(row.Latitude);
    const rlon = parseFloat(row.Longitude);
    if (isNaN(rlat) || isNaN(rlon)) return false;

    return parseFloat(haversineDistance(lat, lon, rlat, rlon)) <= MAX_LOCAL_RADIUS_MILES;
  });
}

let overpassNodeCache = new Map();

export async function fetchOverpassData(lat, lon, bboxStr = null, radius = 5000) {
  const filter = bboxStr ? `(${bboxStr})` : `(around:${radius},${lat},${lon})`;
  const query = `[out:json][timeout:90];(
    nwr["shop"="supermarket"]${filter};
    nwr["shop"="grocery"]${filter};
    nwr["shop"="greengrocer"]${filter};
    nwr["amenity"="marketplace"]${filter};
    nwr["payment:ebt"="yes"]${filter};
    nwr["payment:snap"="yes"]${filter};
    nwr["payment:food_stamps"="yes"]${filter};
  );out geom;`;

  const res = await fetch('/api/overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  // Read the response body once, regardless of status, to get the structured error payload.
  let data;
  try {
    data = await res.json();
  } catch {
    // The proxy itself returned something unparseable (e.g., HTML error page on 504/500/429)
    // Preserve the HTTP status code and throw an appropriate typed error.
    const err = new Error(res.status === 504 ? 'The map data service timed out.' : 'Could not reach the map data service.');
    err.status = res.status;
    err.code = res.status === 504 ? 'UPSTREAM_TIMEOUT' : 'NETWORK_ERROR';
    throw err;
  }

  // If the proxy returned a non-2xx status, surface the human-readable message it provides.
  // This is the fix for the silent "Database error" on isolated ZIP codes like 11691.
  if (!res.ok) {
    const userMessage = data?.message || 'Failed to load map data for this location.';
    const errorCode = data?.error || 'UNKNOWN_ERROR';
    const err = new Error(userMessage);
    err.code = errorCode;
    err.status = res.status;
    throw err;
  }

  const elements = data.elements || [];
  const processed = [];
  elements.forEach(el => {
    if (overpassNodeCache.has(el.id)) {
      processed.push(overpassNodeCache.get(el.id));
      return;
    }
    const t = el.tags || {};
    let address = t["addr:full"] || ((t["addr:street"] && t["addr:city"]) ? `${t["addr:street"]}, ${t["addr:city"]}` : "");
    if (!address) {
      address = t.name || "";
    }
    el.processedAddress = address;
    overpassNodeCache.set(el.id, el);
    processed.push(el);
  });

  return processed;
}

export function classifyNode(node) {
  const t = node.tags || {};

  if (
    t["payment:ebt"] === "yes" ||
    t["payment:snap"] === "yes" ||
    t["payment:food_stamps"] === "yes"
  ) {
    return "snap";
  }

  return "markets";
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

// ---------------------------------------------------------------------------
// NYC Open Data: Farmers Markets + SNAP-Ed Health Bucks Integration
// ---------------------------------------------------------------------------

/**
 * Geographic bounding box for NYC.
 * Any record outside this box is an open-data anomaly ("null island", phantom
 * coordinates, etc.) and will be rejected during load to prevent Leaflet crashes.
 * Source: NYC DoITT authoritative borough boundaries.
 */
export const NYC_BOUNDS = {
  minLat: 40.45,
  maxLat: 41.0,
  minLon: -74.25,
  maxLon: -73.70,
};

// DOHMH's official feed (NYC Open Data 8vwk-6iz2) has no per-market Health Bucks match
// rate — only a plain "Accepts EBT" Yes/No. Per product decision, every EBT-accepting
// market is treated as Health Bucks-eligible under one flat citywide multiplier, matching
// how the program is actually described to shoppers ("$2 Health Bucks per $1 SNAP spent").
export const HEALTH_BUCKS_UNIFORM_MULTIPLIER = 2.0;

/**
 * Loads, cleans, and caches the official NYC Farmers Markets CSV (mirrors loadSnapCSV's
 * dynamic CSV-loading architecture). Served as a static snapshot from /public/, same as
 * snap_retailers.csv, so a live search never depends on an external gov domain responding.
 *
 * The feed is an annual historical snapshot (one row per market per year since 2009), so
 * rows are filtered down to the latest year present before any bounds/field validation.
 * @returns {Promise<Array>}
 */
let farmersMarketsCSVCache = null;
export async function loadFarmersMarketsCSV() {
  if (farmersMarketsCSVCache) return farmersMarketsCSVCache;
  return new Promise((resolve, reject) => {
    Papa.parse("/nyc_farmers_markets.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;

        const latestYear = rows.reduce((max, r) => {
          const y = parseInt(r.Year, 10);
          return isNaN(y) ? max : Math.max(max, y);
        }, 0);

        const rejected = [];
        const cleaned = rows
          .filter((r) => parseInt(r.Year, 10) === latestYear)
          .map((r) => {
            const acceptsEbt = (r["Accepts EBT"] || "").trim().toLowerCase() === "yes";
            return {
              name: (r["Market Name"] || "").trim(),
              borough: (r.Borough || "").trim(),
              address: (r["Street Address"] || "").trim(),
              lat: parseFloat(r.Latitude),
              lon: parseFloat(r.Longitude),
              accepts_ebt: acceptsEbt,
              accepts_health_bucks: acceptsEbt,
              health_bucks_multiplier: acceptsEbt ? HEALTH_BUCKS_UNIFORM_MULTIPLIER : 1.0,
              season: (r["Open Year-Round"] || "").trim().toLowerCase() === "yes" ? "Year-round" : (r["Season Dates"] || "").trim(),
              days_hours: [r["Days of Operation"], r["Hours of Operations"]].filter(Boolean).join(" "),
            };
          })
          // Reject open-data anomalies ("null island", phantom coordinates, missing
          // names) against NYC's authoritative bounding box before they ever reach Leaflet.
          .filter((market) => {
            const valid =
              !isNaN(market.lat) && !isNaN(market.lon) &&
              market.lat >= NYC_BOUNDS.minLat && market.lat <= NYC_BOUNDS.maxLat &&
              market.lon >= NYC_BOUNDS.minLon && market.lon <= NYC_BOUNDS.maxLon &&
              market.name !== "";
            if (!valid) rejected.push(market.name || "[unnamed]");
            return valid;
          });

        if (rejected.length > 0) {
          console.warn(`[FoodMap] Rejected ${rejected.length} farmers market rows outside NYC bounds or missing required fields:`, rejected);
        }

        farmersMarketsCSVCache = cleaned;
        resolve(cleaned);
      },
      error: reject,
    });
  });
}

/**
 * Filters cleaned farmers market records to those within the search area.
 * @param {Array}      marketsData  - Output of loadFarmersMarketsCSV()
 * @param {number}     lat          - Search origin latitude
 * @param {number}     lon          - Search origin longitude
 * @param {number}     radiusMeters - Radius in meters
 * @param {Array|null} bbox         - [southLat, westLon, northLat, eastLon] or null
 * @returns {Array}
 */
export function getFarmersMarketsNearby(marketsData, lat, lon, radiusMeters = 5000, bbox = null) {
  const R = 6371000;
  return marketsData.filter((market) => {
    const rlat = parseFloat(market.lat);
    const rlon = parseFloat(market.lon);
    if (isNaN(rlat) || isNaN(rlon)) return false;

    if (bbox) {
      return rlat >= bbox[0] && rlat <= bbox[2] && rlon >= bbox[1] && rlon <= bbox[3];
    }
    const dLat = ((rlat - lat) * Math.PI) / 180;
    const dLon = ((rlon - lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((rlat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return dist <= radiusMeters;
  });
}

/**
 * Computes the Health Bucks transit cost offset for the Time & Travel Matrix.
 *
 * A SNAP-Ed Health Bucks market doubles purchasing power on fresh produce
 * ($2 Health Bucks per $1 SNAP spent, up to $10/visit). This real financial
 * benefit offsets the cost-burden of a longer transit trip. We model it as a
 * reduction in "effective walk time."
 *
 * Hard constraints (Deterministic Offset Protocol):
 *   1. Offset NEVER exceeds 15 minutes — no unreasonably distant recommendations.
 *   2. effectiveWalkTime NEVER goes below 0.
 *   3. If no Health Bucks market is nearby (null), offset = 0.
 *   4. Offset = min(rawWalkTime * (multiplier - 1.0), 15 minutes).
 *
 * @param {number}      rawWalkTime   - Unadjusted walk time in minutes
 * @param {number|null} nearestHBDist - Miles to nearest Health Bucks market, or null
 * @param {number}      multiplier    - health_bucks_multiplier from the nearest HB market
 * @returns {{ effectiveWalkTime: number, offsetApplied: number }}
 */
export const HEALTH_BUCKS_MAX_OFFSET_MINUTES = 15;

export function computeHealthBucksOffset(rawWalkTime, nearestHBDist, multiplier = 1.0) {
  if (nearestHBDist === null || multiplier <= 1.0) {
    return { effectiveWalkTime: rawWalkTime, offsetApplied: 0 };
  }
  const rawOffset = rawWalkTime * (multiplier - 1.0);
  const offsetApplied = Math.min(rawOffset, HEALTH_BUCKS_MAX_OFFSET_MINUTES);
  const effectiveWalkTime = Math.max(0, Math.round(rawWalkTime - offsetApplied));
  return { effectiveWalkTime, offsetApplied: Math.round(offsetApplied) };
}
