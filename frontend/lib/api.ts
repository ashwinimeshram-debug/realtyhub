import axios from "axios";
import {
  API_BASE_URL,
  BACKEND_BASE_URL,
  backendAssetUrl,
  imageVariants,
} from "./assets";

export { API_BASE_URL, BACKEND_BASE_URL, backendAssetUrl, imageVariants };

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + name + "\\s*=\\s*([^;]*)")
  );
  return match ? match[1] || null : null;
}

let _csrfToken: string | null = readCookie("csrf_access_token");
let _ownerCsrfToken: string | null = readCookie("owner_csrf_token");

export function setCsrfToken(token: string | null) {
  _csrfToken = token;
}

export function getCsrfToken(): string | null {
  return _csrfToken;
}

export function getOwnerCsrfToken(): string | null {
  return _ownerCsrfToken;
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
    // Admin session CSRF (flask-jwt-extended default cookie).
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers["X-CSRF-TOKEN"] = csrfToken;
    }
    // Isolated owner session CSRF (separate cookie / header).
    if (_ownerCsrfToken) {
      config.headers["X-Owner-CSRF-TOKEN"] = _ownerCsrfToken;
    }
  }
  return config;
});

API.interceptors.response.use(
  (response) => {
    // Auto-capture CSRF tokens from cookies (set by login endpoints).
    const adminCsrf = readCookie("csrf_access_token");
    if (adminCsrf) {
      setCsrfToken(adminCsrf);
    }
    const ownerCsrf = readCookie("owner_csrf_token");
    if (ownerCsrf) {
      _ownerCsrfToken = ownerCsrf;
    } else {
      _ownerCsrfToken = null;
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
