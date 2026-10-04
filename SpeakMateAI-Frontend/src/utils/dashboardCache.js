/**
 * dashboardCache.js
 * High-performance client cache for SpeakMate dashboard statistics and user rhythm.
 * Ensures instant loading of dashboard cards without showing previous user state or empty flashes.
 */

export const DASHBOARD_CACHE_KEY = "speakmate_dashboard_data_cache";

let inMemoryDashboardCache = null;

/**
 * Retrieve cached dashboard data for the active user.
 * Validates that cached data matches the current authenticated user's email to prevent
 * showing stale or previous user session state.
 */
export function getCachedDashboardData(currentUserEmail) {
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

  if (inMemoryDashboardCache) {
    if (normEmail) {
      if (inMemoryDashboardCache._userEmail === normEmail) {
        return inMemoryDashboardCache;
      }
    } else if (!inMemoryDashboardCache._userEmail) {
      return inMemoryDashboardCache;
    }
  }

  try {
    const stored = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (normEmail) {
        if (parsed._userEmail === normEmail) {
          inMemoryDashboardCache = parsed;
          return parsed;
        }
      } else if (!parsed._userEmail) {
        inMemoryDashboardCache = parsed;
        return parsed;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Store dashboard data in memory and sessionStorage tagged with the user's email.
 */
export function setCachedDashboardData(data, userEmail) {
  if (!data) return;
  const normEmail = userEmail ? String(userEmail).toLowerCase().trim() : null;
  const payload = {
    ...data,
    ...(normEmail ? { _userEmail: normEmail } : {}),
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
