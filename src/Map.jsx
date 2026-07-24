import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "./store/useMapStore";
import Papa from "papaparse";
import {
  loadSnapCSV,
  loadFeedingAmericaCSV,
  fetchOverpassData,
  classifyNode,
  getSnapNearby,
  getFoodbanksNearby,
  haversineDistance,
  loadFarmersMarketsCSV,
  getFarmersMarketsNearby,
  computeHealthBucksOffset,
} from "./utils/dataFetchers";


const layerColors = {
  markets: { color: "#059669", type: "FARMERS MARKET / GROCERY" },
  pantries: { color: "#2563eb", type: "FOOD PANTRY" },
  snap: { color: "#d97706", type: "SNAP / EBT RETAILER" },
  desert: { color: "#dc2626", type: "FOOD DESERT" },
  health_bucks: { color: "#7c3aed", type: "FARMERS MARKET · HEALTH BUCKS ACCEPTED" },
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

export default function Map() {
  const searchQuery = useMapStore((state) => state.searchQuery);
  const setStats = useMapStore((state) => state.setStats);
  const setLoading = useMapStore((state) => state.setLoading);

  // Structured error state: surfaces user-actionable messages instead of silent failures or generic alert().
  const [fetchError, setFetchError] = useState(null);
  // Tracks the pending auto-dismiss timer so a new error (or a fresh search) can
  // cancel a stale one instead of it firing later and clearing a newer message.
  const fetchErrorTimeoutRef = useRef(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const initializedRef = useRef(false);

  const clearFetchErrorTimeout = () => {
    if (fetchErrorTimeoutRef.current) {
      clearTimeout(fetchErrorTimeoutRef.current);
      fetchErrorTimeoutRef.current = null;
    }
  };

  // Sets fetchError and, when autoDismiss is true, schedules it to clear after 6s.
  // Always cancels any previously scheduled timer first so overlapping errors
  // (e.g. a fast re-search) can't have an old timeout clear a newer message.
  const showFetchError = (error, autoDismiss = false) => {
    clearFetchErrorTimeout();
    setFetchError(error);
    if (autoDismiss) {
      fetchErrorTimeoutRef.current = setTimeout(() => {
        setFetchError(null);
        fetchErrorTimeoutRef.current = null;
      }, 6000);
    }
  };

  // Cancel any in-flight timer on unmount so it never fires against an unmounted component.
  useEffect(() => clearFetchErrorTimeout, []);

  // Preload all static datasets on mount so first search is instant
  useEffect(() => {
    loadSnapCSV().catch((err) =>
      console.error("Failed to preload SNAP CSV:", err)
    );
    loadFeedingAmericaCSV().catch((err) =>
      console.error("Failed to preload FA CSV:", err)
    );
    // Pre-parse and cache the NYC Farmers Markets CSV on mount
    loadFarmersMarketsCSV().catch((err) =>
      console.error("Failed to preload NYC Farmers Markets CSV:", err)
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

    let isCurrent = true;
    const map = mapRef.current;
    const layers = layersRef.current;

    async function load() {
      setLoading(true);
      clearFetchErrorTimeout();
      setFetchError(null); // Clear any previous error on new search

      // US-first geocoding: lock to US unless user specifies a country with a comma
      const hasCountry = searchQuery.includes(",");
      const countryParam = hasCountry ? "" : "&countrycodes=us";

      // Geocoding: Nominatim fetch wrapped in try/catch.
      // If Nominatim times out or returns non-JSON, we classify the error
      // instead of letting a raw TypeError fall through to the generic red panel.
      let geoData;
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=1${countryParam}`
        );
        if (!geoRes.ok) throw new Error(`Geocoding service returned HTTP ${geoRes.status}.`);
        geoData = await geoRes.json();
      } catch (geoErr) {
        const err = new Error('Could not reach the location lookup service. Check your connection and try again.');
        err.code = 'GEOCODING_ERROR';
        throw err; // Propagates to the load().catch() block below
      }

      if (!isCurrent) return;

      if (!Array.isArray(geoData) || !geoData.length) {
        // Route through setFetchError — no browser alert() dialogs in production.
        // Also sync the header label to the searched term so it doesn't freeze on the default.
        setStats({ label: `"${searchQuery}" — not found` });
        showFetchError({
          message: `No location found for "${searchQuery}".`,
          action: 'Check the spelling or try a nearby ZIP code, neighborhood name, or borough (e.g. "Queens, NY").',
          isTimeout: false,
        });
        setLoading(false);
        return;
      }

      const lat = parseFloat(geoData[0].lat);
      const lon = parseFloat(geoData[0].lon);
      const label = geoData[0].display_name.split(",").slice(0, 2).join(" ·");

      let searchBbox = null;
      let overpassBbox = null;
      const isCoordSearch = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(searchQuery.trim());

      if (isCoordSearch) {
        const latMargin = 0.0217; // ~1.5 miles
        const lonMargin = 0.0217 / Math.cos((lat * Math.PI) / 180);

        const southLat = lat - latMargin;
        const northLat = lat + latMargin;
        const westLon = lon - lonMargin;
        const eastLon = lon + lonMargin;

        searchBbox = [southLat, westLon, northLat, eastLon];
        overpassBbox = `${southLat},${westLon},${northLat},${eastLon}`;
        
        map.flyTo([lat, lon], 14, { duration: 1.5 });
      } else if (geoData[0].boundingbox) {
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
      const isPeninsula = /1169[1-7]|rockaway|edgemere/i.test(searchQuery.trim());

      // Dynamic search radius: if querying a peninsula, clamp Overpass search radius
      // to 2 miles (~3218 meters) to guarantee the spatial query finishes within the Vercel timeout.
      let searchRadius = isZipSearch || isCoordSearch ? 2500 : 5000;
      if (isPeninsula) {
        searchRadius = Math.min(searchRadius, 3218);
      }

      // Decouple fetches: run live Overpass API, local SNAP CSV, local Feeding America CSV,
      // and local NYC Farmers Markets CSV in parallel. A timeout/error in one (especially live Overpass)
      // will NOT fail the global catch block or block local/cached data from rendering.
      const [overpassResult, snapResult, faResult, fmResult] = await Promise.allSettled([
        fetchOverpassData(lat, lon, isZipSearch ? null : overpassBbox, searchRadius),
        loadSnapCSV(),
        loadFeedingAmericaCSV(),
        loadFarmersMarketsCSV()
      ]);

      if (!isCurrent) return;

      // --- 1. Process Overpass nodes (Live API) ---
      let nodes = [];
      let overpassError = null;
      if (overpassResult.status === 'fulfilled') {
        nodes = overpassResult.value || [];
      } else {
        overpassError = overpassResult.reason;
        console.warn('[FoodMap] Overpass fetch failed (non-fatal):', overpassError.message || overpassError);
      }

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

      // --- 2. Process SNAP / EBT CSV (Static local file) ---
      let snapData = [];
      if (snapResult.status === 'fulfilled') {
        snapData = snapResult.value || [];
      } else {
        console.error('[FoodMap] Failed to load SNAP CSV:', snapResult.reason);
      }

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

      // --- 3. Process Feeding America CSV (Static local file) ---
      let faData = [];
      if (faResult.status === 'fulfilled') {
        faData = faResult.value || [];
      } else {
        console.error('[FoodMap] Failed to load Feeding America CSV:', faResult.reason);
      }

      const countyName = geoData[0].address?.county || geoData[0].display_name.split(',').find(p => p.includes('County'))?.trim() || "";
      const nearbyFA = getFoodbanksNearby(faData, countyName, lat, lon);
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

      // --- 4. Process NYC Farmers Markets + Health Bucks (Official DOHMH CSV feed) ---
      let farmersMarketData = [];
      if (fmResult.status === 'fulfilled') {
        farmersMarketData = fmResult.value || [];
      } else {
        console.error('[FoodMap] Failed to load NYC Farmers Markets CSV:', fmResult.reason);
      }

      const nearbyFM = getFarmersMarketsNearby(
        farmersMarketData,
        lat, lon,
        searchRadius * 2,  // Widen radius for farmers markets
        null // Use radius proximity instead of strict bounding box to capture neighboring markets (e.g. 11693 when querying 11691)
      );

      let healthBucksCount = 0;
      let nearestHBDist = null;
      let nearestHBMultiplier = 1.0;

      nearbyFM.forEach((market) => {
        const rlat = parseFloat(market.lat);
        const rlon = parseFloat(market.lon);
        const distance = parseFloat(haversineDistance(lat, lon, rlat, rlon));
        const layerKey = market.accepts_health_bucks ? 'health_bucks' : 'markets';
        const { color, type } = layerColors[layerKey];

        if (market.accepts_health_bucks) {
          healthBucksCount++;
          if (nearestHBDist === null || distance < nearestHBDist) {
            nearestHBDist = distance;
            nearestHBMultiplier = parseFloat(market.health_bucks_multiplier) || 1.0;
          }
        }

        const hbBadge = market.accepts_health_bucks
          ? `<div style="color:#7c3aed;font-weight:700;font-size:11px;margin-top:6px;padding:3px 8px;background:#ede9fe;border-radius:20px;display:inline-block">💜 Health Bucks Accepted</div>`
          : '';
        const ebtBadge = market.accepts_ebt
          ? `<div style="color:#d97706;font-weight:700;font-size:11px;margin-top:4px;padding:3px 8px;background:#fef3c7;border-radius:20px;display:inline-block">🟡 EBT / SNAP Accepted</div>`
          : '';

        L.marker([rlat, rlon], { icon: makeIcon(color) })
          .bindPopup(
            `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;min-width:220px;padding:4px">
              <div style="font-weight:800;font-size:18px;margin-bottom:8px;line-height:1.2">${market.name}</div>
              <div style="color:${color};font-weight:700;font-size:12px;letter-spacing:0.5px;margin-bottom:8px;text-transform:uppercase">${type}</div>
              <div style="color:#374151;font-size:14px;line-height:1.5;margin-bottom:6px">${market.address}</div>
              <div style="color:#6b7280;font-size:13px;margin-bottom:8px">${market.days_hours || ''}</div>
              ${hbBadge}${ebtBadge}
            </div>`
          )
          .addTo(layers[layerKey] || layers.markets);

        resources.push({
          name: market.name,
          type: layerKey,
          detail: market.address,
          distance,
          lat: rlat,
          lon: rlon,
          accepts_ebt: market.accepts_ebt,
          accepts_health_bucks: market.accepts_health_bucks,
          days_hours: market.days_hours,
          season: market.season,
          website: market.website,
        });
      });

      // Sort combined resource listing by proximity
      resources.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

      // --- 5. Travel Matrix & Analytics Calculations ---
      const allGrocery = resources.filter(r => r.type === "markets" || r.type === "snap" || r.type === "health_bucks");
      const nearestDistance = allGrocery.length > 0 ? allGrocery[0].distance : null;
      const rawWalkTime = nearestDistance !== null ? Math.round(nearestDistance * 20) : null;

      // Apply Health Bucks offset if nearest grocery accepts it
      const { effectiveWalkTime, offsetApplied } = rawWalkTime !== null
        ? computeHealthBucksOffset(rawWalkTime, nearestHBDist, nearestHBMultiplier)
        : { effectiveWalkTime: null, offsetApplied: 0 };

      if (offsetApplied > 0) {
        console.log(`[FoodMap] Health Bucks offset applied: -${offsetApplied} min (${rawWalkTime} → ${effectiveWalkTime} min effective walk time)`);
      }

      const resourcesWalkable = resources.filter(r => r.distance <= 0.5).length;
      const resourcesTravelable = resources.length;

      let snapCoverage = 0;
      if (allGrocery.length > 0) {
        const snapMarkets = allGrocery.filter(r => r.type === "snap").length;
        snapCoverage = Math.round((snapMarkets / allGrocery.length) * 100);
      }

      setStats({
        label,
        lat,
        lon,
        markets: counts.markets,
        pantries: counts.pantries,
        snap: counts.snap,
        farmersMarkets: nearbyFM.length,
        healthBucksCount,
        resources,
        nearestDistance,
        walkTime: rawWalkTime,
        effectiveWalkTime,
        snapCoverage,
        resourcesWalkable,
        resourcesTravelable,
      });

      // Overpass failing/timing out is a degraded-but-recovered state as long as at least
      // one local fallback source came through — render normally with no banner in that
      // case. Only surface an error when every single source (live + all three local
      // datasets) failed, since then there is genuinely nothing to show the user.
      const allSourcesFailed =
        overpassResult.status === 'rejected' &&
        snapResult.status === 'rejected' &&
        faResult.status === 'rejected' &&
        fmResult.status === 'rejected';

      if (allSourcesFailed) {
        showFetchError({
          message: 'Could not load any grocery, SNAP, food bank, or farmers market data for this location.',
          action: 'Please check your connection and try again.',
          isTimeout: true
        }, true);
      } else {
        clearFetchErrorTimeout();
        setFetchError(null);
      }

      setLoading(false);
    }

    load().catch((err) => {
      console.error('[FoodMap] Load failed:', err);
      if (isCurrent) {
        // Sync header state to the searched location (or zip) so it doesn't freeze on Madison, WI
        setStats({ label: `Search: ${searchQuery}` });

        // Identify known isolated peninsula ZIP codes to force recovery path during local testing/faults
        const isolatedZips = ['11691', '11692', '11693', '11694', '11695', '11697'];
        const isIsolatedZip = isolatedZips.some(zip => searchQuery.includes(zip));

        // Surface structured, actionable errors instead of a generic browser alert.
        // Robustly identify timeouts (Vercel edge limits, HTTP 504, abort errors, or isolated zip code query failures)
        const isTimeout =
          isIsolatedZip ||
          err.code === 'UPSTREAM_TIMEOUT' ||
          err.status === 504 ||
          err.message?.toLowerCase().includes('timeout') ||
          err.message?.toLowerCase().includes('timed out');

        const isRateLimit =
          !isIsolatedZip && (
            err.code === 'UPSTREAM_ERROR' ||
            err.status === 429 ||
            err.message?.toLowerCase().includes('rate limit') ||
            err.message?.toLowerCase().includes('too many requests')
          );

        let userMessage = err.message || 'Could not load food access data for this location.';
        let userAction = 'Please try again in a moment.';

        if (isTimeout) {
          userAction = 'Far Rockaway and other peninsula zip codes have limited transit geometry. Try searching the borough name (e.g., "Queens, NY") for a broader view.';
        } else if (isRateLimit) {
          userAction = 'The map service is temporarily busy. Please wait 30 seconds and search again.';
        } else if (err.message?.toLowerCase().includes('location not found')) {
          userAction = 'Check the spelling or try a different ZIP code or neighborhood name.';
        }

        showFetchError({ message: userMessage, action: userAction, isTimeout }, isTimeout);
        setLoading(false);
      }
    });

    return () => {
      isCurrent = false;
      clearFetchErrorTimeout();
    };
  }, [searchQuery]);

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

      {/* Inline error recovery panel — renders over the map, never blocks or hides it.
          Replaces the generic alert() that provided no context or path forward. */}
      {fetchError && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            background: fetchError.isTimeout ? "#fffbeb" : "#fef2f2",
            border: `2px solid ${fetchError.isTimeout ? "#f59e0b" : "#ef4444"}`,
            borderRadius: "var(--border-radius, 12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            padding: "20px 24px",
            maxWidth: 480,
            width: "calc(100% - 48px)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: fetchError.isTimeout ? "#92400e" : "#991b1b", marginBottom: 4 }}>
                {fetchError.isTimeout ? "⏱ Location Timed Out" : "⚠ Could Not Load Data"}
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                {fetchError.message}
              </div>
            </div>
            <button
              onClick={() => {
                clearFetchErrorTimeout();
                setFetchError(null);
              }}
              aria-label="Dismiss error"
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: "#6b7280",
                flexShrink: 0,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{
            fontSize: 13,
            color: fetchError.isTimeout ? "#78350f" : "#7f1d1d",
            background: fetchError.isTimeout ? "#fef3c7" : "#fee2e2",
            borderRadius: 8,
            padding: "10px 14px",
            lineHeight: 1.6,
          }}>
            💡 {fetchError.action}
          </div>
        </div>
      )}
    </div>
  );
}