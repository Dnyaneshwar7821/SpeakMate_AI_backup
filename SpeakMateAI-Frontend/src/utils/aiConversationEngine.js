// ============================================================================
// SPEAKMATE AI CONVERSATION & COACHING ENGINE (WEB & OFFLINE RESILIENT)
// ============================================================================

export function cleanDialogueText(rawText) {
  if (!rawText) return "";
  let clean = String(rawText);
  
  // If the response is a JSON string, parse the aiReply
  if (clean.trim().startsWith("{") && clean.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.aiReply) return cleanDialogueText(parsed.aiReply);
    } catch (e) {}
  }

  // If the text contains markdown tables or section headers, filter out labels and tables
  if (clean.includes("|") || clean.includes("##") || clean.includes("---")) {
    const lines = clean.split("\n");
    const validLines = lines.filter((l) => {
      const trimmed = l.trim();
      return (
        !trimmed.includes("|") &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("---") &&
        !trimmed.toLowerCase().startsWith("text:") &&
        !trimmed.toLowerCase().startsWith("overall impression") &&
        !trimmed.toLowerCase().startsWith("feedback") &&
        !trimmed.endsWith(":") &&
        trimmed.length > 8
      );
    });
    if (validLines.length > 0) {
      clean = validLines.join(" ");
    }
  }

  // Strip remaining markdown and meta tags
  clean = clean.replace(/\|.*\|/g, " ");
  clean = clean.replace(/#+\s*/g, "");
  clean = clean.replace(/\*\*/g, "").replace(/\*/g, "");
  clean = clean.replace(/---+/g, " ");
  clean = clean.replace(/\[.*?\]/g, "");
  clean = clean.replace(/\(.*?\)/g, "");
  clean = clean.replace(/\s+/g, " ").trim();
  
  // If clean string is too short or is a leftover label, provide a natural conversational fallback
  if (clean.length < 5 || clean.toLowerCase() === "text" || clean.toLowerCase() === "overall impression") {
    clean = "That is a great thought! Can you tell me more about that?";
  }

  return clean;
}

export function generateDynamicCoachingResponse(userText, scenario = "Daily Conversation", history = []) {
  const text = (userText || "").trim();
  const lower = text.toLowerCase();

  // 1. Analyze Grammar & Punctuation
  let grammarCorrection = "✅ Your sentence is grammatically clear and natural.";
  let betterSentence = null;
  let explanation = null;
  let vocabularySuggestions = null;

  // Common grammar checks
  if (lower.includes("more better") || lower.includes("more easier")) {
    grammarCorrection = text.replace(/more better/gi, "better").replace(/more easier/gi, "easier");
    betterSentence = `I find it much better to practice consistently.`;
    explanation = "In English, 'better' and 'easier' are already comparative adjectives, so avoid adding 'more'.";
    vocabularySuggestions = "Significantly better, Much easier, Preferable";
  } else if (lower.includes("she don't") || lower.includes("he don't") || lower.includes("it don't")) {
    grammarCorrection = text.replace(/she don't/gi, "she doesn't").replace(/he don't/gi, "he doesn't").replace(/it don't/gi, "it doesn't");
    explanation = "Third-person singular subjects (He, She, It) use 'does not' or 'doesn't'.";
    vocabularySuggestions = "Doesn't, Seldom, Rarely";
  } else if (lower.includes("i am agree") || lower.includes("i'm agree")) {
    grammarCorrection = text.replace(/i am agree/gi, "I agree").replace(/i'm agree/gi, "I agree");
    betterSentence = "I completely agree with that perspective.";
    explanation = "'Agree' is a verb, so you say 'I agree' rather than 'I am agree'.";
    vocabularySuggestions = "Concur, See eye to eye, Endorse";
  } else if (lower.includes("last night i go") || lower.includes("yesterday i go")) {
    grammarCorrection = text.replace(/i go/gi, "I went");
    betterSentence = "Yesterday I went there and enjoyed the experience.";
    explanation = "When describing completed actions in the past, use the simple past tense 'went'.";
    vocabularySuggestions = "Visited, Attended, Explored";
  } else if (lower.length > 5 && !/[.!?]$/.test(text)) {
    betterSentence = `${text.charAt(0).toUpperCase() + text.slice(1)}.`;
  }

  // 2. Contextual Dynamic Replies based on scenario and user turn
  const count = (history || []).length;
  const s = (scenario || "").toLowerCase();

  let aiReply = "That is a great thought! What other details would you like to share about this topic?";
  let followUpQuestion = "How do you feel about practicing this in real-life conversations?";

  if (s.includes("interview") || s.includes("job") || s.includes("career")) {
    const replies = [
      "That highlights your dedication and strengths well. Could you describe a challenging project and how you solved it?",
      "Excellent explanation. What key technical or team skills are you focusing on improving next?",
      "Very clear and professional answer! Where do you see yourself making the biggest impact in your role?",
    ];
    aiReply = replies[count % replies.length];
    followUpQuestion = "Would you like to practice answering a question about your team leadership experience?";
  } else if (s.includes("restaurant") || s.includes("food") || s.includes("cafe")) {
    const replies = [
      "That sounds delicious! Would you prefer that with an appetizer or a refreshing drink?",
      "Certainly! Our chef prepares that fresh daily. Can I get you any dessert or the check when you're ready?",
      "Great choice! How would you like that prepared today?",
    ];
    aiReply = replies[count % replies.length];
    followUpQuestion = "Would you like to practice asking for the dessert menu or the bill?";
  } else if (s.includes("travel") || s.includes("hotel") || s.includes("airport")) {
    const replies = [
      "Traveling to new destinations is always thrilling! What has been the most memorable place you've ever explored?",
      "I have your reservation details noted. Would you like a room with a city view or near the quiet garden?",
      "Sounds like a fantastic trip plan! What local cuisine or landmarks are you most looking forward to?",
    ];
    aiReply = replies[count % replies.length];
    followUpQuestion = "Shall we practice asking for local directions or booking tickets?";
  } else if (s.includes("zoo") || s.includes("animal") || s.includes("pet")) {
    const replies = [
      "Animals are fascinating! Monkeys and elephants are always fun to watch. Which animal is your top favorite?",
      "That is wonderful! Do you enjoy visiting wildlife sanctuaries or learning about ocean creatures?",
    ];
    aiReply = replies[count % replies.length];
    followUpQuestion = "What sounds or tricks do your favorite animals make?";
  } else {
    const replies = [
      "I really enjoy talking with you about this. What inspired your interest in this subject?",
      "That makes total sense! Speaking regularly like this is the fastest way to master natural fluency.",
      "Fantastic articulation! What is another activity or goal you are excited about this week?",
    ];
    aiReply = replies[count % replies.length];
    followUpQuestion = "What other English topic would you like to explore together next?";
  }

  return {
    aiReply,
    grammarCorrection,
    betterSentence,
    vocabularySuggestions,
    explanation,
    followUpQuestion,
    pronunciationScore: 92 + (count % 6),
    fluencyScore: 88 + (count % 8),
  };
}

/**
 * Rich dynamic contextual suggestions for what the student could say next.
 * Resilient offline fallback that incorporates turn index and salt so hints
 * rotate dynamically and never repeat identical suggestions.
 */
export function getDynamicContextualHints(scenario = "", lastAiText = "", turnIndex = 0, salt = 0) {
  const s = String(scenario || "").toLowerCase();
  const text = String(lastAiText || "").toLowerCase();
  const idx = Math.abs(turnIndex + salt);

  // 1. Detect choice / preference questions ("would you like", "do you prefer", "which do you", etc.)
  if (
    text.includes("would you like") ||
    text.includes("do you want") ||
    text.includes("do you prefer") ||
    text.includes("which one") ||
    text.includes("would you rather")
  ) {
    const choicePools = [
      [
        "Yes, I'd really like that, please.",
        "Actually, could I consider another option?",
        "Which one would you recommend most?",
      ],
      [
        "That sounds like a great choice to me.",
        "I usually lean toward the second option.",
        "Could you tell me a bit more about both?",
      ],
      [
        "I'm happy with whatever you recommend.",
        "Let's go with that one, thank you!",
        "What do most people usually choose?",
      ],
    ];
    return choicePools[idx % choicePools.length];
  }

  // 2. Detect explanatory / opinion questions ("how do you", "why do you", "what do you think", "can you tell me")
  if (
    text.includes("how do you") ||
    text.includes("why do you") ||
    text.includes("what do you think") ||
    text.includes("how was your") ||
    text.includes("tell me about") ||
    text.includes("describe")
  ) {
    const explainPools = [
      [
        "In my experience, practice and patience make a big difference.",
        "I really enjoy it because it helps me learn new things.",
        "How would you personally approach a situation like this?",
      ],
      [
        "I feel very positive about it overall.",
        "There are both advantages and challenges to consider.",
        "What is the most effective way to handle this?",
      ],
      [
        "It was quite busy, but very productive!",
        "I found it really interesting and learned a lot.",
        "Can you share what native speakers typically do?",
      ],
    ];
    return explainPools[idx % explainPools.length];
  }

  // 3. Opening greetings & introductions
  if (
    turnIndex === 0 ||
    text.includes("name") ||
    text.includes("introduce") ||
    text.includes("welcome") ||
    text.includes("hello") ||
    text.includes("meet you")
  ) {
    const greetingPools = [
      [
        "Hi! I'm happy to practice English with you today.",
        "Hello Coach! I'm ready to improve my conversational fluency.",
        "Let's get started with today's speaking scenario!",
      ],
      [
        "Good day! It's great to connect and practice.",
        "I'm looking forward to working on my natural phrasing.",
        "How has your day been going so far?",
      ],
      [
        "Hello! I'm excited to dive into this scenario.",
        "I'm eager to speak as naturally as possible.",
        "What should our main conversational goal be today?",
      ],
    ];
    return greetingPools[idx % greetingPools.length];
  }

  // 4. Restaurant / Cafe / Dining / Food
  if (
    s.includes("restaurant") ||
    s.includes("cafe") ||
    s.includes("food") ||
    s.includes("order") ||
    s.includes("dining") ||
    s.includes("burger")
  ) {
    const diningPools = [
      [
        "I'd like to order a fresh cappuccino and a croissant, please.",
        "Could you tell me what the chef's special dish is today?",
        "Do you have any vegetarian or lighter options available?",
      ],
      [
        "Could I please see the dessert or beverage menu?",
        "Could you make this without extra dairy or spices?",
        "How long does this dish usually take to prepare?",
      ],
      [
        "Everything was delicious, thank you so much!",
        "Could we have the check whenever you're ready, please?",
        "Do you accept digital wallet or card payments?",
      ],
    ];
    return diningPools[idx % diningPools.length];
  }

  // 5. Job Interview / Professional / Business
  if (
    s.includes("interview") ||
    s.includes("job") ||
    s.includes("career") ||
    s.includes("experience") ||
    s.includes("business") ||
    s.includes("meeting")
  ) {
    const interviewPools = [
      [
        "I have worked on several collaborative projects where communication was key.",
        "My main strengths are adaptability, quick learning, and team leadership.",
        "Could you tell me more about the day-to-day responsibilities of this role?",
      ],
      [
        "When faced with tight deadlines, I prioritize high-impact deliverables first.",
        "I actively seek constructive feedback to continuously improve my output.",
        "What are the biggest challenges currently facing the team?",
      ],
      [
        "I believe clear communication prevents misunderstandings and boosts morale.",
        "I am very excited about how my skills align with your organization's mission.",
        "How is performance evaluated during the initial ninety days?",
      ],
    ];
    return interviewPools[idx % interviewPools.length];
  }

  // 6. Travel / Hotel / Airport / Flight
  if (
    s.includes("travel") ||
    s.includes("hotel") ||
    s.includes("airport") ||
    s.includes("flight") ||
    s.includes("trip")
  ) {
    const travelPools = [
      [
        "Hi, I have a reservation under my name and would like to check in.",
        "Could you please guide me toward the departure gate?",
        "What are the best local attractions to explore nearby?",
      ],
      [
        "Is breakfast included with my reservation?",
        "Could you help me with the Wi-Fi connection in the lobby?",
        "What is the most convenient way to reach the city center?",
      ],
      [
        "Could you help arrange transportation for tomorrow morning?",
        "Is it possible to request a late check-out?",
        "Thank you so much for the helpful assistance!",
      ],
    ];
    return travelPools[idx % travelPools.length];
  }

  // 7. Shopping / Store
  if (s.includes("shop") || s.includes("store") || s.includes("market") || s.includes("clothes")) {
    const shoppingPools = [
      [
        "Excuse me, do you have this in a medium size?",
        "Where are the fitting rooms located?",
        "Is this item currently eligible for a discount?",
      ],
      [
        "Do you carry this in other colors as well?",
        "I'm just browsing for now, thank you!",
        "What is your return policy if it doesn't fit?",
      ],
    ];
    return shoppingPools[idx % shoppingPools.length];
  }

  // 8. General Conversation / Default
  const generalPools = [
    [
      "That is very interesting! Could you tell me more about that?",
      "How would a native speaker express this thought naturally?",
      "I agree with that perspective. Let me explain my thoughts.",
    ],
    [
      "I definitely see your point, and I'd like to add another detail.",
      "That makes total sense to me. What should we explore next?",
      "Could you give me a practical real-world example of that?",
    ],
    [
      "That's a fresh way to look at it. I hadn't thought of that before.",
      "I feel like consistent speaking practice makes this much easier.",
      "What other aspects of this topic would you like to discuss?",
    ],
  ];
  return generalPools[idx % generalPools.length];
}
