const fs = require('fs');
const path = require('path');

// NY (Queens/Kings/New York), LA (Los Angeles), WI (Dane)
const foodbanks = [
  {
    Name: 'Food Bank For New York City',
    State: 'New York',
    County: 'New York County',
    ServiceArea: 'New York County, Queens County, Kings County, Bronx County, Richmond County',
    Phone: '212-566-7855',
    Website: 'https://www.foodbanknyc.org',
    Address: '39 Broadway, New York, NY 10006',
    Latitude: 40.7062,
    Longitude: -74.0125,
    Services: 'Emergency Food Assistance, SNAP Enrollment, Senior Programs, Youth Programs'
  },
  {
    Name: 'City Harvest',
    State: 'New York',
    County: 'New York County',
    ServiceArea: 'New York County, Queens County, Kings County, Bronx County, Richmond County',
    Phone: '646-412-0600',
    Website: 'https://www.cityharvest.org',
    Address: '150 52nd St, Brooklyn, NY 11232',
    Latitude: 40.6483,
    Longitude: -74.0227,
    Services: 'Food Rescue, Mobile Markets, Emergency Food Assistance'
  },
  {
    Name: 'Los Angeles Regional Food Bank',
    State: 'California',
    County: 'Los Angeles County',
    ServiceArea: 'Los Angeles County',
    Phone: '323-234-3030',
    Website: 'https://www.lafoodbank.org',
    Address: '1734 E 41st St, Los Angeles, CA 90058',
    Latitude: 33.9997,
    Longitude: -118.2407,
    Services: 'Emergency Food Assistance, SNAP Enrollment, Children\'s Programs, Senior Programs'
  },
  {
    Name: 'Second Harvest Foodbank of Southern Wisconsin',
    State: 'Wisconsin',
    County: 'Dane County',
    ServiceArea: 'Dane County, Columbia County, Dodge County, Jefferson County, Rock County',
    Phone: '608-223-9121',
    Website: 'https://www.secondharvestmadison.org',
    Address: '2802 Dairy Dr, Madison, WI 53718',
    Latitude: 43.0526,
    Longitude: -89.2995,
    Services: 'Emergency Food Assistance, Mobile Pantries, SNAP Enrollment'
  }
];

const rows = [];
rows.push('Name,State,County,ServiceArea,Phone,Website,Address,Latitude,Longitude,Services');

foodbanks.forEach(fb => {
  const quotedName = `"${fb.Name}"`;
  const quotedState = `"${fb.State}"`;
  const quotedCounty = `"${fb.County}"`;
  const quotedServiceArea = `"${fb.ServiceArea}"`;
  const quotedPhone = `"${fb.Phone}"`;
  const quotedWebsite = `"${fb.Website}"`;
  const quotedAddress = `"${fb.Address}"`;
  const quotedServices = `"${fb.Services}"`;

  rows.push(`${quotedName},${quotedState},${quotedCounty},${quotedServiceArea},${quotedPhone},${quotedWebsite},${quotedAddress},${fb.Latitude},${fb.Longitude},${quotedServices}`);
});

const destPath = 'c:\\Users\\brigh\\foodmap\\foodmap\\public\\feeding_america_foodbanks.csv';
fs.writeFileSync(destPath, rows.join('\n'), 'utf8');
console.log('Generated ' + (rows.length - 1) + ' foodbanks at ' + destPath);
