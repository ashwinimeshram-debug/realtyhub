"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";
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

type TabMode = "active" | "followups" | "archived";

const STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "NEGOTIATION", "CLOSED"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_META: Record<Stage, { label: string; color: string; bg: string; border: string }> = {
  NEW:         { label: "New",         color: "#3b82f6", bg: "bg-blue-50",   border: "border-blue-200" },
  CONTACTED:   { label: "Contacted",   color: "#f59e0b", bg: "bg-amber-50",  border: "border-amber-200" },
  SITE_VISIT:  { label: "Site Visit",  color: "#8b5cf6", bg: "bg-purple-50", border: "border-purple-200" },
  NEGOTIATION: { label: "Negotiation", color: "#f97316", bg: "bg-orange-50", border: "border-orange-200" },
  CLOSED:      { label: "Closed",      color: "#22c55e", bg: "bg-green-50",  border: "border-green-200" },
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
  email: string | null;
  mobile: string | null;
  source: string;
  stage: Stage;
  lead_status: string;
  rejection_reason: string | null;
  archived_at: string | null;
  notes: string | null;
  follow_up_date: string | null;
  property_id: number | null;
  property_title: string | null;
  listing_id: string | null;
  created_at: string | null;
}

interface LeadDetail extends Lead {
  history: {
    id: number;
    previous_status: string | null;
    new_status: string | null;
    remarks: string | null;
    interaction_type: string;
    follow_up_date: string | null;
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

export default function OwnerLeadsBoard() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabMode>("active");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [archivedLeads, setArchivedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await API.get("/owner/leads");
      setLeads(res.data ?? []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchArchived = useCallback(async (q?: string) => {
    try {
      const params = new URLSearchParams();
      const s = q ?? search;
      if (s) params.set("search", s);
      const res = await API.get(`/owner/leads/archived${params.toString() ? `?${params}` : ""}`);
      setArchivedLeads(res.data ?? []);
    } catch (err) {
      console.error(err);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    fetchLeads().finally(() => setLoading(false));
  }, [fetchLeads]);

  useEffect(() => {
    if (tab === "archived") fetchArchived();
  }, [tab, fetchArchived]);

  const filteredLeads = leads.filter((lead) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lead.name.toLowerCase().includes(q) ||
      (lead.email?.toLowerCase().includes(q) ?? false) ||
      (lead.mobile?.includes(q) ?? false)
    );
  });

  const openLeadDetail = async (leadId: number) => {
    try {
      const res = await API.get(`/owner/leads/${leadId}`);
      setSelectedLead(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStageChange = async (leadId: number, stage: Stage) => {
    try {
      await API.patch(`/owner/leads/${leadId}/stage`, { stage });
      fetchLeads();
      if (selectedLead && selectedLead.id === leadId) {
        const res = await API.get(`/owner/leads/${leadId}`);
        setSelectedLead(res.data);
      }
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to update stage", "error");
    }
  };

  const handleReopen = async (leadId: number) => {
    try {
      await API.post(`/owner/leads/${leadId}/reopen`);
      toast("Lead reopened", "success");
      fetchArchived(search);
      fetchLeads();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to reopen", "error");
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-sm py-6">Loading leads...</p>;
  }

  return (
    <div>
      {/* TABS */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 md:mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
          {([
            { key: "active" as TabMode, label: "Active Pipeline" },
            { key: "followups" as TabMode, label: "Follow-ups" },
            { key: "archived" as TabMode, label: "Archived" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.key ? "bg-white shadow text-[var(--primary)]" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab !== "followups" && (
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

      {tab === "active" && (
        <PipelineView leads={filteredLeads} onLeadClick={openLeadDetail} onRefresh={fetchLeads} />
      )}

      {tab === "followups" && <FollowUpsView onLeadClick={openLeadDetail} />}

      {tab === "archived" && (
        <ArchivedView leads={archivedLeads} onLeadClick={openLeadDetail} onReopen={handleReopen} />
      )}

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onRefresh={async () => {
            const res = await API.get(`/owner/leads/${selectedLead.id}`);
            setSelectedLead(res.data);
            fetchLeads();
          }}
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
}: {
  leads: Lead[];
  onLeadClick: (id: number) => void;
  onRefresh: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const leadId = Number(active.id);
    const targetStage = over.id as Stage;
    if (!STAGES.includes(targetStage)) return;
    try {
      await API.patch(`/owner/leads/${leadId}/stage`, { stage: targetStage });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="overflow-x-auto pb-4" style={{ maxHeight: "calc(100vh - 320px)" }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-max h-full">
          {STAGES.map((stage) => {
            const meta = STAGE_META[stage];
            const visibleLeads = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="w-72 shrink-0 flex flex-col" style={{ maxHeight: "calc(100vh - 340px)" }}>
                <div className={`px-3 py-3 flex items-center gap-2 border-b shrink-0 ${meta.bg} rounded-t-xl border`}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="font-semibold text-sm truncate">{meta.label}</span>
                  <span className="ml-auto text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full bg-white/70">
                    {visibleLeads.length}
                  </span>
                </div>

                <SortableContext
                  items={visibleLeads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                  id={stage}
                >
                  <div className={`p-2 space-y-2 overflow-y-auto flex-1 min-h-[80px] border-x border-b rounded-b-xl ${meta.bg}`}>
                    {visibleLeads.length === 0 && (
                      <div className="text-center text-gray-400 text-xs py-4">No leads</div>
                    )}
                    {visibleLeads.map((lead) => (
                      <PipelineCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} />
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

function PipelineCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const badge = followUpBadge(lead.follow_up_date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition ${
        badge.border ? `border ${badge.border}` : ""
      }`}
    >
      <p className="font-medium text-sm truncate">{lead.name}</p>
      <p className="text-xs text-gray-500 truncate">{lead.mobile || lead.email || "-"}</p>
      {lead.property_title && (
        <p className="text-xs text-[var(--primary)] truncate mt-1">{lead.property_title}</p>
      )}
      {lead.follow_up_date && (
        <span className={`inline-block ${badge.bg} ${badge.text} text-[10px] px-2 py-0.5 rounded font-medium mt-2`}>
          {badge.label}
        </span>
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
    API.get("/owner/leads/followups")
      .then((r) => setFollowups(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-sm py-6">Loading follow-ups...</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left" style={{ color: "var(--text-muted)" }}>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">Mobile</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Follow-up Date</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Property</th>
          </tr>
        </thead>
        <tbody>
          {followups.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-400">No follow-ups scheduled</td>
            </tr>
          ) : (
            followups.map((item, i) => {
              const meta = STAGE_META[item.stage];
              const badge = followUpBadge(item.followup_date);
              return (
                <tr
                  key={item.id}
                  onClick={() => onLeadClick(item.lead_id)}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3">{i + 1}</td>
                  <td className="px-4 py-3">{item.lead_name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{item.lead_mobile || "-"}</td>
                  <td className="px-4 py-3">
                    {meta && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: meta.color }}>
                        {meta.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{item.type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {badge.label ? (
                      <span className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded text-xs font-medium`}>{badge.label}</span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{item.property_title || "-"}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// =====================
// ARCHIVED VIEW
// =====================
function ArchivedView({
  leads,
  onLeadClick,
  onReopen,
}: {
  leads: Lead[];
  onLeadClick: (id: number) => void;
  onReopen: (id: number) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center shadow-sm">
        <p className="text-gray-500 text-sm">No archived leads.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left" style={{ color: "var(--text-muted)" }}>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">Mobile</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Reason</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => {
            const meta = STAGE_META[lead.stage];
            return (
              <tr key={lead.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">{i + 1}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onLeadClick(lead.id)} className="font-medium text-[var(--primary)] hover:underline">
                    {lead.name}
                  </button>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">{lead.mobile || "-"}</td>
                <td className="px-4 py-3">
                  {meta && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: meta.color }}>
                      {meta.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-500">{lead.rejection_reason || "-"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onReopen(lead.id)}
                    className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1 rounded-lg transition"
                  >
                    Reopen
                  </button>
                </td>
              </tr>
            );
          })}
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
  onStageChange,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onRefresh: () => void;
  onStageChange: (leadId: number, stage: Stage) => void;
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

  const handleSubmit = async () => {
    if (!remarks.trim() && stage === lead.stage && !followUpDate) {
      toast("Please add a remark, change stage, or set a follow-up date", "warning");
      return;
    }
    setSubmitting(true);
    try {
      await API.post(`/owner/leads/${lead.id}/interactions`, {
        stage,
        remarks: remarks.trim(),
        interaction_type: interactionType,
        follow_up_date: followUpDate || undefined,
      });
      setRemarks("");
      setFollowUpDate("");
      onRefresh();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to add interaction", "error");
    }
    setSubmitting(false);
  };

  const handleNotInterested = async () => {
    setNiSubmitting(true);
    try {
      await API.post(`/owner/leads/${lead.id}/not-interested`, {
        reason: niReason,
        notes: niNotes,
      });
      toast("Lead archived as Not Interested", "success");
      setShowNotInterested(false);
      onRefresh();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to archive", "error");
    }
    setNiSubmitting(false);
  };

  const handleReopenFromDetail = async () => {
    try {
      await API.post(`/owner/leads/${lead.id}/reopen`);
      toast("Lead reopened", "success");
      onRefresh();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to reopen", "error");
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
                <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: meta.color }}>
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
        <div className="px-4 md:px-6 py-4 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Property</p>
              <p className="text-sm font-medium">{lead.property_title || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Listing ID</p>
              <p className="text-sm font-medium">{lead.listing_id || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <p className="text-sm font-medium">{lead.lead_status || "Active"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Created</p>
              <p className="text-sm font-medium">
                {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Stage</label>
              <select
                value={stage}
                onChange={(e) => {
                  const next = e.target.value as Stage;
                  setStage(next);
                  onStageChange(lead.id, next);
                }}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_META[s].label}</option>
                ))}
              </select>
            </div>
            {lead.stage !== "CLOSED" && (
              <div className="flex items-end">
                <button
                  onClick={() => setShowNotInterested(true)}
                  className="text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-lg transition"
                >
                  Mark Not Interested
                </button>
              </div>
            )}
            {lead.lead_status === "NOT_INTERESTED" && lead.archived_at && (
              <div className="flex items-end">
                <button
                  onClick={handleReopenFromDetail}
                  className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-2 rounded-lg transition"
                >
                  Reopen Lead
                </button>
              </div>
            )}
          </div>

          {/* ADD INTERACTION */}
          <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-4">
            <h3 className="font-semibold text-sm mb-3">Add Interaction</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Remark</label>
              <select
                value={PRESET_REMARKS.includes(remarks) ? remarks : ""}
                onChange={(e) => setRemarks(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full mb-2"
              >
                <option value="">Select a remark...</option>
                {PRESET_REMARKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Type your remark..."
                rows={2}
                className="border rounded-lg px-3 py-2 text-sm w-full resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>

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
                        {h.follow_up_date && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded font-medium">
                            Follow-up: {h.follow_up_date}
                          </span>
                        )}
                      </div>
                      {h.remarks && <p className="text-sm text-gray-700 mt-1">{h.remarks}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {h.created_at ? new Date(h.created_at).toLocaleString("en-IN") : ""}
                      </p>
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
