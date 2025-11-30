import { NextResponse } from "next/server";

const UAVSAR_SERVICE_URL =
  process.env.UAVSAR_SERVICE_URL ??
  "https://maps.disasters.nasa.gov/ags03/rest/services/texas_flood_202507/uavsar/MapServer";
const TILE_SIZE = 256;
const EARTH_RADIUS = 6378137;
const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS;

function tile2lon(x: number, z: number) {
  return (x / 2 ** z) * 360 - 180;
}

function tile2lat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function lonLatToWebMercator(lon: number, lat: number) {
  const x = (lon * ORIGIN_SHIFT) / 180;
  const clampedLat = Math.max(Math.min(lat, 89.9999), -89.9999);
  const y =
    (Math.log(Math.tan(((90 + clampedLat) * Math.PI) / 360)) * EARTH_RADIUS);
  return { x, y };
}

export async function GET(
  _req: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
) {
  const { z, x, y } = context?.params ?? {};
  if (z === undefined || x === undefined || y === undefined) {
    return NextResponse.json({ error: "Missing tile coordinates" }, { status: 400 });
  }

  const zoom = Number(z);
  const tileX = Number(x);
  const tileY = Number(y);

  if (!Number.isFinite(zoom) || !Number.isFinite(tileX) || !Number.isFinite(tileY)) {
    return NextResponse.json({ error: "Invalid tile coordinates" }, { status: 400 });
  }

  const north = tile2lat(tileY, zoom);
  const south = tile2lat(tileY + 1, zoom);
  const west = tile2lon(tileX, zoom);
  const east = tile2lon(tileX + 1, zoom);

  const { x: minX, y: minY } = lonLatToWebMercator(west, south);
  const { x: maxX, y: maxY } = lonLatToWebMercator(east, north);

  const bbox = [minX, minY, maxX, maxY].join(",");
  const url =
    `${UAVSAR_SERVICE_URL}/export` +
    `?bbox=${encodeURIComponent(bbox)}` +
    `&bboxSR=102100&imageSR=102100` +
    `&size=${TILE_SIZE},${TILE_SIZE}` +
    `&format=png32&transparent=true&f=image`;

  const upstream = await fetch(url, {
    headers: {
      Accept: "image/png",
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: message || `Upstream error ${upstream.status}` },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=600",
    },
  });
}
