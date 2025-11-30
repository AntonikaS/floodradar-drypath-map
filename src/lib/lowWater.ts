export type LowWaterSite = {
  id: string;
  name: string;
  address: string;
  status: string;
  note: string;
  coords: [number, number];
  source: string;
  category: "lowWater";
};

export const lowWaterSites: LowWaterSite[] = [
  {
    id: "lowwater_louise_hays",
    name: "Low Water Crossing — Louise Hays Park",
    address: "Louise Hays Park, Kerrville, TX 78028",
    status: "monitor",
    note: "Park drive at the Guadalupe River; closes quickly during rises.",
    coords: [30.0465, -99.1472],
    source: "Kerrville OEM flood watch notes",
    category: "lowWater",
  },
  {
    id: "lowwater_riverside_drive",
    name: "Low Water Crossing — Riverside Dr",
    address: "Riverside Dr & Guadalupe St, Kerrville, TX 78028",
    status: "monitor",
    note: "Neighborhood crossing routinely submerged by moderate floods.",
    coords: [30.0527, -99.1289],
    source: "Kerr County road status reports",
    category: "lowWater",
  },
  {
    id: "lowwater_glen_road",
    name: "Low Water Crossing — Glen Rd",
    address: "Glen Rd & Lytle St, Kerrville, TX 78028",
    status: "monitor",
    note: "Steep approach; debris accumulation common during heavy rain.",
    coords: [30.0558, -99.1334],
    source: "Kerrville public works advisories",
    category: "lowWater",
  },
];
