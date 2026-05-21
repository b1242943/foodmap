/* eslint-disable no-restricted-globals */
/**
 * gisWorker.js — Off-main-thread GIS spatial processing
 *
 * Receives: { features, lookup, resources }
 *   - features: GeoJSON feature array (tigerGeo.features)
 *   - lookup:   { [tractKey]: { povertyRate, povertyPop, totalPop, medianIncome } }
 *   - resources: [{ lat, lon, type, name }]
 *
 * Posts back: { lookup, areaStats, meta }
 *   - lookup:    enriched with resourceCount, density, isStrictDesert, gapScore, priorityRank
 *   - areaStats: { avgPoverty, totalResources, totalPop, avgDensity, topTract }
 *   - meta:      { minGap, maxGap, topTract }
 */

// ── Geometry helpers ────────────────────────────────────────────────────────

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
  if (geom.type === 'Polygon') return checkPoly(geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((poly) => checkPoly(poly));
  return false;
}

// ── Main worker message handler ─────────────────────────────────────────────

self.onmessage = (e) => {
  const { features, lookup, resources } = e.data;

  let maxPoverty = 0;
  let maxPop = 0;
  let maxDensity = 0;

  let totalPovertyPop = 0;
  let totalBasePop = 0;
  let totalDensitySum = 0;
  let validTractCount = 0;

  const rawData = [];

  // Pass 1 — count resources per tract, flag deserts
  for (const feature of features) {
    const key = `${feature.properties.STATE}${feature.properties.COUNTY}${feature.properties.TRACT}`;
    const d = lookup[key];
    if (!d || d.totalPop <= 0) continue;

    const count = resources.filter(r => pointInFeature([r.lon, r.lat], feature)).length;
    d.resourceCount = count;

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

    const parsedPoverty = parseFloat(d.povertyRate);
    const isValidPoverty = !isNaN(parsedPoverty) && parsedPoverty > 0;

    if (d.resourceCount === 0 && !isValidPoverty) {
      console.log(`[Anomaly] Water/Park Tract ${key} has no resources and invalid poverty:`, d.povertyRate);
    }

    // ★ Core desert flag
    d.isStrictDesert = isValidPoverty && parsedPoverty > 20 && d.resourceCount === 0;

    rawData.push({ key, feature, d });
  }

  // Pass 2 — gap scores
  let minGap = Infinity;
  let maxGap = -Infinity;

  for (const item of rawData) {
    const { d } = item;
    const normPov = maxPoverty > 0 ? d.povertyRate / maxPoverty : 0;
    const normPop = maxPop > 0 ? d.totalPop / maxPop : 0;
    const normDen = maxDensity > 0 ? d.density / maxDensity : 0;

    d.gapScore = normPov * 2.5 + normPop * 1.0 - normDen * 3.0;
    if (d.gapScore < minGap) minGap = d.gapScore;
    if (d.gapScore > maxGap) maxGap = d.gapScore;
  }

  if (minGap === maxGap) maxGap = minGap + 1;

  // Pass 3 — rank top 5 priority tracts
  rawData.sort((a, b) => b.d.gapScore - a.d.gapScore);
  const top5 = rawData.slice(0, 5);
  top5.forEach((item, idx) => { item.d.priorityRank = idx + 1; });

  const areaStats = {
    avgPoverty: totalBasePop > 0 ? ((totalPovertyPop / totalBasePop) * 100).toFixed(1) : null,
    totalResources: resources.length,
    totalPop: totalBasePop,
    avgDensity: validTractCount > 0 ? (totalDensitySum / validTractCount).toFixed(1) : 0,
    topTract: top5[0] ? top5[0].feature.properties.BASENAME || top5[0].feature.properties.TRACT : null,
  };

  const meta = {
    minGap,
    maxGap,
    topTract: top5[0] || null,
  };

  self.postMessage({ lookup, areaStats, meta });
};
