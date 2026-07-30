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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/settings")
      .then((res) => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
