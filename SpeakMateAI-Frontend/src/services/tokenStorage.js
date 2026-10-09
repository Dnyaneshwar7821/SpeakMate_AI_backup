/**
 * SpeakMate AI - Secure Token Storage Service
 *
 * Centralized, defensive token storage abstraction.
 * - Stores active JWT in an in-memory runtime variable so memory-based access is fast and isolated.
 * - Manages session expiry (24-hour web session lifetime limit) matching security policies.
 * - Provides fallback persistence across page refreshes with integrity validation.
 * - Exposes clean getters, setters, and clearing functions for api client and AuthContext.
 */

const TOKEN_KEY = "speakmate_token";
const SESSION_EXPIRES_KEY = "speakmate_session_expires_at";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

let inMemoryToken = null;

const isValidTokenString = (token) => {
  return typeof token === "string" && token.trim().length > 0 && token !== "null" && token !== "undefined";
};

const isSessionExpired = () => {
  if (typeof window === "undefined") return false;
  try {
    const expiresAtStr = localStorage.getItem(SESSION_EXPIRES_KEY);
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (expiresAt && Date.now() >= expiresAt) {
        return true;
      }
    }
  } catch (_) {}
  return false;
};

// Initialize in-memory token from storage on module load
const initMemoryToken = () => {
  if (typeof window === "undefined") return null;
  try {
    if (isSessionExpired()) {
      tokenStorage.clearToken();
      return null;
    }
    const stored = localStorage.getItem(TOKEN_KEY);
    if (isValidTokenString(stored)) {
      inMemoryToken = stored.trim();
      return inMemoryToken;
    }
  } catch (_) {}
  return null;
};

export const tokenStorage = {
  /**
   * Retrieves the current access token.
   * Checks in-memory cache first, then validates storage and expiration.
   */
  getToken: () => {
    if (isSessionExpired()) {
      tokenStorage.clearToken();
      return null;
    }
    if (isValidTokenString(inMemoryToken)) {
      return inMemoryToken;
    }
    return initMemoryToken();
  },

  /**
   * Stores the access token in memory and local storage with a 24-hour expiry.
   */
  setToken: (token) => {
    if (!isValidTokenString(token)) {
      tokenStorage.clearToken();
      return;
    }
    const cleanToken = token.trim();
    inMemoryToken = cleanToken;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(TOKEN_KEY, cleanToken);
      const expiresAt = Date.now() + TWENTY_FOUR_HOURS_MS;
      localStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt));
    } catch (_) {}
  },

  /**
   * Clears the access token from both in-memory cache and storage.
   */
  clearToken: () => {
    inMemoryToken = null;
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_EXPIRES_KEY);
    } catch (_) {}
  },

  /**
   * Checks if an active token is present and valid.
   */
  hasToken: () => {
    return Boolean(tokenStorage.getToken());
  },
};

initMemoryToken();

export default tokenStorage;
