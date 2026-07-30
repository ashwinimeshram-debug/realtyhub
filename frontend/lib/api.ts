import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export function backendAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${BACKEND_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

let _csrfToken: string | null =
  typeof window !== "undefined"
    ? document.cookie.replace(/(?:(?:^|.*;\s*)csrf_access_token\s*=\s*([^;]*).*$)|^.*$/, "$1") || null
    : null;

export function setCsrfToken(token: string | null) {
  _csrfToken = token;
}

export function getCsrfToken(): string | null {
  return _csrfToken;
}

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  if (
    config.method &&
    ["post", "put", "delete", "patch"].includes(config.method)
  ) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers["X-CSRF-TOKEN"] = csrfToken;
    }
  }
  return config;
});

API.interceptors.response.use(
  (response) => {
    // Auto-capture CSRF token from cookie (set by login endpoint)
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)csrf_access_token\s*=\s*([^;]*)/);
      if (match) {
        setCsrfToken(match[1]);
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 429) {
      const msg =
        error.response?.data?.error ||
        "Too many requests. Please wait a moment and try again.";
      if (typeof window !== "undefined") {
        console.warn("Rate limited:", msg);
      }
    }
    return Promise.reject(error);
  }
);

export default API;

const PROP_SALT = "nrr2k25x";
export function encodePropertyId(id: number): string {
  return btoa(`${PROP_SALT}:${id}`)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decodePropertyId(slug: string): number | null {
  try {
    let s = slug.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const decoded = atob(s);
    const [salt, num] = decoded.split(":");
    if (salt !== PROP_SALT || !num) return null;
    const id = Number(num);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
