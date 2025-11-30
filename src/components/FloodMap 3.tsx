"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON as GeoJSONLayer,
  useMap,
} from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import type { Feature, LineString, MultiLineString, Polygon } from "geojson";
import "leaflet/dist/leaflet.css";
import { shelters } from "@/lib/shelters";
import { floodZones } from "@/lib/floodZones";

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

const ROUTE_PANE = "evac-route";
const FLOOD_PANE = "flood-zones";

type FloodZoneProperties = (typeof floodZones.features)[number]["properties"];
type FloodFeature = Feature<Polygon, FloodZoneProperties>;

const floodZoneColors: Record<FloodZoneProperties["level"], string> = {
  High: "#ef4444",
  Moderate: "#f97316",
  Low: "#38bdf8",
};

function getFloodZoneStyle(feature?: Feature | null): L.PathOptions {
  const typed = feature as FloodFeature | null | undefined;
  const level = typed?.properties?.level ?? "Moderate";
  const base = floodZoneColors[level] ?? floodZoneColors.Moderate;
  return {
    color: base,
    weight: 1,
    fillColor: base,
    fillOpacity: 0.28,
  };
}

type Shelter = (typeof shelters)[number];
type NominatimResult = {
  lat: string;
  lon: string;
};

type RouteOption = {
  shelter: Shelter;
  crowDistance: number;
  osrmDistance?: number;
  durationSec?: number;
  geometry?: LineString | MultiLineString;
};

function formatDistance(meters?: number) {
  if (!meters && meters !== 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return "—";
  const minutes = Math.round(seconds / 60);
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
}: {
  setStart: (lat: number, lon: number) => void;
  busy: boolean;
}) {
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function geocode() {
    setError(null);
    if (!q.trim()) return;
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
    }
  }

  return (
    <div className="absolute z-[1000] top-4 left-1/2 -translate-x-1/2 w-[min(900px,calc(100%-1rem))]">
      <div className="backdrop-blur bg-white/10 border border-white/20 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Enter an address (e.g. 700 Main St)"
            className="w-full px-4 py-2 rounded-xl bg-black/50 border border-white/20 outline-none"
          />
          <button
            onClick={geocode}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-white text-black font-semibold disabled:opacity-50"
          >
            Find address
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
  const [zonesReady, setZonesReady] = useState(false);
  const [pickedShelter, setPickedShelter] = useState<Shelter | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRouteStats, setSelectedRouteStats] = useState<
    { distance: number; duration: number } | null
  >(null);
  const attachMap = useCallback((instance: L.Map | null) => {
    setMap(instance);
  }, []);

  const zoneStyle = useCallback(
    (feature?: Feature) => getFloodZoneStyle(feature),
    [],
  );

  const handleEachZone = useCallback((feature: Feature, layer: L.Layer) => {
    const typedFeature = feature as FloodFeature;
    if (!typedFeature?.properties) return;
    const { name, level, description } = typedFeature.properties;
    const popup = document.createElement("div");
    popup.className = "text-sm space-y-1";
    popup.innerHTML = `
      <div class="font-semibold">${name}</div>
      <div class="text-xs uppercase tracking-wide text-neutral-500">${level} risk</div>
      <div class="text-xs text-neutral-400">${description}</div>
    `;
    layer.bindPopup(popup);
  }, []);

  useEffect(() => {
    if (!map) return;
    if (!map.getPane(FLOOD_PANE)) {
      const pane = map.createPane(FLOOD_PANE);
      pane.style.zIndex = "580";
    }
    if (!map.getPane(ROUTE_PANE)) {
      const pane = map.createPane(ROUTE_PANE);
      pane.style.zIndex = "650";
      pane.style.pointerEvents = "none";
    }
    setZonesReady(true);
  }, [map]);

  async function requestRoute(
    start: [number, number],
    destination: [number, number],
  ) {
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${start[1]},${start[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();
      const route = json?.routes?.[0];
      const geometry = route?.geometry;
      if (
        !geometry ||
        (geometry.type !== "LineString" && geometry.type !== "MultiLineString")
      ) {
        return null;
      }
      return {
        geometry,
        distance: route.distance as number | undefined,
        duration: route.duration as number | undefined,
      };
    } catch {
      return null;
    }
  }

  function drawRoute(option: RouteOption) {
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

    const group = L.featureGroup([
      routeLine.current,
      startMarker.current,
      L.marker([option.shelter.coords[0], option.shelter.coords[1]], { icon: shelterPin }),
    ]);
    map.fitBounds(group.getBounds().pad(0.2));

    setPickedShelter(option.shelter);
    if (option.osrmDistance !== undefined && option.durationSec !== undefined) {
      setSelectedRouteStats({
        distance: option.osrmDistance,
        duration: option.durationSec,
      });
    } else {
      setSelectedRouteStats(null);
    }
  }

  async function routeFrom(startLat: number, startLon: number) {
    if (!map) return;

    const start: [number, number] = [startLat, startLon];
    setStartCoords(start);
    setSelectedRouteId(null);
    setSelectedRouteStats(null);
    setRouteOptions([]);
    setPickedShelter(null);

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

    setBusy(true);
    try {
      const sorted = shelters
        .map((shelter) => ({
          shelter,
          crowDistance: haversine([startLat, startLon], shelter.coords),
        }))
        .sort((a, b) => a.crowDistance - b.crowDistance)
        .slice(0, 3);

      const enriched: RouteOption[] = [];
      for (const option of sorted) {
        const route = await requestRoute(start, option.shelter.coords);
        if (route) {
          enriched.push({
            ...option,
            geometry: route.geometry,
            osrmDistance: route.distance,
            durationSec: route.duration,
          });
        } else {
          enriched.push(option);
        }
      }

      setRouteOptions(enriched);

      const initial = enriched.find((option) => option.geometry);
      if (initial) {
        setSelectedRouteId(initial.shelter.id);
        drawRoute(initial);
      }
    } finally {
      setBusy(false);
    }
  }

  const handleRouteSelect = async (shelterId: string) => {
    if (!map || !startCoords) return;
    const option = routeOptions.find((item) => item.shelter.id === shelterId);
    if (!option) return;

    setSelectedRouteId(shelterId);

    if (option.geometry) {
      drawRoute(option);
      return;
    }

    setBusy(true);
    try {
      const route = await requestRoute(startCoords, option.shelter.coords);
      if (!route) {
        return;
      }
      const updated: RouteOption = {
        ...option,
        geometry: route.geometry,
        osrmDistance: route.distance,
        durationSec: route.duration,
      };
      setRouteOptions((prev) =>
        prev.map((item) => (item.shelter.id === shelterId ? updated : item)),
      );
      drawRoute(updated);
    } finally {
      setBusy(false);
    }
  };

  const downloadRoutesPdf = useCallback(() => {
    if (!routeOptions.length) return;

    const now = new Date();
    const selectedShelter = selectedRouteId
      ? routeOptions.find((option) => option.shelter.id === selectedRouteId)?.shelter
      : null;

    const lines: string[] = [];
    lines.push("Flood Evacuation Routes");
    lines.push("");
    if (startCoords) {
      lines.push(
        `Start coordinates: ${startCoords[0].toFixed(5)}, ${startCoords[1].toFixed(5)}`,
      );
    }
    lines.push(`Generated: ${now.toLocaleString("en-US")}`);
    lines.push(`Selected shelter: ${selectedShelter ? selectedShelter.name : "None"}`);
    lines.push("");

    routeOptions.forEach((option, index) => {
      const distanceText =
        option.osrmDistance !== undefined ? formatDistance(option.osrmDistance) : "N/A";
      const durationText =
        option.durationSec !== undefined ? formatDuration(option.durationSec) : "N/A";
      const crowText = formatDistance(option.crowDistance);
      const isSelected = option.shelter.id === selectedRouteId;

      lines.push(`${index + 1}. ${option.shelter.name}${isSelected ? " (selected)" : ""}`);
      lines.push(`Address: ${option.shelter.address}`);
      lines.push(`Phone: ${option.shelter.phone}`);
      lines.push(`Status: ${option.shelter.status}`);
      lines.push(`OSRM route: ${distanceText} · ${durationText}`);
      lines.push(`Crow distance: ${crowText}`);
      lines.push(`Notes: ${option.shelter.note}`);
      lines.push(`Source: ${option.shelter.source}`);
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

  return (
    <div className="relative">
      <Controls setStart={(lat, lon) => routeFrom(lat, lon)} busy={busy} />
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
          {zonesReady && (
            <GeoJSONLayer
              data={floodZones}
              style={zoneStyle}
              onEachFeature={handleEachZone}
              pane={FLOOD_PANE}
            />
          )}

          {shelters.map((s) => (
            <Marker key={s.id} position={s.coords as LatLngExpression} icon={shelterPin}>
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{s.name}</div>
                  <div className="opacity-70">{s.note}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

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
              <span className="block h-3 w-3 rounded-sm bg-sky-900/60 border border-sky-200/40"></span>
              <span className="opacity-80">FEMA flood zone</span>
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl backdrop-blur bg-white/90 text-sm text-black shadow-lg border border-white/60">
            <div className="font-semibold text-xs uppercase tracking-wide text-black/75">
              Evacuation routes
            </div>
            <div className="mt-2 space-y-2">
              {routeOptions.map((option) => {
                const selected = option.shelter.id === selectedRouteId;
                return (
                  <button
                    key={option.shelter.id}
                    type="button"
                    onClick={() => handleRouteSelect(option.shelter.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      selected
                        ? "border-sky-400 bg-sky-100/80 shadow"
                        : "border-black/10 bg-white/70 hover:border-sky-300 hover:bg-white"
                    } disabled:opacity-60`}
                    disabled={busy}
                  >
                    <div className="text-sm font-semibold text-black/90">
                      {option.shelter.name}
                    </div>
                    <div className="text-xs text-black/70">
                      {formatDuration(option.durationSec)} · {formatDistance(option.osrmDistance)}
                    </div>
                    <div className="text-[11px] text-black/50">
                      As the crow flies: {formatDistance(option.crowDistance)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-[11px] text-black/50">
              Routes are calculated via OSRM; choose an alternate shelter if the primary one is overloaded.
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
          {zonesReady ? "Flood zones layer: ON" : "Loading flood zones…"}
          {pickedShelter && <div className="mt-1">Route to: <b>{pickedShelter.name}</b></div>}
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
