"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl, setCsrfToken } from "@/lib/api";

export default function AdminTopbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const router = useRouter();
  const [siteName, setSiteName] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    API.get("/settings")
      .then((res) => {
        setSiteName(res.data.site_name || "");
        setSiteLogo(res.data.site_logo || "");
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleLogout = async () => {
    await API.post("/admin/logout").catch(() => {});
    setCsrfToken(null);
    router.replace("/admin");
  };

  return (
    <div className="flex items-center justify-between px-3 md:px-6 py-3 bg-white shadow-sm border-b">

      {/* LEFT: HAMBURGER + BRAND */}
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {loaded && (
          <div
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center gap-2 cursor-pointer"
          >
            {siteLogo ? (
              <img
                src={backendAssetUrl(siteLogo)}
                alt="Logo"
                className="w-9 h-9 object-contain rounded"
              />
            ) : null}
            {siteName ? (
              <h1 className="text-lg font-semibold text-gray-800">
                {siteName}
              </h1>
            ) : null}
          </div>
        )}
      </div>

      {/* RIGHT: LOGOUT CIRCLE */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={handleLogout}
          title="Logout"
          className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
