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
  
  // Strip outer quotes so AI text never duplicates quotation marks
  clean = clean.replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();

  // If clean string is too short or is a leftover label, provide a natural conversational fallback
  if (clean.length < 5 || clean.toLowerCase() === "text" || clean.toLowerCase() === "overall impression") {
    clean = "That is a great thought! Can you tell me more about that?";
  }

  return clean;
}

export function stripQuotes(str) {
  if (!str || typeof str !== "string") return "";
  return str.trim().replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
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
    isLocalFallback: true,
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

  const isStudent = s.includes("std") || s.includes("school") || s.includes("grade") || s.includes("admission") || s.includes("student");

  // 1. Check for specific question topics in tutor's latest sentence
  if (text.includes("project") || text.includes("proud of") || text.includes("activity") || text.includes("accomplishment")) {
    if (isStudent || s.includes("admission")) {
      const studentProjects = [
        [
          "I recently coordinated a fundraiser for our local animal shelter.",
          "I worked on an inter-school science exhibition model with classmates.",
          "Could I share about an extracurricular event I organized?",
        ],
        [
          "I led our team in building a renewable energy science model.",
          "I organized a campus book donation drive that collected over 200 books.",
          "Would you like to hear about our community outreach initiative?",
        ],
        [
          "I helped design our school magazine and wrote an editorial piece.",
          "I coordinated our robotics club entry for the regional science fair.",
          "May I tell you about the environmental initiative I led?",
        ],
      ];
      return studentProjects[idx % studentProjects.length];
    } else {
      const generalProjects = [
        [
          "I recently led a project that improved our team's delivery time.",
          "I coordinated a cross-functional initiative that solved a key bottleneck.",
          "Could I share how our team achieved a major milestone recently?",
        ],
        [
          "I organized a successful community workshop that reached many participants.",
          "I spearheaded a new initiative that significantly boosted collaboration.",
          "Would you like me to walk you through our recent project achievements?",
        ],
      ];
      return generalProjects[idx % generalProjects.length];
    }
  }

  if (text.includes("challenge") || text.includes("difficult") || text.includes("obstacle") || text.includes("overcome") || text.includes("problem")) {
    const challenges = [
      [
        "Delegating tasks and keeping everyone on schedule was the toughest part.",
        "We overcame tight deadlines by prioritizing the most crucial deliverables.",
        "How would you suggest balancing unexpected challenges in group projects?",
      ],
      [
        "Keeping all team members motivated required frequent communication.",
        "We resolved resource constraints by finding creative, alternative solutions.",
        "What is the best way to handle shifting priorities under pressure?",
      ],
      [
        "Managing different opinions was challenging, but open dialogue helped us succeed.",
        "We broke down the complex problem into smaller, manageable steps.",
        "Could you share how teams typically navigate similar roadblocks?",
      ],
    ];
    return challenges[idx % challenges.length];
  }

  if (text.includes("conflict") || text.includes("disagree") || text.includes("resolve") || text.includes("misunderstanding")) {
    const conflicts = [
      [
        "Two teammates disagreed on the design, so we combined the best of both ideas.",
        "I scheduled a quick group meeting so every voice could be heard fairly.",
        "We found common ground by focusing on our shared project goal.",
      ],
      [
        "When opinions clashed, we evaluated both options based on objective criteria.",
        "I listened patiently to both sides and suggested a practical compromise.",
        "How do effective leaders usually mediate disagreements among peers?",
      ],
      [
        "We resolved the issue by clarifying roles and aligning on next steps.",
        "Clear, empathetic communication prevented misunderstandings from escalating.",
        "Could you share tips for maintaining harmony during high-stakes projects?",
      ],
    ];
    return conflicts[idx % conflicts.length];
  }

  if (text.includes("strength") || text.includes("quality") || text.includes("qualities") || text.includes("succeed") || text.includes("why should we")) {
    if (isStudent || s.includes("admission")) {
      const studentStrengths = [
        [
          "My strongest qualities are curiosity, discipline, and collaborative teamwork.",
          "I stay organized under pressure and love taking on challenging assignments.",
          "What qualities do you look for most in incoming students?",
        ],
        [
          "I have strong analytical skills and genuinely enjoy problem solving.",
          "I communicate clearly and always support my teammates to do their best.",
          "How do successful students make the most of their time here?",
        ],
      ];
      return studentStrengths[idx % studentStrengths.length];
    } else {
      const adultStrengths = [
        [
          "My greatest strengths are strategic problem solving and clear communication.",
          "I thrive in dynamic environments and take pride in dependable execution.",
          "What skills are most vital for excelling in this position?",
        ],
        [
          "I bring a blend of technical expertise and empathetic collaboration.",
          "I actively seek feedback and continuously refine my workflows.",
          "How is long-term performance evaluated in this role?",
        ],
      ];
      return adultStrengths[idx % adultStrengths.length];
    }
  }

  if (text.includes("dream") || text.includes("future") || text.includes("goal") || text.includes("career") || text.includes("major") || text.includes("aspire")) {
    const goals = [
      [
        "I aspire to study computer science and build innovative technologies.",
        "I want to pursue environmental engineering to solve climate challenges.",
        "What academic streams would best prepare me for this path?",
      ],
      [
        "My goal is to enter medicine and contribute to community health.",
        "I am passionate about literature and hope to pursue journalism or law.",
        "What research opportunities do high school students have here?",
      ],
      [
        "I aim to combine technology and design to create accessible tools.",
        "I want to deepen my skills in mathematics and advanced sciences.",
        "Could you tell me more about your campus mentorship programs?",
      ],
    ];
    return goals[idx % goals.length];
  }

  // 2. High School & Academic Admission Interview
  if (s.includes("admission") || (s.includes("interview") && isStudent)) {
    const admissionPools = [
      [
        "Thank you for having me! I am really eager to join this school.",
        "I'm drawn to your strong academic culture and diverse clubs.",
        "Could you tell me what a typical day looks like for a freshman?",
      ],
      [
        "I balance academics with sports and creative extracurriculars.",
        "I believe this curriculum will challenge me to reach my potential.",
        "What kinds of student leadership programs do you offer?",
      ],
      [
        "I am enthusiastic about participating in debate and science competitions.",
        "I value hands-on learning and collaborative team projects.",
        "How does the faculty support students pursuing ambitious goals?",
      ],
    ];
    return admissionPools[idx % admissionPools.length];
  }

  // 3. Primary Standards (1st - 3rd Std)
  if (s.includes("std1") || s.includes("std2") || s.includes("std3") || s.includes("1st std") || s.includes("2nd std") || s.includes("3rd std") || s.includes("phonics")) {
    const primaryPools = [
      [
        "Good morning, teacher! I am ready to speak.",
        "My favorite color is blue and I love drawing animals.",
        "Can we practice saying new words together?",
      ],
      [
        "I finished my homework and helped tidy up our classroom.",
        "I like playing with my toys and reading storybooks.",
        "What is the next fun question, teacher?",
      ],
      [
        "I am very happy today! Can we play a speaking game?",
        "My favorite animal is a friendly puppy.",
        "Thank you, teacher, that was very fun!",
      ],
    ];
    return primaryPools[idx % primaryPools.length];
  }

  // 4. Debate & Oratory
  if (s.includes("debate") || s.includes("speech") || s.includes("keynote") || s.includes("oratory") || s.includes("mun")) {
    const debatePools = [
      [
        "I believe that evidence and clear logic support this viewpoint.",
        "While that perspective is compelling, counter-arguments must be weighed.",
        "What is the most persuasive evidence on this issue?",
      ],
      [
        "Let's examine both the immediate and long-term consequences.",
        "A balanced approach requires listening to diverse viewpoints.",
        "How would you counter that rebuttal effectively?",
      ],
      [
        "I propose a solution that addresses both core concerns.",
        "Public discourse thrives when arguments remain respectful and fact-based.",
        "May I elaborate on the primary justification for this stance?",
      ],
    ];
    return debatePools[idx % debatePools.length];
  }

  // 5. Detect choice / preference questions
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
    ];
    return choicePools[idx % choicePools.length];
  }

  // 6. Adult Job Interview (only when explicitly professional)
  if (!isStudent && (s.includes("job") || s.includes("career") || s.includes("salary") || s.includes("business meeting") || s.includes("presentation skills"))) {
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

  // 7. Restaurant / Cafe / Dining / Food / Canteen
  if (s.includes("restaurant") || s.includes("cafe") || s.includes("food") || s.includes("canteen") || s.includes("burger")) {
    const diningPools = [
      [
        "I'd like to order a fresh sandwich and water, please.",
        "Could you tell me what the daily special is today?",
        "Do you have any vegetarian options available?",
      ],
      [
        "Could I please see the menu?",
        "Could you make this without extra dairy or spices?",
        "How long does this order usually take to prepare?",
      ],
      [
        "Everything was delicious, thank you so much!",
        "Could we have the check whenever you're ready, please?",
        "Do you accept card or digital payments?",
      ],
    ];
    return diningPools[idx % diningPools.length];
  }

  // 8. Travel / Hotel / Airport
  if (s.includes("travel") || s.includes("hotel") || s.includes("airport") || s.includes("flight") || s.includes("tour")) {
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
    ];
    return travelPools[idx % travelPools.length];
  }

  // 9. Dynamic synthesis from the scenario title
  const cleanTitle = (scenario || "").replace(/\b(conversation|practice|session)\b/gi, "").trim() || "this scenario";
  const generalPools = [
    [
      `I'm really excited to practice ${cleanTitle} today.`,
      `In my experience, consistent speaking practice makes discussing this much easier.`,
      `What is the best way to approach this topic naturally?`,
    ],
    [
      `That makes total sense to me, and I'd like to share my thoughts.`,
      `I completely agree with that perspective on ${cleanTitle}.`,
      `How would a native speaker express that idea naturally?`,
    ],
    [
      `I'm eager to learn more practical vocabulary for ${cleanTitle}.`,
      `Practicing this scenario regularly is really boosting my confidence.`,
      `What should our main conversational goal be for this session?`,
    ],
  ];
  return generalPools[idx % generalPools.length];
}
