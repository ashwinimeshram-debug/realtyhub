"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import API from "@/lib/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { refresh } = useOwnerAuth();

  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Invalid verification link.");
      return;
    }
    API.get(`/owner/verify/${token}`)
      .then(async () => {
        await refresh();
        setState("success");
      })
      .catch((err: any) => {
        setErrorMsg(err?.response?.data?.error || "Verification failed. The link may be invalid or expired.");
        setState("error");
      });
  }, [token, refresh]);

  if (state === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
        <div className="text-center">
          <svg className="w-10 h-10 animate-spin mx-auto mb-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 text-sm">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-transparent px-4 py-10">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md text-center border border-gray-100">
        {state === "success" ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-dark)" }}>Email Verified!</h1>
            <p className="text-gray-600 text-sm mb-2">Your account is ready. You can now post properties.</p>
            <button
              onClick={() => router.push("/my-account")}
              className="mt-4 w-full bg-[var(--primary)] text-white p-3 rounded-lg hover:bg-[var(--primary-hover)] text-sm font-medium transition"
            >
              Go to My Account
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-dark)" }}>Verification Failed</h1>
            <p className="text-gray-600 text-sm mb-6">{errorMsg}</p>
            <div className="flex flex-col gap-3">
              <Link href="/login" className="btn btn-primary text-center">Go to Login</Link>
              <Link href="/" className="btn btn-ghost text-center">Back to Home</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}