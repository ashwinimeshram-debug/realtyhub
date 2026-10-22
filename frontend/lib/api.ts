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
  timeout: 20000,
});

/**
 * True for errors that are transient infrastructure failures (5xx, network
 * drops, timeouts) rather than real auth/permission rejections. Shared hosts
 * can throw these intermittently under DB connection contention; treating them
 * as "session expired" logs users out spuriously.
 */
export function isTransientError(error: any): boolean {
  if (!error || error.code === "ERR_CANCELED") return false;
  const status = error.response?.status;
  if (status === undefined) return true; // network error / timeout
  return status >= 500;
}

/**
 * Retry an async request a few times with backoff, but only for transient
 * (5xx / network) failures. Real 4xx responses are returned immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 600
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || i === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

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
