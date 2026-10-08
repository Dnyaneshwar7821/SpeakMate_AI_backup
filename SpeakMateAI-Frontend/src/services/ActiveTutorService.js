/**
 * SpeakMate AI Web - Canonical Active Speaking Tutor Service
 *
 * Single source of truth across the entire web application for:
 * {
 *   avatarModel:     string,  // which avatar is speaking ('haru', 'chitose', 'robopaws', etc.)
 *   aiVoice:         string,  // which voice is active ('Teacher', 'MaleTeacher', 'US Male', etc.)
 *   selectionSource: string   // 'AVATAR' | 'REGIONAL' | 'SYSTEM_DEFAULT'
 * }
 */
import { getAvatarById } from '../config/AvatarCatalog';
import { EventBus, AVATAR_EVENTS } from './live2d/EventBus';

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

export const TUTOR_AVATAR_MODELS = [
  'haru',
  'chitose',
  'robopaws',
  'shizuku',
  'spongebob',
  'sparky',
  'koharu',
  'haruto',
  'mao',
  'puppy',
  'doraemon',
  'shizuka',
  'bheem',
  'chhotabheem',
  'ben',
  'ben10',
  'hattori',
  'ninjahattori',
  'tom',
  'scooby',
  'scoobydoo',
  'motu',
  'teacher',
  'maleteacher',
];

export function isTutorAvatarModel(modelOrName) {
  if (!modelOrName || typeof modelOrName !== 'string') return false;
  const clean = modelOrName.trim().toLowerCase();
  return TUTOR_AVATAR_MODELS.includes(clean);
}

export function isLearnerImageAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') return false;
  const clean = avatar.trim();
  return clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:image/') || clean.startsWith('/');
}

export function isLearnerEmojiAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') return false;
  const clean = avatar.trim();
  if (isLearnerImageAvatar(clean) || isTutorAvatarModel(clean)) return false;
  return !/^[a-zA-Z0-9_\-\s]+$/.test(clean);
}

// Regional Voice Codes in Settings (exactly 8 regional options)
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
  haru: 'Female Voice (Teacher)',
  chitose: 'Male Voice (Teacher)',
  robopaws: 'Doraemon Voice',
  shizuku: 'Shizuka Voice',
  spongebob: 'SpongeBob Voice',
  sparky: 'Chhota Bheem Voice',
  koharu: 'Ninja Hattori Voice',
  haruto: 'Tom Voice',
  mao: 'Ben 10 Voice',
  puppy: 'Scooby-Doo Voice',
};

// In-memory cache for instant 0ms synchronous reads (defaults to System Default onboarding tutor)
let _activeTutorCache = {
  avatarModel: 'haru',
  aiVoice: 'Default',
  selectionSource: SELECTION_SOURCE.SYSTEM_DEFAULT,
};

let _hasHydrated = false;

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

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

  const ONBOARDING_VOICE_KEYS = [
    'friendly',
    'professional',
    'energetic',
    'calm',
    'teacher',
    'native speaker',
    'nativespeaker',
  ];
  const cleanRawVoice = String(rawVoice || '').trim().toLowerCase();
  const isRawOnboardingVoice = ONBOARDING_VOICE_KEYS.includes(cleanRawVoice);

  if (isRawOnboardingVoice && isBrowser) {
    try {
      localStorage.setItem('speakmate_onboarding_voice', String(rawVoice).trim());
      localStorage.setItem('speakmate_voice_persona', String(rawVoice).trim());
    } catch (_) {}
  }

  // 1. Explicit Regional Voice (Highest priority for Regional Roster selection)
  // Any voice belonging to REGIONAL_VOICE_CODES is strictly REGIONAL source
  if (normVoice && REGIONAL_VOICE_CODES.includes(normVoice)) {
    const isMale = normVoice.includes('Male');
    return {
      avatarModel: isMale ? 'chitose' : 'haru',
      aiVoice: normVoice,
      selectionSource: SELECTION_SOURCE.REGIONAL,
    };
  }

  // 2. Explicit System Default Voice or Onboarding Persona Voice
  if (
    normSource === SELECTION_SOURCE.SYSTEM_DEFAULT ||
    normVoice === 'Default' ||
    (isRawOnboardingVoice && normSource !== SELECTION_SOURCE.AVATAR)
  ) {
    return {
      avatarModel: 'haru',
      aiVoice: 'Default',
      selectionSource: SELECTION_SOURCE.SYSTEM_DEFAULT,
    };
  }

  // 3. Explicit Avatar Selection (Character Avatars or explicit Avatar tutor)
  if (normSource === SELECTION_SOURCE.AVATAR && rawModel) {
    const avatar = getAvatarById(rawModel);
    return {
      avatarModel: avatar.id,
      aiVoice: normVoice || avatar.voiceProfile,
      selectionSource: SELECTION_SOURCE.AVATAR,
    };
  }

  // 4. Character Avatar Model without regional selection
  if (rawModel && !['haru', 'chitose'].includes(rawModel.toLowerCase())) {
    const avatar = getAvatarById(rawModel);
    return {
      avatarModel: avatar.id,
      aiVoice: avatar.voiceProfile,
      selectionSource: SELECTION_SOURCE.AVATAR,
    };
  }

  // 5. Default fallback: Haru with System Default onboarding voice
  return {
    avatarModel: 'haru',
    aiVoice: 'Default',
    selectionSource: SELECTION_SOURCE.SYSTEM_DEFAULT,
  };
}

/**
 * Synchronous getter: returns in-memory cached state instantly
 */
export function getActiveTutorSync() {
  if (!_hasHydrated && isBrowser) {
    const savedModel = localStorage.getItem(STORAGE_KEYS.AVATAR_MODEL);
    const savedVoice = localStorage.getItem(STORAGE_KEYS.AI_VOICE);
    const savedSource = localStorage.getItem(STORAGE_KEYS.SELECTION_SOURCE);

    if (savedModel || savedVoice || savedSource) {
      _activeTutorCache = resolveCanonicalTutor(savedModel, savedVoice, savedSource);
      _hasHydrated = true;
    }
  }
  return { ..._activeTutorCache };
}

/**
 * Asynchronous getter: hydrates from disk and updates in-memory cache
 */
export async function getActiveTutorAsync() {
  if (!isBrowser) return { ..._activeTutorCache };
  try {
    const savedModel = localStorage.getItem(STORAGE_KEYS.AVATAR_MODEL);
    const savedVoice = localStorage.getItem(STORAGE_KEYS.AI_VOICE);
    const savedSource = localStorage.getItem(STORAGE_KEYS.SELECTION_SOURCE);

    const resolved = resolveCanonicalTutor(savedModel, savedVoice, savedSource);
    _activeTutorCache = resolved;
    _hasHydrated = true;
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
    aiVoice: 'Default',
    selectionSource: SELECTION_SOURCE.SYSTEM_DEFAULT,
  };
  _hasHydrated = false;
}

/**
 * Profile Avatar Selection Action:
 * When user explicitly taps an avatar in Profile:
 * Avatar + OWN voice + selectionSource = 'AVATAR'
 */
export function setActiveTutorFromAvatar(avatarModelOrId) {
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
  _hasHydrated = true;

  if (isBrowser) {
    try {
      localStorage.setItem(STORAGE_KEYS.AVATAR_MODEL, model);
      localStorage.setItem(STORAGE_KEYS.AI_VOICE, voice);
      localStorage.setItem(STORAGE_KEYS.SELECTION_SOURCE, SELECTION_SOURCE.AVATAR);
      localStorage.setItem(STORAGE_KEYS.SELECTED_VOICE, voice);
      localStorage.setItem(STORAGE_KEYS.VOICE_CODE, voice);
      localStorage.setItem(STORAGE_KEYS.VOICE_GENDER, gender);
      localStorage.setItem(STORAGE_KEYS.VOICE_PITCH, pitch);

      EventBus.emit(AVATAR_EVENTS.GENDER_CHANGED, { gender, model });
      window.dispatchEvent(new CustomEvent('speakmate_tutor_changed', { detail: nextState }));
    } catch (e) {
      console.warn('[ActiveTutorService] Failed to persist avatar selection:', e);
    }
  }

  return nextState;
}

/**
 * Settings Regional Voice Selection Action:
 * When user selects a regional voice in Settings:
 * Male regional voice -> Male Teacher (chitose) + selected regional voice + REGIONAL
 * Female regional voice -> Female Teacher (haru) + selected regional voice + REGIONAL
 */
export function setActiveTutorFromRegional(voiceCode) {
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
  _hasHydrated = true;

  if (isBrowser) {
    try {
      localStorage.setItem(STORAGE_KEYS.AVATAR_MODEL, targetModel);
      localStorage.setItem(STORAGE_KEYS.AI_VOICE, normVoice);
      localStorage.setItem(STORAGE_KEYS.SELECTION_SOURCE, SELECTION_SOURCE.REGIONAL);
      localStorage.setItem(STORAGE_KEYS.SELECTED_VOICE, normVoice);
      localStorage.setItem(STORAGE_KEYS.VOICE_CODE, normVoice);
      localStorage.setItem(STORAGE_KEYS.VOICE_GENDER, targetGender);
      localStorage.setItem(STORAGE_KEYS.VOICE_PITCH, pitch);

      EventBus.emit(AVATAR_EVENTS.GENDER_CHANGED, { gender: targetGender, model: targetModel });
      window.dispatchEvent(new CustomEvent('speakmate_tutor_changed', { detail: nextState }));
    } catch (e) {
      console.warn('[ActiveTutorService] Failed to persist regional selection:', e);
    }
  }

  return nextState;
}

/**
 * Settings System Default Action:
 * When user selects System Default in Settings:
 * haru + 'Default' + SYSTEM_DEFAULT
 */
export function setActiveTutorFromSystemDefault() {
  const avatar = getAvatarById('haru');
  const nextState = {
    avatarModel: 'haru',
    aiVoice: 'Default',
    selectionSource: SELECTION_SOURCE.SYSTEM_DEFAULT,
  };

  _activeTutorCache = nextState;
  _hasHydrated = true;

  if (isBrowser) {
    try {
      localStorage.setItem(STORAGE_KEYS.AVATAR_MODEL, 'haru');
      localStorage.setItem(STORAGE_KEYS.AI_VOICE, 'Default');
      localStorage.setItem(STORAGE_KEYS.SELECTION_SOURCE, SELECTION_SOURCE.SYSTEM_DEFAULT);
      localStorage.setItem(STORAGE_KEYS.SELECTED_VOICE, 'Default');
      localStorage.setItem(STORAGE_KEYS.VOICE_CODE, 'Default');
      localStorage.setItem(STORAGE_KEYS.VOICE_GENDER, 'female');
      localStorage.setItem(STORAGE_KEYS.VOICE_PITCH, String(avatar.defaultPitch || 1.12));

      EventBus.emit(AVATAR_EVENTS.GENDER_CHANGED, { gender: 'female', model: 'haru' });
      window.dispatchEvent(new CustomEvent('speakmate_tutor_changed', { detail: nextState }));
    } catch (e) {
      console.warn('[ActiveTutorService] Failed to persist system default:', e);
    }
  }

  return nextState;
}

/**
 * Sets canonical state directly from restored user preferences
 */
export function setCanonicalState(tutorState) {
  if (!tutorState) return _activeTutorCache;
  const resolved = resolveCanonicalTutor(
    tutorState.avatarModel,
    tutorState.aiVoice,
    tutorState.selectionSource
  );

  _activeTutorCache = resolved;
  _hasHydrated = true;

  if (isBrowser) {
    try {
      const avatar = getAvatarById(resolved.avatarModel);
      localStorage.setItem(STORAGE_KEYS.AVATAR_MODEL, resolved.avatarModel);
      localStorage.setItem(STORAGE_KEYS.AI_VOICE, resolved.aiVoice);
      localStorage.setItem(STORAGE_KEYS.SELECTION_SOURCE, resolved.selectionSource);
      localStorage.setItem(STORAGE_KEYS.SELECTED_VOICE, resolved.aiVoice);
      localStorage.setItem(STORAGE_KEYS.VOICE_CODE, resolved.aiVoice);
      localStorage.setItem(STORAGE_KEYS.VOICE_GENDER, avatar.gender);
      localStorage.setItem(STORAGE_KEYS.VOICE_PITCH, String(avatar.defaultPitch || 1.0));

      EventBus.emit(AVATAR_EVENTS.GENDER_CHANGED, { gender: avatar.gender, model: resolved.avatarModel });
      window.dispatchEvent(new CustomEvent('speakmate_tutor_changed', { detail: resolved }));
    } catch (_) {}
  }

  return resolved;
}

/**
 * Format human-readable voice label for any active state
 */
export function formatActiveVoiceLabel(aiVoice, avatarModel, selectionSource) {
  const normVoice = normalizeVoiceCode(aiVoice);
  const avatar = getAvatarById(avatarModel);

  if (selectionSource === SELECTION_SOURCE.SYSTEM_DEFAULT || normVoice === 'Default') {
    const onboardingVoice = (isBrowser && (localStorage.getItem('speakmate_onboarding_voice') || localStorage.getItem('speakmate_voice_persona'))) || '';
    return onboardingVoice ? `System Default (${onboardingVoice})` : 'System Default';
  }

  if (selectionSource === SELECTION_SOURCE.REGIONAL && REGIONAL_VOICE_LABELS[normVoice]) {
    return REGIONAL_VOICE_LABELS[normVoice];
  }

  if (selectionSource === SELECTION_SOURCE.AVATAR) {
    if (avatar.id === 'haru') return 'Female Voice (Teacher)';
    if (avatar.id === 'chitose') return 'Male Voice (Teacher)';
    return AVATAR_OWN_VOICE_LABELS[avatar.id] || `${avatar.name} Voice`;
  }

  // Fallback
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
  const state = customState || getActiveTutorSync();
  const avatar = getAvatarById(state.avatarModel);
  const voiceLabel = formatActiveVoiceLabel(state.aiVoice, state.avatarModel, state.selectionSource);

  return {
    avatar,
    avatarId: avatar.id,
    avatarName: avatar.name,
    avatarEmoji: avatar.emoji,
    avatarThumbnail: avatar.thumbnail,
    avatarGender: avatar.gender === 'female' ? 'Female' : 'Male',
    voiceLabel,
    selectionSource: state.selectionSource,
  };
}

// Initial hydration from disk
if (isBrowser) {
  try {
    const savedModel = localStorage.getItem(STORAGE_KEYS.AVATAR_MODEL);
    const savedVoice = localStorage.getItem(STORAGE_KEYS.AI_VOICE);
    const savedSource = localStorage.getItem(STORAGE_KEYS.SELECTION_SOURCE);

    if (savedModel || savedVoice || savedSource) {
      _activeTutorCache = resolveCanonicalTutor(savedModel, savedVoice, savedSource);
      _hasHydrated = true;
    }
  } catch (_) {}
}
