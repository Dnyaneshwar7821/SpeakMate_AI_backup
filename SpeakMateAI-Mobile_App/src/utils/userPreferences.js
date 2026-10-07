import AsyncStorage from "@react-native-async-storage/async-storage";
import { setCachedAvatarModel } from "../config/AvatarCatalog";

const PREFS_PREFIX = "speakmate_user_prefs_";

export const getUserPreferences = async (email) => {
  if (!email) return null;
  try {
    const raw = await AsyncStorage.getItem(`${PREFS_PREFIX}${email.toLowerCase().trim()}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("[userPreferences] Failed to get user preferences:", err);
    return null;
  }
};

export const saveUserPreferences = async (email, updates) => {
  if (!email || !updates) return null;
  try {
    const key = `${PREFS_PREFIX}${email.toLowerCase().trim()}`;
    const existing = (await getUserPreferences(email)) || {};
    const merged = { ...existing, ...updates, updatedAt: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn("[userPreferences] Failed to save user preferences:", err);
    return null;
  }
};

export const captureCurrentUserPreferences = async (email) => {
  if (!email) return null;
  try {
    const keys = [
      "speakmate_avatar_model",
      "speakmate_voice_gender",
      "speakmate_ai_voice",
      "speakmate_selected_voice",
      "speakmate_voice_code",
      "speakmate_voice_pitch",
      "speakmate_speech_speed",
      "speakmate_speaking_rate",
      "speakmate_auto_play_audio",
      "speakmate_autoplay_audio",
      "speakmate_sound_effects",
      "speakmate_notifications_enabled",
      "speakmate_daily_reminder",
      "speakmate_dark_mode",
      "speakmate_daily_goal",
      "speakmate_age_group",
      "speakmate_school_grade",
      "speakmate_account_type",
      "speakmate_english_level",
      "speakmate_voice_accent",
      "speakmate_last_speaking_category",
      "speakmate_last_speaking_grade",
      "speakmate_last_lesson_id",
    ];

    const pairs = await AsyncStorage.multiGet(keys);
    const map = {};
    pairs.forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        map[k] = v;
      }
    });

    const prefs = {
      avatarModel: map["speakmate_avatar_model"] || null,
      voiceGender: map["speakmate_voice_gender"] || null,
      preferredVoice:
        map["speakmate_ai_voice"] ||
        map["speakmate_selected_voice"] ||
        map["speakmate_voice_code"] ||
        null,
      voiceCode: map["speakmate_voice_code"] || null,
      voicePitch: map["speakmate_voice_pitch"] || null,
      speechSpeed: map["speakmate_speech_speed"] || map["speakmate_speaking_rate"] || null,
      autoPlayAudio:
        map["speakmate_auto_play_audio"] !== undefined
          ? map["speakmate_auto_play_audio"]
          : map["speakmate_autoplay_audio"] || null,
      soundEffects: map["speakmate_sound_effects"] || null,
      notificationsEnabled: map["speakmate_notifications_enabled"] || null,
      dailyReminder: map["speakmate_daily_reminder"] || null,
      darkMode: map["speakmate_dark_mode"] || null,
      dailyGoal: map["speakmate_daily_goal"] || null,
      ageGroup: map["speakmate_age_group"] || null,
      schoolGrade: map["speakmate_school_grade"] || null,
      accountType: map["speakmate_account_type"] || null,
      englishLevel: map["speakmate_english_level"] || null,
      preferredAccent: map["speakmate_voice_accent"] || null,
      lastSpeakingCategory: map["speakmate_last_speaking_category"] || null,
      lastSpeakingGrade: map["speakmate_last_speaking_grade"] || null,
      lastLessonId: map["speakmate_last_lesson_id"] || null,
    };

    return await saveUserPreferences(email, prefs);
  } catch (err) {
    console.warn("[userPreferences] Failed to capture preferences:", err);
    return null;
  }
};

export const applyUserPreferences = async (prefs) => {
  if (!prefs || typeof prefs !== "object") return;
  try {
    const pairs = [];
    if (prefs.avatarModel) {
      pairs.push(["speakmate_avatar_model", prefs.avatarModel]);
      setCachedAvatarModel(prefs.avatarModel);
    }
    if (prefs.voiceGender) pairs.push(["speakmate_voice_gender", prefs.voiceGender]);
    if (prefs.preferredVoice) {
      pairs.push(["speakmate_ai_voice", prefs.preferredVoice]);
      pairs.push(["speakmate_selected_voice", prefs.preferredVoice]);
      pairs.push(["speakmate_voice_code", prefs.preferredVoice]);
    }
    if (prefs.voiceCode) pairs.push(["speakmate_voice_code", prefs.voiceCode]);
    if (prefs.voicePitch) pairs.push(["speakmate_voice_pitch", String(prefs.voicePitch)]);
    if (prefs.speechSpeed) {
      pairs.push(["speakmate_speech_speed", String(prefs.speechSpeed)]);
      pairs.push(["speakmate_speaking_rate", String(prefs.speechSpeed)]);
    }
    if (prefs.autoPlayAudio !== undefined && prefs.autoPlayAudio !== null) {
      pairs.push(["speakmate_auto_play_audio", String(prefs.autoPlayAudio)]);
      pairs.push(["speakmate_autoplay_audio", String(prefs.autoPlayAudio)]);
    }
    if (prefs.soundEffects !== undefined && prefs.soundEffects !== null) {
      pairs.push(["speakmate_sound_effects", String(prefs.soundEffects)]);
    }
    if (prefs.notificationsEnabled !== undefined && prefs.notificationsEnabled !== null) {
      pairs.push(["speakmate_notifications_enabled", String(prefs.notificationsEnabled)]);
    }
    if (prefs.dailyReminder !== undefined && prefs.dailyReminder !== null) {
      pairs.push(["speakmate_daily_reminder", String(prefs.dailyReminder)]);
    }
    if (prefs.darkMode !== undefined && prefs.darkMode !== null) {
      pairs.push(["speakmate_dark_mode", String(prefs.darkMode)]);
    }
    if (prefs.dailyGoal) pairs.push(["speakmate_daily_goal", String(prefs.dailyGoal)]);
    if (prefs.ageGroup) pairs.push(["speakmate_age_group", prefs.ageGroup]);
    if (prefs.schoolGrade) pairs.push(["speakmate_school_grade", prefs.schoolGrade]);
    if (prefs.accountType) pairs.push(["speakmate_account_type", prefs.accountType]);
    if (prefs.englishLevel) pairs.push(["speakmate_english_level", prefs.englishLevel]);
    if (prefs.preferredAccent) pairs.push(["speakmate_voice_accent", prefs.preferredAccent]);
    if (prefs.lastSpeakingCategory) pairs.push(["speakmate_last_speaking_category", prefs.lastSpeakingCategory]);
    if (prefs.lastSpeakingGrade) pairs.push(["speakmate_last_speaking_grade", prefs.lastSpeakingGrade]);
    if (prefs.lastLessonId) pairs.push(["speakmate_last_lesson_id", prefs.lastLessonId]);

    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }
  } catch (err) {
    console.warn("[userPreferences] Failed to apply user preferences:", err);
  }
};
