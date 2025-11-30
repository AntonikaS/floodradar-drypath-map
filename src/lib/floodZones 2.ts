import type { Feature, FeatureCollection, Polygon } from "geojson";

export type FloodSeverity = "high" | "moderate" | "low";

export type FloodZoneProperties = {
  severity: FloodSeverity;
};

export const floodZones: FeatureCollection<Polygon, FloodZoneProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { severity: "high" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1764, 30.071],
            [-99.1696, 30.0669],
            [-99.1638, 30.0611],
            [-99.1592, 30.0538],
            [-99.1615, 30.0482],
            [-99.1683, 30.0456],
            [-99.1758, 30.0471],
            [-99.1809, 30.0535],
            [-99.1827, 30.0619],
            [-99.1802, 30.0682],
            [-99.1764, 30.071],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { severity: "high" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1617, 30.0605],
            [-99.1553, 30.0567],
            [-99.1498, 30.0505],
            [-99.1471, 30.0443],
            [-99.1509, 30.0401],
            [-99.1568, 30.0392],
            [-99.1626, 30.0428],
            [-99.1664, 30.0486],
            [-99.1669, 30.0549],
            [-99.1645, 30.0596],
            [-99.1617, 30.0605],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { severity: "moderate" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1514, 30.0493],
            [-99.1443, 30.0461],
            [-99.1379, 30.0404],
            [-99.1368, 30.0341],
            [-99.1417, 30.0301],
            [-99.1489, 30.0294],
            [-99.1547, 30.0332],
            [-99.1571, 30.0393],
            [-99.1564, 30.0456],
            [-99.1538, 30.0484],
            [-99.1514, 30.0493],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { severity: "moderate" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1452, 30.0368],
            [-99.1386, 30.0341],
            [-99.1338, 30.0297],
            [-99.1335, 30.0243],
            [-99.1383, 30.0209],
            [-99.1457, 30.02],
            [-99.1509, 30.0236],
            [-99.1529, 30.0294],
            [-99.1509, 30.0349],
            [-99.1468, 30.0365],
            [-99.1452, 30.0368],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { severity: "low" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1348, 30.0302],
            [-99.1291, 30.0274],
            [-99.1235, 30.0215],
            [-99.1248, 30.0158],
            [-99.1313, 30.0129],
            [-99.1375, 30.0148],
            [-99.1418, 30.0205],
            [-99.1409, 30.0263],
            [-99.1372, 30.0291],
            [-99.1348, 30.0302],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { severity: "low" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.1184, 30.0221],
            [-99.1132, 30.0183],
            [-99.1087, 30.0125],
            [-99.1105, 30.0074],
            [-99.1167, 30.0053],
            [-99.1229, 30.0076],
            [-99.1268, 30.0129],
            [-99.1261, 30.0182],
            [-99.1219, 30.0212],
            [-99.1184, 30.0221],
          ],
        ],
      },
    },
  ],
};

export type FloodZoneFeature = Feature<Polygon, FloodZoneProperties>;
