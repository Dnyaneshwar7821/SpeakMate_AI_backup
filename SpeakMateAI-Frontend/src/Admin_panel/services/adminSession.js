import { isAdminRole } from "../constants/adminRoles";

const ADMIN_SESSION_KEY = "speakmate_admin_session";

export function getAdminSession() {
  try {
    const session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY));
    return session?.authenticated && isAdminRole(session.role) ? session : null;
  } catch {
    return null;
  }
}

export function isAdminAuthenticated(allowedRoles) {
  const session = getAdminSession();
  if (!session) return false;

  if (!allowedRoles) return true;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(session.role);
}

export function getAuthenticatedAdminRole() {
  return getAdminSession()?.role ?? null;
}

export function setAdminAuthenticated({ role, token = null, rememberMe = false, user = null }) {
  if (!isAdminRole(role)) {
    throw new Error("Cannot create an admin session with an unsupported role.");
  }

  localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({ authenticated: true, role, token, rememberMe: Boolean(rememberMe), user })
  );
}

export function clearAdminAuthenticated() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (
        k &&
        (k.startsWith("speakmate_assistant_") ||
          k.includes("admin_dashboard_cache") ||
          k.includes("school_dashboard_cache") ||
          k.includes("teacher_dashboard_cache"))
      ) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (_) {}
}

export function updateAdminSessionUser(userUpdates) {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session && session.user) {
        session.user = {
          ...session.user,
          ...userUpdates,
        };
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
        window.dispatchEvent(new Event("admin-session-updated"));
        return session;
      }
    }
  } catch (e) {
    console.error("Failed to update admin session user in localStorage:", e);
  }
  return null;
}
