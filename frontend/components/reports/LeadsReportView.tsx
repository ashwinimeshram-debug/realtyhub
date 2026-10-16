"use client";

import { useMemo } from "react";

export const STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "NEGOTIATION", "CLOSED"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  NEW: { label: "New", color: "#3b82f6" },
  CONTACTED: { label: "Contacted", color: "#f59e0b" },
  SITE_VISIT: { label: "Site Visit", color: "#8b5cf6" },
  NEGOTIATION: { label: "Negotiation", color: "#f97316" },
  CLOSED: { label: "Closed", color: "#22c55e" },
};

export interface LeadRow {
  id: number;
  property_id: number | null;
  property_title: string | null;
  listing_id?: string | null;
  locked?: boolean;
  name: string;
  email: string | null;
  mobile: string | null;
  source: string;
  stage: Stage;
  lead_status: string;
  follow_up_date: string | null;
  archived_at: string | null;
  created_at: string | null;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-blue-100 text-blue-700" },
  WON: { label: "Won", className: "bg-green-100 text-green-700" },
  NOT_INTERESTED: { label: "Not Interested", className: "bg-red-100 text-red-700" },
  LOST: { label: "Lost", className: "bg-gray-100 text-gray-600" },
};

function statusMeta(status: string) {
  return STATUS_META[status] || { label: status, className: "bg-gray-100 text-gray-600" };
}

const SOURCE_LABEL: Record<string, string> = {
  property_submission: "Inventory",
  connect: "Property enquiry",
  contact: "Website",
};

function fmtDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LeadsReportView({
  leads,
  loading,
  emptyText = "No leads yet.",
}: {
  leads: LeadRow[];
  loading?: boolean;
  emptyText?: string;
}) {
  const summary = useMemo(
    () =>
      STAGES.map((stage) => {
        const rows = leads.filter((l) => l.stage === stage);
        return {
          stage,
          total: rows.length,
          active: rows.filter((l) => (l.lead_status || "ACTIVE") === "ACTIVE").length,
          won: rows.filter((l) => l.lead_status === "WON").length,
          notInterested: rows.filter((l) => l.lead_status === "NOT_INTERESTED").length,
          pct: leads.length ? Math.round((rows.length / leads.length) * 100) : 0,
        };
      }),
    [leads]
  );

  const totals = useMemo(
    () => ({
      total: leads.length,
      active: leads.filter((l) => (l.lead_status || "ACTIVE") === "ACTIVE").length,
      won: leads.filter((l) => l.lead_status === "WON").length,
      notInterested: leads.filter((l) => l.lead_status === "NOT_INTERESTED").length,
      properties: new Set(leads.filter((l) => l.property_id != null).map((l) => l.property_id)).size,
    }),
    [leads]
  );

  const groups = useMemo(() => {
    const map = new Map<string, { propertyId: number | null; title: string; listingId: string | null; leads: LeadRow[] }>();
    for (const lead of leads) {
      const key = lead.property_id != null ? String(lead.property_id) : "none";
      const group = map.get(key) ?? {
        propertyId: lead.property_id,
        title: lead.property_title || "No property",
        listingId: lead.listing_id ?? null,
        leads: [],
      };
      group.leads.push(lead);
      map.set(key, group);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        leads: [...g.leads].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
      }))
      .sort((a, b) => {
        if (a.propertyId == null) return 1;
        if (b.propertyId == null) return -1;
        return b.leads.length - a.leads.length;
      });
  }, [leads]);

  if (loading) {
    return <p className="text-gray-400 text-sm py-6">Loading report...</p>;
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center shadow-sm">
        <p className="text-gray-500 text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total leads" value={totals.total} />
        <Kpi label="Properties" value={totals.properties} />
        <Kpi label="Active" value={totals.active} />
        <Kpi label="Won" value={totals.won} />
      </div>

      {/* Summary by stage */}
      <div>
        <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--text-dark)" }}>Summary by stage</h3>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left" style={{ color: "var(--text-muted)" }}>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Active</th>
                <th className="px-4 py-3 font-medium text-right">Won</th>
                <th className="px-4 py-3 font-medium text-right">Not Interested</th>
                <th className="px-4 py-3 font-medium text-right">% of total</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.stage} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAGE_META[row.stage].color }} />
                      {STAGE_META[row.stage].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{row.total}</td>
                  <td className="px-4 py-3 text-right">{row.active}</td>
                  <td className="px-4 py-3 text-right">{row.won}</td>
                  <td className="px-4 py-3 text-right">{row.notInterested}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.pct}%</td>
                </tr>
              ))}
              <tr className="border-b border-gray-50 bg-gray-50 font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{totals.total}</td>
                <td className="px-4 py-3 text-right">{totals.active}</td>
                <td className="px-4 py-3 text-right">{totals.won}</td>
                <td className="px-4 py-3 text-right">{totals.notInterested}</td>
                <td className="px-4 py-3 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Leads by property */}
      <div>
        <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--text-dark)" }}>Leads by property</h3>
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.propertyId ?? "none"} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="font-semibold text-sm" style={{ color: "var(--text-dark)" }}>{group.title}</span>
                {group.listingId && <span className="text-xs text-gray-400">{group.listingId}</span>}
                <span className="ml-auto text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                  {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left" style={{ color: "var(--text-muted)" }}>
                      <th className="px-4 py-2.5 font-medium">#</th>
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Contact</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Source</th>
                      <th className="px-4 py-2.5 font-medium">Stage</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Follow-up</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.leads.map((lead, i) => {
                      const stageMeta = STAGE_META[lead.stage];
                      const stat = statusMeta(lead.lead_status);
                      return (
                        <tr key={lead.id} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-2.5">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              {lead.locked && "🔒"}
                              <span className="font-medium">{lead.name}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-gray-500">
                            {lead.locked ? "Pay to view" : lead.mobile || lead.email || "-"}
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-gray-500">
                            {SOURCE_LABEL[lead.source] || lead.source || "-"}
                          </td>
                          <td className="px-4 py-2.5">
                            {stageMeta && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: stageMeta.color }}>
                                {stageMeta.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusMeta(lead.lead_status).className}`}>{statusMeta(lead.lead_status).label}</span>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-gray-500 whitespace-nowrap">
                            {fmtDate(lead.follow_up_date)}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-gray-500 whitespace-nowrap">
                            {fmtDate(lead.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
