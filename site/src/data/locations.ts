// Real shoot locations from the archive (2016–2025).
// coordinates: [latitude, longitude]
export interface ShootLocation {
  id: string;
  place: string;
  region: string;
  coordinates: [number, number];
  years: string;
  note: string;
}

export const locations: ShootLocation[] = [
  {
    id: "munich",
    place: "Munich & the Alps",
    region: "Germany",
    coordinates: [47.8, 11.4],
    years: "2020–2025",
    note: "Home base. Alpine lakes, light trails, Königssee, Walchensee.",
  },
  {
    id: "dolomites",
    place: "Dolomites",
    region: "Italy",
    coordinates: [46.41, 11.84],
    years: "2025",
    note: "Winter peaks and snow-laden valleys.",
  },
  {
    id: "rome",
    place: "Rome · Florence · Venice",
    region: "Italy",
    coordinates: [41.9, 12.5],
    years: "2022",
    note: "Architecture, canals and old-world geometry.",
  },
  {
    id: "amsterdam",
    place: "Amsterdam",
    region: "Netherlands",
    coordinates: [52.37, 4.9],
    years: "2020–2021",
    note: "Night streets, the A'DAM tower, frozen-lake minimalism.",
  },
  {
    id: "grancanaria",
    place: "Gran Canaria",
    region: "Canary Islands",
    coordinates: [27.96, -15.6],
    years: "2023",
    note: "Layered ridgelines, ocean sunsets, pilot whales.",
  },
  {
    id: "nyc",
    place: "New York City",
    region: "USA",
    coordinates: [40.71, -74.01],
    years: "2022",
    note: "Skylines, One WTC, the Oculus, Niagara by night.",
  },
  {
    id: "southwest",
    place: "Grand Canyon · Zion · White Sands",
    region: "USA Southwest",
    coordinates: [36.1, -112.1],
    years: "2022",
    note: "Canyon dawns, red rock, and white gypsum dunes.",
  },
  {
    id: "goa",
    place: "Goa",
    region: "India",
    coordinates: [15.3, 74.0],
    years: "2023",
    note: "Monsoon light over the Western Ghats.",
  },
];
