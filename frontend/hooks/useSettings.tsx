"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import API from "@/lib/api";

interface SettingsContextType {
  settings: Record<string, string>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: {},
  loading: true,
});

export function SettingsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Record<string, string>;
}) {
  const hasInitial = initial && Object.keys(initial).length > 0;
  const [settings, setSettings] = useState<Record<string, string>>(initial || {});
  const [loading, setLoading] = useState(!hasInitial);

  useEffect(() => {
    // Server-rendered pages already provide the settings map, so we skip the
    // extra /settings round-trip and the layout shift that comes with it.
    if (hasInitial) return;
    API.get("/settings")
      .then((res) => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hasInitial]);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
