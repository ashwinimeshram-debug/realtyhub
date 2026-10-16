"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import LeadsReportView, { type LeadRow } from "@/components/reports/LeadsReportView";

export default function OwnerReports() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get("/owner/leads").then((r) => r.data ?? []).catch(() => []),
      API.get("/owner/leads/archived").then((r) => r.data ?? []).catch(() => []),
    ])
      .then(([active, arch]) => setLeads([...(active as LeadRow[]), ...(arch as LeadRow[])]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <LeadsReportView
      leads={leads}
      loading={loading}
      emptyText="No leads yet — your reports will appear once enquiries arrive."
    />
  );
}
