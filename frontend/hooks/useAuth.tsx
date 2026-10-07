"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import API from "@/lib/api";

export interface AuthUser {
  admin_id: number;
  user_id: string | null;
  username: string;
  name: string;
  email: string;
  role: string;
  role_name?: string;
  permissions: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  hasPermission: (key: string) => boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasPermission: () => false,
  isAdmin: false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await API.get("/admin/check-auth");
      setUser({
        ...res.data,
        permissions: Array.isArray(res.data?.permissions) ? res.data.permissions : [],
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const hasPermission = (code: string) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.permissions.includes(code);
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