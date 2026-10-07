const PREFS_PREFIX = "speakmate_user_prefs_";

export const getUserPreferences = (email) => {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(`${PREFS_PREFIX}${email.toLowerCase().trim()}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveUserPreferences = (email, updates) => {
  if (!email || !updates) return null;
  try {
    const key = `${PREFS_PREFIX}${email.toLowerCase().trim()}`;
    const existing = getUserPreferences(email) || {};
    const merged = { ...existing, ...updates, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn("Failed to save user preferences:", err);
    return null;
  }
};

export const captureCurrentUserPreferences = (email) => {
  if (!email) return null;
  const prefs = {
    avatarModel: localStorage.getItem("speakmate_avatar_model"),
    voiceGender: localStorage.getItem("speakmate_voice_gender"),
    preferredVoice: localStorage.getItem("speakmate_preferred_voice") || localStorage.getItem("speakmate_ai_voice") || localStorage.getItem("speakmate_selected_voice"),
    selectedVoice: localStorage.getItem("speakmate_selected_voice"),
    voiceCode: localStorage.getItem("speakmate_voice_code"),
    voicePitch: localStorage.getItem("speakmate_voice_pitch"),
    speakingRate: localStorage.getItem("speakmate_speaking_rate"),
    autoplayAudio: localStorage.getItem("speakmate_autoplay_audio"),
    soundEffects: localStorage.getItem("speakmate_sound_effects"),
    theme: localStorage.getItem("speakmate_theme"),
    themeExplicit: localStorage.getItem("speakmate_theme_explicit"),
    dailyGoal: localStorage.getItem("speakmate_daily_goal"),
    ageGroup: localStorage.getItem("speakmate_age_group"),
    schoolGrade: localStorage.getItem("speakmate_school_grade"),
    standard: localStorage.getItem("speakmate_standard"),
    accountType: localStorage.getItem("speakmate_account_type"),
    englishLevel: localStorage.getItem("speakmate_english_level"),
    accent: localStorage.getItem("speakmate_voice_accent") || localStorage.getItem("speakmate_accent"),
    lastSpeakingCategory: localStorage.getItem("speakmate_last_speaking_category"),
    lastSpeakingGrade: localStorage.getItem("speakmate_last_speaking_grade"),
    lastLessonId: localStorage.getItem("speakmate_last_lesson_id"),
  };
  return saveUserPreferences(email, prefs);
};

export const applyUserPreferences = (prefs) => {
  if (!prefs || typeof prefs !== "object") return;
  if (prefs.avatarModel) localStorage.setItem("speakmate_avatar_model", prefs.avatarModel);
  if (prefs.voiceGender) localStorage.setItem("speakmate_voice_gender", prefs.voiceGender);
  if (prefs.preferredVoice) {
    localStorage.setItem("speakmate_preferred_voice", prefs.preferredVoice);
    localStorage.setItem("speakmate_ai_voice", prefs.preferredVoice);
  }
  if (prefs.selectedVoice) localStorage.setItem("speakmate_selected_voice", prefs.selectedVoice);
  if (prefs.voiceCode) localStorage.setItem("speakmate_voice_code", prefs.voiceCode);
  if (prefs.voicePitch) localStorage.setItem("speakmate_voice_pitch", String(prefs.voicePitch));
  if (prefs.speakingRate) localStorage.setItem("speakmate_speaking_rate", prefs.speakingRate);
  if (prefs.autoplayAudio !== undefined && prefs.autoplayAudio !== null) {
    localStorage.setItem("speakmate_autoplay_audio", String(prefs.autoplayAudio));
  }
  if (prefs.soundEffects !== undefined && prefs.soundEffects !== null) {
    localStorage.setItem("speakmate_sound_effects", String(prefs.soundEffects));
  }
  if (prefs.themeExplicit) {
    localStorage.setItem("speakmate_theme_explicit", prefs.themeExplicit);
  }
  if (prefs.theme) {
    localStorage.setItem("speakmate_theme", prefs.theme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", prefs.theme);
      if (prefs.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }
  if (prefs.dailyGoal) localStorage.setItem("speakmate_daily_goal", String(prefs.dailyGoal));
  if (prefs.ageGroup) localStorage.setItem("speakmate_age_group", prefs.ageGroup);
  if (prefs.schoolGrade) localStorage.setItem("speakmate_school_grade", prefs.schoolGrade);
  if (prefs.standard) localStorage.setItem("speakmate_standard", prefs.standard);
  if (prefs.accountType) localStorage.setItem("speakmate_account_type", prefs.accountType);
  if (prefs.englishLevel) localStorage.setItem("speakmate_english_level", prefs.englishLevel);
  if (prefs.accent) {
    localStorage.setItem("speakmate_voice_accent", prefs.accent);
    localStorage.setItem("speakmate_accent", prefs.accent);
  }
  if (prefs.lastSpeakingCategory) localStorage.setItem("speakmate_last_speaking_category", prefs.lastSpeakingCategory);
  if (prefs.lastSpeakingGrade) localStorage.setItem("speakmate_last_speaking_grade", prefs.lastSpeakingGrade);
  if (prefs.lastLessonId) localStorage.setItem("speakmate_last_lesson_id", prefs.lastLessonId);
};

