"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import API from "@/lib/api";

interface AuthContextType {
  user: {
    admin_id: number;
    user_id: string | null;
    username: string;
    name: string;
    email: string;
    role: "admin" | "power_user";
  } | null;
  loading: boolean;
  hasPermission: (key: string) => boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasPermission: () => true,
  isAdmin: false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await API.get("/admin/check-auth");
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const hasPermission = (key: string) => {
    if (key === "users") return user?.role === "admin";
    return true;
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      hasPermission,
      isAdmin,
      refresh: fetchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
