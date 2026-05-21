/* eslint-disable no-restricted-globals */
// worker.js - Background processing for FoodMap data

const layerColors = {
  markets: { color: "#059669", type: "FARMERS MARKET / GROCERY" },
  pantries: { color: "#2563eb", type: "FOOD PANTRY" },
  snap: { color: "#d97706", type: "SNAP LOCATION" },
};

function classifyNode(node) {
  const t = node.tags || {};
  const name = (t.name || "").toLowerCase();
  if (t.government === "social_services" || /snap|food stamp|dhs|benefit|human service/i.test(name)) return "snap";
  if (t.amenity === "food_bank" || t.social_facility === "food_bank" || /pantry|soup kitchen|hunger|salvation army|food shelf/i.test(name)) return "pantries";
  return "markets";
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

self.onmessage = (e) => {
  const { nodes, lat, lon } = e.data;
  const counts = { markets: 0, pantries: 0, snap: 0 };
  const resources = nodes.map(node => {
    const itemLat = node.lat || node.center?.lat;
    const itemLon = node.lon || node.center?.lon;
    if (!itemLat || !itemLon) return null;

    const key = classifyNode(node);
    counts[key]++;

    return {
      id: node.id,
      lat: itemLat,
      lon: itemLon,
      name: node.tags?.name || "Unnamed Location",
      type: key,
      label: layerColors[key].type,
      color: layerColors[key].color,
      detail: [node.tags?.opening_hours, node.tags?.phone].filter(Boolean).join(" · ") || "No details listed",
      distance: parseFloat(haversineDistance(lat, lon, itemLat, itemLon))
    };
  }).filter(Boolean).sort((a, b) => a.distance - b.distance);

  // Compute Scores
  const marketScore = Math.min(100, counts.markets * 12);
  const pantryScore = Math.min(100, counts.pantries * 20);
  const snapScore = Math.min(100, counts.snap * 25);
  const composite = Math.round(marketScore * 0.5 + pantryScore * 0.3 + snapScore * 0.2);

  self.postMessage({ resources, counts, score: { composite, marketScore, pantryScore, snapScore } });
};
