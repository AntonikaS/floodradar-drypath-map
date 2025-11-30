[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.17765720.svg)](https://doi.org/10.5281/zenodo.17765720)

# FloodRadar / DryPath Map

**FloodRadar / DryPath Map** is a web-based decision support tool that turns SAR flood maps into **address-level evacuation guidance**.  
It overlays pre-classified SAR flood extent with local low-water crossings, shelters and routing, so that residents and emergency managers can see **where the water is** and **how to get out safely**.

- Project site: https://drypathmap.com/ 
- Live app: https://evacuation-map-sar.vercel.app/ 

> **Disclaimer:** This is a research prototype for education and outreach.  
> It is **not** an official product of NASA or any emergency agency and **must not** be used as the sole basis for life-critical decisions.

---

## Key features

- **SAR-based flood extent**
  - Pre-classified **UAVSAR L-band** mosaics (10 m) for Kerr County, Texas (July 9–10, 2025).
  - Ready to ingest Sentinel-1 or other SAR-derived flood masks.
  - Distinguishes *open water*, *flooded vegetation*, *flooded developed areas* and *flooded cropland*.

- **Swipe flood viewer**
  - Split-view (**Leaflet side-by-side**) to compare pre-event imagery and post-event SAR flood extent.
  - Smooth swipe handle for intuitive “before/after” exploration.

- **Community layers**
  - **Low-water crossings** (red markers) with names and notes (e.g. “bridge washed out”).
  - **Shelters** (green markers) with address, capacity and status.
  - Optional historical flood zones / FEMA floodplains.

- **Evacuation routing**
  - Search any address via **Nominatim** (OpenStreetMap geocoding).
  - Query **OSRM** (Open Source Routing Machine) for driving directions to the nearest shelters or key low-water sites.
  - Up to three alternative routes, ranked by distance and travel time.
  - Simple **PDF export** with route summary for field teams and incident logs.

- **Open, lightweight architecture**
  - Built with **Next.js (App Router)**, **React**, **TypeScript**, **Leaflet** and **serverless API routes**.
  - No dedicated database: all geospatial assets live as static files in the repo.
  - Hosted on **Vercel**; easy to fork and adapt to other regions.

Technical details of the processing chain are described in the accompanying technical study.:contentReference[oaicite:0]{index=0}  

---

## Architecture

FloodRadar / DryPath Map is a single Next.js app that bundles **frontend** and a minimal **tile backend**:

1. **Data layer (static assets)**
   - `public/SAR_Kerr/*.tif` – UAVSAR flood mosaics.
   - `src/lib/lowWater.ts` – low-water crossings (GeoJSON-like arrays).
   - `src/lib/shelters.ts` – shelters.
   - `src/lib/floodZones.ts` – historical flood zones (optional).
   - Type definitions for Leaflet plugins and geospatial libs in `src/types/`.

2. **Server layer (tile API)**
   - `src/app/api/uavsar/tiles/[z]/[x]/[y]/route.ts`
   - Reads UAVSAR GeoTIFF with `geotiff/georaster`, clips by `{z,x,y}` tile, maps class codes to RGBA via a color table, and returns a **256×256 PNG tile**.
   - Runs as a **serverless function** on Vercel (no additional server to manage).

3. **Client layer (web app)**
   - `src/components/FloodMap.tsx` – main map view:
     - Leaflet map initialisation over Kerrville, TX.
     - Esri basemap layers (imagery, labels, roads).
     - `leaflet-side-by-side` swipe control.
     - Raster overlay using `georaster-layer-for-leaflet`.
     - Marker layers for shelters and low-water crossings.
     - Geocoding + routing controls, progress overlay, modals, and PDF export.

4. **External services**
   - **Geocoding:** Nominatim (`https://nominatim.openstreetmap.org`).
   - **Routing:** OSRM public instance (`https://router.project-osrm.org`).

This architecture keeps everything **stateless** and easy to redeploy: swap in new rasters and vectors, redeploy, and the app is ready for another region.

---

## Data sources

FloodRadar / DryPath Map builds on openly available remote-sensing and mapping data:

- **UAVSAR** – L-band SAR flood classifications for Kerr County, TX (July 9–10, 2025).
- **Sentinel-1 SAR (VV/VH)** – C-band SAR for global, all-weather flood mapping (optional / future).
- **Copernicus DEM / SRTM** – elevation context and potential derivation of HAND / flood susceptibility indices.
- **NASA GPM IMERG** – half-hourly rainfall estimates for storm context.
- **OpenStreetMap** – road network and base data.
- **Local GIS layers** – low-water crossings and official shelters (Kerr County emergency management).

The UI includes a “Data sources” dialog with links back to the original providers so users can explore raw products and metadata.

---

## Getting started

### Requirements

- **Node.js** ≥ 18
- **npm** or **yarn**

### Install and run locally

```bash
# 1. Clone the repository
git clone https://github.com/AntonikaS/floodradar-drypath-map.git
cd floodradar-drypath-map

# 2. Install dependencies
npm install
# or
yarn

# 3. Start the dev server
npm run dev
# or
yarn dev
```

## Getting started

Open http://localhost:3000 in your browser.

By default, the app uses public **Nominatim** and **OSRM** instances – no `.env` file is strictly required.  
If you want to point to your own services, you can add environment variables (for example in `.env.local`) and read them in the routing / geocoding utilities.

---

## Production build

    npm run build
    npm start

---

## Vercel deployment

1. Push this repository to GitHub.  
2. In Vercel, “Import project from GitHub”.  
3. Set `Framework = Next.js` (auto-detected) and deploy.

---

## Project structure

A simplified view of the repo:

    .
    ├── public/
    │   └── SAR_Kerr/
    │       ├── flight25023_mosaic_UNet_class.tif
    │       └── flight25024_mosaic_UNet_class.tif
    ├── src/
    │   ├── app/
    │   │   ├── api/
    │   │   │   └── uavsar/tiles/[z]/[x]/[y]/route.ts  # tile server
    │   │   ├── layout.tsx
    │   │   └── page.tsx                              # main entry point
    │   ├── components/
    │   │   └── FloodMap.tsx                          # main map & UI
    │   ├── lib/
    │   │   ├── lowWater.ts                           # low-water crossings
    │   │   ├── shelters.ts                           # shelters
    │   │   └── floodZones.ts                         # historical flood zones
    │   └── types/                                    # TS defs for plugins
    └── README.md

---

## How to use the app

### Explore flood extent

- Move the swipe handle left/right to compare pre-event imagery (left) with SAR flood classifications (right).
- Use layer toggles to show/hide:
  - UAVSAR flood layer (by date),
  - Roads and labels,
  - Historical flood zones,
  - Shelters and low-water crossings.

### Search your location

- Enter a street address or place name into the search bar.
- Nominatim geocodes the query and drops a **start marker** on the map.

### Get routes to shelters / crossings

- The app selects the **three closest targets** (shelters and/or low-water crossings) by crow-flight distance.
- OSRM computes driving routes to each target.
- Route options appear in a side panel with:
  - Driving distance,
  - Travel time,
  - Direct distance,
  - Notes about the destination.

### Inspect and export

- Click a route to highlight it on the map.
- Use the **“Download routes (PDF)”** button to save a one-page summary for field use.

### Learn more

- Open the **Evacuation Playbook** modal for safety rules (e.g. “Turn Around, Don’t Drown”).
- Open the **Data Sources** modal for links to SAR, DEM and rainfall datasets.

---

## Adapting to another region

To repurpose **FloodRadar / DryPath Map**:

### Replace SAR mosaics

1. Put your flood-classification GeoTIFFs into `public/<your_region>/`.  
2. Update the `SAR_SOURCES` constant in `FloodMap.tsx` to point to new paths and labels.

### Update vector layers

Edit or replace:

- `src/lib/lowWater.ts` – low-water crossings / critical road segments.  
- `src/lib/shelters.ts` – shelters, safe assembly areas, or hospitals.  
- `src/lib/floodZones.ts` – FEMA floodplains or local hazard zones.  

### Change map center & defaults

- Adjust initial map center / zoom in `FloodMap.tsx`.  
- Optionally restrict geocoding queries to your new city / region.  

### Optional: private OSRM & Nominatim

- Spin up your own OSRM and/or Nominatim instances for higher request limits.  
- Point the frontend to those endpoints via environment variables.  

With these minimal changes, the same codebase can serve as a template for **any flood-prone region** with SAR coverage and basic community GIS layers.

---

## Limitations & roadmap

### Current limitations

- SAR flood maps are **pre-computed**; no near-real-time ingest yet.  
- Routing is **not flood-aware**: OSRM uses the static road graph and may route through inundated segments.  
- The prototype depends on **public OSRM and Nominatim**, which may throttle heavy usage.  
- The app is tuned to **Kerr County**; scaling to national or global coverage will require tile caching and more robust infrastructure.  

### Planned / suggested improvements

- Automated **Sentinel-1** ingest and classification (Otsu / CNN-based).  
- True **flood-aware routing** that penalises or blocks flooded road segments.  
- Fusion of SAR with **IMERG rainfall**, optical imagery and hydrological models.  
- **Mobile-first UI**, offline basemap cache, and hooks to incident-management systems.  

---

## Credits

- **Concept & research:** Antonika Shapovalova  
- **Architecture, mentoring & development:** Antonika Shapovalova 

Built as part of a **NASA SAR / Space Apps–style project** on flash-flood evacuation mapping.

This project would not be possible without:

- Open data from **NASA**, **ESA**, **Copernicus**, **UAVSAR**, **GPM**, **OpenStreetMap**, **Kerr County emergency services** and others.  
- Open-source libraries including **Next.js**, **React**, **Leaflet**, **Esri-Leaflet**, **geotiff/georaster**, **leaflet-side-by-side**, **OSRM**, and **Nominatim**.  

---

## License

Distributed under the **MIT License**.  
See `LICENSE` for details.

## Citation

If you use FloodRadar / DryPath Map in your work, please cite:

> FloodRadar / DryPath Map (v1.0.0). Zenodo, 2025. DOI: [10.5281/zenodo.17765720](https://doi.org/10.5281/zenodo.17765720).

