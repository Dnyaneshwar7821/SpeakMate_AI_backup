import api from "./api";

export const authService = {
  login: async (payload) => {
    const data = typeof payload === "object" ? { ...payload, clientType: "WEB" } : payload;
    const response = await api.post("/api/users/login", data);
    return response.data;
  },

  register: async (payload) => {
    const response = await api.post("/api/users/register", payload);
    return response.data;
  },

  sendRegistrationOtp: async (payload) => {
    const response = await api.post("/api/users/send-registration-otp", payload);
    return response.data;
  },

  verifyRegistrationOtp: async (payload) => {
    const response = await api.post("/api/users/verify-registration-otp", payload);
    return response.data;
  },

  me: async () => {
    const response = await api.get("/api/users/me", { timeout: 10000 });
    return response.data;
  },

  completeOnboarding: async (payload) => {
    const response = await api.post("/api/users/complete-onboarding", payload);
    return response.data;
  },

  forgotPassword: async (payload) => {
    const data = typeof payload === "string" ? { email: payload } : payload;
    const response = await api.post("/api/users/forgot-password", data);
    return response.data;
  },

  verifyOtp: async (payload, otp) => {
    const data = typeof payload === "string" ? { email: payload, otp } : payload;
    const response = await api.post("/api/users/verify-otp", data);
    return response.data;
  },

  resetPassword: async (payload, newPassword) => {
    const data = typeof payload === "string" ? { token: payload, newPassword } : payload;
    const response = await api.post("/api/users/reset-password", data);
    return response.data;
  },

  sendDeleteAccountOtp: async (payload) => {
    const data = typeof payload === "string" ? { email: payload } : payload;
    const response = await api.post("/api/users/send-delete-account-otp", data);
    return response.data;
  },

  deleteAccount: async (payload) => {
    const response = await api.post("/api/users/delete-account", payload);
    return response.data;
  },
};

export default authService;
