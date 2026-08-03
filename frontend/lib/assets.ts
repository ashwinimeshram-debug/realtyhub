export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export function backendAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${BACKEND_BASE_URL}/${path.replace(/^\/+/, "")}`;
}
