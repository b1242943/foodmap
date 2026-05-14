import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

const RADIUS_M = 5000;
const NOMINATIM_TTL = 10 * 60 * 1000;
const OVERPASS_TTL = 5 * 60 * 1000;

const layerColors = {
  markets: { color: "#00f0a0", type: "FARMERS MARKET" },
  pantries: { color: "#3b9eff", type: "FOOD PANTRY" },
  snap: { color: "#ffc400", type: "SNAP LOCATION" },
  wic: { color: "#a855f7", type: "WIC" },
  community_garden: { color: "#22c55e", type: "COMMUNITY GARDEN" },
  free_meals: { color: "#f97316", type: "FREE MEALS" },
  desert: { color: "#ff3366", type: "FOOD DESERT" },
};

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const h = hex.replace("#", "").trim();
  if (h.startsWith("rgb")) return hex;
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
}

function makeIcon(color) {
  const c = color || "#888";
  const shadow = hexToRgba(c, 0.35);
  const safeClass = String(c).replace(/^#/, "");
  return L.divIcon({
    className: "food-marker food-marker--" + safeClass,
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${esc(c)};border:2px solid rgba(255,255,255,0.4);box-shadow:0 0 6px ${esc(shadow)};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const geocodeCache = new Map();
function cachedGeocode(q) {
  const key = String(q).toLowerCase().trim();
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.ts < NOMINATIM_TTL) return cached.data;
  return null;
}
function setGeocodeCache(q, data) {
  geocodeCache.set(String(q).toLowerCase().trim(), { data, ts: Date.now() });
}

const overpassCache = new Map();
function getOverpassCacheKey(lat, lon) {
  return `${Number(lat).toFixed(3)}-${Number(lon).toFixed(3)}-${RADIUS_M}`;
}
function cachedOverpass(lat, lon) {
  const key = getOverpassCacheKey(lat, lon);
  const cached = overpassCache.get(key);
  if (cached && Date.now() - cached.ts < OVERPASS_TTL) return cached.data;
  return null;
}
function setOverpassCache(lat, lon, data) {
  overpassCache.set(getOverpassCacheKey(lat, lon), { data, ts: Date.now() });
}

function parseOpeningHours(oh) {
  if (!oh || typeof oh !== "string") return "unknown";
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();
  const currentMins = hours * 60 + mins;
  const simple = /(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/i.exec(oh);
  if (simple) {
    const openMins = parseInt(simple[1], 10) * 60 + (parseInt(simple[2] || "0", 10) || 0);
    const closeMins = parseInt(simple[3], 10) * 60 + (parseInt(simple[4] || "0", 10) || 0);
    if (currentMins >= openMins && currentMins < closeMins) {
      const closeIn = closeMins - currentMins;
      return closeIn <= 60 ? "closing_soon" : "open";
    }
    return "closed";
  }
  return "unknown";
}

function hoursStatusLabel(status) {
  if (status === "open") return "Open now";
  if (status === "closing_soon") return "Closes in 1 hr";
  if (status === "closed") return "Closed";
  return "Hours unknown";
}

function hoursBadgeColor(status) {
  if (status === "open") return "#00f0a0";
  if (status === "closing_soon") return "#ffc400";
  if (status === "closed") return "#ff3366";
  return "#4a6680";
}

async function fetchRoute(userLat, userLon, placeLon, placeLat) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${userLon},${userLat};${placeLon},${placeLat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes && data.routes[0];
    if (!route) return null;
    const distM = route.distance;
    const durSec = route.duration;
    const distMi = (distM / 1609.34).toFixed(1);
    const durMin = Math.round(durSec / 60);
    return { distMi, durMin, distM, durSec };
  } catch {
    return null;
  }
}

const extendedQuery = (lat, lon) =>
  `[out:json][timeout:25];(
  node["shop"="supermarket"](around:${RADIUS_M},${lat},${lon});
  node["shop"="grocery"](around:${RADIUS_M},${lat},${lon});
  node["amenity"="marketplace"](around:${RADIUS_M},${lat},${lon});
  node["amenity"="food_bank"](around:${RADIUS_M},${lat},${lon});
  node["amenity"="social_facility"]["social_facility"="food_bank"](around:${RADIUS_M},${lat},${lon});
  node["government"="social_services"](around:${RADIUS_M},${lat},${lon});
  node["amenity"="community_centre"]["community_centre"="garden"](around:${RADIUS_M},${lat},${lon});
  node["amenity"="wic"](around:${RADIUS_M},${lat},${lon});
  node["amenity"="school"]["school:meals"="yes"](around:${RADIUS_M},${lat},${lon});
  node["amenity"="feeding_programme"](around:${RADIUS_M},${lat},${lon});
  node["mobile_food_pantry"="yes"](around:${RADIUS_M},${lat},${lon});
);out body;`;

async function fetchOverpassData(lat, lon) {
  const cached = cachedOverpass(lat, lon);
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(extendedQuery(lat, lon))}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const elements = data.elements || [];
    setOverpassCache(lat, lon, elements);
    return elements;
  } catch (err) {
    console.error("Overpass request error", err);
    return [];
  }
}

function classifyNode(node) {
  const t = node.tags || {};
  if (t.amenity === "food_bank" || t.social_facility === "food_bank") return "pantries";
  if (t.government === "social_services" || /snap|fsa|ebt|food stamp/i.test(t.name || "")) return "snap";
  if (t.amenity === "wic") return "wic";
  if (t.community_centre === "garden" || t.amenity === "community_centre") return "community_garden";
  if (t.amenity === "feeding_programme" || t["school:meals"] === "yes" || t.mobile_food_pantry === "yes") return "free_meals";
  return "markets";
}

function computeScore(counts) {
  const marketScore = Math.min(100, (counts.markets || 0) * 12);
  const pantryScore = Math.min(100, (counts.pantries || 0) * 20);
  const snapScore = Math.min(100, (counts.snap || 0) * 25);
  const wicScore = Math.min(100, (counts.wic || 0) * 15);
  const gardenScore = Math.min(100, (counts.community_garden || 0) * 25);
  const mealsScore = Math.min(100, (counts.free_meals || 0) * 20);
  const composite = Math.round(
    marketScore * 0.35 + pantryScore * 0.25 + snapScore * 0.2 + wicScore * 0.05 + gardenScore * 0.05 + mealsScore * 0.1
  );
  return { composite, marketScore, pantryScore, snapScore };
}

function createTileLayersFor(styleName) {
  const layers = [];
  switch (styleName) {
    case "Standard":
      layers.push(
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OSM &copy; CARTO",
          subdomains: "abcd",
          maxZoom: 20,
        })
      );
      break;
    case "Satellite":
      layers.push(
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Tiles © Esri",
          maxZoom: 19,
        })
      );
      break;
    case "Hybrid":
      layers.push(
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Tiles © Esri",
          maxZoom: 19,
        })
      );
      layers.push(
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Tiles © Esri",
          maxZoom: 19,
          opacity: 0.55,
        })
      );
      break;
    case "Terrain":
      layers.push(
        L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenTopoMap",
          maxZoom: 17,
        })
      );
      break;
    default:
      layers.push(
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Tiles © Esri",
          maxZoom: 19,
        })
      );
  }
  return layers;
}

const TILE_OPTIONS = ["Standard", "Satellite", "Hybrid", "Terrain"];

export default function Map({
  searchQuery = "",
  searchCenter = null,
  onStatsUpdate = () => {},
  onLoading = () => {},
  activeFilters = null,
  getHintsForType = null,
  onReportOpen = null,
  mapRef: externalMapRef = null,
  highlightPlace = null,
}) {
  const internalMapRef = useRef(null);
  const mapRef = externalMapRef || internalMapRef;
  const layersRef = useRef({});
  const containerRef = useRef(null);
  const tileLayersRef = useRef([]);
  const currentTileNameRef = useRef("Satellite");
  const markersRef = useRef([]);
  const lilaLayerRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const [activeTileLayer, setActiveTileLayer] = useState("Satellite");
  const [lilaGeoJson, setLilaGeoJson] = useState(null);
  const [showLilaOverlay, setShowLilaOverlay] = useState(false);

  useEffect(() => {
    fetch(process.env.PUBLIC_URL + "/food_desert_tracts.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((geojson) => geojson && setLilaGeoJson(geojson))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let map;
    try {
      map = L.map(container, { center: [43.0731, -89.4012], zoom: 13 });
      mapRef.current = map;
      setMapError(null);
      tileLayersRef.current = [];
      createTileLayersFor("Satellite").forEach((l) => {
        l.addTo(map);
        tileLayersRef.current.push(l);
      });
      currentTileNameRef.current = "Satellite";
      Object.keys(layerColors).forEach((key) => {
        layersRef.current[key] = L.layerGroup().addTo(map);
      });
    } catch (err) {
      setMapError(err?.message || "Failed to load map");
      return;
    }
    return () => {
      if (map && typeof map.remove === "function") map.remove();
      mapRef.current = null;
      layersRef.current = {};
      tileLayersRef.current = [];
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeTileLayer === currentTileNameRef.current) return;
    tileLayersRef.current.forEach((l) => {
      try {
        map.removeLayer(l);
      } catch (_) {}
    });
    tileLayersRef.current = [];
    createTileLayersFor(activeTileLayer).forEach((l) => {
      l.addTo(map);
      tileLayersRef.current.push(l);
    });
    currentTileNameRef.current = activeTileLayer;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mapRef is stable
  }, [activeTileLayer]);

  const lastStatsRef = useRef(null);

  const applyFilterVisibility = useCallback(() => {
    const filters = activeFilters && activeFilters.length ? activeFilters : Object.keys(layerColors);
    markersRef.current.forEach((m) => {
      const type = m._resourceType;
      const visible = filters.includes(type);
      m.setOpacity(visible ? 1 : 0);
    });
  }, [activeFilters]);

  useEffect(() => {
    if (!searchQuery && !searchCenter) return;
    const map = mapRef.current;
    if (!map) return;

    const layers = layersRef.current;
    let userLat, userLon, label;

    async function load() {
      if (onLoading) onLoading(true);
      if (searchCenter && searchCenter.lat != null && searchCenter.lon != null) {
        userLat = searchCenter.lat;
        userLon = searchCenter.lon;
        label = `Lat ${userLat.toFixed(4)}, Lon ${userLon.toFixed(4)}`;
      } else {
        const cached = cachedGeocode(searchQuery);
        let geoData;
        if (cached) geoData = cached;
        else {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
          );
          if (!res.ok) {
            if (onLoading) onLoading(false);
            return;
          }
          geoData = await res.json();
          setGeocodeCache(searchQuery, geoData);
        }
        if (!geoData || !geoData.length) {
          if (onLoading) onLoading(false);
          return;
        }
        userLat = parseFloat(geoData[0].lat);
        userLon = parseFloat(geoData[0].lon);
        label = geoData[0].display_name;
      }

      map.flyTo([userLat, userLon], 14, { duration: 1.5 });
      Object.values(layers).forEach((lg) => lg.clearLayers());
      markersRef.current = [];

      const nodes = await fetchOverpassData(userLat, userLon);
      const counts = { markets: 0, pantries: 0, snap: 0, wic: 0, community_garden: 0, free_meals: 0 };

      const resources = nodes.map((n) => {
        const key = classifyNode(n);
        counts[key] = (counts[key] || 0) + 1;
        const name = n.tags?.name || "Unnamed";
        const hoursRaw = n.tags?.opening_hours || "";
        const hoursStatus = parseOpeningHours(hoursRaw);
        const lat = n.lat;
        const lon = n.lon;
        const id = n.id ? String(n.id) : `${lat}-${lon}-${key}`;
        return {
          id,
          name,
          lat,
          lon,
          type: key,
          address: n.tags?.addr_full || n.tags?.address || "",
          detail: hoursRaw || "No hours listed",
          hoursStatus,
          distance: null,
          distanceText: null,
        };
      });

      resources.forEach((r) => {
        const { color, type } = layerColors[r.type] || { color: "#888", type: "UNKNOWN" };
        const hints = getHintsForType ? getHintsForType(r.type) : [];
        const hintsHtml =
          hints.length > 0
            ? hints
                .slice(0, 2)
                .map((h) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 6px;border-radius:3px;background:#1a2535;color:#4a6680;font-size:9px;">${esc(h)}</span>`)
                .join("")
            : `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 6px;border-radius:3px;background:#1a2535;color:#4a6680;font-size:9px;">Check with site</span>`;
        const hoursColor = hoursBadgeColor(r.hoursStatus);
        const distPart = r.distanceText || "";
        const popupContent = `
          <div style="font-family:monospace;color:#dce8f5;min-width:180px;">
            <strong style="font-size:12px;">${esc(r.name)}</strong>
            <div style="font-size:10px;color:${hexToRgba(color,1)};margin:4px 0;">${esc(type)}</div>
            <div style="font-size:9px;margin:4px 0;padding:3px 6px;border-radius:3px;background:${hoursColor}20;color:${hoursColor};display:inline-block;">${esc(hoursStatusLabel(r.hoursStatus))}</div>
            ${distPart ? `<div style="font-size:10px;color:#4a6680;margin:4px 0;">${esc(distPart)}</div>` : ""}
            <div style="margin:6px 0;">${hintsHtml}</div>
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:#3b9eff;">Google Maps</a>
              <a href="https://maps.apple.com/?daddr=${r.lat},${r.lon}" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:#3b9eff;">Apple Maps</a>
              ${onReportOpen ? `<button type="button" data-report-lat="${r.lat}" data-report-lon="${r.lon}" data-report-name="${esc(r.name)}" data-report-type="${r.type}" style="font-size:9px;background:transparent;border:1px solid #2a3d52;color:#4a6680;padding:4px 8px;border-radius:4px;cursor:pointer;">Report problem</button>` : ""}
            </div>
          </div>`;
        const marker = L.marker([r.lat, r.lon], { icon: makeIcon(color) })
          .bindPopup(popupContent, { maxWidth: 280 })
          .on("popupopen", function () {
            const pop = this.getPopup();
            const el = pop.getElement();
            if (!el) return;
            const btn = el.querySelector("[data-report-lat]");
            if (btn && onReportOpen)
              btn.addEventListener("click", () => {
                onReportOpen({
                  name: btn.getAttribute("data-report-name"),
                  lat: parseFloat(btn.getAttribute("data-report-lat")),
                  lon: parseFloat(btn.getAttribute("data-report-lon")),
                  type: btn.getAttribute("data-report-type"),
                });
              });
          });
        marker._resourceType = r.type;
        marker._resource = r;
        markersRef.current.push(marker);
        layers[r.type].addLayer(marker);
      });

      applyFilterVisibility();

      const params = new URLSearchParams(window.location.search);
      const paramLat = params.get("lat");
      const paramLon = params.get("lon");
      const paramName = params.get("name");
      if (paramLat && paramLon && map) {
        const latN = parseFloat(paramLat);
        const lonN = parseFloat(paramLon);
        map.flyTo([latN, lonN], 16, { duration: 1 });
        const marker = markersRef.current.find((m) => {
          const ll = m.getLatLng();
          return Math.abs(ll.lat - latN) < 1e-5 && Math.abs(ll.lng - lonN) < 1e-5;
        });
        if (marker && paramName) setTimeout(() => marker.openPopup(), 800);
      }

      let inLilaTract = false;
      if (lilaGeoJson && userLat != null && userLon != null) {
        const pt = point([userLon, userLat]);
        const features = lilaGeoJson.features || [];
        for (let i = 0; i < features.length; i++) {
          if (booleanPointInPolygon(pt, features[i])) {
            inLilaTract = true;
            break;
          }
        }
      }

      const score = computeScore(counts);
      if (typeof onStatsUpdate === "function") {
        const payload = {
          score: score.composite,
          marketScore: score.marketScore,
          pantryScore: score.pantryScore,
          snapScore: score.snapScore,
          markets: counts.markets,
          pantries: counts.pantries,
          snap: counts.snap,
          wic: counts.wic,
          community_garden: counts.community_garden,
          free_meals: counts.free_meals,
          label,
          resources,
          inLilaTract,
        };
        lastStatsRef.current = payload;
        onStatsUpdate(payload);
      }

      Promise.allSettled(
        resources.map((r) => fetchRoute(userLat, userLon, r.lon, r.lat))
      ).then((results) => {
        results.forEach((res, i) => {
          const r = resources[i];
          if (res.status === "fulfilled" && res.value) {
            r.distance = `${res.value.distMi} mi · ${res.value.durMin} min drive`;
            r.distanceText = r.distance;
          } else {
            const dM = haversine(userLat, userLon, r.lat, r.lon);
            r.distance = `${(dM / 1609.34).toFixed(1)} mi (straight)`;
            r.distanceText = r.distance;
          }
        });
        markersRef.current.forEach((m) => {
          const r = m._resource;
          if (!r || !r.distanceText) return;
          const hints = getHintsForType ? getHintsForType(r.type) : [];
          const hintsHtml =
            hints.length > 0
              ? hints
                  .slice(0, 2)
                  .map((h) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 6px;border-radius:3px;background:#1a2535;color:#4a6680;font-size:9px;">${esc(h)}</span>`)
                  .join("")
              : `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 6px;border-radius:3px;background:#1a2535;color:#4a6680;font-size:9px;">Check with site</span>`;
          const hoursColor = hoursBadgeColor(r.hoursStatus);
          m.setPopupContent(`
            <div style="font-family:monospace;color:#dce8f5;min-width:180px;">
              <strong style="font-size:12px;">${esc(r.name)}</strong>
              <div style="font-size:10px;color:${hexToRgba((layerColors[r.type] || {}).color || "#888", 1)};margin:4px 0;">${(layerColors[r.type] || {}).type || "UNKNOWN"}</div>
              <div style="font-size:9px;margin:4px 0;padding:3px 6px;border-radius:3px;background:${hoursColor}20;color:${hoursColor};display:inline-block;">${esc(hoursStatusLabel(r.hoursStatus))}</div>
              <div style="font-size:10px;color:#4a6680;margin:4px 0;">${esc(r.distanceText)}</div>
              <div style="margin:6px 0;">${hintsHtml}</div>
              <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:#3b9eff;">Google Maps</a>
                <a href="https://maps.apple.com/?daddr=${r.lat},${r.lon}" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:#3b9eff;">Apple Maps</a>
                ${onReportOpen ? `<button type="button" data-report-lat="${r.lat}" data-report-lon="${r.lon}" data-report-name="${esc(r.name)}" data-report-type="${r.type}" style="font-size:9px;background:transparent;border:1px solid #2a3d52;color:#4a6680;padding:4px 8px;border-radius:4px;cursor:pointer;">Report problem</button>` : ""}
              </div>
            </div>`);
        });
        if (onStatsUpdate && lastStatsRef.current) onStatsUpdate({ ...lastStatsRef.current, resources });
      });

      if (onLoading) onLoading(false);
    }

    load().catch((err) => {
      console.error("Map load error", err);
      if (onLoading) onLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run on search change
  }, [searchQuery, searchCenter]);

  useEffect(() => {
    applyFilterVisibility();
  }, [activeFilters, applyFilterVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !highlightPlace || highlightPlace.lat == null || highlightPlace.lon == null) return;
    map.flyTo([highlightPlace.lat, highlightPlace.lon], 15, { duration: 1.5 });
    const marker = markersRef.current.find((m) => {
      const ll = m.getLatLng();
      return Math.abs(ll.lat - highlightPlace.lat) < 1e-5 && Math.abs(ll.lng - highlightPlace.lon) < 1e-5;
    });
    if (marker) setTimeout(() => marker.openPopup(), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mapRef is stable
  }, [highlightPlace]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lilaGeoJson) return;
    if (showLilaOverlay) {
      if (lilaLayerRef.current) map.removeLayer(lilaLayerRef.current);
      const layer = L.geoJSON(lilaGeoJson, {
        style: {
          fillColor: "#ff3366",
          fillOpacity: 0.12,
          color: "#ff3366",
          weight: 2,
          dashArray: "4 4",
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          layer.bindPopup(
            `<div style="font-family:monospace;font-size:11px;color:#dce8f5;">
              <strong>${esc(props.NAMELSAD || "Tract")}</strong><br/>
              ${props.MedianFamilyIncome != null ? `Median income: $${props.MedianFamilyIncome}` : ""}<br/>
              ${props.PCTGOV_SNAP != null ? `SNAP participation: ${props.PCTGOV_SNAP}%` : ""}
            </div>`
          );
        },
      });
      layer.addTo(map);
      lilaLayerRef.current = layer;
    } else {
      if (lilaLayerRef.current) {
        map.removeLayer(lilaLayerRef.current);
        lilaLayerRef.current = null;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mapRef is stable
  }, [showLilaOverlay, lilaGeoJson]);

  if (mapError) {
    return (
      <div
        style={{
          padding: 24,
          background: "#0a0f15",
          color: "#dce8f5",
          minHeight: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <strong>Runtime error</strong>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#8a9ba8" }}>{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 320, background: "#0a0f15", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 320 }} />
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, fontFamily: "monospace" }}>
        <div
          style={{
            background: "#0a0f16",
            border: "1px solid #1e2d3d",
            borderRadius: 6,
            padding: "6px 8px",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {TILE_OPTIONS.map((name) => {
            const active = activeTileLayer === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setActiveTileLayer(name)}
                style={{
                  padding: "6px 10px",
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: "0.5px",
                  color: active ? "#00f0a0" : "#dce8f5",
                  background: active ? "rgba(0,240,160,0.1)" : "transparent",
                  border: `1px solid ${active ? "#00f0a0" : "#2a3d52"}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  minHeight: 44,
                  minWidth: 44,
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
        {lilaGeoJson && (
          <button
            type="button"
            onClick={() => setShowLilaOverlay((v) => !v)}
            style={{
              marginTop: 6,
              padding: "6px 10px",
              fontFamily: "monospace",
              fontSize: 10,
              color: showLilaOverlay ? "#00f0a0" : "#dce8f5",
              background: showLilaOverlay ? "rgba(0,240,160,0.1)" : "#0a0f16",
              border: `1px solid ${showLilaOverlay ? "#00f0a0" : "#1e2d3d"}`,
              borderRadius: 4,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {showLilaOverlay ? "Hide" : "Show"} food desert areas
          </button>
        )}
      </div>
    </div>
  );
}
