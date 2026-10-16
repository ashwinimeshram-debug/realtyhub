"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LeadsReportView, { type LeadRow, type Stage } from "@/components/reports/LeadsReportView";

function normalize(items: any[]): LeadRow[] {
  return (items || []).map((l) => ({
    id: l.id,
    property_id: l.property_id ?? null,
    property_title: l.property_title ?? null,
    listing_id: l.listing_id ?? null,
    locked: !!l.locked,
    name: l.name,
    email: l.email ?? null,
    mobile: l.mobile ?? null,
    source: l.source,
    stage: (l.stage || "NEW") as Stage,
    lead_status: l.lead_status || "ACTIVE",
    follow_up_date: l.follow_up_date ?? null,
    archived_at: l.archived_at ?? null,
    created_at: l.created_at ?? null,
  }));
}

export default function AdminLeadsReport() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const adminId = user?.admin_id ?? null;

  useEffect(() => {
    if (authLoading) return;
    Promise.all([
      API.get("/admin/leads?per_page=1000").then((r) => r.data?.items ?? []).catch(() => []),
      API.get("/admin/leads/archived").then((r) => r.data?.items ?? []).catch(() => []),
    ])
      .then(([active, arch]) => {
        const all = [...active, ...arch];
        const scoped = !isAdmin && adminId != null ? all.filter((l) => l.assigned_to === adminId) : all;
        setLeads(normalize(scoped));
      })
      .finally(() => setLoading(false));
  }, [authLoading, isAdmin, adminId]);

  return (
    <LeadsReportView
      leads={leads}
      loading={loading || authLoading}
      emptyText={
        isAdmin
          ? "No leads yet — the report will populate once enquiries arrive."
          : "No leads assigned to you yet."
      }
    />
  );
}
