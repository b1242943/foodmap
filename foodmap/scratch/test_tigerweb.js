

async function test() {
  const lat = 40.596;
  const lon = -73.763;
  
  // A typical bounding box around Far Rockaway (approx 5 miles / 8km)
  const d = 0.05;
  const south = lat - d;
  const west = lon - d;
  const north = lat + d;
  const east = lon + d;
  
  const tigerUrl = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query?geometry=${west},${south},${east},${north}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson`;
  
  console.log("Fetching Tigerweb GeoJSON from:", tigerUrl);
  try {
    const res = await fetch(tigerUrl);
    const data = await res.json();
    console.log("Tigerweb features count:", data.features?.length);
    if (data.features && data.features.length > 0) {
      console.log("First feature properties:", data.features[0].properties);
      
      const pairs = [...new Set(data.features.map(f => `${String(f.properties.STATE).padStart(2, "0")}_${String(f.properties.COUNTY).padStart(3, "0")}`))];
      console.log("Distinct State_County pairs:", pairs);
      
      for (const pair of pairs) {
        const [state, county] = pair.split("_");
        const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B17001_002E,B17001_001E,B19013_001E&for=tract:*&in=state:${state}+county:${county}`;
        console.log("Fetching Census ACS from:", censusUrl);
        const cRes = await fetch(censusUrl);
        const cText = await cRes.text();
        console.log("Census ACS response prefix:", cText.substring(0, 200));
      }
    }
  } catch (err) {
    console.error("Error during test:", err);
  }
}

test();
