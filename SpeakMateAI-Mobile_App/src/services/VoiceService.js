import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingVoiceService } from './OnboardingVoiceService';
import { getAvatarById, getCachedAvatarModel } from '../config/AvatarCatalog';

export const VOICE_PROFILES = [
  { code: 'US Male', accent: 'American', locale: 'en-US', gender: 'male', label: 'American - Male' },
  { code: 'US Female', accent: 'American', locale: 'en-US', gender: 'female', label: 'American - Female' },
  { code: 'UK Male', accent: 'British', locale: 'en-GB', gender: 'male', label: 'British - Male' },
  { code: 'UK Female', accent: 'British', locale: 'en-GB', gender: 'female', label: 'British - Female' },
  { code: 'AU Male', accent: 'Australian', locale: 'en-AU', gender: 'male', label: 'Australian - Male' },
  { code: 'AU Female', accent: 'Australian', locale: 'en-AU', gender: 'female', label: 'Australian - Female' },
  { code: 'IN Male', accent: 'Indian', locale: 'en-IN', gender: 'male', label: 'Indian - Male' },
  { code: 'IN Female', accent: 'Indian', locale: 'en-IN', gender: 'female', label: 'Indian - Female' },
  { code: 'Default', accent: 'System Default', locale: 'en-US', gender: 'female', label: 'System Default' },
];

let currentUtteranceSession = 0;
let _cachedEnglishVoices = null;
let _inFlightVoicesPromise = null;

function chunkTextForTTS(text, maxChunkLen = 2000) {
  if (!text || text.length <= maxChunkLen) {
    return [text];
  }
  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > maxChunkLen) {
    let splitIdx = -1;
    const slice = remaining.slice(0, maxChunkLen);

    // Prefer sentence boundaries (. ! ?)
    const sentenceMatch = slice.match(/([.!?\n])\s+(?=[^.!?\n]*$)/);
    if (sentenceMatch && sentenceMatch.index > 200) {
      splitIdx = sentenceMatch.index + 1;
    } else {
      // Fallback: clause punctuation (, ; : —)
      const clauseMatch = slice.match(/([,;:—])\s+(?=[^,;:—]*$)/);
      if (clauseMatch && clauseMatch.index > 200) {
        splitIdx = clauseMatch.index + 1;
      } else {
        // Fallback: last whitespace
        const lastSpace = slice.lastIndexOf(' ');
        if (lastSpace > 200) {
          splitIdx = lastSpace;
        } else {
          splitIdx = maxChunkLen;
        }
      }
    }

    const chunk = remaining.slice(0, splitIdx).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitIdx).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

export const AVATAR_VOICE_PROFILES = {
  haru: {
    avatarId: 'haru',
    name: 'Teacher',
    category: 'human',
    intendedGender: 'male',
    voiceCode: 'Teacher',
    targetLocale: 'en-US',
    basePitch: 1.06,
    baseRate: 1.03,
    preferredVoices: ['zarvox', 'fred', 'alex', 'daniel', 'tpc', 'tpf', 'iog', 'ind', 'male'],
  },
  chitose: {
    avatarId: 'chitose',
    name: 'Male Teacher',
    category: 'human',
    intendedGender: 'male',
    voiceCode: 'MaleTeacher',
    targetLocale: 'en-IN',
    basePitch: 1.00,
    baseRate: 0.96,
    preferredVoices: ['ind', 'inc', 'inb', 'end', 'ene', 'rishi', 'ravi', 'prabhat', 'daniel', 'male'],
  },
  shizuku: {
    avatarId: 'shizuku',
    name: 'Shizuka',
    category: 'human',
    intendedGender: 'female',
    voiceCode: 'Shizuka',
    targetLocale: 'en-US',
    basePitch: 1.22,
    baseRate: 1.04,
    preferredVoices: ['sfg', 'iol', 'iom', 'rgf', 'samantha', 'victoria', 'karen', 'allison', 'female'],
  },
  robopaws: {
    avatarId: 'robopaws',
    name: 'Doraemon',
    category: 'cartoon',
    intendedGender: 'female',
    voiceCode: 'Doraemon',
    targetLocale: 'en-IN',
    basePitch: 1.12,
    baseRate: 0.98,
    preferredVoices: ['inf', 'ing', 'inm', 'cbf', 'ena', 'enc', 'lekha', 'veena', 'samantha', 'victoria', 'karen', 'female'],
  },
  spongebob: {
    avatarId: 'spongebob',
    name: 'SpongeBob',
    category: 'cartoon',
    intendedGender: 'male',
    voiceCode: 'SpongeBob',
    targetLocale: 'en-US',
    basePitch: 1.18,
    baseRate: 1.02,
    preferredVoices: ['iog', 'fred', 'tpf', 'alex', 'daniel', 'tpc', 'male'],
  },
  sparky: {
    avatarId: 'sparky',
    name: 'Chhota Bheem',
    category: 'cartoon',
    intendedGender: 'male',
    voiceCode: 'ChhotaBheem',
    targetLocale: 'en-IN',
    basePitch: 1.22,
    baseRate: 1.03,
    preferredVoices: ['ind', 'inc', 'inb', 'end', 'ene', 'rishi', 'ravi', 'prabhat', 'alex', 'male'],
  },
  koharu: {
    avatarId: 'koharu',
    name: 'Ninja Hattori',
    category: 'cartoon',
    intendedGender: 'male',
    voiceCode: 'NinjaHattori',
    targetLocale: 'en-US',
    basePitch: 1.20,
    baseRate: 1.04,
    preferredVoices: ['tpf', 'iog', 'fred', 'alex', 'daniel', 'tpc', 'male'],
  },
  haruto: {
    avatarId: 'haruto',
    name: 'Tom',
    category: 'cartoon',
    intendedGender: 'male',
    voiceCode: 'Tom',
    targetLocale: 'en-US',
    basePitch: 1.20,
    baseRate: 1.04,
    preferredVoices: ['tpc', 'fred', 'iog', 'tpf', 'alex', 'oliver', 'daniel', 'male'],
  },
  mao: {
    avatarId: 'mao',
    name: 'Ben 10',
    category: 'cartoon',
    intendedGender: 'male',
    voiceCode: 'BenTen',
    targetLocale: 'en-US',
    basePitch: 1.18,
    baseRate: 1.03,
    preferredVoices: ['tpf', 'iog', 'alex', 'daniel', 'david', 'tpc', 'male'],
  },
  puppy: {
    avatarId: 'puppy',
    name: 'Scooby-Doo',
    category: 'cartoon',
    intendedGender: 'male',
    voiceCode: 'ScoobyDoo',
    targetLocale: 'en-US',
    basePitch: 0.92,
    baseRate: 0.94,
    preferredVoices: ['tpc', 'daniel', 'oliver', 'david', 'alex', 'tpf', 'male'],
  },
};

// --- Direct Explicit Lookup for Google TTS & System Voices (Android & iOS) ---
const DIRECT_VOICE_GENDERS = {
  // US (American)
  // Female
  'en-us-x-sfg-local': 'female',
  'en-us-x-sfg-network': 'female',
  'en-us-x-iom-local': 'female',
  'en-us-x-iom-network': 'female',
  'en-us-x-iol-local': 'female',
  'en-us-x-iol-network': 'female',
  'en-us-x-rgf-local': 'female',
  'en-us-x-rgf-network': 'female',
  // Male
  'en-us-x-tpf-local': 'male',
  'en-us-x-tpf-network': 'male',
  'en-us-x-iog-local': 'male',
  'en-us-x-iog-network': 'male',
  'en-us-x-tpc-local': 'male',
  'en-us-x-tpc-network': 'male',
  
  // UK (British)
  // Female
  'en-gb-x-gba-local': 'female',
  'en-gb-x-gba-network': 'female',
  'en-gb-x-gbb-local': 'female',
  'en-gb-x-gbb-network': 'female',
  'en-gb-x-gbf-local': 'female',
  'en-gb-x-gbf-network': 'female',
  'en-gb-x-gbg-local': 'female',
  'en-gb-x-gbg-network': 'female',
  'en-gb-x-fis-local': 'female',
  'en-gb-x-fis-network': 'female',
  // Male
  'en-gb-x-gbc-local': 'male',
  'en-gb-x-gbc-network': 'male',
  'en-gb-x-gbd-local': 'male',
  'en-gb-x-gbd-network': 'male',
  'en-gb-x-rjs-local': 'male',
  'en-gb-x-rjs-network': 'male',

  // AU (Australian)
  // Female
  'en-au-x-aub-local': 'female',
  'en-au-x-aub-network': 'female',
  'en-au-x-auc-local': 'female',
  'en-au-x-auc-network': 'female',
  'en-au-x-auf-local': 'female',
  'en-au-x-auf-network': 'female',
  'en-au-x-aug-local': 'female',
  'en-au-x-aug-network': 'female',
  'en-au-x-aum-local': 'female',
  'en-au-x-aum-network': 'female',
  'en-au-x-cta-local': 'female',
  'en-au-x-cta-network': 'female',
  'en-au-x-ctc-local': 'female',
  'en-au-x-ctc-network': 'female',
  // Male
  'en-au-x-aud-local': 'male',
  'en-au-x-aud-network': 'male',
  'en-au-x-ctb-local': 'male',
  'en-au-x-ctb-network': 'male',
  'en-au-x-ctd-local': 'male',
  'en-au-x-ctd-network': 'male',

  // IN (Indian)
  // Female
  'en-in-x-inf-local': 'female',
  'en-in-x-inf-network': 'female',
  'en-in-x-ing-local': 'female',
  'en-in-x-ing-network': 'female',
  'en-in-x-inm-local': 'female',
  'en-in-x-inm-network': 'female',
  'en-in-x-cbf-local': 'female',
  'en-in-x-cbf-network': 'female',
  'en-in-x-ena-local': 'female',
  'en-in-x-ena-network': 'female',
  'en-in-x-enc-local': 'female',
  'en-in-x-enc-network': 'female',
  // Male
  'en-in-x-ind-local': 'male',
  'en-in-x-ind-network': 'male',
  'en-in-x-inb-local': 'male',
  'en-in-x-inb-network': 'male',
  'en-in-x-inc-local': 'male',
  'en-in-x-inc-network': 'male',
  'en-in-x-end-local': 'male',
  'en-in-x-end-network': 'male',

  // CA (Canadian)
  // Female
  'en-ca-x-caa-local': 'female',
  'en-ca-x-caa-network': 'female',
  'en-ca-x-cad-local': 'female',
  'en-ca-x-cad-network': 'female',
  // Male
  'en-ca-x-cab-local': 'male',
  'en-ca-x-cab-network': 'male',
  'en-ca-x-cac-local': 'male',
  'en-ca-x-cac-network': 'male',
};

// --- Classifier to detect if a voice is female ---
const isFemalePattern = (id, name, voiceGender) => {
  if (voiceGender) {
    const g = String(voiceGender).toLowerCase();
    if (g === 'female') return true;
    if (g === 'male') return false;
  }

  const normId = String(id || '').toLowerCase().replace(/^.*:/, '');
  if (DIRECT_VOICE_GENDERS[normId]) {
    return DIRECT_VOICE_GENDERS[normId] === 'female';
  }

  const combined = `${name || ''} ${id || ''}`.toLowerCase();

  // Explicit male indicator substrings (checked first)
  const maleKeywords = [
    'david', 'daniel', 'george', 'alex', 'bruce', 'tom', 'fred', 'oliver', 'rishi',
    'ravi', 'prabhat', 'aaron', 'guy', 'mister', 'mike', 'james', 'mark', 'paul',
    'richard', 'robert', 'stephen', 'william', 'russell', 'neel', 'lee', 'male', 'man',
    'tpf', 'iog', 'tpc', 'gbc', 'gbd', 'rjs', 'aud', 'ctb', 'ctd', 'ind', 'inc', 'inb', 'end', 'ene', 'enf'
  ];
  if (maleKeywords.some(k => combined.includes(k))) {
    return false;
  }

  // Explicit female indicator substrings
  const femaleKeywords = [
    'samantha', 'victoria', 'karen', 'tessa', 'moira', 'fiona', 'catherine', 'cathy',
    'kate', 'serena', 'nicky', 'alice', 'allison', 'joanna', 'ivy', 'kendra', 'kimberly',
    'salli', 'emma', 'amy', 'jessa', 'claire', 'vicki', 'lekha', 'veena', 'heera', 'zira',
    'hazel', 'zosia', 'zoe', 'susan', 'aria', 'jenny', 'natasha', 'female', 'woman',
    'sfg', 'iom', 'iol', 'rgf', 'gba', 'gbb', 'gbf', 'gbg', 'fis', 'aub', 'auc', 'auf', 'aug', 'aum',
    'cta', 'ctc', 'inf', 'ing', 'inm', 'cbf', 'ena', 'enc'
  ];
  if (femaleKeywords.some(k => combined.includes(k))) {
    return true;
  }

  // Indian locale voices default to female if not explicitly male
  if (combined.includes('en-in') || combined.includes('en_in') || combined.includes('india')) {
    return true;
  }

  // Wavenet / Neural / Standard letter check (A/C/E/G = Female, B/D/F = Male)
  const wavenetMatch = combined.match(/(wavenet|standard|neural2|journey)[-_ ]([a-g])/i);
  if (wavenetMatch) {
    const letter = wavenetMatch[2].toLowerCase();
    return ['a', 'c', 'e', 'g'].includes(letter);
  }

  // Siri Voice specific gender handling
  if (combined.includes('siri')) {
    if (combined.includes('voice 1') || combined.includes('voice 3') || combined.includes('voice_1') || combined.includes('voice_3')) {
      return false;
    }
    if (combined.includes('voice 2') || combined.includes('voice 4') || combined.includes('voice_2') || combined.includes('voice_4')) {
      return true;
    }
  }

  return false; // Default fallback to male
};

const sortVoices = (voices) =>
  [...voices].sort((a, b) => {
    const qA = (a.quality || '').toLowerCase();
    const qB = (b.quality || '').toLowerCase();
    const rank = (q) => q.includes('enhanced') ? 2 : q.includes('default') ? 1 : 0;
    if (rank(qB) !== rank(qA)) return rank(qB) - rank(qA);
    return (a.identifier || '').localeCompare(b.identifier || '');
  });

export const VoiceService = {
  getAvatarVoiceProfile: (avatarOrVoice) => {
    if (!avatarOrVoice) return AVATAR_VOICE_PROFILES.haru;
    const key = String(avatarOrVoice).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key.includes('maleteacher') || key.includes('teachermale') || key.includes('chitose') || key === 'male') {
      return AVATAR_VOICE_PROFILES.chitose;
    }
    if (key === 'haru' || key.includes('teacher')) {
      return AVATAR_VOICE_PROFILES.haru;
    }
    if (key.includes('spongebob') || key.includes('sponge') || key.includes('bob')) {
      return AVATAR_VOICE_PROFILES.spongebob;
    }
    if (key.includes('robo') || key.includes('paws') || key.includes('doraemon')) {
      return AVATAR_VOICE_PROFILES.robopaws;
    }
    if (key.includes('sparky') || key.includes('bheem') || key.includes('chhota') || key.includes('chhotabheem') || key.includes('motu') || key.includes('patlu')) {
      return AVATAR_VOICE_PROFILES.sparky;
    }
    if (key.includes('shizuku') || key.includes('shizuka')) {
      return AVATAR_VOICE_PROFILES.shizuku;
    }
    if (key.includes('hattori') || key.includes('ninja') || key.includes('ninjahattori') || key.includes('koharu')) {
      return AVATAR_VOICE_PROFILES.koharu;
    }
    if (key.includes('tom') || key.includes('tommy') || key.includes('haruto') || key.includes('tororo') || key.includes('cat') || key.includes('kitty')) {
      return AVATAR_VOICE_PROFILES.haruto;
    }
    if (key.includes('mao') || key.includes('ben') || key.includes('ben10') || key.includes('omnitrix') || key.includes('rexy') || key.includes('dino') || key.includes('trex')) {
      return AVATAR_VOICE_PROFILES.mao;
    }
    if (key.includes('wanko') || key.includes('dog') || key.includes('puppy') || key.includes('shiba') || key.includes('scooby') || key.includes('scoobydoo')) {
      return AVATAR_VOICE_PROFILES.puppy;
    }
    return AVATAR_VOICE_PROFILES[key] || AVATAR_VOICE_PROFILES.haru;
  },

  selectSystemVoiceForAvatar: (availableVoices, avatarProfile, userSelectedAccent = null) => {
    if (!availableVoices || availableVoices.length === 0) return null;

    // Only Female Teacher (haru) and Male Teacher (chitose) have access to regional voice overrides from Settings
    // All other 8 avatars (Doraemon, SpongeBob, Chhota Bheem, Ninja Hattori, Tom, Ben 10, Scooby-Doo, Shizuka) strictly use their own signature voices
    const isTeacherCoach = avatarProfile.avatarId === 'haru' || avatarProfile.avatarId === 'chitose';

    if (isTeacherCoach && userSelectedAccent && userSelectedAccent !== 'Default' && !userSelectedAccent.toLowerCase().includes('friendly')) {
      const accentVoice = VoiceService.selectSystemVoice(availableVoices, userSelectedAccent);
      if (accentVoice) return accentVoice;
    }

    const targetLoc = (avatarProfile.targetLocale || 'en-US').toLowerCase();
    const wantsMale = avatarProfile.intendedGender === 'male';
    const wantsFemale = avatarProfile.intendedGender === 'female';
    const charId = (avatarProfile.avatarId || '').toLowerCase();

    // Deterministic voice candidate scoring for this specific character
    const scoredVoices = availableVoices.map((v) => {
      const id = (v.identifier || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const lang = (v.language || '').toLowerCase().replace('_', '-');
      const isFemale = isFemalePattern(id, name, v.gender);

      let score = 0;

      // ── Mandatory Gender Guardrail ──
      // Strictly penalize gender mismatches
      if (wantsMale && isFemale) return { voice: v, score: -5000 };
      if (wantsFemale && !isFemale) return { voice: v, score: -5000 };

      // Base English candidate score
      if (lang.startsWith('en')) {
        score += 100;
      } else {
        score -= 1000;
      }

      // Locale alignment
      if (lang.startsWith(targetLoc)) {
        score += 180;
      } else if (lang.startsWith('en-us')) {
        score += 90;
      }

      // ── Character-Specific Acoustic Timbre Matches ──
      if (charId === 'robopaws' || charId.includes('doraemon')) {
        // High-register, warm, playful Indian voice (matching iconic Doraemon anime dub)
        if (lang.startsWith('en-in') || id.includes('en-in') || name.includes('india')) score += 300;
        if (id.includes('inf') || name.includes('lekha') || name.includes('veena')) score += 450;
        else if (id.includes('ing') || id.includes('inm') || id.includes('cbf') || id.includes('ena')) score += 350;
        else if (id.includes('samantha') || id.includes('sfg')) score += 180;
      } else if (charId === 'spongebob' || charId.includes('sponge')) {
        // High-register, energetic, youthful cartoon boy
        if (id.includes('iog') || name.includes('iog')) score += 450;
        else if (id.includes('fred') || name.includes('fred')) score += 400;
        else if (id.includes('tpf') || name.includes('tpf')) score += 350;
        else if (id.includes('alex') || name.includes('alex')) score += 220;
        else if (id.includes('tpc')) score += 180;
      } else if (charId === 'sparky' || charId.includes('bheem')) {
        // Courteous, bold young Indian hero
        if (lang.startsWith('en-in') || id.includes('en-in') || name.includes('india')) score += 300;
        if (id.includes('ind') || name.includes('rishi') || name.includes('prabhat')) score += 400;
        else if (id.includes('inc') || id.includes('inb') || name.includes('ravi')) score += 300;
        else if (id.includes('alex') || id.includes('tpf')) score += 120;
      } else if (charId === 'koharu' || charId.includes('hattori') || charId.includes('ninja')) {
        // Agile, disciplined youthful ninja hero
        if (id.includes('tpf') || id.includes('iog')) score += 400;
        else if (id.includes('fred') || name.includes('fred')) score += 300;
        else if (id.includes('alex') || name.includes('alex')) score += 250;
        else if (id.includes('daniel') || name.includes('daniel')) score += 200;
      } else if (charId === 'haruto' || charId.includes('tom')) {
        // Playful, clever classic cartoon cat
        if (id.includes('tpc') || id.includes('fred') || name.includes('fred')) score += 450;
        else if (id.includes('iog') || id.includes('tpf')) score += 320;
        else if (id.includes('oliver') || id.includes('alex')) score += 200;
      } else if (charId === 'mao' || charId.includes('ben')) {
        // Confident, adventurous American teen hero
        if (id.includes('tpf') || name.includes('tpf')) score += 400;
        else if (id.includes('alex') || name.includes('alex')) score += 320;
        else if (id.includes('iog') || id.includes('daniel')) score += 250;
        else if (id.includes('david') || name.includes('david')) score += 200;
      } else if (charId === 'puppy' || charId.includes('scooby')) {
        // Warm, goofy, relaxed Great Dane (loves deep male voices)
        if (id.includes('tpc') || id.includes('daniel') || name.includes('daniel')) score += 450;
        else if (id.includes('oliver') || name.includes('oliver')) score += 400;
        else if (id.includes('david') || name.includes('david') || id.includes('george')) score += 350;
        else if (id.includes('alex') || id.includes('tpf')) score += 200;
      } else if (charId === 'shizuku' || charId.includes('shizuka')) {
        // Sweet, cheerful academic mentor
        if (id.includes('sfg') || name.includes('sfg')) score += 450;
        else if (id.includes('samantha') || name.includes('samantha')) score += 400;
        else if (id.includes('victoria') || name.includes('victoria')) score += 350;
        else if (id.includes('iol') || id.includes('iom') || id.includes('karen')) score += 250;
      } else if (charId === 'haru' || charId.includes('teacher')) {
        // Clear, articulate teacher voice (switched from Doraemon)
        if (id.includes('zarvox') || name.includes('zarvox') || id.includes('robot')) score += 500;
        else if (id.includes('fred') || name.includes('fred')) score += 350;
        else if (id.includes('tpc') || id.includes('tpf')) score += 250;
        else if (id.includes('alex') || name.includes('alex')) score += 200;
        else if (id.includes('daniel') || name.includes('daniel')) score += 180;
      } else if (charId === 'chitose' || charId.includes('maleteacher')) {
        // Calm, patient, articulate Indian male teacher
        if (lang.startsWith('en-in') || id.includes('en-in') || name.includes('india')) score += 300;
        if (id.includes('ind') || name.includes('rishi') || name.includes('prabhat')) score += 450;
        else if (id.includes('inc') || id.includes('inb') || id.includes('end') || id.includes('ene')) score += 350;
        else if (id.includes('daniel') || id.includes('alex') || id.includes('tpf')) score += 180;
      }

      // Quality bonus
      const q = (v.quality || '').toLowerCase();
      if (q.includes('enhanced')) score += 40;
      if (q.includes('default')) score += 20;

      return { voice: v, score };
    });

    scoredVoices.sort((a, b) => b.score - a.score);
    const bestCandidate = scoredVoices.find((s) => s.score > 0);
    if (bestCandidate && bestCandidate.voice) {
      return bestCandidate.voice.identifier;
    }

    // ── Safe Fallback adhering strictly to requested gender ──
    const genderMatches = availableVoices.filter(v => {
      const id = (v.identifier || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const isFemale = isFemalePattern(id, name, v.gender);
      return wantsMale ? !isFemale : isFemale;
    });

    if (genderMatches.length > 0) {
      // First try target locale
      const locMatch = genderMatches.find(v => (v.language || '').toLowerCase().replace('_', '-').startsWith(targetLoc));
      if (locMatch) return locMatch.identifier;

      // Then any English
      const enMatch = genderMatches.find(v => (v.language || '').toLowerCase().startsWith('en'));
      if (enMatch) return enMatch.identifier;

      return genderMatches[0].identifier;
    }

    // Absolute fallback
    return availableVoices[0].identifier;
  },

  getVoiceProfile: (voiceCode) => {
    return VOICE_PROFILES.find((profile) => profile.code === voiceCode) || null;
  },

  resolveVoiceType: (voiceCode, onboardingVoiceStyle = 'Friendly') => {
    if (OnboardingVoiceService.isSystemDefault(voiceCode)) {
      return onboardingVoiceStyle || 'Friendly';
    }
    return voiceCode || 'Friendly';
  },

  getAvatarGender: (voiceType, onboardingVoiceStyle = 'Friendly') => {
    if (!voiceType) return 'female';
    const vt = String(voiceType).toLowerCase();
    if (vt === 'robopaws' || vt === 'robocat' || vt === 'robot' || vt === 'doraemon') return 'female';
    if (vt === 'chitose') return 'male';
    if (vt === 'haru' || vt === 'teacher') return 'male';
    if (vt === 'male') return 'male';
    if (vt === 'female') return 'female';
    if (vt.includes('male') && !vt.includes('female')) return 'male';
    if (vt.includes('female')) return 'female';
    const avatar = getAvatarById(voiceType);
    if (avatar && avatar.gender) return avatar.gender;
    if (OnboardingVoiceService.isSystemDefault(voiceType)) {
      const style = (onboardingVoiceStyle || 'Friendly').toLowerCase();
      if (style.includes('male') && !style.includes('female')) return 'male';
      return 'female';
    }
    return 'female';
  },

  getAvatarModel: (avatarOrVoice) => {
    if (!avatarOrVoice) return 'haru';
    return getAvatarById(avatarOrVoice).id;
  },

  getEffectiveGender: (resolvedVoice) => {
    const normalized = (resolvedVoice || '').toLowerCase();
    if (normalized.includes('male') && !normalized.includes('female')) return 'male';
    if (normalized.includes('female')) return 'female';

    return 'female';
  },

  getAvailableEnglishVoices: async (forceRefresh = false) => {
    if (!forceRefresh && _cachedEnglishVoices && _cachedEnglishVoices.length > 0) {
      return _cachedEnglishVoices;
    }

    if (_inFlightVoicesPromise) {
      return _inFlightVoicesPromise;
    }

    _inFlightVoicesPromise = (async () => {
      const maxRetries = 3;
      const retryDelays = [250, 600, 1200];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const voices = await Speech.getAvailableVoicesAsync();
          if (Array.isArray(voices) && voices.length > 0) {
            const enVoices = voices.filter(v => (v.language || '').toLowerCase().startsWith('en'));
            _cachedEnglishVoices = enVoices.length > 0 ? enVoices : voices;
            return _cachedEnglishVoices;
          }
        } catch (e) {
          const errStr = String(e?.message || e || '');
          const isTtsNotReady =
            errStr.includes('initialized') ||
            errStr.includes('getVoices') ||
            errStr.includes('Unable to get voices');

          // If Android TTS is still initializing, back off and retry
          if (isTtsNotReady && attempt < maxRetries) {
            await new Promise((res) => setTimeout(res, retryDelays[attempt] || 500));
            continue;
          }

          if (attempt === maxRetries) {
            console.log('[VoiceService] Device TTS ready with system fallback');
          }
        }
      }

      return _cachedEnglishVoices || [];
    })().finally(() => {
      _inFlightVoicesPromise = null;
    });

    return _inFlightVoicesPromise;
  },

  findBestVoice: (availableVoices, targetLocale, targetGender) => {
    if (!availableVoices || availableVoices.length === 0) {
      return { voice: null, isFallback: true };
    }

    const loc = targetLocale.toLowerCase().replace('_', '-');
    const getLoc = (v) => (v.language || '').toLowerCase().replace('_', '-');

    const localeVoices = sortVoices(
      availableVoices.filter(v => getLoc(v).startsWith(loc))
    );

    if (localeVoices.length > 0) {
      // Step 1: Match target gender
      const exact = localeVoices.find(v => {
        const id = (v.identifier || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        const isFemale = isFemalePattern(id, name, v.gender);
        return targetGender === 'female' ? isFemale : !isFemale;
      });
      if (exact) return { voice: exact, isFallback: false };

      // Step 2: Fallback for female target: find first locale voice that is NOT explicitly male
      if (targetGender === 'female') {
        const notExplicitlyMale = localeVoices.find(v => {
          const id = (v.identifier || '').toLowerCase();
          const name = (v.name || '').toLowerCase();
          const isMale = (v.gender && v.gender.toLowerCase() === 'male') ||
            name.includes('male') || id.includes('male') ||
            !isFemalePattern(id, name, v.gender);
          return !isMale;
        });
        if (notExplicitlyMale) return { voice: notExplicitlyMale, isFallback: true };
      }

      // Step 3: Fallback for male target: find first locale voice that is NOT explicitly female
      if (targetGender === 'male') {
        const notExplicitlyFemale = localeVoices.find(v => {
          const id = (v.identifier || '').toLowerCase();
          const name = (v.name || '').toLowerCase();
          const isFemale = isFemalePattern(id, name, v.gender);
          return !isFemale;
        });
        if (notExplicitlyFemale) return { voice: notExplicitlyFemale, isFallback: true };
      }

      // If female requested and locale has voices, return first locale voice
      if (targetGender === 'female') {
        return { voice: localeVoices[0], isFallback: true, fallbackReason: 'Locale default' };
      }
    }

    // Step 2: Match gender across any English locale (Guarantees Male voice when requested)
    const allEn = sortVoices(availableVoices.filter(v => getLoc(v).startsWith('en')));
    const sameGender = allEn.find(v => {
      const id = (v.identifier || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const isFemale = isFemalePattern(id, name, v.gender);
      return targetGender === 'female' ? isFemale : !isFemale;
    });
    if (sameGender) return { voice: sameGender, isFallback: true, fallbackReason: 'Any English same-gender' };

    return { voice: availableVoices[0], isFallback: true, fallbackReason: 'System fallback' };
  },

  // ── Dedicated System Default / Onboarding Tutor Voice Resolution ────────
  resolveSystemDefaultVoice: (availableVoices) => {
    if (!availableVoices || availableVoices.length === 0) return null;

    const MALE_IDENTIFIERS = [
      'iol', 'iom', 'iog', 'tpf', 'tpc', 'gbc', 'gbd', 'rjs',
      'ind', 'inc', 'inb', 'end', 'david', 'george', 'daniel',
      'alex', 'guy', 'male'
    ];

    const isExcludedMale = (v) => {
      const id = (v.identifier || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const gender = (v.gender || '').toLowerCase();
      if (gender === 'male') return true;
      return MALE_IDENTIFIERS.some(m => id.includes(m) || name.includes(m));
    };

    // 1. Google TTS US standard female tutor voice 'sfg' (Voice I) - highest priority
    const sfg = availableVoices.find(v => {
      const id = (v.identifier || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      return (id.includes('sfg') || name.includes('sfg')) && !isExcludedMale(v);
    });
    if (sfg) return sfg.identifier;

    // 2. Known female voices across Android / iOS
    const knownFemale = availableVoices.find(v => {
      const id = (v.identifier || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const hasFemaleId = id.includes('rgf') || id.includes('cbf') ||
                          id.includes('samantha') || id.includes('victoria') ||
                          id.includes('karen') || id.includes('zira') ||
                          name.includes('female') || id.includes('female');
      return hasFemaleId && !isExcludedMale(v);
    });
    if (knownFemale) return knownFemale.identifier;

    // 3. Any English voice with explicit gender === 'female' and not in male list
    const explicitFemale = availableVoices.find(v => {
      const lang = (v.language || '').toLowerCase().replace('_', '-');
      const g = (v.gender || '').toLowerCase();
      return lang.startsWith('en') && g === 'female' && !isExcludedMale(v);
    });
    if (explicitFemale) return explicitFemale.identifier;

    // 4. Any English voice that is NOT male
    const anyNonMaleEn = availableVoices.find(v => {
      const lang = (v.language || '').toLowerCase().replace('_', '-');
      return lang.startsWith('en') && !isExcludedMale(v);
    });
    if (anyNonMaleEn) return anyNonMaleEn.identifier;

    return null;
  },

  selectSystemVoice: (availableVoices, voiceCode) => {
    if (!availableVoices || availableVoices.length === 0) return null;

    const directMatch = availableVoices.find(v => v.identifier === voiceCode);
    if (directMatch) return directMatch.identifier;

    // ── Dedicated System Default / Onboarding Tutor Voice Resolution ────────
    if (OnboardingVoiceService.isSystemDefault(voiceCode)) {
      return VoiceService.resolveSystemDefaultVoice(availableVoices);
    }

    const gs = (voiceCode || '').toLowerCase();
    const isBritish = gs.includes('uk') || gs.includes('gb') || gs.includes('british');
    const isIndian = gs.includes('in') || gs.includes('indian');
    const isMale = gs.includes('male') && !gs.includes('female');

    // For IN Male specifically:
    if (isIndian && isMale) {
      // 1. Look for explicit Indian male voice
      const indianMale = availableVoices.find(v => {
        const id = (v.identifier || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        const lang = (v.language || '').toLowerCase().replace('_', '-');
        const isMaleVoice = !isFemalePattern(id, name, v.gender);
        return (lang.startsWith('en-in') || name.includes('india')) && isMaleVoice;
      });
      if (indianMale) return indianMale.identifier;

      // 2. If no Indian male voice installed, select confirmed English male voice (never a female voice)
      const confirmedEnglishMale = availableVoices.find(v => {
        const id = (v.identifier || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return !isFemalePattern(id, name, v.gender);
      });
      if (confirmedEnglishMale) return confirmedEnglishMale.identifier;
    }

    let targetGender = 'female';
    if (isMale) {
      targetGender = (isBritish || isIndian) ? 'male' : 'female';
    } else if (gs.includes('female')) {
      targetGender = (isBritish || isIndian) ? 'female' : 'male';
    }

    let targetLocale = 'en-us';
    if      (isBritish)                                      targetLocale = 'en-gb';
    else if (isIndian)                                       targetLocale = 'en-in';
    else if (gs.includes('au') || gs.includes('australian')) targetLocale = 'en-au';
    else if (gs.includes('ca') || gs.includes('canadian'))   targetLocale = 'en-ca';

    const mapping = VoiceService.findBestVoice(availableVoices, targetLocale, targetGender);
    let selected = mapping && mapping.voice ? mapping.voice.identifier : null;

    // Safety validation override: ensure gender matches targetGender
    if (selected) {
      const selectedVoiceObj = availableVoices.find(v => v.identifier === selected);
      if (selectedVoiceObj) {
        const id = (selectedVoiceObj.identifier || '').toLowerCase();
        const name = (selectedVoiceObj.name || '').toLowerCase();
        const isFemale = isFemalePattern(id, name, selectedVoiceObj.gender);

        if (targetGender === 'female' && !isFemale) {
          const anyFemale = availableVoices.find(v => {
            const vid = (v.identifier || '').toLowerCase();
            const vname = (v.name || '').toLowerCase();
            return isFemalePattern(vid, vname, v.gender);
          });
          if (anyFemale) selected = anyFemale.identifier;
        } else if (targetGender === 'male' && isFemale) {
          const anyMale = availableVoices.find(v => {
            const vid = (v.identifier || '').toLowerCase();
            const vname = (v.name || '').toLowerCase();
            return !isFemalePattern(vid, vname, v.gender);
          });
          if (anyMale) selected = anyMale.identifier;
        }
      }
    }

    return selected;
  },

  sanitizeTextForSpeech: (rawText) => {
    if (!rawText) return '';
    let t = String(rawText);

    // 0. Filter out reasoning / chain-of-thought blocks
    if (t.includes('Analyze User Input:') || t.includes('Identify Key Constraints:') || t.includes('Context:')) {
      const idx = t.lastIndexOf('\n\n');
      if (idx !== -1 && idx < t.length - 1) {
        t = t.substring(idx).trim();
      } else {
        t = '';
      }
    }

    // 1. If JSON, extract message or aiReply
    if (t.includes('{') && t.includes('}')) {
      try {
        const s = t.indexOf('{');
        const e = t.lastIndexOf('}');
        const parsed = JSON.parse(t.substring(s, e + 1));
        if (parsed.aiReply) t = parsed.aiReply;
        else if (parsed.message) t = parsed.message;
        else if (parsed.response) t = parsed.response;
      } catch (_) {}
    }

    // 2. Remove all bracketed tags e.g. [article], [grammar], [better_sentence], [vocabulary], etc.
    t = t.replace(/\[[^\]]*\]/g, '');

    // 3. Remove literal "dot dot dot", ellipses "...", "…", ".."
    t = t.replace(/\bdot\s*dot\s*dot\b/gi, '');
    t = t.replace(/\.{2,}/g, '');
    t = t.replace(/…/g, '');

    // 4. Remove Markdown markers & code fences
    t = t.replace(/```[\s\S]*?```/g, '');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/[*#_~]/g, '');

    // 5. Remove stage directions / parentheticals e.g. (laughs), (smiling), (1-2 sentences)
    t = t.replace(/\([^)]{1,40}\)/g, '');

    // 6. Remove Emojis & special symbols
    t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '');

    // 7. Clean up quotes, slashes, whitespace
    t = t.replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();

    // 8. Phonetic TTS pronunciation normalizations for cartoon characters
    t = t
      .replace(/\bDoraemon\b/g, "Doraymon")
      .replace(/\bdoraemon\b/g, "doraymon")
      .replace(/\bDoremon\b/g, "Doraymon")
      .replace(/\bdoremon\b/g, "doraymon")
      .replace(/\bg['’]day\b/gi, "Hello")
      .replace(/\bgood\s+day\b/gi, "Hello");

    return t;
  },

  getCharacterIntonation: (avatarId, text = '') => {
    if (!avatarId || !text) return { pitchOffset: 0.0, rateOffset: 0.0 };
    const key = String(avatarId).toLowerCase();
    const lower = String(text).toLowerCase().trim();

    // 1. Doraemon (Robotic, warm, helpful, gadget excitement)
    if (key.includes('robo') || key.includes('doraemon')) {
      if (lower.includes('!') || lower.includes('gadget') || lower.includes('pocket') || lower.includes('hurray') || lower.includes('wow') || lower.includes('awesome')) {
        return { pitchOffset: +0.03, rateOffset: +0.02 };
      }
      if (lower.includes('?') || lower.includes('what') || lower.includes('how') || lower.includes('problem')) {
        return { pitchOffset: +0.02, rateOffset: 0.0 };
      }
      if (lower.includes("don't worry") || lower.includes('here to help') || lower.includes('take it easy')) {
        return { pitchOffset: -0.02, rateOffset: -0.02 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    // 2. SpongeBob (Playful, energetic, friendly cartoon boy)
    if (key.includes('sponge') || key.includes('bob')) {
      if (lower.includes('!') || lower.includes('ready') || lower.includes('yay') || lower.includes('fun') || lower.includes('jellyfish') || lower.includes('burger')) {
        return { pitchOffset: +0.04, rateOffset: +0.03 };
      }
      if (lower.includes('haha') || lower.includes('hehe') || lower.includes('friend') || lower.includes('best day')) {
        return { pitchOffset: +0.03, rateOffset: +0.02 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    // 3. Chhota Bheem (Courageous, mighty Indian hero)
    if (key.includes('sparky') || key.includes('bheem')) {
      if (lower.includes('!') || lower.includes('ladoo') || lower.includes('dholakpur') || lower.includes('strong') || lower.includes('brave') || lower.includes('power')) {
        return { pitchOffset: +0.03, rateOffset: +0.02 };
      }
      if (lower.includes('well done') || lower.includes('great job') || lower.includes('keep going')) {
        return { pitchOffset: +0.02, rateOffset: +0.01 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    // 4. Ninja Hattori (Swift, disciplined ninja hero)
    if (key.includes('koharu') || key.includes('hattori') || key.includes('ninja')) {
      if (lower.includes('!') || lower.includes('ninja') || lower.includes('ding ding') || lower.includes('speed') || lower.includes('iga')) {
        return { pitchOffset: +0.03, rateOffset: +0.03 };
      }
      if (lower.includes('focus') || lower.includes('practice') || lower.includes('skill')) {
        return { pitchOffset: +0.01, rateOffset: +0.01 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    // 5. Tom (Playful, witty, classic cartoon cat)
    if (key.includes('haruto') || key.includes('tom')) {
      if (lower.includes('!') || lower.includes('haha') || lower.includes('mouse') || lower.includes('cheese') || lower.includes('catch')) {
        return { pitchOffset: +0.04, rateOffset: +0.03 };
      }
      if (lower.includes('clever') || lower.includes('trick') || lower.includes('smart')) {
        return { pitchOffset: +0.02, rateOffset: +0.01 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    // 6. Ben 10 (Heroic, adventurous American teen hero)
    if (key.includes('mao') || key.includes('ben')) {
      if (lower.includes('hero time') || lower.includes('alien') || lower.includes('omnitrix') || lower.includes('transform') || lower.includes('awesome') || lower.includes('!')) {
        return { pitchOffset: +0.03, rateOffset: +0.02 };
      }
      if (lower.includes("we've got this") || lower.includes('no sweat') || lower.includes('piece of cake')) {
        return { pitchOffset: +0.01, rateOffset: +0.01 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    // 7. Scooby-Doo (Goofy, warm cartoon Great Dane)
    if (key.includes('puppy') || key.includes('scooby') || key.includes('wanko')) {
      if (lower.includes('ruh-roh') || lower.includes('scooby snack') || lower.includes('mystery') || lower.includes('ghost') || lower.includes('monster')) {
        return { pitchOffset: +0.04, rateOffset: +0.02 };
      }
      if (lower.includes('yum') || lower.includes('snack') || lower.includes('hungry') || lower.includes('hehe')) {
        return { pitchOffset: +0.02, rateOffset: +0.01 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    // 8. Shizuka (Sweet, academic mentor)
    if (key.includes('shizuku') || key.includes('shizuka')) {
      if (lower.includes('!') || lower.includes('wonderful') || lower.includes('excellent') || lower.includes('beautiful')) {
        return { pitchOffset: +0.02, rateOffset: +0.01 };
      }
      if (lower.includes("let's see") || lower.includes('grammar') || lower.includes('rule')) {
        return { pitchOffset: 0.0, rateOffset: -0.02 };
      }
      return { pitchOffset: 0.0, rateOffset: 0.0 };
    }

    return { pitchOffset: 0.0, rateOffset: 0.0 };
  },

  speak: async (text, {
    isMuted        = false,
    avatarId       = null,
    voiceType      = null,
    speechSpeed    = null,
    availableVoices = [],
    pitch          = null,
    rate           = null,
    onStart,
    onDone,
    onError,
  } = {}) => {
    if (isMuted) return;

    const cleanedText = VoiceService.sanitizeTextForSpeech(text);
    if (!cleanedText) return;

    // 1. Resolve active avatar model (explicit param -> voiceType if avatar -> cached model -> AsyncStorage)
    let effectiveAvatarId = avatarId;
    if (!effectiveAvatarId && voiceType && AVATAR_VOICE_PROFILES[String(voiceType).toLowerCase()]) {
      effectiveAvatarId = voiceType;
    }
    if (!effectiveAvatarId) {
      try {
        const cached = typeof getCachedAvatarModel === 'function' ? getCachedAvatarModel() : null;
        const saved = cached || (await AsyncStorage.getItem('speakmate_avatar_model'));
        if (saved) effectiveAvatarId = saved;
      } catch (_) {}
    }
    const avatarProfile = VoiceService.getAvatarVoiceProfile(effectiveAvatarId);

    // 2. Load saved speech speed from AsyncStorage if not provided explicitly
    let effectiveSpeed = speechSpeed;
    if (effectiveSpeed === null || effectiveSpeed === undefined || isNaN(effectiveSpeed)) {
      try {
        const savedSpeed = await AsyncStorage.getItem('speakmate_voice_speed');
        if (savedSpeed) {
          effectiveSpeed = parseFloat(savedSpeed);
        }
      } catch (e) {
        // Fallback
      }
    }
    if (!effectiveSpeed || isNaN(effectiveSpeed)) {
      effectiveSpeed = 1.0;
    }

    // ── 3. Resolve user settings accent preference ───────────────────────────
    let resolvedVoice = voiceType || avatarProfile.voiceCode;
    const isSysDefault = OnboardingVoiceService.isSystemDefault(resolvedVoice);
    let voiceConfig = null;

    if (isSysDefault) {
      voiceConfig = await OnboardingVoiceService.load();
      resolvedVoice = voiceConfig?.style || 'Friendly';
    }

    // ── 4. Ensure we have system voices ───────────────────────────────────────
    let voices = availableVoices;
    if (!voices || voices.length === 0) {
      voices = await VoiceService.getAvailableEnglishVoices();
    }

    // ── 5. Pitch & rate based on centralized avatar profile + character intonation ─
    const speedMultiplier = Number(effectiveSpeed) || 1.0;
    const intonation = VoiceService.getCharacterIntonation(avatarProfile.avatarId, cleanedText);

    let effectivePitch = pitch !== null && pitch !== undefined ? Number(pitch) : (avatarProfile.basePitch + intonation.pitchOffset);
    let effectiveRate  = rate !== null && rate !== undefined ? Number(rate) : ((avatarProfile.baseRate * speedMultiplier) + intonation.rateOffset);

    effectivePitch = Math.max(0.82, Math.min(1.35, effectivePitch));
    effectiveRate  = Math.max(0.80, Math.min(1.25, effectiveRate));

    // ── 6. Select system voice for avatar ─────────────────────────────────────
    let systemVoiceId = VoiceService.selectSystemVoiceForAvatar(voices, avatarProfile, isSysDefault ? null : resolvedVoice);
    if (!systemVoiceId && isSysDefault) {
      systemVoiceId = VoiceService.resolveSystemDefaultVoice(voices);
    }
    if (!systemVoiceId) {
      systemVoiceId = VoiceService.selectSystemVoice(voices, resolvedVoice);
    }

    // ── 7. Adaptive pitch calibration for character authenticity ─────────────
    if (systemVoiceId && voices && voices.length > 0) {
      const voiceObj = voices.find(v => v.identifier === systemVoiceId);
      if (voiceObj) {
        const vid = (voiceObj.identifier || '').toLowerCase();
        const vname = (voiceObj.name || '').toLowerCase();
        const isActuallyFemale = isFemalePattern(vid, vname, voiceObj.gender);

        // Strict Gender Safety Shift
        if (avatarProfile.intendedGender === 'male' && isActuallyFemale) {
          effectivePitch = Math.min(effectivePitch, 0.86); // Shift down if forced on female hardware voice
        } else if (avatarProfile.intendedGender === 'female' && !isActuallyFemale) {
          effectivePitch = Math.max(effectivePitch, 1.16); // Shift up if forced on male hardware voice
        }

        // Deep voice lift for youthful male cartoon characters
        const isDeepMaleVoice = vid.includes('david') || vname.includes('david') || vid.includes('george') || vname.includes('george') || vid.includes('mark');
        const isYouthfulBoyAvatar = ['spongebob', 'mao', 'koharu', 'haruto'].includes(avatarProfile.avatarId);
        if (isYouthfulBoyAvatar && isDeepMaleVoice) {
          effectivePitch = Math.max(effectivePitch, 1.22);
        }

        // Scoop pitch down for Scooby-Doo Great Dane warmth
        if (avatarProfile.avatarId === 'puppy') {
          effectivePitch = Math.min(effectivePitch, 0.92);
        }
      }
    }

    // ── 8. Build TTS options ──────────────────────────────────────────────────
    const targetLocale = avatarProfile.targetLocale || 'en-US';
    const options = {
      rate: effectiveRate,
      pitch: effectivePitch,
      language: targetLocale,
      onStart,
      onDone,
      onError: (err) => {
        console.warn('[VoiceService] TTS playback error:', err);
        if (onError) onError(err);
      },
    };

    if (systemVoiceId) {
      options.voice = systemVoiceId;
    }

    // ── 9. Speak with Automatic Chunking (Safeguards Android 4000 char TTS limit) ──
    const chunks = chunkTextForTTS(cleanedText, 2000);
    const sessionId = ++currentUtteranceSession;

    try {
      Speech.stop();
    } catch (_) {}

    if (chunks.length === 1) {
      try {
        const res = Speech.speak(chunks[0], options);
        if (res && typeof res.catch === 'function') {
          res.catch((err) => {
            console.warn('[VoiceService] Speech.speak rejected:', err);
            if (options.onError) options.onError(err);
          });
        }
      } catch (e) {
        console.warn('[VoiceService] Speech.speak failed:', e);
        if (onError) onError(e);
      }
      return;
    }

    // Multi-chunk sequential playback
    let currentIdx = 0;
    const speakNextChunk = () => {
      if (sessionId !== currentUtteranceSession) return;
      if (currentIdx >= chunks.length) {
        if (onDone) onDone();
        return;
      }

      const chunk = chunks[currentIdx];
      const isFirst = currentIdx === 0;

      const chunkOptions = {
        ...options,
        onStart: isFirst ? onStart : undefined,
        onDone: () => {
          if (sessionId !== currentUtteranceSession) return;
          currentIdx++;
          speakNextChunk();
        },
        onError: (err) => {
          if (sessionId !== currentUtteranceSession) return;
          console.warn('[VoiceService] Multi-chunk TTS error:', err);
          if (options.onError) options.onError(err);
        },
      };

      try {
        const res = Speech.speak(chunk, chunkOptions);
        if (res && typeof res.catch === 'function') {
          res.catch((err) => {
            console.warn('[VoiceService] Speech.speak rejected in chunk:', err);
            if (chunkOptions.onError) chunkOptions.onError(err);
          });
        }
      } catch (e) {
        console.warn('[VoiceService] Speech.speak chunk failed:', e);
        if (options.onError) options.onError(e);
      }
    };

    speakNextChunk();
  },

  speakSequential: async (segments = [], options = {}, pauseMs = 400) => {
    if (!segments || segments.length === 0) return;
    if (options.isMuted) return;

    try {
      Speech.stop();
    } catch {}

    const cleanSegments = segments
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);

    if (cleanSegments.length === 0) return;

    for (let i = 0; i < cleanSegments.length; i++) {
      const seg = cleanSegments[i];
      await new Promise((resolve) => {
        let finished = false;
        const done = () => {
          if (!finished) {
            finished = true;
            resolve();
          }
        };

        // Safety fallback timeout in case TTS onDone event fails on some Android devices
        const timeout = setTimeout(done, 12000);

        VoiceService.speak(seg, {
          ...options,
          onDone: () => {
            clearTimeout(timeout);
            done();
          },
          onError: () => {
            clearTimeout(timeout);
            done();
          },
        });
      });

      if (i < cleanSegments.length - 1) {
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    }
  },

  stop: () => {
    currentUtteranceSession++;
    try {
      Speech.stop();
    } catch (e) {
      console.warn('[VoiceService] Speech.stop failed:', e);
    }
  },
};
