import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useViewportData } from "./hooks/useViewportData";
import { useMapStore } from "./store/useMapStore";

const MIN_ZOOM = 11;
const TYPE_COLORS = { markets: "#059669", pantries: "#2563eb", snap: "#d97706", health_bucks: "#7c3aed" };
const LAYER_META = [
  { key: "markets", label: "Grocery Markets" },
  { key: "pantries", label: "Food Pantries" },
  { key: "snap", label: "SNAP / EBT Retailers" },
  { key: "health_bucks", label: "Farmers Markets / Health Bucks" },
];

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color};box-shadow:0 0 10px ${color},0 0 20px ${color}40;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    tooltipAnchor: [0, -10],
  });
}

export default function ExecutiveReport() {
  const stats = useMapStore((state) => state.stats);
  const setExecutiveLocation = useMapStore((state) => state.setExecutiveLocation);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const censusLayerRef = useRef(null);
  const debounceRef = useRef(null);

  const [viewport, setViewport] = useState({ bounds: null, center: null, zoom: 13 });
  const [visibleLayers, setVisibleLayers] = useState({ markets: true, pantries: true, snap: true, health_bucks: true });

  const { loading, censusLookup, areaStats, geoData, allResources } = useViewportData(
    viewport.bounds, viewport.zoom, viewport.center, MIN_ZOOM
  );

  let criticalGapTracts = 0;
  if (geoData && geoData.features) {
    geoData.features.forEach(f => {
      const key = `${f.properties.STATE}${f.properties.COUNTY}${f.properties.TRACT}`;
      const d = censusLookup[key];
      if (d && d.isStrictDesert) criticalGapTracts++;
    });
  }

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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    layersRef.current = {
      markets: L.layerGroup().addTo(map),
      pantries: L.layerGroup().addTo(map),
      snap: L.layerGroup().addTo(map),
      health_bucks: L.layerGroup().addTo(map),
    };

    // Seed the shared executive-report location only when centered on a real search —
    // not the continental-US fallback, which isn't a location worth syncing to other tabs.
    if (stats && stats.lat && stats.lon) {
      setExecutiveLocation({ lat: stats.lat, lon: stats.lon });
    }

    setTimeout(() => {
      setViewport({
        bounds: map.getBounds(),
        center: map.getCenter(),
        zoom: map.getZoom(),
      });
    }, 500);

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const newCenter = map.getCenter();
        setViewport({
          bounds: map.getBounds(),
          center: newCenter,
          zoom: map.getZoom(),
        });
        // Track wherever the user pans so switching to Dashboard/Resources can
        // target this exact location — see setActiveView in useMapStore.
        setExecutiveLocation({ lat: newCenter.lat, lon: newCenter.lng });
      }, 400); // 400ms debounce
    };

    map.on("moveend", onMoveEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stats?.lat, stats?.lon]);

  // Render Markers
  useEffect(() => {
    if (!mapRef.current) return;
    
    Object.values(layersRef.current).forEach(layer => layer.clearLayers());

    if (viewport.zoom < MIN_ZOOM) return;

    allResources.forEach(res => {
      const type = res.type;
      if (!visibleLayers[type]) return;
      const color = TYPE_COLORS[type];
      let label = "MARKET";
      if (type === "snap") label = "SNAP / EBT RETAILER";
      if (type === "pantries") label = "FOOD INSECURITY HELP";
      if (type === "health_bucks") label = "FARMERS MARKET · HEALTH BUCKS";

      L.marker([res.lat, res.lon], { icon: makeIcon(color) })
        .bindTooltip(
          `<div style="font-family:system-ui;color:#111827;padding:4px">
            <div style="font-weight:800;font-size:14px;margin-bottom:2px">${res.name}</div>
            <div style="color:${color};font-weight:700;font-size:11px">${label}</div>
          </div>`, { sticky: true }
        )
        .addTo(layersRef.current[type]);
    });
  }, [allResources, viewport.zoom, visibleLayers]);

  // Render Census GeoJSON Layer
  useEffect(() => {
    if (!mapRef.current) return;

    if (censusLayerRef.current) {
      mapRef.current.removeLayer(censusLayerRef.current);
      censusLayerRef.current = null;
    }

    if (!geoData || viewport.zoom < MIN_ZOOM) return;

    // We utilize a WCAG-compliant colorblind palette. 
    // Orange (#ea580c) denotes a Critical Gap zone, while Blue (#2563eb) denotes a Covered zone.
    censusLayerRef.current = L.geoJSON(geoData, {
      style: (feature) => {
        const key = `${feature.properties.STATE}${feature.properties.COUNTY}${feature.properties.TRACT}`;
        const d = censusLookup[key];
        
        if (d && d.isStrictDesert === true) {
          return {
            fillColor: "#f97316",
            fillOpacity: 0.65,
            weight: 2.5,
            color: "#ea580c",
            dashArray: "",
            opacity: 0.8,
            className: "glowing-critical-tract"
          };
        } else {
          return {
            fillColor: "#3b82f6",
            fillOpacity: 0.3,
            weight: 1.5,
            color: "#2563eb",
            dashArray: "",
            opacity: 0.8,
            className: "glowing-covered-tract"
          };
        }
      },
      onEachFeature: (feature, layer) => {
        const key = `${feature.properties.STATE}${feature.properties.COUNTY}${feature.properties.TRACT}`;
        const d = censusLookup[key];
        const name = feature.properties.BASENAME || feature.properties.TRACT;
        const countyName = feature.properties.COUNTY ? `County FIPS ${feature.properties.COUNTY}` : "";
        const tractName = feature.properties.NAMELSAD || `Tract ${name}`;
        const locationHeader = countyName ? `${tractName} (${countyName})` : tractName;

        let extraStatsHtml = "";
        if (d && d.isStrictDesert) {
          extraStatsHtml = `
            <div style="background:#ef4444;color:white;padding:4px;border-radius:4px;font-weight:bold;margin-top:6px;font-size:11px;text-align:center;">
              ⚠️ CRITICAL GAP: High Poverty, No Resources
            </div>
          `;
        }

        const isUninhabited = !d || d.povertyRate == null;
        const povertyDisplay = isUninhabited 
          ? `<span style="font-weight:600;color:#9ca3af;font-size:11px">Uninhabited/No Data</span>` 
          : `<span style="font-weight:700;">${d.povertyRate.toFixed(1)}%</span>`;

        layer.bindTooltip(
          `<div style="font-family:system-ui;padding:4px;min-width:170px;">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:2px;">${locationHeader}</div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;align-items:center;">
              <span style="color:#6b7280;font-size:12px;font-weight:600">Poverty Rate</span>
              ${povertyDisplay}
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
            if (d && d.isStrictDesert === true) {
              e.target.setStyle({
                weight: 4.5,
                color: '#ea580c',
                dashArray: "",
                fillOpacity: 0.85
              });
              e.target.bringToFront();
            } else {
              e.target.setStyle({
                weight: 3.5,
                color: '#1d4ed8',
                dashArray: "",
                fillOpacity: 0.5
              });
              e.target.bringToFront();
            }
          },
          mouseout: (e) => {
            if (d && d.isStrictDesert === true) {
              e.target.setStyle({
                fillColor: "#f97316",
                weight: 2.5,
                color: "#ea580c",
                fillOpacity: 0.65,
                opacity: 0.8
              });
              e.target.bringToFront();
            } else {
              e.target.setStyle({
                fillColor: "#3b82f6",
                weight: 1.5,
                color: "#2563eb",
                fillOpacity: 0.3,
                opacity: 0.8
              });
            }
          },
        });
      }
    });

    censusLayerRef.current.addTo(mapRef.current);
    censusLayerRef.current.eachLayer((layer) => {
       if (layer.feature && layer.feature.properties) {
         const key = `${layer.feature.properties.STATE}${layer.feature.properties.COUNTY}${layer.feature.properties.TRACT}`;
         const d = censusLookup[key];
         if (d && d.isStrictDesert) layer.bringToFront();
       }
     });
  }, [geoData, censusLookup, viewport.zoom]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden", position: "relative" }}>
      
      <div style={{ width: 280, background: "var(--bg-primary)", borderRight: "2px solid var(--border-color)", display: "flex", flexDirection: "column", zIndex: 10, overflowY: "auto" }}>
        
        {/* Executive Header */}
        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Executive Report</h2>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Actionable gap analysis of real-time census tracts. Designed for strategic resource allocation and planning.
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Map Legend
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 16, height: 16, background: "#f97316", border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--text-primary)", display: "block" }}>🟠 Orange = Critical Gap</span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginTop: 2 }}>Tracts with &gt;20% poverty and ZERO resources.</span>
              </div>
            </div>
            
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 16, height: 16, background: "#3b82f6", border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--text-primary)", display: "block" }}>🔵 Blue = Covered</span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginTop: 2 }}>Tracts with resources or &lt;20% poverty.</span>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Visible Resource Layers</h3>
            {LAYER_META.map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={visibleLayers[key]}
                  onChange={() => setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                  style={{ width: 16, height: 16, accentColor: TYPE_COLORS[key], cursor: "pointer" }}
                />
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: TYPE_COLORS[key], flexShrink: 0 }} />
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Area Snapshot */}
        <div style={{ padding: 24, flex: 1 }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Area Snapshot</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--border-radius)", padding: "12px", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap" }}>Avg Poverty Rate</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)" }}>{areaStats.avgPoverty ? areaStats.avgPoverty + "%" : "..."}</div>
            </div>
            <div style={{ background: "#fff7ed", borderRadius: "var(--border-radius)", padding: "12px", border: "1px solid #ffedd5" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#c2410c", textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap" }}>Critical Gaps</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#ea580c", display: "flex", alignItems: "baseline", gap: "4px" }}>
                {loading ? "..." : criticalGapTracts}
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#c2410c" }}>in view</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Map Area */}
      <div style={{ flex: 1, position: "relative" }}>
        
        {viewport.zoom < MIN_ZOOM && (
          <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", background: "var(--bg-primary)", padding: "12px 24px", borderRadius: "100px", boxShadow: "var(--shadow-lg)", fontWeight: 700, color: "var(--text-primary)", zIndex: 1000, border: "2px solid var(--border-color)" }}>
            🔍 Zoom in to load geospatial data
          </div>
        )}
        
        {loading && viewport.zoom >= MIN_ZOOM && (
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