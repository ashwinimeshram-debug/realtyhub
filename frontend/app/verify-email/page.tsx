"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import API from "@/lib/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { owner, loading, logout, refresh } = useOwnerAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !owner) {
      router.replace("/login?next=/verify-email");
    }
    if (!loading && owner?.is_verified) {
      router.replace("/my-account");
    }
  }, [loading, owner, router]);

  const handleResend = async () => {
    setResending(true);
    setResentMsg("");
    try {
      await API.post("/owner/resend-verification");
      setResentMsg("Verification email sent. Please check your inbox (and spam folder).");
      toast("Verification email sent", "success");
    } catch (err: any) {
      toast(err?.response?.data?.error || "Could not resend verification email", "error");
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: "Delete your account and personal data?",
      message:
        "This permanently removes your personal information and any listings. This cannot be undone.",
      confirmLabel: "Delete Account",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await API.post("/owner/delete-account");
      toast("Your account has been deleted", "success");
      await logout();
      router.replace("/");
    } catch (err: any) {
      toast(err?.response?.data?.error || "Could not delete your account", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !owner) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 py-12">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-lg border border-gray-100 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-dark)" }}>
          Verify your email
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          We sent a verification link to
        </p>
        <p className="text-sm font-medium mb-4" style={{ color: "var(--text-dark)" }}>
          {owner.email}
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Please open that email and click the verification link to unlock your dashboard.
          Don&apos;t forget to check your spam folder.
        </p>

        {resentMsg && (
          <div className="mb-4 text-green-700 text-sm bg-green-50 border border-green-200 p-3 rounded-lg">
            {resentMsg}
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={resending}
          className="w-full bg-[var(--primary)] text-white p-3 rounded-lg hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-sm font-medium transition mb-4"
        >
          {resending ? "Sending..." : "Resend verification email"}
        </button>

        <div className="flex flex-col sm:flex-row gap-2 justify-center text-sm">
          <button
            onClick={() => refresh()}
            className="text-[var(--primary)] hover:underline"
          >
            I&apos;ve verified — refresh
          </button>
          <span className="hidden sm:inline text-gray-300">|</span>
          <button onClick={handleLogout} className="text-gray-500 hover:underline">
            Logout
          </button>
          <span className="hidden sm:inline text-gray-300">|</span>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="text-red-600 hover:underline disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete account"}
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Wrong account?{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Sign in with a different email
          </Link>
        </p>
      </div>
    </div>
  );
}
