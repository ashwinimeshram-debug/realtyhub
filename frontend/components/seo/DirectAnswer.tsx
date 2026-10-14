import type { FaqItem } from "@/lib/seo/types";

export default function DirectAnswer({
  items,
  title,
  subtitle,
}: {
  items: FaqItem[];
  title?: string;
  subtitle?: string;
}) {
  const faqs = items.filter((f) => f.question && f.answer);
  if (faqs.length === 0) return null;

  return (
    <section className="py-8 px-4 md:px-10" aria-labelledby="direct-answers-heading">
      <div className="max-w-3xl mx-auto">
        <h2
          id="direct-answers-heading"
          className="text-xl md:text-2xl font-bold text-center mb-2"
          style={{ color: "var(--text-dark)" }}
        >
          {title || "Frequently Asked Questions"}
        </h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          {subtitle || "Quick answers to common buyer questions"}
        </p>
        <div className="space-y-4">
          {faqs.map((item, index) => (
            <div
              key={`${item.question}-${index}`}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
            >
              <h3 className="font-semibold text-gray-800 text-sm md:text-base mb-2">
                {item.question}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
