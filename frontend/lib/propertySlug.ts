const PROP_SALT = "nrr2k25x";

/**
 * Opaque, reversible id encoding. Used for internal/admin routes so those
 * links stay stable regardless of public slug formatting.
 */
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

export function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

/**
 * Canonical public slug for a listing, e.g. `19-3-bhk-flat-in-sadar`.
 * Falls back to the bare numeric id when no title is available.
 */
export function buildPropertySlug(id: number, title?: string | null): string {
  const base = slugify(title || "");
  return base ? `${id}-${base}` : String(id);
}

/**
 * Resolve a public route param to a numeric property id.
 * Accepts the canonical `{id}-{slug}` form and the legacy opaque base64 slug.
 */
export function parsePropertySlug(slug: string): number | null {
  if (!slug) return null;
  const match = slug.match(/^(\d+)(?:-|$)/);
  if (match) {
    const id = Number(match[1]);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return decodePropertyId(slug);
}

export function propertyHref(
  id: number,
  title?: string | null,
  query?: string,
): string {
  const base = `/property/${buildPropertySlug(id, title)}`;
  return query ? `${base}?${query}` : base;
}
