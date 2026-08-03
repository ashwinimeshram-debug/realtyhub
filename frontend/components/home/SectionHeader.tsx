"use client";

import DOMPurify from "dompurify";

export default function SectionHeader({
  title,
  subtitle,
  align,
}: {
  title: string;
  subtitle?: string;
  align?: string;
}) {
  const sanitized =
    typeof DOMPurify?.sanitize === "function"
      ? DOMPurify.sanitize(title, { ALLOWED_TAGS: ["b", "i", "br", "span"], ALLOWED_ATTR: [] })
      : title;
  return (
    <div className="text-center mb-8">
      <h2
        className="text-2xl md:text-3xl font-bold"
        style={{ color: "var(--primary)" }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      {subtitle && (
        <p className="mt-2 text-sm md:text-base max-w-2xl mx-auto" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
