"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import type { LineString, MultiLineString } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet-side-by-side";
import * as Esri from "esri-leaflet";
import { shelters } from "@/lib/shelters";
import { lowWaterSites } from "@/lib/lowWater";

const startPin = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const shelterPin = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const lowWaterPin = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const ROUTE_PANE = "evac-route";
const ROUTE_KEY_PRECISION = 5;
const SAR_SOURCES = {
  "2025-07-09": {
    label: "July 9, 2025 — Flight 25023",
    path: "/SAR_Kerr/flight25023_mosaic_UNet_class.tif",
  },
  "2025-07-10": {
    label: "July 10, 2025 — Flight 25024",
    path: "/SAR_Kerr/flight25024_mosaic_UNet_class.tif",
  },
} as const;
type SarDate = keyof typeof SAR_SOURCES;

const SAR_CLASS_COLORS: Record<number, string> = {
  1: "rgba(0,120,255,0.9)",
  2: "rgba(0,200,0,0.9)",
  3: "rgba(255,50,50,0.9)",
  4: "rgba(255,140,0,0.9)",
};

const DATA_SOURCE_OVERVIEW = [
  { label: "(rainfall) NASA GPM IMERG", href: "https://gpm.nasa.gov/data/imerg" },
  { label: "(flood mapping) Sentinel-1 SAR (VV/VH; L-band where available)", href: "https://www.earthdata.nasa.gov/data/instruments/sentinel-1-c-sar" },
  { label: "(terrain) SRTM/Copernicus DEM", href: "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM" },
  { label: "(roads/POI) OpenStreetMap", href: "https://www.openstreetmap.org/" },
  { label: "UAVSAR", href: "https://uavsar.jpl.nasa.gov/" },
  { label: "ALOS-2", href: "https://www.earthdata.nasa.gov/news/alos-2-scansar-data-now-available-earthdata" },
];

const DATA_SOURCE_REFERENCES: Array<{
  title: string;
  entries: Array<{ text: string; href?: string }>;
}> = [
  {
    title: "A. Methods & Algorithms",
    entries: [
      {
        text: "Otsu, Nobuyuki. “A Threshold Selection Method from Gray-Level Histograms.” IEEE Transactions on Systems, Man, and Cybernetics, 1979.",
        href: "https://ieeexplore.ieee.org/document/4310076",
      },
      {
        text: "Richards, John A. Remote Sensing with Imaging Radar. Springer, 2009.",
        href: "https://link.springer.com/book/10.1007/978-3-642-02020-9",
      },
      {
        text: "Huffman, George J., et al. “NASA’s GPM IMERG: Algorithm and Early Results.” Journal of Hydrometeorology, 2020.",
        href: "https://gpm.nasa.gov/data/imerg",
      },
      {
        text: "U.S. Army Corps of Engineers. HEC-RAS River Analysis System User’s Manual. 2023.",
        href: "https://www.hec.usace.army.mil/software/hec-ras/",
      },
      {
        text: "USDA NRCS. Urban Hydrology for Small Watersheds (TR-55). 1986 (rev.).",
        href: "https://www.nrcs.usda.gov",
      },
      {
        text: "Manning, Robert. “On the Flow of Water in Open Channels and Pipes.” Transactions of the Institution of Civil Engineers of Ireland, 1891.",
      },
      {
        text: "Vesecky, John F., and Christopher S. Ruf. NASA Technical Reports Server (NTRS), 1986.",
        href: "https://ntrs.nasa.gov/citations/19860048856",
      },
      {
        text: "Rennó, C.D., et al. “HAND, a new terrain descriptor using SRTM-DEM.” Remote Sensing of Environment, 2008.",
      },
      {
        text: "Horritt, M. S., and P. D. Bates. “Evaluation of 1D and 2D Numerical Models for Predicting River Flood Inundation.” Journal of Hydrology, 2002.",
      },
      {
        text: "Pulvirenti, L., et al. “Flood Monitoring Using Multi-Temporal COSMO-SkyMed Data.” Remote Sensing of Environment, 2011.",
      },
      {
        text: "Schumann, G. J.-P., and D. Moller. “Microwave Remote Sensing of Flood Inundation.” Physics and Chemistry of the Earth, 2015.",
      },
    ],
  },
  {
    title: "B. Tools & Software",
    entries: [
      { text: "ESA. SNAP - Sentinel Application Platform.", href: "https://step.esa.int/main/toolboxes/snap/" },
      { text: "GDAL/OGR Contributors. GDAL.", href: "https://gdal.org/" },
      { text: "QGIS. QGIS Geographic Information System.", href: "https://qgis.org/" },
      { text: "Google. Google Earth Engine.", href: "https://earthengine.google.com/" },
      { text: "ASF DAAC. “ASF Vertex: SAR Data Search.”", href: "https://search.asf.alaska.edu/" },
      { text: "MapLibre. MapLibre GL JS.", href: "https://maplibre.org/" },
      { text: "Project OSRM. Open Source Routing Machine.", href: "http://project-osrm.org/" },
      { text: "WWF and USGS. HydroSHEDS.", href: "https://www.hydrosheds.org/" },
    ],
  },
  {
    title: "C. Product & Instrument Guides",
    entries: [
      { text: "ASF DAAC. Radiometrically Terrain-Corrected (RTC) Products Guide.", href: "https://asf.alaska.edu" },
      { text: "NASA JPL. UAVSAR Data Users Guide.", href: "https://uavsar.jpl.nasa.gov/" },
      { text: "NASA. Integrated Multi-satellitE Retrievals for GPM (IMERG).", href: "https://gpm.nasa.gov/data/imerg" },
      { text: "ESA. Sentinel-1 C-SAR.", href: "https://www.earthdata.nasa.gov/data/instruments/sentinel-1-c-sar" },
      { text: "NASA. L-SAR.", href: "https://www.earthdata.nasa.gov/data/instruments/l-sar" },
      { text: "NASA. ALOS-2 ScanSAR Data Now Available on Earthdata.", href: "https://www.earthdata.nasa.gov/news/alos-2-scansar-data-now-available-earthdata" },
      { text: "NASA. SRTM.", href: "https://www.earthdata.nasa.gov/data/instruments/srtm" },
      { text: "Copernicus. COP-DEM.", href: "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM" },
      { text: "NASA Applied Sciences. ARSET SAR Training.", href: "https://appliedsciences.nasa.gov/arset" },
    ],
  },
  {
    title: "D. Licensing & Data Policies",
    entries: [
      { text: "OpenStreetMap Contributors. Open Database License (ODbL).", href: "https://www.openstreetmap.org/#map=5/38.01/-95.84" },
      { text: "Copernicus. Copernicus DEM — Terms of Use.", href: "https://dataspace.copernicus.eu/terms-and-conditions" },
      { text: "NASA. NASA Open Data and Information Policy.", href: "https://www.nasa.gov/data" },
    ],
  },
];

type RouteCacheEntry = {
  geometry: LineString | MultiLineString;
  distance?: number;
  duration?: number;
};

type OsrmRoute = {
  geometry?: LineString | MultiLineString;
  distance?: number;
  duration?: number;
};

type OsrmResponse = {
  code?: string;
  routes?: OsrmRoute[];
};

const buildRouteCacheKey = (
  [startLat, startLon]: [number, number],
  [destLat, destLon]: [number, number],
) => {
  const precision = ROUTE_KEY_PRECISION;
  return (
    `${startLat.toFixed(precision)},${startLon.toFixed(precision)}->` +
    `${destLat.toFixed(precision)},${destLon.toFixed(precision)}`
  );
};

const CATEGORY_LABEL: Record<TargetCategory, string> = {
  shelter: "Shelter",
  lowWater: "Low-water crossing",
};

type LayerSettings = {
  showRoads: boolean;
  showLabels: boolean;
  showSar: boolean;
  sarDate: SarDate;
};

type FeatureVisibility = {
  showShelters: boolean;
  showLowWater: boolean;
};

const PROGRESS_STAGE_SEQUENCE = ["base", "sar", "geocode", "route"] as const;
type ProgressStage = (typeof PROGRESS_STAGE_SEQUENCE)[number];
type StageStatus = "idle" | "in-progress" | "complete";

const PROGRESS_STAGES: Record<ProgressStage, { label: string; start: number; end: number }> = {
  base: { label: "Loading base map…", start: 0, end: 30 },
  sar: { label: "Loading NASA SAR layer…", start: 30, end: 65 },
  geocode: { label: "Finding address…", start: 65, end: 85 },
  route: { label: "Computing safe routes…", start: 85, end: 100 },
};

const PROGRESS_SUBHEADINGS = [
  "Checking low-water crossings…",
  "Merging road network…",
  "Assessing shelter readiness…",
  "Syncing flood telemetry…",
] as const;

const EVAC_RULES: { title: string; details: string }[] = [
  {
    title: "Monitor official alerts",
    details:
      "Stay tuned to Kerr County warnings, local push alerts, and NOAA Weather Radio so evacuation orders and road closures reach you first.",
  },
  {
    title: "Move when told",
    details:
      "Gear up as soon as the order drops. Grab your go-kit, prescriptions, IDs, and keep your phone and battery packs charged.",
  },
  {
    title: "Plan more than one route",
    details:
      "Use the suggested routes but be ready to pivot. Avoid low-lying shortcuts, never bypass barricades, and follow responder direction.",
  },
  {
    title: "Never drive through water",
    details:
      "Even 6–12 inches of fast water can sweep a vehicle. If the road is covered, turn around — remember ‘Turn Around, Don’t Drown.’",
  },
  {
    title: "Check on your neighbors",
    details:
      "Help seniors, families with kids, and pets get moving. Confirm everyone knows the destination before you roll out.",
  },
  {
    title: "Report once safe",
    details:
      "When you arrive, notify loved ones and local officials so they can mark you accounted for and focus on those still en route.",
  },
];

type RouteTarget = (typeof shelters)[number] | (typeof lowWaterSites)[number];
type TargetCategory = RouteTarget["category"];
type NominatimResult = {
  lat: string;
  lon: string;
};

type LayerWithContainer = L.Layer & L.Evented & {
  getContainer?: () => HTMLElement;
  bringToFront?: () => void;
  bringToBack?: () => void;
  setZIndex?: (value: number) => void;
  setOpacity?: (value: number) => void;
  setLayers?: (layers: number[]) => void;
  _currentImage?: {
    getElement?: () => HTMLElement | null;
    _image?: HTMLElement | null;
    _container?: HTMLElement | null;
  } | null;
};

type RouteOption = {
  target: RouteTarget;
  crowDistance: number;
  osrmDistance?: number;
  durationSec?: number;
  geometry?: LineString | MultiLineString;
};

function ensureLayerHasContainer(layer: LayerWithContainer) {
  if (typeof layer.getContainer === "function") {
    return;
  }

  let pendingClip = "";
  const placeholderStyle: { clip: string } = { clip: "" };
  Object.defineProperty(placeholderStyle, "clip", {
    get: () => pendingClip,
    set: (value: string) => {
      pendingClip = value;
    },
  });

  const placeholder = { style: placeholderStyle } as unknown as HTMLElement;

  const resolveElement = () => {
    const current = (layer as LayerWithContainer)._currentImage;
    if (!current) return null;
    if (typeof current.getElement === "function") {
      const el = current.getElement();
      if (el) return el;
    }
    if (current._image) return current._image;
    if (current._container) return current._container;
    return null;
  };

  layer.getContainer = () => {
    const el = resolveElement();
    if (el) {
      if (pendingClip) {
        el.style.clip = pendingClip;
      }
      return el;
    }
    return placeholder;
  };

  layer.on("load", () => {
    const el = resolveElement();
    if (el && pendingClip) {
      el.style.clip = pendingClip;
    }
  });
}

function formatDistance(meters?: number) {
  if (!meters && meters !== 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function sanitizePdfLine(line: string) {
  const ascii = line.replace(/[^\x20-\x7E]/g, " ");
  const trimmed = ascii.replace(/\s+$/g, "");
  return trimmed.length > 0 ? trimmed : " ";
}

function escapePdfText(line: string) {
  return line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfDocument(lines: string[]) {
  const encoder = new TextEncoder();
  const cleaned = (lines.length ? lines : [" "]).map((line) => sanitizePdfLine(line));
  const startY = 760;
  const lineHeight = 18;
  const textSections = cleaned
    .map((line, index) => {
      const y = startY - index * lineHeight;
      return `1 0 0 1 72 ${y} Tm\n(${escapePdfText(line)}) Tj`;
    })
    .join("\n");

  const contentStream = `BT\n/F1 12 Tf\n${textSections}\nET`;
  const contentLength = encoder.encode(contentStream).length;

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  ];

  const parts = ["%PDF-1.3\n"];
  let currentLength = encoder.encode(parts[0]).length;
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(currentLength);
    const chunk = `${obj}\n`;
    parts.push(chunk);
    currentLength += encoder.encode(chunk).length;
  }

  const xrefOffset = currentLength;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  parts.push(xref);

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(trailer);

  return parts.join("");
}

function haversine([lat1, lon1]: number[], [lat2, lon2]: number[]) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Controls({
  setStart,
  busy,
  onGeocodeStart,
  onGeocodeComplete,
}: {
  setStart: (lat: number, lon: number) => void;
  busy: boolean;
  onGeocodeStart?: () => void;
  onGeocodeComplete?: () => void;
}) {
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function geocode() {
    if (searching) return;
    setError(null);
    if (!q.trim()) return;
    setSearching(true);
    onGeocodeStart?.();
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=" +
        encodeURIComponent(q + ", Kerrville, TX");
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const js = (await res.json()) as NominatimResult[];
      if (!js?.length) {
        setError("Address not found");
        return;
      }
      const { lat, lon } = js[0];
      setStart(parseFloat(lat), parseFloat(lon));
    } catch {
      setError("Geocoding error");
    } finally {
      setSearching(false);
      onGeocodeComplete?.();
    }
  }

  return (
    <div className="absolute z-[1000] top-4 left-1/2 -translate-x-1/2 w-[min(900px,calc(100%-1rem))]">
      <div className="backdrop-blur bg-white/10 border border-white/20 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                geocode();
              }
            }}
            placeholder="Enter an address (e.g. 700 Main St)"
            className="w-full px-4 py-2 rounded-xl bg-black/50 border border-white/20 outline-none"
          />
          <button
            onClick={geocode}
            disabled={busy || searching || !q.trim()}
            className="px-4 py-2 rounded-xl bg-white text-black font-semibold disabled:opacity-50"
          >
            {busy || searching ? "Searching..." : "Find address"}
          </button>
        </div>
        {error && <div className="px-4 pb-3 text-red-300 text-sm">{error}</div>}
        <div className="px-4 pb-3 text-xs opacity-70">
          Demo: Nominatim geocoder, OSRM routing.
        </div>
      </div>
    </div>
  );
}

function SideBySideLayers({
  map,
  reportSarState,
  layers,
  reportProgressStage,
}: {
  map: L.Map;
  reportSarState: (state: { loaded: boolean; error: string | null }) => void;
  layers: LayerSettings;
  reportProgressStage: (stage: ProgressStage, action: "start" | "complete") => void;
}) {
  const sarLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const run = async () => {
      const beforeImagery = Esri.basemapLayer("Imagery");
      const beforeRoads = Esri.basemapLayer("ImageryTransportation");
      const beforeLabels = Esri.basemapLayer("ImageryLabels");
      const afterImagery = Esri.basemapLayer("Imagery");
      const afterRoads = layers.showRoads ? Esri.basemapLayer("ImageryTransportation") : null;
      const afterLabels = layers.showLabels ? Esri.basemapLayer("ImageryLabels") : null;

      const toLayerWithContainer = (layer: L.Layer | null) =>
        (layer ? (layer as LayerWithContainer) : null);

      const beforeRoadsLayer = toLayerWithContainer(beforeRoads);
      const beforeLabelsLayer = toLayerWithContainer(beforeLabels);
      const roadsLayer = toLayerWithContainer(afterRoads);
      const labelsLayer = toLayerWithContainer(afterLabels);
      const afterImageryLayer = afterImagery as LayerWithContainer;

      let baseStageActive = false;
      let baseProgressFinalized = false;
      const finalizeBaseProgress = () => {
        if (baseStageActive && !baseProgressFinalized) {
          baseProgressFinalized = true;
          reportProgressStage("base", "complete");
        }
      };

      baseStageActive = true;
      reportProgressStage("base", "start");
      const baseLoadTargets = [
        beforeImagery as LayerWithContainer,
        afterImageryLayer,
      ].filter(Boolean) as LayerWithContainer[];
      if (!baseLoadTargets.length) {
        finalizeBaseProgress();
      } else {
        let pendingBase = baseLoadTargets.length;
        const handleBaseLoad = () => {
          pendingBase -= 1;
          if (pendingBase <= 0) {
            finalizeBaseProgress();
          }
        };
        baseLoadTargets.forEach((layer) => {
          layer.once("load", handleBaseLoad);
        });
      }

      [beforeRoadsLayer, beforeLabelsLayer, roadsLayer, labelsLayer].forEach((layer) => {
        if (layer) ensureLayerHasContainer(layer);
      });

      if (sarLayerRef.current) {
        map.removeLayer(sarLayerRef.current);
        sarLayerRef.current = null;
      }

      let sarLayer: LayerWithContainer | null = null;
      let sarStageActive = false;
      let sarProgressFinalized = false;
      const finalizeSarProgress = () => {
        if (sarStageActive && !sarProgressFinalized) {
          sarProgressFinalized = true;
          reportProgressStage("sar", "complete");
        }
      };
      if (layers.showSar) {
        sarStageActive = true;
        reportProgressStage("sar", "start");
        reportSarState({ loaded: false, error: null });
        try {
          const [{ default: parseGeoraster }, { default: GeoRasterLayer }] = await Promise.all([
            import("georaster"),
            import("georaster-layer-for-leaflet"),
          ]);
          if (cancelled) return;

          const source = SAR_SOURCES[layers.sarDate];
          const response = await fetch(source.path, { cache: "force-cache" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} while fetching ${source.path}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          if (cancelled) return;
          const georaster = await parseGeoraster(arrayBuffer);
          if (cancelled) return;

          const GeoRasterLayerClass = GeoRasterLayer as unknown as {
            new (options: {
              georaster: unknown;
              opacity: number;
              pixelValuesToColorFn: (values: number[]) => string | null;
              mask: (values: number[]) => boolean;
              resolution: number;
            }): LayerWithContainer;
          };

          sarLayer = new GeoRasterLayerClass({
            georaster,
            opacity: 1,
            resolution: 64,
            pixelValuesToColorFn: (values: number[]) => {
              if (!values) return null;
              if (values.length >= 3) {
                const [r, g, b, rawA = 255] = values;
                if (r === 0 && g === 0 && b === 0) return null;
                const alpha = Math.min(0.9, Math.max(0.1, rawA / 255));
                return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
              }
              const color = SAR_CLASS_COLORS[values[0]];
              return color ?? null;
            },
            mask: (values: number[]) => {
              if (!values) return false;
              if (values.length >= 3) {
                const [r, g, b] = values;
                return r !== 0 || g !== 0 || b !== 0;
              }
              return Boolean(SAR_CLASS_COLORS[values[0]]);
            },
          });

          ensureLayerHasContainer(sarLayer);
          sarLayerRef.current = sarLayer;
          sarLayer.once("load", finalizeSarProgress);
          reportSarState({ loaded: true, error: null });
        } catch (error) {
          if (!cancelled) {
            reportSarState({
              loaded: false,
              error:
                error instanceof Error ? error.message : "Failed to load UAVSAR flood layer",
            });
          }
          sarLayer = null;
          sarLayerRef.current = null;
          finalizeSarProgress();
        }
      } else {
        reportSarState({ loaded: false, error: null });
      }

      const beforeLayers = [beforeImagery, beforeRoads, beforeLabels].filter(Boolean) as L.Layer[];
      const afterLayers = [afterImagery, afterRoads, afterLabels, sarLayer]
        .filter(Boolean) as L.Layer[];

      beforeLayers.forEach((layer) => layer.addTo(map));
      afterLayers.forEach((layer) => {
        if (!beforeLayers.includes(layer)) {
          layer.addTo(map);
        }
      });

      const clipTargets = [afterImageryLayer, roadsLayer, labelsLayer, sarLayer]
        .filter(Boolean) as LayerWithContainer[];

      let applyClip: () => void = () => {};

      const ctl = L.control
        .sideBySide(
          beforeLayers.map((layer) => layer as LayerWithContainer),
          afterLayers.map((layer) => layer as LayerWithContainer),
        )
        .addTo(map);

      applyClip = () => {
        const nw = map.containerPointToLayerPoint([0, 0]);
        const se = map.containerPointToLayerPoint(map.getSize());
        const clipX = nw.x + ctl.getPosition();
        const clipRight = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${clipX}px)`;

        clipTargets.forEach((layer) => {
          const container = layer.getContainer?.();
          if (container) {
            container.style.clip = clipRight;
          }
        });
      };

      ctl.on("dividermove", applyClip);
      if (sarLayer) {
        sarLayer.on("load", applyClip);
      }
      map.on("move", applyClip);
      map.on("resize", applyClip);
      map.on("zoom", applyClip);
      map.on("moveend", applyClip);
      map.on("zoomend", applyClip);

      applyClip();

      cleanup = () => {
        ctl.off("dividermove", applyClip);
        map.off("move", applyClip);
        map.off("resize", applyClip);
        map.off("zoom", applyClip);
        map.off("moveend", applyClip);
        map.off("zoomend", applyClip);

        if (sarLayer) {
          sarLayer.off("load", applyClip);
        }

        ctl.remove();
        beforeLayers.forEach((layer) => {
          if (map.hasLayer(layer)) {
            map.removeLayer(layer);
          }
        });
        afterLayers.forEach((layer) => {
          if (map.hasLayer(layer)) {
            map.removeLayer(layer);
          }
        });

        clipTargets.forEach((layer) => {
          const container = layer.getContainer?.();
          if (container) {
            container.style.clip = "";
          }
        });

        if (sarLayer && sarLayerRef.current === sarLayer) {
          sarLayerRef.current = null;
        }

        finalizeBaseProgress();
        finalizeSarProgress();
      };
    };

    run();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [
    layers.sarDate,
    layers.showLabels,
    layers.showRoads,
    layers.showSar,
    map,
    reportSarState,
    reportProgressStage,
  ]);

  return null;
}

function FitKerrville() {
  const map = useMap();
  useEffect(() => {
    map.setView([30.047, -99.140], 13);
  }, [map]);
  return null;
}

export default function FloodMap() {
  const [map, setMap] = useState<L.Map | null>(null);
  const startMarker = useRef<L.Marker | null>(null);
  const routeLine = useRef<L.GeoJSON | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickedTarget, setPickedTarget] = useState<RouteTarget | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRouteStats, setSelectedRouteStats] = useState<
    { distance: number; duration: number } | null
  >(null);
  const [showRules, setShowRules] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [layerSettings, setLayerSettings] = useState<LayerSettings>({
    showRoads: true,
    showLabels: true,
    showSar: true,
    sarDate: "2025-07-10",
  });
  const [featureVisibility, setFeatureVisibility] = useState<FeatureVisibility>({
    showShelters: true,
    showLowWater: true,
  });
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [sarStatus, setSarStatus] = useState<{ loaded: boolean; error: string | null }>({
    loaded: false,
    error: null,
  });
  const [stageStatus, setStageStatus] = useState<Record<ProgressStage, StageStatus>>({
    base: "idle",
    sar: "idle",
    geocode: "idle",
    route: "idle",
  });
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const stageStatusRef = useRef(stageStatus);
  const hideTimerRef = useRef<number | null>(null);
  const pendingOperations = useRef(0);
  const markStage = useCallback(
    (stage: ProgressStage, action: "start" | "complete") => {
      setStageStatus((prev) => {
        const nextStatus: StageStatus = action === "start" ? "in-progress" : "complete";
        if (prev[stage] === nextStatus) {
          stageStatusRef.current = prev;
          return prev;
        }
        const next = { ...prev, [stage]: nextStatus };
        stageStatusRef.current = next;
        return next;
      });
    },
    [],
  );
  const beginBusy = useCallback(() => {
    pendingOperations.current += 1;
    setBusy(true);
  }, [setBusy]);
  const endBusy = useCallback(() => {
    pendingOperations.current = Math.max(0, pendingOperations.current - 1);
    if (pendingOperations.current === 0) {
      setBusy(false);
    }
  }, [setBusy]);
  const attachMap = useCallback((instance: L.Map | null) => {
    setMap(instance);
  }, []);
  const allTargets = useMemo<RouteTarget[]>(() => [...shelters, ...lowWaterSites], []);
  const toggleLayerSetting = useCallback(
    (key: "showRoads" | "showLabels" | "showSar") => {
      setLayerSettings((prev) => {
        const next = { ...prev, [key]: !prev[key] } as LayerSettings;
        if (key === "showSar" && prev.showSar !== next.showSar) {
          setSarStatus({ loaded: false, error: null });
        }
        return next;
      });
    },
    [setSarStatus],
  );
  const updateSarDate = useCallback((date: SarDate) => {
    setLayerSettings((prev) => ({ ...prev, sarDate: date }));
    setSarStatus({ loaded: false, error: null });
  }, []);
  const toggleFeatureLayer = useCallback((key: keyof FeatureVisibility) => {
    setFeatureVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (!map) return;
    if (!map.getPane(ROUTE_PANE)) {
      const pane = map.createPane(ROUTE_PANE);
      pane.style.zIndex = "650";
      pane.style.pointerEvents = "none";
    }
  }, [map]);

  useEffect(() => {
    stageStatusRef.current = stageStatus;
  }, [stageStatus]);

  useEffect(() => {
    const hasInProgress = PROGRESS_STAGE_SEQUENCE.some(
      (stage) => stageStatus[stage] === "in-progress",
    );
    if (hasInProgress) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setOverlayVisible(true);
    } else if (overlayVisible && hideTimerRef.current === null) {
      hideTimerRef.current = window.setTimeout(() => {
        setOverlayVisible(false);
        hideTimerRef.current = null;
      }, 800);
    }
  }, [overlayVisible, stageStatus]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!overlayVisible) return;
    setSubtitleIndex(0);
    const interval = window.setInterval(() => {
      setSubtitleIndex((value) => (value + 1) % PROGRESS_SUBHEADINGS.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, [overlayVisible]);

  const drawRoute = useCallback(
    (option: RouteOption) => {
      if (!map || !option.geometry || !startMarker.current) return;

      if (routeLine.current) {
        routeLine.current.remove();
      }

      routeLine.current = L.geoJSON(option.geometry, {
        pane: ROUTE_PANE,
        style: {
          color: "#38bdf8",
          weight: 6,
          opacity: 0.9,
          lineCap: "round",
        },
      }).addTo(map);
      routeLine.current.bringToFront();

      const destinationIcon =
        option.target.category === "lowWater" ? lowWaterPin : shelterPin;
      const destinationMarker = L.marker(
        [option.target.coords[0], option.target.coords[1]],
        { icon: destinationIcon },
      );

      const group = L.featureGroup([
        routeLine.current,
        startMarker.current,
        destinationMarker,
      ]);
      map.fitBounds(group.getBounds().pad(0.2));

      setPickedTarget(option.target);
      if (option.osrmDistance !== undefined && option.durationSec !== undefined) {
        setSelectedRouteStats({
          distance: option.osrmDistance,
          duration: option.durationSec,
        });
      } else {
        setSelectedRouteStats(null);
      }
    },
    [map],
  );

  const routeCache = useRef<Map<string, RouteCacheEntry>>(new Map());

  const requestRoute = useCallback(
    async (start: [number, number], destination: [number, number]) => {
      const cacheKey = buildRouteCacheKey(start, destination);
      const cached = routeCache.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${start[1]},${start[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        if (!response.ok) {
          return null;
        }
        const json = (await response.json()) as OsrmResponse;
        if (json.code && json.code !== "Ok") {
          return null;
        }
        const firstRoute = json.routes?.[0];
        const geometry = firstRoute?.geometry;
        if (
          !geometry ||
          (geometry.type !== "LineString" && geometry.type !== "MultiLineString")
        ) {
          return null;
        }

        const result: RouteCacheEntry = {
          geometry,
          distance:
            typeof firstRoute?.distance === "number" ? firstRoute.distance : undefined,
          duration:
            typeof firstRoute?.duration === "number" ? firstRoute.duration : undefined,
        };
        routeCache.current.set(cacheKey, result);
        return result;
      } catch {
        return null;
      }
    },
    [],
  );

  const activeRouteRequest = useRef(0);

  const routeFrom = useCallback(
    async (startLat: number, startLon: number) => {
      if (!map) return;

      const start: [number, number] = [startLat, startLon];
      const requestId = ++activeRouteRequest.current;

      setStartCoords(start);
      setSelectedRouteId(null);
      setSelectedRouteStats(null);
      setRouteOptions([]);
      setPickedTarget(null);

      if (routeLine.current) {
        routeLine.current.remove();
        routeLine.current = null;
      }

      if (startMarker.current) {
        startMarker.current.remove();
      }
      startMarker.current = L.marker(start, { icon: startPin })
        .bindPopup("Start point")
        .addTo(map);

      markStage("route", "start");
      beginBusy();
      try {
        const sorted = allTargets
          .map((target): RouteOption => ({
            target,
            crowDistance: haversine([startLat, startLon], target.coords),
          }))
          .sort((a, b) => a.crowDistance - b.crowDistance)
          .slice(0, 3);

        const enriched = await Promise.all(
          sorted.map(async (option): Promise<RouteOption> => {
            const route = await requestRoute(start, option.target.coords);
            if (!route) {
              return option;
            }
            return {
              ...option,
              geometry: route.geometry,
              osrmDistance: route.distance,
              durationSec: route.duration,
            };
          }),
        );

        if (activeRouteRequest.current !== requestId) {
          return;
        }

        setRouteOptions(enriched);

        const initial = enriched.find((option) => option.geometry);
        if (initial) {
          setSelectedRouteId(initial.target.id);
          drawRoute(initial);
        } else {
          setSelectedRouteStats(null);
        }
      } finally {
        markStage("route", "complete");
        endBusy();
      }
    },
    [allTargets, beginBusy, drawRoute, endBusy, map, markStage, requestRoute],
  );

  const handleRouteSelect = useCallback(
    async (targetId: string) => {
      if (!map || !startCoords) return;
      const option = routeOptions.find((item) => item.target.id === targetId);
      if (!option) return;

      setSelectedRouteId(targetId);

      if (option.geometry) {
        drawRoute(option);
        return;
      }

      beginBusy();
      const startSnapshot = startCoords;
      try {
        const route = await requestRoute(startCoords, option.target.coords);
        if (!route || startSnapshot !== startCoords) {
          return;
        }
        const updated: RouteOption = {
          ...option,
          geometry: route.geometry,
          osrmDistance: route.distance,
          durationSec: route.duration,
        };
        setRouteOptions((prev) =>
          prev.map((item) => (item.target.id === targetId ? updated : item)),
        );
        drawRoute(updated);
      } finally {
        endBusy();
      }
    },
    [beginBusy, drawRoute, endBusy, map, requestRoute, routeOptions, startCoords],
  );

  useEffect(() => {
    if (!showRules && !layerMenuOpen && !showSources) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showRules) setShowRules(false);
        if (layerMenuOpen) setLayerMenuOpen(false);
        if (showSources) setShowSources(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [layerMenuOpen, showRules, showSources]);

  const sarStatusLabel = !layerSettings.showSar
    ? "UAVSAR flood layer: OFF"
    : sarStatus.error
      ? "UAVSAR flood layer: unavailable"
      : sarStatus.loaded
        ? "UAVSAR flood layer: ON"
        : "Loading UAVSAR flood layer…";

  const downloadRoutesPdf = useCallback(() => {
    if (!routeOptions.length) return;

    const now = new Date();
    const selectedTarget = selectedRouteId
      ? routeOptions.find((option) => option.target.id === selectedRouteId)?.target
      : null;
    const valueOrNA = (value?: string | null) => {
      if (!value) return "N/A";
      const trimmed = value.trim();
      return trimmed.length ? trimmed : "N/A";
    };

    const lines: string[] = [];
    lines.push("Flood Evacuation & Low-Water Routes");
    lines.push("");
    if (startCoords) {
      lines.push(
        `Start coordinates: ${startCoords[0].toFixed(5)}, ${startCoords[1].toFixed(5)}`,
      );
    }
    lines.push(`Generated: ${now.toLocaleString("en-US")}`);
    lines.push(`Selected site: ${selectedTarget ? selectedTarget.name : "None"}`);
    lines.push("");

    routeOptions.forEach((option, index) => {
      const { target } = option;
      const distanceText =
        option.osrmDistance !== undefined ? formatDistance(option.osrmDistance) : "N/A";
      const durationText =
        option.durationSec !== undefined ? formatDuration(option.durationSec) : "N/A";
      const crowText = formatDistance(option.crowDistance);
      const isSelected = target.id === selectedRouteId;

      lines.push(
        `${index + 1}. ${target.name}${isSelected ? " (selected)" : ""}`,
      );
      lines.push(`Category: ${CATEGORY_LABEL[target.category]}`);
      lines.push(`Address: ${valueOrNA("address" in target ? target.address : undefined)}`);
      lines.push(`Phone: ${valueOrNA("phone" in target ? target.phone ?? undefined : undefined)}`);
      lines.push(`Status: ${valueOrNA("status" in target ? target.status : undefined)}`);
      lines.push(`OSRM route: ${distanceText} · ${durationText}`);
      lines.push(`Crow distance: ${crowText}`);
      lines.push(`Notes: ${valueOrNA("note" in target ? target.note : undefined)}`);
      lines.push(`Source: ${valueOrNA("source" in target ? target.source : undefined)}`);
      lines.push("");
    });

    const pdfString = buildPdfDocument(lines);
    const blob = new Blob([pdfString], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const filename = `evacuation-routes-${now.toISOString().slice(0, 10)}.pdf`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [routeOptions, selectedRouteId, startCoords]);

  const currentStageInProgress = PROGRESS_STAGE_SEQUENCE.find(
    (stage) => stageStatus[stage] === "in-progress",
  );
  const completedStages = PROGRESS_STAGE_SEQUENCE.filter(
    (stage) => stageStatus[stage] === "complete",
  );
  const activeStage = currentStageInProgress
    ? currentStageInProgress
    : completedStages.length
      ? completedStages[completedStages.length - 1]
      : null;
  const activeStageMeta = activeStage ? PROGRESS_STAGES[activeStage] : PROGRESS_STAGES.base;
  const rawPercent = currentStageInProgress
    ? activeStageMeta.start
    : completedStages.length
      ? activeStageMeta.end
      : 0;
  const clampedPercent = Math.max(0, Math.min(100, rawPercent));
  const percentLabel = Math.round(clampedPercent);
  const progressLabel = activeStageMeta.label;
  const progressSubtitle = PROGRESS_SUBHEADINGS[subtitleIndex % PROGRESS_SUBHEADINGS.length];

  return (
    <div className="relative">
      {overlayVisible && (
        <div className="pointer-events-none fixed inset-0 z-[2500] flex items-center justify-center px-4">
          <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/10 bg-black/80 px-6 py-5 text-white shadow-2xl backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
              Preparing map
            </div>
            <div className="mt-3 text-lg font-semibold">{progressLabel}</div>
            <div className="mt-1 text-sm text-white/70">{progressSubtitle}</div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400 transition-[width] duration-500 ease-out"
                style={{ width: `${clampedPercent}%` }}
              />
            </div>
            <div className="mt-2 text-right text-xs font-semibold text-white/60">
              {percentLabel}%
            </div>
          </div>
        </div>
      )}
      <Controls
        setStart={(lat, lon) => routeFrom(lat, lon)}
        busy={busy}
        onGeocodeStart={() => markStage("geocode", "start")}
        onGeocodeComplete={() => markStage("geocode", "complete")}
      />
      <button
        type="button"
        onClick={() => setShowRules(true)}
        className="absolute right-4 top-[88px] z-[1000] rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white backdrop-blur transition hover:bg-white/20"
      >
        Flood evacuation playbook
      </button>
      <div className="h-[calc(100vh-76px)]">
        <MapContainer
          center={[30.047, -99.140] as LatLngExpression}
          zoom={13}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
          ref={attachMap}
        >
          <FitKerrville />
          {/* Base layer required for attribution (kept hidden) */}
          <TileLayer
            attribution="&copy; OpenStreetMap & Esri"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0}
          />
          {map && (
            <SideBySideLayers
              map={map}
              reportSarState={setSarStatus}
              layers={layerSettings}
              reportProgressStage={markStage}
            />
          )}

          {allTargets
            .filter((target) =>
              target.category === "lowWater"
                ? featureVisibility.showLowWater
                : featureVisibility.showShelters,
            )
            .map((target) => {
              const markerIcon = target.category === "lowWater" ? lowWaterPin : shelterPin;
              return (
                <Marker
                  key={target.id}
                  position={target.coords as LatLngExpression}
                icon={markerIcon}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <div className="font-semibold">{target.name}</div>
                    <div className="text-[11px] uppercase tracking-wide text-black/60">
                      {CATEGORY_LABEL[target.category]}
                    </div>
                    <div className="opacity-70">{target.address}</div>
                    <div className="opacity-70">{target.note}</div>
                  </div>
                </Popup>
              </Marker>
            );
            })}
        </MapContainer>
      </div>

      <div className="absolute right-4 top-[140px] z-[1000] space-y-2 text-right">
        <button
          type="button"
          onClick={() => setLayerMenuOpen((open) => !open)}
          aria-expanded={layerMenuOpen}
          aria-controls="layer-toggle-menu"
          className="rounded-full border border-white/20 bg-black/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur transition hover:bg-black/70"
        >
          Map layers
        </button>
        {layerMenuOpen && (
          <div
            id="layer-toggle-menu"
            className="w-64 rounded-2xl border border-white/20 bg-black/80 p-4 text-sm text-white shadow-xl"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Toggle overlays (right map)
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex items-center justify-between gap-3">
                <span>Road overlay</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-400"
                  checked={layerSettings.showRoads}
                  onChange={() => toggleLayerSetting("showRoads")}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Map labels</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-400"
                  checked={layerSettings.showLabels}
                  onChange={() => toggleLayerSetting("showLabels")}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>UAVSAR flood extent</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-400"
                  checked={layerSettings.showSar}
                  onChange={() => toggleLayerSetting("showSar")}
                />
              </label>
              {layerSettings.showSar && (
                <div className="space-y-1 rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] text-white/70">
                  {Object.entries(SAR_SOURCES).map(([date, info]) => (
                    <label key={date} className="flex items-start gap-2">
                      <input
                        type="radio"
                        className="mt-[3px] accent-sky-400"
                        name="sar-date"
                        checked={layerSettings.sarDate === date}
                        onChange={() => updateSarDate(date as SarDate)}
                      />
                      <span>{info.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 border-t border-white/10 pt-3 text-xs font-semibold uppercase tracking-wide text-white/60">
              Flood legend
            </div>
            <div className="mt-2 space-y-1 text-[11px] text-white/70">
              <div className="flex items-center gap-2">
                <span className="block h-3 w-3 rounded-sm bg-[rgba(0,120,255,0.9)]"></span>
                <span>Blue — Open water</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="block h-3 w-3 rounded-sm bg-[rgba(0,200,0,0.9)]"></span>
                <span>Green — Flooded vegetation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="block h-3 w-3 rounded-sm bg-[rgba(255,50,50,0.9)]"></span>
                <span>Red — Flooded developed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="block h-3 w-3 rounded-sm bg-[rgba(255,140,0,0.9)]"></span>
                <span>Orange — Flooded crop</span>
              </div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-3 text-xs font-semibold uppercase tracking-wide text-white/60">
              Community layers
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex items-center justify-between gap-3">
                <span>Shelter markers</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-400"
                  checked={featureVisibility.showShelters}
                  onChange={() => toggleFeatureLayer("showShelters")}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Low-water crossings</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-400"
                  checked={featureVisibility.showLowWater}
                  onChange={() => toggleFeatureLayer("showLowWater")}
                />
              </label>
            </div>
            <div className="mt-3 text-[11px] text-white/60">
              Map overlays (roads, labels, UAVSAR) affect only the post-flood (right) half. Community layers toggle the planning markers on both halves.
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowSources(true)}
          className="block w-full rounded-full border border-white/20 bg-black/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur transition hover:bg-black/70"
        >
          Data sources
        </button>
      </div>

      {showRules && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Flood evacuation rules"
          onClick={() => setShowRules(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl bg-white/95 p-8 text-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="absolute right-6 top-6 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black/70 transition hover:bg-black/10"
              aria-label="Close evacuation rules"
            >
              Close
            </button>
            <div className="space-y-3 pr-16">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
                Flood Ready Kerrville
              </div>
              <h2 className="text-2xl font-bold text-black">
                Flood evacuation rules
              </h2>
              <p className="text-black/70">
                Keep this playbook handy and share it with your crew. The best teams prepare before the storm, not during it.
              </p>
              <ol className="space-y-4 text-sm text-black/80">
                {EVAC_RULES.map((rule, index) => (
                  <li key={rule.title} className="flex gap-4">
                    <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-base font-semibold text-black">{rule.title}</div>
                      <div className="leading-relaxed text-black/70">{rule.details}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="text-xs uppercase tracking-wide text-black/50">
                Stay ready. Check neighbors. Stay safe.
              </div>
            </div>
          </div>
        </div>
      )}

      {showSources && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Project data sources"
          onClick={() => setShowSources(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-3xl bg-white/95 p-8 text-black shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowSources(false)}
              className="absolute right-6 top-6 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black/70 transition hover:bg-black/10"
              aria-label="Close data sources"
            >
              Close
            </button>
            <div className="space-y-4 pr-16">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
                Flood Radar — Data & References
              </div>
              <h2 className="text-2xl font-bold text-black">Project Data Sources</h2>
              <p className="text-sm text-black/70">
                Core datasets, algorithms, tools, and policies supporting the Kerr County flood decision tool.
              </p>
              <div className="space-y-2 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-black/60">Core layers</div>
                <ul className="space-y-1 list-disc pl-5 text-black/80">
                  {DATA_SOURCE_OVERVIEW.map((item) => (
                    <li key={item.label}>
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noreferrer" className="underline decoration-dotted decoration-sky-500 underline-offset-4 hover:text-sky-600">
                          {item.label}
                        </a>
                      ) : (
                        item.label
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {DATA_SOURCE_REFERENCES.map((section) => (
                <div key={section.title} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-black/60">
                    {section.title}
                  </div>
                  <ul className="space-y-1 list-disc pl-5 text-[13px] text-black/75">
                    {section.entries.map((entry) => (
                      <li key={entry.text}>
                        {entry.href ? (
                          <a href={entry.href} target="_blank" rel="noreferrer" className="underline decoration-dotted decoration-sky-500 underline-offset-4 hover:text-sky-600">
                            {entry.text}
                          </a>
                        ) : (
                          entry.text
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {routeOptions.length > 0 && (
        <div className="absolute left-4 bottom-4 z-[1000] flex flex-col gap-3 max-w-[320px]">
          <div className="px-4 py-3 rounded-xl backdrop-blur bg-black/60 border border-white/15 text-xs space-y-2">
            <div className="text-sm font-semibold text-white">Route legend</div>
            <div className="flex items-center gap-2">
              <span className="block h-[3px] w-10 rounded-full bg-sky-300"></span>
              <span className="opacity-80">Current route</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative h-3 w-3">
                <span className="absolute inset-0 rounded-full border border-white/40 bg-sky-400"></span>
              </span>
              <span className="opacity-80">Start point</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative h-3 w-3">
                <span className="absolute inset-0 rounded-full border border-white/40 bg-emerald-400"></span>
              </span>
              <span className="opacity-80">Shelter</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative h-3 w-3">
                <span className="absolute inset-0 rounded-full border border-white/40 bg-red-400"></span>
              </span>
              <span className="opacity-80">Low-water crossing</span>
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl backdrop-blur bg-white/90 text-sm text-black shadow-lg border border-white/60">
            <div className="font-semibold text-xs uppercase tracking-wide text-black/75">
              Route options
            </div>
            <div className="mt-2 space-y-2">
              {routeOptions.map((option) => {
                const { target } = option;
                const selected = target.id === selectedRouteId;
                const badgeStyles =
                  target.category === "lowWater"
                    ? "bg-red-500/20 text-red-700 border border-red-500/40"
                    : "bg-emerald-500/20 text-emerald-700 border border-emerald-500/40";
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => handleRouteSelect(target.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      selected
                        ? "border-sky-400 bg-sky-100/80 shadow"
                        : "border-black/10 bg-white/70 hover:border-sky-300 hover:bg-white"
                    } disabled:opacity-60`}
                    disabled={busy}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-black/90 leading-snug">
                        {target.name}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeStyles}`}
                      >
                        {CATEGORY_LABEL[target.category]}
                      </span>
                    </div>
                    <div className="text-xs text-black/70">
                      {formatDuration(option.durationSec)} · {formatDistance(option.osrmDistance)}
                    </div>
                    <div className="text-[11px] text-black/50">
                      Direct distance: {formatDistance(option.crowDistance)}
                    </div>
                    {target.note && (
                      <div className="text-[11px] text-black/45">
                        {target.note}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-[11px] text-black/50">
              Routes use OSRM driving directions; pick an alternate site if a road is blocked or flooded.
            </div>
            <button
              type="button"
              onClick={downloadRoutesPdf}
              disabled={!routeOptions.length}
              className="mt-3 w-full rounded-lg bg-sky-500 text-white py-2 text-sm font-semibold transition hover:bg-sky-400 disabled:opacity-50"
            >
              Download routes (PDF)
            </button>
          </div>
        </div>
      )}

      <div className="absolute right-4 bottom-4 z-[1000]">
        <div className="px-4 py-2 rounded-xl backdrop-blur bg-white/10 border border-white/20 text-xs">
          <div>{sarStatusLabel}</div>
          {layerSettings.showSar && sarStatus.error && (
            <div className="text-[11px] text-red-300">{sarStatus.error}</div>
          )}
          {pickedTarget && (
            <div className="mt-1">
              Route to: <b>{pickedTarget.name}</b>
              <div className="text-[11px] uppercase tracking-wide opacity-70">
                {CATEGORY_LABEL[pickedTarget.category]}
              </div>
            </div>
          )}
          {selectedRouteStats && (
            <div className="mt-1 opacity-80">
              {formatDuration(selectedRouteStats.duration)} · {formatDistance(selectedRouteStats.distance)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
