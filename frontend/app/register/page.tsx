"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import API from "@/lib/api";
import ConsentCheckbox from "@/components/ConsentCheckbox";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", consent: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.consent) {
      setError("Please accept the privacy notice to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await API.post("/owner/register", form);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-transparent px-4 py-10">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md text-center border border-gray-100">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-dark)" }}>Check your inbox!</h1>
          <p className="text-gray-600 text-sm mb-4">
            We&apos;ve sent a verification link to <strong>{form.email}</strong>.
            Click it to verify your account, then you can post properties.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mb-6">
            Link expires in 24 hours. Didn&apos;t receive it? Log in and use the
            &quot;Resend verification email&quot; button.
          </div>
          <div className="flex gap-3">
            <Link href="/login" className="btn btn-primary flex-1 text-center">Go to Login</Link>
            <Link href="/" className="btn btn-ghost flex-1 text-center">Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-transparent px-4 py-10">
      <form
        onSubmit={handleRegister}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-100"
      >
        <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: "var(--text-dark)" }}>Create Owner Account</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Post properties and track connect requests
        </p>

        {error && (
          <div className="mb-4 text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full mb-4 p-3 border rounded-lg text-sm"
          autoComplete="name"
          required
        />
        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full mb-4 p-3 border rounded-lg text-sm"
          autoComplete="email"
          required
        />
        <input
          type="tel"
          placeholder="Mobile number"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          className="w-full mb-4 p-3 border rounded-lg text-sm"
          autoComplete="tel"
          required
        />
        <div className="relative mb-2">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password (min 8 characters)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full p-3 pr-10 border rounded-lg text-sm"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <ConsentCheckbox
          checked={form.consent}
          onChange={(v) => setForm({ ...form, consent: v })}
          disabled={loading}
          className="mt-2 mb-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--primary)] text-white p-3 rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition mt-2"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="mt-4 text-sm text-center text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}