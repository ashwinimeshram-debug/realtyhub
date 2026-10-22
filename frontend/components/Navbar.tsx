"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import API from "@/lib/api";
import { backendAssetUrl } from "@/lib/api";
import SearchBar from "./SearchBar";
import { useSettings } from "@/hooks/useSettings";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const { settings, loading: settingsLoading } = useSettings();
  const allowPublicPost = !settingsLoading && settings.allow_public_post !== "false";
  const { owner } = useOwnerAuth();

  const siteName = settings.site_name || "";
  const siteLogo = settings.site_logo || "";

  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen]);

  const closeAll = () => {
    setMenuOpen(false);
    setSearchOpen(false);
  };

  return (
    <div ref={navRef} className="bg-white shadow-md relative z-50">
      <div className="px-4 md:px-6 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-lg md:text-xl font-bold transition" style={{ color: "var(--primary)" }}>
          {siteLogo && (
            <Image
              src={backendAssetUrl(siteLogo)}
              alt="Logo"
              width={36}
              height={36}
              className="h-8 w-8 md:h-9 md:w-9 object-contain rounded"
            />
          )}
          <span className="truncate max-w-[180px] md:max-w-none">{siteName}</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="hover:opacity-80 transition" style={{ color: "var(--primary)" }}>Home</Link>
          <Link href="/properties" className="hover:opacity-80 transition" style={{ color: "var(--primary)" }}>Properties</Link>
          <Link href="/how-it-works" className="hover:opacity-80 transition" style={{ color: "var(--primary)" }}>How It Works</Link>
          <Link href="/about" className="hover:opacity-80 transition" style={{ color: "var(--primary)" }}>About Us</Link>
          <Link href="/contact" className="hover:opacity-80 transition" style={{ color: "var(--primary)" }}>Contact Us</Link>
          {owner ? (
            <div className="flex items-center gap-2">
              <Link href="/my-account" className="btn btn-sm" style={{ backgroundColor: "var(--primary)", color: "#ffffff", borderColor: "var(--primary)" }}>
                My Account
              </Link>
            </div>
          ) : (
            allowPublicPost && (
              <Link href="/login" className="hover:opacity-80 transition" style={{ color: "var(--primary)" }}>Sign In</Link>
            )
          )}
          {allowPublicPost && (
            <Link href="/post" className="btn btn-sm" style={{ backgroundColor: "var(--secondary)", color: "#ffffff", borderColor: "var(--secondary)" }}>
              Post Property
            </Link>
          )}
        </div>

        {/* Mobile icons */}
        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}
            className="p-2 rounded hover:bg-gray-100 transition"
            aria-label="Search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <button
            onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}
            className="p-2 rounded hover:bg-gray-100 transition"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile search dropdown */}
      {searchOpen && (
        <div className="md:hidden border-t bg-gray-50 px-4 py-3 animate-slideDown">
          <Suspense fallback={null}>
            <SearchBar onSearch={() => setSearchOpen(false)} />
          </Suspense>
        </div>
      )}

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t bg-white shadow-lg">
          <Link href="/" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition" style={{ color: "var(--primary)" }}>Home</Link>
          <Link href="/properties" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition" style={{ color: "var(--primary)" }}>Properties</Link>
          <Link href="/how-it-works" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition" style={{ color: "var(--primary)" }}>How It Works</Link>
          <Link href="/about" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition" style={{ color: "var(--primary)" }}>About Us</Link>
          <Link href="/contact" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition" style={{ color: "var(--primary)" }}>Contact Us</Link>
          {owner ? (
            <Link href="/my-account" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition" style={{ color: "var(--primary)" }}>My Account</Link>
          ) : (
            allowPublicPost && (
              <Link href="/login" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition" style={{ color: "var(--primary)" }}>Sign In</Link>
            )
          )}
          {allowPublicPost && (
            <Link href="/post" onClick={closeAll} className="block px-6 py-3 hover:bg-gray-50 transition">Post Property</Link>
          )}
        </div>
      )}
    </div>
  );
}
