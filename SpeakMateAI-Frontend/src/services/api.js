import axios from "axios";
import tokenStorage from "./tokenStorage";

let logoutCallback = null;

export const setLogoutCallback = (cb) => {
  logoutCallback = cb;
};

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return "http://localhost:9091";
  }
  return "https://speakmate-ai-28z5.onrender.com";
};

const api = axios.create({
  baseURL: getBaseUrl().replace(/\/+$/, ""),
  timeout: 45000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Client-Platform": "WEB",
  },
});

api.interceptors.request.use(
  (config) => {
    try {
      const token = tokenStorage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        const expiresAtStr = localStorage.getItem("speakmate_session_expires_at");
        if (expiresAtStr) {
          const expiresAt = parseInt(expiresAtStr, 10);
          if (expiresAt && Date.now() >= expiresAt) {
            console.warn("[API] 24-hour web session expired. Triggering logout.");
            if (logoutCallback) {
              logoutCallback();
            }
            return Promise.reject(new Error("Your 24-hour session has expired. Please log in again."));
          }
        }
      }
    } catch (error) {
      console.error("Error setting authorization header:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const data = error.response?.data;

    // Determine if request is safe/idempotent to retry
    const method = (config?.method || "get").toLowerCase();
    const SAFE_METHODS = ["get", "head", "options"];
    const isSafeMethod = SAFE_METHODS.includes(method);

    // Explicit opt-in/opt-out via config.retry
    const isExplicitlyRetryable = config?.retry === true;
    const isExplicitlyDisabled = config?.retry === false;

    // Retries are permitted if explicitly allowed, or by default ONLY for safe methods.
    // Non-idempotent requests (POST, PUT, PATCH, DELETE) are NOT retried automatically
    // to prevent duplicate payments, duplicate AI messages, or duplicate database records.
    const canRetry = !isExplicitlyDisabled && (isExplicitlyRetryable || isSafeMethod);

    // Auto-retry on Render free-tier cold-start (502, 503, 504, timeout, or network disconnect)
    const isColdStart =
      !error.response ||
      error.code === "ECONNABORTED" ||
      status === 502 ||
      status === 503 ||
      status === 504;

    const maxRetries = typeof config?.maxRetries === "number" ? config.maxRetries : 2;
    const currentRetries = config?._retryCount || 0;

    if (config && isColdStart && canRetry && currentRetries < maxRetries) {
      config._retryCount = currentRetries + 1;
      console.warn(
        `[Axios] Render cold start retry #${config._retryCount}/${maxRetries} for safe request ${method.toUpperCase()} ${config.url}...`
      );
      await new Promise((resolve) => setTimeout(resolve, 4000));
      return api(config);
    }

    if (config && isColdStart && !canRetry && !isExplicitlyDisabled) {
      console.warn(
        `[Axios] Skipping automatic retry for non-idempotent ${method.toUpperCase()} ${config.url} to prevent duplicate side effects.`
      );
    }

    let message = "Something went wrong. Please try again.";

    if (error.code === "ECONNABORTED") {
      message = "Request timed out. Check your connection and try again.";
    } else if (!error.response) {
      message = "Unable to connect to SpeakMate AI server. Please check your internet connection or verify the server status.";
    } else if (status === 401) {
      tokenStorage.clearToken();
      message = data?.message || "Your session has expired. Please log in again.";
      if (logoutCallback) {
        logoutCallback();
      }
    } else if (status === 403) {
      message = data?.message || "You do not have permission to perform this action.";
    } else if (status >= 500) {
      message = data?.message || "Server error. Please try again later.";
    } else if (typeof data === "string") {
      message = data;
    } else if (data?.message) {
      message = data.message;
    }

    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;
