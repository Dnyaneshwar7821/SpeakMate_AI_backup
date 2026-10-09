import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authService } from "../services/authService";
import { subscriptionService } from "../services/appServices";
import api, { setLogoutCallback } from "../services/api";
import tokenStorage from "../services/tokenStorage";
import { syncBackendProgress } from "../utils/progressTracker";
import { EventBus, AVATAR_EVENTS } from "../services/live2d/EventBus";
import { resolveAvatarFromVoice } from "../utils/speechHelper";
import { captureCurrentUserPreferences, restoreUserPreferences } from "../utils/userPreferences";
import { resetActiveTutorCache, resolveCanonicalTutor, setCanonicalState, isTutorAvatarModel } from "../services/ActiveTutorService";

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  token: "speakmate_token",
  user: "speakmate_user",
  onboardingCompleted: "speakmate_onboarding_completed",
  sessionExpiresAt: "speakmate_session_expires_at",
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.user);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed?.avatar && isTutorAvatarModel(parsed.avatar)) {
        delete parsed.avatar;
      }
      return parsed;
    } catch { return null; }
  });
  const [token, setToken] = useState(() => tokenStorage.getToken() || null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true";
  });
  const [loading, setLoading] = useState(() => {
    try {
      const storedToken = tokenStorage.getToken();
      return !storedToken;
    } catch {
      return false;
    }
  });

  const [isPostLoginLoading, setIsPostLoginLoading] = useState(false);

  const userRef = useRef(user);
  const sessionRestoredRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const syncUserProfile = (userData) => {
    if (!userData) return;
    try {
      const isStudentUser = Boolean(
        (userData.accountType === "STUDENT" ||
        userData.isSchoolStudent ||
        userData.role === "STUDENT") &&
        userData.role !== "USER" &&
        userData.role !== "TEACHER" &&
        userData.role !== "SCHOOL_ADMIN" &&
        userData.role !== "ADMIN" &&
        userData.role !== "SUPER_ADMIN"
      );

      const effectiveAccountType = isStudentUser ? "STUDENT" : (userData.accountType || "INDIVIDUAL_USER");
      localStorage.setItem("speakmate_account_type", effectiveAccountType);

      const effectiveGrade = userData.schoolGrade || (userData.standard ? (userData.standard.toLowerCase().includes("std") ? userData.standard : `${userData.standard}th Std`) : null);
      if (effectiveGrade && isStudentUser) {
        localStorage.setItem("speakmate_school_grade", effectiveGrade);
      } else {
        localStorage.removeItem("speakmate_school_grade");
      }

      if (userData.standard && isStudentUser) {
        localStorage.setItem("speakmate_standard", userData.standard);
      } else {
        localStorage.removeItem("speakmate_standard");
      }

      if (userData.schoolCode && isStudentUser) {
        localStorage.setItem("speakmate_school_code", userData.schoolCode);
      } else if (!isStudentUser) {
        localStorage.removeItem("speakmate_school_code");
      }

      const cleanAge = typeof userData.ageGroup === "string" ? userData.ageGroup : (userData.ageGroup?.ageGroup || null);
      if (cleanAge) {
        localStorage.setItem("speakmate_age_group", cleanAge);
      }

      if (userData.englishLevel) {
        localStorage.setItem("speakmate_english_level", userData.englishLevel);
      }

      if (userData.preferredAccent) {
        localStorage.setItem("speakmate_voice_accent", userData.preferredAccent);
      }

      const voicePref = userData.preferredVoice || userData.aiVoice;
      if (voicePref) {
        const existingModel = userData.avatarModel || localStorage.getItem("speakmate_avatar_model") || "haru";
        const existingSource = userData.selectionSource || localStorage.getItem("speakmate_selection_source");
        const canonical = resolveCanonicalTutor(existingModel, voicePref, existingSource);
        setCanonicalState(canonical);
      }

      const goalMins = parseInt(userData.dailyGoalMinutes || userData.dailyGoal || userData.commitment, 10);
      if (goalMins && !isNaN(goalMins)) {
        localStorage.setItem("speakmate_daily_goal", String(goalMins));
      }

      if (cleanAge) {
        window.dispatchEvent(new CustomEvent("speakmate_age_group_changed", { detail: { ageGroup: cleanAge } }));
      }
      window.dispatchEvent(new CustomEvent("speakmate_settings_updated", { detail: { ...userData, ageGroup: cleanAge || userData.ageGroup } }));
    } catch (e) {
      console.warn("syncUserProfile warning:", e);
    }
  };

  const logout = useCallback(() => {
    sessionRestoredRef.current = false;
    try {
      let email = (userRef.current?.email || "").toLowerCase();
      if (!email) {
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.user);
          if (raw) {
            const parsed = JSON.parse(raw);
            email = (parsed?.email || "").toLowerCase();
          }
        } catch (_) {}
      }
      if (email) {
        captureCurrentUserPreferences(email);
      }

      tokenStorage.clearToken();
      api.post("/api/users/logout").catch(() => {});
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          key.startsWith("speakmate_") &&
          key !== "speakmate_admin_session" &&
          !key.startsWith("speakmate_user_prefs_") &&
          !key.startsWith("speakmate_onboarding_done_")
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // Clear all speakmate cache and assistant chat history in sessionStorage
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("speakmate_")) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
      resetActiveTutorCache();
    } catch (e) { }

    setToken(null);
    setUser(null);
    setOnboardingCompleted(false);
  }, []);

  useEffect(() => {
    setLogoutCallback(logout);
  }, [logout]);

  const restoreSession = useCallback(async () => {
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    try {
      setLoading(true);
      const expiresAtStr = localStorage.getItem(STORAGE_KEYS.sessionExpiresAt);
      if (expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (expiresAt && Date.now() >= expiresAt) {
          console.warn("[AuthContext] 24-hour web session expired on restore.");
          logout();
          setLoading(false);
          return;
        }
      }

      const storedToken = tokenStorage.getToken();
      const storedUser = localStorage.getItem(STORAGE_KEYS.user);
      const storedOnboardingCompleted = localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true";

      if (storedToken && storedToken !== "null" && storedToken !== "undefined") {
        setToken(storedToken);
        let parsedUser = null;
        if (storedUser) {
          try {
            parsedUser = JSON.parse(storedUser);
            if (parsedUser?.avatar && isTutorAvatarModel(parsedUser.avatar)) {
              delete parsedUser.avatar;
              localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(parsedUser));
            }
            if (parsedUser && parsedUser.email) {
              restoreUserPreferences(parsedUser.email);
            }
            setUser(parsedUser);
            syncUserProfile(parsedUser);
          } catch (e) { }
        }

        const me = await authService.me().catch(() => null);
        const activeUser = me || parsedUser;
        const userEmail = activeUser?.email || "";
        const isCompleted = Boolean(activeUser?.onboardingCompleted);

        if (activeUser) {
          const isStudent = Boolean(
            (activeUser?.isSchoolStudent ||
            activeUser?.accountType === "STUDENT" ||
            activeUser?.role === "STUDENT") &&
            activeUser?.role !== "USER" &&
            activeUser?.role !== "TEACHER" &&
            activeUser?.role !== "SCHOOL_ADMIN" &&
            activeUser?.role !== "ADMIN" &&
            activeUser?.role !== "SUPER_ADMIN"
          );

          const isPaidPlan = (plan) => Boolean(plan && plan.toUpperCase() !== "FREE");
          let isProUser = Boolean((activeUser?.isPro || activeUser?.pro) && isPaidPlan(activeUser?.subscriptionPlan));
          let subPlan = activeUser?.subscriptionPlan || "FREE";

          if (!isStudent) {
            try {
              const sub = await subscriptionService.getMySubscription().catch(() => null);
              if (sub) {
                const subIsPro = Boolean(sub.isPro === true || sub.pro === true || (sub.status === "ACTIVE" && isPaidPlan(sub.planType)));
                if (subIsPro) {
                  isProUser = true;
                  subPlan = sub.planType || "MONTHLY_PRO";
                } else {
                  isProUser = false;
                  subPlan = sub.planType || "FREE";
                }
              }
            } catch {
              // ignore
            }
          }

          const enrichedUser = {
            ...activeUser,
            isPro: !isStudent && isProUser,
            subscriptionPlan: subPlan,
          };

          setUser(enrichedUser);
          syncUserProfile(enrichedUser);
          localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(enrichedUser));
          try {
            syncBackendProgress(enrichedUser);
          } catch (_) {}
        }

        setOnboardingCompleted(isCompleted);
        if (isCompleted) {
          localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
        } else {
          localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
          if (userEmail) localStorage.removeItem(`speakmate_onboarding_done_${userEmail}`);
        }
      }
    } catch (error) {
      console.error("Session restore error:", error);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const lastRefreshRef = useRef(0);
  const refreshUserProfile = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 15000) return;
    lastRefreshRef.current = now;

    const currentToken = tokenStorage.getToken();
    if (!currentToken || currentToken === "null" || currentToken === "undefined") return;
    try {
      const me = await authService.me().catch(() => null);
      if (me) {
        setUser((prev) => {
          if (!prev) return me;
          if (
            prev.ageGroup !== me.ageGroup ||
            prev.schoolGrade !== me.schoolGrade ||
            prev.englishLevel !== me.englishLevel ||
            prev.accountType !== me.accountType ||
            prev.avatar !== me.avatar
          ) {
            const next = { ...prev, ...me };
            syncUserProfile(next);
            localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
            return next;
          }
          return prev;
        });
      }
    } catch { }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!token) return;

    const checkExpiration = () => {
      const expiresAtStr = localStorage.getItem(STORAGE_KEYS.sessionExpiresAt);
      if (expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (expiresAt && Date.now() >= expiresAt) {
          console.warn("[AuthContext] 24-hour web session expired. Logging out.");
          logout();
          return true;
        }
      }
      return false;
    };

    if (checkExpiration()) return;

    let timer = null;
    const expiresAtStr = localStorage.getItem(STORAGE_KEYS.sessionExpiresAt);
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      const remaining = expiresAt - Date.now();
      if (remaining > 0) {
        timer = setTimeout(() => {
          console.warn("[AuthContext] 24 hours reached. Session expired.");
          logout();
        }, remaining);
      } else {
        logout();
        return;
      }
    }

    const handleSync = () => {
      if (checkExpiration()) return;
      if (document.visibilityState === "visible") {
        refreshUserProfile();
      }
    };
    window.addEventListener("focus", handleSync);
    window.addEventListener("visibilitychange", handleSync);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("visibilitychange", handleSync);
    };
  }, [token, refreshUserProfile, logout]);

  const login = async (credentials) => {
    try {
      try {
        const sessionKeys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (
            k &&
            (k.startsWith("speakmate_dashboard_") ||
              k.startsWith("speakmate_assistant_") ||
              k === "speakmate_chat_history_cache")
          ) {
            sessionKeys.push(k);
          }
        }
        sessionKeys.forEach((k) => sessionStorage.removeItem(k));
      } catch (_) {}
      const response = await authService.login(credentials);
      if (response && response.token) {
        tokenStorage.setToken(response.token);
        sessionRestoredRef.current = true;
        setToken(response.token);
        if (response.user) {
          const userEmail = (response.user?.email || credentials.email || "").toLowerCase();
          if (userEmail) {
            restoreUserPreferences(userEmail);
          }

          syncUserProfile(response.user);
          localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user));
          setUser(response.user);
          try {
            syncBackendProgress(response.user);
          } catch (_) {}
          const isDone = Boolean(response.user?.onboardingCompleted);

          setOnboardingCompleted(isDone);
          if (isDone) {
            localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
            if (userEmail) localStorage.setItem(`speakmate_onboarding_done_${userEmail}`, "true");
          } else {
            localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
            if (userEmail) localStorage.removeItem(`speakmate_onboarding_done_${userEmail}`);
          }
        }
      }
      return response;
    } catch (error) {
      console.error("AuthContext login error:", error);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      if (response && response.token) {
        tokenStorage.setToken(response.token);
        setToken(response.token);
        if (response.user) {
          syncUserProfile(response.user);
          localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user));
          setUser(response.user);
          setOnboardingCompleted(false);
          localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
          const regEmail = (response.user?.email || userData.email || "").toLowerCase();
          if (regEmail) localStorage.removeItem(`speakmate_onboarding_done_${regEmail}`);
        }
      }
      return response;
    } catch (error) {
      console.error("AuthContext register error:", error);
      throw error;
    }
  };

  const completeOnboarding = async (onboardingData) => {
    try {
      const updatedBackendUser = await authService.completeOnboarding(onboardingData).catch((err) => {
        console.warn("Backend completeOnboarding call failed:", err);
        return null;
      });

      localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      if (user?.email) {
        localStorage.setItem(`speakmate_onboarding_done_${user.email.toLowerCase()}`, "true");
      }
      setOnboardingCompleted(true);
      const updatedUser = { 
        ...(user || {}), 
        ...(onboardingData || {}), 
        ...(updatedBackendUser || {}), 
        onboardingCompleted: true 
      };
      setUser(updatedUser);
      syncUserProfile(updatedUser);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Complete onboarding error:", error);
    }
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const sanitized = { ...updatedFields };
      if (sanitized.avatar && isTutorAvatarModel(sanitized.avatar)) {
        delete sanitized.avatar;
      }
      const updated = { ...prev, ...sanitized };
      syncUserProfile(updated);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated));
      return updated;
    });
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      onboardingCompleted,
      loading,
      isPostLoginLoading,
      setIsPostLoginLoading,
      login,
      register,
      logout,
      completeOnboarding,
      updateUser,
    }),
    [user, token, onboardingCompleted, loading, logout, isPostLoginLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
