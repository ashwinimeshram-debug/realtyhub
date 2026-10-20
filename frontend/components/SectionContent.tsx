"use client";

import DOMPurify from "isomorphic-dompurify";

const ALLOWED = { ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "p", "br", "ul", "ol", "li", "a", "span"], ALLOWED_ATTR: ["href", "class", "style"], ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i };

const HAS_HTML = /<\/?[bi]>/;

function sanitize(html: string) {
  return DOMPurify.sanitize(html, ALLOWED);
}

export default function SectionContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (HAS_HTML.test(content)) {
    return (
      <div
        className={`leading-relaxed whitespace-pre-wrap ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitize(content) }}
      />
    );
  }

  if (content.includes("\n")) {
    return (
      <div className={`leading-relaxed whitespace-pre-wrap ${className}`}>
        {content.split("\n").map((line, i) =>
          line.trim() ? <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: sanitize(line) }} /> : <br key={i} />
        )}
      </div>
    );
  }

  return <p className={`leading-relaxed ${className}`} dangerouslySetInnerHTML={{ __html: sanitize(content) }} />;
}
