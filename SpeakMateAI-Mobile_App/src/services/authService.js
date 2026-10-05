import api from "../api/api";
import { normalizeEmail } from "../utils/validation";

const sanitizePayloadEmail = (payload) => {
  if (!payload) return payload;
  if (typeof payload === "string") {
    return normalizeEmail(payload);
  }
  if (typeof payload === "object" && "email" in payload) {
    return {
      ...payload,
      email: normalizeEmail(payload.email),
    };
  }
  return payload;
};

export const authService = {
  login: async (payload) => {
    const data = sanitizePayloadEmail(payload);
    const response = await api.post("/api/users/login", {
      ...data,
      clientType: "MOBILE",
    });
    return response.data;
  },

  register: async (payload) => {
    const data = sanitizePayloadEmail(payload);
    const response = await api.post("/api/users/register", data);
    return response.data;
  },

  sendRegistrationOtp: async (payload) => {
    const rawData = typeof payload === "string" ? { email: payload } : payload;
    const data = sanitizePayloadEmail(rawData);
    const response = await api.post("/api/users/send-registration-otp", data);
    return response.data;
  },

  verifyRegistrationOtp: async (payload) => {
    const data = sanitizePayloadEmail(payload);
    const response = await api.post("/api/users/verify-registration-otp", data);
    return response.data;
  },

  me: async () => {
    const response = await api.get("/api/users/me");
    return response.data;
  },

  forgotPassword: async (payload) => {
    const rawData = typeof payload === "string" ? { email: payload } : payload;
    const data = sanitizePayloadEmail(rawData);
    const response = await api.post("/api/users/forgot-password", data);
    return response.data;
  },

  verifyOtp: async (payload, otp) => {
    const rawData = typeof payload === "string" ? { email: payload, otp } : payload;
    const data = sanitizePayloadEmail(rawData);
    const response = await api.post("/api/users/verify-otp", data);
    return response.data;
  },

  resetPassword: async (payload, newPassword) => {
    const data = typeof payload === "string" ? { token: payload, newPassword } : payload;
    const response = await api.post("/api/users/reset-password", data);
    return response.data;
  },

  sendDeleteAccountOtp: async (payload) => {
    const rawData = typeof payload === "string" ? { email: payload } : payload;
    const data = sanitizePayloadEmail(rawData);
    const response = await api.post("/api/users/send-delete-account-otp", data);
    return response.data;
  },

  verifyDeleteAccountOtp: async (payload) => {
    const data = sanitizePayloadEmail(payload);
    const response = await api.post("/api/users/verify-delete-account-otp", data);
    return response.data;
  },

  deleteAccount: async (payload) => {
    const data = sanitizePayloadEmail(payload);
    const response = await api.post("/api/users/delete-account", data);
    return response.data;
  },
};

