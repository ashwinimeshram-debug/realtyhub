import API from "./api";

export interface LocationCount {
  name: string;
  count: number;
}

export interface TypeOption {
  name: string;
  value: string;
}

// Module-level promise caches so multiple components requesting the same
// lookup on a page render only trigger a single network request.
let locationCountsPromise: Promise<LocationCount[]> | null = null;
const typePromises: Record<string, Promise<TypeOption[]>> = {};

export function getLocationCounts(): Promise<LocationCount[]> {
  if (!locationCountsPromise) {
    locationCountsPromise = API.get("/location-counts")
      .then((res) => (Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        locationCountsPromise = null;
        return [];
      });
  }
  return locationCountsPromise;
}

export function getTypes(category: string): Promise<TypeOption[]> {
  if (!typePromises[category]) {
    typePromises[category] = API.get(`/types?category=${encodeURIComponent(category)}`)
      .then((res) => (Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        delete typePromises[category];
        return [];
      });
  }
  return typePromises[category];
}
