"use client";

import { useEffect, useState, useCallback } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";
import { useAuth } from "@/hooks/useAuth";
import AdminLeadsReport from "@/components/reports/AdminLeadsReport";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type TabMode = "active" | "followups" | "archived" | "reports";

const STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "NEGOTIATION", "CLOSED"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_META: Record<Stage, { label: string; color: string; bg: string; border: string }> = {
  NEW:         { label: "New",         color: "#3b82f6", bg: "bg-blue-50",   border: "border-blue-200" },
  CONTACTED:   { label: "Contacted",   color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-200" },
  SITE_VISIT:  { label: "Site Visit", color: "#8b5cf6", bg: "bg-purple-50", border: "border-purple-200" },
  NEGOTIATION: { label: "Negotiation", color: "#f97316", bg: "bg-orange-50", border: "border-orange-200" },
  CLOSED:      { label: "Closed",      color: "#22c55e", bg: "bg-green-50", border: "border-green-200" },
};

const INTERACTION_TYPES = ["Call", "WhatsApp", "Site Visit", "Meeting", "Email", "System Note"];

const PRESET_REMARKS = [
  "Customer not reachable",
  "Call back later",
  "Not interested anymore",
  "Budget mismatch",
  "Location not suitable",
  "Looking for other options",
  "Decision pending",
  "Site visit completed",
  "Price negotiation in progress",
  "Documents shared",
  "Follow-up scheduled",
  "Converted successfully",
];

function getSourceBadge(source: string) {
  if (source === "property_submission") {
    return { label: "Inventory Lead", sublabel: "Owner", className: "bg-purple-100 text-purple-700" };
  }
  if (source === "connect") {
    return { label: "Property Lead", sublabel: "Buyer/Tenant", className: "bg-blue-100 text-blue-700" };
  }
  return { label: "Website Lead", sublabel: "General", className: "bg-gray-100 text-gray-700" };
}

interface Lead {
  id: number;
  name: string;
  email: string;
  mobile: string;
  source: string;
  stage: Stage;
  lead_status: string;
  rejection_reason: string | null;
  archived_at: string | null;
  notes: string | null;
  follow_up_date: string | null;
  property_id: number | null;
  property_title: string | null;
  created_at: string;
  assigned_to: number | null;
  assigned_name: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
  sla_overdue: boolean;
  timeframe: string | null;
  preferred_location: string | null;
  budget: string | null;
}

interface LeadDetail extends Lead {
  history: {
    id: number;
    previous_status: string | null;
    new_status: string | null;
    remarks: string | null;
    interaction_type: string;
    follow_up_date: string | null;
    created_by: number | null;
    created_at: string;
  }[];
  transfers: {
    id: number;
    from_admin_id: number | null;
    to_admin_id: number | null;
    from_admin_name: string | null;
    to_admin_name: string | null;
    reason: string | null;
    created_at: string | null;
  }[];
}

function followUpBadge(dateStr: string | null): { label: string; bg: string; text: string; border?: string } {
  if (!dateStr) return { label: "", bg: "", text: "" };
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = d.getTime() - now.getTime();
  const day = 86400000;
  if (diff < 0) return { label: `Overdue: ${dateStr}`, bg: "bg-red-100", text: "text-red-700", border: "border-red-300" };
  if (diff < day) return { label: `Today: ${dateStr}`, bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" };
  return { label: `Upcoming: ${dateStr}`, bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" };
}

function slaBadgeFor(lead: Pick<Lead, "first_response_at" | "sla_due_at" | "sla_overdue" | "created_at">): { label: string; className: string } | null {
  if (!lead.sla_due_at) return null;
  if (lead.first_response_at) {
    const start = new Date(lead.created_at).getTime();
    const responded = new Date(lead.first_response_at).getTime();
    const mins = Math.max(0, Math.round((responded - start) / 60000));
    return { label: `Replied in ${mins}m`, className: "bg-green-50 text-green-700 border-green-200" };
  }
  if (lead.sla_overdue) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(lead.sla_due_at).getTime()) / 60000));
    return { label: `SLA overdue ${mins}m`, className: "bg-red-50 text-red-700 border-red-200" };
  }
  return { label: "Awaiting reply", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

export default function LeadsPage() {
  const { toast } = useToast();
  const { user, isAdmin, hasPermission, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabMode>("active");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [archivedLeads, setArchivedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [stats, setStats] = useState({ new_today: 0, site_visits: 0, followups_overdue: 0, followups_today: 0, followups_upcoming: 0, won_month: 0, lost_month: 0, no_action: 0 });

  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [executives, setExecutives] = useState<{ id: number; display_name: string; username: string }[]>([]);
  const [assignFilter, setAssignFilter] = useState<"all" | "mine" | "unassigned">(
    isAdmin ? "all" : "unassigned"
  );
  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);

  const fetchStats = useCallback(async (userId?: number | null) => {
    try {
      const params = new URLSearchParams();
      if (userId) params.set("user_id", String(userId));
      const qs = params.toString();
      const statsRes = await API.get(`/admin/leads/stats${qs ? `?${qs}` : ""}`);
      setStats(statsRes.data);
    } catch (err: any) {
      if (err?.response?.status !== 403) console.error(err);
    }
  }, []);

  const fetchLeads = async () => {
    try {
      const params = new URLSearchParams();
      if (!isAdmin && assignFilter === "unassigned") params.set("scope", "unassigned");
      if (employeeFilter) params.set("assigned_to", String(employeeFilter));
      const res = await API.get(`/admin/leads${params.toString() ? `?${params}` : ""}`);
      setLeads(res.data?.items ?? []);
    } catch (err: any) {
      if (err?.response?.status === 403) setAccessDenied(true);
      else console.error(err);
    }
  };

  const fetchArchived = async (q?: string) => {
    try {
      const params = new URLSearchParams();
      const s = q ?? search;
      if (s) params.set("search", s);
      const res = await API.get(`/admin/leads/archived${params.toString() ? `?${params}` : ""}`);
      setArchivedLeads(res.data?.items ?? []);
    } catch (err: any) {
      if (err?.response?.status !== 403) console.error(err);
    }
  };

  const fetchData = async () => {
    if (!hasPermission("leads.view")) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([fetchLeads(), fetchStats(employeeFilter)]);
    setLoading(false);
    if (!hasPermission("leads.assign")) return;
    try {
      const execRes = await API.get("/admin/leads/executives");
      setExecutives(execRes.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [authLoading]);

  useEffect(() => {
    if (!loading) {
      fetchLeads();
      fetchStats(employeeFilter);
    }
  }, [employeeFilter, assignFilter]);

  useEffect(() => {
    if (tab === "archived") fetchArchived();
  }, [tab]);

  const filteredLeads = leads.filter((lead) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !lead.name.toLowerCase().includes(q) &&
        !lead.email?.toLowerCase().includes(q) &&
        !lead.mobile.includes(q)
      )
        return false;
    }
    if (assignFilter === "mine" && user && lead.assigned_to !== user.admin_id) return false;
    if (assignFilter === "unassigned" && lead.assigned_to !== null) return false;
    if (employeeFilter !== null && lead.assigned_to !== employeeFilter) return false;
    return true;
  });

  const openLeadDetail = async (leadId: number) => {
    try {
      const res = await API.get(`/admin/leads/${leadId}`);
      setSelectedLead(res.data);
    } catch (err: any) {
      if (err?.response?.status !== 403) console.error(err);
    }
  };

  const handleAssign = async (leadId: number, userId: number | null) => {
    try {
      await API.post(`/admin/leads/${leadId}/assign`, { user_id: userId });
      fetchData();
      if (selectedLead && selectedLead.id === leadId) {
        const res = await API.get(`/admin/leads/${leadId}`);
        setSelectedLead(res.data);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to assign lead", "error");
    }
  };

  const handleClaim = async (leadId: number) => {
    if (!user) return;
    try {
      await API.post(`/admin/leads/${leadId}/assign`, { user_id: user.admin_id });
      toast("Lead claimed", "success");
      setAssignFilter("mine");
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to claim lead", "error");
    }
  };

  const handleAutoAssign = async () => {
    try {
      const res = await API.post("/admin/leads/auto-assign", { lead_ids: [] });
      toast(res.data.message, "success");
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to auto-assign", "error");
    }
  };

  const handleStageChange = async (leadId: number, stage: Stage) => {
    try {
      await API.patch(`/admin/leads/${leadId}/stage`, { stage });
      fetchLeads();
      if (selectedLead && selectedLead.id === leadId) {
        const res = await API.get(`/admin/leads/${leadId}`);
        setSelectedLead(res.data);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to update stage", "error");
    }
  };

  const handleReopen = async (leadId: number) => {
    try {
      await API.post(`/admin/leads/${leadId}/reopen`);
      toast("Lead reopened", "success");
      fetchArchived();
      fetchLeads();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to reopen", "error");
    }
  };

  if (loading) {
    return <div className="p-3 md:p-6">Loading...</div>;
  }

  if (accessDenied) {
    return (
      <div className="p-3 md:p-6">
        <h1 className="text-2xl font-bold text-gray-800">Leads</h1>
        <p className="text-sm text-red-600 mt-4">You don&apos;t have permission to view leads.</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6">
      <h1 className="text-2xl font-bold text-gray-800">Leads</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4 md:mb-6">Track and manage leads through the sales pipeline</p>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
        <div className="flex gap-2 flex-wrap items-center">
          {isAdmin && (
            <>
              <button
                  onClick={handleAutoAssign}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition"
                >
                  Auto-Assign Unassigned
                </button>
            </>
          )}

          {isAdmin && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: "all" as const, label: "All Leads" },
                { key: "mine" as const, label: "My Leads" },
                { key: "unassigned" as const, label: "Unassigned" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setAssignFilter(f.key); setEmployeeFilter(f.key === "mine" && user ? user.admin_id : null); }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    assignFilter === f.key
                      ? "bg-white shadow text-[var(--primary)]"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {!isAdmin && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: "mine" as const, label: "My Leads" },
                { key: "unassigned" as const, label: "Unassigned" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setAssignFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    assignFilter === f.key
                      ? "bg-white shadow text-[var(--primary)]"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {isAdmin && (
            <select
              value={employeeFilter ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setEmployeeFilter(val);
                if (val !== null) setAssignFilter("all");
              }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Employees</option>
              {executives.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.display_name || exec.username}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* STATS CARDS */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 md:gap-3 mb-4 md:mb-6">
          <StatCard label="New Today" value={stats.new_today} color="blue" />
          <StatCard label="No Action" value={stats.no_action} color="gray" />
          <StatCard label="Site Visits" value={stats.site_visits} color="amber" />
          <StatCard label="Follow-up Overdue" value={stats.followups_overdue} color="red" />
          <StatCard label="Follow-up Today" value={stats.followups_today} color="amber" />
          <StatCard label="Follow-up Upcoming" value={stats.followups_upcoming} color="blue" />
          <StatCard label="Won" value={stats.won_month} color="green" />
          <StatCard label="Lost" value={stats.lost_month} color="red" />
        </div>
      )}

      {/* TABS */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 md:mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
          {([
            { key: "active" as TabMode, label: "Active Pipeline" },
            { key: "followups" as TabMode, label: "Follow-ups" },
            ...(isAdmin ? [{ key: "archived" as TabMode, label: "Archived" }] : []),
            { key: "reports" as TabMode, label: "Reports" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.key
                  ? "bg-white shadow text-[var(--primary)]"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(tab === "active" || tab === "archived") && (
          <input
            type="text"
            placeholder="Search name, email, mobile..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (tab === "archived") fetchArchived(e.target.value);
            }}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
          />
        )}
      </div>

      {/* CONTENT */}
      {tab === "active" && (
        <PipelineView
          leads={filteredLeads}
          onLeadClick={openLeadDetail}
          onRefresh={fetchLeads}
          onClaim={!isAdmin && hasPermission("leads.assign") ? handleClaim : undefined}
          canDrag={hasPermission("leads.update")}
        />
      )}

      {tab === "followups" && <FollowUpsView onLeadClick={openLeadDetail} />}

      {tab === "reports" && <AdminLeadsReport />}

      {tab === "archived" && (
        <ArchivedView
          leads={archivedLeads}
          onLeadClick={openLeadDetail}
          onReopen={handleReopen}
          onRefresh={() => fetchArchived(search)}
        />
      )}

      {/* LEAD DETAIL MODAL */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onRefresh={async () => {
            const res = await API.get(`/admin/leads/${selectedLead.id}`);
            setSelectedLead(res.data);
            fetchLeads();
          }}
          isAdmin={isAdmin}
          executives={executives}
          onAssign={handleAssign}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  );
}


// =====================
// PIPELINE (Kanban)
// =====================
function PipelineView({
  leads,
  onLeadClick,
  onRefresh,
  onClaim,
  canDrag,
}: {
  leads: Lead[];
  onLeadClick: (id: number) => void;
  onRefresh: () => void;
  onClaim?: (id: number) => void;
  canDrag?: boolean;
}) {
  const [overrideStage, setOverrideStage] = useState<Stage | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canDrag) return;
    const { active, over } = event;
    if (!over) return;
    const leadId = Number(active.id);
    const targetStage = over.id as Stage;
    if (!STAGES.includes(targetStage)) return;
    try {
      await API.patch(`/admin/leads/${leadId}/stage`, { stage: targetStage });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="overflow-x-auto pb-4" style={{ maxHeight: "calc(100vh - 260px)" }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 min-w-max h-full">
          {STAGES.map((stage) => {
            const meta = STAGE_META[stage];
            const stageLeads = leads.filter((l) => l.stage === stage || (overrideStage === stage && l.stage === stage));
            const visibleLeads = leads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className="w-72 shrink-0 flex flex-col"
                style={{ maxHeight: "calc(100vh - 280px)" }}
              >
                {/* Column Header */}
                <div className={`px-3 py-3 flex items-center gap-2 border-b shrink-0 ${meta.bg} rounded-t-xl border`}>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="font-semibold text-sm truncate">
                    {meta.label}
                  </span>
                  <span className="ml-auto text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full bg-white/70">
                    {visibleLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <SortableContext
                  items={visibleLeads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                  id={stage}
                >
                  <div className={`p-2 space-y-2 overflow-y-auto flex-1 min-h-[80px] border-x border-b rounded-b-xl ${meta.bg}`}>
                    {visibleLeads.length === 0 && (
                      <div className="text-center text-gray-400 text-xs py-4">
                        No leads
                      </div>
                    )}
                    {visibleLeads.map((lead) => (
                      <PipelineCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => onLeadClick(lead.id)}
                        onClaim={onClaim}
                        draggable={canDrag}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}


// =====================
// PIPELINE CARD
// =====================
function PipelineCard({ lead, onClick, onClaim, draggable = true }: { lead: Lead; onClick: () => void; onClaim?: (id: number) => void; draggable?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  const badge = followUpBadge(lead.follow_up_date);
  const slaBadge = slaBadgeFor(lead);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      onClick={onClick}
      className={`bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition ${
        badge.border ? `border ${badge.border}` : ""
      }`}
    >
      <p className="font-medium text-sm truncate">{lead.name}</p>
      <p className="text-xs text-gray-500 truncate">{lead.mobile}</p>
      {lead.property_title && (
        <p className="text-xs text-[var(--primary)] truncate mt-1">
          {lead.property_title}
        </p>
      )}
      {lead.assigned_name && (
        <div className="flex items-center gap-1 mt-1">
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs text-gray-500 truncate">{lead.assigned_name}</span>
        </div>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {slaBadge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${slaBadge.className}`} title="First-response SLA">
            {slaBadge.label}
          </span>
        )}
        {lead.follow_up_date && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text}`}>
            {new Date(lead.follow_up_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      {onClaim && !lead.assigned_to && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClaim(lead.id); }}
          className="mt-2 w-full bg-[var(--primary)] hover:opacity-90 text-white text-xs font-medium py-1.5 rounded-lg transition"
        >
          Claim This Lead
        </button>
      )}
    </div>
  );
}


// =====================
// FOLLOW-UPS VIEW
// =====================
interface FollowupItem {
  id: number;
  lead_id: number;
  type: string;
  remarks: string | null;
  followup_date: string | null;
  lead_name: string;
  lead_mobile: string | null;
  lead_email: string | null;
  source: string;
  stage: Stage;
  lead_status: string;
  property_title: string | null;
}

function FollowUpsView({ onLeadClick }: { onLeadClick: (id: number) => void }) {
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/admin/leads/followups")
      .then((r) => setFollowups(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading follow-ups...</div>;

  const groups = groupFollowupsByBucket(followups);

  return (
    <div className="space-y-5">
      {followups.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          No follow-ups scheduled
        </div>
      )}
      {groups.map((group) => (
        <div key={group.key} className="bg-white rounded-xl shadow overflow-hidden">
          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${group.headerClass}`}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{group.label}</span>
              <span className="text-xs text-gray-500">{group.subLabel}</span>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${group.countClass}`}>
              {group.items.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 md:p-3 text-center">#</th>
                  <th className="p-2 md:p-3 text-center">Name</th>
                  <th className="p-2 md:p-3 text-center hidden sm:table-cell">Mobile</th>
                  <th className="p-2 md:p-3 text-center">Stage</th>
                  <th className="p-2 md:p-3 text-center">Type</th>
                  <th className="p-2 md:p-3 text-center">Follow-up Date</th>
                  <th className="p-2 md:p-3 text-center hidden md:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, i) => {
                  const meta = STAGE_META[item.stage];
                  const badge = followUpBadge(item.followup_date);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onLeadClick(item.lead_id)}
                      className="border-t hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="p-2 md:p-3">{i + 1}</td>
                      <td className="p-2 md:p-3 font-medium">{item.lead_name}</td>
                      <td className="p-2 md:p-3 hidden sm:table-cell">{item.lead_mobile || "-"}</td>
                      <td className="p-2 md:p-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: meta?.color || "#9ca3af" }}
                        >
                          {meta?.label || item.stage}
                        </span>
                      </td>
                      <td className="p-2 md:p-3 text-xs text-gray-500">{item.type}</td>
                      <td className="p-2 md:p-3 text-sm font-medium">
                        {item.followup_date ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                            {new Date(item.followup_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-2 md:p-3 hidden md:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getSourceBadge(item.source).className}`}>
                          {getSourceBadge(item.source).label}
                        </span>
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
  );
}

// Groups follow-ups into date buckets so the user can see at a glance whom to
// contact today. The API already returns rows sorted by follow-up date.
function groupFollowupsByBucket(items: FollowupItem[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const today = startOfDay(now);
  const day = 86400000;

  const buckets: {
    key: string;
    label: string;
    subLabel: string;
    headerClass: string;
    countClass: string;
    items: FollowupItem[];
  }[] = [
    { key: "overdue", label: "Overdue", subLabel: "Past due follow-ups", headerClass: "bg-red-50 border-red-100", countClass: "bg-red-100 text-red-700", items: [] },
    { key: "today", label: "Today", subLabel: new Date(today).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), headerClass: "bg-amber-50 border-amber-100", countClass: "bg-amber-100 text-amber-700", items: [] },
    { key: "tomorrow", label: "Tomorrow", subLabel: "", headerClass: "bg-blue-50 border-blue-100", countClass: "bg-blue-100 text-blue-700", items: [] },
    { key: "week", label: "This Week", subLabel: "Next 7 days", headerClass: "bg-gray-50 border-gray-100", countClass: "bg-gray-200 text-gray-700", items: [] },
    { key: "later", label: "Later", subLabel: "Beyond a week", headerClass: "bg-gray-50 border-gray-100", countClass: "bg-gray-200 text-gray-700", items: [] },
  ];

  for (const item of items) {
    if (!item.followup_date) {
      buckets[4].items.push(item);
      continue;
    }
    const t = startOfDay(new Date(item.followup_date));
    if (t < today) buckets[0].items.push(item);
    else if (t === today) buckets[1].items.push(item);
    else if (t === today + day) buckets[2].items.push(item);
    else if (t <= today + 7 * day) buckets[3].items.push(item);
    else buckets[4].items.push(item);
  }

  return buckets.filter((b) => b.items.length > 0);
}


// =====================
// ARCHIVED VIEW
// =====================
function ArchivedView({
  leads,
  onLeadClick,
  onReopen,
  onRefresh,
}: {
  leads: Lead[];
  onLeadClick: (id: number) => void;
  onReopen: (id: number) => void;
  onRefresh: () => void;
}) {
  const { confirm } = useConfirm();

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
        No archived leads
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 md:p-3 text-center">#</th>
            <th className="p-2 md:p-3 text-center">Name</th>
            <th className="p-2 md:p-3 text-center hidden sm:table-cell">Mobile</th>
            <th className="p-2 md:p-3 text-center">Stage</th>
            <th className="p-2 md:p-3 text-center">Reason</th>
            <th className="p-2 md:p-3 text-center hidden md:table-cell">Archived</th>
            <th className="p-2 md:p-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <tr
              key={lead.id}
              className="border-t hover:bg-gray-50"
            >
              <td className="p-2 md:p-3">{i + 1}</td>
              <td className="p-2 md:p-3 font-medium">
                <button
                  onClick={() => onLeadClick(lead.id)}
                  className="text-[var(--primary)] hover:underline text-left"
                >
                  {lead.name}
                </button>
              </td>
              <td className="p-2 md:p-3 hidden sm:table-cell">{lead.mobile || "-"}</td>
              <td className="p-2 md:p-3">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: STAGE_META[lead.stage]?.color || "#9ca3af" }}
                >
                  {STAGE_META[lead.stage]?.label || lead.stage}
                </span>
              </td>
              <td className="p-2 md:p-3 text-xs text-gray-600 max-w-[200px] truncate">
                {lead.rejection_reason || "-"}
              </td>
              <td className="p-2 md:p-3 text-xs text-gray-500 hidden md:table-cell">
                {lead.archived_at ? new Date(lead.archived_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"}
              </td>
              <td className="p-2 md:p-3">
                <button
                  onClick={() => onReopen(lead.id)}
                  className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded font-medium transition"
                >
                  Reopen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// =====================
// LEAD DETAIL MODAL (Timeline)
// =====================
function LeadDetailModal({
  lead,
  onClose,
  onRefresh,
  isAdmin,
  executives,
  onAssign,
  onStageChange,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onRefresh: () => void;
  isAdmin?: boolean;
  executives?: { id: number; display_name: string; username: string }[];
  onAssign?: (leadId: number, userId: number | null) => void;
  onStageChange?: (leadId: number, stage: Stage) => void;
}) {
  const [interactionType, setInteractionType] = useState("Call");
  const [remarks, setRemarks] = useState("");
  const [stage, setStage] = useState<Stage>(lead.stage || "NEW");
  const [followUpDate, setFollowUpDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNotInterested, setShowNotInterested] = useState(false);
  const [niReason, setNiReason] = useState("");
  const [niNotes, setNiNotes] = useState("");
  const [niSubmitting, setNiSubmitting] = useState(false);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const handleSubmit = async () => {
    if (!remarks.trim() && stage === lead.stage && !followUpDate) {
      toast("Please add a remark, change stage, or set a follow-up date", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await API.post(`/admin/leads/${lead.id}/interactions`, {
        stage,
        remarks: remarks.trim(),
        interaction_type: interactionType,
        follow_up_date: followUpDate || undefined,
      });
      setRemarks("");
      setFollowUpDate("");
      onRefresh();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to add interaction", "error");
    }
    setSubmitting(false);
  };

  const handleNotInterested = async () => {
    setNiSubmitting(true);
    try {
      await API.post(`/admin/leads/${lead.id}/not-interested`, {
        reason: niReason,
        notes: niNotes,
      });
      toast("Lead archived as Not Interested", "success");
      setShowNotInterested(false);
      onRefresh();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to archive", "error");
    }
    setNiSubmitting(false);
  };

  const handleReopenFromDetail = async () => {
    try {
      await API.post(`/admin/leads/${lead.id}/reopen`);
      toast("Lead reopened", "success");
      onRefresh();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to reopen", "error");
    }
  };

  const meta = STAGE_META[lead.stage];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-xl">
        {/* HEADER */}
        <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{lead.name}</h2>
              {meta && (
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.label}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{lead.mobile} {lead.email ? `· ${lead.email}` : ""}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {getSourceBadge(lead.source).label} — {getSourceBadge(lead.source).sublabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {/* INFO ROWS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-400">Lead Type</p>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${getSourceBadge(lead.source).className}`}>
                {getSourceBadge(lead.source).label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Property</p>
              <p className="text-sm font-medium">{lead.property_title || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Created</p>
              <p className="text-sm">{lead.created_at}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <p className="text-sm font-medium">{lead.lead_status || "Active"}</p>
            </div>
            {(() => {
              const sla = slaBadgeFor(lead);
              if (!sla) return null;
              return (
                <div>
                  <p className="text-xs text-gray-400">First Response</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium border ${sla.className}`}>
                    {sla.label}
                  </span>
                </div>
              );
            })()}
            {lead.preferred_location && (
              <div>
                <p className="text-xs text-gray-400">Preferred Location</p>
                <p className="text-sm font-medium">{lead.preferred_location}</p>
              </div>
            )}
            {lead.budget && (
              <div>
                <p className="text-xs text-gray-400">Budget</p>
                <p className="text-sm font-medium">{lead.budget}</p>
              </div>
            )}
            {lead.timeframe && (
              <div>
                <p className="text-xs text-gray-400">Buying Timeframe</p>
                <p className="text-sm font-medium">{lead.timeframe}</p>
              </div>
            )}
          </div>

          {/* Not Interested / Reopen buttons */}
          <div className="flex gap-2 mb-4">
            {lead.stage !== "CLOSED" && (
              <button
                onClick={() => setShowNotInterested(true)}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Mark Not Interested
              </button>
            )}
            {lead.lead_status === "NOT_INTERESTED" && lead.archived_at && (
              <button
                onClick={handleReopenFromDetail}
                className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Reopen Lead
              </button>
            )}
          </div>

          {/* ASSIGN LEAD */}
          {isAdmin && onAssign && executives && (
            <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-4">
              <h3 className="font-semibold text-sm mb-3">Assign Lead</h3>
              <div className="flex items-center gap-3">
                <select
                  value={lead.assigned_to || ""}
                  onChange={(e) => {
                    const userId = e.target.value ? Number(e.target.value) : null;
                    onAssign(lead.id, userId);
                  }}
                  className="border rounded-lg px-3 py-2 text-sm flex-1"
                >
                  <option value="">Unassigned</option>
                  {executives.map((exec) => (
                    <option key={exec.id} value={exec.id}>
                      {exec.display_name || exec.username}
                    </option>
                  ))}
                </select>
                {lead.assigned_to && (
                  <span className="text-xs text-green-600 font-medium shrink-0">
                    Currently: {lead.assigned_name}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ADD INTERACTION */}
          <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-4">
            <h3 className="font-semibold text-sm mb-3">Add Interaction</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as Stage)}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_META[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Interaction Type</label>
                <select
                  value={interactionType}
                  onChange={(e) => setInteractionType(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                >
                  {INTERACTION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Remarks</label>
              <select
                value={PRESET_REMARKS.includes(remarks) ? remarks : "__custom__"}
                onChange={(e) => {
                  if (e.target.value !== "__custom__") setRemarks(e.target.value);
                  else setRemarks("");
                }}
                className="border rounded-lg px-3 py-2 text-sm w-full mb-2"
              >
                <option value="">Select a remark...</option>
                {PRESET_REMARKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="__custom__">Custom remark...</option>
              </select>
              {(remarks === "" || !PRESET_REMARKS.includes(remarks)) && (
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Type your remark..."
                  rows={2}
                  className="border rounded-lg px-3 py-2 text-sm w-full resize-none"
                />
              )}
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* NOT INTERESTED MODAL (inline) */}
          {showNotInterested && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-sm text-red-700 mb-3">Mark as Not Interested</h3>
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Reason</label>
                <select
                  value={niReason}
                  onChange={(e) => setNiReason(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="">Select a reason...</option>
                  <option value="Budget mismatch">Budget mismatch</option>
                  <option value="Location not suitable">Location not suitable</option>
                  <option value="Already purchased">Already purchased</option>
                  <option value="Not reachable">Not reachable</option>
                  <option value="Requirement changed">Requirement changed</option>
                  <option value="Going with competitor">Going with competitor</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <textarea
                  value={niNotes}
                  onChange={(e) => setNiNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                  className="border rounded-lg px-3 py-2 text-sm w-full resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleNotInterested}
                  disabled={niSubmitting || !niReason}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {niSubmitting ? "Saving..." : "Confirm & Archive"}
                </button>
                <button
                  onClick={() => setShowNotInterested(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* TRANSFER HISTORY */}
          {lead.transfers && lead.transfers.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-sm mb-3">Transfer History</h3>
              <div className="space-y-2">
                {lead.transfers.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2 text-xs">
                    <span className="font-medium text-gray-700">{t.from_admin_name || "Unassigned"}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-gray-700">{t.to_admin_name || "Unassigned"}</span>
                    {t.reason && <span className="text-gray-500">· {t.reason}</span>}
                    <span className="ml-auto text-gray-400">{t.created_at}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIMELINE */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Activity Timeline</h3>
            {lead.history.length === 0 ? (
              <p className="text-gray-400 text-sm">No history yet</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
                {lead.history.map((h) => (
                  <div key={h.id} className="relative mb-4 last:mb-0">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white bg-blue-400" />
                    <div className="bg-white border rounded-lg p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-medium">
                          {h.interaction_type}
                        </span>
                        {h.previous_status && h.new_status && h.previous_status !== h.new_status && (
                          <span className="text-xs text-gray-500">
                            {h.previous_status} → <strong>{h.new_status}</strong>
                          </span>
                        )}
                        {h.follow_up_date && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded font-medium">
                            Follow-up: {h.follow_up_date}
                          </span>
                        )}
                      </div>
                      {h.remarks && (
                        <p className="text-sm text-gray-700 mt-1">{h.remarks}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{h.created_at}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// =====================
// STAT CARD
// =====================
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    amber: "bg-amber-50 border-amber-200",
    purple: "bg-purple-50 border-purple-200",
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    gray: "bg-gray-50 border-gray-200",
  };
  const text: Record<string, string> = {
    blue: "text-blue-700",
    amber: "text-amber-700",
    purple: "text-purple-700",
    green: "text-green-700",
    red: "text-red-700",
    gray: "text-gray-700",
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${bg[color] || bg.blue}`}>
      <p className="text-[10px] md:text-xs text-gray-500">{label}</p>
      <p className={`text-lg md:text-2xl font-bold mt-0.5 ${text[color] || text.blue}`}>{value}</p>
    </div>
  );
}
