import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchOverpassData, loadSnapCSV, loadFeedingAmericaCSV, getSnapNearby, getFoodbanksNearby, classifyNode } from "./utils/dataFetchers";

const MIN_ZOOM = 11;
const TYPE_COLORS = { markets: "#059669", pantries: "#2563eb", snap: "#d97706" };

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color};box-shadow:0 0 10px ${color},0 0 20px ${color}40;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    tooltipAnchor: [0, -10],
  });
}

function getPovertyColor(rate) {
  if (rate == null) return "transparent";
  if (rate < 10) return "#fde68a";
  if (rate < 20) return "#f59e0b";
  if (rate < 30) return "#d97706";
  if (rate < 40) return "#b45309";
  return "#7c2d12";
}

function getDesertColor(score) {
  if (score == null) return "transparent";
  if (score < -10) return "#059669"; // Green (Good Access)
  if (score < 10) return "#fcd34d"; // Yellow
  if (score < 30) return "#f59e0b"; // Orange
  if (score < 50) return "#ea580c"; // Dark Orange
  return "#dc2626"; // Red (Food Desert)
}

function getDynamicGapColor(score, min, max) {
  if (score == null || max == null || min == null || max === min) return "transparent";
  const norm = (score - min) / (max - min);
  if (norm < 0.2) return "#059669"; // Green (Well-served)
  if (norm < 0.4) return "#84cc16"; // Lime
  if (norm < 0.6) return "#fcd34d"; // Yellow
  if (norm < 0.8) return "#f59e0b"; // Orange
  return "#dc2626"; // Red (Highest Unmet Need)
}

function formatCurrency(val) {
  if (val == null || val < 0) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function buildFipsKey(state, county, tract) {
  const str = String(tract).trim();
  let tractStr = str.includes(".") ? str.replace(".", "") : str.padStart(4, "0") + "00";
  return String(state).padStart(2, "0") + String(county).padStart(3, "0") + tractStr;
}

function pointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(pt, feature) {
  const geom = feature.geometry;
  if (!geom) return false;
  const checkPoly = (poly) => pointInPolygon(pt, poly[0]);
  if (geom.type === "Polygon") return checkPoly(geom.coordinates);
  if (geom.type === "MultiPolygon") return geom.coordinates.some((poly) => checkPoly(poly));
  return false;
}

export default function MapExplorer({ stats }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const censusLayerRef = useRef(null);
  const debounceRef = useRef(null);
  
  const tigerGeoRef = useRef(null);
  const censusLookupRef = useRef({});
  const metaRef = useRef({ minGap: 0, maxGap: 0, topTract: null });

  const [toggles, setToggles] = useState({
    markets: true,
    pantries: true,
    snap: true,
    census: true,
  });

  const [overlayMode, setOverlayMode] = useState("poverty"); // 'poverty', 'desert', 'gap'
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(13);
  
  const [areaStats, setAreaStats] = useState({ 
    avgPoverty: null, 
    totalResources: 0,
    totalPop: 0,
    avgDensity: 0,
    topTract: null
  });

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const center = (stats && stats.lat && stats.lon) ? [stats.lat, stats.lon] : [39.8283, -98.5795];
    const zoom = (stats && stats.lat && stats.lon) ? 13 : 4;

    const map = L.map(mapContainerRef.current, { center, zoom });
    mapRef.current = map;
    setZoomLevel(zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    layersRef.current = {
      markets: L.layerGroup().addTo(map),
      pantries: L.layerGroup().addTo(map),
      snap: L.layerGroup().addTo(map),
    };

    setTimeout(() => handleMoveEnd(), 500);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stats?.lat, stats?.lon]);

  const renderCensusLayer = () => {
    if (!mapRef.current || !tigerGeoRef.current) return;
    
    if (censusLayerRef.current) {
      mapRef.current.removeLayer(censusLayerRef.current);
    }

    const { minGap, maxGap } = metaRef.current;

    censusLayerRef.current = L.geoJSON(tigerGeoRef.current, {
      style: (feature) => {
        const key = buildFipsKey(feature.properties.STATE, feature.properties.COUNTY, feature.properties.TRACT);
        const d = censusLookupRef.current[key];
        
        let fillColor = "transparent";
        let weight = 2;
        let color = "white";
        let dashArray = "3";
        let fillOpacity = d ? 0.6 : 0.05;

        if (d) {
          if (overlayMode === "poverty") {
            fillColor = getPovertyColor(d.povertyRate);
          } else if (overlayMode === "desert") {
            fillColor = getDesertColor(d.desertScore);
          } else if (overlayMode === "gap") {
            fillColor = getDynamicGapColor(d.gapScore, minGap, maxGap);
            if (d.priorityRank) {
              weight = 4;
              color = "#fde047"; // Yellow outline for priority zones
              dashArray = "";
              fillOpacity = 0.75;
            }
          }
        }

        return { fillColor, weight, opacity: 1, color, dashArray, fillOpacity };
      },
      onEachFeature: (feature, layer) => {
        const key = buildFipsKey(feature.properties.STATE, feature.properties.COUNTY, feature.properties.TRACT);
        const d = censusLookupRef.current[key];
        const name = feature.properties.BASENAME || feature.properties.TRACT;

        let extraStatsHtml = "";
        if (d) {
          if (overlayMode === "desert") {
            extraStatsHtml = `
              <div style="display:flex;justify-content:space-between;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:4px">
                <span style="color:#6b7280;font-size:12px;font-weight:600">Desert Score</span>
                <span style="font-weight:800;color:${getDesertColor(d.desertScore)}">${d.desertScore.toFixed(1)}</span>
              </div>
            `;
          } else if (overlayMode === "gap") {
            extraStatsHtml = `
              <div style="display:flex;justify-content:space-between;margin-top:2px;">
                <span style="color:#6b7280;font-size:12px;font-weight:600">Population</span>
                <span style="font-weight:700">${d.totalPop.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:4px">
                <span style="color:#6b7280;font-size:12px;font-weight:600">Gap Score</span>
                <span style="font-weight:800;color:${getDynamicGapColor(d.gapScore, minGap, maxGap)}">${d.gapScore.toFixed(2)}</span>
              </div>
            `;
          }
        }

        const priorityLabel = (overlayMode === "gap" && d && d.priorityRank) 
          ? `<div style="background:#fde047;color:#854d0e;font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:4px">PRIORITY #${d.priorityRank}</div>` 
          : "";

        layer.bindTooltip(
          `<div style="font-family:system-ui;padding:4px;min-width:170px;">
            ${priorityLabel}
            <div style="font-weight:800;font-size:14px;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:2px;">Tract ${name}</div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="color:#6b7280;font-size:12px;font-weight:600">Poverty Rate</span>
              <span style="font-weight:700;color:${getPovertyColor(d?.povertyRate)}">
                ${d && d.povertyRate != null ? d.povertyRate.toFixed(1) + "%" : "N/A"}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:2px;">
              <span style="color:#6b7280;font-size:12px;font-weight:600">Resources</span>
              <span style="font-weight:700">${d ? d.resourceCount : 0}</span>
            </div>
            ${extraStatsHtml}
          </div>`,
          { sticky: true }
        );

        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 4, color: overlayMode === 'gap' && d?.priorityRank ? '#fde047' : '#666', dashArray: "", fillOpacity: 0.85 });
            e.target.bringToFront();
          },
          mouseout: () => {
            censusLayerRef.current.resetStyle(layer);
            // Ensure priority zones stay on top
            if (overlayMode === "gap" && d?.priorityRank) {
               layer.bringToFront();
            }
          },
        });
      }
    });

    if (toggles.census) {
      censusLayerRef.current.addTo(mapRef.current);
      // Bring priority zones to front initially
      if (overlayMode === "gap") {
        censusLayerRef.current.eachLayer((layer) => {
           const key = buildFipsKey(layer.feature.properties.STATE, layer.feature.properties.COUNTY, layer.feature.properties.TRACT);
           const d = censusLookupRef.current[key];
           if (d && d.priorityRank) {
             layer.bringToFront();
           }
        });
      }
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const onMoveEnd = () => {
      setZoomLevel(map.getZoom());
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        handleMoveEnd();
      }, 400); // 400ms debounce as requested
    };

    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, []);

  const handleMoveEnd = async () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const zoom = map.getZoom();
    
    if (zoom < MIN_ZOOM) {
      Object.values(layersRef.current).forEach(layer => layer.clearLayers());
      if (censusLayerRef.current) {
        map.removeLayer(censusLayerRef.current);
        censusLayerRef.current = null;
      }
      setAreaStats({ avgPoverty: null, totalResources: 0, totalPop: 0, avgDensity: 0, topTract: null });
      return;
    }

    setLoading(true);
    try {
      const bounds = map.getBounds();
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = bounds.getWest();
      const east = bounds.getEast();
      const bboxStr = `${south},${west},${north},${east}`;
      const center = map.getCenter();

      Object.values(layersRef.current).forEach(layer => layer.clearLayers());

      const [overpassNodes, snapData, faData] = await Promise.all([
        fetchOverpassData(null, null, bboxStr),
        loadSnapCSV(),
        loadFeedingAmericaCSV()
      ]);

      const allResources = [];

      overpassNodes.forEach(node => {
        if (!node.lat || !node.lon) return;
        const type = classifyNode(node);
        if (type !== 'markets') return; 
        
        allResources.push({ lat: node.lat, lon: node.lon, type });
        L.marker([node.lat, node.lon], { icon: makeIcon(TYPE_COLORS[type]) })
          .bindTooltip(
            `<div style="font-family:system-ui;color:#111827;padding:4px">
              <div style="font-weight:800;font-size:14px;margin-bottom:2px">${node.tags.name || "Grocery Market"}</div>
              <div style="color:${TYPE_COLORS[type]};font-weight:700;font-size:11px">MARKET</div>
            </div>`, { sticky: true }
          )
          .addTo(layersRef.current[type]);
      });

      const visibleSnap = getSnapNearby(snapData, center.lat, center.lng, 50000, [south, west, north, east]);
      visibleSnap.forEach(row => {
        const lat = parseFloat(row.Latitude);
        const lon = parseFloat(row.Longitude);
        allResources.push({ lat, lon, type: 'snap' });
        L.marker([lat, lon], { icon: makeIcon(TYPE_COLORS.snap) })
          .bindTooltip(
            `<div style="font-family:system-ui;color:#111827;padding:4px">
              <div style="font-weight:800;font-size:14px;margin-bottom:2px">${row.Store_Name}</div>
              <div style="color:${TYPE_COLORS.snap};font-weight:700;font-size:11px">SNAP / EBT RETAILER</div>
            </div>`, { sticky: true }
          )
          .addTo(layersRef.current.snap);
      });

      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${center.lat}&lon=${center.lng}&format=json`);
      const geoData = await geoRes.json();
      let countyMatch = "";
      if (geoData.address && geoData.address.county) {
        countyMatch = geoData.address.county.replace(" County", "").trim();
      }

      if (countyMatch) {
        const visibleFA = getFoodbanksNearby(faData, countyMatch);
        visibleFA.forEach(row => {
          const lat = parseFloat(row.Latitude || row.lat || center.lat);
          const lon = parseFloat(row.Longitude || row.lon || center.lng);
          if (isNaN(lat) || isNaN(lon)) return;
          
          allResources.push({ lat, lon, type: 'pantries' });
          L.marker([lat, lon], { icon: makeIcon(TYPE_COLORS.pantries) })
            .bindTooltip(
              `<div style="font-family:system-ui;color:#111827;padding:4px">
                <div style="font-weight:800;font-size:14px;margin-bottom:2px">${row.Name}</div>
                <div style="color:${TYPE_COLORS.pantries};font-weight:700;font-size:11px">FOOD INSECURITY HELP</div>
              </div>`, { sticky: true }
            )
            .addTo(layersRef.current.pantries);
        });
      }

      const tigerUrl = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query?geometry=${west},${south},${east},${north}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson`;
      const tigerRes = await fetch(tigerUrl);
      const tigerGeo = await tigerRes.json();

      if (!tigerGeo.features || !tigerGeo.features.length) {
        setLoading(false);
        return;
      }

      const pairs = [...new Set(tigerGeo.features.map(f => `${String(f.properties.STATE).padStart(2, "0")}_${String(f.properties.COUNTY).padStart(3, "0")}`))];
      const censusLookup = {};
      
      await Promise.all(pairs.map(async (pair) => {
        const [state, county] = pair.split("_");
        const url = `https://api.census.gov/data/2022/acs/acs5?get=B17001_002E,B17001_001E,B19013_001E&for=tract:*&in=state:${state}+county:${county}`;
        try {
          const res = await fetch(url);
          const data = await res.json();
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
            const key = buildFipsKey(state, county, tract);
            
            censusLookup[key] = {
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

      // 2-Pass Scoring Pipeline
      let maxPoverty = 0;
      let maxPop = 0;
      let maxDensity = 0;

      let totalPovertyPop = 0;
      let totalBasePop = 0;
      let totalDensitySum = 0;
      let validTractCount = 0;
      
      const rawData = [];

      // Pass 1: Gather raw stats and minimums/maximums
      tigerGeo.features.forEach(feature => {
        const key = buildFipsKey(feature.properties.STATE, feature.properties.COUNTY, feature.properties.TRACT);
        const d = censusLookup[key];
        
        if (d && d.totalPop > 0) {
          const count = allResources.filter(r => pointInFeature([r.lon, r.lat], feature)).length;
          d.resourceCount = count;

          // Normalized density: resources per 1000 people
          const popFactor = Math.max(d.totalPop, 250) / 1000;
          const density = count / popFactor;
          d.density = density;

          if (d.povertyRate > maxPoverty) maxPoverty = d.povertyRate;
          if (d.totalPop > maxPop) maxPop = d.totalPop;
          if (density > maxDensity) maxDensity = density;

          totalPovertyPop += d.povertyPop;
          totalBasePop += d.totalPop;
          totalDensitySum += density;
          validTractCount++;

          // Desert Score (Legacy)
          d.desertScore = (d.povertyRate * 1.5) - (density * 10);

          rawData.push({ key, feature, d });
        }
      });

      // Pass 2: Calculate Z-scored / Clamped Gap Score
      let minGap = Infinity;
      let maxGap = -Infinity;

      rawData.forEach(item => {
        const { d } = item;
        // Normalize 0-1 across viewport
        const normPov = maxPoverty > 0 ? (d.povertyRate / maxPoverty) : 0;
        const normPop = maxPop > 0 ? (d.totalPop / maxPop) : 0;
        const normDen = maxDensity > 0 ? (d.density / maxDensity) : 0;

        // Gap Formula: High Poverty + High Pop - High Resources
        d.gapScore = (normPov * 2.5) + (normPop * 1.0) - (normDen * 3.0);

        if (d.gapScore < minGap) minGap = d.gapScore;
        if (d.gapScore > maxGap) maxGap = d.gapScore;
      });

      // Guard against identical min/max
      if (minGap === maxGap) {
        maxGap = minGap + 1;
      }

      // Rank top 5 Priority Zones
      rawData.sort((a, b) => b.d.gapScore - a.d.gapScore);
      const top5 = rawData.slice(0, 5);
      top5.forEach((item, idx) => {
        item.d.priorityRank = idx + 1;
      });

      // Save refs for decoupled rendering
      tigerGeoRef.current = tigerGeo;
      censusLookupRef.current = censusLookup;
      metaRef.current = { minGap, maxGap, topTract: top5[0] };

      renderCensusLayer();

      setAreaStats({
        avgPoverty: totalBasePop > 0 ? ((totalPovertyPop / totalBasePop) * 100).toFixed(1) : null,
        totalResources: allResources.length,
        totalPop: totalBasePop,
        avgDensity: validTractCount > 0 ? (totalDensitySum / validTractCount).toFixed(1) : 0,
        topTract: top5[0] ? top5[0].feature.properties.BASENAME || top5[0].feature.properties.TRACT : null
      });

    } catch (err) {
      console.error("MapExplorer fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zoomLevel >= MIN_ZOOM) {
      renderCensusLayer();
    }
  }, [overlayMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const layers = layersRef.current;

    if (layers.markets) toggles.markets ? map.addLayer(layers.markets) : map.removeLayer(layers.markets);
    if (layers.pantries) toggles.pantries ? map.addLayer(layers.pantries) : map.removeLayer(layers.pantries);
    if (layers.snap) toggles.snap ? map.addLayer(layers.snap) : map.removeLayer(layers.snap);
    if (censusLayerRef.current) toggles.census ? map.addLayer(censusLayerRef.current) : map.removeLayer(censusLayerRef.current);
  }, [toggles]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden", position: "relative" }}>
      
      <div style={{ width: 280, background: "var(--bg-primary)", borderRight: "2px solid var(--border-color)", display: "flex", flexDirection: "column", zIndex: 10, overflowY: "auto" }}>
        
        {/* Layer Toggles */}
        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Map Layers</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { id: "markets", label: "Grocery Markets", color: TYPE_COLORS.markets },
              { id: "pantries", label: "Food Insecurity Help", color: TYPE_COLORS.pantries },
              { id: "snap", label: "SNAP / EBT", color: TYPE_COLORS.snap },
              { id: "census", label: "Census Layer", color: "#9ca3af" },
            ].map((layer) => (
              <label key={layer.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={toggles[layer.id]}
                  onChange={(e) => setToggles((p) => ({ ...p, [layer.id]: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: layer.color }}
                />
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: layer.color }} />
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>{layer.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Analytics Mode */}
        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Analytics Mode</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="radio" checked={overlayMode === 'poverty'} onChange={() => setOverlayMode('poverty')} style={{ accentColor: "var(--text-primary)" }} />
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>Standard Poverty Rate</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="radio" checked={overlayMode === 'desert'} onChange={() => setOverlayMode('desert')} style={{ accentColor: "var(--color-desert)" }} />
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>Food Desert Heatmap</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="radio" checked={overlayMode === 'gap'} onChange={() => setOverlayMode('gap')} style={{ accentColor: "#dc2626" }} />
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "#dc2626" }}>Resource Gap Finder</span>
            </label>
          </div>
          {overlayMode === 'gap' && (
            <div style={{ marginTop: 12, fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
              Gap Scores identify high-priority investment areas by weighing tract population size and poverty rate against current resource density.
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            {overlayMode === 'poverty' ? 'Poverty Legend' : overlayMode === 'desert' ? 'Desert Score' : 'Gap Score (Dynamic)'}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(overlayMode === 'poverty' ? [
              { label: "Under 10%", color: "#fde68a" },
              { label: "10% – 20%", color: "#f59e0b" },
              { label: "20% – 30%", color: "#d97706" },
              { label: "30% – 40%", color: "#b45309" },
              { label: "Over 40%", color: "#7c2d12" },
            ] : overlayMode === 'desert' ? [
              { label: "Good Access (< -10)", color: "#059669" },
              { label: "Moderate (0 – 10)", color: "#fcd34d" },
              { label: "Low Access (10 – 30)", color: "#f59e0b" },
              { label: "High Need (30 – 50)", color: "#ea580c" },
              { label: "Severe Desert (> 50)", color: "#dc2626" },
            ] : [
              { label: "Lowest Gap (Bottom 20%)", color: "#059669" },
              { label: "Low Gap (20% – 40%)", color: "#84cc16" },
              { label: "Moderate Gap (40% - 60%)", color: "#fcd34d" },
              { label: "High Gap (60% - 80%)", color: "#f59e0b" },
              { label: "Critical Gap (Top 20%)", color: "#dc2626" },
            ]).map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 16, height: 16, background: item.color, border: "1px solid rgba(0,0,0,0.1)" }} />
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Map Area */}
      <div style={{ flex: 1, position: "relative" }}>
        
        {/* Floating Gap Summary Panel */}
        {overlayMode === 'gap' && zoomLevel >= MIN_ZOOM && (
          <div style={{
            position: "absolute", top: 24, left: 24, zIndex: 1000,
            background: "var(--bg-primary)", padding: 24, borderRadius: "var(--border-radius)",
            boxShadow: "var(--shadow-lg)", border: "2px solid #dc2626", width: 320
          }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 800, color: "#dc2626", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              ⚠️ Gap Summary
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Pop. Affected</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>{areaStats.totalPop ? areaStats.totalPop.toLocaleString() : "..."}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Avg Poverty</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>{areaStats.avgPoverty ? areaStats.avgPoverty + "%" : "..."}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Avg Density (per 1k)</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>{loading ? "..." : areaStats.avgDensity}</div>
            </div>

            <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 4 }}>#1 Priority Zone</div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#dc2626" }}>
                {loading ? "Calculating..." : areaStats.topTract ? `Tract ${areaStats.topTract}` : "None"}
              </div>
            </div>
          </div>
        )}

        {zoomLevel < MIN_ZOOM && (
          <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", background: "var(--bg-primary)", padding: "12px 24px", borderRadius: "100px", boxShadow: "var(--shadow-lg)", fontWeight: 700, color: "var(--text-primary)", zIndex: 1000, border: "2px solid var(--border-color)" }}>
            🔍 Zoom in to load geospatial data
          </div>
        )}
        
        {loading && zoomLevel >= MIN_ZOOM && (
          <div style={{ position: "absolute", bottom: 24, right: 24, background: "var(--bg-primary)", padding: "12px 24px", borderRadius: "100px", boxShadow: "var(--shadow-lg)", fontWeight: 700, color: "var(--color-market)", zIndex: 1000, border: "2px solid var(--color-market)", display: "flex", alignItems: "center", gap: 8 }}>
             <span className="spinner" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--color-market)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
             Analyzing Region...
             <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}