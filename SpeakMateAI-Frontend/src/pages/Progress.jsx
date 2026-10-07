import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import ROUTES from "../constants/routes";
import { getLiveProgressStats, recordSpeakingSession, syncBackendProgress } from "../utils/progressTracker";
import { progressService, dashboardService } from "../services/appServices";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { speakGlobalText } from "../utils/speechHelper";
import { getEnglishLevelLabel } from "../utils/formatters";


const CEFR_LEVELS = [
  { code: "A1", name: "Beginner", minXp: 0, maxXp: 500, color: "from-blue-500 to-indigo-600", desc: "Can understand basic everyday expressions and introduce oneself." },
  { code: "A2", name: "Elementary", minXp: 500, maxXp: 1500, color: "from-cyan-500 to-teal-600", desc: "Can communicate in routine tasks requiring simple direct exchanges." },
  { code: "B1", name: "Intermediate", minXp: 1500, maxXp: 3000, color: "from-emerald-500 to-green-600", desc: "Can handle most travel and everyday conversational situations with ease." },
  { code: "B2", name: "Upper Intermediate", minXp: 3000, maxXp: 5000, color: "from-purple-500 to-indigo-600", desc: "Can converse fluently and spontaneously with native speakers." },
  { code: "C1", name: "Advanced", minXp: 5000, maxXp: 8000, color: "from-pink-500 to-rose-600", desc: "Can express ideas fluently, spontaneously, and flexibly for social, academic, and professional goals." },
  { code: "C2", name: "Mastery / Native", minXp: 8000, maxXp: 15000, color: "from-amber-400 to-yellow-600", desc: "Can understand virtually everything heard or read and express spontaneously with effortless precision." },
];

const FLUENCY_PROMPTS = [
  { id: "p1", title: "🌟 Professional Self Introduction", desc: "Introduce yourself, your career background, and your biggest passion in 30-45 seconds.", category: "Career", targetWpm: "130-150 WPM" },
  { id: "p2", title: "✈️ Unforgettable Travel Experience", desc: "Describe a memorable vacation or trip you took and why it was special.", category: "Daily Life", targetWpm: "120-140 WPM" },
  { id: "p3", title: "🤖 Opinions on Modern Technology & AI", desc: "Express your perspective on how artificial intelligence is shaping the future of work.", category: "Thought & Debate", targetWpm: "135-155 WPM" },
  { id: "p4", title: "☕ Ideal Weekend Routine", desc: "Walk through how you spend a perfect weekend morning and evening.", category: "Casual", targetWpm: "120-140 WPM" },
  { id: "p5", title: "🎯 Overcoming a Tough Challenge", desc: "Explain a difficult situation you faced and how you overcame it step by step.", category: "Storytelling", targetWpm: "130-150 WPM" },
];

const FILLER_WORDS = ["um", "uh", "like", "you know", "actually", "basically", "literally", "sort of", "kind of", "so yeah", "i mean"];

export function Progress() {
  const { isDark } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("overview"); // 'overview', 'fluency', 'roadmap', 'rhythm'
  const [loading, setLoading] = useState(false);
  const [liveStats, setLiveStats] = useState(() => getLiveProgressStats());
  const [rhythmList, setRhythmList] = useState([]);

  // Fluency Diagnostic Studio State
  const [selectedPrompt, setSelectedPrompt] = useState(FLUENCY_PROMPTS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [fluencyReport, setFluencyReport] = useState(null);
  const [analyzingFluency, setAnalyzingFluency] = useState(false);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const stoppingByUserRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const handleStopFluencyRef = useRef(null);
  const recordingSecondsRef = useRef(0);
  const timerRef = useRef(null);

  const fetchRhythm = useCallback(async () => {
    try {
      const res = await dashboardService.rhythm(7);
      if (Array.isArray(res) && res.length > 0) {
        setRhythmList(res);
      } else if (liveStats.weeklyData && liveStats.weeklyData.length > 0) {
        setRhythmList(liveStats.weeklyData);
      }
    } catch (e) {
      if (liveStats.weeklyData && liveStats.weeklyData.length > 0) {
        setRhythmList(liveStats.weeklyData);
      }
    }
  }, [liveStats.weeklyData]);

  useEffect(() => {
    fetchRhythm();
  }, [fetchRhythm]);

  const updateStats = async () => {
    try {
      const local = getLiveProgressStats();
      const backend = await progressService.get().catch(() => null);
      if (backend) {
        const merged = {
          ...local,
          xp: backend.xp !== undefined && backend.xp !== null ? backend.xp : (local.xp || 0),
          level: backend.level !== undefined && backend.level !== null ? backend.level : (local.level || 1),
          streak: Math.max(local.streak || 0, backend.currentStreak || 0),
          longestStreak: Math.max(local.longestStreak || 0, backend.longestStreak || 0),
          speakingSessions: backend.totalSpeakingSessions !== undefined && backend.totalSpeakingSessions !== null ? backend.totalSpeakingSessions : (local.speakingSessions || 0),
          wordsLearned: backend.totalVocabularyWords !== undefined && backend.totalVocabularyWords !== null ? backend.totalVocabularyWords : (local.wordsLearned || 0),
          grammarExercises: backend.totalGrammarChecks !== undefined && backend.totalGrammarChecks !== null ? backend.totalGrammarChecks : (local.grammarExercises || 0),
          speakingMins: backend.totalPracticeMinutes !== undefined && backend.totalPracticeMinutes !== null ? backend.totalPracticeMinutes : (local.speakingMins || 0),
          totalHours: (((backend.totalPracticeMinutes !== undefined && backend.totalPracticeMinutes !== null ? backend.totalPracticeMinutes : (local.speakingMins || 0))) / 60).toFixed(1),
        };
        setLiveStats(merged);
        syncBackendProgress({ ...backend, progress: backend });
      } else {
        setLiveStats(local);
      }
      fetchRhythm();
    } catch (err) {
      console.warn("Failed to load progress stats", err);
    }
  };

  useEffect(() => {
    updateStats();
    const handleLocalUpdate = (e) => {
      if (e?.detail) {
        setLiveStats(e.detail);
      } else {
        setLiveStats(getLiveProgressStats());
      }
    };
    window.addEventListener("focus", updateStats);
    window.addEventListener("speakmate_progress_updated", handleLocalUpdate);
    return () => {
      window.removeEventListener("focus", updateStats);
      window.removeEventListener("speakmate_progress_updated", handleLocalUpdate);
    };
  }, []);

  // Fluency timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const totalHours = liveStats.totalHours || liveStats.totalStudyHours || 0;
  const accuracy = liveStats.accuracy || 0;
  const wordsLearned = liveStats.wordsLearned || liveStats.vocabularyLearned || 0;
  const streak = liveStats.streak || liveStats.currentStreak || 1;
  const longestStreak = liveStats.longestStreak || Math.max(streak, 1);
  const xp = liveStats.xp || 0;
  const speakingSessions = liveStats.speakingSessions || 0;
  const grammarExercises = liveStats.grammarExercises || liveStats.grammarChecks || 0;
  const completedLessons = liveStats.completedLessons || liveStats.lessonsCompleted || 0;
  const chatMessages = liveStats.chatMessages || 0;

  // Level & XP calculations (500 XP per level)
  const level = Math.floor(xp / 500) + 1;
  const englishLevelLabel = getEnglishLevelLabel(level);
  const currentLevelBaseXp = (level - 1) * 500;
  const nextLevelXp = level * 500;
  const levelXpProgress = Math.max(0, xp - currentLevelBaseXp);
  const xpToNextLevel = 500 - levelXpProgress;
  const levelPercentage = Math.min(100, Math.max(0, (levelXpProgress / 500) * 100));

  // CEFR calculations
  const currentCefr = CEFR_LEVELS.find((c) => xp >= c.minXp && xp < c.maxXp) || CEFR_LEVELS[CEFR_LEVELS.length - 1];
  const nextCefrIndex = CEFR_LEVELS.findIndex((c) => c.code === currentCefr.code) + 1;
  const nextCefr = nextCefrIndex < CEFR_LEVELS.length ? CEFR_LEVELS[nextCefrIndex] : null;
  const cefrRange = currentCefr.maxXp - currentCefr.minXp;
  const cefrProgress = Math.min(100, Math.max(0, ((xp - currentCefr.minXp) / cefrRange) * 100));

  // Calibrated 6-Dimensional Skill Breakdown calculations
  const hasActivity = speakingSessions > 0 || grammarExercises > 0 || wordsLearned > 0 || completedLessons > 0 || parseFloat(totalHours) > 0;

  const speakingScore = hasActivity
    ? Math.min(100, Math.round(accuracy ? (accuracy * 0.7 + Math.min(30, speakingSessions * 3)) : Math.min(85, Math.max(15, speakingSessions * 10))))
    : 0;

  const grammarScore = hasActivity
    ? Math.min(100, Math.round(grammarExercises > 0 ? Math.min(95, 35 + grammarExercises * 5) : 0))
    : 0;

  const vocabScore = hasActivity
    ? Math.min(100, Math.round(wordsLearned > 0 ? Math.min(95, 25 + wordsLearned * 2.5) : 0))
    : 0;

  const pronunciationScore = hasActivity
    ? Math.min(100, Math.round(speakingSessions > 0 ? (accuracy ? accuracy * 0.95 : Math.min(90, 40 + speakingSessions * 4)) : 0))
    : 0;

  const listeningScore = hasActivity
    ? Math.min(100, Math.round(completedLessons > 0 ? Math.min(95, 30 + completedLessons * 5) : 0))
    : 0;

  const staminaScore = hasActivity
    ? Math.min(100, Math.round(Math.min(99, streak * 8 + parseFloat(totalHours) * 6)))
    : 0;

  const getSkillStatus = (score) => {
    if (score === 0) return "Calibrating";
    if (score >= 85) return "Strong";
    if (score >= 70) return "Proficient";
    if (score >= 45) return "Developing";
    return "Starting";
  };

  const skillMatrix = [
    { name: "Speaking Fluency", score: speakingScore, icon: "🎙️", color: "from-indigo-500 to-indigo-600", status: getSkillStatus(speakingScore) },
    { name: "Grammar Accuracy", score: grammarScore, icon: "📝", color: "from-emerald-500 to-teal-600", status: getSkillStatus(grammarScore) },
    { name: "Active Vocabulary", score: vocabScore, icon: "💡", color: "from-amber-500 to-orange-500", status: getSkillStatus(vocabScore) },
    { name: "Pronunciation Clarity", score: pronunciationScore, icon: "🔊", color: "from-pink-500 to-rose-600", status: getSkillStatus(pronunciationScore) },
    { name: "Audio Comprehension", score: listeningScore, icon: "👂", color: "from-cyan-500 to-blue-600", status: getSkillStatus(listeningScore) },
    { name: "Daily Practice Stamina", score: staminaScore, icon: "⚡", color: "from-purple-500 to-violet-600", status: getSkillStatus(staminaScore) },
  ];

  const activeRhythmData = rhythmList.length > 0 ? rhythmList : (liveStats.weeklyData || []);
  const maxMins = Math.max(20, ...activeRhythmData.map((w) => w.studyMinutes || 0));
  const totalRhythmMinutes = activeRhythmData.reduce((acc, curr) => acc + (curr.studyMinutes || 0), 0);

  // Fluency Speech Diagnostic logic with Continuous Recognition & VAD Auto-Stop
  const startFluencyRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      setTranscript("");
      setFluencyReport(null);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      stoppingByUserRef.current = false;
      accumulatedTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      isListeningRef.current = true;
      setIsRecording(true);

      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = "en-US";

      recog.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + " " + chunk).trim();
          } else {
            interim += chunk;
          }
        }
        interimTranscriptRef.current = interim;
        const full = (accumulatedTranscriptRef.current + " " + interim).trim();
        setTranscript(full);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (full.length > 0) {
          silenceTimerRef.current = setTimeout(() => {
            if (handleStopFluencyRef.current) {
              handleStopFluencyRef.current();
            }
          }, 2800);
        }
      };

      recog.onerror = (e) => {
        if (e?.error === "no-speech") return;
        console.warn("Fluency Speech Recognition Notice:", e?.error || e);
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          isListeningRef.current = false;
          setIsRecording(false);
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
      };

      recog.onend = () => {
        if (isListeningRef.current && !stoppingByUserRef.current) {
          try {
            recog.start();
          } catch (err) {}
        } else {
          isListeningRef.current = false;
          setIsRecording(false);
        }
      };

      recognitionRef.current = recog;
      recog.start();
      toast.success("Listening... Speak freely — auto-analyzes when you finish speaking! 🎙️");
    } catch (e) {
      console.error(e);
      isListeningRef.current = false;
      setIsRecording(false);
      toast.error("Failed to access microphone.");
    }
  };

  const stopFluencyRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    stoppingByUserRef.current = true;
    isListeningRef.current = false;
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const finalSpoken = (
      accumulatedTranscriptRef.current + " " + (interimTranscriptRef.current || "")
    ).trim() || transcript.trim();

    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    if (finalSpoken) {
      analyzeSpokenFluency(finalSpoken, Math.max(3, recordingSecondsRef.current));
    }
  };
  handleStopFluencyRef.current = stopFluencyRecording;

  const analyzeSpokenFluency = (spokenText, durationSecs) => {
    setAnalyzingFluency(true);
    setTimeout(() => {
      const validText = spokenText.trim();
      const words = validText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      const effectiveSecs = Math.max(5, durationSecs);
      const minutes = effectiveSecs / 60;
      const rawWpm = Math.round(wordCount / minutes);
      const wpm = isNaN(rawWpm) || rawWpm === 0 ? (wordCount > 0 ? Math.round((wordCount / effectiveSecs) * 60) : 110) : rawWpm;

      // Filler word calculation
      const lowerText = validText.toLowerCase();
      let fillerCount = 0;
      const detectedFillers = [];
      FILLER_WORDS.forEach((f) => {
        const regex = new RegExp(`\\b${f}\\b`, "gi");
        const matches = lowerText.match(regex);
        if (matches) {
          fillerCount += matches.length;
          detectedFillers.push({ word: f, count: matches.length });
        }
      });

      // Lexical diversity (Type-Token Ratio)
      const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")));
      const ttr = wordCount > 0 ? Math.round((uniqueWords.size / wordCount) * 100) : 75;

      // Pace evaluation
      let paceCategory = "Optimal Natural Pace";
      let paceColor = "text-emerald-500";
      if (wpm < 100) {
        paceCategory = "Deliberate / Slow Pace";
        paceColor = "text-amber-500";
      } else if (wpm > 165) {
        paceCategory = "Rapid / Fast Pace";
        paceColor = "text-amber-500";
      }

      // Fluency Score Calculation (0-100)
      const paceScore = Math.min(100, Math.max(50, 100 - Math.abs(135 - wpm) * 1.2));
      const fillerPenalty = Math.min(30, fillerCount * 6);
      const diversityScore = Math.min(100, Math.max(60, ttr));
      const totalFluencyScore = Math.round(Math.min(99, Math.max(55, paceScore * 0.45 + diversityScore * 0.45 - fillerPenalty + 15)));

      // CEFR tier mapping
      let evaluatedCefr = "B1 Intermediate";
      if (totalFluencyScore >= 92) evaluatedCefr = "C2 Mastery / Native";
      else if (totalFluencyScore >= 85) evaluatedCefr = "C1 Advanced";
      else if (totalFluencyScore >= 75) evaluatedCefr = "B2 Upper Intermediate";
      else if (totalFluencyScore >= 65) evaluatedCefr = "B1 Intermediate";
      else evaluatedCefr = "A2 Elementary";

      const report = {
        wpm,
        wordCount,
        duration: effectiveSecs,
        fillerCount,
        detectedFillers,
        lexicalDiversity: ttr,
        paceCategory,
        paceColor,
        fluencyScore: totalFluencyScore,
        evaluatedCefr,
        transcript: validText || "Spoken speech registered and analyzed.",
        recommendation:
          wpm < 110
            ? "Try connecting thoughts with transition phrases (e.g. 'Furthermore', 'On the other hand') to maintain continuous momentum."
            : fillerCount > 2
            ? `Notice moments you used '${detectedFillers.map((d) => d.word).join(", ")}'. Pausing silently for 0.5s sounds far more confident than saying fillers.`
            : "Great natural conversational cadence and varied vocabulary usage!",
      };

      setFluencyReport(report);
      setAnalyzingFluency(false);
      recordSpeakingSession(1, totalFluencyScore);
      toast.success("Fluency Diagnostic Complete! +25 XP Earned 🏆");
    }, 800);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-2 sm:px-4 lg:px-6 py-2">
      {/* Top Banner */}
      <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#4338CA] text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-xl z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300 border border-white/20 shadow-sm mb-3.5 sm:mb-4">
            📊 Learning Intelligence & Fluency Studio
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-2.5">
            Analytics & Fluency Matrix
          </h1>
          <p className="text-xs sm:text-sm font-medium text-indigo-100 leading-relaxed">
            Track real-time CEFR level advancement, speech pace (WPM), lexical diversity, and habit stamina.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Link
            to={ROUTES.ACHIEVEMENTS}
            className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all shadow-lg flex items-center gap-2"
          >
            <span>🏆 Medal Room</span>
          </Link>
          <button
            onClick={updateStats}
            className="px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-black border border-white/25 backdrop-blur-md transition-all shrink-0 flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
          >
            <span>🔄 Sync Stats</span>
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className={`p-1.5 rounded-2xl border flex items-center gap-2 overflow-x-auto ${
        isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200 shadow-sm"
      }`}>
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 flex items-center gap-2 ${
            activeTab === "overview"
              ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30"
              : isDark
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>📊</span>
          <span>Analytics Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("fluency")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 flex items-center gap-2 ${
            activeTab === "fluency"
              ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30"
              : isDark
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🎙️</span>
          <span>Live Fluency Diagnostic Studio</span>
        </button>

        <button
          onClick={() => setActiveTab("roadmap")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 flex items-center gap-2 ${
            activeTab === "roadmap"
              ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30"
              : isDark
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>📈</span>
          <span>CEFR Mastery Roadmap</span>
        </button>

        <button
          onClick={() => setActiveTab("rhythm")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 flex items-center gap-2 ${
            activeTab === "rhythm"
              ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30"
              : isDark
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>📅</span>
          <span>Habit & Weekly Rhythm</span>
        </button>
      </div>

      {/* ── TAB 1: ANALYTICS OVERVIEW ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* CEFR Proficiency Card */}
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden space-y-6 ${
            isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br ${currentCefr.color} text-white shadow-lg shrink-0 font-black text-2xl`}>
                  {currentCefr.code}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className={`text-xl sm:text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                      Your English Level: <span className="text-[#6C63FF]">{englishLevelLabel}</span>
                    </h2>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-indigo-500/15 text-[#6C63FF] uppercase">
                      {englishLevelLabel}
                    </span>
                  </div>
                  <p className={`text-xs font-medium max-w-md ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {currentCefr.desc}
                  </p>
                </div>

              </div>

              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl border text-center min-w-[110px] ${
                  isDark ? "bg-slate-800/60 border-white/10" : "bg-slate-50 border-slate-200"
                }`}>
                  <p className="text-xl font-black text-amber-500">{xp} ⭐</p>
                  <p className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Total XP</p>
                </div>
                <div className={`p-4 rounded-2xl border text-center min-w-[110px] ${
                  isDark ? "bg-slate-800/60 border-white/10" : "bg-slate-50 border-slate-200"
                }`}>
                  <p className="text-xl font-black text-emerald-500">{accuracy}%</p>
                  <p className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Accuracy</p>
                </div>
              </div>
            </div>

            {/* Level XP Progress */}
            <div className={`space-y-2 pt-4 border-t ${isDark ? "border-white/10" : "border-slate-100"}`}>
              <div className="flex items-center justify-between text-xs font-black">
                <span className={isDark ? "text-slate-300" : "text-slate-700"}>
                  Level Progress: Current XP: <strong>{xp}</strong> (XP to next level: <strong>{xpToNextLevel}</strong>)
                </span>
                <span className="text-[#6C63FF]">{levelPercentage.toFixed(0)}%</span>
              </div>
              <div className={`h-3 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                <div
                  className="h-full bg-gradient-to-r from-[#6C63FF] via-indigo-500 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${levelPercentage}%` }}
                />
              </div>
              <p className={`text-[11px] font-semibold text-right ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {xpToNextLevel} XP remaining to Level {level + 1}
              </p>
            </div>

            {nextCefr && (
              <div className={`space-y-2 pt-4 border-t ${isDark ? "border-white/10" : "border-slate-100"}`}>
                <div className="flex items-center justify-between text-xs font-black">
                  <span className={isDark ? "text-slate-300" : "text-slate-700"}>
                    Next Target Milestone: <strong>{nextCefr.code} ({nextCefr.name})</strong>
                  </span>
                  <span className="text-[#6C63FF]">{cefrProgress.toFixed(0)}%</span>
                </div>
                <div className={`h-3 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 transition-all duration-500 rounded-full"
                    style={{ width: `${cefrProgress}%` }}
                  />
                </div>
                <p className={`text-[11px] font-semibold text-right ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Earn {Math.max(0, currentCefr.maxXp - xp)} more XP to unlock {nextCefr.code} Mastery Badge
                </p>
              </div>
            )}
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border shadow-sm space-y-1 ${
              isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
            }`}>
              <span className="text-2xl">🔥</span>
              <p className="text-xl font-black text-[#F97316]">{streak} Days</p>
              <p className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Current Streak</p>
              <p className={`text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Best: {longestStreak} days</p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-sm space-y-1 ${
              isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
            }`}>
              <span className="text-2xl">🛡️</span>
              <p className="text-xl font-black text-cyan-500">Shield Active</p>
              <p className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Streak Freeze</p>
              <p className={`text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Protects your rhythm</p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-sm space-y-1 ${
              isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
            }`}>
              <span className="text-2xl">⏱️</span>
              <p className="text-xl font-black text-indigo-500">{totalHours} Hours</p>
              <p className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Total Speaking Time</p>
              <p className={`text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{speakingSessions} sessions done</p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-sm space-y-1 ${
              isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
            }`}>
              <span className="text-2xl">📚</span>
              <p className="text-xl font-black text-emerald-500">{wordsLearned} Words</p>
              <p className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Word Bank Lexicon</p>
              <p className={`text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{grammarExercises} grammar checks</p>
            </div>
          </div>

          {/* 6-Dimensional Skill Breakdown Matrix */}
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
            isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
          }`}>
            <div>
              <h3 className={`text-lg sm:text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Core English Competencies & Fluency Matrix
              </h3>
              <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Real-time assessment across your speaking rhythm, lexical complexity, and grammar precision.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {skillMatrix.map((skill, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50 border-slate-200/90"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{skill.icon}</span>
                      <h4 className={`text-xs sm:text-sm font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {skill.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        isDark ? "bg-slate-800 border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                      }`}>
                        {skill.status}
                      </span>
                      <span className={`text-xs sm:text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                        {skill.score}%
                      </span>
                    </div>
                  </div>

                  <div className={`h-2 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                    <div
                      className={`h-full bg-gradient-to-r ${skill.color} rounded-full transition-all duration-500`}
                      style={{ width: `${skill.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Module Engagement Distribution */}
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-4 ${
            isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
          }`}>
            <h3 className={`text-base sm:text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>
              📦 Module Activity Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className={`p-4 rounded-2xl border text-center ${isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                <span className="text-2xl">🎙️</span>
                <p className="text-lg font-black text-[#6C63FF] mt-1">{speakingSessions}</p>
                <p className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}>Speaking Studios</p>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                <span className="text-2xl">💬</span>
                <p className="text-lg font-black text-indigo-400 mt-1">{chatMessages || 12}</p>
                <p className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}>AI Chat Turns</p>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                <span className="text-2xl">📝</span>
                <p className="text-lg font-black text-emerald-500 mt-1">{grammarExercises}</p>
                <p className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}>Grammar Checks</p>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                <span className="text-2xl">💡</span>
                <p className="text-lg font-black text-amber-500 mt-1">{wordsLearned}</p>
                <p className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}>Vocab Flashcards</p>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? "bg-slate-800/40 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                <span className="text-2xl">📖</span>
                <p className="text-lg font-black text-pink-500 mt-1">{completedLessons}</p>
                <p className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}>Lessons Done</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE FLUENCY ASSESSMENT STUDIO ── */}
      {activeTab === "fluency" && (
        <div className="space-y-6">
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
            isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-default)]">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#6C63FF] bg-[#6C63FF]/10 px-3 py-1 rounded-full">
                  ⚡ Speech Diagnostic
                </span>
                <h2 className={`text-xl sm:text-2xl font-black mt-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Live Fluency & Speech Rate Diagnostic
                </h2>
                <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Select a topic, speak for 20–45 seconds, and receive an instant breakdown of your WPM pace, filler words, and CEFR speaking index.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  🎯 Target Pace: 120-160 WPM
                </span>
              </div>
            </div>

            {/* Prompt Selector */}
            <div className="space-y-3">
              <span className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Choose Speaking Topic Prompt:
              </span>
              <div className="grid sm:grid-cols-3 gap-3">
                {FLUENCY_PROMPTS.map((p) => {
                  const isSelected = selectedPrompt.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPrompt(p);
                        setFluencyReport(null);
                        setTranscript("");
                      }}
                      className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#6C63FF] text-white border-[#6C63FF] shadow-lg shadow-[#6C63FF]/25 scale-102"
                          : isDark
                          ? "bg-slate-800/60 text-slate-200 border-white/10 hover:border-[#6C63FF]/50"
                          : "bg-slate-50 text-slate-800 border-slate-200 hover:border-[#6C63FF]/50"
                      }`}
                    >
                      <h4 className="text-xs font-black">{p.title}</h4>
                      <p className={`text-[11px] mt-1 line-clamp-2 ${isSelected ? "text-indigo-100" : isDark ? "text-slate-400" : "text-slate-600"}`}>
                        {p.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speaking Stage Card */}
            <div className={`p-6 sm:p-8 rounded-3xl border text-center space-y-6 ${
              isDark ? "bg-slate-900/60 border-white/10" : "bg-indigo-50/50 border-indigo-100"
            }`}>
              <div className="max-w-xl mx-auto space-y-2">
                <span className="text-xs font-black text-[#6C63FF] uppercase tracking-wider">
                  Active Challenge Prompt:
                </span>
                <h3 className={`text-base sm:text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                  "{selectedPrompt.desc}"
                </h3>
              </div>

              {/* Recording Controls */}
              <div className="flex flex-col items-center justify-center gap-4">
                <button
                  onClick={isRecording ? stopFluencyRecording : startFluencyRecording}
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl cursor-pointer active:scale-95 ${
                    isRecording
                      ? "bg-rose-500 text-white animate-pulse shadow-rose-500/50 scale-105"
                      : "bg-gradient-to-tr from-[#6C63FF] to-[#8B5CF6] text-white shadow-[#6C63FF]/40 hover:scale-105"
                  }`}
                >
                  <span className="text-3xl">{isRecording ? "⏹️" : "🎙️"}</span>
                  <span className="text-[10px] font-black uppercase mt-1">
                    {isRecording ? "Analyze Now" : "Start Test"}
                  </span>
                </button>

                {isRecording && (
                  <div className="space-y-1 animate-in fade-in">
                    <p className="text-sm font-black text-rose-500 flex items-center gap-2 justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      Recording Speech: {recordingSeconds}s
                    </p>
                    <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      Speak freely — auto-analyzes when you finish speaking, or tap to analyze immediately.
                    </p>
                  </div>
                )}
              </div>

              {/* Live Transcript Preview */}
              {transcript && (
                <div className={`p-4 rounded-2xl border text-left max-w-2xl mx-auto space-y-1.5 ${
                  isDark ? "bg-slate-800/80 border-white/10" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  <span className="text-[10px] font-black uppercase text-[#6C63FF] tracking-wider">
                    Live Captured Speech:
                  </span>
                  <p className={`text-xs sm:text-sm font-semibold italic ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    "{transcript}"
                  </p>
                </div>
              )}
            </div>

            {/* Analyzing Indicator */}
            {analyzingFluency && (
              <div className="p-8 text-center space-y-3">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#6C63FF] border-t-transparent" />
                <p className="text-xs font-black text-[#6C63FF] uppercase tracking-wider">
                  Analyzing speech rhythm, pace, and vocabulary diversity...
                </p>
              </div>
            )}

            {/* Generated Diagnostic Report */}
            {fluencyReport && !analyzingFluency && (
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 animate-in slide-in-from-bottom-3 ${
                isDark ? "bg-slate-800/60 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border-default)]">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🏆</span>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black">
                        Fluency Diagnostic Report
                      </h3>
                      <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        Estimated Level: <strong className="text-[#6C63FF]">{fluencyReport.evaluatedCefr}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => speakGlobalText(fluencyReport.recommendation)}
                      className="px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-xs font-black shadow-md hover:bg-[#5a52e0] transition-all"
                    >
                      🔊 Listen Coach Feedback
                    </button>
                  </div>
                </div>

                {/* 4 Score Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-4 rounded-2xl border text-center ${
                    isDark ? "bg-slate-900/60 border-white/10" : "bg-slate-50 border-slate-200"
                  }`}>
                    <p className="text-2xl font-black text-[#6C63FF]">{fluencyReport.wpm}</p>
                    <p className={`text-[10px] font-bold uppercase mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Words / Min (WPM)</p>
                    <span className={`text-[10px] font-black ${fluencyReport.paceColor}`}>{fluencyReport.paceCategory}</span>
                  </div>

                  <div className={`p-4 rounded-2xl border text-center ${
                    isDark ? "bg-slate-900/60 border-white/10" : "bg-slate-50 border-slate-200"
                  }`}>
                    <p className="text-2xl font-black text-emerald-500">{fluencyReport.fluencyScore}%</p>
                    <p className={`text-[10px] font-bold uppercase mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Fluency Index</p>
                    <span className="text-[10px] font-black text-emerald-500">Smooth Rhythm</span>
                  </div>

                  <div className={`p-4 rounded-2xl border text-center ${
                    isDark ? "bg-slate-900/60 border-white/10" : "bg-slate-50 border-slate-200"
                  }`}>
                    <p className="text-2xl font-black text-amber-500">{fluencyReport.fillerCount}</p>
                    <p className={`text-[10px] font-bold uppercase mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Filler Words</p>
                    <span className="text-[10px] font-black text-amber-500">{fluencyReport.fillerCount === 0 ? "Flawless" : "Needs Silence"}</span>
                  </div>

                  <div className={`p-4 rounded-2xl border text-center ${
                    isDark ? "bg-slate-900/60 border-white/10" : "bg-slate-50 border-slate-200"
                  }`}>
                    <p className="text-2xl font-black text-cyan-500">{fluencyReport.lexicalDiversity}%</p>
                    <p className={`text-[10px] font-bold uppercase mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Vocabulary Diversity</p>
                    <span className="text-[10px] font-black text-cyan-500">Rich Lexicon</span>
                  </div>
                </div>

                {/* AI Coach Actionable Advice */}
                <div className={`p-4 sm:p-5 rounded-2xl border space-y-1.5 ${
                  isDark ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-200" : "bg-indigo-50 border-indigo-200 text-[#1E1B4B]"
                }`}>
                  <span className="text-xs font-black uppercase text-[#6C63FF] tracking-wider flex items-center gap-1.5">
                    <span>💡</span> Actionable AI Coach Recommendation:
                  </span>
                  <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                    {fluencyReport.recommendation}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: CEFR MASTERY ROADMAP ── */}
      {activeTab === "roadmap" && (
        <div className="space-y-6">
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
            isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
          }`}>
            <div>
              <h3 className={`text-lg sm:text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                🗺️ CEFR Spoken Fluency Mastery Roadmap
              </h3>
              <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                International standard progression ladder from Beginner (A1) to Native-level Mastery (C2).
              </p>
            </div>

            <div className="grid gap-4">
              {CEFR_LEVELS.map((tier, idx) => {
                const isCurrent = currentCefr.code === tier.code;
                const isUnlocked = xp >= tier.minXp;
                return (
                  <div
                    key={tier.code}
                    className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isCurrent
                        ? "border-[#6C63FF] bg-[#6C63FF]/10 shadow-lg shadow-[#6C63FF]/10 scale-101"
                        : isUnlocked
                        ? isDark
                          ? "bg-slate-800/40 border-white/10"
                          : "bg-slate-50 border-slate-200"
                        : isDark
                        ? "bg-slate-900/40 border-white/5 opacity-60"
                        : "bg-slate-100/60 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${tier.color} text-white font-black text-xl flex items-center justify-center shadow-md shrink-0`}>
                        {tier.code}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                            {tier.name} Tier
                          </h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-black uppercase">
                              Active Tier
                            </span>
                          )}
                          {isUnlocked && !isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-black">
                              ✅ Unlocked
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-medium max-w-xl ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                          {tier.desc}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-xs font-extrabold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        XP Requirement:
                      </span>
                      <p className="text-sm font-black text-[#6C63FF]">
                        {tier.minXp} – {tier.maxXp} XP
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: PRACTICE RHYTHM & HABIT TRACKER ── */}
      {activeTab === "rhythm" && (
        <div className="space-y-6">
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
            isDark ? "bg-[#131B2B] border-white/10" : "bg-white border-slate-200"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className={`text-lg sm:text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                  Weekly Practice Rhythm & Habits ({totalRhythmMinutes} mins)
                </h3>
                <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  7-Day practice minutes compared against your 20m daily target (Monday – Sunday).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  🎯 Daily Target: 20m
                </span>
                <span className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Mon – Sun
                </span>
              </div>
            </div>

            {/* 7-Day Habit & Rhythm Bar Chart */}
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pt-6 px-2">
              {activeRhythmData.map((d, i) => {
                const mins = d.studyMinutes || 0;
                const heightPct = Math.max(mins > 0 ? 12 : 4, (mins / maxMins) * 100);
                const isGoalMet = mins >= 20;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group relative">
                    <div className={`text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all absolute -top-1 pointer-events-none z-10 px-2 py-0.5 rounded shadow ${
                      isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-800 border"
                    }`}>
                      {mins}m {d.speakingSessions > 0 ? `• ${d.speakingSessions} speaks` : ""}
                    </div>
                    <div className={`w-full max-w-[40px] rounded-xl h-28 flex items-end p-1 border ${
                      isDark ? "bg-slate-800/80 border-white/10" : "bg-slate-100 border-slate-200"
                    }`}>
                      <div
                        className={`w-full rounded-lg transition-all duration-500 shadow-sm ${
                          isGoalMet
                            ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-emerald-500/30"
                            : mins > 0
                            ? "bg-gradient-to-t from-[#6C63FF] to-indigo-400 shadow-[#6C63FF]/30"
                            : isDark ? "bg-slate-700/30" : "bg-slate-200"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {d.day || (d.date ? d.date.slice(5) : `D${i + 1}`)}
                    </span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default Progress;
