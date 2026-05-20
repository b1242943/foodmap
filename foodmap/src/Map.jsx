import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Papa from "papaparse";
import { loadSnapCSV, loadFeedingAmericaCSV, fetchOverpassData, classifyNode, getSnapNearby, getFoodbanksNearby, computeScore, haversineDistance } from "./utils/dataFetchers";

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
    loadFeedingAmericaCSV().catch((err) =>
      console.error("Failed to preload FA CSV:", err)
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
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=1${countryParam}`
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

      let searchBbox = null;
      let overpassBbox = null;

      if (geoData[0].boundingbox) {
        const bbox = geoData[0].boundingbox;
        const southLat = parseFloat(bbox[0]);
        const northLat = parseFloat(bbox[1]);
        const westLon = parseFloat(bbox[2]);
        const eastLon = parseFloat(bbox[3]);
        
        const latDiff = Math.abs(northLat - southLat);
        const lonDiff = Math.abs(eastLon - westLon);
        
        if (latDiff > 0.1 || lonDiff > 0.1) {
          map.flyTo([lat, lon], 14, { duration: 1.5 });
        } else {
          const bounds = [
            [southLat, westLon],
            [northLat, eastLon]
          ];
          const targetZoom = map.getBoundsZoom(bounds);
          if (targetZoom < 13) {
            map.flyTo([lat, lon], 13, { duration: 1.5 });
          } else {
            map.flyToBounds(bounds, { duration: 1.5, maxZoom: 16 });
          }
          searchBbox = [southLat, westLon, northLat, eastLon];
          overpassBbox = `${southLat},${westLon},${northLat},${eastLon}`;
        }
      } else {
        map.flyTo([lat, lon], 14, { duration: 1.5 });
      }
      Object.values(layers).forEach((lg) => lg.clearLayers());

      const counts = { markets: 0, pantries: 0, snap: 0, desert: 0 };
      const resources = [];

      const isZipSearch = /^\d{5}$/.test(searchQuery.trim());
      const searchRadius = isZipSearch ? 2500 : 5000;

      // Overpass: markets + pantries + EBT-tagged locations
      const nodes = await fetchOverpassData(lat, lon, isZipSearch ? null : overpassBbox, searchRadius);
      nodes.forEach((node) => {
        const itemLat = node.lat || node.center?.lat;
        const itemLon = node.lon || node.center?.lon;
        if (!itemLat || !itemLon) return;

        const key = classifyNode(node);
        const { color, type } = layerColors[key];
        const name = node.tags?.name || "Unnamed Location";
        
        if (!node.processedAddress && name === "Unnamed Location") return;

        const hours = node.tags?.opening_hours || "";
        const phone = node.tags?.phone || "";
        const detail = node.processedAddress || "Address not available";
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
      const nearbySnap = getSnapNearby(snapData, lat, lon, searchRadius, searchBbox, isZipSearch ? searchQuery.trim() : null);

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

      // CSV: Feeding America Foodbanks
      const faData = await loadFeedingAmericaCSV();
      const countyName = geoData[0].address?.county || geoData[0].display_name.split(',').find(p => p.includes('County'))?.trim() || "";
      const nearbyFA = getFoodbanksNearby(faData, countyName);

      nearbyFA.forEach((row) => {
        const rlat = parseFloat(row.Latitude);
        const rlon = parseFloat(row.Longitude);
        const name = row.Name || "Feeding America Food Bank";
        const address = row.Address || "";
        const distance = isNaN(rlat) || isNaN(rlon) ? null : haversineDistance(lat, lon, rlat, rlon);
        const { color, type } = layerColors.pantries;

        if (rlat && rlon) {
          L.marker([rlat, rlon], { icon: makeIcon(color) })
            .bindPopup(
              `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;min-width:200px;padding:4px">
                <div style="font-weight:800;font-size:18px;margin-bottom:8px;line-height:1.2">${name}</div>
                <div style="color:${color};font-weight:700;font-size:12px;letter-spacing:0.5px;margin-bottom:8px;text-transform:uppercase">${type}</div>
                <div style="color:#374151;font-size:16px;line-height:1.5">${address}</div>
              </div>`
            )
            .addTo(layers.pantries);
        }

        counts.pantries++;
        resources.push({
          name,
          type: "pantries",
          detail: address,
          distance: distance ? parseFloat(distance) : null,
          lat: rlat,
          lon: rlon,
          source: 'feeding_america',
          phone: row.Phone,
          attributes: row.Services ? row.Services.split(',') : [],
          website: row.Website,
          organization: row.Name
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
