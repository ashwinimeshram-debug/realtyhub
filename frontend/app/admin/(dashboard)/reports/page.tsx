"use client";

import { useState, useEffect } from "react";
import API from "@/lib/api";

interface PropertyReport {
  total: number;
  active: number;
  sold: number;
  rental: number;
  pending: number;
  rejected: number;
  by_type: Record<string, number>;
  by_transaction_type: Record<string, number>;
  monthly: { month: string; count: number }[];
}

interface LeadReport {
  total: number;
  by_status: { status: string; color: string; count: number }[];
  by_source: { source: string; count: number }[];
  conversion_rate: number;
  won_count: number;
  monthly: { month: string; new: number; won: number; lost: number }[];
}

interface AgentPerf {
  id: number;
  name: string;
  leads_assigned: number;
  calls: number;
  meetings: number;
  site_visits: number;
  properties_uploaded: number;
  deals_closed: number;
  won_leads: number;
}

interface ReportData {
  property_report: PropertyReport;
  lead_report: LeadReport;
  agent_performance: AgentPerf[];
}

type Tab = "property" | "lead" | "agent";

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("property");

  useEffect(() => {
    API.get("/admin/reports").then((res) => {
      setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-red-500">Failed to load reports</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "property", label: "Property Report" },
    { key: "lead", label: "Lead Report" },
    { key: "agent", label: "Agent Performance" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      <p className="text-sm text-gray-500 mt-1">Property and lead performance reports with agent metrics</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.key
                ? "bg-white shadow text-[var(--primary)]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Property Report Tab */}
      {tab === "property" && <PropertyReportTab data={data.property_report} />}

      {/* Lead Report Tab */}
      {tab === "lead" && <LeadReportTab data={data.lead_report} />}

      {/* Agent Performance Tab */}
      {tab === "agent" && <AgentPerformanceTab data={data.agent_performance} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className={`rounded-xl p-4 shadow-sm border ${color || "bg-white"}`}>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-800">{value ?? "-"}</div>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full transition-all ${color || "bg-blue-500"}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function PropertyReportTab({ data }: { data: PropertyReport }) {
  const maxType = Math.max(...Object.values(data.by_type), 1);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total" value={data.total} color="bg-blue-50" />
        <StatCard label="Active" value={data.active} color="bg-green-50" />
        <StatCard label="Sold" value={data.sold} color="bg-purple-50" />
        <StatCard label="Rental" value={data.rental} color="bg-amber-50" />
        <StatCard label="Pending" value={data.pending} color="bg-yellow-50" />
        <StatCard label="Rejected" value={data.rejected} color="bg-red-50" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By Property Type */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">By Property Type</h3>
          <div className="space-y-3">
            {Object.entries(data.by_type).map(([type, count]) => (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-gray-600">{type}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <MiniBar value={count} max={maxType} color="bg-blue-500" />
              </div>
            ))}
          </div>
        </div>

        {/* By Transaction Type */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">By Transaction Type</h3>
          <div className="space-y-3">
            {Object.entries(data.by_transaction_type).map(([txn, count]) => (
              <div key={txn}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-gray-600">{txn}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <MiniBar value={count} max={Math.max(...Object.values(data.by_transaction_type), 1)} color="bg-teal-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly additions */}
      {data.monthly.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">Monthly Additions (12 months)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-2 pr-4 text-center">Month</th>
                  <th className="pb-2 text-center">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m) => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-600">{m.month}</td>
                    <td className="py-2 font-medium">{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadReportTab({ data }: { data: LeadReport }) {
  const maxStatus = Math.max(...data.by_status.map((s) => s.count), 1);
  const maxSource = Math.max(...data.by_source.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={data.total} color="bg-blue-50" />
        <StatCard label="Won" value={data.won_count} color="bg-green-50" />
        <StatCard label="Conversion" value={`${data.conversion_rate}%`} color="bg-purple-50" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By Status */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">By Status</h3>
          <div className="space-y-3">
            {data.by_status.map((s) => (
              <div key={s.status}>
                <div className="flex justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-600">{s.status}</span>
                  </div>
                  <span className="font-medium">{s.count}</span>
                </div>
                <MiniBar value={s.count} max={maxStatus} color="bg-blue-500" />
              </div>
            ))}
          </div>
        </div>

        {/* By Source */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">By Source</h3>
          <div className="space-y-3">
            {data.by_source.map((s) => (
              <div key={s.source}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-gray-600">{s.source}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
                <MiniBar value={s.count} max={maxSource} color="bg-amber-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      {data.monthly.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">Monthly Trend</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-2 pr-4 text-center">Month</th>
                  <th className="pb-2 pr-4 text-center">New</th>
                  <th className="pb-2 pr-4 text-center">Won</th>
                  <th className="pb-2 pr-4 text-center">Lost</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m) => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-600">{m.month}</td>
                    <td className="py-2 pr-4 font-medium">{m.new}</td>
                    <td className="py-2 pr-4 text-green-600 font-medium">{m.won}</td>
                    <td className="py-2 text-red-500 font-medium">{m.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentPerformanceTab({ data }: { data: AgentPerf[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border text-center text-gray-500">
        No agents found. Add power users to see agent performance.
      </div>
    );
  }

  const maxLeads = Math.max(...data.map((a) => a.leads_assigned), 1);

  return (
    <div className="space-y-4">
      {data.map((agent) => (
        <div key={agent.id} className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-lg">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{agent.name}</h3>
              <p className="text-xs text-gray-400">ID: {agent.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Leads Assigned</div>
              <div className="text-lg font-bold">{agent.leads_assigned}</div>
              <MiniBar value={agent.leads_assigned} max={maxLeads} color="bg-blue-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Calls</div>
              <div className="text-lg font-bold">{agent.calls}</div>
              <MiniBar value={agent.calls} max={maxLeads} color="bg-green-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Meetings</div>
              <div className="text-lg font-bold">{agent.meetings}</div>
              <MiniBar value={agent.meetings} max={maxLeads} color="bg-purple-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Site Visits</div>
              <div className="text-lg font-bold">{agent.site_visits}</div>
              <MiniBar value={agent.site_visits} max={maxLeads} color="bg-amber-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Properties Uploaded</div>
              <div className="text-lg font-bold">{agent.properties_uploaded}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Deals Closed</div>
              <div className="text-lg font-bold text-green-600">{agent.deals_closed}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Won Leads</div>
              <div className="text-lg font-bold text-blue-600">{agent.won_leads}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
