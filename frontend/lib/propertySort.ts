export type PropertySort = "newest" | "price_asc" | "price_desc" | "featured";

export function sortProperties<
  T extends { price?: number | string | null; is_featured?: boolean | number }
>(list: T[], sortBy: string): T[] {
  const items = [...list];
  switch (sortBy) {
    case "price_asc":
      return items.sort((a, b) => {
        const av = a.price != null && Number(a.price) > 0 ? Number(a.price) : Infinity;
        const bv = b.price != null && Number(b.price) > 0 ? Number(b.price) : Infinity;
        return av - bv;
      });
    case "price_desc":
      return items.sort((a, b) => {
        const av = a.price != null && Number(a.price) > 0 ? Number(a.price) : 0;
        const bv = b.price != null && Number(b.price) > 0 ? Number(b.price) : 0;
        return bv - av;
      });
    case "featured":
      return items.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    default:
      return items;
  }
}
