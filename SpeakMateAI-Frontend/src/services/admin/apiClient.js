import axios from "axios";

const getSessionToken = () => {
  try {
    const sessionStr = localStorage.getItem("speakmate_admin_session");
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      return session.token;
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
  baseURL: getBaseUrl().replace(/\/+$/, ""),
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getSessionToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
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
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        // Clear session on 401 to prevent authorization loops
        localStorage.removeItem("speakmate_admin_session");
        
        // Redirect to appropriate login page based on the active path scope
        const path = window.location.pathname;
        if (path.startsWith("/school-admin") && !path.endsWith("/login")) {
          window.location.href = "/school-admin/login";
        } else if (path.startsWith("/teacher") && !path.endsWith("/login")) {
          window.location.href = "/teacher/login";
        } else if (path.startsWith("/admin") && !path.endsWith("/login")) {
          window.location.href = "/admin/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
