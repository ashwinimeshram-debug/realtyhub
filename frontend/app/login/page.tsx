"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import API from "@/lib/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useOwnerAuth();

  const next = searchParams.get("next") || "/my-account";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotErr, setForgotErr] = useState("");

  const handleForgot = async () => {
    if (!forgotEmail.trim()) {
      setForgotErr("Please enter your registered email address");
      return;
    }
    setForgotLoading(true);
    setForgotErr("");
    setForgotMsg("");
    try {
      const res = await API.post("/owner/forgot-password", { email: forgotEmail.trim() });
      setForgotMsg(res.data.message || "If the email is registered, a reset link has been sent");
    } catch (err: any) {
      setForgotErr(err?.response?.data?.error || "Could not send the reset link. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await API.post("/owner/login", form);
      await refresh();
      if (res.data.is_verified) {
        router.replace(next);
      } else {
        router.replace("/verify-email");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-transparent px-4 py-10">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-100"
      >
        <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: "var(--text-dark)" }}>Login</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Sign in to post and manage your properties
        </p>

        {error && (
          <div className="mb-4 text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        {forgotMode ? (
          <>
            <p className="text-sm text-gray-500 text-center mb-4">
              Enter the email address you registered with and we'll send you a link to reset your password.
            </p>

            {forgotMsg && (
              <div className="mb-4 text-green-600 text-sm text-center bg-green-50 p-3 rounded-lg">{forgotMsg}</div>
            )}
            {forgotErr && (
              <div className="mb-4 text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">{forgotErr}</div>
            )}

            <input
              type="email"
              placeholder="Registered email address"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="w-full mb-4 p-3 border rounded-lg text-sm"
              autoComplete="email"
              required
            />

            <button
              type="button"
              onClick={handleForgot}
              disabled={forgotLoading}
              className="w-full bg-[var(--primary)] text-white p-3 rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition"
            >
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </button>

            <p className="mt-4 text-sm text-center text-gray-500">
              <button
                type="button"
                onClick={() => { setForgotMode(false); setForgotMsg(""); setForgotErr(""); }}
                className="hover:underline"
              >
                Back to Login
              </button>
            </p>
          </>
        ) : (
          <>
        <input
          type="email"
          name="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full mb-4 p-3 border rounded-lg text-sm"
          autoComplete="email"
          required
        />

        <div className="relative mb-2">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full p-3 pr-10 border rounded-lg text-sm"
            autoComplete="current-password"
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

        <p className="text-sm text-right mb-3 -mt-1">
          <button
            type="button"
            onClick={() => setForgotMode(true)}
            className="text-[var(--primary)] hover:underline font-medium"
          >
            Forgot password?
          </button>
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--primary)] text-white p-3 rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
          </>
        )}

        <p className="mt-4 text-sm text-center text-gray-500">
          New owner?{" "}
          <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-sm text-center text-gray-500">
          <Link href="/" className="hover:underline">Back to Home</Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] text-center py-20 text-gray-400">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}