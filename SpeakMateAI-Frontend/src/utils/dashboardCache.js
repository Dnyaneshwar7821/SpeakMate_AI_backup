/**
 * dashboardCache.js
 * High-performance client cache for SpeakMate dashboard statistics and user rhythm.
 * Ensures instant loading of dashboard cards without showing stale previous user state or empty flashes.
 */

export const DASHBOARD_CACHE_KEY = "speakmate_dashboard_data_cache";
export const DEFAULT_DASHBOARD_CACHE_TTL_MS = 180000; // 3 minutes TTL

let inMemoryDashboardCache = null;

/**
 * Retrieve cached dashboard data for the active user.
 * Validates that cached data matches the current authenticated user's email and
 * is within the allowed TTL (default 3 minutes) to prevent showing stale numbers.
 */
export function getCachedDashboardData(currentUserEmail, maxAgeMs = DEFAULT_DASHBOARD_CACHE_TTL_MS) {
  let normEmail = currentUserEmail ? String(currentUserEmail).toLowerCase().trim() : null;
  if (!normEmail) {
    try {
      const rawUser = localStorage.getItem("speakmate_user");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u?.email) normEmail = String(u.email).toLowerCase().trim();
      }
    } catch (_) {}
  }

  const now = Date.now();

  if (inMemoryDashboardCache) {
    const isEmailValid = normEmail
      ? inMemoryDashboardCache._userEmail === normEmail
      : !inMemoryDashboardCache._userEmail;

    const isFresh = inMemoryDashboardCache._cachedAt && (now - inMemoryDashboardCache._cachedAt <= maxAgeMs);

    if (isEmailValid && isFresh) {
      return inMemoryDashboardCache;
    }
  }

  try {
    const stored = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const isEmailValid = normEmail
        ? parsed._userEmail === normEmail
        : !parsed._userEmail;

      const isFresh = parsed._cachedAt && (now - parsed._cachedAt <= maxAgeMs);

      if (isEmailValid && isFresh) {
        inMemoryDashboardCache = parsed;
        return parsed;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Store dashboard data in memory and sessionStorage tagged with the user's email and timestamp.
 */
export function setCachedDashboardData(data, userEmail) {
  if (!data) return;
  const normEmail = userEmail ? String(userEmail).toLowerCase().trim() : null;
  const payload = {
    ...data,
    ...(normEmail ? { _userEmail: normEmail } : {}),
    _cachedAt: Date.now(),
  };
  inMemoryDashboardCache = payload;
  try {
    sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

/**
 * Clear cached dashboard data on logout or session reset.
 */
export function clearDashboardCache() {
  inMemoryDashboardCache = null;
  try {
    sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
  } catch (_) {}
}
