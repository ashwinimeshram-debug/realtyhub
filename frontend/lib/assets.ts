export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

export function backendAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${BACKEND_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VARIANT_WIDTHS: Record<string, number> = { card: 600, full: 1600 };

/**
 * Build a `<img>` src + srcset from a stored image path using the backend's
 * WebP variant naming convention (e.g. foo.jpg -> foo.card.webp / foo.full.webp).
 * Falls back to the original when the file is not a supported image.
 */
export function imageVariants(path: string | null | undefined): {
  src: string;
  srcSet?: string;
} {
  const original = backendAssetUrl(path || "");
  if (!path) return { src: original };

  const lower = path.toLowerCase();
  const ext = IMAGE_EXTS.find((e) => lower.endsWith(e));
  if (!ext) return { src: original };

  const root = path.slice(0, path.length - ext.length);
  const entries = Object.entries(VARIANT_WIDTHS).map(
    ([name, width]) => `${backendAssetUrl(`${root}.${name}.webp`)} ${width}w`
  );
  return { src: original, srcSet: entries.join(", ") };
}

export function isLocalhostUrl(url: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(
    url
  );
}
