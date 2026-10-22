"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import API, { setCsrfToken, withRetry, isTransientError } from "@/lib/api";
import AdminTopbar from "@/components/admin/AdminTopbar";
import Sidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/hooks/useAuth";
import { ConfirmProvider } from "@/hooks/useConfirm";

const DEFAULT_TIMEOUT_MIN = 30;
const WARNING_BUFFER_MS = 2 * 60 * 1000;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin";

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(!isLoginPage);
  const [authError, setAuthError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [timeoutMin, setTimeoutMin] = useState(DEFAULT_TIMEOUT_MIN);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [transientError, setTransientError] = useState(false);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doLogout = useCallback(async () => {
    await API.post("/admin/logout").catch(() => {});
    setCsrfToken(null);
    router.replace("/admin");
  }, [router]);

  useEffect(() => {
    if (isLoginPage) {
      setAuthorized(true);
      setLoading(false);
      return;
    }

    setAuthorized(false);
    setLoading(true);
    setAuthError("");
    setTransientError(false);

    const init = async () => {
      try {
        try {
          // Retry transient (5xx / network) failures so shared-host DB
          // contention does not spuriously log the admin out.
          await withRetry(() => API.get("/admin/check-auth"));
        } catch (err: any) {
          if (isTransientError(err)) {
            // Still failing after retries: the backend is temporarily
            // unavailable. Do NOT clear the session or redirect; surface a
            // retryable message instead of "Session expired".
            setAuthError("Server is temporarily unavailable. Please retry.");
            setTransientError(true);
            setLoading(false);
            return;
          }
          throw err;
        }

        const settingsRes = await API.get("/admin/settings").catch(() => ({
          data: {} as Record<string, string>,
        }));

        setAuthorized(true);

        const mins = parseInt(settingsRes.data.session_timeout_minutes);
        if (mins >= 1 && mins <= 120) {
          setTimeoutMin(mins);
        }
      } catch (err: any) {
        // Reached only for genuine auth failures (401 / 403 / disabled).
        const msg = err?.response?.data?.error || "";
        setAuthError(msg === "Account disabled" ? "Account disabled. Contact your administrator." : "Session expired.");
        await API.post("/admin/logout").catch(() => {});
        setCsrfToken(null);
        setTimeout(() => router.replace("/admin"), 2000);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isLoginPage, router, retryCount]);

  useEffect(() => {
    if (isLoginPage || !authorized) return;

    const timeoutMs = timeoutMin * 60 * 1000;
    const warningMs = Math.max(0, timeoutMs - WARNING_BUFFER_MS);

    const logout = () => {
      setShowExpiryWarning(false);
      setSecondsLeft(0);
      API.post("/admin/logout").catch(() => {});
      setCsrfToken(null);
      router.replace("/admin");
    };

    const clearAllTimers = () => {
      if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null; }
      if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null; }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };

    const startWarningCountdown = () => {
      setSecondsLeft(Math.ceil(WARNING_BUFFER_MS / 1000));
      setShowExpiryWarning(true);
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const resetTimers = () => {
      clearAllTimers();
      setShowExpiryWarning(false);
      setSecondsLeft(0);

      if (warningMs > 0) {
        warningTimerRef.current = setTimeout(startWarningCountdown, warningMs);
      } else {
        startWarningCountdown();
      }
      logoutTimerRef.current = setTimeout(logout, timeoutMs);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, resetTimers, { passive: true }));
    resetTimers();

    return () => {
      clearAllTimers();
      events.forEach((e) => window.removeEventListener(e, resetTimers));
    };
  }, [isLoginPage, authorized, router, timeoutMin]);

  useEffect(() => {
    if (showExpiryWarning && secondsLeft <= 0) {
      doLogout();
    }
  }, [secondsLeft, showExpiryWarning, doLogout]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-sm text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">{authError}</h2>
          {transientError ? (
            <>
              <p className="text-sm text-gray-500 mb-4">Your session is still active.</p>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Retry
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          )}
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying access...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <ConfirmProvider>
      <div className="flex min-h-screen bg-gray-100">
        {showExpiryWarning && (
          <div className="fixed inset-x-0 top-0 z-[100] bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg flex items-center justify-center gap-3">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>
              Your session expires in <strong>{secondsLeft}s</strong>. Move your mouse to stay signed in.
            </span>
            <button
              onClick={() => window.dispatchEvent(new Event("mousedown"))}
              className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition"
            >
              Stay Signed In
            </button>
          </div>
        )}

        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopbar onMenuToggle={() => setMobileOpen((p) => !p)} />
          <div className="p-3 md:p-6 flex-1 overflow-x-hidden">{children}</div>
        </div>
      </div>
      </ConfirmProvider>
    </AuthProvider>
  );
}
