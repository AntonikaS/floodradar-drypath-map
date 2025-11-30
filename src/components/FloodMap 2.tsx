"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import type { LineString, MultiLineString } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet-side-by-side";
import * as Esri from "esri-leaflet";
import { shelters } from "@/lib/shelters";

const pin = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const shelterPin = L.divIcon({
  className: "shelter-pin",
  html: `
    <svg width="28" height="42" viewBox="0 0 28 42" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 11.2 21.2 12.1 22.1a2.7 2.7 0 0 0 3.8 0C16.8 35.2 28 24.5 28 14 28 6.27 21.73 0 14 0z"
            fill="#22c55e" stroke="#ffffff" stroke-width="2" filter="url(#glow)"/>
      <circle cx="14" cy="14" r="5.5" fill="#ffffff" opacity=".9"/>
    </svg>
  `,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
});

type Shelter = (typeof shelters)[number];
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
  setDynamicLayers?: (layers: Array<Record<string, unknown>>) => void;
  eachLayer?: (fn: (layer: L.Layer) => void) => void;
  on?: <T extends L.LeafletEvent>(event: string, handler: (event: T) => void) => void;
  off?: <T extends L.LeafletEvent>(event: string, handler?: (event: T) => void) => void;
  _currentImage?: {
    getElement?: () => HTMLElement | null;
    _image?: HTMLElement | null;
    _container?: HTMLElement | null;
  } | null;
  _renderer?: {
    _container?: HTMLElement | null;
  } | null;
};

type RouteMode = "fast" | "safe";

type RouteOption = {
  shelter: Shelter;
  crowDistance: number;
  osrmDistance?: number;
  durationSec?: number;
  geometry?: LineString | MultiLineString;
  mode: RouteMode;
};

const ROUTE_MODE_LABEL: Record<RouteMode, string> = {
  fast: "Fast",
  safe: "Safe",
};

const ROUTE_STYLE_BY_MODE: Record<RouteMode, L.PathOptions> = {
  fast: {
    color: "#38bdf8",
    weight: 6,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round",
  },
  safe: {
    color: "#34d399",
    weight: 6,
    opacity: 0.95,
    lineCap: "round",
    lineJoin: "round",
    dashArray: "12 10",
  },
};

function assignRouteModes(options: RouteOption[]): RouteOption[] {
  if (!options.length) return options;

  const bestIndex = options.reduce((currentBest, option, index, arr) => {
    const best = arr[currentBest];
    const bestHasDuration = typeof best.durationSec === "number";
    const optionHasDuration = typeof option.durationSec === "number";

    if (optionHasDuration && !bestHasDuration) {
      return index;
    }

    if (optionHasDuration && bestHasDuration) {
      return option.durationSec! < best.durationSec! ? index : currentBest;
    }

    if (!optionHasDuration && !bestHasDuration) {
      return option.crowDistance < best.crowDistance ? index : currentBest;
    }

    return currentBest;
  }, 0);

  return options.map((option, index) => ({
    ...option,
    mode: (index === bestIndex ? "fast" : "safe") as RouteMode,
  }));
}

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
    if (current) {
      if (typeof current.getElement === "function") {
        const el = current.getElement();
        if (el) return el;
      }
      if (current._image) return current._image;
      if (current._container) return current._container;
    }

    const renderer = (layer as LayerWithContainer)._renderer;
    if (renderer?._container) {
      return renderer._container;
    }

    const anyLayer = layer as unknown as { _path?: SVGElement | null };
    if (anyLayer._path?.parentElement) {
      return anyLayer._path.parentElement as HTMLElement;
    }

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
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
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
        setError("Адрес не найден");
        return;
      }
      const { lat, lon } = js[0];
      setStart(parseFloat(lat), parseFloat(lon));
    } catch {
      setError("Ошибка геокодирования");
    }
  }

  return (
    <div className="absolute z-[1000] top-4 left-1/2 -translate-x-1/2 w-[min(900px,calc(100%-1rem))]">
      <div className="backdrop-blur bg-white/10 border border-white/20 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Введите адрес (например: 700 Main St)"
            className="w-full px-4 py-2 rounded-xl bg-black/50 border border-white/20 outline-none"
          />
          <button
            onClick={geocode}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-white text-black font-semibold disabled:opacity-50"
          >
            Найти адрес
          </button>
        </div>
        {error && <div className="px-4 pb-3 text-red-300 text-sm">{error}</div>}
        <div className="px-4 pb-3 text-xs opacity-70">
          Демо: геокодер Nominatim, маршрутизация OSRM.
        </div>
      </div>
    </div>
  );
}

function SideBySideLayers({
  map,
  setFemaLoaded,
}: {
  map: L.Map;
  setFemaLoaded: (ok: boolean) => void;
}) {
  useEffect(() => {
    const beforeImagery = Esri.basemapLayer("Imagery");
    const beforeRoads = Esri.basemapLayer("ImageryTransportation");
    const beforeLabels = Esri.basemapLayer("ImageryLabels");
    const afterImagery = Esri.basemapLayer("Imagery");

    const beforeRoadsLayer = beforeRoads as LayerWithContainer;
    const beforeLabelsLayer = beforeLabels as LayerWithContainer;
    ensureLayerHasContainer(beforeRoadsLayer);
    ensureLayerHasContainer(beforeLabelsLayer);
    beforeImagery.addTo(map);
    beforeRoads.addTo(map);
    beforeLabels.addTo(map);
    afterImagery.addTo(map);

    const FEMA_URL =
      "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Areas/MapServer";
    const floodLayerIds = [0, 1, 2, 3, 4, 5, 6];

    const corePaneId = "flood-core-pane";
    const glowPaneId = "flood-glow-pane";
    const corePane = map.getPane(corePaneId) ?? map.createPane(corePaneId);
    corePane.style.zIndex = "620";
    corePane.style.mixBlendMode = "screen";
    corePane.style.opacity = "1";
    corePane.style.filter = "saturate(210%)";
    corePane.style.pointerEvents = "none";

    const glowPane = map.getPane(glowPaneId) ?? map.createPane(glowPaneId);
    glowPane.style.zIndex = "610";
    glowPane.style.mixBlendMode = "screen";
    glowPane.style.opacity = "0.75";
    glowPane.style.filter = "blur(26px) saturate(240%)";
    glowPane.style.pointerEvents = "none";

    const createFloodLayer = (
      pane: string,
      opacity: number,
      options?: Partial<Esri.DynamicMapLayerOptions>,
    ) => {
      const layer = Esri.dynamicMapLayer({
        url: FEMA_URL,
        format: "png32",
        transparent: true,
        layers: floodLayerIds,
        opacity,
        useCors: true,
        pane,
        ...options,
      }) as LayerWithContainer;
      layer.setLayers?.(floodLayerIds);
      ensureLayerHasContainer(layer);
      return layer;
    };

    const baseLayer = createFloodLayer(corePaneId, 0.95);
    const sheenLayer = createFloodLayer(corePaneId, 0.6, { opacity: 0.6 });
    const glowLayer = createFloodLayer(glowPaneId, 0.7);

    const styleLayer = (
      layer: LayerWithContainer,
      style: (el: HTMLElement) => void,
    ) => {
      const apply = () => {
        const container = layer.getContainer?.();
        if (!container) return;
        style(container);
      };
      layer.on?.("load", apply);
      apply();
      return () => layer.off?.("load", apply);
    };

    const detachBase = styleLayer(baseLayer, (el) => {
      el.style.mixBlendMode = "screen";
      el.style.filter =
        "drop-shadow(0 0 18px rgba(24, 119, 214, 0.45)) saturate(220%)";
      el.style.opacity = "1";
      el.style.pointerEvents = "none";
    });
    const detachSheen = styleLayer(sheenLayer, (el) => {
      el.style.mixBlendMode = "screen";
      el.style.filter =
        "blur(8px) brightness(1.2) saturate(230%) drop-shadow(0 0 16px rgba(255,255,255,0.4))";
      el.style.opacity = "0.78";
      el.style.pointerEvents = "none";
    });
    const detachGlow = styleLayer(glowLayer, (el) => {
      el.style.mixBlendMode = "screen";
      el.style.filter = "blur(30px) saturate(250%)";
      el.style.opacity = "0.7";
      el.style.pointerEvents = "none";
    });

    baseLayer.addTo(map);
    sheenLayer.addTo(map);
    glowLayer.addTo(map);
    glowLayer.bringToFront?.();
    sheenLayer.bringToFront?.();
    baseLayer.bringToFront?.();

    const ctl = L.control.sideBySide(
      [beforeImagery, beforeRoadsLayer, beforeLabelsLayer],
      [afterImagery, glowLayer, sheenLayer, baseLayer],
    ).addTo(map);

    const clipTargets: Array<LayerWithContainer | HTMLElement> = [
      afterImagery as LayerWithContainer,
      baseLayer,
      sheenLayer,
      glowLayer,
      corePane,
      glowPane,
    ];

    const applyClip = () => {
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(map.getSize());
      const clipX = nw.x + ctl.getPosition();
      const clipRight = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${clipX}px)`;

      clipTargets.forEach((target) => {
        const container =
          target instanceof HTMLElement ? target : target.getContainer?.();
        if (container) {
          container.style.clip = clipRight;
        }
      });
    };

    ctl.on("dividermove", applyClip);
    map.on("move", applyClip);
    map.on("resize", applyClip);
    map.on("zoom", applyClip);
    map.on("moveend", applyClip);
    map.on("zoomend", applyClip);

    const handleBaseLoad = () => {
      setFemaLoaded(true);
      applyClip();
      baseLayer.off?.("load", handleBaseLoad);
    };
    baseLayer.on?.("load", handleBaseLoad);

    applyClip();

    return () => {
      ctl.off("dividermove", applyClip);
      map.off("move", applyClip);
      map.off("resize", applyClip);
      map.off("zoom", applyClip);
      map.off("moveend", applyClip);
      map.off("zoomend", applyClip);

      ctl.remove();
      map.removeLayer(beforeImagery);
      map.removeLayer(beforeRoads);
      map.removeLayer(beforeLabelsLayer);
      map.removeLayer(afterImagery);
      map.removeLayer(glowLayer);
      map.removeLayer(sheenLayer);
      map.removeLayer(baseLayer);

      clipTargets.forEach((target) => {
        const container =
          target instanceof HTMLElement ? target : target.getContainer?.();
        if (container) {
          container.style.clip = "";
        }
      });

      detachGlow();
      detachSheen();
      detachBase();
      baseLayer.off?.("load", handleBaseLoad);
    };
  }, [map, setFemaLoaded]);

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
  const [femaLoaded, setFemaLoaded] = useState(false);
  const [pickedShelter, setPickedShelter] = useState<Shelter | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRouteStats, setSelectedRouteStats] = useState<
    { distance: number; duration: number } | null
  >(null);
  const [selectedRouteMode, setSelectedRouteMode] = useState<RouteMode | null>(
    null,
  );
  const attachMap = useCallback((instance: L.Map | null) => {
    setMap(instance);
  }, []);

  useEffect(() => {
    if (!map) return;
    const ensurePane = (name: string, zIndex: string) => {
      const pane = map.getPane(name) ?? map.createPane(name);
      pane.style.zIndex = zIndex;
      return pane;
    };

    const routePane = ensurePane("route-overlay-pane", "640");
    routePane.style.pointerEvents = "none";

    ensurePane("shelter-marker-pane", "760");
    ensurePane("start-marker-pane", "770");
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

    const style = ROUTE_STYLE_BY_MODE[option.mode] ?? ROUTE_STYLE_BY_MODE.fast;

    routeLine.current = L.geoJSON(option.geometry, {
      pane: "route-overlay-pane",
      style: () => ({ ...style }),
    }).addTo(map);

    const group = L.featureGroup([
      routeLine.current,
      startMarker.current,
      L.marker([option.shelter.coords[0], option.shelter.coords[1]], {
        icon: shelterPin,
        pane: "shelter-marker-pane",
      }),
    ]);
    map.fitBounds(group.getBounds().pad(0.2));

    setPickedShelter(option.shelter);
    setSelectedRouteMode(option.mode);
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
    setSelectedRouteMode(null);

    if (routeLine.current) {
      routeLine.current.remove();
      routeLine.current = null;
    }

    if (startMarker.current) {
      startMarker.current.remove();
    }
    startMarker.current = L.marker(start, { icon: pin, pane: "start-marker-pane" })
      .bindPopup("Точка старта")
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
        const baseOption: RouteOption = {
          ...option,
          mode: "safe",
        };

        const route = await requestRoute(start, option.shelter.coords);
        if (route) {
          enriched.push({
            ...baseOption,
            geometry: route.geometry,
            osrmDistance: route.distance,
            durationSec: route.duration,
          });
        } else {
          enriched.push(baseOption);
        }
      }

      const withModes = assignRouteModes(enriched);
      setRouteOptions(withModes);

      const initial =
        withModes.find((option) => option.mode === "fast" && option.geometry) ??
        withModes.find((option) => option.geometry);
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
      let nextSelected: RouteOption | undefined;
      setRouteOptions((prev) => {
        const mutated = prev.map((item) =>
          item.shelter.id === shelterId
            ? {
                ...item,
                geometry: route.geometry,
                osrmDistance: route.distance,
                durationSec: route.duration,
              }
            : item,
        );
        const withModes = assignRouteModes(mutated);
        nextSelected = withModes.find((item) => item.shelter.id === shelterId);
        return withModes;
      });
      if (nextSelected) {
        drawRoute(nextSelected);
      }
    } finally {
      setBusy(false);
    }
  };

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
          {/* Подложка нужна для атрибуции (не отображается) */}
          <TileLayer
            attribution="&copy; OpenStreetMap & Esri"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0}
          />
          {map && <SideBySideLayers map={map} setFemaLoaded={setFemaLoaded} />}

          {shelters.map((s) => (
            <Marker
              key={s.id}
              position={s.coords as LatLngExpression}
              icon={shelterPin}
              pane="shelter-marker-pane"
            >
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
            <div className="text-sm font-semibold text-white">Легенда маршрута</div>
            <div className="flex items-center gap-2">
              <span className="block h-[3px] w-10 rounded-full bg-sky-300"></span>
              <span className="opacity-80">Режим Fast</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="block h-[3px] w-10 rounded-full"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, #34d399, #34d399 12px, transparent 12px, transparent 20px)",
                }}
              ></span>
              <span className="opacity-80">Режим Safe</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative h-3 w-3">
                <span className="absolute inset-0 rounded-full border border-white/40 bg-sky-400"></span>
              </span>
              <span className="opacity-80">Точка старта</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative h-3 w-3">
                <span className="absolute inset-0 rounded-full border border-white/30 bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"></span>
              </span>
              <span className="opacity-80">Пункт размещения</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="block h-3 w-3 rounded-sm bg-sky-900/60 border border-sky-200/40"></span>
              <span className="opacity-80">FEMA flood zone</span>
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl backdrop-blur bg-white/90 text-sm text-black shadow-lg border border-white/60">
            <div className="font-semibold text-xs uppercase tracking-wide text-black/75">
              Маршруты эвакуации
            </div>
            <div className="mt-2 space-y-2">
              {routeOptions.map((option) => {
                const selected = option.shelter.id === selectedRouteId;
                const selectedStyles =
                  option.mode === "fast"
                    ? "border-sky-400 bg-sky-100/80 shadow"
                    : "border-emerald-400 bg-emerald-100/80 shadow";
                const idleStyles =
                  option.mode === "fast"
                    ? "border-black/10 bg-white/70 hover:border-sky-300 hover:bg-white"
                    : "border-black/10 bg-white/70 hover:border-emerald-300 hover:bg-white";
                return (
                  <button
                    key={option.shelter.id}
                    type="button"
                    onClick={() => handleRouteSelect(option.shelter.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      selected ? selectedStyles : idleStyles
                    } disabled:opacity-60`}
                    disabled={busy}
                  >
                    <div className="text-sm font-semibold text-black/90">
                      {option.shelter.name}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-black/60">
                      Route Mode: {ROUTE_MODE_LABEL[option.mode]}
                    </div>
                    <div className="text-xs text-black/70">
                      {formatDuration(option.durationSec)} · {formatDistance(option.osrmDistance)}
                    </div>
                    <div className="text-[11px] text-black/50">
                      По прямой: {formatDistance(option.crowDistance)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-[11px] text-black/50">
              Маршруты рассчитываются через OSRM, выбирайте подходящий вариант при перегрузке основного приёмника.
            </div>
          </div>
        </div>
      )}

      <div className="absolute right-4 bottom-4 z-[1000]">
        <div className="px-4 py-2 rounded-xl backdrop-blur bg-white/10 border border-white/20 text-xs">
          {femaLoaded ? "FEMA flood layer: ON" : "Loading FEMA layer…"}
          {pickedShelter && (
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.8)]"></span>
              <span>
                Маршрут до: <b>{pickedShelter.name}</b>
              </span>
            </div>
          )}
          {selectedRouteMode && (
            <div className="mt-1 text-[11px] uppercase tracking-wide text-white/80">
              Route Mode: {ROUTE_MODE_LABEL[selectedRouteMode]}
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
