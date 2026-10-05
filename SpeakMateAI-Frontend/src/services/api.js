import axios from "axios";

let logoutCallback = null;

export const setLogoutCallback = (cb) => {
  logoutCallback = cb;
};

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || "https://speakmate-ai-28z5.onrender.com").replace(/\/+$/, ""),
  timeout: 45000,
  headers: {
    "Content-Type": "application/json",
    "X-Client-Platform": "WEB",
  },
});

api.interceptors.request.use(
  (config) => {
    try {
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

      const token = localStorage.getItem("speakmate_token");
      if (token && token !== "null" && token !== "undefined") {
        config.headers.Authorization = `Bearer ${token}`;
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

    // Auto-retry on Render free-tier cold-start (502, 503, 504, timeout, or network disconnect)
    const isColdStart =
      !error.response ||
      error.code === "ECONNABORTED" ||
      status === 502 ||
      status === 503 ||
      status === 504;

    if (config && isColdStart && (!config._retryCount || config._retryCount < 2)) {
      config._retryCount = (config._retryCount || 0) + 1;
      console.warn(`[Axios] Render cold start retry #${config._retryCount} for ${config.url}...`);
      await new Promise((resolve) => setTimeout(resolve, 4000));
      return api(config);
    }

    let message = "Something went wrong. Please try again.";

    if (error.code === "ECONNABORTED") {
      message = "Request timed out. Check your connection and try again.";
    } else if (!error.response) {
      message = "Unable to connect to SpeakMate AI server. Please check your internet connection or verify the server status.";
    } else if (status === 401) {
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
