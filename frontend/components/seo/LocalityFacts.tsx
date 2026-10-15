import type { GeoPoint, LocalityInfo } from "@/lib/seo/types";
import { describeLocality, localityGeo } from "@/lib/seo/nagpur-geo";

export default function LocalityFacts({
  locationName,
  locality,
  geo,
}: {
  locationName: string;
  locality?: LocalityInfo;
  geo?: GeoPoint | null;
}) {
  if (!locationName) return null;

  const coords = geo || locality?.geo || localityGeo(locationName);
  const description = locality?.description || describeLocality(locationName);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
  const span = 0.01;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.longitude - span},${coords.latitude - span},${coords.longitude + span},${coords.latitude + span}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`;

  return (
    <section
      className="py-8 px-4 md:px-10"
      aria-labelledby="locality-facts-heading"
      style={{ backgroundColor: "var(--bg-page)" }}
    >
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2
          id="locality-facts-heading"
          className="text-lg md:text-xl font-bold mb-3"
          style={{ color: "var(--text-dark)" }}
        >
          Living in {locationName}, Nagpur
        </h2>
        <p className="text-gray-600 text-sm leading-relaxed mb-4">{description}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {locality?.connectivity && locality.connectivity.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Connectivity
              </h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {locality.connectivity.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {locality?.landmarks && locality.landmarks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Nearby Landmarks
              </h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {locality.landmarks.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
          <iframe
            title={`Map of ${locationName}`}
            src={osmSrc}
            loading="lazy"
            className="w-full"
            style={{ height: 260, border: 0 }}
          />
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-sm font-medium"
          style={{ color: "var(--primary)" }}
        >
          View {locationName} on Google Maps →
        </a>
      </div>
    </section>
  );
}
