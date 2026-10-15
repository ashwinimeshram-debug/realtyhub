"use client";

import { useCallback, useState } from "react";

type GeoPickerProps = {
  latitude: string;
  longitude: string;
  onChange: (coords: { latitude: string; longitude: string }) => void;
  disabled?: boolean;
  inputClass?: string;
};

export default function GeoPicker({
  latitude,
  longitude,
  onChange,
  disabled = false,
  inputClass = "form-input",
}: GeoPickerProps) {
  const [locating, setLocating] = useState(false);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [onChange]);

  const mapsHref =
    latitude && longitude
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>
            Latitude
          </label>
          <input
            className={inputClass}
            disabled={disabled}
            inputMode="decimal"
            placeholder="e.g. 21.145800"
            value={latitude || ""}
            onChange={(e) => onChange({ latitude: e.target.value, longitude })}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>
            Longitude
          </label>
          <input
            className={inputClass}
            disabled={disabled}
            inputMode="decimal"
            placeholder="e.g. 79.088200"
            value={longitude || ""}
            onChange={(e) => onChange({ latitude, longitude: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-secondary text-sm"
          disabled={disabled || locating}
          onClick={useMyLocation}
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
        {mapsHref && (
          <a className="text-sm font-semibold underline" style={{ color: "var(--primary)" }} href={mapsHref} target="_blank" rel="noopener noreferrer">
            Preview on Google Maps
          </a>
        )}
        {(latitude || longitude) && !disabled && (
          <button
            type="button"
            className="text-sm text-gray-500 underline"
            onClick={() => onChange({ latitude: "", longitude: "" })}
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Optional. Enables the &ldquo;near me&rdquo; search filter and accurate map placement.
      </p>
    </div>
  );
}
