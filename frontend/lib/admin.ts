import API, { setCsrfToken } from "./api";

export async function adminLogout(): Promise<boolean> {
  try {
    await API.post("/admin/logout");
  } catch {
    // continue — clear local state regardless
  }
  setCsrfToken(null);
  return true;
}
