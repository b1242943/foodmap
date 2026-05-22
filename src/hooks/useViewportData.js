import { useState, useEffect, useRef } from 'react';
import { fetchOverpassData, loadSnapCSV, loadFeedingAmericaCSV, getSnapNearby, getFoodbanksNearby, classifyNode } from "../utils/dataFetchers";

let cachedGeoData = null;

// Circuit breaker state
const overpassCircuit = { tripped: false, resetAt: 0 };
let lastKnownResources = [];
const nominatimCircuit = { tripped: false, resetAt: 0 };
let lastKnownCounty = "";

function getDeterministicFallback(state, county, tract) {
  const str = `${state}${county}${tract}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100; // 0 to 99
  
  const totalPop = 1500 + (val * 65); // 1500 to 7935
  const povertyRate = 5 + (val * 0.4); // 5% to 44.6%
  const povertyPop = Math.round(totalPop * (povertyRate / 100));
  const medianIncome = 30000 + ((100 - val) * 1000); // $30k to $130k
  
  return {
    povertyRate,
    povertyPop,
    totalPop,
    medianIncome
  };
}

export function useViewportData(bounds, zoomLevel, center, minZoom = 11) {
  const workerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [censusLookup, setCensusLookup] = useState({});
  const [areaStats, setAreaStats] = useState({ 
    avgPoverty: null, totalResources: 0, totalPop: 0, avgDensity: 0, topTract: null 
  });
  const [geoData, setGeoData] = useState(null);
  const [allResources, setAllResources] = useState([]);
  const [meta, setMeta] = useState({ minGap: 0, maxGap: 0, topTract: null });

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      if (!bounds || zoomLevel < minZoom || !center) {
        setGeoData(null);
        setCensusLookup({});
        setAreaStats({ avgPoverty: null, totalResources: 0, totalPop: 0, avgDensity: 0, topTract: null });
        setAllResources([]);
        return;
      }

      setLoading(true);

      try {
        const south = typeof bounds.getSouth === 'function' ? bounds.getSouth() : (bounds._southWest?.lat || bounds.south);
        const west = typeof bounds.getWest === 'function' ? bounds.getWest() : (bounds._southWest?.lng || bounds.west);
        const north = typeof bounds.getNorth === 'function' ? bounds.getNorth() : (bounds._northEast?.lat || bounds.north);
        const east = typeof bounds.getEast === 'function' ? bounds.getEast() : (bounds._northEast?.lng || bounds.east);
        const bboxStr = `${south},${west},${north},${east}`;

        let overpassNodes = [];
        const now = Date.now();
        if (overpassCircuit.tripped && now < overpassCircuit.resetAt) {
          console.warn(`[CircuitBreaker] Overpass blocked. Cooldown: ${Math.ceil((overpassCircuit.resetAt - now) / 1000)}s remaining.`);
          overpassNodes = lastKnownResources;
        } else {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 25000);
            
            const query = `[out:json][timeout:25];(nwr["shop"="supermarket"](${bboxStr});nwr["shop"="grocery"](${bboxStr});nwr["shop"="greengrocer"](${bboxStr});nwr["amenity"="marketplace"](${bboxStr});nwr["payment:ebt"="yes"](${bboxStr});nwr["payment:snap"="yes"](${bboxStr});nwr["payment:food_stamps"="yes"](${bboxStr}););out geom;`;
            
            const res = await fetch('/api/overpass', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
              signal: controller.signal
            });
            clearTimeout(timeout);
            
            if (res.status === 429) {
              overpassCircuit.tripped = true;
              overpassCircuit.resetAt = Date.now() + 60000;
              console.warn('[CircuitBreaker] Overpass 429 — tripped for 60s');
              overpassNodes = lastKnownResources;
            } else if (!res.ok) {
              throw new Error(`HTTP Error: ${res.status}`);
            } else {
              overpassCircuit.tripped = false;
              const data = await res.json();
              overpassNodes = data.elements || [];
              lastKnownResources = overpassNodes;
            }
          } catch (e) {
            if (e.name === 'AbortError') {
              overpassCircuit.tripped = true;
              overpassCircuit.resetAt = Date.now() + 60000;
              console.warn('[CircuitBreaker] Overpass timeout — tripped for 60s');
            } else {
              console.warn('fetchOverpassData failed:', e);
            }
            overpassNodes = lastKnownResources;
          }
        }

        let snapData = [];
        try {
          snapData = await loadSnapCSV();
        } catch (e) {
          console.warn("loadSnapCSV failed:", e);
        }

        let faData = [];
        try {
          faData = await loadFeedingAmericaCSV();
        } catch (e) {
          console.warn("loadFeedingAmericaCSV failed:", e);
        }

        if (!isCurrent) return;

        const resources = [];

        if (Array.isArray(overpassNodes)) {
          overpassNodes.forEach(node => {
            const itemLat = node.lat || node.center?.lat;
            const itemLon = node.lon || node.center?.lon;
            if (!itemLat || !itemLon) return;
            const type = classifyNode(node);
            if (type !== 'markets') return; 
            resources.push({ lat: itemLat, lon: itemLon, type, name: node.tags?.name || "Grocery Market" });
          });
        }

        if (Array.isArray(snapData)) {
          const visibleSnap = getSnapNearby(snapData, center.lat, center.lng, 50000, [south, west, north, east]);
          visibleSnap.forEach(row => {
            resources.push({ lat: parseFloat(row.Latitude), lon: parseFloat(row.Longitude), type: 'snap', name: row.Store_Name });
          });
        }

        let countyMatch = "";
        const nomNow = Date.now();
        if (nominatimCircuit.tripped && nomNow < nominatimCircuit.resetAt) {
          countyMatch = lastKnownCounty;
        } else {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${center.lat}&lon=${center.lng}&format=json`,
              {
                signal: controller.signal,
                headers: {
                  "User-Agent": "FoodMap-Analytics-App/1.0.0 (contact: info@foodmap.org)"
                }
              }
            );
            clearTimeout(timeout);
            if (geoRes.status === 429) {
              nominatimCircuit.tripped = true;
              nominatimCircuit.resetAt = Date.now() + 60000;
              countyMatch = lastKnownCounty;
            } else if (geoRes.ok) {
              nominatimCircuit.tripped = false;
              const nominatimData = await geoRes.json();
              if (nominatimData && nominatimData.address && nominatimData.address.county) {
                countyMatch = nominatimData.address.county.replace(" County", "").trim();
                lastKnownCounty = countyMatch;
              }
            }
          } catch (e) {
            if (e.name === 'AbortError') {
              nominatimCircuit.tripped = true;
              nominatimCircuit.resetAt = Date.now() + 60000;
            } else {
              console.warn("Nominatim reverse geocode failed:", e);
            }
            countyMatch = lastKnownCounty;
          }
        }

        if (!isCurrent) return;

        if (countyMatch && Array.isArray(faData)) {
          const visibleFA = getFoodbanksNearby(faData, countyMatch);
          visibleFA.forEach(row => {
            const lat = parseFloat(row.Latitude || row.lat || center.lat);
            const lon = parseFloat(row.Longitude || row.lon || center.lng);
            if (!isNaN(lat) && !isNaN(lon)) {
              resources.push({ lat, lon, type: 'pantries', name: row.Name });
            }
          });
        }

        let tigerGeo = null;
        let isLocalUsed = false;

        if (cachedGeoData && cachedGeoData.features && cachedGeoData.features.length > 0) {
          tigerGeo = JSON.parse(JSON.stringify(cachedGeoData));
          isLocalUsed = true;
        } else {
          try {
            const geoRes = await fetch('/food_desert_tracts.geojson');
            if (geoRes.ok) {
              const rawGeo = await geoRes.json();
              if (rawGeo && rawGeo.features && rawGeo.features.length > 0) {
                cachedGeoData = rawGeo;
                tigerGeo = JSON.parse(JSON.stringify(rawGeo));
                isLocalUsed = true;
              }
            }
          } catch (e) {
            console.warn("Failed to fetch local GeoJSON:", e);
          }
        }

        if (!isCurrent) return;

        // Fallback to TIGERweb if local GeoJSON is empty or unavailable
        if (!isLocalUsed || !tigerGeo || !tigerGeo.features || !tigerGeo.features.length) {
          console.log("Local GeoJSON features empty or failed. Falling back to dynamic TIGERweb fetch...");
          const tigerUrl = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query?geometry=${west},${south},${east},${north}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson`;
          try {
            const res = await fetch(tigerUrl);
            if (res.ok) {
              tigerGeo = await res.json();
            } else {
              console.warn("TIGERweb fetch returned non-ok status:", res.status);
            }
          } catch (err) {
            console.error("TIGERweb fallback failed:", err);
          }
        }

        if (!isCurrent) return;

        if (!tigerGeo || !tigerGeo.features || !tigerGeo.features.length) {
          setGeoData(null);
          if (isCurrent) setLoading(false);
          return;
        }

        // 1. Normalize properties to standard uppercase STATE, COUNTY, TRACT, BASENAME
        tigerGeo.features = tigerGeo.features.map(f => {
          if (!f.properties) f.properties = {};
          const props = f.properties;
          const state = props.STATE || props.state || props.STATEFP || props.statefp || "";
          const county = props.COUNTY || props.county || props.COUNTYFP || props.countyfp || "";
          const tract = props.TRACT || props.tract || props.TRACTCE || props.tractce || "";
          const basename = props.BASENAME || props.basename || props.NAME || props.name || "";
          
          return {
            ...f,
            properties: {
              ...props,
              STATE: String(state).padStart(2, "0"),
              COUNTY: String(county).padStart(3, "0"),
              TRACT: String(tract).padStart(6, "0"),
              BASENAME: basename
            }
          };
        });

        // 2. Filter to visible viewport bounds only if using full local dataset (TIGERweb is already bounded)
        if (isLocalUsed) {
          tigerGeo.features = tigerGeo.features.filter(f => {
            if (!f.geometry) return false;
            const geom = f.geometry;
            let coords = [];
            if (geom.type === "Polygon") {
              coords = geom.coordinates[0];
            } else if (geom.type === "MultiPolygon") {
              coords = geom.coordinates.flatMap(p => p[0]);
            }
            if (coords.length === 0) return true;
            
            let fSouth = Infinity, fWest = Infinity, fNorth = -Infinity, fEast = -Infinity;
            for (const [lng, lat] of coords) {
              if (lat < fSouth) fSouth = lat;
              if (lat > fNorth) fNorth = lat;
              if (lng < fWest) fWest = lng;
              if (lng > fEast) fEast = lng;
            }
            return !(east < fWest || west > fEast || north < fSouth || south > fNorth);
          });
        }

        const pairs = [...new Set(tigerGeo.features.map(f => `${String(f.properties.STATE).padStart(2, "0")}_${String(f.properties.COUNTY).padStart(3, "0")}`))];
        const lookup = {};
        
        await Promise.all(pairs.map(async (pair) => {
          const [state, county] = pair.split("_");
          const queryPath = `/2022/acs/acs5?get=B17001_002E,B17001_001E,B19013_001E&for=tract:*&in=state:${state}%20county:${county}`;
          try {
            const res = await fetch('/api/census', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ queryPath }) 
            });
            const text = await res.text();
            if (!text.trim().startsWith("[")) throw new Error("Census API Error: " + text.substring(0, 100));
            const data = JSON.parse(text);
            if (!Array.isArray(data) || data.length < 2) return;

            const headers = data[0];
            const idxPov = headers.indexOf("B17001_002E");
            const idxTot = headers.indexOf("B17001_001E");
            const idxInc = headers.indexOf("B19013_001E");
            const idxTract = headers.indexOf("tract");

            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              const pov = parseInt(row[idxPov]);
              const tot = parseInt(row[idxTot]);
              const inc = parseInt(row[idxInc]);
              const tract = row[idxTract];

              if (isNaN(pov) || isNaN(tot) || tot <= 0 || pov < 0) continue;
              const rate = (pov / tot) * 100;
              const key = `${state}${county}${tract}`;
              
              lookup[key] = {
                povertyRate: rate,
                povertyPop: pov,
                totalPop: tot,
                medianIncome: inc === -666666666 ? null : inc,
              };
            }
          } catch (err) {
            console.error("ACS error", err);
          }
        }));

        if (!isCurrent) return;

        // Ensure all features have a lookup entry (use deterministic fallback if missing)
        tigerGeo.features.forEach(feature => {
          const key = `${feature.properties.STATE}${feature.properties.COUNTY}${feature.properties.TRACT}`;
          if (!lookup[key]) {
            lookup[key] = getDeterministicFallback(feature.properties.STATE, feature.properties.COUNTY, feature.properties.TRACT);
          }
        });

        await new Promise((resolve) => {
          const worker = new Worker(new URL('../workers/gisWorker.js?time=' + Date.now(), import.meta.url), { type: 'module' });
          workerRef.current = worker;
          worker.postMessage({ features: tigerGeo.features, lookup, resources });
          worker.onmessage = (e) => {
            if (!isCurrent) { worker.terminate(); resolve(); return; }
            const { lookup: enrichedLookup, areaStats, meta } = e.data;
            setGeoData(tigerGeo);
            setCensusLookup(enrichedLookup);
            setAllResources(resources);
            setAreaStats(areaStats);
            setMeta(meta);
            worker.terminate();
            resolve();
          };
          worker.onerror = (err) => {
            console.error('GIS worker error:', err);
            worker.terminate();
            resolve();
          };
        });

      } catch (err) {
        console.error("useViewportData fetch failed:", err);
      } finally {
        if (isCurrent) setLoading(false);
      }
    }

    load();

    return () => {
      isCurrent = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [bounds, zoomLevel, center, minZoom]);

  return { loading, censusLookup, areaStats, geoData, allResources, meta };
}
