export type ConsentState = "granted" | "denied" | "unknown";

const STORAGE_KEY = "realtyhub_cookie_consent";
export const CONSENT_EVENT = "realtyhub:consent-change";

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : "unknown";
  } catch {
    return "unknown";
  }
}

export function setConsent(state: "granted" | "denied") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "granted";
}
