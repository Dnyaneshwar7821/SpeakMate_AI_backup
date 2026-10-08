/**
 * SpeakMate AI - Canonical Active Speaking Tutor Service
 *
 * Single source of truth across the entire application for:
 * {
 *   avatarModel:     string,  // which avatar is speaking ('haru', 'chitose', 'robopaws', etc.)
 *   aiVoice:         string,  // which voice is active ('Teacher', 'MaleTeacher', 'US Male', etc.)
 *   selectionSource: string   // 'AVATAR' | 'REGIONAL' | 'SYSTEM_DEFAULT'
 * }
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAvatarById, setCachedAvatarModel, getCachedAvatarModel } from '../config/AvatarCatalog';

export const SELECTION_SOURCE = {
  AVATAR: 'AVATAR',
  REGIONAL: 'REGIONAL',
  SYSTEM_DEFAULT: 'SYSTEM_DEFAULT',
};

export const STORAGE_KEYS = {
  AVATAR_MODEL: 'speakmate_avatar_model',
  AI_VOICE: 'speakmate_ai_voice',
  SELECTION_SOURCE: 'speakmate_selection_source',
  SELECTED_VOICE: 'speakmate_selected_voice',
  VOICE_CODE: 'speakmate_voice_code',
  VOICE_GENDER: 'speakmate_voice_gender',
  VOICE_PITCH: 'speakmate_voice_pitch',
  VOICE_SPEED: 'speakmate_voice_speed',
};

// Regional Voice Codes in Settings
export const REGIONAL_VOICE_CODES = [
  'US Male',
  'US Female',
  'UK Male',
  'UK Female',
  'AU Male',
  'AU Female',
  'IN Male',
  'IN Female',
];

export const REGIONAL_VOICE_LABELS = {
  'US Male': 'American - Male',
  'US Female': 'American - Female',
  'UK Male': 'British - Male',
  'UK Female': 'British - Female',
  'AU Male': 'Australian - Male',
  'AU Female': 'Australian - Female',
  'IN Male': 'Indian - Male',
  'IN Female': 'Indian - Female',
  'Default': 'System Default',
};

export const AVATAR_OWN_VOICE_LABELS = {
  haru: 'Teacher Voice',
  chitose: 'Male Teacher Voice',
  robopaws: 'Doraemon Voice',
  shizuku: 'Shizuka Voice',
  spongebob: 'SpongeBob Voice',
  sparky: 'Chhota Bheem Voice',
  koharu: 'Ninja Hattori Voice',
  haruto: 'Tom Voice',
  mao: 'Ben 10 Voice',
  puppy: 'Scooby-Doo Voice',
};

// In-memory cache for 0ms synchronous read
let _activeTutorCache = {
  avatarModel: 'haru',
  aiVoice: 'Teacher',
  selectionSource: SELECTION_SOURCE.AVATAR,
};

let _hasHydrated = false;

/**
 * Normalizes voice code to match canonical codes
 */
export function normalizeVoiceCode(code) {
  if (!code) return null;
  const clean = String(code).trim();
  const lower = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower === 'default' || lower.includes('systemdefault')) return 'Default';

  // Regional voices
  if (lower === 'usmale' || lower === 'americanmale') return 'US Male';
  if (lower === 'usfemale' || lower === 'americanfemale') return 'US Female';
  if (lower === 'ukmale' || lower === 'britishmale') return 'UK Male';
  if (lower === 'ukfemale' || lower === 'britishfemale') return 'UK Female';
  if (lower === 'aumale' || lower === 'australianmale') return 'AU Male';
  if (lower === 'aufemale' || lower === 'australianfemale') return 'AU Female';
  if (lower === 'inmale' || lower === 'indianmale') return 'IN Male';
  if (lower === 'infemale' || lower === 'indianfemale') return 'IN Female';

  // Avatar voices
  if (lower === 'maleteacher' || lower === 'teachermale' || lower === 'malevoice' || lower === 'chitose') return 'MaleTeacher';
  if (lower === 'teacher' || lower === 'femaleteacher' || lower === 'femalevoice' || lower === 'haru') return 'Teacher';
  if (lower.includes('doraemon') || lower.includes('robopaws')) return 'Doraemon';
  if (lower.includes('shizuka') || lower.includes('shizuku')) return 'Shizuka';
  if (lower.includes('spongebob')) return 'SpongeBob';
  if (lower.includes('bheem') || lower.includes('sparky')) return 'ChhotaBheem';
  if (lower.includes('hattori') || lower.includes('koharu')) return 'NinjaHattori';
  if (lower.includes('tom') || lower.includes('haruto')) return 'Tom';
  if (lower.includes('ben10') || lower.includes('benten') || lower.includes('mao')) return 'BenTen';
  if (lower.includes('scooby') || lower.includes('puppy')) return 'ScoobyDoo';

  return clean;
}

/**
 * Intelligent legacy migration helper
 * Reconstructs the canonical triplet when legacy or partial data exists
 */
export function resolveCanonicalTutor(rawModel, rawVoice, rawSource) {
  const normVoice = normalizeVoiceCode(rawVoice);
  let normSource = rawSource;

  // 1. Explicit valid selection source: AVATAR
  if (normSource === SELECTION_SOURCE.AVATAR && rawModel) {
    const avatar = getAvatarById(rawModel);
    return {
      avatarModel: avatar.id,
      aiVoice: avatar.voiceProfile,
      selectionSource: SELECTION_SOURCE.AVATAR,
    };
  }

  // 2. Explicit valid selection source: REGIONAL
  if (normSource === SELECTION_SOURCE.REGIONAL && normVoice && REGIONAL_VOICE_CODES.includes(normVoice)) {
    const isMale = normVoice.includes('Male');
    return {
      avatarModel: isMale ? 'chitose' : 'haru',
      aiVoice: normVoice,
      selectionSource: SELECTION_SOURCE.REGIONAL,
    };
  }

  // 3. Explicit valid selection source: SYSTEM_DEFAULT (Only if explicitly selected)
  if (normSource === SELECTION_SOURCE.SYSTEM_DEFAULT && normVoice === 'Default') {
    return {
      avatarModel: 'haru',
      aiVoice: 'Default',
      selectionSource: SELECTION_SOURCE.SYSTEM_DEFAULT,
    };
  }

  // 4. Infer from regional voice code if present
  if (normVoice && REGIONAL_VOICE_CODES.includes(normVoice)) {
    const isMale = normVoice.includes('Male');
    return {
      avatarModel: isMale ? 'chitose' : 'haru',
      aiVoice: normVoice,
      selectionSource: SELECTION_SOURCE.REGIONAL,
    };
  }

  // 5. Avatar-specific voices (e.g. 'Doraemon', 'MaleTeacher', 'Teacher', etc.)
  if (normVoice && normVoice !== 'Default') {
    const lowerV = normVoice.toLowerCase();
    if (lowerV.includes('doraemon')) return { avatarModel: 'robopaws', aiVoice: 'Doraemon', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('shizuka')) return { avatarModel: 'shizuku', aiVoice: 'Shizuka', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('spongebob')) return { avatarModel: 'spongebob', aiVoice: 'SpongeBob', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('bheem')) return { avatarModel: 'sparky', aiVoice: 'ChhotaBheem', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('hattori')) return { avatarModel: 'koharu', aiVoice: 'NinjaHattori', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('tom')) return { avatarModel: 'haruto', aiVoice: 'Tom', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('ben')) return { avatarModel: 'mao', aiVoice: 'BenTen', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('scooby')) return { avatarModel: 'puppy', aiVoice: 'ScoobyDoo', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('maleteacher') || lowerV === 'malevoice') return { avatarModel: 'chitose', aiVoice: 'MaleTeacher', selectionSource: SELECTION_SOURCE.AVATAR };
    if (lowerV.includes('teacher') || lowerV === 'femalevoice') return { avatarModel: 'haru', aiVoice: 'Teacher', selectionSource: SELECTION_SOURCE.AVATAR };
  }

  // 6. Fallback to model if present
  if (rawModel) {
    const avatar = getAvatarById(rawModel);
    return {
      avatarModel: avatar.id,
      aiVoice: avatar.voiceProfile,
      selectionSource: SELECTION_SOURCE.AVATAR,
    };
  }

  // Final safety fallback: Female Teacher with Teacher Voice
  return {
    avatarModel: 'haru',
    aiVoice: 'Teacher',
    selectionSource: SELECTION_SOURCE.AVATAR,
  };
}

/**
 * Synchronous instant getter for active tutor
 */
export function getActiveTutorSync() {
  return { ..._activeTutorCache };
}

/**
 * Asynchronous getter: hydrates from disk and updates in-memory cache
 */
export async function getActiveTutorAsync() {
  try {
    const [savedModel, savedVoice, savedSource] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.AVATAR_MODEL),
      AsyncStorage.getItem(STORAGE_KEYS.AI_VOICE),
      AsyncStorage.getItem(STORAGE_KEYS.SELECTION_SOURCE),
    ]);

    const resolved = resolveCanonicalTutor(
      savedModel || getCachedAvatarModel(),
      savedVoice,
      savedSource
    );

    _activeTutorCache = resolved;
    _hasHydrated = true;
    setCachedAvatarModel(resolved.avatarModel);

    return resolved;
  } catch (_) {
    return { ..._activeTutorCache };
  }
}

/**
 * Reset in-memory cache to default state (e.g. on user logout)
 */
export function resetActiveTutorCache() {
  _activeTutorCache = {
    avatarModel: 'haru',
    aiVoice: 'Teacher',
    selectionSource: SELECTION_SOURCE.AVATAR,
  };
  _hasHydrated = false;
  setCachedAvatarModel('haru');
}

/**
 * Profile Avatar Selection Action:
 * When user explicitly taps an avatar in Profile:
 * Avatar + OWN voice + selectionSource = 'AVATAR'
 */
export async function setActiveTutorFromAvatar(avatarModelOrId) {
  const avatar = getAvatarById(avatarModelOrId);
  const model = avatar.id;
  const voice = avatar.voiceProfile;
  const gender = avatar.gender;
  const pitch = String(avatar.defaultPitch || 1.0);

  const nextState = {
    avatarModel: model,
    aiVoice: voice,
    selectionSource: SELECTION_SOURCE.AVATAR,
  };

  _activeTutorCache = nextState;
  setCachedAvatarModel(model);

  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AVATAR_MODEL, model],
      [STORAGE_KEYS.AI_VOICE, voice],
      [STORAGE_KEYS.SELECTION_SOURCE, SELECTION_SOURCE.AVATAR],
      [STORAGE_KEYS.SELECTED_VOICE, voice],
      [STORAGE_KEYS.VOICE_CODE, voice],
      [STORAGE_KEYS.VOICE_GENDER, gender],
      [STORAGE_KEYS.VOICE_PITCH, pitch],
    ]);
  } catch (e) {
    console.warn('[ActiveTutorService] Failed to persist avatar selection:', e);
  }

  return nextState;
}

/**
 * Settings Regional Voice Selection Action:
 * When user selects a regional voice in Settings:
 * Male regional voice -> Male Teacher (chitose) + selected regional voice + REGIONAL
 * Female regional voice -> Female Teacher (haru) + selected regional voice + REGIONAL
 */
export async function setActiveTutorFromRegional(voiceCode) {
  const normVoice = normalizeVoiceCode(voiceCode);
  if (normVoice === 'Default') {
    return setActiveTutorFromSystemDefault();
  }

  const isMale = normVoice && normVoice.includes('Male');
  const targetModel = isMale ? 'chitose' : 'haru';
  const targetGender = isMale ? 'male' : 'female';
  const avatar = getAvatarById(targetModel);
  const pitch = String(avatar.defaultPitch || 1.0);

  const nextState = {
    avatarModel: targetModel,
    aiVoice: normVoice,
    selectionSource: SELECTION_SOURCE.REGIONAL,
  };

  _activeTutorCache = nextState;
  setCachedAvatarModel(targetModel);

  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AVATAR_MODEL, targetModel],
      [STORAGE_KEYS.AI_VOICE, normVoice],
      [STORAGE_KEYS.SELECTION_SOURCE, SELECTION_SOURCE.REGIONAL],
      [STORAGE_KEYS.SELECTED_VOICE, normVoice],
      [STORAGE_KEYS.VOICE_CODE, normVoice],
      [STORAGE_KEYS.VOICE_GENDER, targetGender],
      [STORAGE_KEYS.VOICE_PITCH, pitch],
    ]);
  } catch (e) {
    console.warn('[ActiveTutorService] Failed to persist regional selection:', e);
  }

  return nextState;
}

/**
 * Settings System Default Action:
 * When user selects System Default in Settings:
 * haru + 'Default' + SYSTEM_DEFAULT
 */
export async function setActiveTutorFromSystemDefault() {
  const avatar = getAvatarById('haru');
  const nextState = {
    avatarModel: 'haru',
    aiVoice: 'Default',
    selectionSource: SELECTION_SOURCE.SYSTEM_DEFAULT,
  };

  _activeTutorCache = nextState;
  setCachedAvatarModel('haru');

  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AVATAR_MODEL, 'haru'],
      [STORAGE_KEYS.AI_VOICE, 'Default'],
      [STORAGE_KEYS.SELECTION_SOURCE, SELECTION_SOURCE.SYSTEM_DEFAULT],
      [STORAGE_KEYS.SELECTED_VOICE, 'Default'],
      [STORAGE_KEYS.VOICE_CODE, 'Default'],
      [STORAGE_KEYS.VOICE_GENDER, 'female'],
      [STORAGE_KEYS.VOICE_PITCH, String(avatar.defaultPitch || 1.06)],
    ]);
  } catch (e) {
    console.warn('[ActiveTutorService] Failed to persist system default:', e);
  }

  return nextState;
}

/**
 * Sets canonical state directly from restored user preferences
 */
export async function setCanonicalState(tutorState) {
  if (!tutorState) return _activeTutorCache;
  const resolved = resolveCanonicalTutor(
    tutorState.avatarModel,
    tutorState.aiVoice,
    tutorState.selectionSource
  );

  _activeTutorCache = resolved;
  setCachedAvatarModel(resolved.avatarModel);

  try {
    const avatar = getAvatarById(resolved.avatarModel);
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AVATAR_MODEL, resolved.avatarModel],
      [STORAGE_KEYS.AI_VOICE, resolved.aiVoice],
      [STORAGE_KEYS.SELECTION_SOURCE, resolved.selectionSource],
      [STORAGE_KEYS.SELECTED_VOICE, resolved.aiVoice],
      [STORAGE_KEYS.VOICE_CODE, resolved.aiVoice],
      [STORAGE_KEYS.VOICE_GENDER, avatar.gender],
      [STORAGE_KEYS.VOICE_PITCH, String(avatar.defaultPitch || 1.0)],
    ]);
  } catch (_) {}

  return resolved;
}

/**
 * Format human-readable voice label for any active state
 */
export function formatActiveVoiceLabel(aiVoice, avatarModel, selectionSource) {
  const normVoice = normalizeVoiceCode(aiVoice);
  const avatar = getAvatarById(avatarModel);

  if (selectionSource === SELECTION_SOURCE.SYSTEM_DEFAULT || normVoice === 'Default') {
    return 'System Default';
  }

  if (selectionSource === SELECTION_SOURCE.REGIONAL && REGIONAL_VOICE_LABELS[normVoice]) {
    return REGIONAL_VOICE_LABELS[normVoice];
  }

  if (selectionSource === SELECTION_SOURCE.AVATAR) {
    return AVATAR_OWN_VOICE_LABELS[avatar.id] || `${avatar.name} Voice`;
  }

  // Fallback check: if voice is a regional code
  if (REGIONAL_VOICE_LABELS[normVoice]) {
    return REGIONAL_VOICE_LABELS[normVoice];
  }

  if (AVATAR_OWN_VOICE_LABELS[avatar.id]) {
    return AVATAR_OWN_VOICE_LABELS[avatar.id];
  }

  return normVoice || `${avatar.name} Voice`;
}

/**
 * Format Active Speaking Tutor Card display data
 */
export function getActiveTutorCardData(customState = null) {
  const state = customState || _activeTutorCache;
  const avatar = getAvatarById(state.avatarModel);
  const voiceLabel = formatActiveVoiceLabel(state.aiVoice, state.avatarModel, state.selectionSource);

  return {
    avatar,
    avatarId: avatar.id,
    avatarName: avatar.name,
    avatarEmoji: avatar.emoji,
    avatarThumbnail: avatar.thumbnail || avatar.image,
    avatarGender: avatar.gender === 'female' ? 'Female' : 'Male',
    voiceLabel,
    selectionSource: state.selectionSource,
  };
}

// Pre-warm the cache immediately upon module evaluation
try {
  AsyncStorage.multiGet([
    STORAGE_KEYS.AVATAR_MODEL,
    STORAGE_KEYS.AI_VOICE,
    STORAGE_KEYS.SELECTION_SOURCE,
  ]).then(([[, model], [, voice], [, source]]) => {
    if (model || voice || source) {
      const resolved = resolveCanonicalTutor(model, voice, source);
      _activeTutorCache = resolved;
      setCachedAvatarModel(resolved.avatarModel);
    }
  }).catch(() => {});
} catch (_) {}
