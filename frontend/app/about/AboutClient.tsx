"use client";

import Link from "next/link";
import SectionContent from "@/components/SectionContent";

interface Section {
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}

interface TeamMember {
  id: number;
  name: string;
  role: string;
  bio: string;
  email: string;
  social_links: Record<string, string>;
  photo_url: string;
  is_leader: boolean;
  sort_order: number;
}

interface GalleryImage {
  id: number;
  image_url: string;
  caption?: string;
}

export default function AboutClient({
  rawSections,
  members,
  layout,
  galleryImages,
  siteName,
  galleryTransition,
}: {
  rawSections: Section[];
  members: TeamMember[];
  layout: string;
  galleryImages: GalleryImage[];
  siteName: string;
  galleryTransition: string;
}) {
  const replaceName = (secs: Section[]) =>
    secs.map((s) => ({ ...s, content: s.content.replace(/__SITE_NAME__/g, siteName) }));

  const sections = replaceName(rawSections);

  const getSection = (label: string) =>
    sections.find((s) => s.label.toLowerCase() === label.toLowerCase());

  const welcome = getSection("Welcome");
  const aboutUs = getSection("About Us");
  const mission = getSection("Our Mission");
  const vision = getSection("Our Vision");
  const whatWeDo = getSection("What We Do");
  const whyChoose = getSection("Why Choose Us");
  const services = getSection("Our Services");
  const whoWeServe = getSection("Who We Serve");
  const ourApproach = getSection("Our Approach");
  const geoFocus = getSection("Our Geographic Focus");
  const getStarted = getSection("Get Started with Plot and Roof");

  const whyItems = whyChoose
    ? whyChoose.content
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  const serviceItems = services
    ? services.content
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  const audienceItems = whoWeServe
    ? whoWeServe.content
        .split(/\n\n+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  const whyIcons = [
    <svg key="1" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>,
    <svg key="2" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>,
    <svg key="3" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>,
    <svg key="4" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>,
    <svg key="5" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>,
  ];

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,76,186,0.08),_transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 lg:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-4 py-1.5 text-sm font-medium text-[var(--primary)] mb-6">
            About {siteName}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text-dark)]">
            {welcome?.content?.split("\n")[0] || "Your Trusted Real Estate Platform"}
          </h1>
          {welcome && (
            <p className="mt-4 max-w-3xl mx-auto text-base md:text-lg leading-relaxed text-[var(--text-muted)]">
              {welcome.content.split("\n").slice(1).join(" ") || welcome.content}
            </p>
          )}
          {aboutUs && (
            <p className="mt-6 max-w-4xl mx-auto text-sm md:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
              {aboutUs.content}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/properties" className="btn btn-primary px-6 py-2.5">
              Browse Properties
            </Link>
            <Link href="/post" className="btn btn-ghost px-6 py-2.5 border border-gray-200">
              Post Your Property
            </Link>
          </div>
        </div>
      </section>

      {(mission || vision) && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mission && (
              <article className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_60px_-40px_rgba(15,76,186,0.9)]">
                <div className="absolute -top-10 right-10 h-32 w-32 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] blur-3xl" />
                <div className="relative p-6 sm:p-8">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                    </svg>
                  </div>
                  <h2 className="mt-5 text-xl sm:text-2xl font-semibold text-[var(--text-dark)]">{mission.label}</h2>
                  <div className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
                    {mission.content}
                  </div>
                </div>
              </article>
            )}
            {vision && (
              <article className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_60px_-40px_rgba(15,76,186,0.9)]">
                <div className="absolute -top-10 right-10 h-32 w-32 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] blur-3xl" />
                <div className="relative p-6 sm:p-8">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="mt-5 text-xl sm:text-2xl font-semibold text-[var(--text-dark)]">{vision.label}</h2>
                  <div className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
                    {vision.content}
                  </div>
                </div>
              </article>
            )}
          </div>
        </section>
      )}

      {whatWeDo && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
          <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-white via-white to-[color-mix(in_srgb,var(--primary)_6%,transparent)] p-6 sm:p-10 lg:p-12 shadow-sm">
            <div className="max-w-4xl">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[var(--text-dark)]">{whatWeDo.label}</h2>
              <div className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
                <SectionContent content={whatWeDo.content} />
              </div>
            </div>
          </div>
        </section>
      )}

      {whyChoose && whyItems.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
          <div className="flex flex-col gap-3 text-center mb-8 md:mb-10">
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--primary)]">Why Choose Us</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[var(--text-dark)]">{whyChoose.label}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {whyItems.map((item, index) => (
              <div key={index} className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--primary)_40%,transparent)] to-transparent" />
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] transition-transform duration-300 group-hover:scale-105">
                    {whyIcons[index % whyIcons.length]}
                  </div>
                  <p className="pt-1 text-sm sm:text-base font-medium leading-relaxed text-[var(--text-dark)]">{item.replace(/^\d+\.\s*/, "")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {services && serviceItems.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-10">
            <div className="flex flex-col gap-3 mb-8">
              <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--primary)]">Our Services</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[var(--text-dark)]">{services.label}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {serviceItems.map((item, index) => (
                <div key={index} className="flex items-center gap-4 rounded-2xl border border-gray-100 px-5 py-4 transition-colors duration-300 hover:border-[color-mix(in_srgb,var(--primary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  <p className="text-sm sm:text-base font-medium text-[var(--text-dark)]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {whoWeServe && audienceItems.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
          <div className="flex flex-col gap-3 text-center mb-8 md:mb-10">
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--primary)]">Who We Serve</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[var(--text-dark)]">{whoWeServe.label}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {audienceItems.map((item, index) => (
              <article key={index} className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 shadow-sm">
                <div className="text-sm sm:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
                  <SectionContent content={item.replace(/&amp;/g, "&")} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {(ourApproach || geoFocus) && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {ourApproach && (
              <article className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-9">
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--primary)]">Our Approach</span>
                <h2 className="mt-3 text-xl sm:text-2xl lg:text-3xl font-semibold text-[var(--text-dark)]">{ourApproach.label}</h2>
                <div className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
                  {ourApproach.content}
                </div>
              </article>
            )}
            {geoFocus && (
              <article className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-9">
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--primary)]">Our Focus</span>
                <h2 className="mt-3 text-xl sm:text-2xl lg:text-3xl font-semibold text-[var(--text-dark)]">{geoFocus.label}</h2>
                <div className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
                  {geoFocus.content}
                </div>
              </article>
            )}
          </div>
        </section>
      )}

      {getStarted && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(15,76,186,0.18),_transparent_60%),_linear-gradient(135deg,rgba(15,76,186,0.98),rgba(12,61,150,0.98))] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14 text-center text-white">
            <div className="absolute -top-20 right-1/2 h-48 w-48 translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            <div className="relative max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold">{getStarted.label}</h2>
              <div className="mt-4 text-sm sm:text-base leading-relaxed text-white/90 whitespace-pre-line">
                {getStarted.content}
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/post" className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-[var(--primary)] transition hover:-translate-y-0.5 hover:shadow-lg">
                  Post Property for Free
                </Link>
                <Link href="/properties" className="inline-flex items-center justify-center rounded-xl border border-white/70 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                  Browse Properties
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
