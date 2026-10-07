import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";

import ROUTES from "../constants/routes";
import { aiService, speakingService } from "../services/appServices";
import { generateDynamicCoachingResponse, cleanDialogueText, getDynamicContextualHints, stripQuotes } from "../utils/aiConversationEngine";
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

// Dynamic AI contextual hint generator: Never returns repetitive static responses
const generateAiHints = async ({ scenario, scenarioDesc = "", messages, sessionId, level = "Intermediate", turnSalt = 0 }) => {
  const lastAiMsg = [...messages].reverse().find((m) => m.sender === "ai");
  const lastAiText = (lastAiMsg?.message || "").trim();
  const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
  const lastUserText = (lastUserMsg?.message || "").trim();
  const turnCount = messages.filter((m) => m.sender === "user").length;

  // 1. Try remote speakingService.getHints if remote session exists and not forcing salt
  if (sessionId && !String(sessionId).startsWith("sim_") && turnSalt === 0) {
    try {
      const remoteHints = await speakingService.getHints(sessionId);
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
    const prompt = `You are an expert English conversation tutor observing a live speaking practice.
Scenario: "${scenario || 'Daily Conversation'}"
${scenarioDesc ? `Scenario Goal/Context: "${scenarioDesc}"` : ''}
Student Level / Standard: ${level || 'Intermediate'}
Tutor's latest message to the student: "${lastAiText || 'Hello! Welcome to our speaking practice.'}"
${lastUserText ? `Student previously said: "${lastUserText}"` : ''}
Session turn: ${turnCount}
Seed: ${Date.now() + turnSalt}

Task: Give EXACTLY 3 distinct, fresh, natural speaking responses the student could say next to answer or respond to the tutor's latest message right now:
- Suggestion 1: Direct, realistic answer or reaction to what the tutor said (5-10 words)
- Suggestion 2: Natural, polite personal experience or elaboration (6-14 words)
- Suggestion 3: A curious follow-up question or perspective (5-12 words)

CRITICAL RULES:
- Tailor each suggestion directly to what the tutor asked: "${lastAiText || ''}".
- Do NOT use generic conversation filler or corporate job interview phrases unless relevant to this specific scenario.
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

  // 3. Dynamic Contextual Smart Generator (Offline / network-safe fallback that NEVER repeats identical hints)
  return getDynamicContextualHints(scenario, lastAiText, turnCount, turnSalt);
};

// Clean vocabulary splitter
const cleanVocabList = (text) => {
  if (!text || typeof text !== "string") return [];
  return text
    .split(/[,;\n]+/)
    .map((w) => w.trim().replace(/^["']|["']$/g, ""))
    .filter((w) => w.length > 0 && !w.toLowerCase().includes("none") && !w.toLowerCase().includes("null"));
};

// Conversational Voice Activity Thresholds
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

// Sleek Unified Web Coach Card (Modern Desktop Web Design)
function CoachCard({ feedback, isDark, onSpeakText }) {
  const [isExpanded, setIsExpanded] = useState(true);

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
  const vocabList = cleanVocabList(vocabularySuggestions);
  const hasVocab = vocabList.length > 0;

  if (!hasBetter && !hasGrammar && !hasFluency && !hasFollowup && !hasVocab) return null;

  const isGrammarOk =
    hasGrammar &&
    (grammarCorrection.includes("✅") ||
      grammarCorrection.toLowerCase().includes("correct") ||
      grammarCorrection.toLowerCase().includes("great job") ||
      grammarCorrection.toLowerCase().includes("clear and natural"));

  return (
    <div
      className={`mt-3 rounded-2xl border transition-all overflow-hidden w-full shadow-xs ${
        isDark
          ? "bg-slate-900/60 border-indigo-500/20 shadow-black/20"
          : "bg-slate-50/90 border-slate-200/80"
      }`}
    >
      {/* Sleek Header Bar with Status & Collapse Toggle */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors ${
          isDark ? "bg-slate-800/40 border-b border-white/5" : "bg-white/80 border-b border-slate-200/60"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-[#6c63ff]/10 text-[#6c63ff] dark:text-[#A5B4FC] flex items-center justify-center text-xs shrink-0 font-bold">
            ✨
          </div>
          <span
            className={`text-[11px] font-bold tracking-wider uppercase truncate ${
              isDark ? "text-slate-200" : "text-slate-800"
            }`}
          >
            Coach Insights
          </span>
          <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">
            · live speech analysis
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasGrammar && (
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                isGrammarOk
                  ? isDark
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : isDark
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isGrammarOk ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span>{isGrammarOk ? "Grammar Accurate" : "Refinement Needed"}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1 px-1.5 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              isDark
                ? "text-slate-400 hover:text-white hover:bg-slate-800"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
            title={isExpanded ? "Collapse evaluation" : "Expand evaluation"}
          >
            <span>{isExpanded ? "Hide" : "Details"}</span>
            <span className="text-[9px]">{isExpanded ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* Expanded Unified Body */}
      {isExpanded && (
        <div className="divide-y divide-slate-100 dark:divide-white/5 animate-in fade-in duration-150">
          {/* Primary Callout: Your Sentence is Correct */}
          {isGrammarOk && (
            <div
              className={`p-3.5 sm:p-4 transition-colors ${
                isDark ? "bg-emerald-950/20" : "bg-emerald-50/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>✅</span>
                  <span>Your Sentence is Correct</span>
                </span>
              </div>
              <p
                className={`text-xs sm:text-[13px] font-medium leading-relaxed ${
                  isDark ? "text-emerald-200/90" : "text-emerald-800"
                }`}
              >
                Great job! Your sentence is grammatically clear and natural.
              </p>
            </div>
          )}

          {/* Better Natural Phrasing / Native Expression */}
          {hasBetter && (
            <div
              className={`p-3.5 sm:p-4 transition-colors ${
                isDark ? "bg-indigo-950/20" : "bg-indigo-50/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c63ff] dark:text-[#A5B4FC] flex items-center gap-1.5">
                  <span>🚀</span>
                  <span>{isGrammarOk ? "Native Expression" : "Better Natural Phrasing"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onSpeakText(stripQuotes(betterSentence))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer bg-[#6c63ff] hover:bg-[#5a52e0] text-white shadow-xs active:scale-95 shrink-0"
                  title="Listen to native pronunciation"
                >
                  <span>🔊</span>
                  <span>Listen</span>
                </button>
              </div>
              <p
                className={`text-xs sm:text-[13px] font-medium leading-relaxed italic ${
                  isDark ? "text-indigo-100" : "text-slate-800"
                }`}
              >
                "{stripQuotes(betterSentence)}"
              </p>
            </div>
          )}

          {/* Grammar Correction (Displayed when refinement is needed) */}
          {hasGrammar && !isGrammarOk && (
            <div className="p-3.5 flex items-start gap-2.5">
              <span className="text-amber-500 font-bold shrink-0 mt-0.5 text-xs">✍️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-0.5">
                  Grammar Suggestion
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  👉 {grammarCorrection.replace(/^👉\s*/, "")}
                </p>
              </div>
            </div>
          )}

          {/* Fluency & Pronunciation Tip */}
          {hasFluency && (
            <div className="p-3.5 flex items-start gap-2.5">
              <span className="text-sky-500 font-bold shrink-0 mt-0.5 text-xs">💡</span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-0.5">
                  Fluency & Pronunciation
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {fluencyTip}
                </p>
              </div>
            </div>
          )}

          {/* Vocabulary Upgrades as sleek interactive pills */}
          {hasVocab && (
            <div className="p-3.5 flex items-start gap-2.5">
              <span className="text-amber-500 font-bold shrink-0 mt-0.5 text-xs">✨</span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">
                  Vocabulary Upgrade
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {vocabList.map((word, wIdx) => (
                    <span
                      key={wIdx}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border inline-flex items-center ${
                        isDark
                          ? "bg-slate-800/90 text-amber-300 border-amber-500/20"
                          : "bg-amber-50/80 text-amber-900 border-amber-200/80"
                      }`}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Follow-up Question Inquiry */}
          {hasFollowup && (
            <div className="p-3.5 flex items-start gap-2.5">
              <span className="text-purple-500 font-bold shrink-0 mt-0.5 text-xs">❓</span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-0.5">
                  Suggested Follow-up
                </div>
                <p className={`text-xs font-medium italic ${isDark ? "text-purple-200" : "text-slate-800"}`}>
                  "{stripQuotes(followUpQuestion)}"
                </p>
              </div>
            </div>
          )}
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
  const latestSuggestedRef = useRef(null);
  const lastHintsTurnRef = useRef(-1);
  const [corrections, setCorrections] = useState(null);
  const [ending, setEnding] = useState(false);

  // Dynamic Real-Time Phonetic Viseme State ("REST", "AA", "EE", "OO", "IH", "OH")
  const [viseme, setViseme] = useState("REST");

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const initialSilenceTimerRef = useRef(null);
  const stoppingByUserRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const handleStopListeningAndSendRef = useRef(null);
  const sendUserTextRef = useRef(null);
  const isSendingRef = useRef(false);
  const recordingSessionRef = useRef(0);
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

        const fullTranscript = `${accumulatedTranscriptRef.current} ${interim}`
          .replace(/\s+/g, " ")
          .trim();
        setCurrentTranscript(fullTranscript);

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

  const handleToggleHints = async (forceRefresh = false) => {
    if (isPaused) return;
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
      // 1. Check if backend message feedback already delivered fresh suggested responses for this turn
      if (!forceRefresh && latestSuggestedRef.current && latestSuggestedRef.current.length >= 2) {
        setHints(latestSuggestedRef.current);
        lastHintsTurnRef.current = currentTurn;
        latestSuggestedRef.current = null;
        setLoadingHints(false);
        return;
      }

      // 2. Dynamically generate fresh hints using AI
      const turnSalt = forceRefresh ? Math.floor(Math.random() * 10000) + 1 : 0;
      const scenarioDesc = location.state?.scenarioDesc || "";
      const dynamicHints = await generateAiHints({
        scenario,
        scenarioDesc,
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
      setHints(getDynamicContextualHints(scenario, lastAi?.message, currentTurn, Math.floor(Math.random() * 100)));
      lastHintsTurnRef.current = currentTurn;
    } finally {
      setLoadingHints(false);
    }
  };

  const handleStartListening = () => {
    if (isPaused || isSendingRef.current) return;
    if (coachingTimerRef.current) {
      clearTimeout(coachingTimerRef.current);
      coachingTimerRef.current = null;
    }
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
        setCurrentTranscript("I want to learn English fluently and improve my vocabulary.");
        silenceTimerRef.current = setTimeout(() => {
          if (handleStopListeningAndSendRef.current) {
            handleStopListeningAndSendRef.current();
          }
        }, NORMAL_SILENCE_THRESHOLD);
      }, 1500);
    }
  };

  const sendUserText = async (text) => {
    if (!text || typeof text !== "string") return;
    const cleanUserText = text.trim();
    if (cleanUserText.length < 2) return;

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
    latestSuggestedRef.current = null;
    lastHintsTurnRef.current = -1;
    setCurrentTranscript("");
    setIsThinking(true);

    const userMsg = { id: Date.now(), sender: "user", message: cleanUserText };
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

      if (feedback?.suggestedResponses && Array.isArray(feedback.suggestedResponses) && feedback.suggestedResponses.length >= 2) {
        latestSuggestedRef.current = feedback.suggestedResponses
          .map((h) => cleanDialogueText(h).replace(/^["']|["']$/g, "").trim())
          .filter((h) => h.length > 3);
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
  sendUserTextRef.current = sendUserText;

  const handleStopListeningAndSend = async () => {
    // 1. Immediately cancel any pending silence timer
    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // 2. Race condition protection: prevent multiple concurrent sends
    if (isSendingRef.current) return;

    stoppingByUserRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }

    // 3. Collect complete available transcript (accumulated final + interim)
    const finalSpoken = `${accumulatedTranscriptRef.current} ${interimTranscriptRef.current}`
      .replace(/\s+/g, " ")
      .trim() || currentTranscript.replace(/\s+/g, " ").trim();

    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setCurrentTranscript("");

    // 4. Minimum Transcript Guard: prevent empty sends, noise, or clicks (< 2 chars)
    if (!finalSpoken || finalSpoken.length < 2) {
      return;
    }

    // 5. Send message with race-condition lock
    isSendingRef.current = true;
    try {
      if (sendUserTextRef.current) {
        await sendUserTextRef.current(finalSpoken);
      } else {
        await sendUserText(finalSpoken);
      }
    } finally {
      isSendingRef.current = false;
    }
  };
  handleStopListeningAndSendRef.current = handleStopListeningAndSend;

  const handleCancelListening = () => {
    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }
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

    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setCurrentTranscript("");
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

        {/* AI Hint Drawer: Quick suggested replies with smooth scroll */}
        {showHints && (
          <div className={`p-3 sm:px-5 border-t transition-all shrink-0 animate-in fade-in duration-200 ${
            isDark ? "bg-slate-900/95 border-white/10" : "bg-white/95 border-slate-200 shadow-xs"
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">💡</span>
                <span className={`text-xs font-bold tracking-wide truncate ${
                  isDark ? "text-slate-200" : "text-slate-800"
                }`}>
                  Suggested Responses
                </span>
                <span className="hidden sm:inline text-[11px] text-slate-400 font-normal">
                  — click any response to send
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
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
              <div className="flex items-center gap-2 py-2 text-xs font-semibold text-[#6c63ff] animate-pulse">
                <span className="h-2 w-2 rounded-full bg-[#6c63ff] animate-ping" />
                <span>Generating fresh contextual suggestions...</span>
              </div>
            ) : hints.length > 0 ? (
              <div className="overflow-x-auto pb-2 pt-1 flex items-center gap-2.5 scroll-smooth scrollbar-thin">
                {hints.map((hint, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setShowHints(false);
                      stopSpeaking();
                      setIsAiSpeaking(false);
                      setViseme("REST");
                      sendUserText(hint);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border shadow-xs whitespace-nowrap cursor-pointer active:scale-95 ${
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
              <div className="py-2 text-xs text-slate-400 flex items-center gap-2">
                <span>Click "New Hints" to generate responses.</span>
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
              <button
                type="button"
                onClick={handleCancelListening}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  isDark ? "text-rose-300 hover:bg-rose-500/20" : "text-rose-600 hover:bg-rose-500/10"
                }`}
                title="Cancel Recording"
              >
                Cancel ✕
              </button>
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
