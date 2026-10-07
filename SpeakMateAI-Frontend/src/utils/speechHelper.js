// src/utils/speechHelper.js
import { EventBus, AVATAR_EVENTS } from "../services/live2d/EventBus";
import { getPrimaryVisemeForWord } from "./PhoneticVisemeEngine";
import { getAvatarById } from "../config/AvatarCatalog";

export const VOICE_PROFILES = [
  { code: 'US Male', accent: 'American', locale: 'en-US', gender: 'male', label: 'American - Male', previewText: 'Hello, I am your American Male English tutor.' },
  { code: 'US Female', accent: 'American', locale: 'en-US', gender: 'female', label: 'American - Female', previewText: 'Hello, I am your American Female English tutor.' },
  { code: 'UK Male', accent: 'British', locale: 'en-GB', gender: 'male', label: 'British - Male', previewText: 'Hello, I am your British Male English tutor.' },
  { code: 'UK Female', accent: 'British', locale: 'en-GB', gender: 'female', label: 'British - Female', previewText: 'Hello, I am your British Female English tutor.' },
  { code: 'AU Male', accent: 'Australian', locale: 'en-AU', gender: 'male', label: 'Australian - Male', previewText: 'Hello, I am your Australian Male English tutor.' },
  { code: 'AU Female', accent: 'Australian', locale: 'en-AU', gender: 'female', label: 'Australian - Female', previewText: 'Hello, I am your Australian Female English tutor.' },
  { code: 'IN Male', accent: 'Indian', locale: 'en-IN', gender: 'male', label: 'Indian - Male', previewText: 'Hello, I am your Indian Male English tutor.' },
  { code: 'IN Female', accent: 'Indian', locale: 'en-IN', gender: 'female', label: 'Indian - Female', previewText: 'Hello, I am your Indian Female English tutor.' },
  { code: 'SpongeBob', accent: 'Cartoon Boy', locale: 'en-US', gender: 'male', label: 'SpongeBob (Youthful Boy)', previewText: 'Hey! It is really nice to meet you! Let us practice English together!' },
  { code: 'Shizuka', accent: 'Academic Mentor', locale: 'en-US', gender: 'female', label: 'Shizuka (Academic Mentor)', previewText: "Hii, I am Shizuka, your AI speaking coach. Let's practice English together!" },
  { code: 'Shizuku', accent: 'Academic Mentor', locale: 'en-US', gender: 'female', label: 'Shizuka (Academic Mentor)', previewText: "Hii, I am Shizuka, your AI speaking coach. Let's practice English together!" },
  { code: 'Doraemon', accent: 'Robotic Male', locale: 'en-US', gender: 'male', label: 'Doraemon (Robotic Male Voice)', previewText: "Hii, I am Dohraymon, your AI speaking coach. Let's practice English together!" },
  { code: 'Robo-Paws', accent: 'Robotic Male', locale: 'en-US', gender: 'male', label: 'Doraemon (Robotic Male Voice)', previewText: "Hii, I am Dohraymon, your AI speaking coach. Let's practice English together!" },
  { code: 'Motu', accent: 'Cartoon Kids', locale: 'en-IN', gender: 'male', label: 'Motu (Cartoon Friend)', previewText: 'Arey wah, dost! I am Motu from Furfuri Nagar! Let us practice English with lots of fun and laughter!' },
  { code: 'Sparky', accent: 'Indian Hero', locale: 'en-IN', gender: 'male', label: 'Chhota Bheem (Young Hero)', previewText: "Hello! I am Chhota Bheem from Dholakpur! Let's practice English together!" },
  { code: 'Mao', accent: 'American Hero', locale: 'en-US', gender: 'male', label: 'Ben 10 (Alien Hero)', previewText: "Hello! I'm Ben 10! It's hero time! Let's practice English together!" },
  { code: 'BenTen', accent: 'American Hero', locale: 'en-US', gender: 'male', label: 'Ben 10 (Alien Hero)', previewText: "Hello! I'm Ben 10! It's hero time! Let's practice English together!" },
  { code: 'Koharu', accent: 'Cartoon Youth Hero', locale: 'en-US', gender: 'male', label: 'Ninja Hattori (Youth Hero Voice)', previewText: 'Hello! My name is Ninja Hattori! Let us practice English together!' },
  { code: 'NinjaHattori', accent: 'Cartoon Youth Hero', locale: 'en-US', gender: 'male', label: 'Ninja Hattori (Youth Hero Voice)', previewText: 'Hello! My name is Ninja Hattori! Let us practice English together!' },
  { code: 'Haruto', accent: 'Classic Cartoon Cat', locale: 'en-US', gender: 'male', label: 'Tom (Classic Cartoon Cat)', previewText: "Hello! I'm Tom! Let's practice English together with some fun and clever conversations!" },
  { code: 'Puppy', accent: 'Cartoon Dog', locale: 'en-US', gender: 'male', label: 'Scooby-Doo (Playful Mystery Dog)', previewText: 'Ruh-roh! Hello! I am Scooby-Doo! Let us practice English together!' },
  { code: 'Wanko', accent: 'Cartoon Dog', locale: 'en-US', gender: 'male', label: 'Scooby-Doo (Playful Mystery Dog)', previewText: 'Ruh-roh! Hello! I am Scooby-Doo! Let us practice English together!' },
  { code: 'ScoobyDoo', accent: 'Cartoon Dog', locale: 'en-US', gender: 'male', label: 'Scooby-Doo (Playful Mystery Dog)', previewText: 'Ruh-roh! Hello! I am Scooby-Doo! Let us practice English together!' },
  { code: 'Teacher', accent: 'Indian', locale: 'en-IN', gender: 'female', label: 'Teacher (Articulate & Warm)', previewText: 'Hello! Welcome to SpeakMate. Today, we are going to practice speaking clearly and confidently.' },
  { code: 'MaleTeacher', accent: 'Indian', locale: 'en-IN', gender: 'male', label: 'Male Teacher (Articulate & Calm)', previewText: 'Hello! Welcome to SpeakMate. Today, we are going to practice speaking clearly and confidently in English.' },
  { code: 'Default', accent: 'System Default', locale: 'en-US', gender: 'female', label: 'System Default', previewText: 'Hello, I am your System Default English tutor.' },
];

export const ACCENT_LIST = [
  { code: 'US', label: 'American English (US)', flag: '🇺🇸' },
  { code: 'UK', label: 'British English (UK)', flag: '🇬🇧' },
  { code: 'AU', label: 'Australian English (AU)', flag: '🇦🇺' },
  { code: 'IN', label: 'Indian English (IN)', flag: '🇮🇳' },
];

export const VOICE_PERSONAS = [
  {
    key: "Friendly",
    label: "Friendly Persona",
    icon: "💬",
    desc: "Warm, supportive, and encouraging tone",
    pitch: 1.15,
    rate: 1.0,
    gender: "female",
    previewText: "Hello, I am your Friendly Persona English tutor.",
  },
  {
    key: "Professional",
    label: "Professional Executive",
    icon: "💼",
    desc: "Formal, polished business tone",
    pitch: 0.9,
    rate: 0.9,
    gender: "male",
    previewText: "Hello, I am your Professional Executive English tutor.",
  },
  {
    key: "Energetic",
    label: "Energetic Coach",
    icon: "⚡",
    desc: "High energy, fast-paced practice",
    pitch: 1.15,
    rate: 1.2,
    gender: "female",
    previewText: "Hello, I am your Energetic Coach English tutor.",
  },
  {
    key: "Calm",
    label: "Calm Tutor",
    icon: "🌧️",
    desc: "Relaxed, patient guidance and soft pace",
    pitch: 0.95,
    rate: 0.85,
    gender: "male",
    previewText: "Hello, I am your Calm Tutor English tutor.",
  },
  {
    key: "Teacher",
    label: "Patient Teacher",
    icon: "🏫",
    desc: "Detailed corrections and step-by-step guidance",
    pitch: 1.05,
    rate: 0.95,
    gender: "female",
    previewText: "Hello, I am your Patient Teacher English tutor.",
  },
  {
    key: "Native Speaker",
    label: "Native Speaker",
    icon: "🌐",
    desc: "Natural, fluent conversational flow",
    pitch: 1.0,
    rate: 1.05,
    gender: "male",
    previewText: "Hello, I am your Native Speaker English tutor.",
  },
];

export const isKnownMaleVoiceName = (voiceName = "") => {
  const name = String(voiceName).toLowerCase();
  const MALE_NAMES = [
    "david", "guy", "mark", "alex", "tom", "chris", "george", "james",
    "ryan", "oliver", "daniel", "william", "russell", "prabhat", "rishi",
    "ravi", "male", "fred", "bruce", "ralph", "junior", "albert", "steffan",
    "sam", "paul", "john", "richard", "charles", "edward", "brian", "kevin",
    "eric", "jason", "justin"
  ];
  return MALE_NAMES.some((k) => name.includes(k));
};

export const isKnownFemaleVoiceName = (voiceName = "") => {
  const name = String(voiceName).toLowerCase();
  const FEMALE_NAMES = [
    "jenny", "zira", "samantha", "victoria", "karen", "susan", "sonia",
    "hazel", "fiona", "kate", "serena", "natasha", "catherine", "libby",
    "mia", "annette", "neerja", "veena", "heera", "female", "woman", "girl",
    "aria", "ana", "kalpana", "ananya"
  ];
  return FEMALE_NAMES.some((k) => name.includes(k));
};

export const selectSpongeBobBoyVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  // Score candidate voices deterministically according to SB4 criteria:
  // 1. English language
  // 2. Male voice
  // 3. Naturally youthful, gentle, warm tone (Guy, Ryan, Christopher, Steffan, Google UK Male, Alex, Daniel)
  // 4. Clear English pronunciation
  // 5. Avoid deep, overly mature, authoritative adult narrator voices (lower priority for David, etc.)
  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strict rejection of female voices
    if (isKnownFemaleVoiceName(name)) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Base English score
    score += 100;

    // Locale preference
    if (lang === "en-us") {
      score += 40;
    } else if (lang === "en-gb" || lang === "en-au" || lang === "en-ca") {
      score += 25;
    }

    // ── Tier 1: Naturally Youthful & Conversational Male Voices ──
    if (name.includes("guy")) {
      score += 160; // Microsoft Guy (Natural / Online / Desktop) - Top youthful, friendly boy candidate
    } else if (name.includes("ryan")) {
      score += 150; // Microsoft Ryan - Clear, bright youthful British male
    } else if (name.includes("christopher") || name.includes("steffan") || name.includes("eric")) {
      score += 140; // High-clarity youthful male voices
    } else if (name.includes("google uk english male")) {
      score += 130; // Crisp, bright youthful tone
    } else if (name.includes("alex")) {
      score += 120; // Apple Alex - Natural conversational clarity
    } else if (name.includes("daniel")) {
      score += 110; // Daniel - Clear British young male
    } else if (name.includes("mark")) {
      score += 85;  // Microsoft Mark - Lighter timbre
    } else if (name.includes("david")) {
      score += 60;  // Microsoft David - Reliable Windows desktop standard (tuned with pitch lift)
    } else if (name.includes("male") || isKnownMaleVoiceName(name)) {
      score += 40;  // Generic male English voice
    }

    // Quality bonus for Natural / Online / Neural voices
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) {
      score += 30;
    }

    // Local stability bonus
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  // Safe fallback to first male English voice or first English voice
  const fallbackMale = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && isKnownMaleVoiceName(v.name));
  return fallbackMale || voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) || voices[0];
};

export const getSpongeBobIntonation = (text = "") => {
  const lower = String(text).toLowerCase().trim();

  // 1. Excited / Surprised / Celebratory
  // e.g. "Really?! That's awesome!", "Wow! You did it!", "That's a great answer! Nice job!", "Haha! That was a good one!"
  if (
    lower.includes("wow") ||
    lower.includes("really") ||
    lower.includes("wait...") ||
    lower.includes("already knew") ||
    lower.includes("awesome") ||
    lower.includes("you did it") ||
    lower.includes("excellent") ||
    lower.includes("great answer") ||
    lower.includes("nice job") ||
    lower.includes("we've got this") ||
    lower.includes("pretty cool") ||
    lower.includes("getting better") ||
    (lower.includes("!") && (lower.includes("cool") || lower.includes("haha") || lower.includes("hey") || lower.includes("good one")))
  ) {
    return { pitchOffset: +0.04, rateOffset: +0.02, mood: 'excited' };
  }

  // 2. Gentle / Reassuring / Patient
  // e.g. "Don't worry, I'll help you.", "Take your time. There's no hurry.", "Okay, okay... let's try it again!"
  if (
    lower.includes("don't worry") ||
    lower.includes("take your time") ||
    lower.includes("no hurry") ||
    lower.includes("okay, okay") ||
    lower.includes("let's try that again") ||
    lower.includes("try it again") ||
    lower.includes("i'll help you") ||
    lower.includes("carefully")
  ) {
    return { pitchOffset: -0.03, rateOffset: -0.03, mood: 'gentle' };
  }

  // 3. Funny / Playful / Humble
  // e.g. "Oops! I think I got that one wrong.", "Uh-oh! I think we need to try that again."
  if (
    lower.includes("oops") ||
    lower.includes("uh-oh") ||
    lower.includes("mistake") ||
    lower.includes("wrong")
  ) {
    return { pitchOffset: +0.02, rateOffset: -0.01, mood: 'playful' };
  }

  // 4. Default: Friendly, warm, approachable conversational
  return { pitchOffset: 0.0, rateOffset: 0.0, mood: 'friendly' };
};

export const selectChhotaBheemVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  // Score candidate voices deterministically according to CB4 criteria:
  // 1. English language
  // 2. Male voice (strictly reject female voices)
  // 3. Preferred language priority: en-IN -> en-US -> en-GB -> other English
  // 4. Youthful, heroic, confident, cheerful quality
  // 5. Never depend on a single browser-specific voice name
  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strict rejection of female voices
    if (isKnownFemaleVoiceName(name)) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Base English score
    score += 100;

    // ── Primary Priority: Indian-English (en-IN) Male Voices ──
    const isIndian = lang === "en-in" || name.includes("india") || name.includes("indian");
    if (isIndian) {
      score += 250; // Decisive preference for en-IN
      if (name.includes("prabhat")) {
        score += 80; // Microsoft Prabhat Online (Natural) - High clarity, youthful Indian English
      } else if (name.includes("ravi")) {
        score += 70; // Microsoft Ravi - Windows Desktop standard en-IN male
      } else if (name.includes("rishi")) {
        score += 60; // Microsoft Rishi - en-IN male
      }
    } else if (lang === "en-us") {
      score += 40;
    } else if (lang === "en-gb" || lang === "en-au") {
      score += 25;
    }

    // ── Secondary Priority: Youthful & Conversational Male Timbre Fallbacks ──
    if (name.includes("guy")) {
      score += 60; // Microsoft Guy (Natural) - Warm, bright, friendly boy tone
    } else if (name.includes("ryan")) {
      score += 55; // Microsoft Ryan - Clear young British male
    } else if (name.includes("christopher") || name.includes("steffan")) {
      score += 50;
    } else if (name.includes("google uk english male")) {
      score += 45;
    } else if (name.includes("alex")) {
      score += 40;
    } else if (name.includes("mark")) {
      score += 35; // Microsoft Mark - lighter US male
    } else if (name.includes("george")) {
      score += 30; // Microsoft George - clear British male
    } else if (name.includes("david")) {
      score += 20; // Microsoft David - reliable desktop standard
    } else if (name.includes("male") || isKnownMaleVoiceName(name)) {
      score += 15;
    }

    // Quality bonus for Natural / Online / Neural voices
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) {
      score += 30;
    }

    // Local service stability bonus
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  // Safe fallback to first male English voice or first English voice
  const fallbackMale = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && isKnownMaleVoiceName(v.name));
  return fallbackMale || voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) || voices[0];
};

export const getChhotaBheemIntonation = (text = "") => {
  const lower = String(text).toLowerCase().trim();

  // 1. Excited / Celebratory / High-Energy Heroic
  // e.g. "Come on!", "Ready for the next question?", "That's a fantastic answer!", "Excellent!", "Awesome!"
  if (
    lower.includes("come on") ||
    lower.includes("fantastic") ||
    lower.includes("excellent") ||
    lower.includes("awesome") ||
    lower.includes("super") ||
    lower.includes("you did it") ||
    lower.includes("great job") ||
    lower.includes("ready for") ||
    (lower.includes("!") && (lower.includes("let's go") || lower.includes("hurray") || lower.includes("yay") || lower.includes("wow") || lower.includes("bravo")))
  ) {
    return { pitchOffset: +0.04, rateOffset: +0.02, mood: "excited" };
  }

  // 2. Calm / Gentle / Reassuring
  // e.g. "Take your time", "Speak clearly", "Don't worry", "No rush", "Relax"
  if (
    lower.includes("don't worry") ||
    lower.includes("take your time") ||
    lower.includes("speak clearly") ||
    lower.includes("no hurry") ||
    lower.includes("no rush") ||
    lower.includes("relax") ||
    lower.includes("slowly")
  ) {
    return { pitchOffset: -0.02, rateOffset: -0.03, mood: "calm" };
  }

  // 3. Encouraging / Confident / Supportive
  // e.g. "You are doing really well.", "Keep going.", "We can try again.", "You can do it."
  if (
    lower.includes("really well") ||
    lower.includes("keep going") ||
    lower.includes("try again") ||
    lower.includes("you can do it") ||
    lower.includes("good job") ||
    lower.includes("well done") ||
    lower.includes("proud of you")
  ) {
    return { pitchOffset: +0.02, rateOffset: 0.0, mood: "encouraging" };
  }

  // 4. Playful / Lively
  // e.g. "Let's learn something new", "Haha", "Fun", "Ready"
  if (
    lower.includes("something new") ||
    lower.includes("haha") ||
    lower.includes("play") ||
    lower.includes("fun") ||
    lower.includes("game")
  ) {
    return { pitchOffset: +0.03, rateOffset: +0.01, mood: "playful" };
  }

  // 5. Default: Warm, conversational, youthful
  return { pitchOffset: 0.0, rateOffset: 0.0, mood: "normal" };
};

export const selectBenTenBoyVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  // Score candidate voices deterministically according to B4 criteria:
  // 1. English language
  // 2. Male voice (strictly reject female voices)
  // 3. Preferred language priority: en-US (primary American English) -> en-CA -> en-GB / en-AU -> other English
  // 4. Youthful, energetic, confident, heroic, adventurous quality (Guy, Eric, Christopher, Alex, Mark, David)
  // 5. Never depend on a single browser-specific voice name; robust deterministic fallback
  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strict rejection of female voices
    if (isKnownFemaleVoiceName(name)) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Base English score
    score += 100;

    // ── Primary Priority: American-English (en-US) Male Voices ──
    const isAmerican = lang === "en-us" || name.includes("united states") || name.includes("us english");
    if (isAmerican) {
      score += 260; // Decisive preference for en-US
      if (name.includes("guy")) {
        score += 120; // Microsoft Guy (Natural / Online / Desktop) - Top youthful, energetic, confident American male
      } else if (name.includes("eric")) {
        score += 110; // Microsoft Eric - Clear, youthful American male
      } else if (name.includes("christopher")) {
        score += 100; // Microsoft Christopher - High-clarity natural American male
      } else if (name.includes("google us english")) {
        score += 90;  // Google US English - Clean, energetic American tone
      } else if (name.includes("alex")) {
        score += 85;  // Apple Alex - Clear conversational American male
      } else if (name.includes("mark")) {
        score += 75;  // Microsoft Mark - Lighter timbre US male
      } else if (name.includes("david")) {
        score += 65;  // Microsoft David - Reliable Windows desktop standard en-US male
      }
    } else if (lang === "en-ca") {
      score += 50;
    } else if (lang === "en-gb" || lang === "en-au") {
      score += 30;
      if (name.includes("ryan")) {
        score += 40; // Microsoft Ryan - Clear young British male fallback
      }
    }

    // Secondary male name match if not already boosted
    if (isKnownMaleVoiceName(name) || name.includes("male")) {
      score += 25;
    }

    // Quality bonus for Natural / Online / Neural voices
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) {
      score += 30;
    }

    // Local service stability bonus
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  // Safe fallback to first male en-US voice, then first male English, then first English
  const fallbackUsMale = voices.find((v) => (v.lang || "").toLowerCase().includes("us") && isKnownMaleVoiceName(v.name));
  if (fallbackUsMale) return fallbackUsMale;

  const fallbackMale = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && isKnownMaleVoiceName(v.name));
  return fallbackMale || voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) || voices[0];
};

export const getBenTenIntonation = (text = "") => {
  const lower = String(text).toLowerCase().trim();

  // 1. Heroic / Omnitrix / High-Energy Action
  // e.g. "It's hero time!", "Let's go!", "Awesome!", "Alien", "Transform", "Check this out!"
  if (
    lower.includes("hero time") ||
    lower.includes("let's go") ||
    lower.includes("awesome") ||
    lower.includes("alien") ||
    lower.includes("omnitrix") ||
    lower.includes("transform") ||
    lower.includes("check this out") ||
    lower.includes("super") ||
    lower.includes("cool") ||
    lower.includes("kick some") ||
    (lower.includes("!") && (lower.includes("yeah") || lower.includes("yes") || lower.includes("ready") || lower.includes("haha") || lower.includes("whoa")))
  ) {
    return { pitchOffset: +0.03, rateOffset: +0.02, mood: "heroic" };
  }

  // 2. Confident / Encouraging / Supportive Hero
  // e.g. "We've got this!", "You're doing great!", "Piece of cake!", "No sweat!", "You can do it!"
  if (
    lower.includes("we've got this") ||
    lower.includes("you're doing great") ||
    lower.includes("piece of cake") ||
    lower.includes("no sweat") ||
    lower.includes("easy") ||
    lower.includes("you can do it") ||
    lower.includes("nice job") ||
    lower.includes("great job") ||
    lower.includes("keep going") ||
    lower.includes("proud of you")
  ) {
    return { pitchOffset: +0.01, rateOffset: +0.01, mood: "confident" };
  }

  // 3. Curious / Inquisitive / Alert
  // e.g. "Wait, what's that?", "Are you serious?", "What are we doing today?"
  if (
    lower.includes("wait") ||
    lower.includes("serious") ||
    lower.includes("what") ||
    lower.includes("how") ||
    lower.includes("who") ||
    lower.includes("?")
  ) {
    return { pitchOffset: +0.02, rateOffset: 0.0, mood: "curious" };
  }

  // 4. Calm / Focused / Tactical
  // e.g. "Okay, let's figure this out", "Take your time", "Relax", "Hold on"
  if (
    lower.includes("figure this out") ||
    lower.includes("take your time") ||
    lower.includes("hold on") ||
    lower.includes("relax") ||
    lower.includes("let's see")
  ) {
    return { pitchOffset: -0.02, rateOffset: -0.02, mood: "focused" };
  }

  // 5. Default: Youthful, energetic, friendly American teen hero
  return { pitchOffset: 0.0, rateOffset: 0.0, mood: "normal" };
};

export const selectNinjaHattoriVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  // Score candidate voices deterministically according to N4 criteria:
  // 1. English language candidate
  // 2. Male presentation (strictly reject female voices)
  // 3. Preferred priority: en-US natural/youthful male -> en-GB natural male -> en-IN natural male -> other English male
  // 4. Youthful, energetic, playful, clear, friendly, adventurous tone
  // 5. Never depend on a single browser-specific voice name; robust deterministic fallback hierarchy
  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strict rejection of female voices
    if (isKnownFemaleVoiceName(name)) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Base English score
    score += 100;

    // ── Locale Preference Hierarchy ──
    // Priority: en-US -> en-GB -> en-IN -> en-CA/en-AU -> other English
    if (lang === "en-us" || name.includes("united states") || name.includes("us english")) {
      score += 60;
    } else if (lang === "en-gb" || name.includes("uk") || name.includes("british")) {
      score += 45;
    } else if (lang === "en-in" || name.includes("india") || name.includes("indian")) {
      score += 35;
    } else if (lang === "en-ca" || lang === "en-au") {
      score += 25;
    }

    // ── Tier 1: Youthful, Energetic, Playful, Heroic Male Timbre Matches ──
    if (name.includes("guy")) {
      score += 150; // Microsoft Guy (Natural / Online / Desktop) - Top youthful, energetic, friendly young hero
    } else if (name.includes("eric")) {
      score += 140; // Microsoft Eric - Clear, youthful male voice
    } else if (name.includes("christopher") || name.includes("steffan")) {
      score += 130; // Natural, clear youthful tone
    } else if (name.includes("google us english")) {
      score += 120; // Clean, energetic, bright tone
    } else if (name.includes("google uk english male")) {
      score += 115; // Crisp, bright youthful tone
    } else if (name.includes("ryan")) {
      score += 110; // Microsoft Ryan - Clear, bright youthful British male
    } else if (name.includes("alex")) {
      score += 100; // Apple Alex - Natural conversational clarity
    } else if (name.includes("daniel")) {
      score += 95;  // Daniel - Clear British young male
    } else if (name.includes("mark")) {
      score += 80;  // Microsoft Mark - Lighter timbre US male
    } else if (name.includes("prabhat") || name.includes("rishi") || name.includes("ravi")) {
      score += 75;  // Clear Indian English male voices
    } else if (name.includes("david")) {
      score += 65;  // Microsoft David - Reliable Windows desktop standard (tuned with pitch lift)
    } else if (name.includes("george") || name.includes("james") || name.includes("william") || name.includes("tom")) {
      score += 50;  // Other standard male voices
    } else if (isKnownMaleVoiceName(name) || name.includes("male")) {
      score += 30;  // Generic male English voice
    }

    // Quality bonus for Natural / Online / Neural voices
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) {
      score += 30;
    }

    // Local service stability bonus
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  // ── Deterministic Safe Fallback Chain ──
  // Fallback 1: English male natural voice
  const fallbackMaleNatural = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    isKnownMaleVoiceName(v.name) &&
    ((v.name || "").toLowerCase().includes("natural") || (v.name || "").toLowerCase().includes("online"))
  );
  if (fallbackMaleNatural) return fallbackMaleNatural;

  // Fallback 2: Any English male voice
  const fallbackMale = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    isKnownMaleVoiceName(v.name)
  );
  if (fallbackMale) return fallbackMale;

  // Fallback 3: English natural voice (excluding known female)
  const fallbackNaturalNonFemale = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    !isKnownFemaleVoiceName(v.name) &&
    ((v.name || "").toLowerCase().includes("natural") || (v.name || "").toLowerCase().includes("online"))
  );
  if (fallbackNaturalNonFemale) return fallbackNaturalNonFemale;

  // Fallback 4: Any English voice (excluding known female if possible)
  const fallbackEnNonFemale = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    !isKnownFemaleVoiceName(v.name)
  );
  if (fallbackEnNonFemale) return fallbackEnNonFemale;

  const fallbackEn = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en"));
  if (fallbackEn) return fallbackEn;

  // Fallback 5: Safe browser default
  return voices[0] || null;
};

export const getNinjaHattoriIntonation = (text = "") => {
  const lower = String(text).toLowerCase().trim();

  // 1. Action / Adventure / High-Energy Ninja Enthusiasm
  // e.g. "Ninja power!", "Let's go!", "Awesome!", "Swift as the wind!", "Amazing!", "Ready!"
  if (
    lower.includes("ninja") ||
    lower.includes("iga") ||
    lower.includes("shuriken") ||
    lower.includes("scroll") ||
    lower.includes("let's go") ||
    lower.includes("awesome") ||
    lower.includes("amazing") ||
    lower.includes("swift") ||
    lower.includes("adventure") ||
    lower.includes("hurray") ||
    lower.includes("hooray") ||
    lower.includes("super") ||
    (lower.includes("!") && (lower.includes("ready") || lower.includes("yes") || lower.includes("yeah") || lower.includes("cool") || lower.includes("wow") || lower.includes("haha")))
  ) {
    return { pitchOffset: +0.03, rateOffset: +0.02, mood: "adventurous" };
  }

  // 2. Encouraging / Training / Practice / Supportive
  // e.g. "We are going to practice English together!", "You're doing great!", "Keep training!", "Good work!"
  if (
    lower.includes("practice") ||
    lower.includes("together") ||
    lower.includes("train") ||
    lower.includes("doing great") ||
    lower.includes("keep going") ||
    lower.includes("you can do it") ||
    lower.includes("good job") ||
    lower.includes("great job") ||
    lower.includes("well done") ||
    lower.includes("proud") ||
    lower.includes("excellent")
  ) {
    return { pitchOffset: +0.01, rateOffset: +0.01, mood: "encouraging" };
  }

  // 3. Curious / Inquisitive / Alert
  // e.g. "Can you tell me what you did today?", "What is your favorite ninja move?", "How was your day?"
  if (
    lower.includes("can you tell me") ||
    lower.includes("tell me") ||
    lower.includes("what did you") ||
    lower.includes("what do you") ||
    lower.includes("how") ||
    lower.includes("why") ||
    lower.includes("where") ||
    lower.includes("?")
  ) {
    return { pitchOffset: +0.02, rateOffset: 0.0, mood: "curious" };
  }

  // 4. Calm / Stealth / Disciplined / Reassuring
  // e.g. "Take your time", "Stay calm and focused", "Don't worry", "Breathe slowly"
  if (
    lower.includes("take your time") ||
    lower.includes("don't worry") ||
    lower.includes("stay calm") ||
    lower.includes("focus") ||
    lower.includes("slowly") ||
    lower.includes("carefully") ||
    lower.includes("listen") ||
    lower.includes("no rush") ||
    lower.includes("no hurry") ||
    lower.includes("relax")
  ) {
    return { pitchOffset: -0.02, rateOffset: -0.02, mood: "calm" };
  }

  // 5. Default: Youthful, energetic, friendly young ninja hero
  return { pitchOffset: 0.0, rateOffset: 0.0, mood: "normal" };
};

export const selectScoobyVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  // Score candidate voices deterministically according to Scooby S4 criteria:
  // 1. English candidate (en-US primary preference)
  // 2. Male presentation (strictly reject female voices)
  // 3. Timbre: warm, playful, goofy, mid-range resonant cartoon dog (Guy, David, Mark, Eric, Christopher, Alex, Ryan)
  // 4. Intelligible, clear English pronunciation
  // 5. Deterministic multi-tier fallback chain
  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strict rejection of female voices
    if (isKnownFemaleVoiceName(name)) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Base English score
    score += 100;

    // ── Primary Locale Preference: American English (en-US) ──
    if (lang === "en-us" || name.includes("united states") || name.includes("us english")) {
      score += 70;
    } else if (lang === "en-ca") {
      score += 40;
    } else if (lang === "en-gb" || lang === "en-au") {
      score += 30;
    }

    // ── Priority Timbre Matches for Cartoon Dog Persona ──
    // Candidates providing warm, friendly, goofy, mid/deep resonant characteristics
    if (name.includes("guy")) {
      score += 150; // Microsoft Guy (Natural / Online / Desktop) - Warm, friendly, highly responsive
    } else if (name.includes("david")) {
      score += 140; // Microsoft David - Classic warm resonant desktop male, perfect with pitch ~0.94-0.96
    } else if (name.includes("mark")) {
      score += 130; // Microsoft Mark - Lighter, conversational US male
    } else if (name.includes("eric")) {
      score += 125; // Microsoft Eric - Clear, friendly American male
    } else if (name.includes("christopher") || name.includes("steffan")) {
      score += 120; // Clear, resonant male
    } else if (name.includes("google us english")) {
      score += 115; // Clean conversational tone
    } else if (name.includes("alex")) {
      score += 110; // Apple Alex - Natural clarity
    } else if (name.includes("ryan")) {
      score += 100; // Microsoft Ryan - Clear British male fallback
    } else if (name.includes("george") || name.includes("oliver") || name.includes("daniel")) {
      score += 85;
    } else if (name.includes("prabhat") || name.includes("rishi") || name.includes("ravi")) {
      score += 70;
    } else if (isKnownMaleVoiceName(name) || name.includes("male")) {
      score += 40; // Any identified male voice
    }

    // Quality bonus for Natural / Online / Neural voices
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) {
      score += 30;
    }

    // Local service stability bonus
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  // ── Deterministic Fallback Chain ──
  // Tier 1: Natural English male voice
  const fallbackMaleNatural = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    isKnownMaleVoiceName(v.name) &&
    ((v.name || "").toLowerCase().includes("natural") || (v.name || "").toLowerCase().includes("online"))
  );
  if (fallbackMaleNatural) return fallbackMaleNatural;

  // Tier 2: Any English male voice
  const fallbackMale = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    isKnownMaleVoiceName(v.name)
  );
  if (fallbackMale) return fallbackMale;

  // Tier 3: English natural voice (non-female)
  const fallbackNaturalNonFemale = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    !isKnownFemaleVoiceName(v.name) &&
    ((v.name || "").toLowerCase().includes("natural") || (v.name || "").toLowerCase().includes("online"))
  );
  if (fallbackNaturalNonFemale) return fallbackNaturalNonFemale;

  // Tier 4: Any English voice (non-female)
  const fallbackEnNonFemale = voices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("en") &&
    !isKnownFemaleVoiceName(v.name)
  );
  if (fallbackEnNonFemale) return fallbackEnNonFemale;

  // Tier 5: Any English voice or browser default
  const fallbackEn = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en"));
  return fallbackEn || voices[0] || null;
};

export const getScoobyIntonation = (text = "") => {
  const lower = String(text).toLowerCase().trim();

  // 1. Excited / Mystery / Surprise / Classic Scooby Catchphrases
  // e.g. "Ruh-roh!", "Zoinks!", "Mystery", "Spooky", "Gang", "Shaggy", "Awesome!", "Yikes!"
  if (
    lower.includes("ruh-roh") ||
    lower.includes("zoinks") ||
    lower.includes("mystery") ||
    lower.includes("spooky") ||
    lower.includes("ghost") ||
    lower.includes("monster") ||
    lower.includes("shaggy") ||
    lower.includes("clue") ||
    lower.includes("yikes") ||
    lower.includes("jinkies") ||
    lower.includes("investigate") ||
    lower.includes("awesome") ||
    lower.includes("super") ||
    (lower.includes("!") && (lower.includes("hey") || lower.includes("wow") || lower.includes("yes") || lower.includes("go") || lower.includes("run") || lower.includes("look")))
  ) {
    return { pitchOffset: +0.03, rateOffset: +0.02, mood: "excited" };
  }

  // 2. Inquisitive / Curious / Questioning
  // e.g. "Where are Shaggy and the gang?", "Could you help me?", "What happened?", "Why?"
  if (
    lower.includes("where") ||
    lower.includes("what") ||
    lower.includes("who") ||
    lower.includes("why") ||
    lower.includes("how") ||
    lower.includes("could you") ||
    lower.includes("can you") ||
    lower.includes("are you") ||
    lower.includes("?")
  ) {
    return { pitchOffset: +0.02, rateOffset: 0.0, mood: "curious" };
  }

  // 3. Relaxed / Friendly / Reassuring / Snack
  // e.g. "Snack", "Scooby snack", "Don't worry", "Take your time", "Relax", "Friend"
  if (
    lower.includes("snack") ||
    lower.includes("cookie") ||
    lower.includes("treat") ||
    lower.includes("hungry") ||
    lower.includes("don't worry") ||
    lower.includes("take your time") ||
    lower.includes("relax") ||
    lower.includes("slowly") ||
    lower.includes("friend") ||
    lower.includes("pal")
  ) {
    return { pitchOffset: -0.02, rateOffset: -0.02, mood: "relaxed" };
  }

  // 4. Default: Warm, goofy, friendly conversational cartoon dog
  return { pitchOffset: 0.0, rateOffset: 0.0, mood: "friendly" };
};

export const selectTomVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  // Score candidate voices deterministically according to Tom criteria:
  // 1. English candidate (en-US primary preference)
  // 2. Male presentation (strictly reject female voices)
  // 3. Timbre: playful, witty, expressive classic cartoon cat male voices (Guy, David, Mark, Alex, Ryan, Christopher)
  // 4. Intelligible, clear English pronunciation
  // 5. Deterministic multi-tier fallback chain
  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strict rejection of female voices
    if (isKnownFemaleVoiceName(name)) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Base English score
    score += 100;

    // Primary Locale: American English (en-US)
    if (lang === "en-us") {
      score += 40;
    } else if (lang === "en-ca") {
      score += 25;
    } else if (lang === "en-gb" || lang === "en-au") {
      score += 15;
    }

    // High priority target names for classic cartoon cat: Guy, David, Mark, Alex
    if (name.includes("guy")) score += 95;
    else if (name.includes("david")) score += 90;
    else if (name.includes("mark")) score += 88;
    else if (name.includes("alex")) score += 85;
    else if (name.includes("ryan")) score += 75;
    else if (name.includes("christopher")) score += 70;
    else if (name.includes("daniel")) score += 65;
    else if (name.includes("eric")) score += 60;

    if (name.includes("natural") || name.includes("neural") || name.includes("online")) {
      score += 30;
    }
    if (name.includes("male") || isKnownMaleVoiceName(name)) {
      score += 15;
    }
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  const fallbackUsMale = voices.find(
    (v) => (v.lang || "").toLowerCase().startsWith("en-us") && !isKnownFemaleVoiceName(v.name)
  );
  if (fallbackUsMale) return fallbackUsMale;

  const fallbackAnyMale = voices.find(
    (v) => (v.lang || "").toLowerCase().startsWith("en") && !isKnownFemaleVoiceName(v.name)
  );
  if (fallbackAnyMale) return fallbackAnyMale;

  return voices[0] || null;
};

export const getTomIntonation = (text = "") => {
  if (!text || typeof text !== "string") {
    return { pitchOffset: 0.0, rateOffset: 0.0, mood: "normal" };
  }
  const lower = text.toLowerCase().trim();

  // 1. Playful / Mischievous / Witty Cat Exclamations
  if (
    lower.includes("haha") ||
    lower.includes("hehe") ||
    lower.includes("gotcha") ||
    lower.includes("clever") ||
    lower.includes("fun") ||
    lower.includes("catch me") ||
    lower.includes("aha") ||
    lower.includes("oops") ||
    lower.includes("!")
  ) {
    return { pitchOffset: +0.03, rateOffset: +0.02, mood: "playful" };
  }

  // 2. Inquisitive / Sneaky / Curious Cat Questions
  if (
    lower.includes("what") ||
    lower.includes("how") ||
    lower.includes("ready") ||
    lower.includes("shall we") ||
    lower.includes("think") ||
    lower.includes("?")
  ) {
    return { pitchOffset: +0.02, rateOffset: 0.0, mood: "curious" };
  }

  // 3. Relaxed / Purring / Calm Cat Encouragement
  if (
    lower.includes("take your time") ||
    lower.includes("relax") ||
    lower.includes("easy") ||
    lower.includes("good job") ||
    lower.includes("well done")
  ) {
    return { pitchOffset: -0.02, rateOffset: -0.02, mood: "calm" };
  }

  // 4. Default: Classic witty cartoon cat voice
  return { pitchOffset: 0.0, rateOffset: 0.0, mood: "normal" };
};

export const selectDoraemonRoboticVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strong negative rejection of female voices
    if (
      isKnownFemaleVoiceName(name) ||
      name.includes("female") ||
      name.includes("woman") ||
      name.includes("girl") ||
      name.includes("zira") ||
      name.includes("jenny") ||
      name.includes("samantha") ||
      name.includes("hazel") ||
      name.includes("aria")
    ) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 400;
      return { voice: v, score };
    }

    // Locale preference (US English top, followed by UK / AU / CA)
    if (lang === "en-us") {
      score += 45;
    } else if (lang === "en-gb" || lang === "en-au" || lang === "en-ca") {
      score += 25;
    }

    // ── Tier 1: True Hardware/OS Robotic, Synthesizer or Cyborg Voice (if installed) ──
    if (
      name.includes("robot") ||
      name.includes("zarvox") ||
      name.includes("trinoids") ||
      name.includes("android") ||
      name.includes("synth") ||
      name.includes("espeak")
    ) {
      score += 300;
    }
    // ── Tier 2: Precision Mechanical / Clean Resonant Male Voices ──
    // Microsoft David has a distinct, slightly mechanical desktop resonance that produces the perfect kind, crisp robot-cat sound when modulated
    else if (name.includes("david")) {
      score += 210;
    } else if (name.includes("mark")) {
      score += 190; // Crisp, lighter American male with great articulation
    } else if (name.includes("george")) {
      score += 175; // Distinct crisp male
    } else if (name.includes("guy")) {
      score += 165; // Clean natural male
    } else if (name.includes("google us english") || (name.includes("google") && !name.includes("female"))) {
      score += 160; // Clean digital male
    } else if (name.includes("alex")) {
      score += 150; // Apple Alex mechanical clarity
    } else if (name.includes("eric") || name.includes("christopher") || name.includes("steffan")) {
      score += 140;
    } else if (name.includes("ryan") || name.includes("daniel") || name.includes("oliver")) {
      score += 120;
    } else if (isKnownMaleVoiceName(name) || name.includes("male")) {
      score += 90;
    }

    // Natural / Online quality bonus
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) {
      score += 20;
    }

    // Local service stability bonus
    if (v.localService) {
      score += 15;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  // Safe fallback to first male English voice or non-female voice
  const fallbackMale = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && isKnownMaleVoiceName(v.name));
  return fallbackMale || voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && !isKnownFemaleVoiceName(v.name)) || voices[0];
};

export const getDoraemonIntonation = (text = "") => {
  const lower = String(text).toLowerCase().trim();

  // 1. Mischievous / Gadget Reveal / Playful Cheeky
  // e.g. "Take a look at this!", "Pocket", "Gadget", "Anywhere Door", "Bamboo-Copter", "Secret", "Hehe", "Aha!", "Watch this!", "Magic", "Surprise"
  if (
    lower.includes("gadget") ||
    lower.includes("pocket") ||
    lower.includes("anywhere door") ||
    lower.includes("bamboo") ||
    lower.includes("time machine") ||
    lower.includes("secret") ||
    lower.includes("surprise") ||
    lower.includes("magic") ||
    lower.includes("hehe") ||
    lower.includes("haha") ||
    lower.includes("aha") ||
    lower.includes("oops") ||
    lower.includes("watch this") ||
    lower.includes("check this") ||
    lower.includes("tada") ||
    lower.includes("look what") ||
    lower.includes("special tool") ||
    lower.includes("don't tell") ||
    lower.includes("guess what")
  ) {
    return { pitchOffset: +0.06, rateOffset: +0.03, mood: "mischievous" };
  }

  // 2. Kind / Gentle / Humble / Reassuring
  // e.g. "Don't worry", "I am here to help you", "Take your time", "It's okay", "No problem", "Together", "Gentle", "Friend", "Buddy", "Please", "Thank you", "You did great"
  if (
    lower.includes("don't worry") ||
    lower.includes("dont worry") ||
    lower.includes("it's okay") ||
    lower.includes("its okay") ||
    lower.includes("no problem") ||
    lower.includes("here to help") ||
    lower.includes("help you") ||
    lower.includes("take your time") ||
    lower.includes("together") ||
    lower.includes("friend") ||
    lower.includes("buddy") ||
    lower.includes("gentle") ||
    lower.includes("kind") ||
    lower.includes("humble") ||
    lower.includes("please") ||
    lower.includes("thank you") ||
    lower.includes("thanks") ||
    lower.includes("you can do it") ||
    lower.includes("great job") ||
    lower.includes("proud of you") ||
    lower.includes("well done")
  ) {
    return { pitchOffset: -0.04, rateOffset: -0.02, mood: "gentle_humble" };
  }

  // 3. Inquisitive / Curious / Asking Questions
  // e.g. "What do you think?", "Could you tell me?", "Why?", "How?", "?"
  if (
    lower.includes("what") ||
    lower.includes("how") ||
    lower.includes("why") ||
    lower.includes("who") ||
    lower.includes("could you") ||
    lower.includes("can you") ||
    lower.includes("shall we") ||
    lower.includes("ready?") ||
    lower.includes("?")
  ) {
    return { pitchOffset: +0.03, rateOffset: 0.0, mood: "curious" };
  }

  // 4. Celebratory / Enthusiastic Robotic Cheer
  // e.g. "Hii", "Hello", "Yay!", "Awesome!", "Super!", "Hurray!"
  if (
    lower.includes("hii") ||
    lower.includes("hello") ||
    lower.includes("hey") ||
    lower.includes("yay") ||
    lower.includes("awesome") ||
    lower.includes("super") ||
    lower.includes("hurray") ||
    lower.includes("let's practice") ||
    lower.includes("lets practice") ||
    lower.includes("!")
  ) {
    return { pitchOffset: +0.02, rateOffset: +0.01, mood: "cheerful" };
  }

  // 5. Default: Balanced, warm robotic male voice with steady machine articulation
  return { pitchOffset: 0.0, rateOffset: 0.0, mood: "robotic_default" };
};

export const selectShizukuFemaleVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  // Score candidate voices deterministically
  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    const isMale = isKnownMaleVoiceName(name);
    if (isMale) {
      score -= 1000; // Strong negative rejection of male voices
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500; // Deprioritize non-English
      return { voice: v, score };
    }

    // +100 Naturally feminine English candidate
    score += 100;

    // +40 en-US preference
    if (lang === "en-us") {
      score += 40;
    } else if (lang === "en-gb" || lang === "en-au" || lang === "en-ca") {
      score += 20;
    }

    // Top Winning candidate chosen in experimental listening test
    if (name.includes("google us english")) {
      score += 90;
    } else if (name.includes("zira")) {
      score += 70; // Top Windows local desktop candidate
    } else if (name.includes("jenny") || name.includes("aria") || name.includes("ana") || name.includes("samantha")) {
      score += 80; // High-clarity online natural female
    } else if (name.includes("sonia") || name.includes("hazel") || name.includes("susan") || name.includes("victoria") || name.includes("karen")) {
      score += 50; // Known female voices
    }

    // Natural / Online quality bonus
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) {
      score += 25;
    }

    // Female keyword bonus
    if (name.includes("female") || name.includes("woman") || name.includes("girl")) {
      score += 30;
    }

    // localService reliability
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return highest-scoring valid candidate
  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  // Safe fallback to first non-male English voice
  const fallback = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && !isKnownMaleVoiceName(v.name));
  return fallback || voices[0];
};

export const selectShizukaFemaleVoice = selectShizukuFemaleVoice;

export const selectTeacherFemaleVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    const isMale = isKnownMaleVoiceName(name);
    if (isMale) {
      score -= 1000;
      return { voice: v, score };
    }

    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Baseline English female candidate
    score += 100;

    // 1. Priority #1: en-IN female English (Heera, Neerja, Veena, etc.)
    if (lang === "en-in" || name.includes("india") || name.includes("en-in")) {
      score += 150;
      if (name.includes("heera")) score += 60;
      else if (name.includes("neerja")) score += 55;
      else if (name.includes("veena")) score += 50;
    }
    // 2. Priority #2: en-US female English (Zira, Jenny, Samantha, Aria)
    else if (lang === "en-us" || name.includes("en-us") || name.includes("united states")) {
      score += 80;
      if (name.includes("zira")) score += 40;
      else if (name.includes("jenny")) score += 45;
      else if (name.includes("aria") || name.includes("samantha")) score += 35;
    }
    // 3. Priority #3: en-GB female English (Hazel, Susan, Sonia, Libby)
    else if (lang === "en-gb" || name.includes("en-gb") || name.includes("united kingdom")) {
      score += 50;
      if (name.includes("hazel")) score += 30;
      else if (name.includes("susan")) score += 30;
      else if (name.includes("sonia")) score += 25;
    } else {
      score += 20;
    }

    if (name.includes("natural") || name.includes("neural") || name.includes("online")) {
      score += 30;
    }
    if (name.includes("female") || name.includes("woman")) {
      score += 20;
    }
    if (v.localService) {
      score += 10;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  const fallbackIn = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-in") && !isKnownMaleVoiceName(v.name));
  if (fallbackIn) return fallbackIn;

  const fallbackEn = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && !isKnownMaleVoiceName(v.name));
  if (fallbackEn) return fallbackEn;

  return voices[0] || null;
};

export const selectMaleTeacherVoice = (voices = []) => {
  if (!voices || voices.length === 0) return null;

  const scored = voices.map((v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    // Strict rejection of female voices
    if (isKnownFemaleVoiceName(name)) {
      score -= 1000;
      return { voice: v, score };
    }

    // Must be English candidate
    if (!lang.startsWith("en")) {
      score -= 500;
      return { voice: v, score };
    }

    // Baseline English male candidate
    score += 100;

    // 1. Priority #1: en-IN male English (Ravi, Prabhat, Rishi, etc.)
    if (lang === "en-in" || name.includes("india") || name.includes("en-in")) {
      score += 180;
      if (name.includes("ravi")) score += 80;
      else if (name.includes("prabhat")) score += 75;
      else if (name.includes("rishi")) score += 70;
    }
    // 2. Priority #2: en-US male English (Guy, David, Mark, Alex, etc.)
    else if (lang === "en-us" || name.includes("en-us") || name.includes("united states")) {
      score += 110;
      if (name.includes("guy")) score += 55;
      else if (name.includes("david")) score += 50;
      else if (name.includes("mark")) score += 45;
      else if (name.includes("alex")) score += 40;
      else if (name.includes("chris") || name.includes("eric")) score += 35;
    }
    // 3. Priority #3: en-GB male English (George, Ryan, Daniel, Oliver)
    else if (lang === "en-gb" || name.includes("en-gb") || name.includes("united kingdom")) {
      score += 90;
      if (name.includes("george")) score += 50;
      else if (name.includes("ryan")) score += 45;
      else if (name.includes("daniel")) score += 40;
      else if (name.includes("oliver")) score += 35;
    } else {
      score += 50;
    }

    if (name.includes("natural") || name.includes("neural") || name.includes("online")) {
      score += 30;
    }
    if (name.includes("male") || isKnownMaleVoiceName(name)) {
      score += 20;
    }
    if (v.localService) {
      score += 15;
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((s) => s.score > 0);
  if (best) return best.voice;

  const fallbackIn = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-in") && isKnownMaleVoiceName(v.name));
  if (fallbackIn) return fallbackIn;

  const fallbackUs = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-us") && isKnownMaleVoiceName(v.name));
  if (fallbackUs) return fallbackUs;

  const fallbackMale = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && isKnownMaleVoiceName(v.name));
  if (fallbackMale) return fallbackMale;

  const fallbackEn = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && !isKnownFemaleVoiceName(v.name));
  if (fallbackEn) return fallbackEn;

  return voices[0] || null;
};

export const getMaleTeacherIntonation = (text = "") => {
  const lower = String(text).toLowerCase().trim();

  // 1. Encouraging / Supportive / Positive Affirmation
  if (
    lower.includes("good job") ||
    lower.includes("great job") ||
    lower.includes("well done") ||
    lower.includes("good attempt") ||
    lower.includes("keep practicing") ||
    lower.includes("nice attempt") ||
    lower.includes("excellent") ||
    lower.includes("proud") ||
    lower.includes("congratulations")
  ) {
    return { pitchOffset: +0.02, rateOffset: 0.00, mood: 'encouraging' };
  }

  // 2. Explanatory / Instructional / Calm Teaching
  if (
    lower.includes("listen carefully") ||
    lower.includes("repeat after me") ||
    lower.includes("for example") ||
    lower.includes("in english") ||
    lower.includes("today we are going to learn") ||
    lower.includes("let us practice") ||
    lower.includes("notice that") ||
    lower.includes("remember that") ||
    lower.includes("step by step")
  ) {
    return { pitchOffset: 0.00, rateOffset: -0.02, mood: 'instructional' };
  }

  return { pitchOffset: 0.00, rateOffset: 0.00, mood: 'neutral' };
};

export const mapModelToVoiceCode = (model) => {
  if (!model) return null;
  const m = String(model).toLowerCase();
  if (m === "spongebob") return "SpongeBob";
  if (m === "shizuku" || m === "shizuka") return "Shizuka";
  if (m === "robopaws" || m === "doraemon") return "Doraemon";
  if (m === "sparky" || m === "hero" || m === "bheem" || m === "chhotabheem") return "Sparky";
  if (m === "mao" || m === "ben" || m === "ben10" || m === "unitychan") return "Mao";
  if (m === "koharu" || m === "hattori" || m === "ninjahattori") return "Koharu";
  if (m === "haruto" || m === "tom") return "Haruto";
  if (m === "puppy" || m === "wanko" || m === "dog" || m === "scooby" || m === "scoobydoo") return "Puppy";
  if (m === "haru" || m === "teacher") return "Teacher";
  if (m === "chitose" || m === "maleteacher") return "MaleTeacher";
  return null;
};

export const mapVoiceCodeToModel = (code) => {
  if (!code) return null;
  const c = String(code).toLowerCase();
  if (c === "spongebob") return "spongebob";
  if (c === "shizuka" || c === "shizuku") return "shizuku";
  if (c === "doraemon" || c === "robo-paws" || c === "robopaws") return "robopaws";
  if (c === "sparky" || c === "chhotabheem" || c === "bheem") return "sparky";
  if (c === "mao" || c === "benten" || c === "ben 10" || c === "ben") return "mao";
  if (c === "koharu" || c === "ninjahattori" || c === "hattori") return "koharu";
  if (c === "haruto" || c === "tom") return "haruto";
  if (c === "puppy" || c === "wanko" || c === "scoobydoo" || c === "scooby") return "puppy";
  if (c === "teacher") return "haru";
  if (c === "maleteacher") return "chitose";
  return null;
};

export const resolveAvatarFromVoice = (voiceCode, onboardingVoiceStyle = "Friendly") => {
  if (!voiceCode) {
    const style = String(onboardingVoiceStyle || "").toLowerCase();
    const isMaleStyle = style === "professional" || style === "calm" || (style.includes("male") && !style.includes("female"));
    return { model: isMaleStyle ? "chitose" : "haru", gender: isMaleStyle ? "male" : "female" };
  }

  // 1. Direct character signature voice match
  const charModel = mapVoiceCodeToModel(voiceCode);
  if (charModel) {
    const isFemale = charModel === "shizuku" || charModel === "haru";
    return { model: charModel, gender: isFemale ? "female" : "male" };
  }

  // 2. Regional human voices (US Male, IN Male, UK Female, etc.)
  const vc = String(voiceCode).toLowerCase();
  if (vc.includes("male") && !vc.includes("female")) {
    return { model: "chitose", gender: "male" };
  }
  if (vc.includes("female")) {
    return { model: "haru", gender: "female" };
  }

  // 3. Fallback to onboarding voice style if 'Default'
  const style = String(onboardingVoiceStyle || "").toLowerCase();
  const isMaleStyle = style === "professional" || style === "calm" || (style.includes("male") && !style.includes("female"));
  return { model: isMaleStyle ? "chitose" : "haru", gender: isMaleStyle ? "male" : "female" };
};

export const getSavedVoiceSettings = (overrideVoiceCode = null, overrideModel = null) => {
  const hasOverride = Boolean(overrideVoiceCode || overrideModel);
  const currentAvatarModel = hasOverride
    ? (overrideModel || mapVoiceCodeToModel(overrideVoiceCode) || "").toLowerCase()
    : (localStorage.getItem("speakmate_avatar_model") || "haru").toLowerCase();

  const REGIONAL_VOICES = [
    "US Male", "US Female",
    "UK Male", "UK Female",
    "AU Male", "AU Female",
    "IN Male", "IN Female"
  ];

  const candidateVoices = [
    localStorage.getItem("speakmate_selected_voice"),
    localStorage.getItem("speakmate_voice_code"),
    localStorage.getItem("speakmate_ai_voice"),
  ].filter(Boolean);

  const matchedRegional = candidateVoices.find((c) =>
    REGIONAL_VOICES.some((rv) => rv.toLowerCase() === (c || "").trim().toLowerCase())
  );

  let rawStoredVoice = (matchedRegional ? matchedRegional.trim() : "") ||
    localStorage.getItem("speakmate_selected_voice") ||
    localStorage.getItem("speakmate_voice_code") ||
    localStorage.getItem("speakmate_ai_voice") ||
    "Default";

  let aiVoice = overrideVoiceCode || (hasOverride ? mapModelToVoiceCode(currentAvatarModel) : rawStoredVoice) || "Default";
  const onboardingVoice = localStorage.getItem("speakmate_onboarding_voice") || localStorage.getItem("speakmate_voice_persona") || "Friendly";
  const accent = localStorage.getItem("speakmate_voice_accent") || "US";
  let selectedVoiceName = hasOverride ? "" : (localStorage.getItem("speakmate_voice_name") || "");
  const customPitch = hasOverride ? null : localStorage.getItem("speakmate_voice_pitch");
  const customRate = localStorage.getItem("speakmate_speech_rate") || "1.0";

  const isSpongeBobActive = currentAvatarModel === "spongebob" || aiVoice === "SpongeBob";
  const isShizukuActive = currentAvatarModel === "shizuku" || currentAvatarModel === "shizuka" || aiVoice === "Shizuku" || aiVoice === "Shizuka";
  const isDoraemonActive = currentAvatarModel === "robopaws" || currentAvatarModel === "doraemon" || aiVoice === "Robo-Paws" || aiVoice === "Doraemon";
  const isChhotaBheemActive = currentAvatarModel === "sparky" || currentAvatarModel === "bheem" || currentAvatarModel === "chhotabheem" || aiVoice === "Sparky" || aiVoice === "ChhotaBheem";
  const isBenTenActive = currentAvatarModel === "mao" || currentAvatarModel === "ben" || currentAvatarModel === "ben10" || aiVoice === "Mao" || aiVoice === "BenTen" || aiVoice === "Ben 10";
  const isNinjaHattoriActive = currentAvatarModel === "koharu" || currentAvatarModel === "hattori" || currentAvatarModel === "ninjahattori" || aiVoice === "Koharu" || aiVoice === "NinjaHattori";
  const isTomActive = currentAvatarModel === "haruto" || currentAvatarModel === "tom" || aiVoice === "Haruto";
  const isScoobyActive = currentAvatarModel === "puppy" || currentAvatarModel === "wanko" || currentAvatarModel === "dog" || currentAvatarModel === "scooby" || currentAvatarModel === "scoobydoo" || aiVoice === "Puppy" || aiVoice === "ScoobyDoo" || aiVoice === "Scooby";

  const isTeacherAvatar = currentAvatarModel === "haru" || currentAvatarModel === "teacher";
  const isMaleTeacherAvatar = currentAvatarModel === "chitose" || currentAvatarModel === "maleteacher";

  // Automatic Avatar-Intrinsic Voice Resolution:
  if (!overrideVoiceCode) {
    if (isSpongeBobActive) {
      aiVoice = "SpongeBob";
    } else if (isShizukuActive) {
      aiVoice = "Shizuka";
    } else if (isDoraemonActive) {
      aiVoice = "Doraemon";
    } else if (currentAvatarModel === "motu") {
      aiVoice = "Motu";
    } else if (currentAvatarModel === "sparky" || currentAvatarModel === "hero" || currentAvatarModel === "bheem" || currentAvatarModel === "chhotabheem") {
      aiVoice = "Sparky";
    } else if (currentAvatarModel === "koharu" || currentAvatarModel === "hattori" || currentAvatarModel === "ninjahattori") {
      aiVoice = "Koharu";
    } else if (currentAvatarModel === "haruto" || currentAvatarModel === "tom") {
      aiVoice = "Haruto";
    } else if (currentAvatarModel === "mao" || currentAvatarModel === "unitychan" || currentAvatarModel === "ben" || currentAvatarModel === "ben10") {
      aiVoice = "Mao";
    } else if (currentAvatarModel === "wanko" || currentAvatarModel === "puppy" || currentAvatarModel === "dog" || currentAvatarModel === "scooby" || currentAvatarModel === "scoobydoo") {
      aiVoice = "Puppy";
    } else if (isTeacherAvatar) {
      // Check if user specifically selected a regional voice for Teacher
      const isRegional = REGIONAL_VOICES.some(rv => rv.toLowerCase() === rawStoredVoice.trim().toLowerCase());
      aiVoice = matchedRegional ? matchedRegional.trim() : (isRegional ? rawStoredVoice.trim() : "Teacher");
    } else if (isMaleTeacherAvatar) {
      // Check if user specifically selected a regional voice for Male Teacher
      const isRegional = REGIONAL_VOICES.some(rv => rv.toLowerCase() === rawStoredVoice.trim().toLowerCase());
      aiVoice = matchedRegional ? matchedRegional.trim() : (isRegional ? rawStoredVoice.trim() : "MaleTeacher");
    }
  }

  const isRegionalVoice = REGIONAL_VOICES.some(rv => rv.toLowerCase() === (aiVoice || "").trim().toLowerCase());

  // Character Voice Locks: Mutually exclusive locks
  if (isSpongeBobActive) {
    aiVoice = "SpongeBob";
    selectedVoiceName = "";
  } else if (isTeacherAvatar) {
    if (!isRegionalVoice) {
      aiVoice = "Teacher";
    }
    if (selectedVoiceName && isKnownMaleVoiceName(selectedVoiceName)) {
      selectedVoiceName = "";
    }
  } else if (isMaleTeacherAvatar) {
    if (!isRegionalVoice) {
      aiVoice = "MaleTeacher";
    }
    if (selectedVoiceName && isKnownFemaleVoiceName(selectedVoiceName)) {
      selectedVoiceName = "";
    }
  } else if (isShizukuActive) {
    aiVoice = "Shizuka";
    if (selectedVoiceName && isKnownMaleVoiceName(selectedVoiceName)) {
      selectedVoiceName = "";
    }
  } else if (isDoraemonActive) {
    aiVoice = "Doraemon";
    if (selectedVoiceName && isKnownFemaleVoiceName(selectedVoiceName)) {
      selectedVoiceName = "";
    }
  } else if (isChhotaBheemActive) {
    aiVoice = "Sparky";
    selectedVoiceName = "";
  } else if (isBenTenActive) {
    aiVoice = "Mao";
    selectedVoiceName = "";
  } else if (isNinjaHattoriActive) {
    aiVoice = "Koharu";
    selectedVoiceName = "";
  } else if (isTomActive) {
    aiVoice = "Haruto";
    selectedVoiceName = "";
  } else if (isScoobyActive) {
    aiVoice = "Puppy";
    selectedVoiceName = "";
  }

  const isDefault = aiVoice === "Default" || !aiVoice;
  const effectiveVoiceCode = isDefault ? onboardingVoice : aiVoice;

  // Check if effectiveVoiceCode matches a VOICE_PROFILE or VOICE_PERSONA
  const profile = VOICE_PROFILES.find((p) => p.code.toLowerCase() === effectiveVoiceCode.toLowerCase());
  const personaObj = VOICE_PERSONAS.find((p) => p.key === effectiveVoiceCode) || VOICE_PERSONAS[0];

  let targetLang = accent === "UK" ? "en-GB" : accent === "AU" ? "en-AU" : accent === "IN" ? "en-IN" : "en-US";
  let gender = personaObj ? personaObj.gender : "female";
  let pitch = customPitch ? parseFloat(customPitch) : (personaObj ? personaObj.pitch : 1.0);
  let baseRate = personaObj ? personaObj.rate : 1.0;

  if (profile) {
    if (profile.locale) targetLang = profile.locale;
    if (profile.gender) gender = profile.gender;

    // Dedicated sound profiles calibrated precisely for each regional voice:
    if (profile.code === "US Male") {
      pitch = 0.94;
      baseRate = 1.00;
    } else if (profile.code === "US Female") {
      pitch = 1.05;
      baseRate = 1.01;
    } else if (profile.code === "UK Male") {
      pitch = 0.88; // Deep, polished British tone
      baseRate = 0.94; // Measured British pacing
    } else if (profile.code === "UK Female") {
      pitch = 1.15; // Crisp, articulate British tone
      baseRate = 0.95; // Articulate British cadence
    } else if (profile.code === "AU Male") {
      pitch = 1.08; // Energetic, bright Australian casual tone
      baseRate = 1.06; // Upbeat tempo
    } else if (profile.code === "AU Female") {
      pitch = 1.22; // Bright Australian rising inflection
      baseRate = 1.05; // Lively tempo
    } else if (profile.code === "IN Male") {
      pitch = 0.96; // Resonant Indian English tone
      baseRate = 0.96; // Steady syllable-timed pacing
    } else if (profile.code === "IN Female") {
      pitch = 0.98; // Warm, natural melodic Indian English cadence
      baseRate = 0.92; // Calm, precise syllable timing
    } else if (profile.code === "Haru" || profile.code === "Teacher") {
      pitch = 1.12; // Kind, articulate, warm female English coach
      baseRate = 0.98;
    } else if (profile.code === "SpongeBob") {
      pitch = 1.18; // Sweet, youthful, gentle, friendly cartoon boy
      baseRate = 1.02; // Clear, comfortable conversational pace
    } else if (profile.code === "Shizuku" || profile.code === "Shizuka") {
      pitch = 1.22; // Sweet, youthful, cheerful academic companion (winning experimental combination)
      baseRate = 1.04;
    } else if (profile.code === "Robo-Paws" || profile.code === "Doraemon") {
      pitch = 1.06; // Kind, gentle, humble & mischievous robotic male voice
      baseRate = 1.03;
    } else if (profile.code === "Motu") {
      pitch = 1.22; // Jolly, enthusiastic Indian cartoon friend
      baseRate = 1.04;
    } else if (profile.code === "Sparky" || profile.code === "ChhotaBheem") {
      pitch = 1.22; // Confident, cheerful, youthful Indian hero
      baseRate = 1.03; // Clear, comfortable conversational pace
    } else if (profile.code === "Koharu" || profile.code === "NinjaHattori") {
      pitch = 1.20; // Youthful, energetic, friendly young ninja hero
      baseRate = 1.04; // Clear, lively conversational pace
    } else if (profile.code === "Haruto") {
      pitch = 1.20; // Classic witty cartoon cat voice
      baseRate = 1.04;
    } else if (profile.code === "Mao" || profile.code === "BenTen") {
      pitch = 1.18; // Youthful, energetic, confident American teen hero
      baseRate = 1.03; // Clear, enthusiastic heroic pace
    } else if (profile.code === "Wanko" || profile.code === "Puppy" || profile.code === "ScoobyDoo") {
      pitch = 0.92; // Warm, goofy, slightly relaxed mid-depth cartoon dog
      baseRate = 0.94; // Slightly slower, comfortable conversational pace
    } else if (profile.code === "MaleTeacher") {
      pitch = 1.00; // Articulate, calm, professional male teacher
      baseRate = 0.96; // Moderate, clear pace for learners
    }
  }

  // Mutually exclusive strict character parameter locks
  if (isSpongeBobActive) {
    gender = "male";
    pitch = 1.18;
    baseRate = 1.02;
    targetLang = "en-US";
  } else if (!isRegionalVoice && (isTeacherAvatar || effectiveVoiceCode === "Teacher")) {
    gender = "female";
    pitch = 1.12;
    baseRate = 0.98;
    targetLang = "en-IN";
  } else if (!isRegionalVoice && (isMaleTeacherAvatar || effectiveVoiceCode === "MaleTeacher")) {
    gender = "male";
    pitch = 1.00;
    baseRate = 0.96;
    targetLang = "en-IN";
  } else if (isShizukuActive) {
    gender = "female";
    pitch = 1.22;
    baseRate = 1.04;
    targetLang = "en-US";
  } else if (isDoraemonActive) {
    gender = "male";
    pitch = 1.06;
    baseRate = 1.03;
    targetLang = "en-US";
  } else if (isChhotaBheemActive) {
    gender = "male";
    pitch = 1.22;
    baseRate = 1.03;
    targetLang = "en-IN";
  } else if (isBenTenActive) {
    gender = "male";
    pitch = 1.18;
    baseRate = 1.03;
    targetLang = "en-US";
  } else if (isNinjaHattoriActive) {
    gender = "male";
    pitch = 1.20;
    baseRate = 1.04;
    targetLang = "en-US";
  } else if (isTomActive) {
    gender = "male";
    pitch = 1.20;
    baseRate = 1.04;
    targetLang = "en-US";
  } else if (isScoobyActive) {
    gender = "male";
    pitch = 0.92;
    baseRate = 0.94;
    targetLang = "en-US";
  }

  return {
    aiVoice,
    onboardingVoice,
    effectiveVoiceCode,
    isDefault,
    profile,
    personaObj,
    accent,
    gender,
    selectedVoiceName,
    pitch,
    rateMultiplier: parseFloat(customRate),
    lang: targetLang,
    baseRate,
  };
};

export const applyGlobalVoiceSettings = (utterance, speedMultiplier = 1.0, overrideVoiceCode = null, overrideModel = null) => {
  if (!utterance || typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const settings = getSavedVoiceSettings(overrideVoiceCode, overrideModel);
  utterance.lang = settings.lang;
  utterance.pitch = settings.pitch;
  utterance.rate = settings.baseRate * settings.rateMultiplier * speedMultiplier;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

  let targetVoice = null;
  const hasOverride = Boolean(overrideVoiceCode || overrideModel);
  const activeModel = hasOverride
    ? (overrideModel || mapVoiceCodeToModel(overrideVoiceCode) || "").toLowerCase()
    : (localStorage.getItem("speakmate_avatar_model") || "haru").toLowerCase();
  const effCode = (settings.effectiveVoiceCode || "").toLowerCase();

  const isSpongeBobActive = effCode === "spongebob" || activeModel === "spongebob";
  const isShizukuActive = effCode === "shizuku" || effCode === "shizuka" || activeModel === "shizuku" || activeModel === "shizuka";
  const isDoraemonActive = effCode === "robo-paws" || effCode === "doraemon" || effCode === "robopaws" || activeModel === "robopaws" || activeModel === "doraemon";
  const isChhotaBheemActive = effCode === "sparky" || effCode === "chhotabheem" || activeModel === "sparky" || activeModel === "bheem" || activeModel === "chhotabheem";
  const isBenTenActive = effCode === "mao" || effCode === "benten" || effCode === "ben 10" || activeModel === "mao" || activeModel === "ben" || activeModel === "ben10";
  const isNinjaHattoriActive = effCode === "koharu" || effCode === "ninjahattori" || activeModel === "koharu" || activeModel === "hattori" || activeModel === "ninjahattori";
  const isTomActive = effCode === "haruto" || effCode === "tom" || activeModel === "haruto" || activeModel === "tom";
  const isScoobyActive = effCode === "puppy" || effCode === "wanko" || effCode === "scoobydoo" || effCode === "scooby" || activeModel === "puppy" || activeModel === "wanko" || activeModel === "dog" || activeModel === "scooby" || activeModel === "scoobydoo";
  const isTeacherActive = effCode === "teacher" || activeModel === "haru" || activeModel === "teacher";
  const isMaleTeacherActive = effCode === "maleteacher" || activeModel === "chitose" || activeModel === "maleteacher";

  const REGIONAL_VOICES = [
    "us male", "us female",
    "uk male", "uk female",
    "au male", "au female",
    "in male", "in female"
  ];
  const isRegionalActive = REGIONAL_VOICES.includes(effCode);
  const isTeacherNativeActive = !isRegionalActive && isTeacherActive;
  const isMaleTeacherNativeActive = !isRegionalActive && isMaleTeacherActive;

    if (isSpongeBobActive) {
      // ── SPONGEBOB DEDICATED YOUTHFUL BOY VOICE LOCK ──
      // Force SpongeBob youthful cartoon boy voice using the deterministic scoring resolver.
      // Strictly ignores any previously selected female or generic voice.
      targetVoice = selectSpongeBobBoyVoice(voices);

      // Adaptive base pitch: if selected voice is deeper (e.g. David/Mark), lift pitch slightly more (1.22)
      // If naturally youthful (Guy/Ryan/Alex/Daniel), use sweet youthful pitch (1.18)
      const vName = (targetVoice?.name || "").toLowerCase();
      const isDeeperVoice = vName.includes("david") || vName.includes("mark");
      const basePitch = isDeeperVoice ? 1.22 : 1.18;

      const intonation = getSpongeBobIntonation(utterance.text || "");
      utterance.pitch = Math.max(1.00, Math.min(1.30, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.90, Math.min(1.15, 1.02 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
    } else if (isShizukuActive) {
      // ── SHIZUKA / SHIZUKU DEDICATED AVATAR VOICE LOCK ──
      // Force Shizuka female cheerful voice using the deterministic scoring resolver.
      // Strictly ignores any previously selected male voice.
      targetVoice = selectShizukuFemaleVoice(voices);
      utterance.pitch = 1.22;
      utterance.rate = 1.04 * (settings.rateMultiplier || 1.0) * speedMultiplier;
    } else if (isDoraemonActive) {
      // ── DORAEMON DEDICATED ROBOTIC MALE AVATAR VOICE LOCK ──
      // Force Doraemon robotic male voice with kind, gentle, humble, and mischievous cadence
      targetVoice = selectDoraemonRoboticVoice(voices);

      const vName = (targetVoice?.name || "").toLowerCase();
      const isHardwareRobot = vName.includes("robot") || vName.includes("zarvox") || vName.includes("trinoids") || vName.includes("android");
      const isDeepMale = vName.includes("david") || vName.includes("george") || vName.includes("ravi");
      const basePitch = isHardwareRobot ? 1.00 : isDeepMale ? 1.07 : 1.05;

      const intonation = getDoraemonIntonation(utterance.text || "");
      utterance.pitch = Math.max(0.96, Math.min(1.22, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.92, Math.min(1.15, 1.03 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
      utterance.volume = 1.0;
    } else if (isChhotaBheemActive) {
      // ── CHHOTA BHEEM DEDICATED YOUTHFUL HERO VOICE LOCK ──
      // Force Chhota Bheem youthful Indian hero voice using the deterministic scoring resolver.
      // Strictly ignores any previously selected female or generic voice.
      targetVoice = selectChhotaBheemVoice(voices);

      // Adaptive base pitch: if selected voice is deeper (e.g. David/Ravi/George), lift pitch slightly more (1.22)
      // If naturally youthful (Guy/Ryan/Prabhat), use vibrant youthful pitch (1.18)
      const vName = (targetVoice?.name || "").toLowerCase();
      const isDeeperVoice = vName.includes("david") || vName.includes("ravi") || vName.includes("george");
      const basePitch = isDeeperVoice ? 1.22 : 1.18;

      const intonation = getChhotaBheemIntonation(utterance.text || "");
      utterance.pitch = Math.max(1.05, Math.min(1.32, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.92, Math.min(1.15, 1.03 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
    } else if (isBenTenActive) {
      // ── BEN 10 DEDICATED YOUTHFUL HERO VOICE LOCK ──
      // Force Ben 10 youthful American male hero voice using the deterministic scoring resolver.
      // Strictly ignores any previously selected female or generic voice.
      targetVoice = selectBenTenBoyVoice(voices);

      // Adaptive base pitch: if selected voice is deeper (e.g. David/Mark), lift pitch slightly more (1.20)
      // If naturally youthful (Guy/Eric/Christopher/Alex), use sweet youthful heroic pitch (1.18)
      const vName = (targetVoice?.name || "").toLowerCase();
      const isDeeperVoice = vName.includes("david") || vName.includes("mark");
      const basePitch = isDeeperVoice ? 1.20 : 1.18;

      const intonation = getBenTenIntonation(utterance.text || "");
      utterance.pitch = Math.max(1.05, Math.min(1.30, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.92, Math.min(1.15, 1.03 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
    } else if (isNinjaHattoriActive) {
      // ── NINJA HATTORI DEDICATED YOUTHFUL HERO VOICE LOCK ──
      // Force Ninja Hattori youthful English male hero voice using the deterministic scoring resolver.
      // Strictly ignores any previously selected female or generic voice.
      targetVoice = selectNinjaHattoriVoice(voices);

      // Adaptive base pitch: if selected voice is deeper (e.g. David/Mark), lift pitch slightly more (1.22)
      // If naturally youthful (Guy/Eric/Ryan/Alex/Daniel), use sweet youthful heroic pitch (1.19)
      const vName = (targetVoice?.name || "").toLowerCase();
      const isDeeperVoice = vName.includes("david") || vName.includes("mark");
      const basePitch = isDeeperVoice ? 1.22 : 1.19;

      const intonation = getNinjaHattoriIntonation(utterance.text || "");
      utterance.pitch = Math.max(1.05, Math.min(1.30, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.92, Math.min(1.15, 1.04 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
    } else if (isScoobyActive) {
      // ── SCOOBY-DOO DEDICATED CARTOON-DOG VOICE LOCK ──
      // Force Scooby-Doo warm, playful, goofy cartoon dog voice using deterministic scoring resolver.
      // Strictly ignores any previously selected female or generic voice.
      targetVoice = selectScoobyVoice(voices);

      // Adaptive base pitch:
      // If selected voice is naturally deep (e.g. David/George/Oliver), pitch = 0.95 to avoid over-lowering
      // If naturally lighter/youthful (Guy/Eric/Christopher/Mark/Alex), pitch = 0.92 for warm cartoon dog warmth
      const vName = (targetVoice?.name || "").toLowerCase();
      const isDeeperVoice = vName.includes("david") || vName.includes("george") || vName.includes("oliver");
      const basePitch = isDeeperVoice ? 0.95 : 0.92;

      const intonation = getScoobyIntonation(utterance.text || "");
      utterance.pitch = Math.max(0.85, Math.min(1.02, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.88, Math.min(1.02, 0.94 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
      utterance.volume = 1.0;
    } else if (isTomActive) {
      // ── TOM DEDICATED CARTOON CAT VOICE LOCK ──
      // Force Tom playful, witty classic cartoon cat male voice using deterministic scoring resolver.
      // Strictly ignores any previously selected female or generic voice.
      targetVoice = selectTomVoice(voices);

      const vName = (targetVoice?.name || "").toLowerCase();
      const isDeeperVoice = vName.includes("david") || vName.includes("mark");
      const basePitch = isDeeperVoice ? 1.22 : 1.20;

      const intonation = getTomIntonation(utterance.text || "");
      utterance.pitch = Math.max(1.05, Math.min(1.30, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.92, Math.min(1.15, 1.04 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
    } else if (isTeacherNativeActive) {
      // ── TEACHER OWN NATIVE VOICE LOCK (WARM, ARTICULATE FEMALE ENGLISH TEACHER) ──
      // Strictly used when Teacher is active and no regional voice is selected.
      targetVoice = selectTeacherFemaleVoice(voices);
      utterance.pitch = 1.12;
      utterance.rate = 0.98 * (settings.rateMultiplier || 1.0) * speedMultiplier;
      utterance.volume = 1.0;
    } else if (isMaleTeacherNativeActive) {
      // ── MALE TEACHER OWN NATIVE VOICE LOCK (CALM, ARTICULATE MALE ENGLISH TEACHER) ──
      // Strictly used when Male Teacher is active and no regional voice is selected.
      targetVoice = selectMaleTeacherVoice(voices);
      const intonation = getMaleTeacherIntonation(utterance.text || "");
      const vName = (targetVoice?.name || "").toLowerCase();
      const isDeeperVoice = vName.includes("david") || vName.includes("george");
      const basePitch = isDeeperVoice ? 1.00 : 0.98;

      utterance.pitch = Math.max(0.92, Math.min(1.08, basePitch + intonation.pitchOffset));
      utterance.rate = Math.max(0.88, Math.min(1.05, 0.96 * (settings.rateMultiplier || 1.0) * speedMultiplier + intonation.rateOffset));
      utterance.volume = 1.0;
    } else {
      // 1. Explicit user selection by voice name
      if (settings.selectedVoiceName) {
        targetVoice = voices.find((v) => v.name === settings.selectedVoiceName);
      }

      const isMale = settings.gender === "male";
      const targetLangPrefix = settings.lang.toLowerCase(); // e.g. "en-us", "en-gb", "en-au", "en-in"
      const langBase = settings.lang.split("-")[0].toLowerCase(); // "en"

      // Profile-specific voice lists
      const US_MALE = ["guy", "david", "mark", "alex", "us male", "en-us"];
      const US_FEMALE = ["jenny", "zira", "samantha", "us female", "en-us"];
      const UK_MALE = ["ryan", "george", "oliver", "daniel", "malcolm", "uk male", "british", "en-gb", "en_gb", "united kingdom"];
      const UK_FEMALE = ["sonia", "hazel", "fiona", "kate", "serena", "libby", "mia", "uk female", "british", "en-gb", "en_gb", "united kingdom"];
      const AU_MALE = ["william", "russell", "au male", "australian", "en-au", "en_au", "australia"];
      const AU_FEMALE = ["natasha", "catherine", "karen", "annette", "au female", "australian", "en-au", "en_au", "australia"];
      const IN_MALE = ["prabhat", "rishi", "ravi", "in male", "indian", "en-in", "en_in"];
      const IN_FEMALE = ["neerja", "veena", "heera", "kalpana", "ananya", "in female", "indian", "en-in", "en_in", "hindi"];

      const MALE_NAMES = ["guy", "david", "mark", "alex", "tom", "chris", "george", "james", "ryan", "oliver", "daniel", "william", "russell", "prabhat", "rishi", "ravi", "male"];
      const FEMALE_NAMES = ["jenny", "zira", "samantha", "victoria", "karen", "susan", "sonia", "hazel", "fiona", "kate", "serena", "natasha", "catherine", "libby", "mia", "annette", "neerja", "veena", "heera", "female"];

      // Profile-driven targeted voice matching for AU Female (Explicitly excludes Indian & US female voices)
      if (settings.effectiveVoiceCode === "AU Female" || effCode === "au female") {
        const EXCLUDE_IN_FEMALES = ["neerja", "veena", "heera", "kalpana", "ananya", "indian", "in-in", "zira", "jenny", "david", "guy"];
        targetVoice = voices.find((v) =>
          (v.lang.toLowerCase().includes("au") || v.name.toLowerCase().includes("australia") || AU_FEMALE.some((k) => v.name.toLowerCase().includes(k))) &&
          !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)) &&
          !EXCLUDE_IN_FEMALES.some((k) => v.name.toLowerCase().includes(k))
        );
        if (!targetVoice) {
          targetVoice = voices.find((v) =>
            AU_FEMALE.some((k) => v.name.toLowerCase().includes(k)) &&
            !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)) &&
            !EXCLUDE_IN_FEMALES.some((k) => v.name.toLowerCase().includes(k))
          );
        }
        if (!targetVoice) {
          targetVoice = voices.find((v) =>
            v.lang.toLowerCase().includes("au") &&
            !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k))
          );
        }
        if (!targetVoice) {
          targetVoice = voices.find((v) =>
            !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)) &&
            !EXCLUDE_IN_FEMALES.some((k) => v.name.toLowerCase().includes(k))
          );
        }
      } else if (settings.effectiveVoiceCode === "IN Female" || effCode === "in female") {
        targetVoice = voices.find((v) =>
          (v.lang.toLowerCase().includes("in") || v.name.toLowerCase().includes("indian") || v.name.toLowerCase().includes("veena") || v.name.toLowerCase().includes("neerja") || v.name.toLowerCase().includes("heera")) &&
          !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k))
        );
        if (!targetVoice) {
          targetVoice = voices.find((v) => v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("jenny")) ||
                        voices.find((v) => FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
        }
      } else if (settings.effectiveVoiceCode === "UK Female" || effCode === "uk female") {
        targetVoice = voices.find((v) =>
          (v.lang.toLowerCase().includes("gb") || v.name.toLowerCase().includes("uk") || v.name.toLowerCase().includes("british")) &&
          (FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k)) || UK_FEMALE.some((k) => v.name.toLowerCase().includes(k))) &&
          !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k))
        ) || voices.find((v) => UK_FEMALE.some((k) => v.name.toLowerCase().includes(k)))
          || voices.find((v) => v.lang.toLowerCase().includes("gb") && !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
      } else if (settings.effectiveVoiceCode === "UK Male" || effCode === "uk male") {
        targetVoice = voices.find((v) =>
          (v.lang.toLowerCase().includes("gb") || v.name.toLowerCase().includes("uk") || v.name.toLowerCase().includes("british")) &&
          (MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)) || UK_MALE.some((k) => v.name.toLowerCase().includes(k))) &&
          !FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k))
        ) || voices.find((v) => UK_MALE.some((k) => v.name.toLowerCase().includes(k)))
          || voices.find((v) => v.lang.toLowerCase().includes("gb") && !FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
      } else if (settings.effectiveVoiceCode === "AU Male" || effCode === "au male") {
        targetVoice = voices.find((v) =>
          (v.lang.toLowerCase().includes("au") || AU_MALE.some((k) => v.name.toLowerCase().includes(k))) &&
          !FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k))
        );
        if (!targetVoice) {
          targetVoice = voices.find((v) => v.name.toLowerCase().includes("mark") || v.name.toLowerCase().includes("george") || v.name.toLowerCase().includes("chris") || v.name.toLowerCase().includes("alex")) ||
                        voices.find((v) => MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
        }
      } else if (settings.effectiveVoiceCode === "US Female" || effCode === "us female") {
        targetVoice = voices.find((v) =>
          v.lang.toLowerCase().includes("us") && (v.name.toLowerCase().includes("jenny") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("samantha") || v.name.toLowerCase().includes("female"))
        ) || voices.find((v) => US_FEMALE.some((k) => v.name.toLowerCase().includes(k)))
          || voices.find((v) => v.lang.toLowerCase().includes("us") && !MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
      } else if (settings.effectiveVoiceCode === "US Male" || effCode === "us male") {
        targetVoice = voices.find((v) =>
          v.lang.toLowerCase().includes("us") && (v.name.toLowerCase().includes("guy") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("male"))
        ) || voices.find((v) => US_MALE.some((k) => v.name.toLowerCase().includes(k)));
      } else if (settings.effectiveVoiceCode === "IN Male" || effCode === "in male") {
        targetVoice = voices.find((v) =>
          (v.lang.toLowerCase().includes("in") || v.name.toLowerCase().includes("indian") || v.name.toLowerCase().includes("rishi") || v.name.toLowerCase().includes("prabhat")) &&
          !FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k))
        );
        if (!targetVoice) {
          targetVoice = voices.find((v) => MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
        }
      } else if (settings.effectiveVoiceCode === "Motu") {
        targetVoice = voices.find((v) =>
          (v.lang.toLowerCase().includes("in") || v.name.toLowerCase().includes("indian") || v.name.toLowerCase().includes("rishi") || v.name.toLowerCase().includes("prabhat")) &&
          !FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k))
        ) || voices.find((v) => MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
      } else if (settings.effectiveVoiceCode === "Doraemon" || settings.effectiveVoiceCode === "Robo-Paws" || settings.effectiveVoiceCode === "Sparky" || settings.effectiveVoiceCode === "Haruto" || settings.effectiveVoiceCode === "Wanko" || settings.effectiveVoiceCode === "Puppy") {
        targetVoice = voices.find((v) =>
          v.lang.toLowerCase().includes("us") && (v.name.toLowerCase().includes("guy") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("mark") || v.name.toLowerCase().includes("alex"))
        ) || voices.find((v) => MALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
      } else if (settings.effectiveVoiceCode === "Koharu") {
        targetVoice = voices.find((v) =>
          v.lang.toLowerCase().includes("us") && (v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("jenny") || v.name.toLowerCase().includes("samantha"))
        ) || voices.find((v) => FEMALE_NAMES.some((k) => v.name.toLowerCase().includes(k)));
      }

      // Generic fallbacks if targetVoice not matched above
      if (!targetVoice) {
        const preferredKeywords = isMale ? MALE_NAMES : FEMALE_NAMES;
        const excludedKeywords = isMale ? FEMALE_NAMES : MALE_NAMES;

        const matchesGender = (v) => {
          const vName = v.name.toLowerCase();
          const hasPreferred = preferredKeywords.some((k) => vName.includes(k));
          const hasExcluded = excludedKeywords.some((k) => vName.includes(k));
          if (hasPreferred && !hasExcluded) return true;
          if (isMale && (vName.includes("david") || vName.includes("guy") || vName.includes("george") || vName.includes("male"))) return true;
          if (!isMale && (vName.includes("zira") || vName.includes("jenny") || vName.includes("samantha") || vName.includes("female"))) return true;
          return false;
        };

        targetVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().replace("_", "-") === targetLangPrefix &&
            (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online") || v.name.toLowerCase().includes("google")) &&
            matchesGender(v)
        );

        if (!targetVoice) {
          targetVoice = voices.find(
            (v) => v.lang.toLowerCase().replace("_", "-") === targetLangPrefix && matchesGender(v)
          );
        }

        if (!targetVoice) {
          targetVoice = voices.find(
            (v) =>
              v.lang.toLowerCase().replace("_", "-") === targetLangPrefix &&
              (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online") || v.name.toLowerCase().includes("google"))
          );
        }

        if (!targetVoice) {
          targetVoice = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === targetLangPrefix);
        }

        if (!targetVoice) {
          targetVoice = voices.find(
            (v) => v.lang.toLowerCase().startsWith(langBase) && matchesGender(v)
          );
        }
      }

      // Ultimate fallback for non-Shizuku avatars
      if (!targetVoice && voices.length > 0) {
        targetVoice = voices[0];
      }
    }

  if (targetVoice) {
    utterance.voice = targetVoice;
    utterance.lang = targetVoice.lang || settings.lang;

      if (!isShizukuActive && !isDoraemonActive && !isSpongeBobActive && !isChhotaBheemActive && !isBenTenActive && !isNinjaHattoriActive && !isScoobyActive && !isTomActive && !isTeacherNativeActive && !isMaleTeacherNativeActive) {
        // Fine-tune pitch for smooth natural clarity if fallback voice doesn't match gender
        const FEMALE_NAMES = ["jenny", "zira", "samantha", "victoria", "karen", "susan", "sonia", "hazel", "fiona", "kate", "serena", "natasha", "catherine", "libby", "mia", "annette", "neerja", "veena", "heera", "female"];
        const MALE_NAMES = ["guy", "david", "mark", "alex", "tom", "chris", "george", "james", "ryan", "oliver", "daniel", "william", "russell", "prabhat", "rishi", "ravi", "male"];
        const isMale = settings.gender === "male";
        const voiceIsFemale = FEMALE_NAMES.some((k) => targetVoice.name.toLowerCase().includes(k));
        const voiceIsMale = MALE_NAMES.some((k) => targetVoice.name.toLowerCase().includes(k));
        if (isMale && voiceIsFemale) {
          utterance.pitch = 0.88; // Subtle pitch-shift down for masculine depth
        } else if (!isMale && voiceIsMale) {
          utterance.pitch = 1.12; // Subtle pitch-shift up for feminine clarity
        }
      }
  }
};

export const stopSpeaking = () => {
  if (typeof window === "undefined") return;
  try {
    if (window._activeUtterance) {
      window._activeUtterance.onstart = null;
      window._activeUtterance.onboundary = null;
      window._activeUtterance.onend = null;
      window._activeUtterance.onerror = null;
      window._activeUtterance = null;
    }
    if (typeof window._activeCleanupKeepAlive === "function") {
      window._activeCleanupKeepAlive();
      window._activeCleanupKeepAlive = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch (_) {}
  window._speakmate_ai_is_speaking = false;
  EventBus.emit(AVATAR_EVENTS.SPEECH_FINISHED);
};

export const warmupSpeechAutoplay = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (_) {}
};

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const unlockAudio = () => {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (_) {}
  };
  window.addEventListener("click", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
}

export const speakGlobalText = (text, speedMultiplier = 1.0, options = {}) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return null;

  try {
    if (typeof window._activeCleanupKeepAlive === "function") {
      window._activeCleanupKeepAlive();
      window._activeCleanupKeepAlive = null;
    }
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (e) {}

  const cleanText = text
    .replace(/[*_#`~]/g, "")
    .replace(/\bg['’]day\b/gi, "Hello")
    .replace(/\bgood\s+day\b/gi, "Hello")
    .trim();
  if (!cleanText) return null;

  let keepAliveInterval = null;
  let wordTickerTimeout = null;

  const startWordTicker = () => {
    if (wordTickerTimeout) return;
    const words = cleanText.split(/\s+/).filter(Boolean);
    if (!words.length) return;
    let wordIdx = 0;
    const speed = Math.max(0.5, Math.min(2.0, Number(speedMultiplier) || 1.0));

    const tickNext = () => {
      if (!window._speakmate_ai_is_speaking) {
        if (wordTickerTimeout) {
          clearTimeout(wordTickerTimeout);
          wordTickerTimeout = null;
        }
        return;
      }

      let currentWord = "";
      if (wordIdx < words.length) {
        currentWord = words[wordIdx++];
      } else {
        // Words array completed, but audio is STILL actively speaking:
        // Sustain natural vocalic visemes across trailing phrases until utterance end
        const naturalVowels = ["ah", "ee", "oh", "eh", "uh"];
        currentWord = naturalVowels[Math.floor(Math.random() * naturalVowels.length)];
      }

      const visemeObj = getPrimaryVisemeForWord(currentWord);
      EventBus.emit(AVATAR_EVENTS.LIP_SYNC_UPDATE, {
        word: currentWord,
        viseme: visemeObj.viseme,
        yVal: visemeObj.yVal,
        formVal: visemeObj.formVal,
      });

      // Calculate realistic timing matching authentic human TTS pacing:
      // Base word articulation (length scaled)
      const baseMs = Math.max(220, Math.min(420, currentWord.length * 48));
      let delayMs = Math.round(baseMs / speed);

      // Add realistic punctuation pause weighting
      if (/[,\uFF0C;:]$/.test(currentWord)) {
        delayMs += Math.round(240 / speed);
      } else if (/[.?!]$/.test(currentWord)) {
        delayMs += Math.round(440 / speed);
      }

      wordTickerTimeout = setTimeout(tickNext, delayMs);
    };

    // Emit initial word viseme immediately upon actual utterance playback start
    tickNext();
  };

  // Chrome keep-alive heartbeat (safely resumes without interrupting speech)
  keepAliveInterval = setInterval(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  }, 1000);

  const cleanupKeepAlive = () => {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    if (wordTickerTimeout) {
      clearTimeout(wordTickerTimeout);
      wordTickerTimeout = null;
    }
    window._activeUtterance = null;
    window._activeCleanupKeepAlive = null;
  };
  window._activeCleanupKeepAlive = cleanupKeepAlive;

  // Phonetic TTS pronunciation normalizations
  // Maps "Doraemon" to "Dohraymon" so the speech synthesizer articulates the exact authentic pronunciation with zero awkward "Dora-E-mon" split
  const spokenText = cleanText
    .replace(/\bDoraemon\b/g, "Dohraymon")
    .replace(/\bdoraemon\b/g, "dohraymon")
    .replace(/\bDoremon\b/g, "Dohraymon")
    .replace(/\bdoremon\b/g, "dohraymon");

  const utterance = new SpeechSynthesisUtterance(spokenText);
  window._activeUtterance = utterance;

  utterance.onstart = (e) => {
    // Only lock and start lip sync when audio words physically begin playing from the speaker!
    window._speakmate_ai_is_speaking = true;
    EventBus.emit(AVATAR_EVENTS.SPEECH_STARTED, { text: cleanText, speed: speedMultiplier });
    startWordTicker();
    if (options.onstart) options.onstart(e);
  };

  utterance.onboundary = (e) => {
    window._speakmate_ai_is_speaking = true;
    if (e.name === "word" || e.charIndex !== undefined) {
      const remaining = cleanText.substring(e.charIndex, e.charIndex + (e.charLength || 8));
      const word = remaining.split(/\s+/)[0] || "";
      const visemeObj = getPrimaryVisemeForWord(word);
      EventBus.emit(AVATAR_EVENTS.LIP_SYNC_UPDATE, {
        word,
        viseme: visemeObj.viseme,
        yVal: visemeObj.yVal,
        formVal: visemeObj.formVal,
      });
    }
    if (options.onboundary) options.onboundary(e);
  };

  const handleFinish = () => {
    cleanupKeepAlive();
    // Instantly unlock speech flag and trigger SPEECH_FINISHED with 0ms delay so mouth snaps shut
    window._speakmate_ai_is_speaking = false;
    EventBus.emit(AVATAR_EVENTS.SPEECH_FINISHED);
    if (options.onend) options.onend();
  };

  utterance.onend = () => {
    handleFinish();
  };

  utterance.onerror = (err) => {
    console.warn("[speechHelper] Speech playback warning/interrupted:", err);
    handleFinish();
  };

  const doSpeak = () => {
    try {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      window.speechSynthesis.resume();
      applyGlobalVoiceSettings(utterance, speedMultiplier, options.overrideVoiceCode, options.avatarModel);
      window.speechSynthesis.speak(utterance);
      setTimeout(() => {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 60);
    } catch (e) {
      console.warn("[speechHelper] Speech execution error:", e);
      handleFinish();
    }
  };

  const voices = window.speechSynthesis.getVoices();
  let hasSpoken = false;
  if (!voices || voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      if (!hasSpoken) {
        hasSpoken = true;
        doSpeak();
      }
    };
    setTimeout(() => {
      if (!hasSpoken) {
        hasSpoken = true;
        doSpeak();
      }
    }, 150);
  } else {
    hasSpoken = true;
    doSpeak();
  }

  return utterance;
};

export async function speakGlobalSequential(segments = [], speedMultiplier = 1.0, pauseMs = 400, options = {}) {
  if (!segments || segments.length === 0) return;
  const cleanSegments = segments.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  if (cleanSegments.length === 0) return;

  for (let i = 0; i < cleanSegments.length; i++) {
    const seg = cleanSegments[i];
    await new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      const timer = setTimeout(done, 12000);
      speakGlobalText(seg, speedMultiplier, {
        ...options,
        onend: () => {
          clearTimeout(timer);
          done();
        },
      });
    });

    if (i < cleanSegments.length - 1) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
}

export function getCurrentVoiceGender() {
  if (typeof window === 'undefined') return 'female';
  try {
    const currentAvatarModel = (localStorage.getItem("speakmate_avatar_model") || "").toLowerCase();
    if (currentAvatarModel === "shizuku" || currentAvatarModel === "shizuka") return "female";
    if (currentAvatarModel === "robopaws" || currentAvatarModel === "doraemon") return "male";
    if (currentAvatarModel === "sparky" || currentAvatarModel === "bheem" || currentAvatarModel === "chhotabheem" || currentAvatarModel === "spongebob" || currentAvatarModel === "mao" || currentAvatarModel === "ben" || currentAvatarModel === "ben10" || currentAvatarModel === "koharu" || currentAvatarModel === "hattori" || currentAvatarModel === "ninjahattori" || currentAvatarModel === "haruto" || currentAvatarModel === "tom" || currentAvatarModel === "puppy" || currentAvatarModel === "wanko" || currentAvatarModel === "dog" || currentAvatarModel === "scooby" || currentAvatarModel === "scoobydoo" || currentAvatarModel === "chitose" || currentAvatarModel === "maleteacher") return "male";

    const directGender = localStorage.getItem('speakmate_voice_gender');
    if (directGender) return directGender;

    const savedVoice =
      localStorage.getItem('speakmate_ai_voice') ||
      localStorage.getItem('speakmate_voice_code') ||
      localStorage.getItem('speakmate_voice') ||
      localStorage.getItem('speakmate_voice_persona');

    if (savedVoice) {
      if (savedVoice === 'robopaws' || savedVoice === 'Robo-Paws' || savedVoice === 'doraemon' || savedVoice === 'Doraemon' || savedVoice.toLowerCase().includes('robo') || savedVoice.toLowerCase().includes('doraemon')) {
        return 'male';
      }
      const match = VOICE_PROFILES.find((p) => p.code === savedVoice || p.label === savedVoice);
      if (match?.gender) return match.gender;

      const personaMatch = VOICE_PERSONAS.find((p) => p.key === savedVoice || p.label === savedVoice);
      if (personaMatch?.gender) return personaMatch.gender;

      const lower = savedVoice.toLowerCase();
      if (lower.includes('male') && !lower.includes('female')) return 'male';
      if (lower === 'professional' || lower === 'calm') return 'male';
    }
  } catch (e) {}
  return 'female';
}
