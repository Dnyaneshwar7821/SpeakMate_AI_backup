import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

import ROUTES from "../constants/routes";
import { aiService, chatService } from "../services/appServices";
import { generateDynamicCoachingResponse, cleanDialogueText, getDynamicContextualHints } from "../utils/aiConversationEngine";
import { AvatarCanvas } from "../components/avatar/AvatarCanvas";
import { speakGlobalText, stopSpeaking } from "../utils/speechHelper";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { recordChatMessage } from "../utils/progressTracker";
import { EventBus, AVATAR_EVENTS } from "../services/live2d/EventBus";

// Dynamic AI contextual hint generator according to live chat history
const generateAiHints = async ({ mode, messages, sessionId, level = "Intermediate", turnSalt = 0 }) => {
  const lastAiMsg = [...messages].reverse().find((m) => m.sender === "ai" || m.role === "assistant");
  const lastAiText = (lastAiMsg?.message || "").trim();
  const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
  const lastUserText = (lastUserMsg?.message || "").trim();
  const turnCount = messages.filter((m) => m.sender === "user").length;

  // 1. Try remote chatService.getHints if remote session exists and not forcing salt
  if (sessionId && !String(sessionId).startsWith("sim_") && turnSalt === 0) {
    try {
      const remoteHints = await chatService.getHints(sessionId);
      if (Array.isArray(remoteHints) && remoteHints.length >= 2) {
        const cleaned = remoteHints
          .map((h) => cleanDialogueText(h).replace(/^["']|["']$/g, "").trim())
          .filter((h) => h.length > 3);
        if (cleaned.length >= 2) return cleaned;
      }
    } catch (err) {
      console.warn("Backend getHints attempt failed, falling back to direct AI generation:", err);
    }
  }

  // 2. Direct AI Chat Generation using Groq / LLM
  try {
    const prompt = `You are an expert English conversation tutor observing a live practice chat.
Mode/Scenario: "${mode || 'General English'}"
Student Level: ${level || 'Intermediate'}
Tutor's latest message to the student: "${lastAiText || 'Hello! What would you like to practice today?'}"
${lastUserText ? `Student previously said: "${lastUserText}"` : ''}
Session turn: ${turnCount}
Seed: ${Date.now() + turnSalt}

Task: Give EXACTLY 3 distinct, fresh, natural speaking responses the student could say next right now in this exact moment:
- Suggestion 1: Short & direct response (3-6 words)
- Suggestion 2: Natural, polite conversational elaboration
- Suggestion 3: A curious follow-up question or perspective

Return ONLY a valid JSON array of 3 strings. Example:
["Yes, I'd really love that.", "That sounds great, I usually prefer taking the train.", "What would you recommend doing instead?"]
No other text, markdown blocks, code fencing, or explanation.`;

    const res = await aiService.chat(prompt);
    const rawContent = res?.response || res?.message || res;
    if (rawContent && typeof rawContent === "string") {
      let parsed = null;
      const jsonMatch = rawContent.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {}
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = rawContent
          .split("\n")
          .map((line) => line.replace(/^[\s*\-•\d.)\]"]+|[\s"']+$|^\s*(Suggestion|Option|Hint)\s*\d*[:\-.]?\s*/gi, "").trim())
          .filter((line) => line.length > 5 && !line.startsWith("{") && !line.startsWith("["));
      }
      if (Array.isArray(parsed) && parsed.length >= 2) {
        const cleaned = parsed
          .slice(0, 3)
          .map((h) => cleanDialogueText(String(h)).replace(/^["']|["']$/g, "").trim())
          .filter((h) => h.length > 3 && !h.toLowerCase().includes("json"));
        if (cleaned.length >= 2) return cleaned;
      }
    }
  } catch (aiErr) {
    console.warn("Direct AI hint generation failed, using dynamic contextual fallback:", aiErr);
  }

  // 3. Dynamic Contextual Smart Generator fallback
  return getDynamicContextualHints(mode, lastAiText, turnCount, turnSalt);
};

// Conversational Voice Activity Thresholds (Matches Speaking Practice)
const NORMAL_SILENCE_THRESHOLD = 3000; // 3.0s: comfortable complete-thought pause
const INCOMPLETE_SILENCE_THRESHOLD = 4500; // 4.5s: extra hesitation tolerance for connectors
const INITIAL_SILENCE_THRESHOLD = 8000; // 8.0s: auto-close if user stays completely silent

const INCOMPLETE_CONNECTORS = new Set([
  "and", "because", "but", "or", "so", "that", "to", "with", "like",
  "if", "when", "while", "although", "since", "for"
]);

const isIncompleteSentence = (text) => {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim().toLowerCase().replace(/[.,!?;:]+$/, "").trim();
  if (!clean) return false;
  const words = clean.split(/\s+/);
  const lastWord = words[words.length - 1];
  return INCOMPLETE_CONNECTORS.has(lastWord);
};

export function ConversationChat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId");
  const mode = searchParams.get("mode") || "General English";
  const title = searchParams.get("title") || `${mode} Session`;

  const [sessionId, setSessionId] = useState(sessionIdParam || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const [chatLevel] = useState(user?.schoolGrade || user?.englishLevel || "Intermediate");
  const [hints, setHints] = useState([]);
  const [showHints, setShowHints] = useState(false);
  const [loadingHints, setLoadingHints] = useState(false);
  const lastHintsTurnRef = useRef(-1);
  const [speechSpeed, setSpeechSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [model, setModel] = useState(null);

  // useLipSync is handled directly by AvatarCanvas with isSpeaking prop
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Dynamic Real-Time Phonetic Viseme State ("REST", "AA", "EE", "OO", "IH", "OH")
  const [viseme, setViseme] = useState("REST");

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const isSendingRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const initialSilenceTimerRef = useRef(null);
  const stoppingByUserRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const handleStopListeningAndSendRef = useRef(null);
  const handleSendMessageRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasSpokenInitialRef = useRef(false);

  // Phonetic Lip-Sync Event Bus Listener
  useEffect(() => {
    const unsubUpdate = EventBus.on(AVATAR_EVENTS.LIP_SYNC_UPDATE, (data) => {
      if (data?.viseme) {
        setViseme(data.viseme);
      }
    });

    const unsubStart = EventBus.on(AVATAR_EVENTS.SPEECH_STARTED, () => {
      setIsAiSpeaking(true);
    });

    const unsubFinish = EventBus.on(AVATAR_EVENTS.SPEECH_FINISHED, () => {
      setIsAiSpeaking(false);
      setViseme("REST");
    });

    return () => {
      unsubUpdate();
      unsubStart();
      unsubFinish();
    };
  }, []);

  const getSpeakableText = (msg, includeCoaching = false) => {
    if (!msg) return "";
    let text = cleanDialogueText(msg.message || msg.aiReply || "");

    if (includeCoaching) {
      const isCorrect =
        msg.grammarCorrection &&
        (msg.grammarCorrection.includes("✅") ||
          msg.grammarCorrection.toLowerCase().includes("correct") ||
          msg.grammarCorrection.toLowerCase() === "none");

      if (msg.grammarCorrection && !isCorrect && !msg.grammarCorrection.includes("|")) {
        const cleanCorrection = cleanDialogueText(msg.grammarCorrection);
        if (cleanCorrection) text += `. A better way to say that is: "${cleanCorrection}".`;
        if (msg.explanation && !msg.explanation.includes("|")) {
          const cleanExpl = cleanDialogueText(msg.explanation);
          if (cleanExpl) text += ` ${cleanExpl}`;
        }
      } else if (msg.betterSentence && !msg.betterSentence.includes("|")) {
        const cleanBetter = cleanDialogueText(msg.betterSentence);
        if (cleanBetter) text += `. You could also express it as: "${cleanBetter}".`;
      }
    }

    if (msg.followUpQuestion && !msg.followUpQuestion.includes("|") && msg.followUpQuestion.toLowerCase() !== "none") {
      const cleanFollow = cleanDialogueText(msg.followUpQuestion);
      if (cleanFollow && !text.includes(cleanFollow)) {
        text += ` ${cleanFollow}`;
      }
    }
    return cleanDialogueText(text);
  };

  const handleSpeakText = (text, isAuto = false) => {
    if (isMuted || !text) return;
    if (isAuto && localStorage.getItem("speakmate_autoplay_audio") === "false") {
      return;
    }
    speakGlobalText(text, speechSpeed, {
      onstart: () => {
        setIsAiSpeaking(true);
      },
      onend: () => {
        setIsAiSpeaking(false);
        setViseme("REST");
      },
      onerror: () => {
        setIsAiSpeaking(false);
        setViseme("REST");
      },
    });
  };

  // Load initial messages from backend chatService
  useEffect(() => {
    if (!sessionId) {
      chatService
        .start(mode)
        .then((res) => {
          if (res?.id) {
            setSessionId(res.id);
          } else {
            setSessionId(Date.now().toString());
          }
        })
        .catch(() => {
          setSessionId(Date.now().toString());
        });
      return;
    }

    chatService
      .detail(sessionId)
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          if (!hasSpokenInitialRef.current) {
            hasSpokenInitialRef.current = true;
            const lastAi = [...data.messages].reverse().find((m) => m.sender === "ai");
            if (lastAi) {
              setTimeout(() => handleSpeakText(getSpeakableText(lastAi), true), 500);
            }
          }
        } else {
          const initMsg = {
            id: Date.now(),
            sender: "ai",
            message: `Hello! I am SpeakMate AI, your Coach for ${mode}. Let's begin our session! What would you like to discuss today?`,
          };
          setMessages([initMsg]);
          if (!hasSpokenInitialRef.current) {
            hasSpokenInitialRef.current = true;
            setTimeout(() => handleSpeakText(initMsg.message, true), 500);
          }
        }
      })
      .catch(() => {
        const initMsg = {
          id: Date.now(),
          sender: "ai",
          message: `Hello! I am SpeakMate AI, your Coach for ${mode}. Let's practice speaking and writing together!`,
        };
        setMessages([initMsg]);
        if (!hasSpokenInitialRef.current) {
          hasSpokenInitialRef.current = true;
          setTimeout(() => handleSpeakText(initMsg.message, true), 500);
        }
      });
  }, [sessionId, mode]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, hints, evaluating]);

  // Web Speech API with Continuous VAD & Auto-Send
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (e) => {
        let interim = "";
        let finalChunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript + " ";
          } else {
            interim += res[0].transcript;
          }
        }

        if (finalChunk) {
          accumulatedTranscriptRef.current += finalChunk;
        }
        interimTranscriptRef.current = interim;

        const fullTranscript = `${accumulatedTranscriptRef.current} ${interim}`
          .replace(/\s+/g, " ")
          .trim();
        setCurrentTranscript(fullTranscript);
        setInputText(fullTranscript);

        // Reset timers on every speech event
        if (initialSilenceTimerRef.current) {
          clearTimeout(initialSilenceTimerRef.current);
          initialSilenceTimerRef.current = null;
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Arm auto-send timer when meaningful speech has been detected (>= 2 chars)
        if (fullTranscript.length >= 2 && !isSendingRef.current) {
          const activeSessionId = recordingSessionRef.current;
          const threshold = isIncompleteSentence(fullTranscript)
            ? INCOMPLETE_SILENCE_THRESHOLD
            : NORMAL_SILENCE_THRESHOLD;

          silenceTimerRef.current = setTimeout(() => {
            if (
              recordingSessionRef.current === activeSessionId &&
              !isSendingRef.current &&
              handleStopListeningAndSendRef.current
            ) {
              handleStopListeningAndSendRef.current();
            }
          }, threshold);
        }
      };

      recognition.onerror = (err) => {
        console.warn("Speech Recognition notice:", err?.error || err);
        if (err?.error === "no-speech") {
          return;
        }
        if (err?.error === "not-allowed" || err?.error === "service-not-allowed") {
          setIsListening(false);
          isListeningRef.current = false;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
      };

      recognition.onend = () => {
        // If the browser session ended automatically but user is still in listening mode,
        // restart it seamlessly so user can talk as long as they want without premature cutoff!
        if (isListeningRef.current && !stoppingByUserRef.current && !isSendingRef.current) {
          try {
            recognition.start();
          } catch (e) {}
        } else {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      isSendingRef.current = false;
    };
  }, []);

  const handleToggleSpeed = () => {
    const SPEEDS = [0.5, 0.75, 1.0, 1.5, 2.0];
    const idx = SPEEDS.indexOf(speechSpeed);
    const nextSpeed = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeechSpeed(nextSpeed);
    localStorage.setItem("speakmate_voice_speed", String(nextSpeed));

    // Replay latest AI message with new speed
    const lastAiMsg = [...messages].reverse().find((m) => m.sender === "ai" || m.role === "assistant");
    if (lastAiMsg && lastAiMsg.message) {
      speakGlobalText(lastAiMsg.message, nextSpeed);
    }
  };

  const handleToggleHints = async (forceRefresh = false) => {
    if (showHints && !forceRefresh) {
      setShowHints(false);
      return;
    }

    setShowHints(true);

    const currentTurn = messages.filter((m) => m.sender === "user").length;

    // If hints are already loaded for this turn and not forcing a refresh, keep them
    if (!forceRefresh && hints.length >= 2 && lastHintsTurnRef.current === currentTurn) {
      return;
    }

    setLoadingHints(true);
    try {
      const turnSalt = forceRefresh ? Math.floor(Math.random() * 10000) + 1 : 0;
      const dynamicHints = await generateAiHints({
        mode,
        messages,
        sessionId,
        level: chatLevel,
        turnSalt,
      });

      setHints(dynamicHints);
      lastHintsTurnRef.current = currentTurn;
    } catch (err) {
      console.warn("Hint generation error:", err);
      const lastAi = [...messages].reverse().find((m) => m.sender === "ai");
      setHints(getDynamicContextualHints(mode, lastAi?.message, currentTurn, Math.floor(Math.random() * 100)));
      lastHintsTurnRef.current = currentTurn;
    } finally {
      setLoadingHints(false);
    }
  };

  const handleStopListeningAndSend = async () => {
    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (isSendingRef.current) return;

    stoppingByUserRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }

    const finalSpoken = `${accumulatedTranscriptRef.current} ${interimTranscriptRef.current}`
      .replace(/\s+/g, " ")
      .trim() || currentTranscript.replace(/\s+/g, " ").trim() || inputText.trim();

    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setCurrentTranscript("");

    if (!finalSpoken) return;

    if (handleSendMessageRef.current) {
      await handleSendMessageRef.current(finalSpoken);
    }
  };
  handleStopListeningAndSendRef.current = handleStopListeningAndSend;

  const handleToggleRecording = () => {
    if (isListeningRef.current) {
      // Manual click while recording -> INSTANT 0s send!
      handleStopListeningAndSend();
    } else {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsAiSpeaking(false);
        setViseme("REST");
      }
      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const activeSessionId = recordingSessionRef.current + 1;
      recordingSessionRef.current = activeSessionId;
      stoppingByUserRef.current = false;
      accumulatedTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      setCurrentTranscript("");
      setInputText("");

      // Option B: Auto-close after 8 seconds of complete silence
      initialSilenceTimerRef.current = setTimeout(() => {
        if (
          recordingSessionRef.current === activeSessionId &&
          isListeningRef.current &&
          !isSendingRef.current
        ) {
          stoppingByUserRef.current = true;
          isListeningRef.current = false;
          setIsListening(false);
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {}
          }
        }
      }, INITIAL_SILENCE_THRESHOLD);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          isListeningRef.current = true;
          setIsListening(true);
        } catch (err) {
          console.warn("Speech recognition start collision:", err);
          isListeningRef.current = true;
          setIsListening(true);
        }
      } else {
        isListeningRef.current = true;
        setIsListening(true);
        setTimeout(() => {
          setInputText("I want to improve my sentence structure and vocabulary.");
          silenceTimerRef.current = setTimeout(() => {
            if (handleStopListeningAndSendRef.current) {
              handleStopListeningAndSendRef.current();
            }
          }, NORMAL_SILENCE_THRESHOLD);
        }, 1500);
      }
    }
  };

  const handleSendMessage = async (textToSend = inputText) => {
    const cleanText = (textToSend || "").trim();
    if (!cleanText || isSendingRef.current) return;

    isSendingRef.current = true;

    // Immediately cancel any active silence timers
    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (isListeningRef.current) {
      stoppingByUserRef.current = true;
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }

    // Immediately stop any active speech and reset mouth to REST
    stopSpeaking();
    setIsAiSpeaking(false);
    setViseme("REST");

    setInputText("");
    setCurrentTranscript("");
    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setShowHints(false);
    setHints([]);
    lastHintsTurnRef.current = -1;
    setEvaluating(true);

    const userMsg = {
      id: Date.now(),
      sender: "user",
      message: cleanText,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let response = null;
      try {
        response = await chatService.send(sessionId, cleanText, !isMuted, chatLevel);
      } catch (err) {
        try {
          const aiRes = await aiService.chat(cleanText);
          if (aiRes && (aiRes.response || aiRes.message)) {
            response = {
              id: Date.now() + 1,
              sender: "ai",
              message: aiRes.response || aiRes.message,
              grammarCorrection: "✅ Correct phrasing.",
              betterSentence: null,
              vocabularySuggestions: null,
              explanation: null,
              followUpQuestion: "What else would you like to explore regarding this topic?",
            };
          }
        } catch (e2) {
          const dynamicFeedback = generateDynamicCoachingResponse(cleanText, mode, messages);
          response = {
            id: Date.now() + 1,
            sender: "ai",
            message: dynamicFeedback.aiReply,
            grammarCorrection: dynamicFeedback.grammarCorrection,
            betterSentence: dynamicFeedback.betterSentence,
            vocabularySuggestions: dynamicFeedback.vocabularySuggestions,
            explanation: dynamicFeedback.explanation,
            followUpQuestion: dynamicFeedback.followUpQuestion,
          };
        }
      }

      if (!response) {
        const dynamicFeedback = generateDynamicCoachingResponse(cleanText, mode, messages);
        response = {
          id: Date.now() + 1,
          sender: "ai",
          message: dynamicFeedback.aiReply,
          grammarCorrection: dynamicFeedback.grammarCorrection,
          betterSentence: dynamicFeedback.betterSentence,
          vocabularySuggestions: dynamicFeedback.vocabularySuggestions,
          explanation: dynamicFeedback.explanation,
          followUpQuestion: dynamicFeedback.followUpQuestion,
        };
      }

      if (response) {
        response.message = cleanDialogueText(response.message || response.aiReply || "");
        if (response.grammarCorrection && response.grammarCorrection.includes("|")) {
          response.grammarCorrection = null;
        }
      }

      setMessages((prev) => [...prev, response]);
      setEvaluating(false);

      // Award +5 XP per conversational turn
      recordChatMessage(1);
      toast.success("+5 XP Earned! 💬");

      // Spoken voice speaks only concise conversational reply + follow-up question
      const fullSpeakableText = getSpeakableText(response, false);
      handleSpeakText(fullSpeakableText, true);
    } catch (e) {
      setEvaluating(false);
    } finally {
      isSendingRef.current = false;
    }
  };
  handleSendMessageRef.current = handleSendMessage;

  const handleToggleBookmark = async (msgId) => {
    try {
      await chatService.toggleBookmark(msgId).catch(() => true);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, bookmarked: !m.bookmarked } : m))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSelectedMessage(null);
    }
  };

  const { isDark } = useTheme();

  const avatarState = isAiSpeaking
    ? "AI Tutor Speaking... 🔊"
    : evaluating
    ? "AI Tutor Thinking... 🧠"
    : isListening
    ? "Listening to You... 🎙️"
    : "AI Coach Ready ✨";

  return (
    <div className="h-[calc(100vh-80px)] max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 p-2 sm:p-4 overflow-hidden">
      
      {/* ── LEFT COLUMN: SEPARATE AVATAR STAGE STUDIO ── */}
      <div className={`lg:w-5/12 h-[320px] lg:h-full backdrop-blur-2xl border rounded-3xl overflow-hidden relative shadow-xl flex flex-col shrink-0 transition-colors ${
        isDark ? "bg-slate-900/80 border-white/10" : "bg-white border-slate-200/90"
      }`}>
        
        {/* Stage Header */}
        <div className={`p-3.5 border-b backdrop-blur-md flex items-center justify-between gap-3 z-10 shrink-0 ${
          isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50/90 border-slate-200/90"
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to={ROUTES.AI_CHAT}
              className={`p-2 rounded-xl border transition-colors shrink-0 shadow-sm ${
                isDark ? "bg-slate-800/80 border-white/10 text-slate-300 hover:text-white" : "bg-white border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
              title="Back to AI Chat Modes"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <h2 className={`font-extrabold text-xs truncate ${isDark ? "text-white" : "text-slate-900"}`}>{title}</h2>
              </div>
              <p className="text-[10px] text-[#6c63ff] font-semibold truncate">{avatarState}</p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-xl bg-[#6c63ff]/15 text-[#6c63ff] text-[10px] font-black uppercase tracking-wider shrink-0">
            {mode}
          </span>
        </div>

        {/* Avatar Stage Canvas Viewport */}
        <div className={`flex-1 relative flex items-center justify-center overflow-hidden transition-colors ${
          isDark
            ? "bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#0B0F19]"
            : "bg-gradient-to-b from-sky-50 via-indigo-50/70 to-purple-50/60"
        }`}>
          <AvatarCanvas isSpeaking={isAiSpeaking} className="w-full h-full" framing="faceToChest" onModelLoaded={setModel} />

          {/* Subtle Stage Lighting Overlay */}
          <div className={`absolute inset-0 pointer-events-none ${
            isDark
              ? "bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"
              : "bg-gradient-to-t from-indigo-100/30 via-transparent to-transparent"
          }`} />

          {/* Soundbar Waves when AI speaks */}
          {isAiSpeaking && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 h-9 px-4 py-1 rounded-full backdrop-blur-md border shadow-xl pointer-events-none z-20 ${
              isDark
                ? "bg-slate-900/80 border-indigo-500/40 text-indigo-200"
                : "bg-white/95 border-indigo-200 text-indigo-700 shadow-md"
            }`}>
              <span className="w-1.5 bg-[#6c63ff] rounded-full animate-soundbar-1 h-5" />
              <span className="w-1.5 bg-[#ff6584] rounded-full animate-soundbar-2 h-7" />
              <span className="w-1.5 bg-emerald-400 rounded-full animate-soundbar-3 h-4" />
              <span className="w-1.5 bg-[#6c63ff] rounded-full animate-soundbar-4 h-6" />
              <span className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDark ? "text-indigo-200" : "text-indigo-700"}`}>AI Speaking</span>
            </div>
          )}

          {/* Floating State Badge at Bottom of Avatar Stage */}
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full backdrop-blur-md border text-[11px] font-bold shadow-xl flex items-center gap-2 pointer-events-none ${
            isDark
              ? "bg-slate-900/80 border-white/15 text-white"
              : "bg-white/95 border-slate-200/90 text-slate-800 shadow-md"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isAiSpeaking ? "bg-emerald-500 animate-pulse" : evaluating ? "bg-amber-500 animate-ping" : "bg-[#6c63ff]"}`} />
            <span>{avatarState}</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: SEPARATE CHAT STREAM & COACHING STUDIO ── */}
      <div className={`lg:w-7/12 flex-1 flex flex-col h-full rounded-3xl border shadow-xl overflow-hidden backdrop-blur-2xl transition-colors ${
        isDark ? "bg-slate-900/80 border-white/10" : "bg-white border-slate-200/90"
      }`}>
        
        {/* Chat Studio Header */}
        <div className={`p-3.5 border-b backdrop-blur-md flex items-center justify-between gap-3 shrink-0 ${
          isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50/90 border-slate-200/90"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-secondary)]">💬 Discussion Stream</span>
            <span className="px-2 py-0.5 rounded-full bg-[#6c63ff]/20 text-[#6c63ff] text-[10px] font-black">
              {messages.length} messages
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleToggleHints(false)}
              disabled={loadingHints}
              className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                showHints
                  ? "bg-[#6c63ff] text-white border-[#6c63ff] shadow-md shadow-[#6c63ff]/30"
                  : isDark
                  ? "bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/40 text-indigo-300"
                  : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700"
              }`}
              title="Toggle AI Hints according to chat"
            >
              <span>💡</span>
              <span>{loadingHints ? "..." : "AI Hint"}</span>
            </button>

            <button
              onClick={handleToggleSpeed}
              className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold transition-all ${
                isDark ? "bg-slate-800/60 border-white/10 text-white hover:bg-slate-700/60" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Speech Speed"
            >
              ⏱️ {speechSpeed}x
            </button>

            <button
              onClick={() => {
                if (!isMuted && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  setIsAiSpeaking(false);
                  setViseme("REST");
                }
                setIsMuted(!isMuted);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all border ${
                isMuted ? "bg-red-500/20 border-red-500/40 text-red-400" : isDark ? "bg-slate-800/60 border-white/10 text-white hover:bg-slate-700/60" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {isMuted ? "🔇 Muted" : "🔊 Sound On"}
            </button>
          </div>
        </div>

        {/* Scrollable Messages Stream */}
        <div className="flex-1 overflow-y-auto space-y-3.5 p-4">
          {messages.map((m) => {
            const isUser = m.sender === "user";
            const hasGrammar = m.grammarCorrection && m.grammarCorrection !== "none";
            const hasBetter = m.betterSentence && m.betterSentence !== "none";
            const hasVocab = m.vocabularySuggestions && m.vocabularySuggestions !== "none";

            return (
              <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-xl p-4 rounded-2xl text-xs font-semibold shadow-md space-y-2 relative group transition-all ${
                    isUser
                      ? "bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6] text-white rounded-br-none shadow-[#6c63ff]/20"
                      : isDark
                      ? "bg-slate-800/90 text-slate-100 border border-white/10 rounded-bl-none"
                      : "bg-slate-100 text-slate-800 border border-slate-200/90 rounded-bl-none"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] opacity-75 font-black uppercase">
                      {isUser ? "You" : "🤖 SpeakMate AI Tutor"}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.bookmarked && <span className="text-amber-400">⭐</span>}
                      {!isUser && (
                        <button
                          onClick={() => handleSpeakText(getSpeakableText(m))}
                          className="text-xs hover:scale-110 p-1 rounded hover:bg-white/10"
                          title="Play Voice Audio"
                        >
                          🔊
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedMessage(m)}
                        className="text-xs opacity-60 hover:opacity-100 p-1"
                        title="Options"
                      >
                        •••
                      </button>
                    </div>
                  </div>

                  <p className="leading-relaxed text-xs sm:text-sm font-medium whitespace-pre-line">
                    {m.message}
                    {m.followUpQuestion &&
                      m.followUpQuestion.toLowerCase() !== "none" &&
                      !m.message?.includes(m.followUpQuestion) && (
                        <span className="block mt-2 font-semibold text-[#6c63ff]">
                          👉 {m.followUpQuestion}
                        </span>
                      )}
                  </p>

                  {/* Inline Tutor Evaluation Feedback Card */}
                  {!isUser && (hasGrammar || hasBetter || hasVocab) && (
                    <div className={`mt-2.5 p-3 rounded-xl border space-y-2 text-[11px] ${
                      isDark ? "bg-[#1E1B4B]/60 border-[#6c63ff]/40 text-slate-200" : "bg-indigo-50 border-indigo-200 text-slate-800"
                    }`}>
                      <div className="flex items-center justify-between font-extrabold text-[#6c63ff]">
                        <span>🎓 Tutor Feedback & Coaching</span>
                        <button
                          onClick={() => handleSpeakText(getSpeakableText(m, true))}
                          className="px-2 py-0.5 rounded bg-[#6c63ff] text-white text-[9px] font-black hover:opacity-90"
                        >
                          🔊 Listen Tip
                        </button>
                      </div>

                      {hasGrammar && (
                        <div>
                          <span className="text-[9px] font-black uppercase text-indigo-400">Grammar Check</span>
                          <p className="font-semibold text-emerald-500 mt-0.5">👉 {m.grammarCorrection}</p>
                        </div>
                      )}

                      {hasBetter && (
                        <div>
                          <span className="text-[9px] font-black uppercase text-indigo-400">Better Native Phrasing</span>
                          <p className="font-semibold mt-0.5">💡 "{m.betterSentence}"</p>
                        </div>
                      )}

                      {m.explanation && (
                        <p className="italic opacity-80 border-t border-indigo-500/20 pt-1 text-[10px]">
                          {m.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {evaluating && (
            <div className="flex items-center gap-2 p-3 text-xs font-bold text-[#6c63ff]">
              <span className="h-2 w-2 rounded-full bg-[#6c63ff] animate-ping" />
              SpeakMate AI tutor is typing & evaluating...
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Dynamic AI Smart Suggestions Drawer (Only shown on AI Hint click) */}
        {showHints && (
          <div className={`p-2.5 sm:px-3 border-t shrink-0 transition-all animate-in fade-in duration-200 ${
            isDark ? "bg-slate-900/95 border-white/10" : "bg-white/95 border-slate-200 shadow-xs"
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs">💡</span>
                <span className={`text-[11px] font-bold tracking-wide truncate ${
                  isDark ? "text-slate-200" : "text-slate-800"
                }`}>
                  Suggested Responses
                </span>
                <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">
                  — click any response to send
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleHints(true)}
                  disabled={loadingHints}
                  className={`p-1 px-2 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border ${
                    isDark
                      ? "text-slate-300 border-white/10 hover:bg-slate-800 hover:text-white"
                      : "text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  title="Generate 3 fresh AI suggestions"
                >
                  <span className={loadingHints ? "animate-spin inline-block" : ""}>↻</span>
                  <span>New Hints</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHints(false)}
                  className={`p-1 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                  title="Close Suggestions"
                >
                  ✕
                </button>
              </div>
            </div>

            {loadingHints ? (
              <div className="flex items-center gap-2 py-1.5 text-xs font-semibold text-[#6c63ff] animate-pulse">
                <span className="h-2 w-2 rounded-full bg-[#6c63ff] animate-ping" />
                <span>Generating fresh suggestions according to chat...</span>
              </div>
            ) : hints.length > 0 ? (
              <div className="overflow-x-auto pb-1 flex items-center gap-2 scroll-smooth scrollbar-thin">
                {hints.map((hint, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setShowHints(false);
                      handleSendMessage(hint);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border shadow-xs whitespace-nowrap cursor-pointer active:scale-95 ${
                      isDark
                        ? "bg-slate-800/80 text-slate-200 border-white/10 hover:border-[#6c63ff] hover:bg-[#6c63ff] hover:text-white"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-[#6c63ff] hover:bg-[#6c63ff] hover:text-white"
                    }`}
                    title={`Click to send: "${hint}"`}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-1 text-xs text-slate-400 flex items-center gap-2">
                <span>Click "New Hints" to generate responses.</span>
              </div>
            )}
          </div>
        )}

        {/* Integrated Text Input Bar & Voice Wave */}
        <div className={`p-3.5 border-t shrink-0 space-y-2 ${
          isDark ? "border-white/10 bg-slate-900/90" : "border-slate-200 bg-white"
        }`}>
          {isListening && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-bold text-red-500">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 h-4">
                  <span className="w-1 bg-red-500 rounded-full h-3 animate-pulse" />
                  <span className="w-1 bg-red-500 rounded-full h-5 animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 bg-red-500 rounded-full h-3.5 animate-pulse" style={{ animationDelay: "300ms" }} />
                  <span className="w-1 bg-red-500 rounded-full h-5 animate-pulse" style={{ animationDelay: "75ms" }} />
                  <span className="w-1 bg-red-500 rounded-full h-2.5 animate-pulse" style={{ animationDelay: "225ms" }} />
                </div>
                <span>Speak now — auto-sends after pause (or click Send Now / Mic to send immediately)</span>
              </div>
              <button
                type="button"
                onClick={handleToggleRecording}
                className="px-2.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-extrabold hover:bg-red-600 transition-all"
              >
                Send Now
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={handleToggleRecording}
              className={`p-3 rounded-2xl font-bold transition-all shadow-sm ${
                isListening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : isDark
                  ? "bg-slate-800 border border-white/10 text-slate-300 hover:text-white"
                  : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
              title="Toggle Mic Recording"
            >
              🎙️
            </button>

            <input
              type="text"
              placeholder={isListening ? "Listening to your voice..." : "Type response to tutor..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={evaluating}
              className={`flex-1 px-4 py-3 rounded-2xl border text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#6c63ff] shadow-inner ${
                isDark
                  ? "border-white/10 bg-slate-800/80 text-white placeholder:text-slate-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              }`}
            />

            <button
              type="submit"
              disabled={!inputText.trim() || evaluating}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6] hover:opacity-95 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-[#6c63ff]/25 transition-all shrink-0 active:scale-95"
            >
              Send →
            </button>
          </form>
        </div>
      </div>

      {/* Options Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-3 ${
            isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <h3 className="text-sm font-extrabold">Message Options</h3>
            <p className="text-xs text-[var(--text-secondary)] italic truncate">"{selectedMessage.message}"</p>

            <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedMessage.message);
                  setSelectedMessage(null);
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-left transition-all ${
                  isDark ? "bg-slate-800 text-white hover:bg-[#6c63ff]" : "bg-slate-100 text-slate-800 hover:bg-[#6c63ff] hover:text-white"
                }`}
              >
                📋 Copy Message Text
              </button>

              <button
                onClick={() => {
                  handleSpeakText(getSpeakableText(selectedMessage));
                  setSelectedMessage(null);
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-left transition-all ${
                  isDark ? "bg-slate-800 text-white hover:bg-[#6c63ff]" : "bg-slate-100 text-slate-800 hover:bg-[#6c63ff] hover:text-white"
                }`}
              >
                🔊 Replay Voice Audio
              </button>

              <button
                onClick={() => handleToggleBookmark(selectedMessage.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-left transition-all text-amber-500 ${
                  isDark ? "bg-slate-800 hover:bg-amber-500 hover:text-white" : "bg-slate-100 hover:bg-amber-500 hover:text-white"
                }`}
              >
                ⭐ {selectedMessage.bookmarked ? "Remove Bookmark" : "Bookmark Tip"}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedMessage(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationChat;
