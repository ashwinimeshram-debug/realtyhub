"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import SectionContent from "@/components/SectionContent";
import SectionHeaderEditor from "@/components/admin/SectionHeaderEditor";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";

function FormatButton({
  tag,
  label,
  textareaRef,
  content,
  setContent,
}: {
  tag: "b" | "i";
  label: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (v: string) => void;
}) {
  const handleFormat = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);

    let newText: string;
    let newCursorStart: number;
    let newCursorEnd: number;

    if (selected) {
      const before = content.substring(0, start);
      const after = content.substring(end);
      newText = `${before}<${tag}>${selected}</${tag}>${after}`;
      newCursorStart = start;
      newCursorEnd = start + `<${tag}>`.length + selected.length + `</${tag}>`.length;
    } else {
      const before = content.substring(0, start);
      const after = content.substring(end);
      newText = `${before}<${tag}></${tag}>${after}`;
      newCursorStart = start + `<${tag}>`.length;
      newCursorEnd = newCursorStart;
    }

    setContent(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursorStart, newCursorEnd);
    });
  }, [content, setContent, textareaRef, tag]);

  return (
    <button
      type="button"
      onClick={handleFormat}
      className="px-2 py-1 text-xs font-bold border border-gray-200 rounded hover:bg-gray-100 transition text-gray-600"
      title={`Wrap selected text in <${tag}>`}
    >
      {label}
    </button>
  );
}

export default function FaqCMS() {
  const router = useRouter();

  const [faqs, setFaqs] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchData = () => {
    API.get("/admin/faqs")
      .then((res) => setFaqs(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    API.get("/settings").then((res) => setSettings(res.data)).catch(() => {});
  }, []);

  const handleHeaderUpdate = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try { await API.put("/admin/settings", { [key]: value }); } catch {}
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      toast("Question is required", "warning");
      return;
    }
    if (!answer.trim()) {
      toast("Answer is required", "warning");
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        await API.put(`/admin/faqs/${editingId}`, { question, answer });
      } else {
        await API.post("/admin/faqs", { question, answer, order: faqs.length });
      }

      setQuestion("");
      setAnswer("");
      setEditingId(null);
      fetchData();
    } catch {
      toast("Error saving FAQ", "error");
    }

    setLoading(false);
  };

  const handleEdit = (f: any) => {
    setQuestion(f.question || "");
    setAnswer(f.answer || "");
    setEditingId(f.id);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete FAQ", message: "Delete this FAQ?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;

    await API.delete(`/admin/faqs/${id}`);
    fetchData();
  };

  const handleToggle = async (id: number) => {
    await API.patch(`/admin/faqs/${id}/toggle`);
    fetchData();
  };

  return (
    <div className="p-3 md:p-6">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <button
          onClick={() => router.push("/admin/cms")}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition"
        >
          ← Back
        </button>

        <h1 className="text-xl font-bold text-center flex-1">
          FAQ
        </h1>

        <div className="w-[90px]" />
      </div>
      <p className="text-sm text-gray-500 text-center -mt-1 mb-4 md:mb-6">Manage frequently asked questions for the homepage</p>

      <SectionHeaderEditor sectionKey="faq" sectionName="FAQ" settings={settings} onUpdate={handleHeaderUpdate} />

      {/* FORM */}
      <div className="grid gap-3 mb-4 md:mb-6 bg-white p-3 md:p-5 rounded shadow">

        {/* QUESTION */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Question</label>
          <input
            placeholder="e.g. What documents are needed to buy a property?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
          />
        </div>

        {/* ANSWER with formatting */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-gray-700">Answer</label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 mr-1">Format:</span>
              <FormatButton tag="b" label="B" textareaRef={textareaRef} content={answer} setContent={setAnswer} />
              <FormatButton tag="i" label="I" textareaRef={textareaRef} content={answer} setContent={setAnswer} />
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            placeholder="Write the answer here... Select text and use B/I buttons to bold or italicize."
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm leading-relaxed focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition resize-y font-mono"
          />
          <p className="text-[10px] text-gray-400 mt-1">Select text and click <b>B</b> or <i>I</i> to format. Newlines render as paragraphs.</p>
        </div>

        {/* PREVIEW */}
        {answer.trim() && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
            <p className="text-sm font-semibold text-gray-800 mb-2">Q: {question || "(no question)"}</p>
            <div className="text-sm text-gray-600">
              <SectionContent content={answer} />
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !question.trim() || !answer.trim()}
            className={`flex-1 py-2 rounded text-white ${
              editingId ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
            } disabled:bg-gray-400 transition`}
          >
            {loading
              ? "Saving..."
              : editingId
              ? "Update FAQ"
              : "Add FAQ"}
          </button>

          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setQuestion("");
                setAnswer("");
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {faqs.length > 0 ? (
          faqs.map((f) => (
            <div
              key={f.id}
              className={`bg-white p-4 shadow rounded transition ${
                f.is_active ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{f.question}</p>
                  <div className="text-sm text-gray-600 mt-2">
                    <SectionContent content={f.answer} />
                  </div>
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                      f.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {f.is_active ? "Visible" : "Hidden"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(f.id)}
                    className={`px-2 py-1 rounded text-xs ${
                      f.is_active
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    } transition`}
                  >
                    {f.is_active ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => handleEdit(f)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-400">No FAQs added yet.</p>
        )}
      </div>
    </div>
  );
}
