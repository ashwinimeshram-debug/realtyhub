"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  onNavigate?: () => void;
}

export default function AdminDashboard({ onNavigate }: Props) {
  const { isAdmin } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/admin/my-summary")
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = summary?.stats || {};

  const quickActions = [
    { label: "Add Property", href: "/admin/add-property", color: "bg-[var(--primary)] hover:bg-[var(--primary-hover)]" },
    { label: "View Properties", href: "/admin/properties", color: "bg-indigo-600 hover:bg-indigo-700" },
    { label: "Featured Properties", href: "/admin/cms/featured", color: "bg-teal-600 hover:bg-teal-700" },
    { label: "Leads", href: "/admin/leads", color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Users", href: "/admin/users", color: "bg-violet-600 hover:bg-violet-700", adminOnly: true },
    { label: "CMS", href: "/admin/cms", color: "bg-amber-600 hover:bg-amber-700" },
    { label: "Analytics", href: "/admin/analytics", color: "bg-cyan-600 hover:bg-cyan-700" },
    { label: "Settings", href: "/admin/settings", color: "bg-gray-600 hover:bg-gray-700" },
  ];

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${isAdmin ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        <StatCard label="Total Properties" value={stats.total_properties ?? "-"} color="bg-white" icon={<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
        <StatCard label="Approved" value={stats.approved_properties ?? "-"} color="bg-emerald-50" valueColor="text-emerald-700" icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
        <StatCard label="Pending" value={stats.pending_properties ?? "-"} color="bg-amber-50" valueColor="text-amber-700" icon={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="Rejected" value={stats.rejected_properties ?? "-"} color="bg-red-50" valueColor="text-red-700" icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>} />
        <StatCard label="Leads (30d)" value={stats.leads_30d ?? "-"} color="bg-white" icon={<svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        {isAdmin && <StatCard label="Users" value={stats.total_users ?? "-"} color="bg-white" icon={<svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {quickActions.filter((a) => !(a as any).adminOnly || isAdmin).map((a) => (
            <Link key={a.href} href={a.href} className={`${a.color} text-white text-sm font-medium px-4 py-2 rounded-lg transition`}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, valueColor, icon }: { label: string; value: any; color?: string; valueColor?: string; icon?: React.ReactNode }) {
  return (
    <div className={`${color || "bg-white"} rounded-xl shadow-sm border border-gray-100 p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${valueColor || "text-gray-900"}`}>{value ?? "-"}</div>
    </div>
  );
}
