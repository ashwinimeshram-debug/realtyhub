import type { GeoPoint, LocalityInfo } from "./types";

export type { GeoPoint, LocalityInfo } from "./types";

export const NAGPUR_CENTER: GeoPoint = { latitude: 21.1458, longitude: 79.0882 };

interface LocalitySeed {
  name: string;
  geo: GeoPoint;
  connectivity?: string[];
  landmarks?: string[];
  description?: string;
}

const LOCALITIES: LocalitySeed[] = [
  {
    name: "Sadar",
    geo: { latitude: 21.1616, longitude: 79.0796 },
    connectivity: ["Sadar Railway Station", "Central Avenue", "Residency Road"],
    landmarks: ["Sadar Bazaar", "Japanese Garden", "Nagpur Improvement Trust"],
    description:
      "Sadar is a central Nagpur locality known for its markets, schools and quick access to Sitabuldi and the railway junction.",
  },
  {
    name: "Manish Nagar",
    geo: { latitude: 21.0969, longitude: 79.0481 },
    connectivity: ["Wardha Road", "Besa Road", "Nagpur Metro South"],
    landmarks: ["Manish Nagar Railway Station", "Anjuman College", "Besa Road Market"],
    description:
      "Manish Nagar is a fast-growing residential belt on Wardha Road with metro access, schools and gated societies.",
  },
  {
    name: "Wakhewar",
    geo: { latitude: 21.165, longitude: 79.032 },
    connectivity: ["Katol Road", "Nagpur-Katol Highway"],
    landmarks: ["Wakhewar Layout", "Koradi Road junction"],
    description:
      "Wakhewar offers affordable residential layouts with reasonable connectivity to north-west Nagpur.",
  },
  {
    name: "Samruddhi Mahamarg",
    geo: { latitude: 21.108, longitude: 78.98 },
    connectivity: ["Mumbai-Nagpur Expressway", "Wardha Road", "Outer Ring Road"],
    landmarks: ["Samruddhi Expressway entry", "MIHAN", "SEZ"],
    description:
      "The Samruddhi Mahamarg corridor near Nagpur is a growth investment zone linked to MIHAN, SEZ and the expressway.",
  },
  {
    name: "Dharampeth",
    geo: { latitude: 21.14, longitude: 79.066 },
    connectivity: ["West High Court Road", "Law College Square"],
    landmarks: ["Dharampeth Garden", "Nehru Nagar", "Laxmi Nagar"],
    description:
      "Dharampeth is a prime central-west residential and commercial area with premium schools and shopping.",
  },
  {
    name: "Besa",
    geo: { latitude: 21.082, longitude: 79.064 },
    connectivity: ["Besa Road", "Pipla Road", "Manish Nagar"],
    landmarks: ["Besa Square", "Pipla", "Hudkeshwar Road"],
    description:
      "Besa is a popular south Nagpur residential suburb with new gated projects and schools on Besa-Pipla Road.",
  },
  {
    name: "Civil Lines",
    geo: { latitude: 21.148, longitude: 79.074 },
    connectivity: ["Central Avenue", "Wardha Road", "Sitabuldi"],
    landmarks: ["Nagpur Vidhan Bhavan", "Ramgiri", "High Court"],
    description:
      "Civil Lines is an upscale central locality with heritage bungalows, offices and premium independent homes.",
  },
  {
    name: "Hingna",
    geo: { latitude: 21.077, longitude: 78.98 },
    connectivity: ["Hingna Road", "MIHAN", "Wadi"],
    landmarks: ["Hingna MIDC", "MIHAN", "Wanadongri"],
    description:
      "Hingna and MIHAN form Nagpur's industrial and IT corridor with plotted development opportunities.",
  },
  {
    name: "Wardha Road",
    geo: { latitude: 21.1, longitude: 79.055 },
    connectivity: ["Wardha Road", "Nagpur Metro", "Airport Road"],
    landmarks: ["Dr. Babasaheb Ambedkar International Airport", "Chhatrapati Square"],
    description:
      "Wardha Road is Nagpur's primary southern growth corridor connecting the airport, metro and MIHAN.",
  },
  {
    name: "Kamptee Road",
    geo: { latitude: 21.183, longitude: 79.088 },
    connectivity: ["Kamptee Road", "Nagpur Junction", "Indora Square"],
    landmarks: ["Indora Square", "Kadbi Chowk", "Kamptee"],
    description:
      "Kamptee Road in north Nagpur has established residential pockets with strong road and rail links.",
  },
];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,]/g, " ")
    .replace(/\bnagpur\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyLocality(name: string): string {
  return normalize(name).replace(/\s+/g, "-");
}

function matches(seedName: string, query: string): boolean {
  const a = normalize(seedName);
  const b = normalize(query);
  if (!b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function getLocality(name: string): LocalityInfo | undefined {
  if (!name) return undefined;
  const seed = LOCALITIES.find((l) => matches(l.name, name));
  if (!seed) return undefined;
  return {
    name: seed.name,
    slug: slugifyLocality(seed.name),
    geo: seed.geo,
    connectivity: seed.connectivity,
    landmarks: seed.landmarks,
    description: seed.description,
  };
}

export function getLocalityBySlug(slug: string): LocalityInfo | undefined {
  const seed = LOCALITIES.find((l) => slugifyLocality(l.name) === slug);
  if (!seed) return undefined;
  return getLocality(seed.name);
}

export function localityGeo(name: string): GeoPoint {
  return getLocality(name)?.geo ?? NAGPUR_CENTER;
}

export function describeLocality(name: string): string {
  const locality = getLocality(name);
  if (locality?.description) return locality.description;
  return `Properties for sale and rent in ${name}, Nagpur — verified listings with prices, photos and direct owner contact.`;
}
