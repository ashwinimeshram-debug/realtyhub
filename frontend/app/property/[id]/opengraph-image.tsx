import { ImageResponse } from "next/og";
import sharp from "sharp";
import { fetchJson, getSettings } from "@/lib/serverData";
import { backendAssetUrl } from "@/lib/assets";
import { parsePropertySlug } from "@/lib/propertySlug";
import { formatPriceDisplay } from "@/lib/priceFormat";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Property listing";

async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const png = await sharp(input)
      .resize(560, 630, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = parsePropertySlug(id);

  const [property, settings] = await Promise.all([
    numericId ? fetchJson(`/property/${numericId}`) : Promise.resolve(null),
    getSettings(),
  ]);

  const title = String(property?.title || "Property").slice(0, 90);
  const price = property
    ? formatPriceDisplay(property.price, property.price_text).replace(/₹/g, "Rs. ")
    : "";
  const location = property?.location ? String(property.location).slice(0, 60) : "";
  const siteName = settings.site_name || "Property Listing";

  const firstImage =
    Array.isArray(property?.images) && property.images[0]
      ? backendAssetUrl(property.images[0])
      : null;
  const imageData = firstImage ? await imageToDataUrl(firstImage) : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f4cba 0%, #0a2f74 100%)",
        }}
      >
        {imageData ? (
          <img
            src={imageData}
            alt=""
            style={{ width: "560px", height: "630px", objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "56px 48px",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, opacity: 0.85 }}>
            {siteName}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.2,
              marginTop: 24,
            }}
          >
            {title}
          </div>
          {price ? (
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#ffd54f", marginTop: 24 }}>
              {price}
            </div>
          ) : null}
          {location ? (
            <div style={{ display: "flex", fontSize: 30, marginTop: 16, opacity: 0.9 }}>
              {location}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 24, marginTop: "auto", opacity: 0.75 }}>
            View full details online
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
