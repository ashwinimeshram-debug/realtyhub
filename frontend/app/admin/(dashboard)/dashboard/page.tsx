"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import API from "@/lib/api";
import AdminDashboard from "@/components/admin/AdminDashboard";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      API.get("/admin/check-auth")
        .then((res) => {
          if (res.data.error) setError(res.data.error);
        })
        .catch((err) => {
          const msg = err?.response?.data?.error || "";
          if (msg === "Account disabled") {
            setError("Your account has been disabled. Please contact your administrator.");
          } else {
            setError("Session expired. Please log in again.");
          }
        });
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">{error}</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying permissions...</span>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}
