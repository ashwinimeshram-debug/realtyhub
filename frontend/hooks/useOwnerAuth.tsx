"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import API from "@/lib/api";

export interface OwnerUser {
  owner_id: number;
  name: string;
  email: string;
  mobile: string | null;
  is_verified: boolean;
}

interface OwnerAuthContextType {
  owner: OwnerUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const OwnerAuthContext = createContext<OwnerAuthContextType>({
  owner: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState<OwnerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOwner = useCallback(async () => {
    try {
      const res = await API.get("/owner/check-auth");
      setOwner(res.data);
    } catch {
      setOwner(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwner();
  }, [fetchOwner]);

  const logout = useCallback(async () => {
    try {
      await API.post("/owner/logout");
    } catch {
      // ignore network errors on logout
    }
    setOwner(null);
  }, []);

  return (
    <OwnerAuthContext.Provider value={{ owner, loading, refresh: fetchOwner, logout }}>
      {children}
    </OwnerAuthContext.Provider>
  );
}

export function useOwnerAuth() {
  return useContext(OwnerAuthContext);
}