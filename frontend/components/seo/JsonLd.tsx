import type { JsonLdGraph, JsonLdNode } from "@/lib/seo/types";

export default function JsonLd({ data }: { data: JsonLdGraph | JsonLdNode }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
