import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { authService } from "../services/authService";
import { setLogoutCallback, setAuthToken, clearAuthToken } from "../api/api";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { DashboardCache, CurriculumCache } from "../utils/dashboardCache";
import { normalizeGradeKey } from "../constants/masterCurriculum";
import { dashboardService } from "../services/appServices";
import { subscriptionService } from "../services/subscriptionService";
import { setCachedAvatarModel, resolveAvatarFromVoice } from "../config/AvatarCatalog";
import {
  getUserPreferences,
  applyUserPreferences,
  captureCurrentUserPreferences,
} from "../utils/userPreferences";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [welcomeCompleted, setWelcomeCompletedState] = useState(false);
  const [onboardingCompleted, setOnboardingCompletedState] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncUserProfile = useCallback(async (userData) => {
    if (!userData) return;
    try {
      // 1. Rehydrate all user preferences (avatar, voice, speech rate, theme, module state)
      const email = (userData.email || "").toLowerCase().trim();
      if (email) {
        const savedPrefs = await getUserPreferences(email);
        if (savedPrefs) {
          await applyUserPreferences(savedPrefs);
        }
      }

      const rawGrd = userData.schoolGrade || userData.standard || userData.grade;
      if (rawGrd) {
        const normalized = typeof normalizeGradeKey === 'function' ? normalizeGradeKey(rawGrd) : String(rawGrd);
        await AsyncStorage.setItem('speakmate_school_grade', normalized);
        if (CurriculumCache && typeof CurriculumCache.setGrade === 'function') {
          CurriculumCache.setGrade(normalized);
        }
      } else if (userData.accountType !== "STUDENT" && !userData.isSchoolStudent) {
        await AsyncStorage.removeItem('speakmate_school_grade');
      }
      if (userData.ageGroup) {
        await AsyncStorage.setItem('speakmate_age_group', userData.ageGroup);
        if (CurriculumCache && typeof CurriculumCache.setAgeGroup === 'function') {
          CurriculumCache.setAgeGroup(userData.ageGroup);
        }
      }
      if (userData.englishLevel) {
        await AsyncStorage.setItem('speakmate_english_level', userData.englishLevel);
      }
      if (userData.accountType) {
        await AsyncStorage.setItem('speakmate_account_type', userData.accountType);
        if (CurriculumCache && typeof CurriculumCache.setAccountType === 'function') {
          CurriculumCache.setAccountType(userData.accountType);
        }
      }
      if (userData.preferredAccent) {
        await AsyncStorage.setItem('speakmate_voice_accent', userData.preferredAccent);
      }
      const voicePref = userData.aiVoice || userData.preferredVoice;
      if (voicePref) {
        await AsyncStorage.setItem('speakmate_ai_voice', voicePref);
        await AsyncStorage.setItem('speakmate_selected_voice', voicePref);
        await AsyncStorage.setItem('speakmate_voice_code', voicePref);

        // Derive and restore avatar model + gender ONLY if no existing model
        const existingModel = await AsyncStorage.getItem('speakmate_avatar_model');
        if (!existingModel) {
          const resolved = resolveAvatarFromVoice(voicePref);
          await AsyncStorage.setItem('speakmate_avatar_model', resolved.model);
          await AsyncStorage.setItem('speakmate_voice_gender', resolved.gender);
          setCachedAvatarModel(resolved.model);
        } else {
          setCachedAvatarModel(existingModel);
        }
      } else {
        const existingModel = await AsyncStorage.getItem('speakmate_avatar_model');
        if (existingModel) {
          setCachedAvatarModel(existingModel);
        }
      }
    } catch (e) {
      console.warn("Mobile syncUserProfile warning:", e);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      setLoading(true);
      const [storedToken, storedUser, storedWelcome, storedOnboarding] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.token),
        AsyncStorage.getItem(STORAGE_KEYS.user),
        AsyncStorage.getItem(STORAGE_KEYS.welcomeCompleted),
        AsyncStorage.getItem(STORAGE_KEYS.onboardingCompleted),
      ]);

      if (storedToken && storedToken !== "null" && storedToken !== "undefined" && storedUser) {
        setAuthToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        let me = null;
        try {
          me = await authService.me();
        } catch (authErr) {
          if (authErr?.response?.status === 401) {
            await SecureStore.deleteItemAsync(STORAGE_KEYS.token).catch(() => {});
            await AsyncStorage.removeItem(STORAGE_KEYS.user).catch(() => {});
            await AsyncStorage.removeItem(STORAGE_KEYS.onboardingCompleted).catch(() => {});
            clearAuthToken();
            setToken(null);
            setUser(null);
            setOnboardingCompletedState(false);
            setIsAuthenticated(false);
            setWelcomeCompletedState(storedWelcome === "true");
            return {
              isAuthenticated: false,
              welcomeCompleted: storedWelcome === "true",
              onboardingCompleted: false,
            };
          }
          me = null;
        }
        const activeUser = me || parsedUser;
        const userEmail = (activeUser?.email || "").toLowerCase();
        
        const isCompleted = Boolean(activeUser?.onboardingCompleted === true);
        const nextOnboardingCompleted = Boolean(isCompleted);

        if (!isCompleted) {
          await AsyncStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
          if (userEmail) await AsyncStorage.removeItem(`speakmate_onboarding_${userEmail}`);
        }

        const isStudent = Boolean(
          activeUser?.isSchoolStudent ||
          activeUser?.accountType === "STUDENT" ||
          activeUser?.role === "STUDENT" ||
          activeUser?.schoolId
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

        await syncUserProfile(enrichedUser);

        // Await all disk writes first
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(enrichedUser)),
          AsyncStorage.setItem(STORAGE_KEYS.welcomeCompleted, "true"),
          AsyncStorage.setItem(STORAGE_KEYS.onboardingCompleted, String(nextOnboardingCompleted)),
          userEmail && nextOnboardingCompleted
            ? AsyncStorage.setItem(`speakmate_onboarding_${userEmail}`, "true")
            : Promise.resolve(),
        ]);

        // Hydrate DashboardCache from disk immediately (0ms) and trigger background sync without blocking startup
        if (nextOnboardingCompleted && enrichedUser) {
          const userId = enrichedUser.id || enrichedUser._id;
          try {
            await DashboardCache.init(userId);
            dashboardService.summary().then((freshData) => {
              if (freshData) {
                DashboardCache.set(freshData, userId);
              }
            }).catch(() => {});
          } catch (e) {
            console.warn("Mobile restoreSession dashboard init note:", e);
          }
        }

        // Batch all state updates together synchronously (no async gap)
        setToken(storedToken);
        setUser(enrichedUser);
        setWelcomeCompletedState(true);
        setOnboardingCompletedState(nextOnboardingCompleted);
        setIsAuthenticated(true);
      } else {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
        await AsyncStorage.removeItem(STORAGE_KEYS.user);
        await AsyncStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
        setWelcomeCompletedState(storedWelcome === "true");
        setOnboardingCompletedState(false);
        setIsAuthenticated(false);
      }
      return {
        isAuthenticated: Boolean(storedToken && storedUser),
        welcomeCompleted: true,
        onboardingCompleted: false,
      };
    } catch (error) {
      const storedWelcome = await AsyncStorage.getItem(STORAGE_KEYS.welcomeCompleted);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
      await AsyncStorage.removeItem(STORAGE_KEYS.user);
      await AsyncStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setWelcomeCompletedState(storedWelcome === "true");
      setOnboardingCompletedState(false);
      return {
        isAuthenticated: false,
        welcomeCompleted: storedWelcome === "true",
        onboardingCompleted: false,
      };
    } finally {
      setLoading(false);
    }
  }, [syncUserProfile]);


  const refreshUserProfile = useCallback(async () => {
    if (!token) return;
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
            AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
            return next;
          }
          return prev;
        });
      }
    } catch {}
  }, [token, syncUserProfile]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!token) return;
    const onChange = (state) => {
      if (state === "active") {
        refreshUserProfile();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [token, refreshUserProfile]);

  const logout = useCallback(async () => {
    try {
      clearAuthToken();
      DashboardCache.clearMemory();

      let email = (user?.email || "").toLowerCase().trim();
      if (!email) {
        try {
          const rawStored = await AsyncStorage.getItem(STORAGE_KEYS.user);
          if (rawStored) email = (JSON.parse(rawStored)?.email || "").toLowerCase().trim();
        } catch (_) {}
      }
      if (email) {
        await captureCurrentUserPreferences(email);
      }

      await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
      await AsyncStorage.removeItem(STORAGE_KEYS.user);
      await AsyncStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
      if (email) {
        await AsyncStorage.removeItem(`speakmate_onboarding_${email}`);
      }

      // Remove all user-specific settings so next account is 100% clean
      const userSpecificKeys = [
        'speakmate_school_grade',
        'speakmate_age_group',
        'speakmate_english_level',
        'speakmate_account_type',
        'speakmate_ai_voice',
        'speakmate_avatar_model',
        'speakmate_selected_voice',
        'speakmate_voice_code',
        'speakmate_voice_gender',
        'speakmate_voice_pitch',
        'speakmate_completed_standard_lessons',
      ];
      await AsyncStorage.multiRemove(userSpecificKeys).catch(() => {});

      // Clear all assistant chatbot conversation history & sessions so next login is 100% fresh
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const assistantKeys = allKeys.filter(
          (key) => key && key.startsWith('speakmate_assistant_')
        );
        if (assistantKeys.length > 0) {
          await AsyncStorage.multiRemove(assistantKeys);
        }
      } catch (_) {}

      setCachedAvatarModel(null);
      setToken(null);
      setUser(null);
      setOnboardingCompletedState(false);
      setIsAuthenticated(false);
    } catch (error) {
    }
  }, [user]);

  useEffect(() => {
    setLogoutCallback(logout);
  }, [logout]);

  const persistAuth = useCallback(async (newToken, userData) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.token, newToken);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  }, []);

  const login = useCallback(
    async (credentials) => {
      try {
        const response = await authService.login(credentials);
        DashboardCache.clearMemory();
        setAuthToken(response.token);
        const userEmail = (response.user?.email || credentials.email || "").toLowerCase();
        const isCompleted = Boolean(response.user?.onboardingCompleted === true);
        const nextOnboardingCompleted = Boolean(isCompleted);

        // Await all disk writes first
        await Promise.all([
          SecureStore.setItemAsync(STORAGE_KEYS.token, response.token),
          AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user)),
          AsyncStorage.setItem(STORAGE_KEYS.welcomeCompleted, "true"),
          AsyncStorage.setItem(STORAGE_KEYS.onboardingCompleted, String(nextOnboardingCompleted)),
          userEmail && nextOnboardingCompleted
            ? AsyncStorage.setItem(`speakmate_onboarding_${userEmail}`, "true")
            : (userEmail && !nextOnboardingCompleted ? AsyncStorage.removeItem(`speakmate_onboarding_${userEmail}`) : Promise.resolve()),
        ]);

        await syncUserProfile(response.user);

        // Hydrate DashboardCache and fetch fresh summary BEFORE entering dashboard
        if (nextOnboardingCompleted && response.user) {
          const userId = response.user.id || response.user._id;
          try {
            // 1. Immediately hydrate from disk if cache exists (0ms)
            const diskCached = await DashboardCache.init(userId);

            // 2. Fetch fresh updated summary so entering the dashboard shows 100% updated data right away
            const freshPromise = dashboardService.summary();
            const timeoutPromise = new Promise((resolve) =>
              setTimeout(() => resolve(null), diskCached ? 1800 : 3500)
            );
            const freshData = await Promise.race([freshPromise, timeoutPromise]);
            if (freshData) {
              DashboardCache.set(freshData, userId);
            }
          } catch (e) {
            console.warn("Mobile dashboard login sync note:", e);
          }
        }

        // Synchronous batch update in the exact same microtask:
        setToken(response.token);
        setUser(response.user);
        setWelcomeCompletedState(true);
        setOnboardingCompletedState(nextOnboardingCompleted);
        setIsAuthenticated(true);

        return response;
      } catch (error) {
        throw error;
      }
    },
    [syncUserProfile],
  );

  const register = useCallback(
    async (payload) => {
      try {
        const response = await authService.register(payload);
        if (response && response.token) {
          DashboardCache.clearMemory();
          setAuthToken(response.token);
          const userEmail = (response.user?.email || payload.email || "").toLowerCase();
          const isCompleted = Boolean(
            response.user?.onboardingCompleted === true
          );

          await Promise.all([
            SecureStore.setItemAsync(STORAGE_KEYS.token, response.token),
            AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user)),
            AsyncStorage.setItem(STORAGE_KEYS.welcomeCompleted, "true"),
            AsyncStorage.setItem(STORAGE_KEYS.onboardingCompleted, String(isCompleted)),
            userEmail ? AsyncStorage.removeItem(`speakmate_onboarding_${userEmail}`) : Promise.resolve(),
          ]);

          setToken(response.token);
          setUser(response.user);
          setWelcomeCompletedState(true);
          setOnboardingCompletedState(isCompleted);
          setIsAuthenticated(true);
        }
        return response;
      } catch (error) {
        throw error;
      }
    },
    [],
  );

  const completeOnboarding = useCallback(async (onboardingData) => {
    const userEmail = (user?.email || "").toLowerCase();
    await Promise.all([
      userEmail ? AsyncStorage.setItem(`speakmate_onboarding_${userEmail}`, "true") : Promise.resolve(),
      AsyncStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true"),
      AsyncStorage.setItem(STORAGE_KEYS.welcomeCompleted, "true"),
    ]);
    const updatedUser = {
      ...(user || {}),
      ...(onboardingData || {}),
      onboardingCompleted: true,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updatedUser));
    setUser(updatedUser);
    setWelcomeCompletedState(true);
    setOnboardingCompletedState(true);
  }, [user]);

  const completeWelcome = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.welcomeCompleted, "true");
    setWelcomeCompletedState(true);
  }, []);

  const updateUser = useCallback(async (updatedUserData) => {
    setUser((curr) => {
      const next = { ...(curr || {}), ...updatedUserData };
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
      syncUserProfile(next);
      return next;
    });
  }, [syncUserProfile]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      welcomeCompleted,
      onboardingCompleted,
      user,
      token,
      loading,
      login,
      register,
      logout,
      restoreSession,
      completeWelcome,
      completeOnboarding,
      updateUser,
    }),
    [
      isAuthenticated,
      welcomeCompleted,
      onboardingCompleted,
      user,
      token,
      loading,
      login,
      register,
      logout,
      restoreSession,
      completeWelcome,
      completeOnboarding,
      updateUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

