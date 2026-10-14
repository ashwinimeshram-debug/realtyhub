import axios from "axios";
import {
  API_BASE_URL,
  BACKEND_BASE_URL,
  backendAssetUrl,
} from "./assets";

export { API_BASE_URL, BACKEND_BASE_URL, backendAssetUrl };

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

export {
  encodePropertyId,
  decodePropertyId,
  buildPropertySlug,
  parsePropertySlug,
  propertyHref,
  slugify,
} from "./propertySlug";
