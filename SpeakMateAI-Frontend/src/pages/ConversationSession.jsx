import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";

import ROUTES from "../constants/routes";
import { aiService, speakingService } from "../services/appServices";
import { generateDynamicCoachingResponse, cleanDialogueText } from "../utils/aiConversationEngine";
import { AvatarCanvas } from "../components/avatar/AvatarCanvas";
import { speakGlobalText, stopSpeaking } from "../utils/speechHelper";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { recordSpeakingSession } from "../utils/progressTracker";

// Avatar Hooks
import { useBlink } from "../hooks/useBlink";
import { useMouseTracking } from "../hooks/useMouseTracking";
import { useExpressions } from "../hooks/useExpressions";
import { EventBus, AVATAR_EVENTS } from "../services/live2d/EventBus";

// Dynamic scenario contextual suggestions matching mobile app
const getScenarioHints = (scenario, lastAiMsg) => {
  const s = (scenario || "").toLowerCase();
  const text = ((lastAiMsg?.message || "") + " " + (lastAiMsg?.followUpQuestion || "")).toLowerCase();

  if (text.includes("name") || text.includes("introduce") || text.includes("welcome")) {
    return [
      "Hi! I'm happy to practice English with you today.",
      "Hello Coach! I'm ready to improve my conversational fluency.",
      "Let's get started with today's speaking scenario!"
    ];
  }
  if (s.includes("interview") || text.includes("job") || text.includes("experience")) {
    return [
      "I have worked on several collaborative projects where communication was key.",
      "My main strengths are adaptability, quick learning, and team leadership.",
      "Could you evaluate my professional response?"
    ];
  }
  if (s.includes("restaurant") || s.includes("cafe") || text.includes("order") || text.includes("menu")) {
    return [
      "I'd like to order a fresh cappuccino and a croissant, please.",
      "Could you tell me what the chef's special dish is today?",
      "Could we have the check, please?"
    ];
  }
  if (s.includes("travel") || s.includes("hotel") || s.includes("airport")) {
    return [
      "I have a reservation under my name and would like to check in.",
      "Could you please guide me toward the departure gate?",
      "What are the best local places to explore nearby?"
    ];
  }
  return [
    "That is very interesting! Could you tell me more about that?",
    "How would a native speaker explain this in conversation?",
    "I agree with that perspective. Let me explain my thoughts."
  ];
};

// Real-Time "How to Say It" Coach Card matching Mobile App pedagogical architecture
function CoachCard({ feedback, isDark, onSpeakText }) {
  if (!feedback) return null;
  const { grammarCorrection, betterSentence, fluencyTip, followUpQuestion, vocabularySuggestions } = feedback;

  const hasBetter = Boolean(
    betterSentence &&
    betterSentence.trim() &&
    betterSentence.toLowerCase() !== "none" &&
    betterSentence.toLowerCase() !== "null"
  );
  const hasGrammar = Boolean(
    grammarCorrection &&
    grammarCorrection.trim() &&
    grammarCorrection.toLowerCase() !== "none" &&
    grammarCorrection.toLowerCase() !== "null"
  );
  const hasFluency = Boolean(
    fluencyTip &&
    fluencyTip.trim() &&
    fluencyTip.toLowerCase() !== "none" &&
    fluencyTip.toLowerCase() !== "null"
  );
  const hasFollowup = Boolean(
    followUpQuestion &&
    followUpQuestion.trim() &&
    followUpQuestion.toLowerCase() !== "none" &&
    followUpQuestion.toLowerCase() !== "null"
  );
  const hasVocab = Boolean(
    vocabularySuggestions &&
    vocabularySuggestions.trim() &&
    vocabularySuggestions.toLowerCase() !== "none" &&
    vocabularySuggestions.toLowerCase() !== "null"
  );

  if (!hasBetter && !hasGrammar && !hasFluency && !hasFollowup && !hasVocab) return null;

  const isGrammarOk =
    hasGrammar &&
    (grammarCorrection.includes("✅") ||
      grammarCorrection.toLowerCase().includes("correct") ||
      grammarCorrection.toLowerCase().includes("great job") ||
      grammarCorrection.toLowerCase().includes("clear and natural"));

  return (
    <div
      className={`mt-3 p-3 sm:p-3.5 rounded-2xl border backdrop-blur-md space-y-2.5 shadow-md w-full animate-in fade-in duration-300 ${
        isDark ? "bg-slate-900/90 border-white/10 text-slate-100" : "bg-white/95 border-indigo-100/90 text-slate-800 shadow-indigo-100/50"
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between pb-2 border-b ${isDark ? "border-white/10" : "border-slate-100"}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">✨</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#6c63ff]">
            "How to Say It" Coach Card
          </span>
        </div>
      </div>

      {/* 🚀 Better Natural Sentence */}
      {hasBetter && (
        <div
          className={`p-3 rounded-xl border space-y-1.5 ${
            isDark ? "bg-[#6c63ff]/15 border-[#6c63ff]/30 text-indigo-100" : "bg-indigo-50/80 border-indigo-200/80 text-indigo-950"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#6c63ff] flex items-center gap-1">
              🚀 Better Natural Sentence
            </span>
            <button
              type="button"
              onClick={() => onSpeakText(betterSentence)}
              className="px-2.5 py-1 rounded-lg bg-[#6c63ff] text-white text-[10px] font-bold hover:bg-[#8b85ff] active:scale-95 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              title="Listen to native pronunciation"
            >
              <span>🔊 Listen</span>
            </button>
          </div>
          <p className="font-semibold text-xs leading-relaxed">
            "{betterSentence}"
          </p>
        </div>
      )}

      {/* ✍️ Grammar Accuracy */}
      {hasGrammar && (
        <div
          className={`p-3 rounded-xl border text-xs space-y-1 ${
            isGrammarOk
              ? isDark
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
              : isDark
                ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            ✍️ Grammar Accuracy
          </span>
          <p className="font-semibold text-xs leading-relaxed">
            {isGrammarOk ? `✅ ${grammarCorrection.replace(/^✅\s*/, "")}` : `👉 ${grammarCorrection}`}
          </p>
        </div>
      )}

      {/* 💡 Fluency & Pronunciation Tip */}
      {hasFluency && (
        <div
          className={`p-3 rounded-xl border text-xs space-y-1 ${
            isDark ? "bg-sky-500/15 border-sky-500/30 text-sky-200" : "bg-sky-50 border-sky-200 text-sky-900"
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-sky-500 flex items-center gap-1">
            💡 Fluency & Pronunciation Tip
          </span>
          <p className="font-medium text-xs leading-relaxed">
            {fluencyTip}
          </p>
        </div>
      )}

      {/* ❓ Follow-up Question */}
      {hasFollowup && (
        <div
          className={`p-3 rounded-xl border space-y-1.5 ${
            isDark ? "bg-purple-500/15 border-purple-500/30 text-purple-200" : "bg-purple-50 border-purple-200 text-purple-950"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-500 flex items-center gap-1">
              ❓ Follow-up Question
            </span>
            <button
              type="button"
              onClick={() => onSpeakText(followUpQuestion)}
              className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-500 active:scale-95 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              title="Listen to follow-up question"
            >
              <span>🔊 Listen</span>
            </button>
          </div>
          <p className="font-semibold text-xs leading-relaxed">
            "{followUpQuestion}"
          </p>
        </div>
      )}

      {/* ✨ Vocabulary Upgrade */}
      {hasVocab && (
        <div
          className={`p-2.5 rounded-xl border text-xs space-y-1 ${
            isDark ? "bg-slate-800/80 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1">
            ✨ Vocabulary Upgrade
          </span>
          <p className="font-medium text-xs">
            {vocabularySuggestions}
          </p>
        </div>
      )}
    </div>
  );
}

export function ConversationSession() {

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId");
  const scenario = searchParams.get("scenario") || location.state?.scenarioTitle || "Free Speaking Practice";
  const xpReward = Number(searchParams.get("xpReward")) || 20;

  const passedGreeting = location.state?.initialGreeting;
  const cleanScn = (scenario || "").replace(/\b(conversation|practice|session)\b/gi, "").trim();
  const scnLabel = cleanScn ? `${cleanScn} ` : "";
  const initialGreeting = passedGreeting || (location.state?.scenarioDesc
    ? `Hello! Welcome to our ${scnLabel}practice. ${location.state.scenarioDesc} Let's get started!`
    : `Hello! Welcome to our ${scnLabel}conversation practice. How can I help you today?`);

  const [sessionId, setSessionId] = useState(sessionIdParam || location.state?.sessionId || null);
  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "ai",
      message: initialGreeting,
    },
  ]);

  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(1.0);
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [chatLevel] = useState(user?.schoolGrade || user?.englishLevel || "Intermediate");
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Initialize speaking session with backend if not already provided
  useEffect(() => {
    if (!sessionId && !sessionIdParam) {
      speakingService.start({ scenario, level: chatLevel })
        .then((res) => {
          if (res?.id) {
            setSessionId(res.id);
          }
        })
        .catch((err) => {
          console.warn("Could not create remote speaking session, using local simulation:", err);
          setSessionId(`sim_${Date.now()}`);
        });
    }
  }, [sessionId, sessionIdParam, scenario, chatLevel]);

  // Avatar Model State & Hooks
  const [model, setModel] = useState(null);
  const containerRef = useRef(null);

  // useLipSync is managed directly by AvatarCanvas via isSpeaking prop to avoid dual competing RAF loops
  useBlink(model);
  useMouseTracking(model, containerRef);
  const { setExpression } = useExpressions(model);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [hints, setHints] = useState([]);
  const [showHints, setShowHints] = useState(false);
  const [loadingHints, setLoadingHints] = useState(false);
  const [corrections, setCorrections] = useState(null);
  const [ending, setEnding] = useState(false);

  // Dynamic Real-Time Phonetic Viseme State ("REST", "AA", "EE", "OO", "IH", "OH")
  const [viseme, setViseme] = useState("REST");

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const stoppingByUserRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const handleStopListeningAndSendRef = useRef(null);
  const sendUserTextRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasSpokenInitialRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Clean up incomplete session draft if user navigated away without finishing
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (!hasFinishedRef.current && sessionIdRef.current && !String(sessionIdRef.current).startsWith("sim_")) {
        speakingService.deleteHistory(sessionIdRef.current).catch(() => { });
      }
    };
  }, []);

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

  const getSpeakableText = (feedback) => {
    if (!feedback) return "";
    let text = feedback.aiReply || feedback.message || feedback.response || "";
    if (text.includes("Analyze User Input:") || text.includes("Context:") || text.includes("Requirements:")) {
      const idx = text.lastIndexOf("\n\n");
      if (idx !== -1 && idx < text.length - 1) {
        text = text.substring(idx).trim();
      }
    }
    if (feedback.followUpQuestion && !text.toLowerCase().includes(feedback.followUpQuestion.toLowerCase())) {
      text += ` ${feedback.followUpQuestion}`;
    }
    return cleanDialogueText(text);
  };

  const coachingTimerRef = useRef(null);

  const handleSpeakText = (text, onComplete = null, isAuto = false) => {
    if (isMuted || !text || (isAuto && localStorage.getItem("speakmate_autoplay_audio") === "false")) {
      if (onComplete) onComplete();
      return;
    }
    speakGlobalText(text, speechSpeed, {
      onstart: () => {
        setIsAiSpeaking(true);
      },
      onend: () => {
        setIsAiSpeaking(false);
        setViseme("REST");
        if (onComplete) onComplete();
      },
      onerror: () => {
        setIsAiSpeaking(false);
        setViseme("REST");
        if (onComplete) onComplete();
      },
    });
  };

  // Speak initial greeting reliably on mount
  useEffect(() => {
    let active = true;
    const timerId = setTimeout(() => {
      if (active && initialGreeting) {
        handleSpeakText(initialGreeting, null, true);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timerId);
      stopSpeaking();
    };
  }, [initialGreeting]);

  useEffect(() => {
    let interval = null;
    if (!isPaused) {
      interval = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, hints, corrections, isThinking]);

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

        const fullTranscript = (accumulatedTranscriptRef.current + " " + interim).trim();
        setCurrentTranscript(fullTranscript);

        // Reset silence timer on every speech event
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Arm auto-send timer when speech has been detected (2.8s pause triggers send)
        if (fullTranscript.length > 0) {
          silenceTimerRef.current = setTimeout(() => {
            if (handleStopListeningAndSendRef.current) {
              handleStopListeningAndSendRef.current();
            }
          }, 2800);
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
        if (isListeningRef.current && !stoppingByUserRef.current) {
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
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleToggleSpeed = () => {
    const SPEEDS = [0.5, 0.75, 1.0, 1.5, 2.0];
    const idx = SPEEDS.indexOf(speechSpeed);
    const nextSpeed = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeechSpeed(nextSpeed);
    localStorage.setItem("speakmate_voice_speed", String(nextSpeed));

    // Replay latest AI message with new speed (Matches Mobile App VoiceService)
    const lastAiMsg = [...messages].reverse().find((m) => m.sender === "ai" || m.role === "assistant");
    if (lastAiMsg && (lastAiMsg.message || lastAiMsg.text)) {
      speakGlobalText(lastAiMsg.message || lastAiMsg.text, nextSpeed);
    }
  };

  const handleToggleHints = async () => {
    if (isPaused) return;
    if (showHints) {
      setShowHints(false);
      return;
    }

    if (hints.length === 0) {
      setLoadingHints(true);
      try {
        let data = null;
        if (sessionId && !String(sessionId).startsWith("sim_")) {
          data = await speakingService.getHints(sessionId).catch(() => null);
        }
        const lastAi = [...messages].reverse().find((m) => m.sender === "ai");
        const fallback = getScenarioHints(scenario, lastAi);
        const resolved = Array.isArray(data) && data.length > 0 ? data : fallback;
        setHints(resolved);
      } catch (e) {
        const lastAi = [...messages].reverse().find((m) => m.sender === "ai");
        setHints(getScenarioHints(scenario, lastAi));
      } finally {
        setLoadingHints(false);
      }
    }
    setShowHints(true);
  };

  const handleStartListening = () => {
    if (isPaused) return;
    if (coachingTimerRef.current) {
      clearTimeout(coachingTimerRef.current);
      coachingTimerRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsAiSpeaking(false);
      setViseme("REST");
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    stoppingByUserRef.current = false;
    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setCurrentTranscript("");

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
        setCurrentTranscript("I want to learn English fluently and improve my vocabulary.");
        silenceTimerRef.current = setTimeout(() => {
          if (handleStopListeningAndSendRef.current) {
            handleStopListeningAndSendRef.current();
          }
        }, 2000);
      }, 1500);
    }
  };

  const handleStopListeningAndSend = async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    stoppingByUserRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }

    const finalSpoken = (
      accumulatedTranscriptRef.current + " " + (interimTranscriptRef.current || "")
    ).trim() || currentTranscript.trim();

    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    if (!finalSpoken) return;

    if (sendUserTextRef.current) {
      await sendUserTextRef.current(finalSpoken);
    }
  };
  handleStopListeningAndSendRef.current = handleStopListeningAndSend;

  const sendUserText = async (text) => {
    // Stop any ongoing speech and ensure mouth is firmly at REST
    stopSpeaking();
    setIsAiSpeaking(false);
    setViseme("REST");
    if (coachingTimerRef.current) {
      clearTimeout(coachingTimerRef.current);
      coachingTimerRef.current = null;
    }

    setShowHints(false);
    setHints([]);
    setCurrentTranscript("");
    setIsThinking(true);

    const userMsg = { id: Date.now(), sender: "user", message: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let feedback = null;
      if (sessionId && !String(sessionId).startsWith("sim_")) {
        try {
          feedback = await speakingService.sendMessage({
            sessionId,
            message: text,
            level: chatLevel,
          });
        } catch (err) {
          console.warn("Backend speaking message error:", err);
        }
      }

      // If backend was not reached or returned null/error, try conversational AI chat endpoint
      if (!feedback) {
        try {
          const aiChatRes = await aiService.chat(`You are an English conversation tutor in scenario '${scenario}'. The learner said: "${text}". Reply naturally in 1-2 engaging sentences and ask a relevant question.`);
          if (aiChatRes && (aiChatRes.response || aiChatRes.message)) {
            const rawMsg = aiChatRes.response || aiChatRes.message;
            feedback = {
              aiReply: cleanDialogueText(rawMsg),
              grammarCorrection: "✅ Grammatically correct.",
              betterSentence: null,
              vocabularySuggestions: null,
              explanation: null,
              followUpQuestion: null,
            };
          }
        } catch (e2) {
          // Dynamic offline conversation engine fallback
          feedback = generateDynamicCoachingResponse(text, scenario, messages);
        }
      }

      if (!feedback) {
        feedback = generateDynamicCoachingResponse(text, scenario, messages);
      }

      setIsThinking(false);

      const cleanAiReply = cleanDialogueText(feedback.aiReply || feedback.message || feedback.response);
      let mainReply = cleanAiReply || "That is very interesting! Can you tell me more about that?";
      if (feedback.followUpQuestion && !mainReply.toLowerCase().includes(feedback.followUpQuestion.toLowerCase())) {
        mainReply += ` ${cleanDialogueText(feedback.followUpQuestion)}`;
      }
      mainReply = cleanDialogueText(mainReply);

      // 1. Analyze Grammar Check
      const rawCorrection = feedback.grammarCorrection && typeof feedback.grammarCorrection === "string"
        ? cleanDialogueText(feedback.grammarCorrection).replace(/^👉\s*/, "")
        : null;
      const isGrammarCorrect = !rawCorrection ||
        rawCorrection.includes("✅") ||
        rawCorrection.toLowerCase().includes("correct") ||
        rawCorrection.toLowerCase() === "none" ||
        rawCorrection.toLowerCase() === "null" ||
        rawCorrection.includes("|");
      const cleanCorrection = !isGrammarCorrect && rawCorrection ? rawCorrection : null;

      // 2. Analyze Better Sentence
      const rawBetter = feedback.betterSentence && typeof feedback.betterSentence === "string"
        ? cleanDialogueText(feedback.betterSentence)
        : null;
      const hasBetter = Boolean(
        rawBetter &&
        rawBetter.toLowerCase() !== "null" &&
        rawBetter.toLowerCase() !== "none" &&
        !rawBetter.includes("✅") &&
        rawBetter.length > 3
      );
      const cleanBetter = hasBetter ? rawBetter : null;

      // 3. Clean Fluency Tip & Explanation
      const cleanExplanation = feedback.explanation && typeof feedback.explanation === "string"
        ? cleanDialogueText(feedback.explanation)
        : null;
      const cleanNativeTip = feedback.nativeTip && typeof feedback.nativeTip === "string"
        ? cleanDialogueText(feedback.nativeTip)
        : (cleanExplanation || null);

      // 4. Follow-up Question
      const cleanFollowUp = feedback.followUpQuestion && typeof feedback.followUpQuestion === "string"
        ? cleanDialogueText(feedback.followUpQuestion)
        : null;

      // 5. Vocabulary Suggestions
      const cleanVocab = feedback.vocabularySuggestions && typeof feedback.vocabularySuggestions === "string"
        ? cleanDialogueText(feedback.vocabularySuggestions)
        : null;

      const coachFeedback = {
        grammarCorrection: cleanCorrection || (feedback.grammarCorrection ? cleanDialogueText(feedback.grammarCorrection) : "✅ Great pronunciation and grammar!"),
        betterSentence: cleanBetter,
        fluencyTip: cleanNativeTip,
        followUpQuestion: cleanFollowUp,
        vocabularySuggestions: cleanVocab,
      };

      const hasCoachingContent = hasBetter || !isGrammarCorrect || Boolean(cleanNativeTip) || Boolean(cleanFollowUp) || Boolean(cleanVocab);

      const aiMsg = {
        id: Date.now() + 1,
        sender: "ai",
        message: cleanAiReply || "That is very interesting! Can you tell me more about that?",
        coachFeedback: hasCoachingContent ? coachFeedback : null,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setCorrections(hasCoachingContent ? coachFeedback : null);

      // TWO-STAGE PEDAGOGICAL AI SPEECH (Matches Mobile App Architecture):
      if (coachingTimerRef.current) {
        clearTimeout(coachingTimerRef.current);
        coachingTimerRef.current = null;
      }

      const needsPedagogicalCoaching = !isGrammarCorrect || hasBetter;

      if (!needsPedagogicalCoaching) {
        // SCENARIO A: Sentence is 100% correct! Speaks praise + in-character reply directly
        const praises = ["Spot on!", "Nicely said!", "Well phrased!", "Great sentence!"];
        const randomPraise = praises[Math.floor(Math.random() * praises.length)];
        const fullSpeech = `${randomPraise} ${mainReply}`;
        handleSpeakText(fullSpeech, null, true);
      } else {
        // SCENARIO B: Sentence has a mistake or better phrasing exists!
        const targetPhrase = (!isGrammarCorrect && cleanCorrection) ? cleanCorrection : cleanBetter;
        const acknowledgments = ["Got it!", "I see what you mean!", "Makes total sense!"];
        const randomAck = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
        const tipPrefixes = [
          "Quick tip—you can say",
          "By the way, you can phrase that as",
          "A natural way to say that is",
        ];
        const randomPrefix = tipPrefixes[Math.floor(Math.random() * tipPrefixes.length)];
        const coachingPhrase = `${randomAck} ${randomPrefix}: "${targetPhrase}".${cleanExplanation ? ` ${cleanExplanation}` : ""}`;

        // Stage 1: Tutor first speaks the coaching tip with live lip-sync
        handleSpeakText(coachingPhrase, () => {
          // Mouth immediately returns to REST during the 0.5s pause
          setIsAiSpeaking(false);
          setViseme("REST");

          // Natural 0.5-second conversational pause before Stage 2
          coachingTimerRef.current = setTimeout(() => {
            if (!isMuted) {
              // Stage 2: Tutor switches to speaking the main in-character reply + follow-up
              handleSpeakText(mainReply, null, true);
            }
          }, 500);
        }, true);
      }
    } catch (e) {
      setIsThinking(false);
    }
  };

  const handleEscapeSession = async () => {
    if (coachingTimerRef.current) {
      clearTimeout(coachingTimerRef.current);
      coachingTimerRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsAiSpeaking(false);
      setViseme("REST");
    }
    if (sessionId && !String(sessionId).startsWith("sim_")) {
      try {
        await speakingService.deleteHistory(sessionId);
      } catch (err) {
        console.warn("Failed to discard draft session:", err);
      }
    }
    navigate(ROUTES.SPEAKING, { replace: true });
  };

  const handleEndSession = async () => {
    hasFinishedRef.current = true;
    if (coachingTimerRef.current) {
      clearTimeout(coachingTimerRef.current);
      coachingTimerRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsAiSpeaking(false);
      setViseme("REST");
    }
    setEnding(true);

    const userMessages = messages.filter((m) => m.sender === "user");
    const totalUserWords = userMessages.reduce((sum, m) => sum + (m.message || "").trim().split(/\s+/).filter(Boolean).length, 0);
    const hasActivity = userMessages.length > 0 && totalUserWords > 0;

    try {
      const summary = await speakingService.end(sessionId).catch(() => null);

      const effectiveScore = summary?.overallScore ?? summary?.score ?? (hasActivity ? 80 : 0);
      const effectiveXP = summary?.xpEarned ?? (hasActivity ? Math.min(45, Math.max(5, Math.round(totalUserWords * 0.5))) : 0);
      const effectiveDuration = summary?.duration ?? timer;

      const finalSummary = {
        score: effectiveScore,
        overallScore: effectiveScore,
        grammarScore: summary?.grammarScore ?? (hasActivity ? Math.max(20, effectiveScore - 2) : 0),
        vocabularyScore: summary?.vocabularyScore ?? (hasActivity ? Math.max(20, effectiveScore) : 0),
        fluencyScore: summary?.fluencyScore ?? (hasActivity ? Math.max(20, effectiveScore - 5) : 0),
        pronunciationScore: summary?.pronunciationScore ?? (hasActivity ? Math.max(20, effectiveScore + 2) : 0),
        xpEarned: effectiveXP,
        duration: effectiveDuration,
        messagesExchanged: userMessages.length,
        summary: summary?.summary || (hasActivity ? `Completed ${scenario} speaking practice session with ${totalUserWords} words spoken.` : "Session ended with no spoken conversation recorded."),
        vocabularyLearned: summary?.vocabularyLearned || (hasActivity ? "Proficiency, Natural fluency, Articulate" : ""),
        grammarCorrections: summary?.grammarCorrections || (hasActivity ? "Good attempt! Keep practicing your daily speech turns." : "No spoken sentences were recorded during this session to analyze."),
        betterSentences: summary?.betterSentences || (hasActivity ? "Try expressing ideas with richer connecting phrases." : ""),
        motivationalMessage: summary?.motivationalMessage || (hasActivity ? "Excellent effort! Keep speaking regularly to boost confidence." : "Practice makes progress! Press the microphone and speak to practice next time."),
      };

      if (hasActivity && effectiveScore > 0) {
        recordSpeakingSession(Math.max(1, Math.ceil(timer / 60)), effectiveScore);
        if (!sessionId || String(sessionId).startsWith("sim_")) {
          try {
            await speakingService.create({
              topic: scenario || "Speaking Practice",
              scenario: scenario || "Speaking Practice",
              duration: effectiveDuration || timer || 60,
              score: effectiveScore,
              overallScore: effectiveScore,
              grammarScore: finalSummary.grammarScore,
              vocabularyScore: finalSummary.vocabularyScore,
              fluencyScore: finalSummary.fluencyScore,
              pronunciationScore: finalSummary.pronunciationScore,
              xpEarned: effectiveXP,
              dialogueTurns: userMessages.length,
              feedback: finalSummary.summary,
              vocabularyLearned: finalSummary.vocabularyLearned,
              grammarCorrections: finalSummary.grammarCorrections,
              betterSentences: finalSummary.betterSentences,
              motivationalMessage: finalSummary.motivationalMessage,
            });
          } catch (saveErr) {
            console.warn("[ConversationSession] Direct session save notice:", saveErr);
          }
        }
      }

      navigate(ROUTES.SPEAKING_SUMMARY, { state: { summary: finalSummary } });
    } catch (e) {
      navigate(ROUTES.SPEAKING_SUMMARY, {
        state: {
          summary: {
            score: 0,
            overallScore: 0,
            grammarScore: 0,
            vocabularyScore: 0,
            fluencyScore: 0,
            pronunciationScore: 0,
            xpEarned: 0,
            duration: timer,
            messagesExchanged: 0,
            summary: "Session completed.",
            motivationalMessage: "Practice makes progress! Tap the microphone and speak to practice.",
          }
        }
      });
    } finally {
      setEnding(false);
    }
  };

  const avatarState = isPaused
    ? "Paused ⏸️"
    : isAiSpeaking
      ? "SpeakMate AI Speaking... 🔊"
      : isThinking
        ? "SpeakMate AI Thinking... 🧠"
        : isListening
          ? "Listening to You... 🎙️"
          : "Idle Ready ✨";

  return (
    <div ref={containerRef} className="h-[calc(100vh-80px)] max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 p-2 sm:p-4 overflow-hidden">

      {/* LEFT COLUMN: AVATAR STAGE STUDIO */}
      <div className={`lg:w-5/12 h-[320px] lg:h-full backdrop-blur-2xl border rounded-3xl overflow-hidden relative shadow-xl flex flex-col shrink-0 transition-colors ${isDark ? "bg-slate-900/80 border-white/10" : "bg-white border-slate-200/90"
        }`}>

        {/* Stage Header */}
        <div className={`p-3.5 border-b backdrop-blur-md flex items-center justify-between gap-3 z-10 shrink-0 ${isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50/90 border-slate-200/90"
          }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleEscapeSession}
              className={`p-2 rounded-xl border transition-colors shrink-0 shadow-sm cursor-pointer ${isDark ? "bg-slate-800/80 border-white/10 text-slate-300 hover:text-white" : "bg-white border-slate-200 text-slate-700 hover:text-slate-900"
                }`}
              title="Close & Discard without Finishing"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <h2 className={`font-extrabold text-xs truncate ${isDark ? "text-white" : "text-slate-900"}`}>{scenario}</h2>
              </div>
              <p className="text-[10px] text-[#6c63ff] font-semibold truncate">{avatarState}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-extrabold shadow-sm ${isDark ? "bg-slate-800/80 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
              }`}>
              <span>⏱️</span>
              <span>{formatTime(timer)}</span>
            </div>

            <button
              onClick={() => {
                if (!isPaused && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  setIsAiSpeaking(false);
                  setViseme("REST");
                }
                setIsPaused(!isPaused);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all border shadow-sm ${isPaused
                  ? "bg-amber-500/20 text-amber-500 border-amber-500/40"
                  : isDark
                    ? "bg-slate-800/80 border-white/10 text-slate-300 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:text-slate-900"
                }`}
            >
              {isPaused ? "▶" : "⏸"}
            </button>
          </div>
        </div>

        {/* Live2D Avatar Canvas Display (Unobstructed, studio stage) */}
        <div className={`flex-1 relative w-full h-full overflow-hidden flex items-center justify-center ${isDark
            ? "bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#0B0F19]"
            : "bg-gradient-to-b from-sky-50 via-indigo-50/70 to-purple-50/60"
          }`}>
          <AvatarCanvas isSpeaking={isAiSpeaking} className="w-full h-full" onModelLoaded={setModel} framing="faceToChest" />

          {/* Subtle Stage Lighting Overlay */}
          <div className={`absolute inset-0 pointer-events-none ${isDark
              ? "bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"
              : "bg-gradient-to-t from-indigo-100/30 via-transparent to-transparent"
            }`} />

          {/* Avatar Speech Waves Floating Pill */}
          <div className={`absolute bottom-4 left-4 right-4 flex items-center justify-between p-2.5 rounded-2xl backdrop-blur-xl border shadow-lg pointer-events-none ${isDark
              ? "bg-slate-900/85 border-white/10 text-slate-200"
              : "bg-white/95 border-slate-200/90 text-slate-800 shadow-md"
            }`}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isAiSpeaking ? 'bg-emerald-500 animate-ping' : isListening ? 'bg-rose-500 animate-pulse' : 'bg-[#6c63ff]'}`} />
              <span className={`text-[11px] font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{avatarState}</span>
            </div>
            {isAiSpeaking && (
              <div className="flex items-center gap-0.5 h-3">
                <span className="w-1 bg-[#6c63ff] rounded-full h-2 animate-bounce" />
                <span className="w-1 bg-[#6c63ff] rounded-full h-3.5 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 bg-[#6c63ff] rounded-full h-2 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: CONVERSATION THREAD & CONTROL CENTER */}
      <div className={`lg:w-7/12 flex-1 flex flex-col backdrop-blur-2xl border rounded-3xl overflow-hidden shadow-xl relative min-h-0 transition-colors ${isDark ? "bg-slate-900/80 border-white/10" : "bg-white border-slate-200/90"
        }`}>

        {/* Panel Header */}
        <div className={`px-5 py-3 border-b backdrop-blur-md flex items-center justify-between shrink-0 ${isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50/90 border-slate-200/90"
          }`}>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#6c63ff]" />
            <span className={`text-xs font-extrabold uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-800"}`}>
              Live Speaking Practice
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${isDark ? "bg-[#6c63ff]/15 border-[#6c63ff]/30 text-[#A5B4FC]" : "bg-[#6c63ff]/10 border-[#6c63ff]/25 text-[#6c63ff]"
              }`}>
              {messages.length} Exchanges
            </span>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-600"
              }`}>
              {chatLevel}
            </span>
          </div>
        </div>

        {/* Scrollable Conversation Thread */}
        <div className={`flex-1 overflow-y-auto space-y-4 p-4 sm:p-5 ${isDark ? "bg-slate-950/40" : "bg-[#F8FAFC]"
          }`}>
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[92%] sm:max-w-[85%] p-4 rounded-2xl text-xs font-semibold shadow-md space-y-2.5 ${m.sender === "user"
                    ? "bg-gradient-to-r from-[#6c63ff] to-[#5a52e0] text-white rounded-br-none"
                    : isDark
                      ? "bg-slate-800/80 backdrop-blur-md border border-white/10 text-slate-100 rounded-bl-none shadow-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm"
                  }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className={`text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 ${m.sender === "user" ? "text-white/90" : isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {m.sender === "user" ? "👤 You" : "🤖 SpeakMate AI Tutor"}
                  </span>
                  {m.sender === "ai" && (
                    <button
                      type="button"
                      onClick={() => handleSpeakText(m.message)}
                      className={`p-1.5 rounded-lg transition-all text-xs cursor-pointer ${isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      title="Replay Voice"
                    >
                      🔊
                    </button>
                  )}
                </div>
                <p className="leading-relaxed text-xs sm:text-[13px]">{m.message}</p>

                {/* In-Chat Live Coaching Card below each message */}
                {m.sender === "ai" && m.coachFeedback && (
                  <CoachCard feedback={m.coachFeedback} isDark={isDark} onSpeakText={(t) => handleSpeakText(t)} />
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#6c63ff]/10 border border-[#6c63ff]/30 text-xs font-bold text-[#6c63ff] animate-pulse max-w-sm">
              <span className="h-2 w-2 rounded-full bg-[#6c63ff] animate-ping" />
              Analyzing your grammar and speaking pacing...
            </div>
          )}

          {/* Live Transcript Stream */}
          {isListening && (
            <div className="flex flex-col items-end">
              <div className={`p-3.5 rounded-2xl bg-[#6c63ff]/20 border border-[#6c63ff]/40 text-xs font-semibold italic animate-pulse ${isDark ? "text-white" : "text-indigo-950"
                }`}>
                🎙️ "{currentTranscript || "Listening to your voice..."}"
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Floating AI Hint Button (Shown when drawer is closed — hints DO NOT come automatically) */}
        {!showHints && (
          <div className="flex justify-end px-4 py-2 shrink-0 border-t border-transparent pointer-events-auto">
            <button
              type="button"
              onClick={handleToggleHints}
              disabled={loadingHints}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white text-xs font-black shadow-lg hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-white/20"
              title="Click to open AI response suggestions"
            >
              <span className="text-yellow-300 text-xs">💡</span>
              <span>{loadingHints ? "Loading..." : "AI Hint ✨"}</span>
            </button>
          </div>
        )}

        {/* AI Hint Drawer: Quick suggested replies with scroll and audio preview */}
        {showHints && (
          <div className={`p-3 sm:px-4 border-t transition-all shrink-0 ${
            isDark ? "bg-slate-900/95 border-white/10" : "bg-indigo-50/80 border-indigo-200"
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">✨</span>
                <span className={`text-[11px] font-black uppercase tracking-wider truncate ${
                  isDark ? "text-indigo-300" : "text-indigo-800"
                }`}>
                  Suggested Responses (Tap to speak or listen):
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHints(false)}
                className={`p-1 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title="Close AI Hints"
              >
                ✕
              </button>
            </div>

            {loadingHints ? (
              <div className="flex items-center gap-2 py-2 text-xs font-semibold text-[#6c63ff] animate-pulse">
                <span className="h-2 w-2 rounded-full bg-[#6c63ff] animate-ping" />
                <span>Generating contextual speaking suggestions...</span>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2 pt-1 flex items-center gap-3 scroll-smooth scrollbar-thin">
                {(hints.length > 0 ? hints : getScenarioHints(scenario, [...messages].reverse().find((m) => m.sender === "ai"))).map((hint, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center rounded-xl border shadow-sm shrink-0 transition-all overflow-hidden ${
                      isDark
                        ? "bg-slate-800/90 border-white/10 hover:border-[#6c63ff]"
                        : "bg-white border-slate-200 hover:border-[#6c63ff]"
                    }`}
                  >
                    {/* Click to send text */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowHints(false);
                        stopSpeaking();
                        setIsAiSpeaking(false);
                        setViseme("REST");
                        sendUserText(hint);
                      }}
                      className={`px-3 py-2 text-xs font-semibold text-left transition-colors whitespace-nowrap max-w-[280px] sm:max-w-md truncate cursor-pointer ${
                        isDark ? "text-slate-200 hover:text-[#A5B4FC]" : "text-slate-700 hover:text-[#6c63ff]"
                      }`}
                      title={`Send: "${hint}"`}
                    >
                      {hint}
                    </button>

                    {/* Click to listen to audio preview before speaking */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeakText(hint);
                      }}
                      className={`px-2.5 py-2 border-l transition-colors flex items-center justify-center cursor-pointer ${
                        isDark
                          ? "border-white/10 text-indigo-300 hover:bg-white/10 hover:text-white"
                          : "border-slate-200 text-[#6c63ff] hover:bg-indigo-50 hover:text-indigo-900"
                      }`}
                      title="Listen to native pronunciation preview before speaking"
                    >
                      🔊
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Control Center */}
        <div className={`p-3 sm:p-4 border-t backdrop-blur-2xl flex flex-col gap-2.5 shrink-0 ${isDark ? "bg-slate-900/80 border-white/10" : "bg-white border-slate-200"
          }`}>
          {isListening && (
            <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-bold ${isDark ? "text-rose-400" : "text-rose-500"
              }`}>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 h-4">
                  <span className="w-1 bg-rose-500 rounded-full h-3 animate-pulse" />
                  <span className="w-1 bg-rose-500 rounded-full h-5 animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 bg-rose-500 rounded-full h-3.5 animate-pulse" style={{ animationDelay: "300ms" }} />
                  <span className="w-1 bg-rose-500 rounded-full h-5 animate-pulse" style={{ animationDelay: "75ms" }} />
                  <span className="w-1 bg-rose-500 rounded-full h-2.5 animate-pulse" style={{ animationDelay: "225ms" }} />
                </div>
                <span>Listening — auto-sends when you finish speaking...</span>
              </div>
              <span className={`text-[10px] uppercase font-black ${isDark ? "text-rose-300" : "text-rose-600"}`}>Auto-sends on silence</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!isMuted && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                    setIsAiSpeaking(false);
                    setViseme("REST");
                  }
                  setIsMuted(!isMuted);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${isMuted
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                    : isDark
                      ? "bg-slate-800/60 border-white/10 text-slate-300 hover:text-white"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900"
                  }`}
                title={isMuted ? "Unmute AI Voice" : "Mute AI Voice"}
              >
                {isMuted ? "🔇" : "🔊"}
              </button>

              <button
                onClick={handleToggleSpeed}
                className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold text-[#6c63ff] transition-all shadow-sm flex items-center gap-1.5 ${isDark ? "bg-slate-800/60 border-white/10 hover:bg-slate-700" : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                  }`}
                title="Adjust Speech Speed"
              >
                <span>⏱️ {speechSpeed}x</span>
              </button>
            </div>

            {/* Circular Glowing Microphone */}
            <div className="flex items-center justify-center">
              {!isListening ? (
                <div className="relative group">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-[#6c63ff] to-[#ff6584] opacity-40 blur-md group-hover:opacity-80 transition-opacity" />
                  <button
                    onClick={handleStartListening}
                    className="relative grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-full bg-gradient-to-tr from-[#6c63ff] to-[#ff6584] text-white shadow-xl hover:scale-105 transition-transform"
                    title="Click to Speak"
                  >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-rose-500 opacity-50 animate-ping" />
                  <button
                    onClick={handleStopListeningAndSend}
                    className="relative grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-full bg-rose-500 text-white shadow-xl animate-pulse ring-4 ring-rose-500/30"
                    title="Click to Finish & Send"
                  >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleHints}
                disabled={loadingHints}
                className={`px-3 py-2 rounded-xl border text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                  showHints
                    ? "bg-[#6c63ff] text-white border-[#6c63ff] shadow-md shadow-[#6c63ff]/30"
                    : isDark
                      ? "bg-slate-800/80 border-white/10 text-indigo-300 hover:bg-slate-700 hover:text-white"
                      : "bg-indigo-50/80 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                }`}
                title="Toggle AI Hints Drawer"
              >
                <span>💡</span>
                <span>{loadingHints ? "..." : "AI Hint ✨"}</span>
              </button>

              <button
                onClick={handleEndSession}
                disabled={ending}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#ff6584] text-white text-xs font-extrabold shadow-md hover:opacity-90 transition-all shrink-0"
              >
                {ending ? "Saving..." : "Finish →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConversationSession;
