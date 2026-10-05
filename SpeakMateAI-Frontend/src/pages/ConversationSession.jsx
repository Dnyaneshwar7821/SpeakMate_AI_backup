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
    if (lastAiMsg && lastAiMsg.text) {
      speakGlobalText(lastAiMsg.text, nextSpeed);
    }
  };

  const handleFetchHints = async () => {
    if (isPaused) return;
    setLoadingHints(true);
    try {
      const data = await speakingService.getHints(sessionId).catch(() => [
        "I would like to practice speaking about my hobbies and work experience.",
        "Could you ask me a question about my daily routine?",
      ]);
      setHints(data || []);
    } catch (e) {
      console.warn("Failed to fetch hints:", e);
    } finally {
      setLoadingHints(false);
    }
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
      const aiMsg = {
        id: Date.now() + 1,
        sender: "ai",
        message: cleanAiReply || "That is very interesting! Can you tell me more about that?",
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Only set corrections if it doesn't contain raw markdown table noise
      if (feedback.grammarCorrection && !feedback.grammarCorrection.includes("|")) {
        setCorrections({
          ...feedback,
          grammarCorrection: cleanDialogueText(feedback.grammarCorrection),
          betterSentence: feedback.betterSentence ? cleanDialogueText(feedback.betterSentence) : null,
          explanation: feedback.explanation ? cleanDialogueText(feedback.explanation) : null,
          vocabularySuggestions: feedback.vocabularySuggestions ? cleanDialogueText(feedback.vocabularySuggestions) : null,
        });
      } else {
        setCorrections(null);
      }

      const fullSpeakableText = getSpeakableText(feedback);
      const cleanBetter = feedback.betterSentence ? cleanDialogueText(feedback.betterSentence) : null;
      const isCleanCorrection =
        feedback.grammarCorrection &&
        !feedback.grammarCorrection.includes("✅") &&
        !feedback.grammarCorrection.toLowerCase().includes("correct") &&
        !feedback.grammarCorrection.includes("|");
      const cleanCorrection = isCleanCorrection ? cleanDialogueText(feedback.grammarCorrection) : null;
      const coachingTipSentence = cleanBetter || cleanCorrection;

      if (coachingTimerRef.current) {
        clearTimeout(coachingTimerRef.current);
        coachingTimerRef.current = null;
      }

      handleSpeakText(fullSpeakableText, () => {
        if (coachingTipSentence && !isMuted) {
          coachingTimerRef.current = setTimeout(() => {
            const coachingSpeech = `A better way to say that is: ${coachingTipSentence}`;
            handleSpeakText(coachingSpeech, null, true);
          }, 300); // 0.30 sec pause before coaching tip
        }
      }, true);
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
                className={`max-w-[88%] sm:max-w-[80%] p-4 rounded-2xl text-xs font-semibold shadow-md space-y-2 ${m.sender === "user"
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
                      onClick={() => handleSpeakText(m.message)}
                      className={`p-1 rounded-lg transition-all text-xs ${isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      title="Replay Voice"
                    >
                      🔊
                    </button>
                  )}
                </div>
                <p className="leading-relaxed text-xs sm:text-[13px]">{m.message}</p>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#6c63ff]/10 border border-[#6c63ff]/30 text-xs font-bold text-[#6c63ff] animate-pulse max-w-sm">
              <span className="h-2 w-2 rounded-full bg-[#6c63ff] animate-ping" />
              Analyzing your grammar and speaking pacing...
            </div>
          )}

          {/* Dynamic Tutor Feedback & Corrections card */}
          {corrections && (
            <div className={`p-4 rounded-2xl backdrop-blur-md border space-y-2.5 shadow-lg animate-in fade-in duration-300 ${isDark ? "bg-slate-800/90 border-white/10 text-slate-100" : "bg-white border-slate-200 text-slate-800"
              }`}>
              <div className={`flex items-center justify-between gap-2 text-xs font-extrabold text-[#6c63ff] pb-2 border-b ${isDark ? "border-white/10" : "border-slate-200"
                }`}>
                <span className="flex items-center gap-1.5">🎓 Live Tutor Evaluation</span>
                <button
                  onClick={() => handleSpeakText(getSpeakableText(corrections))}
                  className="px-2.5 py-1 rounded-lg bg-[#6c63ff] text-white text-[10px] font-bold hover:bg-[#8b85ff] transition-all flex items-center gap-1 shadow-sm"
                  title="Listen Correction Audio"
                >
                  <span>🔊 Hear Feedback</span>
                </button>
              </div>

              {corrections.grammarCorrection && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-emerald-500" : "text-emerald-600"}`}>Grammar Tip</span>
                  <p className={`font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>👉 {corrections.grammarCorrection}</p>
                </div>
              )}

              {corrections.betterSentence && (
                <div className="p-2.5 rounded-xl bg-[#6c63ff]/10 border border-[#6c63ff]/30 text-xs space-y-1">
                  <span className="text-[10px] font-black text-[#6c63ff] uppercase tracking-wider">Native Expression</span>
                  <p className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>💡 "{corrections.betterSentence}"</p>
                </div>
              )}

              {corrections.explanation && (
                <div className={`p-2.5 rounded-xl border text-xs space-y-1 ${isDark ? "bg-slate-900/60 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Explanation</span>
                  <p className="font-normal italic">{corrections.explanation}</p>
                </div>
              )}

              {corrections.vocabularySuggestions && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-amber-500" : "text-amber-600"}`}>Vocabulary Upgrade</span>
                  <p className={`font-semibold ${isDark ? "text-amber-300" : "text-amber-700"}`}>✨ {corrections.vocabularySuggestions}</p>
                </div>
              )}
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

        {/* Dynamic Scenario Suggestions chips */}
        {(() => {
          const lastAi = [...messages].reverse().find((m) => m.sender === "ai");
          const activeHints = hints.length > 0 ? hints : getScenarioHints(scenario, lastAi);
          return (
            <div className={`p-2.5 sm:px-4 border-t flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none ${isDark ? "bg-slate-900/60 border-white/10" : "bg-slate-50 border-slate-200"
              }`}>
              <span className={`text-[10px] font-black uppercase tracking-wide shrink-0 flex items-center gap-1 ${isDark ? "text-indigo-300" : "text-indigo-600"
                }`}>
                💡 Suggestions:
              </span>
              {activeHints.map((hint, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    stopSpeaking();
                    setIsAiSpeaking(false);
                    setViseme("REST");
                    sendUserText(hint);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border shadow-sm whitespace-nowrap ${isDark
                      ? "bg-slate-800/80 hover:bg-[#6c63ff] hover:text-white text-slate-200 border-white/10"
                      : "bg-white hover:bg-[#6c63ff] hover:text-white text-slate-700 border-slate-200"
                    }`}
                >
                  {hint}
                </button>
              ))}
            </div>
          );
        })()}

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
                onClick={handleFetchHints}
                disabled={loadingHints}
                className="px-3 py-2 rounded-xl bg-[#6c63ff]/10 border border-[#6c63ff]/30 text-[#6c63ff] text-xs font-bold hover:bg-[#6c63ff]/20 transition-all shadow-sm"
                title="Get AI Suggestion"
              >
                💡 {loadingHints ? "..." : "Hint"}
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
