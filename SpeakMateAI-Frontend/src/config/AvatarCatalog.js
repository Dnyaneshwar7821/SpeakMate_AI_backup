/**
 * SpeakMate AI Master Avatar Catalog
 * Central registry for all verified, high-quality AI speaking tutor avatars across Web and Mobile.
 * Every avatar has its own unique, fully animated Live2D or 2.5D character model.
 */

export const AVATAR_CATALOG = {
  // ── 1. Adult & Professional Human Coaches ──
  haru: {
    id: 'haru',
    name: 'Teacher',
    gender: 'female',
    category: 'human',
    badge: 'English Teacher',
    emoji: '👩‍🏫',
    thumbnail: '/models/avatar/teacher/Teacher_Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '50% 18%',
    thumbnailScale: 1.0,
    subtitle: 'Kind, articulate, and encouraging female English teacher',
    description: 'Clear, structured, and warm conversational guidance for grammar, vocabulary, and everyday fluency.',
    voiceProfile: 'Teacher',
    voiceLabel: 'Female Voice (Teacher)',
    defaultPitch: 1.12,
    defaultRate: 0.98,
    type: 'puppet',
    puppetType: 'teacher',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  chitose: {
    id: 'chitose',
    name: 'Male Teacher',
    gender: 'male',
    category: 'human',
    badge: 'English Teacher',
    emoji: '👨‍🏫',
    thumbnail: '/models/avatar/teacherMale/TeacherBoy_Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '50% 38%',
    thumbnailScale: 1.0,
    subtitle: 'Clear, articulate, and encouraging male English teacher',
    description: 'Clear, articulate, and encouraging male English teacher',
    voiceProfile: 'MaleTeacher',
    voiceLabel: 'Male Voice (Teacher)',
    defaultPitch: 1.00,
    defaultRate: 0.96,
    type: 'puppet',
    puppetType: 'maleTeacher',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  shizuku: {
    id: 'shizuku',
    name: 'Shizuka',
    gender: 'female',
    category: 'human',
    badge: 'Academic Mentor',
    emoji: '🌸',
    thumbnail: '/models/avatar/shizuku/Shizuka_Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '60% 18%',
    thumbnailScale: 1.0,
    subtitle: 'Gentle, thoughtful, and analytical academic mentor',
    description: 'Specializes in grammar explanations, vocabulary enrichment, and structured academic fluency.',
    voiceProfile: 'Shizuka',
    voiceLabel: 'Academic Mentor Voice',
    defaultPitch: 1.22,
    defaultRate: 1.04,
    type: 'puppet',
    puppetType: 'shizuka',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },

  // ── 2. Kids & Students Cartoon Avatars (Unique Live2D & 2D Models) ──
  robopaws: {
    id: 'robopaws',
    name: 'Doraemon',
    gender: 'male',
    category: 'cartoon',
    badge: 'Doraemon Buddy',
    emoji: '🤖',
    thumbnail: '/models/avatar/Doraemon.jpg',
    thumbnailFit: 'cover',
    thumbnailPosition: '50% 25%',
    thumbnailScale: 1.0,
    subtitle: 'Kind, gentle, and mischievous 22nd-century robot cat',
    description: 'Helpful 22nd-century robot cat with secret gadgets for kind, fun, and stress-free English practice.',
    voiceProfile: 'Doraemon',
    voiceLabel: 'Robotic Male Voice',
    defaultPitch: 1.06,
    defaultRate: 1.03,
    type: 'puppet',
    puppetType: 'doraemon',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  spongebob: {
    id: 'spongebob',
    name: 'SpongeBob',
    gender: 'male',
    category: 'cartoon',
    badge: 'Sponge Buddy',
    emoji: '🧽',
    thumbnail: '/models/avatar/spongebob/SpongeBob-Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '70% 38%',
    thumbnailScale: 1.0,
    subtitle: 'Friendly, gentle, and encouraging AI speaking coach',
    description: 'A cheerful AI speaking coach who helps you practice English through friendly conversation.',
    voiceProfile: 'SpongeBob',
    voiceLabel: 'Youthful Boy Voice',
    defaultPitch: 1.18,
    defaultRate: 1.02,
    type: 'puppet',
    puppetType: 'spongebob',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  sparky: {
    id: 'sparky',
    name: 'Chhota Bheem',
    gender: 'male',
    category: 'cartoon',
    badge: 'Dholakpur Hero',
    emoji: '💪',
    thumbnail: '/models/avatar/Chhota Bheem-Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '50% 18%',
    thumbnailScale: 1.28,
    subtitle: 'Mighty, brave, and cheerful young hero from Dholakpur',
    description: 'A brave, cheerful, and encouraging AI speaking coach who helps you practice English through fun and heroic conversations.',
    voiceProfile: 'Sparky',
    voiceLabel: 'Young Hero Voice',
    defaultPitch: 1.22,
    defaultRate: 1.03,
    type: 'puppet',
    puppetType: 'chhotabheem',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  koharu: {
    id: 'koharu',
    name: 'Ninja Hattori',
    gender: 'male',
    category: 'cartoon',
    badge: 'Ninja Hero',
    emoji: '🥷',
    thumbnail: '/models/avatar/NinjaHattori-Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '72% 28%',
    thumbnailScale: 1.05,
    subtitle: 'Mighty, disciplined, and cheerful young ninja from Iga',
    description: 'A dedicated, swift, and encouraging AI speaking coach who helps you practice fluent English with ninja-speed confidence.',
    voiceProfile: 'Koharu',
    voiceLabel: 'Youth Hero Voice',
    defaultPitch: 1.20,
    defaultRate: 1.04,
    type: 'puppet',
    puppetType: 'ninjahattori',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  haruto: {
    id: 'haruto',
    name: 'Tom',
    gender: 'male',
    category: 'cartoon',
    badge: 'Cartoon Cat',
    emoji: '🐱',
    thumbnail: '/models/avatar/Tommy-Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '67% 28%',
    thumbnailScale: 1.05,
    subtitle: 'Classic witty cartoon cat conversation partner',
    description: 'Playful, expressive classic cartoon cat who helps you practice English through fun and witty conversations.',
    voiceProfile: 'Haruto',
    voiceLabel: 'Tom (Cartoon Cat Voice)',
    defaultPitch: 1.20,
    defaultRate: 1.04,
    type: 'puppet',
    puppetType: 'tom',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  mao: {
    id: 'mao',
    name: 'Ben 10',
    gender: 'male',
    category: 'cartoon',
    badge: 'Alien Hero',
    emoji: '⌚',
    thumbnail: '/models/avatar/Ben 10-Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '60% 18%',
    thumbnailScale: 1.0,
    subtitle: 'Brave, adventurous young hero with the Omnitrix',
    description: 'High-energy AI speaking coach who helps you practice confident English with heroic enthusiasm.',
    voiceProfile: 'Mao',
    voiceLabel: 'Youth Hero Voice',
    defaultPitch: 1.18,
    defaultRate: 1.03,
    type: 'puppet',
    puppetType: 'benten',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  puppy: {
    id: 'puppy',
    name: 'Scooby-Doo',
    gender: 'male',
    category: 'cartoon',
    badge: 'Mystery Pup',
    emoji: '🐶',
    thumbnail: '/models/avatar/ScobbyDoo-Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '42% 18%',
    thumbnailScale: 1.0,
    subtitle: 'Classic mystery-solving Great Dane pal & fun English conversation partner',
    description: 'Playful mystery-solving, cheer-ups, and fun interactive conversations with dynamic lip-syncing.',
    voiceProfile: 'Puppy',
    voiceLabel: 'Playful Pup Voice',
    defaultPitch: 0.92,
    defaultRate: 0.94,
    previewGreeting: "Woof! Hello best friend! I'm your puppy pal! Let's play and speak cheerful English every day!",
    themeColor: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-600",
    type: 'puppet',
    puppetType: 'puppy',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
  wanko: {
    id: 'puppy',
    name: 'Scooby-Doo',
    gender: 'male',
    category: 'cartoon',
    badge: 'Mystery Pup',
    emoji: '🐶',
    thumbnail: '/models/avatar/ScobbyDoo-Im.png',
    thumbnailFit: 'cover',
    thumbnailPosition: '42% 18%',
    thumbnailScale: 1.0,
    subtitle: 'Classic mystery-solving Great Dane pal & fun English conversation partner',
    description: 'Playful mystery-solving, cheer-ups, and fun interactive conversations with dynamic lip-syncing.',
    voiceProfile: 'Puppy',
    voiceLabel: 'Playful Pup Voice',
    defaultPitch: 0.92,
    defaultRate: 0.94,
    previewGreeting: "Woof! Hello best friend! I'm your puppy pal! Let's play and speak cheerful English every day!",
    themeColor: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-600",
    type: 'puppet',
    puppetType: 'puppy',
    modelPath: null,
    scaleMultiplier: 1.0,
    yOffsetRatio: 0.50,
  },
};

export const AVATAR_LIST = Object.values(AVATAR_CATALOG).filter(
  (av, index, self) => index === self.findIndex((a) => a.id === av.id)
);

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
  if (key.includes('spongebob') || key.includes('sponge') || key.includes('bob') || key.includes('motu') || key.includes('patlu')) {
    return AVATAR_CATALOG.spongebob;
  }
  if (key.includes('robo') || key.includes('paws') || key.includes('doraemon')) {
    return AVATAR_CATALOG.robopaws;
  }
  if (key.includes('sparky') || key.includes('bheem') || key.includes('chhota') || key.includes('chhotabheem')) {
    return AVATAR_CATALOG.sparky;
  }
  if (key.includes('shizuku') || key.includes('shizuka')) {
    return AVATAR_CATALOG.shizuku;
  }
  if (key.includes('hattori') || key.includes('ninja') || key.includes('ninjahattori') || key.includes('koharu')) {
    return AVATAR_CATALOG.koharu;
  }
  if (key.includes('tom') || key.includes('tommy') || key.includes('haruto')) {
    return AVATAR_CATALOG.haruto;
  }
  if (key.includes('mao') || key.includes('ben') || key.includes('ben10') || key.includes('omnitrix')) {
    return AVATAR_CATALOG.mao;
  }
  if (key.includes('wanko') || key.includes('dog') || key.includes('puppy') || key.includes('scooby') || key.includes('scoobydoo')) {
    return AVATAR_CATALOG.puppy;
  }
  return AVATAR_CATALOG[key] || AVATAR_CATALOG.haru;
}
