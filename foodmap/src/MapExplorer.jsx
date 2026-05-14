import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TYPE_COLORS = { markets: "#059669", pantries: "#2563eb", snap: "#d97706" };

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color};box-shadow:0 0 10px ${color},0 0 20px ${color}40;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
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

function formatCurrency(val) {
  if (val == null || val < 0) return "N/A";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

// Simple point-in-polygon ray casting algorithm
function pointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(pt, feature) {
  const geom = feature.geometry;
  if (!geom) return false;
  
  const checkPoly = (poly) => pointInPolygon(pt, poly[0]);
  
  if (geom.type === "Polygon") {
    return checkPoly(geom.coordinates);
  } else if (geom.type === "MultiPolygon") {
    return geom.coordinates.some(poly => checkPoly(poly));
  }
  return false;
}

export default function MapExplorer({ stats }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const censusLayerRef = useRef(null);

  const [toggles, setToggles] = useState({
    markets: true,
    pantries: true,
    snap: true,
    census: true,
  });
  
  const [activeOverlay, setActiveOverlay] = useState("poverty"); // 'poverty' | 'income'
  const [loading, setLoading] = useState(false);
  const [areaStats, setAreaStats] = useState({ avgPoverty: null });

  // Handle map init and cleanup
  useEffect(() => {
    if (!stats.lat || !stats.lon || !mapContainerRef.current) return;
    
    // Cleanup any existing instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [stats.lat, stats.lon],
      zoom: 13,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    layersRef.current = {
      markets: L.layerGroup().addTo(map),
      pantries: L.layerGroup().addTo(map),
      snap: L.layerGroup().addTo(map),
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stats.lat, stats.lon]);

  // Fetch Census Data & Plot
  useEffect(() => {
    if (!mapRef.current || !stats.lat || !stats.lon) return;
    const map = mapRef.current;
    
    async function fetchData() {
      setLoading(true);
      
      try {
        // Clear layers
        Object.values(layersRef.current).forEach(layer => layer.clearLayers());
        if (censusLayerRef.current) {
          map.removeLayer(censusLayerRef.current);
          censusLayerRef.current = null;
        }

        // Plot resources
        const resources = stats.resources || [];
        resources.forEach(r => {
          if (!r.lat || !r.lon) return;
          const color = TYPE_COLORS[r.type];
          if (!color) return;

          L.marker([r.lat, r.lon], { icon: makeIcon(color) })
            .bindPopup(`<div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;padding:4px">
              <div style="font-weight:800;font-size:16px;margin-bottom:4px">${r.name}</div>
              <div style="color:${color};font-weight:700;font-size:12px;letter-spacing:0.5px">${r.type.toUpperCase()}</div>
            </div>`)
            .addTo(layersRef.current[r.type]);
        });

        // Fetch Tigerweb GeoJSON
        const geoUrl = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query?geometry=${stats.lon},${stats.lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson&distance=5000&units=esriSRUnit_Meter`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (!geoData.features || !geoData.features.length) {
          setLoading(false);
          return;
        }

        // Extract unique State/County pairs
        const pairs = [...new Set(geoData.features.map(f => `${f.properties.STATE}_${f.properties.COUNTY}`))];
        
        // Fetch Census Data
        const censusLookup = {};
        let totalPovertySum = 0;
        let validTracts = 0;

        await Promise.all(pairs.map(async pair => {
          const [state, county] = pair.split('_');
          const url = `https://api.census.gov/data/2022/acs/acs5?get=B17001_002E,B17001_001E,B19013_001E&for=tract:*&in=state:${state}+county:${county}`;
          
          try {
            const res = await fetch(url);
            const data = await res.json();
            if (!Array.isArray(data) || data.length < 2) return;

            const headers = data[0];
            const idxB17001_002E = headers.indexOf("B17001_002E"); // poverty
            const idxB17001_001E = headers.indexOf("B17001_001E"); // total pop
            const idxB19013_001E = headers.indexOf("B19013_001E"); // median income
            const idxTract = headers.indexOf("tract");

            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              const pov = parseInt(row[idxB17001_002E]);
              const tot = parseInt(row[idxB17001_001E]);
              const inc = parseInt(row[idxB19013_001E]);
              const tract = row[idxTract];

              if (isNaN(pov) || isNaN(tot) || tot <= 0 || pov < 0 || inc === -666666666) {
                continue; // suppressions
              }

              const rate = (pov / tot) * 100;
              censusLookup[`${state}${county}${tract}`] = { povertyRate: rate, medianIncome: inc };
              totalPovertySum += rate;
              validTracts++;
            }
          } catch (err) {
            console.error("Census API error for", state, county, err);
          }
        }));

        setAreaStats({ avgPoverty: validTracts > 0 ? (totalPovertySum / validTracts).toFixed(1) : null });

        // Add GeoJSON Layer
        censusLayerRef.current = L.geoJSON(geoData, {
          style: (feature) => {
            const key = `${feature.properties.STATE}${feature.properties.COUNTY}${feature.properties.TRACT}`;
            const data = censusLookup[key];
            const rate = data ? data.povertyRate : null;
            return {
              fillColor: getPovertyColor(rate),
              weight: 2,
              opacity: 1,
              color: 'white',
              dashArray: '3',
              fillOpacity: 0.6
            };
          },
          onEachFeature: (feature, layer) => {
            const key = `${feature.properties.STATE}${feature.properties.COUNTY}${feature.properties.TRACT}`;
            const data = censusLookup[key];
            const name = feature.properties.BASENAME || feature.properties.TRACT;
            
            // Count resources in tract
            const count = resources.filter(r => pointInFeature([r.lon, r.lat], feature)).length;

            layer.bindTooltip(`<div style="font-family:system-ui,-apple-system,sans-serif;padding:8px;min-width:180px;">
              <div style="font-weight:800;font-size:16px;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Tract ${name}</div>
              <div style="display:flex;justify-content:space-between;margin-top:8px;">
                <span style="color:#6b7280;font-size:12px;font-weight:600">Poverty Rate</span>
                <span style="font-weight:700;color:${getPovertyColor(data?.povertyRate)}">${data && data.povertyRate != null ? data.povertyRate.toFixed(1) + '%' : 'N/A'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px;">
                <span style="color:#6b7280;font-size:12px;font-weight:600">Median Income</span>
                <span style="font-weight:700">${data ? formatCurrency(data.medianIncome) : 'N/A'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px;">
                <span style="color:#6b7280;font-size:12px;font-weight:600">Resources</span>
                <span style="font-weight:700">${count}</span>
              </div>
            </div>`, { sticky: true });
            
            layer.on({
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({ weight: 4, color: '#666', dashArray: '', fillOpacity: 0.7 });
                layer.bringToFront();
              },
              mouseout: (e) => {
                censusLayerRef.current.resetStyle(e.target);
              }
            });
          }
        }).addTo(map);

      } catch (err) {
        console.error("MapExplorer data fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [stats.lat, stats.lon, stats.resources]);

  // Handle Layer Toggles
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const layers = layersRef.current;
    if (layers.markets) { toggles.markets ? map.addLayer(layers.markets) : map.removeLayer(layers.markets); }
    if (layers.pantries) { toggles.pantries ? map.addLayer(layers.pantries) : map.removeLayer(layers.pantries); }
    if (layers.snap) { toggles.snap ? map.addLayer(layers.snap) : map.removeLayer(layers.snap); }
    
    if (censusLayerRef.current) {
      toggles.census ? map.addLayer(censusLayerRef.current) : map.removeLayer(censusLayerRef.current);
    }
  }, [toggles]);

  if (!stats.lat || !stats.lon) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "48px", marginBottom: 16 }}>📍</div>
          <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, letterSpacing: "1px", marginBottom: 8 }}>SEARCH REQUIRED</div>
          <div style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Use the Dashboard view to search for a location<br />before exploring census overlays.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden", position: "relative" }}>
      {/* Export Button */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 1000 }}>
        <button className="btn-primary" onClick={() => window.print()} style={{ padding: "8px 16px", fontSize: "14px", boxShadow: "var(--shadow-md)" }}>
          🖨️ Export Map
        </button>
      </div>

      {/* Sidebar Panel */}
      <div style={{ width: 260, background: "var(--bg-primary)", borderRight: "2px solid var(--border-color)", display: "flex", flexDirection: "column", zIndex: 10 }}>
        
        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Map Layers</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { id: 'markets', label: 'Grocery Markets', color: TYPE_COLORS.markets },
              { id: 'pantries', label: 'Food Pantries', color: TYPE_COLORS.pantries },
              { id: 'snap', label: 'SNAP / EBT', color: TYPE_COLORS.snap },
              { id: 'census', label: 'Census Overlay', color: '#9ca3af' },
            ].map(layer => (
              <label key={layer.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={toggles[layer.id]} 
                  onChange={(e) => setToggles(p => ({ ...p, [layer.id]: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: layer.color }}
                />
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: layer.color }} />
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>{layer.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Census Metric</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="radio" checked={activeOverlay === 'poverty'} onChange={() => setActiveOverlay('poverty')} name="overlay" style={{ accentColor: "var(--color-market)" }} />
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>Poverty Rate</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="radio" checked={activeOverlay === 'income'} onChange={() => setActiveOverlay('income')} name="overlay" style={{ accentColor: "var(--color-market)" }} disabled title="Not implemented in current scope" />
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-muted)" }}>Median Income</span>
            </label>
          </div>
        </div>

        <div style={{ padding: 24, borderBottom: "2px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Poverty Legend</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: 'Under 10%', color: '#fde68a' },
              { label: '10% – 20%', color: '#f59e0b' },
              { label: '20% – 30%', color: '#d97706' },
              { label: '30% – 40%', color: '#b45309' },
              { label: 'Over 40%', color: '#7c2d12' },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 16, height: 16, background: item.color, border: "1px solid rgba(0,0,0,0.1)" }} />
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 24, flex: 1, background: "var(--bg-secondary)" }}>
          <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: "var(--border-radius)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Area Snapshot</div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: areaStats.avgPoverty ? (areaStats.avgPoverty > 12.4 ? "#dc2626" : "#059669") : "var(--text-primary)", lineHeight: 1 }}>
              {loading ? "..." : areaStats.avgPoverty ? `${areaStats.avgPoverty}%` : "N/A"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.4, fontWeight: 500 }}>
              Average poverty rate across tracts in this view.
              <br/><br/>
              <strong>National Average: 12.4%</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Main Map */}
      <div style={{ flex: 1, position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--bg-primary)", padding: "16px 24px", borderRadius: "100px", boxShadow: "var(--shadow-lg)", fontWeight: 700, color: "var(--color-market)" }}>
              Fetching Census Data...
            </div>
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>

    </div>
  );
}
