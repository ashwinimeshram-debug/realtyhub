"use client";

import { useState, useRef, useCallback } from "react";

export interface Section {
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}

export const EMPTY_SECTION: Section = { id: "", label: "", content: "", type: "section" };
export const EMPTY_DESCRIPTION: Section = { id: "", label: "", content: "", type: "description" };

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const inputClass =
  "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition";

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
      title={`Bold selected text`}
    >
      {label}
    </button>
  );
}

export default function SectionForm({
  section,
  onSave,
  onCancel,
}: {
  section: Section;
  onSave: (s: Section) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(section.label);
  const [content, setContent] = useState(section.content);
  const [type, setType] = useState<"section" | "description">(section.type || "section");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDescription = type === "description";

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
      {/* TYPE TOGGLE */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type:</span>
        <button
          type="button"
          onClick={() => setType("section")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
            !isDescription
              ? "bg-[var(--primary)] text-white border-[var(--primary)]"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          Section (Label + Description)
        </button>
        <button
          type="button"
          onClick={() => setType("description")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
            isDescription
              ? "bg-[var(--primary)] text-white border-[var(--primary)]"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          Description Only
        </button>
      </div>

      {/* LABEL (hidden for description-only) */}
      {!isDescription && (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Section Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Our Mission"
            className={inputClass}
          />
        </div>
      )}

      {/* CONTENT */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            {isDescription ? "Description" : "Section Description"}
          </label>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-1">Format:</span>
            <FormatButton tag="b" label="B" textareaRef={textareaRef} content={content} setContent={setContent} />
            <FormatButton tag="i" label="I" textareaRef={textareaRef} content={content} setContent={setContent} />
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={isDescription ? 6 : 5}
          placeholder="Describe this section... Select text and use B/I buttons to format."
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm leading-relaxed focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition resize-y font-mono"
        />
        <p className="text-[10px] text-gray-400 mt-1">Select text and click <b>B</b> or <i>I</i> to wrap with HTML tags. Newlines render as paragraphs.</p>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSave({ ...section, label: isDescription ? "" : label, content, type })}
          disabled={(!isDescription && !label.trim()) || !content.trim()}
          className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          Save {isDescription ? "Description" : "Section"}
        </button>
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}
