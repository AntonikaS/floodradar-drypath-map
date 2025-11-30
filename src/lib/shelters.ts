export type Shelter = {
  id: string;
  name: string;
  address: string;
  status: string;
  note: string;
  phone: string;
  coords: [number, number];
  source: string;
  category: "shelter";
};

export const shelters: Shelter[] = [
  {
    id: "shelter_fumc",
    name: "First United Methodist Church",
    address: "321 Thompson Dr, Kerrville, TX 78028",
    status: "standby",
    note: "Capacity varies",
    phone: "(830) 257-0809",
    coords: [30.0416, -99.1449],
    source: "TDHCA flood resources (Kerr County)",
    category: "shelter",
  },
  {
    id: "shelter_calvary",
    name: "Calvary Temple Church",
    address: "3000 Loop 534, Kerrville, TX 78028",
    status: "standby",
    note: "Large sanctuary / gym spaces",
    phone: "(830) 895-3000",
    coords: [30.0339, -99.1024],
    source: "TDHCA flood resources (Kerr County)",
    category: "shelter",
  },
  {
    id: "shelter_notredame",
    name: "Notre Dame Catholic Church",
    address: "909 Main St, Kerrville, TX 78028",
    status: "standby",
    note: "Parish hall",
    phone: "(830) 257-5961",
    coords: [30.0454, -99.1408],
    source: "TDHCA flood resources (Kerr County)",
    category: "shelter",
  },
  {
    id: "shelter_schreiner",
    name: "Schreiner University (Event Center)",
    address: "2100 Memorial Blvd, Kerrville, TX 78028",
    status: "standby",
    note: "University facilities as designated",
    phone: "(830) 896-5411",
    coords: [30.0409, -99.1331],
    source: "TDHCA flood resources (Kerr County)",
    category: "shelter",
  },
  {
    id: "shelter_comfort_hs",
    name: "Comfort High School (aux shelter for county)",
    address: "201 US-87, Comfort, TX 78013",
    status: "standby",
    note: "Gym / commons",
    phone: "(830) 995-6430",
    coords: [29.9698, -98.9057],
    source: "TDHCA flood resources (Kerr County)",
    category: "shelter",
  },
];
