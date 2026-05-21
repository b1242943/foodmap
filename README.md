# FoodMap

**Food access intelligence for communities and officials.**

FoodMap is an interactive web application that visualizes grocery markets, food pantries, and SNAP/EBT retailers across any US location — and scores food access so communities, nonprofits, and city officials can understand where gaps exist and act on what they find.

---

## Features

- **Interactive map** — visualize grocery markets, food pantries, and SNAP/EBT retailers within a 5-mile radius of any US zip code or city
- **Access scoring** — weighted composite score (0–100) across proximity, variety, affordability, pantry density, SNAP coverage, and transit access
- **Score breakdown** — subcategory bars showing exactly what is driving a neighborhood's score
- **USDA FNS data** — SNAP/EBT retailer data sourced directly from the official USDA Food and Nutrition Service registry (200k+ locations nationwide)
- **EBT payment detection** — surfaces places that accept EBT/SNAP as payment via OpenStreetMap tags
- **Resources list** — filterable, scrollable list of all nearby resources sorted by distance
- **Compare Zones** — side-by-side comparison of two locations
- **US-first geocoding** — zip codes and city names resolve to US locations by default

---

## Data Sources

| Source | Data |
|--------|------|
| [USDA FNS](https://www.fns.usda.gov/snap/retailer-locator) | SNAP/EBT authorized retailer registry |
| [OpenStreetMap](https://www.openstreetmap.org) | Grocery markets, food pantries, EBT-tagged locations |
| [Nominatim](https://nominatim.org) | Geocoding |

---

## Getting Started

### Prerequisites
- Node.js 16+
- npm

### Installation

```bash
git clone https://github.com/b1242943/foodmap.git
cd foodmap
npm install
```

### SNAP Data Setup

Download the SNAP retailer CSV from the USDA FNS retailer locator:
[https://www.fns.usda.gov/snap/retailer-locator](https://www.fns.usda.gov/snap/retailer-locator)

Rename the file to `snap_retailers.csv` and place it in the `public/` folder.

### Run Locally

```bash
npm start
```

App will open at `http://localhost:3000`

---

## Tech Stack

- **React** (Create React App)
- **Leaflet** — interactive mapping
- **PapaParse** — CSV parsing for SNAP data
- **Nominatim** — geocoding
- **Overpass API** — OpenStreetMap data

---

## Use Cases

- **Community members** — find the nearest open grocery store, pantry, or EBT-accepted retailer
- **City officials** — identify underserved zip codes and make the case for resource investment
- **Nonprofits** — understand where pantry coverage is thin and plan outreach
- **Researchers** — analyze food environment data across neighborhoods and boroughs

---

## Background

FoodMap was built to address food insecurity in underserved urban neighborhoods, with a focus on communities like Far Rockaway, Queens — one of the most geographically isolated and food-insecure neighborhoods in New York City.

---

## License

MIT