"use client";

import { useState } from "react";
import API from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import ConsentCheckbox from "@/components/ConsentCheckbox";
import { useToast } from "@/components/Toast";

interface Section {
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}

const USED_LABELS = [
  "hero title",
  "hero subtitle",
  "hero card title",
  "hero card subtitle",
  "hero tags",
  "details title",
  "address",
  "phone",
  "email",
  "website",
  "hours title",
  "hours weekday",
  "hours sunday",
  "form title",
  "form subtitle",
  "form button",
  "form terms",
  "success title",
  "success text",
];

export default function ContactClient({ sections }: { sections: Section[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", consent: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (submitting || submitted) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submitted) return;
    if (form.phone.trim()) {
      const nums = form.phone.split(",").map((s) => s.trim()).filter(Boolean);
      const invalid = nums.find((n) => n.replace(/\D/g, "").length < 10);
      if (invalid) {
        toast("Each phone number must have at least 10 digits", "warning");
        setSubmitting(false);
        return;
      }
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast("Please enter a valid email address", "warning");
      setSubmitting(false);
      return;
    }
    if (!form.consent) {
      toast("Please accept the privacy notice to continue", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post("/contact", form);
      if (res.status === 201) {
        setSubmitted(true);
        setForm({ name: "", email: "", phone: "", message: "", consent: false });
        trackEvent("generate_lead", { content_type: "contact" });
      }
    } catch (error: any) {
      toast(error.response?.data?.error || "Server error", "error");
      setSubmitting(false);
    }
  };

  const fs = (label: string) => sections.find((s) => s.label.toLowerCase() === label.toLowerCase());

  const heroTitle = fs("Hero Title")?.content || "Get In Touch";
  const heroSubtitle = fs("Hero Subtitle")?.content || "Reach out to us — our team is happy to help.";
  const detailsTitle = fs("Details Title")?.content || "Our Contact Details";
  const address = fs("Address")?.content || "";
  const phone = fs("Phone")?.content || "";
  const email = fs("Email")?.content || "";
  const website = fs("Website")?.content || "";
  const hoursTitle = fs("Hours Title")?.content || "Business Hours";
  const hoursWeekdayRaw = fs("Hours Weekday")?.content || "";
  const hoursSundayRaw = fs("Hours Sunday")?.content || "";
  const formTitle = fs("Form Title")?.content || "Send a Message";
  const formSubtitle = fs("Form Subtitle")?.content || "Fill out the form below and we'll get back to you shortly.";
  const formButton = fs("Form Button")?.content || "Send Message";
  const formTerms = fs("Form Terms")?.content || "";
  const successTitle = fs("Success Title")?.content || "Message Sent!";
  const successText = fs("Success Text")?.content || "Thank you for reaching out. We'll get back to you soon.";

  const hoursWeekday = hoursWeekdayRaw.split("|");
  const hoursSunday = hoursSundayRaw.split("|");

  const contactCards = [
    address
      ? {
          title: "Office Address",
          value: address,
          href: null,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          ),
        }
      : null,
    phone
      ? {
          title: "Phone",
          value: phone,
          href: `tel:${phone.replace(/\s/g, "")}`,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          ),
        }
      : null,
    email
      ? {
          title: "Email",
          value: email,
          href: `mailto:${email}`,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          ),
        }
      : null,
    website
      ? {
          title: "Website",
          value: website,
          href: `https://${website.replace(/^https?:\/\//, "")}`,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          ),
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; value: string; href: string | null; icon: React.ReactNode }>;

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,76,186,0.08),_transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-4 py-1.5 text-sm font-medium text-[var(--primary)] mb-6">
            Contact Us
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text-dark)]">{heroTitle}</h1>
          <p className="mt-4 max-w-2xl mx-auto text-base md:text-lg leading-relaxed text-[var(--text-muted)]">{heroSubtitle}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {contactCards.map((card, index) => (
            <article key={index} className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--primary)_40%,transparent)] to-transparent" />
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]">
                {card.icon}
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--text-dark)]">{card.title}</h3>
              {card.href ? (
                <a href={card.href} target={card.title === "Website" ? "_blank" : undefined} rel={card.title === "Website" ? "noopener noreferrer" : undefined} className="mt-2 block text-sm leading-relaxed text-[var(--text-muted)] transition hover:text-[var(--primary)] whitespace-pre-line">
                  {card.value}
                </a>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)] whitespace-pre-line">{card.value}</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6 lg:gap-8 items-start">
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-dark)]">{detailsTitle}</h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">{address}</p>
            </div>
            <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-dark)]">{hoursTitle}</h2>
              <div className="mt-4 divide-y divide-gray-100">
                {hoursWeekday.length === 2 && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-[var(--text-dark)]">{hoursWeekday[0]}</span>
                    <span className="text-sm text-[var(--text-muted)]">{hoursWeekday[1]}</span>
                  </div>
                )}
                {hoursSunday.length === 2 && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-[var(--text-dark)]">{hoursSunday[0]}</span>
                    <span className={`text-sm font-medium ${hoursSunday[1].toLowerCase() === "closed" ? "text-red-500" : "text-[var(--text-muted)]"}`}>{hoursSunday[1]}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-10 shadow-sm">
            <div className="mb-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-dark)]">{formTitle}</h2>
              <p className="mt-2 text-sm sm:text-base text-[var(--text-muted)]">{formSubtitle}</p>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[var(--text-dark)]">{successTitle}</h3>
                <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">{successText}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-dark)]">Full Name</label>
                    <input type="text" name="name" required value={form.name} onChange={handleChange} disabled={submitting} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]" placeholder="Enter your full name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-dark)]">Email Address</label>
                    <input type="email" name="email" required value={form.email} onChange={handleChange} disabled={submitting} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]" placeholder="you@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-dark)]">Phone Number</label>
                  <input type="tel" name="phone" required value={form.phone} onChange={handleChange} disabled={submitting} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]" placeholder="+91 XXXXX XXXXX" />
                  <p className="text-xs text-[var(--text-muted)]">For multiple numbers, separate with a comma</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-dark)]">Message</label>
                  <textarea name="message" rows={6} required value={form.message} onChange={handleChange} disabled={submitting} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]" placeholder="Tell us how we can help you..." />
                </div>
                <ConsentCheckbox checked={form.consent} onChange={(v) => setForm({ ...form, consent: v })} disabled={submitting} />
                <button type="submit" disabled={submitting} className="btn btn-primary w-full py-2.5">
                  {submitting ? "Sending..." : formButton}
                </button>
                {formTerms && (
                  <p className="text-center text-xs text-[var(--text-muted)]" dangerouslySetInnerHTML={{ __html: formTerms }} />
                )}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
