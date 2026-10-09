import axios from "axios";

const getSessionToken = (activeRole) => {
  try {
    // If explicitly student or user, use learner token
    if (activeRole === "STUDENT" || activeRole === "USER") {
      const token = localStorage.getItem("speakmate_token");
      if (token && token !== "null" && token !== "undefined") {
        return token;
      }
    }

    // If explicitly admin role, use admin session token
    if (activeRole === "SUPER_ADMIN" || activeRole === "SCHOOL_ADMIN" || activeRole === "TEACHER") {
      const sessionStr = localStorage.getItem("speakmate_admin_session");
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.token) {
          return session.token;
        }
      }
    }

    // Fallback: Check admin session first, then student token
    const sessionStr = localStorage.getItem("speakmate_admin_session");
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session && session.token) {
        return session.token;
      }
    }
    const token = localStorage.getItem("speakmate_token");
    if (token && token !== "null" && token !== "undefined") {
      return token;
    }
  } catch (e) {
    console.error("Error reading session token", e);
  }
  return null;
};

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return "https://speakmate-ai-28z5.onrender.com";
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 65000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // Note: X-Assistant-Role is an internal client hint used strictly to select the appropriate
    // localStorage token (learner vs admin) when both exist. The header is stripped before sending.
    // The backend is the sole authority: it resolves identity and permissions via the validated JWT / session cookie.
    const activeRole = config.headers["X-Assistant-Role"];
    const token = getSessionToken(activeRole);
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    if (config.headers["X-Assistant-Role"]) {
      delete config.headers["X-Assistant-Role"];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
