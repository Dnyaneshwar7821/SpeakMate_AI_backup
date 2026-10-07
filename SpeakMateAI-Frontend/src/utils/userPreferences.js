import { EventBus, AVATAR_EVENTS } from '../services/live2d/EventBus';
import { resolveAvatarFromVoice } from './speechHelper';
import { resolveCanonicalTutor, setCanonicalState, STORAGE_KEYS as TUTOR_KEYS, SELECTION_SOURCE } from '../services/ActiveTutorService';

export const USER_PREFS_PREFIX = 'speakmate_user_prefs_';

export function getUserPrefsKey(email) {
  const clean = (email || '').trim().toLowerCase();
  return clean ? `${USER_PREFS_PREFIX}${clean}` : null;
}

/**
 * Snapshots the current active user preferences into localStorage
 * keyed by the user's email address.
 */
export function captureCurrentUserPreferences(email) {
  const key = getUserPrefsKey(email);
  if (!key) return null;

  try {
    const avatarModel = localStorage.getItem('speakmate_avatar_model');
    const aiVoice = localStorage.getItem('speakmate_ai_voice');
    const selectionSource = localStorage.getItem('speakmate_selection_source');
    const selectedVoice = localStorage.getItem('speakmate_selected_voice');
    const voiceCode = localStorage.getItem('speakmate_voice_code');
    const voiceGender = localStorage.getItem('speakmate_voice_gender');
    const voicePitch = localStorage.getItem('speakmate_voice_pitch');
    const voiceSpeed = localStorage.getItem('speakmate_voice_speed');
    const voiceAccent = localStorage.getItem('speakmate_voice_accent');
    const theme = localStorage.getItem('speakmate_theme');
    const darkMode = localStorage.getItem('speakmate_dark_mode');
    const dailyGoal = localStorage.getItem('speakmate_daily_goal');
    const soundEffects = localStorage.getItem('speakmate_sound_effects');
    const autoPlayAudio = localStorage.getItem('speakmate_auto_play_audio') || localStorage.getItem('speakmate_autoplay_audio');
    const englishLevel = localStorage.getItem('speakmate_english_level');
    const schoolGrade = localStorage.getItem('speakmate_school_grade');
    const standard = localStorage.getItem('speakmate_standard');
    const ageGroup = localStorage.getItem('speakmate_age_group');
    const accountType = localStorage.getItem('speakmate_account_type');
    const lessonsTab = localStorage.getItem('speakmate_lessons_active_tab');
    const lessonsCategory = localStorage.getItem('speakmate_lessons_category');
    const speakingCategory = localStorage.getItem('speakmate_speaking_category');

    const canonical = resolveCanonicalTutor(
      avatarModel,
      aiVoice || selectedVoice || voiceCode,
      selectionSource
    );

    const prefs = {
      avatarModel: canonical.avatarModel,
      aiVoice: canonical.aiVoice,
      selectionSource: canonical.selectionSource,
      selectedVoice: canonical.aiVoice,
      voiceCode: canonical.aiVoice,
      voiceGender: voiceGender || (canonical.avatarModel === 'chitose' ? 'male' : 'female'),
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

    localStorage.setItem(key, JSON.stringify(prefs));
    return prefs;
  } catch (e) {
    console.warn('[userPreferences] Failed to capture web preferences:', e);
    return null;
  }
}

/**
 * Restores all cached preferences for a specific account upon login / session restore.
 */
export function restoreUserPreferences(email) {
  const key = getUserPrefsKey(email);
  if (!key) return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const prefs = JSON.parse(raw);
    if (!prefs || typeof prefs !== 'object') return null;

    const canonical = resolveCanonicalTutor(
      prefs.avatarModel,
      prefs.aiVoice || prefs.selectedVoice,
      prefs.selectionSource
    );

    setCanonicalState(canonical);
    if (prefs.aiVoice) localStorage.setItem('speakmate_ai_voice', prefs.aiVoice);
    if (prefs.selectedVoice) localStorage.setItem('speakmate_selected_voice', prefs.selectedVoice);
    if (prefs.voiceCode) localStorage.setItem('speakmate_voice_code', prefs.voiceCode);
    if (prefs.voiceGender) localStorage.setItem('speakmate_voice_gender', prefs.voiceGender);
    if (prefs.voicePitch) localStorage.setItem('speakmate_voice_pitch', String(prefs.voicePitch));
    if (prefs.voiceSpeed) localStorage.setItem('speakmate_voice_speed', String(prefs.voiceSpeed));
    if (prefs.voiceAccent) localStorage.setItem('speakmate_voice_accent', prefs.voiceAccent);
    if (prefs.theme) localStorage.setItem('speakmate_theme', prefs.theme);
    if (prefs.darkMode !== null && prefs.darkMode !== undefined) localStorage.setItem('speakmate_dark_mode', String(prefs.darkMode));
    if (prefs.dailyGoal) localStorage.setItem('speakmate_daily_goal', String(prefs.dailyGoal));
    if (prefs.soundEffects !== null && prefs.soundEffects !== undefined) localStorage.setItem('speakmate_sound_effects', String(prefs.soundEffects));
    if (prefs.autoPlayAudio !== null && prefs.autoPlayAudio !== undefined) {
      localStorage.setItem('speakmate_auto_play_audio', String(prefs.autoPlayAudio));
      localStorage.setItem('speakmate_autoplay_audio', String(prefs.autoPlayAudio));
    }
    if (prefs.englishLevel) localStorage.setItem('speakmate_english_level', prefs.englishLevel);
    if (prefs.schoolGrade) localStorage.setItem('speakmate_school_grade', prefs.schoolGrade);
    if (prefs.standard) localStorage.setItem('speakmate_standard', prefs.standard);
    if (prefs.ageGroup) localStorage.setItem('speakmate_age_group', prefs.ageGroup);
    if (prefs.accountType) localStorage.setItem('speakmate_account_type', prefs.accountType);
    if (prefs.lessonsTab) localStorage.setItem('speakmate_lessons_active_tab', prefs.lessonsTab);
    if (prefs.lessonsCategory) localStorage.setItem('speakmate_lessons_category', prefs.lessonsCategory);
    if (prefs.speakingCategory) localStorage.setItem('speakmate_speaking_category', prefs.speakingCategory);

    return prefs;
  } catch (e) {
    console.warn('[userPreferences] Failed to restore web preferences:', e);
    return null;
  }
}

/**
 * Updates a single preference field for a user in the user-scoped backup store.
 */
export function saveUserPreferenceField(email, field, value) {
  const key = getUserPrefsKey(email);
  if (!key) return;

  try {
    let prefs = {};
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        prefs = JSON.parse(raw) || {};
      } catch {}
    }
    prefs[field] = value;
    prefs.savedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (e) {
    console.warn('[userPreferences] Failed to update preference field:', e);
  }
}
