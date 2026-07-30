"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await API.post("/admin/login", form);
      router.replace("/admin/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError("Please enter your email address");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    setForgotMessage("");
    try {
      const res = await API.post("/admin/forgot-password", { email: forgotIdentifier.trim() });
      setForgotMessage(res.data.message || "If that email exists, a reset link has been sent");
    } catch (err: any) {
      setForgotError(err?.response?.data?.error || "Something went wrong");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRequestAdmin = async () => {
    if (!forgotIdentifier.trim()) {
      setRequestError("Please enter your email or username first");
      return;
    }
    setRequestLoading(true);
    setRequestError("");
    setRequestMessage("");
    try {
      const res = await API.post("/admin/password-reset-request", { identifier: forgotIdentifier.trim() });
      setRequestMessage(res.data.message || "Request sent to admin");
      setRequestSent(true);
    } catch (err: any) {
      setRequestError(err?.response?.data?.error || "Something went wrong");
    } finally {
      setRequestLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2 text-center">Forgot Password</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter your registered email or username and we&apos;ll help you reset your password.
          </p>

          {forgotMessage && (
            <div className="mb-4 text-green-600 text-sm text-center bg-green-50 p-3 rounded-lg">
              {forgotMessage}
            </div>
          )}

          {forgotError && (
            <div className="mb-4 text-red-500 text-sm text-center">
              {forgotError}
            </div>
          )}

          <form onSubmit={handleForgotPassword}>
            <input
              type="text"
              placeholder="Email or Username"
              value={forgotIdentifier}
              onChange={(e) => setForgotIdentifier(e.target.value)}
              className="w-full mb-4 p-3 border rounded-lg text-sm"
              required
              autoFocus
            />

            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-[var(--primary)] text-white p-3 rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition"
            >
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-gray-400">or</span>
            </div>
          </div>

          {requestMessage && (
            <div className="mb-3 text-green-600 text-sm text-center bg-green-50 p-3 rounded-lg">
              {requestMessage}
            </div>
          )}
          {requestError && (
            <div className="mb-3 text-red-500 text-sm text-center">
              {requestError}
            </div>
          )}

          <button
            type="button"
            onClick={handleRequestAdmin}
            disabled={requestLoading || requestSent}
            className={`w-full p-3 rounded-lg text-sm font-medium transition border ${
              requestSent
                ? "bg-green-50 text-green-600 border-green-200 cursor-default"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
            }`}
          >
            {requestLoading ? "Sending..." : requestSent ? "Request Sent ✓" : "Send Request to Admin"}
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-2">
            Admin will reset your password and contact you
          </p>

          <button
            onClick={() => {
              setForgotMode(false);
              setForgotMessage("");
              setForgotError("");
              setForgotIdentifier("");
              setRequestMessage("");
              setRequestError("");
              setRequestSent(false);
            }}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 text-center cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">
          Admin Login
        </h1>

        {error && (
          <div className="mb-4 text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="text"
          name="username"
          placeholder="Username"
          value={form.username}
          onChange={(event) =>
            setForm({ ...form, username: event.target.value })
          }
          className="w-full mb-4 p-3 border rounded-lg text-sm"
          autoComplete="username"
          required
        />

        <div className="relative mb-4">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--primary)] text-white p-3 rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          type="button"
          onClick={() => setForgotMode(true)}
          className="w-full mt-3 text-sm text-[var(--primary)] hover:underline text-center cursor-pointer"
        >
          Forgot Password?
        </button>
      </form>
    </div>
  );
}
