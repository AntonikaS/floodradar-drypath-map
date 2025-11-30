import type { FeatureCollection, Polygon } from "geojson";

export type FloodZoneFeatureCollection = FeatureCollection<
  Polygon,
  {
    id: string;
    name: string;
    level: "High" | "Moderate" | "Low";
    description: string;
  }
>;

export const floodZones: FloodZoneFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "guadalupe-north",
        name: "Guadalupe River North Bank",
        level: "High",
        description: "Historic floodplain hugging the north bank of the Guadalupe River downtown.",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1545, 30.0566],
            [-99.1448, 30.0594],
            [-99.1355, 30.0549],
            [-99.1258, 30.0481],
            [-99.1327, 30.041],
            [-99.1453, 30.036],
            [-99.1539, 30.0408],
            [-99.1587, 30.0482],
            [-99.1545, 30.0566],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "downtown-loop",
        name: "Downtown Loop Lowland",
        level: "Moderate",
        description: "Low-lying neighborhoods between Water St and Main St that accumulate runoff.",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1532, 30.0494],
            [-99.1477, 30.0523],
            [-99.1425, 30.0522],
            [-99.137, 30.0495],
            [-99.1369, 30.045],
            [-99.1417, 30.0417],
            [-99.1476, 30.0414],
            [-99.1524, 30.0437],
            [-99.1532, 30.0494],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "louise-hays-park",
        name: "Louise Hays Park Basin",
        level: "Low",
        description: "Park basin designed to take on overflow during heavy rain events.",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1489, 30.0425],
            [-99.1453, 30.0448],
            [-99.1424, 30.0431],
            [-99.1412, 30.0396],
            [-99.1434, 30.0369],
            [-99.1479, 30.0364],
            [-99.1499, 30.0394],
            [-99.1489, 30.0425],
          ],
        ],
      },
    },
  ],
};
