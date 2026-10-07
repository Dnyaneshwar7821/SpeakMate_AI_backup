import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedAvatarModel, setCachedAvatarModel, resolveAvatarFromVoice } from '../config/AvatarCatalog';

export const USER_PREFS_PREFIX = 'speakmate_user_prefs_';

export function getUserPrefsKey(email) {
  const clean = (email || '').trim().toLowerCase();
  return clean ? `${USER_PREFS_PREFIX}${clean}` : null;
}

/**
 * Snapshots the current active user preferences into AsyncStorage
 * keyed by the user's email address.
 */
export async function captureCurrentUserPreferences(email) {
  const key = getUserPrefsKey(email);
  if (!key) return null;

  try {
    const [
      avatarModel,
      aiVoice,
      selectedVoice,
      voiceCode,
      voiceGender,
      voicePitch,
      voiceSpeed,
      voiceAccent,
      theme,
      darkMode,
      dailyGoal,
      soundEffects,
      autoPlayAudio,
      englishLevel,
      schoolGrade,
      standard,
      ageGroup,
      accountType,
      lessonsTab,
      lessonsCategory,
      speakingCategory,
    ] = await Promise.all([
      AsyncStorage.getItem('speakmate_avatar_model'),
      AsyncStorage.getItem('speakmate_ai_voice'),
      AsyncStorage.getItem('speakmate_selected_voice'),
      AsyncStorage.getItem('speakmate_voice_code'),
      AsyncStorage.getItem('speakmate_voice_gender'),
      AsyncStorage.getItem('speakmate_voice_pitch'),
      AsyncStorage.getItem('speakmate_voice_speed'),
      AsyncStorage.getItem('speakmate_voice_accent'),
      AsyncStorage.getItem('speakmate_theme'),
      AsyncStorage.getItem('speakmate_dark_mode'),
      AsyncStorage.getItem('speakmate_daily_goal'),
      AsyncStorage.getItem('speakmate_sound_effects'),
      AsyncStorage.getItem('speakmate_auto_play_audio'),
      AsyncStorage.getItem('speakmate_english_level'),
      AsyncStorage.getItem('speakmate_school_grade'),
      AsyncStorage.getItem('speakmate_standard'),
      AsyncStorage.getItem('speakmate_age_group'),
      AsyncStorage.getItem('speakmate_account_type'),
      AsyncStorage.getItem('speakmate_lessons_active_tab'),
      AsyncStorage.getItem('speakmate_lessons_category'),
      AsyncStorage.getItem('speakmate_speaking_category'),
    ]);

    const activeModel = avatarModel || getCachedAvatarModel();
    const effectiveModel = activeModel || (aiVoice ? resolveAvatarFromVoice(aiVoice)?.model : null);

    const prefs = {
      avatarModel: effectiveModel || null,
      aiVoice: aiVoice || selectedVoice || voiceCode || null,
      selectedVoice: selectedVoice || aiVoice || null,
      voiceCode: voiceCode || aiVoice || null,
      voiceGender: voiceGender || (effectiveModel ? resolveAvatarFromVoice(aiVoice)?.gender : null),
      voicePitch: voicePitch || null,
      voiceSpeed: voiceSpeed || null,
      voiceAccent: voiceAccent || null,
      theme: theme || null,
      darkMode: darkMode || null,
      dailyGoal: dailyGoal || null,
      soundEffects: soundEffects || null,
      autoPlayAudio: autoPlayAudio || null,
      englishLevel: englishLevel || null,
      schoolGrade: schoolGrade || null,
      standard: standard || null,
      ageGroup: ageGroup || null,
      accountType: accountType || null,
      lessonsTab: lessonsTab || null,
      lessonsCategory: lessonsCategory || null,
      speakingCategory: speakingCategory || null,
      savedAt: Date.now(),
    };

    await AsyncStorage.setItem(key, JSON.stringify(prefs));
    return prefs;
  } catch (e) {
    console.warn('[userPreferences] Failed to capture preferences:', e);
    return null;
  }
}

/**
 * Restores all cached preferences for a specific account upon login / session restore.
 */
export async function restoreUserPreferences(email) {
  const key = getUserPrefsKey(email);
  if (!key) return null;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const prefs = JSON.parse(raw);
    if (!prefs || typeof prefs !== 'object') return null;

    const itemsToSet = [];

    if (prefs.avatarModel) {
      itemsToSet.push(['speakmate_avatar_model', prefs.avatarModel]);
      setCachedAvatarModel(prefs.avatarModel);
    }
    if (prefs.aiVoice) itemsToSet.push(['speakmate_ai_voice', prefs.aiVoice]);
    if (prefs.selectedVoice) itemsToSet.push(['speakmate_selected_voice', prefs.selectedVoice]);
    if (prefs.voiceCode) itemsToSet.push(['speakmate_voice_code', prefs.voiceCode]);
    if (prefs.voiceGender) itemsToSet.push(['speakmate_voice_gender', prefs.voiceGender]);
    if (prefs.voicePitch) itemsToSet.push(['speakmate_voice_pitch', String(prefs.voicePitch)]);
    if (prefs.voiceSpeed) itemsToSet.push(['speakmate_voice_speed', String(prefs.voiceSpeed)]);
    if (prefs.voiceAccent) itemsToSet.push(['speakmate_voice_accent', prefs.voiceAccent]);
    if (prefs.theme) itemsToSet.push(['speakmate_theme', prefs.theme]);
    if (prefs.darkMode !== null && prefs.darkMode !== undefined) itemsToSet.push(['speakmate_dark_mode', String(prefs.darkMode)]);
    if (prefs.dailyGoal) itemsToSet.push(['speakmate_daily_goal', String(prefs.dailyGoal)]);
    if (prefs.soundEffects !== null && prefs.soundEffects !== undefined) itemsToSet.push(['speakmate_sound_effects', String(prefs.soundEffects)]);
    if (prefs.autoPlayAudio !== null && prefs.autoPlayAudio !== undefined) itemsToSet.push(['speakmate_auto_play_audio', String(prefs.autoPlayAudio)]);
    if (prefs.englishLevel) itemsToSet.push(['speakmate_english_level', prefs.englishLevel]);
    if (prefs.schoolGrade) itemsToSet.push(['speakmate_school_grade', prefs.schoolGrade]);
    if (prefs.standard) itemsToSet.push(['speakmate_standard', prefs.standard]);
    if (prefs.ageGroup) itemsToSet.push(['speakmate_age_group', prefs.ageGroup]);
    if (prefs.accountType) itemsToSet.push(['speakmate_account_type', prefs.accountType]);
    if (prefs.lessonsTab) itemsToSet.push(['speakmate_lessons_active_tab', prefs.lessonsTab]);
    if (prefs.lessonsCategory) itemsToSet.push(['speakmate_lessons_category', prefs.lessonsCategory]);
    if (prefs.speakingCategory) itemsToSet.push(['speakmate_speaking_category', prefs.speakingCategory]);

    if (itemsToSet.length > 0) {
      await AsyncStorage.multiSet(itemsToSet);
    }

    return prefs;
  } catch (e) {
    console.warn('[userPreferences] Failed to restore preferences:', e);
    return null;
  }
}

/**
 * Updates a single preference field for a user in the user-scoped backup store.
 */
export async function saveUserPreferenceField(email, field, value) {
  const key = getUserPrefsKey(email);
  if (!key) return;

  try {
    let prefs = {};
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      try {
        prefs = JSON.parse(raw) || {};
      } catch {}
    }
    prefs[field] = value;
    prefs.savedAt = Date.now();
    await AsyncStorage.setItem(key, JSON.stringify(prefs));
  } catch (e) {
    console.warn('[userPreferences] Failed to update preference field:', e);
  }
}
