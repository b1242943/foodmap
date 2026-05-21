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

export function getFoodbanksNearby(foodbankData, countyName) {
  if (!countyName) return [];
  return foodbankData.filter(row => {
    return row.ServiceArea && row.ServiceArea.toLowerCase().includes(countyName.toLowerCase());
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
  const data = await res.json();
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

export function computeScore(counts) {
  const marketScore = Math.min(100, counts.markets * 12);
  const pantryScore = Math.min(100, counts.pantries * 20);
  const snapScore = Math.min(100, counts.snap * 25);
  const composite = Math.round(
    marketScore * 0.5 + pantryScore * 0.3 + snapScore * 0.2
  );
  return { composite, marketScore, pantryScore, snapScore };
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
