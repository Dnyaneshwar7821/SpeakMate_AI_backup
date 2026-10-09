import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../utils/storageKeys';
import { BASE_URL } from '../constants/config';

let logoutCallback = null;
let cachedAuthToken = null;

export const setLogoutCallback = (cb) => {
  logoutCallback = cb;
};

export const setAuthToken = (token) => {
  cachedAuthToken = token && token !== 'null' && token !== 'undefined' ? token : null;
};

export const clearAuthToken = () => {
  cachedAuthToken = null;
};

export const getAuthToken = () => cachedAuthToken;

const api = axios.create({
  baseURL: BASE_URL || 'https://speakmate-ai-28z5.onrender.com',
  timeout: 120000, // 120s to allow Render free-tier cold starts
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'MOBILE',
  },
});

if (__DEV__) {
  console.log('[API Client baseURL]:', BASE_URL);
}

api.interceptors.request.use(
  async (config) => {
    try {
      let token = cachedAuthToken;
      if (!token) {
        token = await SecureStore.getItemAsync(STORAGE_KEYS.token);
        if (token && token !== 'null' && token !== 'undefined') {
          cachedAuthToken = token;
        } else {
          token = null;
        }
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Error fetching token for request:', error?.message);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error.response?.status;

    // Background endpoints that fail gracefully without error logs
    const isBackgroundEndpoint = config?.url && (
      config.url.includes('/register-expo-url') ||
      config.url.includes('/count-unread') ||
      config.url.includes('/push-token') ||
      config.url.includes('/api/v1/')
    );

    // Determine if request is safe/idempotent to retry
    const method = (config?.method || 'get').toLowerCase();
    const SAFE_METHODS = ['get', 'head', 'options'];
    const isSafeMethod = SAFE_METHODS.includes(method);

    const isExplicitlyRetryable = config?.retry === true;
    const isExplicitlyDisabled = config?.retry === false;
    const canRetry = !isExplicitlyDisabled && (isExplicitlyRetryable || isSafeMethod);

    // Retry on network timeout, connection error, or Render free-tier cold starts (502, 503, 504)
    const isColdStartOrNetwork =
      !error.response ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error' ||
      status === 502 ||
      status === 503 ||
      status === 504;

    if (config && isColdStartOrNetwork && canRetry && (!config._retryCount || config._retryCount < 2)) {
      config._retryCount = (config._retryCount || 0) + 1;
      if (!isBackgroundEndpoint) {
        console.warn(`[Axios] Render cold start / gateway wakeup retry #${config._retryCount} for safe ${method.toUpperCase()} (${config.url})...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 4000));
      return api(config);
    }

    if (config && isColdStartOrNetwork && !canRetry && !isExplicitlyDisabled && !isBackgroundEndpoint) {
      console.warn(`[Axios] Skipping automatic retry for non-idempotent ${method.toUpperCase()} ${config.url} to prevent duplicate side effects.`);
    }

    if (status === 401) {
      cachedAuthToken = null;
      try {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
      } catch (_) {}
      if (logoutCallback) {
        logoutCallback();
      }
    } else if (!isBackgroundEndpoint && status !== 404) {
      const errorMsg = error.response?.data?.message || (typeof error.response?.data === 'string' ? error.response?.data : JSON.stringify(error.response?.data));
      console.warn(`[Axios Error] ${config?.method?.toUpperCase()} ${config?.url} (${status || error.code || 'ERR_NETWORK'}): ${errorMsg || ''}`);
    }

    return Promise.reject(error);
  }
);

export default api;
