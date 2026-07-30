"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  created_at: string;
}

interface ResetRequest {
  id: number;
  user_identifier: string;
  user_name: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  completed_at: string | null;
}

type Tab = "contact" | "reset";

export default function MessagesPage() {
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<Tab>("contact");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Reset password modal state
  const [resetModal, setResetModal] = useState<ResetRequest | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetNote, setResetNote] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    Promise.all([
      API.get("/admin/contactus").catch(() => ({ data: [] })),
      API.get("/admin/password-reset-requests").catch(() => ({ data: [] })),
    ]).then(([contactRes, resetRes]) => {
      setMessages(contactRes.data?.messages ?? contactRes.data);
      setResetRequests(resetRes.data?.requests ?? resetRes.data);
    }).finally(() => setLoading(false));
    API.post("/admin/contactus/mark-read").catch(() => {});
  }, []);

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Message", message: "Delete this message?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await API.delete(`/admin/contactus/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissRequest = async (id: number) => {
    const ok = await confirm({ title: "Dismiss Request", message: "This is a wrong or fake request. Dismiss it?", danger: true, confirmLabel: "Dismiss" });
    if (!ok) return;
    try {
      await API.delete(`/admin/password-reset-requests/${id}`);
      setResetRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(pass);
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;
    if (!newPassword || newPassword.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }
    setResetSaving(true);
    setResetError("");
    setResetSuccess("");
    try {
      await API.post("/admin/reset-user-password", {
        identifier: resetModal.user_identifier,
        new_password: newPassword,
      });
      setResetRequests((prev) =>
        prev.map((r) =>
          r.id === resetModal.id
            ? { ...r, status: "completed", completed_at: new Date().toISOString() }
            : r
        )
      );
      setResetSuccess(`Password updated for ${resetModal.user_identifier}`);
      setResetModal(null);
      setNewPassword("");
      setResetNote("");
    } catch (err: any) {
      setResetError(err?.response?.data?.error || "Failed to reset password");
    } finally {
      setResetSaving(false);
    }
  };

  const pendingCount = resetRequests.filter((r) => r.status === "pending").length;

  if (loading) {
    return <div className="p-3 md:p-6">Loading...</div>;
  }

  return (
    <div className="p-3 md:p-6">
      <h1 className="text-2xl font-bold text-gray-800">Messages</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4 md:mb-6">Manage contact form submissions and password reset requests</p>

      {/* TABS */}
      <div className="flex gap-2 mb-4 md:mb-6">
        <button
          onClick={() => setTab("contact")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "contact"
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
          }`}
        >
          Contact Us
          {messages.length > 0 && (
            <span className="ml-1.5 text-xs opacity-70">({messages.length})</span>
          )}
        </button>
        <button
          onClick={() => setTab("reset")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "reset"
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
          }`}
        >
          Password Reset
          {pendingCount > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {resetSuccess && (
        <div className="mb-4 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
          {resetSuccess}
        </div>
      )}

      {/* CONTACT US TAB */}
      {tab === "contact" && (
        <>
          {messages.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-4 md:p-6 text-center text-gray-400">
              No messages yet
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-xl shadow p-3 md:p-4 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-sm text-gray-400">{m.email}</span>
                      <span className="text-sm text-gray-400">{m.phone}</span>
                      <span className="text-xs text-gray-400 sm:ml-auto">{m.created_at}</span>
                    </div>
                    <p className="text-gray-700 text-sm md:text-base">{m.message}</p>
                  </div>

                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-red-500 hover:text-red-700 text-sm shrink-0 self-end sm:self-auto"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PASSWORD RESET TAB */}
      {tab === "reset" && (
        <>
          {resetRequests.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-4 md:p-6 text-center text-gray-400">
              No password reset requests yet
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {resetRequests.map((r) => (
                <div
                  key={r.id}
                  className={`bg-white rounded-xl shadow p-3 md:p-4 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 ${
                    r.status === "completed" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        r.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {r.status === "pending" ? "Pending" : "Completed"}
                      </span>
                      <span className="font-semibold">{r.user_identifier}</span>
                      {r.user_name && (
                        <span className="text-sm text-gray-400">({r.user_name})</span>
                      )}
                      <span className="text-xs text-gray-400 sm:ml-auto">{r.created_at}</span>
                    </div>
                    {r.admin_note && (
                      <p className="text-xs text-gray-500 mt-1">Note: {r.admin_note}</p>
                    )}
                  </div>

                  {r.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setResetModal(r);
                          setNewPassword("");
                          setResetNote("");
                          setResetError("");
                          generatePassword();
                        }}
                        className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleDismissRequest(r.id)}
                        className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50 hover:text-red-600 border border-gray-200 transition"
                        title="Dismiss wrong/fake request"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setResetModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              For <strong>{resetModal.user_identifier}</strong>
              {resetModal.user_name && ` (${resetModal.user_name})`}
            </p>

            {resetError && (
              <div className="mb-3 text-red-500 text-sm bg-red-50 p-2 rounded">{resetError}</div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
                autoFocus
              />
              <button
                onClick={generatePassword}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition whitespace-nowrap"
              >
                Generate
              </button>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <textarea
              value={resetNote}
              onChange={(e) => setResetNote(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
              rows={2}
              placeholder="Internal note..."
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setResetModal(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetSaving || !newPassword || newPassword.length < 8}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition"
              >
                {resetSaving ? "Saving..." : "Set Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
