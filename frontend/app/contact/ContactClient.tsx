"use client";

import { useState } from "react";
import API from "@/lib/api";
import SectionContent from "@/components/SectionContent";
import { useToast } from "@/components/Toast";

interface Section {
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}

const USED_LABELS = [
  "hero title", "hero subtitle", "hero card title", "hero card subtitle", "hero tags",
  "details title", "address", "phone", "email", "website",
  "hours title", "hours weekday", "hours sunday",
  "form title", "form subtitle", "form button", "form terms",
  "success title", "success text",
];

export default function ContactClient({ sections }: { sections: Section[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
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
      const nums = form.phone.split(",").map(s => s.trim()).filter(Boolean);
      const invalid = nums.find(n => n.replace(/\D/g, "").length < 10);
      if (invalid) { toast("Each phone number must have at least 10 digits", "warning"); setSubmitting(false); return; }
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast("Please enter a valid email address", "warning"); setSubmitting(false); return;
    }
    setSubmitting(true);
    try {
      const res = await API.post("/contact", form);
      if (res.status === 201) {
        setSubmitted(true);
        setForm({ name: "", email: "", phone: "", message: "" });
      }
    } catch (error: any) {
      toast(error.response?.data?.error || "Server error", "error");
      setSubmitting(false);
    }
  };

  const fs = (label: string) =>
    sections.find((s) => s.label.toLowerCase() === label.toLowerCase());

  const heroTitle = fs("Hero Title")?.content || "";
  const heroSubtitle = fs("Hero Subtitle")?.content || "";
  const heroCardTitle = fs("Hero Card Title")?.content || "";
  const heroCardSubtitle = fs("Hero Card Subtitle")?.content || "";
  const heroTags = (fs("Hero Tags")?.content || "").split("\n").filter((t) => t.trim());
  const detailsTitle = fs("Details Title")?.content || "";
  const address = fs("Address")?.content || "";
  const phone = fs("Phone")?.content || "";
  const email = fs("Email")?.content || "";
  const website = fs("Website")?.content || "";
  const hoursTitle = fs("Hours Title")?.content || "";
  const hoursWeekdayRaw = fs("Hours Weekday")?.content || "";
  const hoursSundayRaw = fs("Hours Sunday")?.content || "";
  const formTitle = fs("Form Title")?.content || "";
  const formSubtitle = fs("Form Subtitle")?.content || "";
  const formButton = fs("Form Button")?.content || "Send Message";
  const formTerms = fs("Form Terms")?.content || "";
  const successTitle = fs("Success Title")?.content || "Message Sent!";
  const successText = fs("Success Text")?.content || "Thank you for reaching out.";

  const hoursWeekday = hoursWeekdayRaw.split("|");
  const hoursSunday = hoursSundayRaw.split("|");

  return (
    <div>

      {/* ═══════════ PAGE HEADER ═══════════ */}
      <header style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #ffffff 100%)", padding: "48px 0", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--text-dark)", marginBottom: 8 }}>Contact Us</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 500 }}>We&apos;re here to help with all your real estate needs</p>
        </div>
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section style={{ padding: "80px 0 60px", background: "linear-gradient(135deg, #f0f4fa 0%, #ffffff 100%)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-12 items-center">

            <div className="text-center lg:text-left">
              <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: 12, color: "var(--text-dark)" }}>
                {heroTitle}
              </h2>
              <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", marginBottom: 24 }}>
                {heroSubtitle}
              </p>
            </div>

            <div style={{ backgroundColor: "var(--primary-light)", border: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)", borderRadius: 16, padding: 36, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ width: 56, height: 56, backgroundColor: "var(--primary)", color: "#ffffff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35rem", margin: "0 auto 20px", boxShadow: "0 8px 20px color-mix(in srgb, var(--primary) 20%, transparent)" }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 6 }}>{heroCardTitle}</h3>
              <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: 20 }}>{heroCardSubtitle}</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                {heroTags.map((tag) => (
                  <span key={tag} style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", padding: "6px 14px", borderRadius: 6, fontSize: "0.85rem", fontWeight: 500, color: "var(--text-dark)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <section style={{ padding: "80px 0", backgroundColor: "#f8fafc" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-10 items-start">

            {/* LEFT COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>

              {/* DETAILS CARD */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "40px 30px", boxShadow: "var(--shadow-card)", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                <div style={{ width: 50, height: 50, backgroundColor: "color-mix(in srgb, var(--primary) 6%, transparent)", color: "var(--primary)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", margin: "0 auto 20px" }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, textAlign: "center" }}>{detailsTitle}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: 20, lineHeight: 1.7, textAlign: "center" }}>
                  {address.split("\n").map((line, i) => (
                    <span key={i}>{line}{i < address.split("\n").length - 1 && <><br /></>}</span>
                  ))}
                </p>

                {phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid #f1f5f9", color: "var(--text-dark)", fontSize: "0.95rem" }}>
                    <div style={{ width: 32, height: 32, backgroundColor: "color-mix(in srgb, var(--primary) 6%, transparent)", color: "var(--primary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                      </svg>
                    </div>
                    <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ color: "var(--text-dark)", textDecoration: "none" }}>{phone}</a>
                  </div>
                )}

                {email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid #f1f5f9", color: "var(--text-dark)", fontSize: "0.95rem" }}>
                    <div style={{ width: 32, height: 32, backgroundColor: "color-mix(in srgb, var(--primary) 6%, transparent)", color: "var(--primary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <a href={`mailto:${email}`} style={{ color: "var(--text-dark)", textDecoration: "none" }}>{email}</a>
                  </div>
                )}

                {website && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid #f1f5f9", color: "var(--text-dark)", fontSize: "0.95rem" }}>
                    <div style={{ width: 32, height: 32, backgroundColor: "color-mix(in srgb, var(--primary) 6%, transparent)", color: "var(--primary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                    </div>
                    <a href={`https://${website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-dark)", textDecoration: "none" }}>{website}</a>
                  </div>
                )}
              </div>

              {/* HOURS CARD */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, boxShadow: "var(--shadow-card)" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>{hoursTitle}</h3>
                {hoursWeekday.length === 2 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                    <span style={{ fontWeight: 500, color: "var(--text-dark)", fontSize: "0.95rem" }}>{hoursWeekday[0]}</span>
                    <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.95rem" }}>{hoursWeekday[1]}</span>
                  </div>
                )}
                {hoursSunday.length === 2 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px dashed #f1f5f9" }}>
                    <span style={{ fontWeight: 500, color: "var(--text-dark)", fontSize: "0.95rem" }}>{hoursSunday[0]}</span>
                    <span style={{ color: hoursSunday[1].toLowerCase() === "closed" ? "#ef4444" : "var(--text-muted)", fontWeight: 600, fontSize: "0.95rem" }}>{hoursSunday[1]}</span>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: FORM */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 40, boxShadow: "var(--shadow-card)", textAlign: "center" }}>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>{formTitle}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: 32 }}>{formSubtitle}</p>

              {submitted ? (
                <div style={{ padding: "64px 0" }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "rgba(16, 185, 129, 0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "1.5rem" }}>
                    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8 }}>{successTitle}</h3>
                  <p style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>{successText}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-dark)" }}>Full Name</label>
                      <input type="text" name="name" placeholder="Your name" required value={form.name} onChange={handleChange} disabled={submitting}
                        className="form-input" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-dark)" }}>Email Address</label>
                      <input type="email" name="email" placeholder="you@example.com" required value={form.email} onChange={handleChange} disabled={submitting}
                        className="form-input" />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-dark)" }}>Phone Number</label>
                    <input type="tel" name="phone" placeholder="+91 98765 43210" required value={form.phone} onChange={handleChange} disabled={submitting}
                      className="form-input" />
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>For multiple numbers, separate with comma</p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-dark)" }}>Message</label>
                    <textarea name="message" placeholder="How can we help you?" rows={6} required value={form.message} onChange={handleChange} disabled={submitting}
                      className="form-input" style={{ resize: "vertical" }} />
                  </div>

                  <button type="submit" disabled={submitting}
                    className="btn btn-primary w-full mb-4" style={{ opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? "Sending..." : formButton}
                  </button>
                  <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {formTerms}
                  </p>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* UNMATCHED CMS SECTIONS */}
      {sections
        .filter((s) => !USED_LABELS.includes(s.label.toLowerCase()))
        .map((section) => (
          <div key={section.id} className="px-6 py-10" style={{ maxWidth: 1140, margin: "0 auto" }}>
            {section.type === "description" ? (
              <SectionContent content={section.content} className="text-gray-600 text-sm leading-relaxed" />
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-3">{section.label}</h2>
                <SectionContent content={section.content} className="text-gray-600 text-sm leading-relaxed" />
              </>
            )}
          </div>
        ))
      }

    </div>
  );
}
