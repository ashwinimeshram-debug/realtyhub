"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import API from "@/lib/api";

export default function OwnerResetPasswordPage() {
  const { token } = useParams();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (password !== confirm) {
      return setMessage("Passwords do not match");
    }
    if (password.length < 8) {
      return setMessage("Password must be at least 8 characters");
    }

    setLoading(true);
    setMessage("");
    try {
      await API.post(`/owner/reset-password/${token}`, {
        password,
        confirm_password: confirm,
      });

      setMessage("Password reset successful");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Invalid or expired link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-transparent px-4 py-10">

      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-100">

        <h2 className="text-xl font-bold mb-2 text-center" style={{ color: "var(--text-dark)" }}>
          Reset Password
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Set a new password for your owner account
        </p>

        {message && (
          <div className="mb-4 text-sm p-3 rounded-lg text-center" style={{
            color: message.includes("successful") ? "#16a34a" : "var(--primary)",
            backgroundColor: message.includes("successful") ? "#f0fdf4" : "var(--primary-light)"
          }}>
            {message}
          </div>
        )}

        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            className="w-full p-3 pr-10 border rounded-lg text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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

        <div className="relative mb-4">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm Password"
            className="w-full p-3 pr-10 border rounded-lg text-sm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showConfirm ? (
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
          onClick={handleReset}
          disabled={loading}
          className="w-full bg-[var(--primary)] text-white py-3 rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        <p className="mt-4 text-sm text-center text-gray-500">
          <Link href="/login" className="hover:underline">Back to Login</Link>
        </p>

      </div>
    </div>
  );
}