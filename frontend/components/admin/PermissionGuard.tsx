"use client";

import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function PermissionGuard({
  children,
  permission,
  permissions,
  fallback = null,
}: {
  permission?: string;
  permissions?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAdmin, hasPermission } = useAuth();

  const allowed = isAdmin || (() => {
    if (permission) return hasPermission(permission);
    if (permissions) return permissions.some((p) => hasPermission(p));
    return true;
  })();

  return allowed ? <>{children}</> : <>{fallback}</>;
}
