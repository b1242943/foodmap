import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Papa from "papaparse";

const layerColors = {
  markets: { color: "#059669", type: "FARMERS MARKET / GROCERY" },
  pantries: { color: "#2563eb", type: "FOOD PANTRY" },
  snap: { color: "#d97706", type: "SNAP / EBT RETAILER" },
  desert: { color: "#dc2626", type: "FOOD DESERT" },
};

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color};box-shadow:0 0 10px ${color},0 0 20px ${color}40;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

// Load and cache the SNAP CSV once
let snapDataCache = null;
async function loadSnapCSV() {
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

function getSnapNearby(snapData, lat, lon, radiusMeters = 5000) {
  const R = 6371000;
  return snapData.filter((row) => {
    const rlat = parseFloat(row.Latitude);
    const rlon = parseFloat(row.Longitude);
    if (isNaN(rlat) || isNaN(rlon)) return false;
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

async function fetchOverpassData(lat, lon) {
  const radius = 5000;
  const query = `[out:json][timeout:90];(
    nwr["shop"="supermarket"](around:${radius},${lat},${lon});
    nwr["shop"="grocery"](around:${radius},${lat},${lon});
    nwr["shop"="greengrocer"](around:${radius},${lat},${lon});
    nwr["amenity"="marketplace"](around:${radius},${lat},${lon});
    nwr["amenity"="food_bank"](around:${radius},${lat},${lon});
    nwr["amenity"="social_facility"](around:${radius},${lat},${lon});
    nwr["social_facility"="food_bank"](around:${radius},${lat},${lon});
    nwr["social_facility"="soup_kitchen"](around:${radius},${lat},${lon});
    nwr["payment:ebt"="yes"](around:${radius},${lat},${lon});
    nwr["payment:snap"="yes"](around:${radius},${lat},${lon});
    nwr["payment:food_stamps"="yes"](around:${radius},${lat},${lon});
  );out center;`;

  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  return data.elements || [];
}

function classifyNode(node) {
  const t = node.tags || {};
  const name = (t.name || "").toLowerCase();

  if (
    t["payment:ebt"] === "yes" ||
    t["payment:snap"] === "yes" ||
    t["payment:food_stamps"] === "yes"
  ) {
    return "snap";
  }

  if (
    t.amenity === "food_bank" ||
    t.social_facility === "food_bank" ||
    t.social_facility === "soup_kitchen" ||
    t.amenity === "social_facility" ||
    name.includes("pantry") ||
    name.includes("food bank") ||
    name.includes("soup kitchen") ||
    name.includes("hunger") ||
    name.includes("salvation army") ||
    name.includes("st. vincent") ||
    name.includes("food shelf")
  ) {
    return "pantries";
  }

  return "markets";
}

function computeScore(counts) {
  const marketScore = Math.min(100, counts.markets * 12);
  const pantryScore = Math.min(100, counts.pantries * 20);
  const snapScore = Math.min(100, counts.snap * 25);
  const composite = Math.round(
    marketScore * 0.5 + pantryScore * 0.3 + snapScore * 0.2
  );
  return { composite, marketScore, pantryScore, snapScore };
}

function haversineDistance(lat1, lon1, lat2, lon2) {
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

export default function Map({ searchQuery, onStatsUpdate, onLoading }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const initializedRef = useRef(false);

  // Preload CSV on mount
  useEffect(() => {
    loadSnapCSV().catch((err) =>
      console.error("Failed to preload SNAP CSV:", err)
    );
  }, []);

  useEffect(() => {
    if (initializedRef.current || !mapContainerRef.current) return;
    initializedRef.current = true;

    const map = L.map(mapContainerRef.current, {
      center: [43.0731, -89.4012],
      zoom: 13,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    Object.keys(layerColors).forEach((key) => {
      layersRef.current[key] = L.layerGroup().addTo(map);
    });
  }, []);

  useEffect(() => {
    if (!searchQuery || !mapRef.current) return;

    const map = mapRef.current;
    const layers = layersRef.current;

    async function load() {
      onLoading?.(true);

      // US-first geocoding: lock to US unless user specifies a country with a comma
      const hasCountry = searchQuery.includes(",");
      const countryParam = hasCountry ? "" : "&countrycodes=us";

      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1${countryParam}`
      );
      const geoData = await geoRes.json();
      if (!geoData.length) {
        alert("Location not found.");
        onLoading?.(false);
        return;
      }

      const lat = parseFloat(geoData[0].lat);
      const lon = parseFloat(geoData[0].lon);
      const label = geoData[0].display_name.split(",").slice(0, 2).join(" ·");

      map.flyTo([lat, lon], 14, { duration: 1.5 });
      Object.values(layers).forEach((lg) => lg.clearLayers());

      const counts = { markets: 0, pantries: 0, snap: 0, desert: 0 };
      const resources = [];

      // Overpass: markets + pantries + EBT-tagged locations
      const nodes = await fetchOverpassData(lat, lon);
      nodes.forEach((node) => {
        const itemLat = node.lat || node.center?.lat;
        const itemLon = node.lon || node.center?.lon;
        if (!itemLat || !itemLon) return;

        const key = classifyNode(node);
        const { color, type } = layerColors[key];
        const name = node.tags?.name || "Unnamed Location";
        const hours = node.tags?.opening_hours || "";
        const phone = node.tags?.phone || "";
        const detail =
          [hours, phone].filter(Boolean).join(" · ") || "No details listed";
        const distance = haversineDistance(lat, lon, itemLat, itemLon);

        L.marker([itemLat, itemLon], { icon: makeIcon(color) })
          .bindPopup(
            `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;min-width:200px;padding:4px">
              <div style="font-weight:800;font-size:18px;margin-bottom:8px;line-height:1.2">${name}</div>
              <div style="color:${color};font-weight:700;font-size:12px;letter-spacing:0.5px;margin-bottom:8px;text-transform:uppercase">${type}</div>
              <div style="color:#374151;font-size:16px;line-height:1.5">${detail}</div>
            </div>`
          )
          .addTo(layers[key]);

        counts[key]++;
        resources.push({
          name,
          type: key,
          detail,
          distance: parseFloat(distance),
          lat: itemLat,
          lon: itemLon,
        });
      });

      // CSV: SNAP / EBT retailers from USDA FNS registry
      const snapData = await loadSnapCSV();
      const nearbySnap = getSnapNearby(snapData, lat, lon, 5000);

      nearbySnap.forEach((row) => {
        const rlat = parseFloat(row.Latitude);
        const rlon = parseFloat(row.Longitude);
        const name = row.Store_Name || "SNAP / EBT Retailer";
        const address = [row.Store_Street_Address, row.City, row.State]
          .filter(Boolean)
          .join(", ");
        const storeType = row.Store_Type || "";
        const distance = haversineDistance(lat, lon, rlat, rlon);
        const { color, type } = layerColors.snap;

        L.marker([rlat, rlon], { icon: makeIcon(color) })
          .bindPopup(
            `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;min-width:200px;padding:4px">
              <div style="font-weight:800;font-size:18px;margin-bottom:8px;line-height:1.2">${name}</div>
              <div style="color:${color};font-weight:700;font-size:12px;letter-spacing:0.5px;margin-bottom:8px;text-transform:uppercase">${type}</div>
              <div style="color:#374151;font-size:16px;line-height:1.5">${storeType}${address ? " · " + address : ""}</div>
            </div>`
          )
          .addTo(layers.snap);

        counts.snap++;
        resources.push({
          name,
          type: "snap",
          detail: address,
          distance: parseFloat(distance),
          lat: rlat,
          lon: rlon,
        });
      });

      resources.sort((a, b) => a.distance - b.distance);

      const score = computeScore(counts);

      onStatsUpdate?.({
        label,
        lat,
        lon,
        score: score.composite,
        markets: counts.markets,
        pantries: counts.pantries,
        snap: counts.snap,
        resources,
        marketScore: score.marketScore,
        pantryScore: score.pantryScore,
        snapScore: score.snapScore,
      });

      onLoading?.(false);
    }

    load().catch((err) => {
      console.error(err);
      alert("Error fetching data. Try again.");
      onLoading?.(false);
    });
  }, [searchQuery, onLoading, onStatsUpdate]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-secondary)",
        position: "relative",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
