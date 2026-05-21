import fs from 'fs';
import path from 'path';

function findGeoJSON(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
        results = results.concat(findGeoJSON(filePath));
      }
    } else if (file.endsWith('.geojson')) {
      results.push(filePath);
    }
  });
  return results;
}

try {
  const root = 'c:\\Users\\brigh\\foodmap';
  console.log('Searching in:', root);
  const files = findGeoJSON(root);
  console.log('Found geojson files:', files);
} catch (e) {
  console.error(e);
}
