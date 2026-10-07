/**
 * SpeakMate AI Mobile Master Avatar Catalog
 * Central registry for all 10 verified native AI speaking tutor avatars.
 * 3 Core Coaches + 7 Cartoon Companions.
 */

export const AVATAR_IMAGES = {
  haru: require('../../assets/images/avatars/teacher.png'),
  chitose: require('../../assets/images/avatars/maleteacher.png'),
  shizuku: require('../../assets/images/avatars/shizuka.png'),
  robopaws: require('../../assets/images/avatars/doraemon.jpg'),
  spongebob: require('../../assets/images/avatars/spongebob.png'),
  sparky: require('../../assets/images/avatars/bheem.png'),
  koharu: require('../../assets/images/avatars/hattori.png'),
  haruto: require('../../assets/images/avatars/tom.png'),
  mao: require('../../assets/images/avatars/ben10.png'),
  puppy: require('../../assets/images/avatars/scooby.png'),
};

export const AVATAR_THUMBNAILS = {
  haru: require('../../assets/images/avatars/teacher.png'),
  chitose: require('../../assets/images/avatars/maleteacher.png'),
  shizuku: require('../../assets/images/avatars/thumbnails/shizuka_thumb.png'),
  robopaws: require('../../assets/images/avatars/doraemon.jpg'),
  spongebob: require('../../assets/images/avatars/thumbnails/spongebob_thumb.png'),
  sparky: require('../../assets/images/avatars/thumbnails/bheem_thumb.png'),
  koharu: require('../../assets/images/avatars/thumbnails/hattori_thumb.png'),
  haruto: require('../../assets/images/avatars/thumbnails/tom_thumb.png'),
  mao: require('../../assets/images/avatars/thumbnails/ben10_thumb.png'),
  puppy: require('../../assets/images/avatars/thumbnails/scooby_thumb.png'),
};

export const AVATAR_CATALOG = {
  // ── 1. Adult & Professional Human Coaches ──
  haru: {
    id: 'haru',
    name: 'Teacher',
    gender: 'female',
    category: 'human',
    badge: 'English Teacher',
    emoji: '👩‍🏫',
    image: AVATAR_THUMBNAILS.haru,
    thumbnail: AVATAR_THUMBNAILS.haru,
    puppetImage: AVATAR_IMAGES.haru,
    subtitle: 'Kind, articulate, and encouraging female English teacher',
    description: 'Clear, structured, and warm conversational guidance for grammar, vocabulary, and everyday fluency.',
    voiceProfile: 'Teacher',
    voiceLabel: 'Teacher (Articulate & Calm)',
    defaultPitch: 1.06,
    defaultRate: 1.03,
    previewGreeting: "Hello! Welcome to SpeakMate. Today, we are going to practice speaking clearly and confidently.",
    type: 'puppet',
    puppetType: 'teacher',
    modelPath: '/models/avatar/teacher/Teacher_Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#EC4899', // Pink / Fuchsia
    glowColor: 'rgba(236, 72, 153, 0.45)',
    ringColor: '#F472B6',
  },
  chitose: {
    id: 'chitose',
    name: 'Male Teacher',
    gender: 'male',
    category: 'human',
    badge: 'English Teacher',
    emoji: '👨‍🏫',
    image: AVATAR_THUMBNAILS.chitose,
    thumbnail: AVATAR_THUMBNAILS.chitose,
    puppetImage: AVATAR_IMAGES.chitose,
    subtitle: 'Clear, articulate, and encouraging male English teacher',
    description: 'Clear, articulate, and encouraging male English teacher for professional guidance.',
    voiceProfile: 'MaleTeacher',
    voiceLabel: 'Male Teacher (Articulate & Calm)',
    defaultPitch: 1.00,
    defaultRate: 0.96,
    previewGreeting: "Hello! Welcome to SpeakMate. Today, we are going to practice speaking clearly and confidently in English.",
    type: 'puppet',
    puppetType: 'maleTeacher',
    modelPath: '/models/avatar/teacherMale/TeacherBoy_Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#3B82F6', // Blue
    glowColor: 'rgba(59, 130, 246, 0.45)',
    ringColor: '#60A5FA',
  },
  shizuku: {
    id: 'shizuku',
    name: 'Shizuka',
    gender: 'female',
    category: 'human',
    badge: 'Academic Mentor',
    emoji: '🌸',
    image: AVATAR_THUMBNAILS.shizuku,
    thumbnail: AVATAR_THUMBNAILS.shizuku,
    puppetImage: AVATAR_IMAGES.shizuku,
    subtitle: 'Gentle, thoughtful, and analytical academic mentor',
    description: 'Specializes in grammar explanations, vocabulary enrichment, and structured academic fluency.',
    voiceProfile: 'Shizuka',
    voiceLabel: 'Shizuka (Academic Mentor)',
    defaultPitch: 1.22,
    defaultRate: 1.04,
    previewGreeting: "Hii, I am Shizuka, your AI speaking coach. Let's practice English together!",
    type: 'puppet',
    puppetType: 'shizuka',
    modelPath: '/models/avatar/shizuku/Shizuka_Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#F43F5E', // Rose
    glowColor: 'rgba(244, 63, 94, 0.45)',
    ringColor: '#FB7185',
  },

  // ── 2. Kids & Students Cartoon Avatars (7 Companions) ──
  robopaws: {
    id: 'robopaws',
    name: 'Doraemon',
    gender: 'female',
    category: 'cartoon',
    badge: 'Doraemon Buddy',
    emoji: '🤖',
    image: AVATAR_THUMBNAILS.robopaws,
    thumbnail: AVATAR_THUMBNAILS.robopaws,
    puppetImage: AVATAR_IMAGES.robopaws,
    subtitle: 'Kind, gentle, and mischievous 22nd-century robot cat',
    description: 'Helpful 22nd-century robot cat with secret gadgets for kind, fun, and stress-free English practice.',
    voiceProfile: 'Doraemon',
    voiceLabel: 'Doraemon (Playful & Warm)',
    defaultPitch: 1.12,
    defaultRate: 0.98,
    previewGreeting: "Hi! I am Doraymon, your AI speaking coach. Let's practice English together!",
    type: 'puppet',
    puppetType: 'doraemon',
    modelPath: '/models/avatar/Doraemon.jpg',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#0284C7', // Sky Blue
    glowColor: 'rgba(2, 132, 199, 0.45)',
    ringColor: '#38BDF8',
  },
  spongebob: {
    id: 'spongebob',
    name: 'SpongeBob',
    gender: 'male',
    category: 'cartoon',
    badge: 'Sponge Buddy',
    emoji: '🧽',
    image: AVATAR_THUMBNAILS.spongebob,
    thumbnail: AVATAR_THUMBNAILS.spongebob,
    puppetImage: AVATAR_IMAGES.spongebob,
    subtitle: 'Friendly, gentle, and encouraging AI speaking coach',
    description: 'A cheerful AI speaking coach who helps you practice English through friendly conversation.',
    voiceProfile: 'SpongeBob',
    voiceLabel: 'SpongeBob (Youthful Voice)',
    defaultPitch: 1.18,
    defaultRate: 1.02,
    previewGreeting: "Hey! It's really nice to meet you! Let's practice English together!",
    type: 'puppet',
    puppetType: 'spongebob',
    modelPath: '/models/avatar/spongebob/SpongeBob-Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#EAB308', // Amber Yellow
    glowColor: 'rgba(234, 179, 8, 0.45)',
    ringColor: '#FACC15',
  },
  sparky: {
    id: 'sparky',
    name: 'Chhota Bheem',
    gender: 'male',
    category: 'cartoon',
    badge: 'Dholakpur Hero',
    emoji: '💪',
    image: AVATAR_THUMBNAILS.sparky,
    thumbnail: AVATAR_THUMBNAILS.sparky,
    puppetImage: AVATAR_IMAGES.sparky,
    subtitle: 'Mighty, brave, and cheerful young hero from Dholakpur',
    description: 'A brave, cheerful, and encouraging AI speaking coach who helps you practice English through fun and heroic conversations.',
    voiceProfile: 'ChhotaBheem',
    voiceLabel: 'Chhota Bheem (Heroic Voice)',
    defaultPitch: 1.22,
    defaultRate: 1.03,
    previewGreeting: "Hello! I am Chhota Bheem from Dholakpur! Let's practice English together!",
    type: 'puppet',
    puppetType: 'chhotabheem',
    modelPath: '/models/avatar/Chhota Bheem-Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#EA580C', // Orange
    glowColor: 'rgba(234, 88, 12, 0.45)',
    ringColor: '#FB923C',
  },
  koharu: {
    id: 'koharu',
    name: 'Ninja Hattori',
    gender: 'male',
    category: 'cartoon',
    badge: 'Ninja Hero',
    emoji: '🥷',
    image: AVATAR_THUMBNAILS.koharu,
    thumbnail: AVATAR_THUMBNAILS.koharu,
    puppetImage: AVATAR_IMAGES.koharu,
    subtitle: 'Mighty, disciplined, and cheerful young ninja from Iga',
    description: 'A dedicated, swift, and encouraging AI speaking coach who helps you practice fluent English with ninja-speed confidence.',
    voiceProfile: 'NinjaHattori',
    voiceLabel: 'Ninja Hattori (Ninja Voice)',
    defaultPitch: 1.20,
    defaultRate: 1.04,
    previewGreeting: "Hello! I am Ninja Hattori from Iga! Let's practice English together with ninja speed!",
    type: 'puppet',
    puppetType: 'ninjahattori',
    modelPath: '/models/avatar/NinjaHattori-Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#3B82F6', // Blue
    glowColor: 'rgba(59, 130, 246, 0.45)',
    ringColor: '#60A5FA',
  },
  haruto: {
    id: 'haruto',
    name: 'Tom',
    gender: 'male',
    category: 'cartoon',
    badge: 'Cartoon Cat',
    emoji: '🐱',
    image: AVATAR_THUMBNAILS.haruto,
    thumbnail: AVATAR_THUMBNAILS.haruto,
    puppetImage: AVATAR_IMAGES.haruto,
    subtitle: 'Classic witty cartoon cat conversation partner',
    description: 'Playful, expressive classic cartoon cat who helps you practice English through fun and witty conversations.',
    voiceProfile: 'Tom',
    voiceLabel: 'Tom (Cartoon Cat Voice)',
    defaultPitch: 1.20,
    defaultRate: 1.04,
    previewGreeting: "Hey there! I'm Tom! Let's have fun and practice speaking English together!",
    type: 'puppet',
    puppetType: 'tom',
    modelPath: '/models/avatar/Tommy-Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#64748B', // Slate
    glowColor: 'rgba(100, 116, 139, 0.45)',
    ringColor: '#94A3B8',
  },
  mao: {
    id: 'mao',
    name: 'Ben 10',
    gender: 'male',
    category: 'cartoon',
    badge: 'Alien Hero',
    emoji: '⌚',
    image: AVATAR_THUMBNAILS.mao,
    thumbnail: AVATAR_THUMBNAILS.mao,
    puppetImage: AVATAR_IMAGES.mao,
    subtitle: 'Brave, adventurous young hero with the Omnitrix',
    description: 'High-energy AI speaking coach who helps you practice confident English with heroic enthusiasm.',
    voiceProfile: 'BenTen',
    voiceLabel: 'Ben 10 (Hero Voice)',
    defaultPitch: 1.18,
    defaultRate: 1.03,
    previewGreeting: "Hello! I'm Ben 10! It's hero time! Let's practice English together!",
    type: 'puppet',
    puppetType: 'benten',
    modelPath: '/models/avatar/Ben 10-Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#10B981', // Emerald Green
    glowColor: 'rgba(16, 185, 129, 0.45)',
    ringColor: '#34D399',
  },
  puppy: {
    id: 'puppy',
    name: 'Scooby-Doo',
    gender: 'male',
    category: 'cartoon',
    badge: 'Mystery Pup',
    emoji: '🐶',
    image: AVATAR_THUMBNAILS.puppy,
    thumbnail: AVATAR_THUMBNAILS.puppy,
    puppetImage: AVATAR_IMAGES.puppy,
    subtitle: 'Classic mystery-solving Great Dane pal & fun English conversation partner',
    description: 'Playful mystery-solving, cheer-ups, and fun interactive conversations with dynamic lip-syncing.',
    voiceProfile: 'ScoobyDoo',
    voiceLabel: 'Scooby-Doo (Playful Voice)',
    defaultPitch: 0.92,
    defaultRate: 0.94,
    previewGreeting: "Ruh-roh! Hello! I'm Scooby-Doo! Let's practice English and solve some mysteries together!",
    type: 'puppet',
    puppetType: 'puppy',
    modelPath: '/models/avatar/ScobbyDoo-Im.png',
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
    themeColor: '#B45309', // Amber Brown
    glowColor: 'rgba(180, 83, 9, 0.45)',
    ringColor: '#D97706',
  },
};

export const AVATAR_LIST = [
  AVATAR_CATALOG.haru,
  AVATAR_CATALOG.chitose,
  AVATAR_CATALOG.shizuku,
  AVATAR_CATALOG.robopaws,
  AVATAR_CATALOG.spongebob,
  AVATAR_CATALOG.sparky,
  AVATAR_CATALOG.koharu,
  AVATAR_CATALOG.haruto,
  AVATAR_CATALOG.mao,
  AVATAR_CATALOG.puppy,
];

/**
 * Get catalog entry by ID with safe fallback to Haru
 */
export function getAvatarById(id) {
  if (!id) return AVATAR_CATALOG.haru;
  const key = String(id).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.includes('maleteacher') || key.includes('teachermale') || key.includes('chitose') || key === 'male') {
    return AVATAR_CATALOG.chitose;
  }
  if (key === 'haru' || key.includes('teacher')) {
    return AVATAR_CATALOG.haru;
  }
  if (key.includes('spongebob') || key.includes('sponge') || key.includes('bob')) {
    return AVATAR_CATALOG.spongebob;
  }
  if (key.includes('robo') || key.includes('paws') || key.includes('doraemon') || key.includes('hijiki')) {
    return AVATAR_CATALOG.robopaws;
  }
  if (key.includes('sparky') || key.includes('bheem') || key.includes('chhota') || key.includes('chhotabheem') || key.includes('motu') || key.includes('patlu')) {
    return AVATAR_CATALOG.sparky;
  }
  if (key.includes('shizuku') || key.includes('shizuka')) {
    return AVATAR_CATALOG.shizuku;
  }
  if (key.includes('hattori') || key.includes('ninja') || key.includes('ninjahattori') || key.includes('koharu')) {
    return AVATAR_CATALOG.koharu;
  }
  if (key.includes('tom') || key.includes('tommy') || key.includes('haruto') || key.includes('tororo') || key.includes('cat') || key.includes('kitty')) {
    return AVATAR_CATALOG.haruto;
  }
  if (key.includes('mao') || key.includes('ben') || key.includes('ben10') || key.includes('omnitrix') || key.includes('rexy') || key.includes('dino') || key.includes('trex')) {
    return AVATAR_CATALOG.mao;
  }
  if (key.includes('wanko') || key.includes('dog') || key.includes('puppy') || key.includes('shiba') || key.includes('scooby') || key.includes('scoobydoo')) {
    return AVATAR_CATALOG.puppy;
  }
  return AVATAR_CATALOG[key] || AVATAR_CATALOG.haru;
}

/**
 * Resolves avatar entry by voiceProfile or voiceCode (e.g. 'Shizuka' -> shizuku, 'Doraemon' -> robopaws)
 * Returns null if the voiceCode is a standard regional human voice (e.g. 'US Male', 'Default').
 */
export function getAvatarByVoice(voiceCode) {
  if (!voiceCode) return null;
  const key = String(voiceCode).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    key.includes('usmale') || key.includes('usfemale') ||
    key.includes('ukmale') || key.includes('ukfemale') ||
    key.includes('aumale') || key.includes('aufemale') ||
    key.includes('inmale') || key.includes('infemale') ||
    key === 'default'
  ) {
    return null;
  }
  return AVATAR_LIST.find((a) => {
    const aKey = a.id.toLowerCase();
    const aVoice = (a.voiceProfile || '').toLowerCase();
    const aName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return aKey === key || aVoice === key || aName === key;
  }) || null;
}

export function resolveAvatarFromVoice(voiceCode, onboardingVoiceStyle = 'Friendly') {
  if (!voiceCode) {
    const style = String(onboardingVoiceStyle || '').toLowerCase();
    const isMaleStyle = style === 'professional' || style === 'calm' || (style.includes('male') && !style.includes('female'));
    return { model: isMaleStyle ? 'chitose' : 'haru', gender: isMaleStyle ? 'male' : 'female' };
  }

  // 1. Direct character signature voice match via getAvatarByVoice
  const charAvatar = getAvatarByVoice(voiceCode);
  if (charAvatar) {
    return { model: charAvatar.id, gender: charAvatar.gender || 'male' };
  }

  // 2. Regional human voices (US Male, IN Male, UK Female, etc.)
  const vc = String(voiceCode).toLowerCase();
  if (vc.includes('male') && !vc.includes('female')) {
    return { model: 'chitose', gender: 'male' };
  }
  if (vc.includes('female')) {
    return { model: 'haru', gender: 'female' };
  }

  // 3. Fallback to onboarding voice style if 'Default'
  const style = String(onboardingVoiceStyle || '').toLowerCase();
  const isMaleStyle = style === 'professional' || style === 'calm' || (style.includes('male') && !style.includes('female'));
  return { model: isMaleStyle ? 'chitose' : 'haru', gender: isMaleStyle ? 'male' : 'female' };
}

import AsyncStorage from '@react-native-async-storage/async-storage';

let _cachedAvatarModel = null;

export function getCachedAvatarModel() {
  return _cachedAvatarModel;
}

export function setCachedAvatarModel(model) {
  _cachedAvatarModel = model;
  if (model) {
    AsyncStorage?.setItem?.('speakmate_avatar_model', model)?.catch?.(() => {});
  }
}

// Pre-warm the cache immediately upon module evaluation if available
try {
  AsyncStorage?.getItem?.('speakmate_avatar_model')
    ?.then?.((val) => {
      if (val) _cachedAvatarModel = val;
    })
    ?.catch?.(() => {});
} catch (_) {}
