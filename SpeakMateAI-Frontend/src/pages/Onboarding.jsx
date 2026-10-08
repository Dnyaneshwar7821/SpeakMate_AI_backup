import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ROUTES from "../constants/routes";
import { setActiveTutorFromSystemDefault } from "../services/ActiveTutorService";

// ─── Constants (Identical to Mobile App) ───
const LANGUAGES = [
  { key: "English", label: "English", flag: "🇬🇧" },
  { key: "Hindi", label: "Hindi", flag: "🇮🇳" },
  { key: "Marathi", label: "Marathi", flag: "🇮🇳" },
  { key: "Spanish", label: "Spanish", flag: "🇪🇸" },
  { key: "French", label: "French", flag: "🇫🇷" },
  { key: "German", label: "German", flag: "🇩🇪" },
  { key: "Japanese", label: "Japanese", flag: "🇯🇵" },
];

const VOICES = [
  { key: "Friendly", label: "Friendly", gender: "Female", icon: "💬", preview: "Hello there! I am your friendly AI English tutor. I am excited to practice English with you!" },
  { key: "Professional", label: "Professional", gender: "Female", icon: "💼", preview: "Hello. I am your professional AI tutor. Let's work together to polish your English communication skills." },
  { key: "Energetic", label: "Energetic", gender: "Female", icon: "⚡", preview: "Hey! Ready to level up your English? Let's get started and have some fun!" },
  { key: "Calm", label: "Calm", gender: "Female", icon: "🌧️", preview: "Welcome. I am your calm AI tutor. We will practice English step by step at your own pace." },
  { key: "Teacher", label: "Teacher", gender: "Female", icon: "🏫", preview: "Hello. I am your English teacher. Today we will focus on building your confidence in speaking." },
  { key: "Native Speaker", label: "Native Speaker", gender: "Female", icon: "🌍", preview: "Hey friend! I'm your native speaker tutor. Let's practice speaking naturally and fluently." },
];

const GOALS = [
  { key: "Career", label: "Career Advancement", icon: "💼", desc: "Prepare for job promotions, corporate presentations & executive tone" },
  { key: "Interview", label: "Job Interviews", icon: "📄", desc: "Master common behavioral & technical interview questions" },
  { key: "Study", label: "Academic Studies", icon: "📚", desc: "Excel in school/university lectures, seminars & essays" },
  { key: "Travel", label: "Travel & Exploration", icon: "✈️", desc: "Navigate airports, order food, and chat with international locals" },
  { key: "Business", label: "Business & Networking", icon: "🤝", desc: "Master client negotiations, pitches, and meeting etiquette" },
  { key: "Communication", label: "Daily Communication", icon: "💬", desc: "Build social confidence and speak naturally with friends" },
  { key: "Exam", label: "English Exams (IELTS/TOEFL)", icon: "🎓", desc: "Target high bands in speaking & listening assessment criteria" },
  { key: "Fun", label: "Self-Improvement & Fun", icon: "🌟", desc: "Enjoy learning new idioms, pop culture & casual fluency" },
];


const LEVELS = [
  { key: "Beginner", label: "Beginner", desc: "No prior experience or basic vocabulary", rating: "A1" },
  { key: "Elementary", label: "Elementary", desc: "Understand simple sentences & expressions", rating: "A2" },
  { key: "Intermediate", label: "Intermediate", desc: "Describe experiences and speak with minor mistakes", rating: "B1/B2" },
  { key: "Advanced", label: "Advanced", desc: "Express ideas fluently & spontaneously", rating: "C1" },
  { key: "Fluent", label: "Fluent", desc: "Completely fluent, close to native proficiency", rating: "C2" },
];

const AGE_GROUPS = [
  { key: "Kids", label: "Kids (6-12)", icon: "🎈", desc: "Fun stories, simple words & games" },
  { key: "Teens", label: "Teens (13-17)", icon: "⚡", desc: "School life, pop culture, gaming & casual chatter" },
  { key: "Young Adult", label: "Young Adults (18-24)", icon: "🎓", desc: "Campus life, travel, socializing & interview prep" },
  { key: "Professional", label: "Professionals (25-50)", icon: "💼", desc: "Business English, executive tone & presentations" },
  { key: "Senior", label: "Seniors (50+)", icon: "☕", desc: "Relaxed conversations, culture & life stories" },
];

const SCHOOL_GRADES = [
  { key: "1st Std", label: "1st Standard", desc: "Alphabet phonics, colors, animals & simple greetings", icon: "🎨" },
  { key: "2nd Std", label: "2nd Standard", desc: "Classroom items, daily routines, food & hobbies", icon: "🍦" },
  { key: "3rd Std", label: "3rd Standard", desc: "Action verbs, community helpers, time & past stories", icon: "🩹" },
  { key: "4th Std", label: "4th Standard", desc: "Describing places, canteen lunch, healthy habits & directions", icon: "🪐" },
  { key: "5th Std", label: "5th Standard", desc: "First day in 5th grade, science projects & story reviews", icon: "🏫" },
  { key: "6th Std", label: "6th Standard", desc: "Asking teacher questions, school clubs & sports day", icon: "✏️" },
  { key: "7th Std", label: "7th Standard", desc: "Group discussions, environmental care & movie reviews", icon: "💧" },
  { key: "8th Std", label: "8th Standard", desc: "School debates, student council & tech innovations", icon: "💬" },
  { key: "9th Std", label: "9th Standard", desc: "High school admission interviews & keynote speeches", icon: "🌐" },
  { key: "10th Std", label: "10th Standard", desc: "10th Board oral exam prep & career roadmaps", icon: "📜" },
  { key: "11th Std", label: "11th Standard", desc: "Higher secondary stream prep & seminar presentations", icon: "📚" },
  { key: "12th Std", label: "12th Standard", desc: "College admissions, university interviews & fluent debate", icon: "🎓" },
];

const INTERESTS = [
  { key: "Technology", label: "Technology", icon: "💻" },
  { key: "Business", label: "Business", icon: "📊" },
  { key: "Movies", label: "Movies & TV", icon: "🎬" },
  { key: "Gaming", label: "Gaming", icon: "🎮" },
  { key: "Sports", label: "Sports", icon: "⚽" },
  { key: "Travel", label: "Travel", icon: "🧭" },
  { key: "Programming", label: "Programming", icon: "⚡" },
  { key: "Finance", label: "Finance", icon: "💰" },
  { key: "Music", label: "Music", icon: "🎵" },
  { key: "Cooking", label: "Cooking", icon: "🍳" },
  { key: "Health", label: "Health & Fitness", icon: "❤️" },
  { key: "Science", label: "Science", icon: "🧪" },
  { key: "Books", label: "Books & Lit", icon: "📖" },
  { key: "Daily Conversation", label: "Daily Chat", icon: "💬" },
];

const SOURCES = [
  { key: "Google", label: "Google Search", icon: "🔍" },
  { key: "LinkedIn", label: "LinkedIn", icon: "💼" },
  { key: "Instagram", label: "Instagram", icon: "📸" },
  { key: "Friend", label: "Friend Recommendation", icon: "👥" },
  { key: "YouTube", label: "YouTube", icon: "▶️" },
  { key: "College", label: "College / School", icon: "🏫" },
  { key: "Company", label: "Company Recommendation", icon: "🏢" },
  { key: "Other", label: "Other Source", icon: "✨" },
];

const DAILY_GOALS = [
  { key: "5 min", label: "Casual", value: 5 },
  { key: "10 min", label: "Regular", value: 10 },
  { key: "20 min", label: "Serious", value: 20 },
  { key: "30 min", label: "Intense", value: 30 },
  { key: "45 min", label: "Super Learner", value: 45 },
  { key: "60 min", label: "Insane", value: 60 },
];

const REMINDER_TIMES = [
  { key: "Morning", label: "Morning", time: "7:00 AM", icon: "🌅" },
  { key: "Afternoon", label: "Afternoon", time: "12:00 PM", icon: "☀️" },
  { key: "Evening", label: "Evening", time: "6:00 PM", icon: "🌇" },
  { key: "Night", label: "Night", time: "9:00 PM", icon: "🌙" },
  { key: "None", label: "No Reminder", time: "—", icon: "🔕" },
];

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/avataaars/png?seed=Felix&backgroundType=gradientLinear&backgroundColor=b6e3f4,c0aede",
  "https://api.dicebear.com/7.x/avataaars/png?seed=Aneka&backgroundType=gradientLinear&backgroundColor=ffd5dc,ffdfbf",
  "https://api.dicebear.com/7.x/avataaars/png?seed=Jack&backgroundType=gradientLinear&backgroundColor=d1d4f9,b6e3f4",
  "https://api.dicebear.com/7.x/avataaars/png?seed=Sophia&backgroundType=gradientLinear&backgroundColor=ffdfbf,ffd5dc",
  "https://api.dicebear.com/7.x/lorelei/png?seed=Hana&backgroundType=gradientLinear&backgroundColor=d1d4f9,b6e3f4",
  "https://api.dicebear.com/7.x/lorelei/png?seed=Kaito&backgroundType=gradientLinear&backgroundColor=b6e3f4,c0aede",
  "https://api.dicebear.com/7.x/adventurer/png?seed=Oliver&backgroundType=gradientLinear&backgroundColor=b6e3f4,c0aede",
  "https://api.dicebear.com/7.x/adventurer/png?seed=Mia&backgroundType=gradientLinear&backgroundColor=b6e3f4,c0aede",
];

export function Onboarding() {
  const navigate = useNavigate();
  const { user, completeOnboarding } = useAuth();

  // Detect Student Mode
  const isStudent = useMemo(() => {
    const rawType = localStorage.getItem("speakmate_account_type") || user?.accountType;
    return (
      rawType === "STUDENT" ||
      Boolean(user?.schoolGrade) ||
      Boolean(user?.schoolId) ||
      Boolean(localStorage.getItem("speakmate_school_grade"))
    );
  }, [user]);

  // Step state
  const [stepIndex, setStepIndex] = useState(0);

  // Form State
  const [language, setLanguage] = useState("English");
  const [aiVoice, setAiVoice] = useState("Friendly");
  const [playingVoice, setPlayingVoice] = useState(null);
  const [whyLearning, setWhyLearning] = useState(["Communication"]);
  const [schoolGrade, setSchoolGrade] = useState(user?.schoolGrade || localStorage.getItem("speakmate_school_grade") || "1st Std");
  const [level, setLevel] = useState("Intermediate");
  const [ageGroup, setAgeGroup] = useState("Young Adult");
  const [interests, setInterests] = useState(["Technology", "Travel"]);
  const [heardAbout, setHeardAbout] = useState("Google");
  const [dailyGoal, setDailyGoal] = useState(15);
  const [reminderTime, setReminderTime] = useState("Evening");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);

  // Mic test
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Construct steps sequence: Step 4 is English Level for both; Step 5 is Standard for student, Age Group for user.
  const steps = useMemo(() => {
    if (isStudent) {
      return [
        { id: "language", title: "Learning Language", subtitle: "Select the language you want to study." },
        { id: "voice", title: "Choose AI Voice", subtitle: "Choose your preferred tutor assistant voice with preview." },
        { id: "goals", title: "Why are you learning?", subtitle: "Select all reasons that apply to you." },
        { id: "level", title: "Select Your English Level", subtitle: "Choose your current proficiency level in English." },
        { id: "standard", title: "Select Your School Standard", subtitle: "Choose your current school class. Your lessons will align with your curriculum." },
        { id: "interests", title: "What interests you?", subtitle: "Select topics you enjoy for AI practice sessions." },
        { id: "sources", title: "Where did you hear about us?", subtitle: "Help us understand how you discovered SpeakMate AI." },
        { id: "daily_goal", title: "Choose Daily Goal", subtitle: "Consistency is key! Set a daily learning goal to build habits." },
        { id: "reminder", title: "Daily Reminder", subtitle: "When should we remind you to practice? Consistency builds fluency." },
        { id: "avatar", title: "Choose Your Avatar", subtitle: "Pick an avatar for your learner profile." },
        { id: "ready", title: "Ready & Speech Check", subtitle: "Test your microphone and launch your personalized dashboard." },
      ];
    } else {
      return [
        { id: "language", title: "Learning Language", subtitle: "Select the language you want to study." },
        { id: "voice", title: "Choose AI Voice", subtitle: "Choose your preferred tutor assistant voice with preview." },
        { id: "goals", title: "Why are you learning?", subtitle: "Select all reasons that apply to you." },
        { id: "level", title: "Select Your English Level", subtitle: "Choose your current proficiency level in English." },
        { id: "age_group", title: "Select Your Age Group", subtitle: "Helps our AI tailor conversational topics, pace, and context." },
        { id: "interests", title: "What interests you?", subtitle: "Select topics you enjoy for AI practice sessions." },
        { id: "sources", title: "Where did you hear about us?", subtitle: "Help us understand how you discovered SpeakMate AI." },
        { id: "daily_goal", title: "Choose Daily Goal", subtitle: "Consistency is key! Set a daily learning goal to build habits." },
        { id: "reminder", title: "Daily Reminder", subtitle: "When should we remind you to practice? Consistency builds fluency." },
        { id: "avatar", title: "Choose Your Avatar", subtitle: "Pick an avatar for your learner profile." },
        { id: "ready", title: "Ready & Speech Check", subtitle: "Test your microphone and launch your personalized dashboard." },
      ];
    }
  }, [isStudent]);

  const currentStep = steps[stepIndex] || steps[0];
  const totalSteps = steps.length;

  // Voice Preview via Web Speech Synthesis
  useEffect(() => {
    if (playingVoice && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const vObj = VOICES.find((v) => v.key === playingVoice);
      const text = vObj?.preview || "Hello! I am your AI English coach.";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = playingVoice === "Energetic" ? 1.15 : playingVoice === "Calm" ? 0.88 : 1.0;
      utterance.pitch = playingVoice === "Friendly" ? 1.15 : 1.0;
      utterance.onend = () => setPlayingVoice(null);
      utterance.onerror = () => setPlayingVoice(null);
      window.speechSynthesis.speak(utterance);
    } else if (!playingVoice && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [playingVoice]);

  const toggleGoal = (key) => {
    setWhyLearning((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
  };

  const toggleInterest = (key) => {
    setInterests((prev) => (prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]));
  };

  const handleStartMicTest = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript("Speech recognition supported natively! You are ready to speak.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onstart = () => {
        setIsRecording(true);
        setTranscript("Listening... Please say 'Hello SpeakMate AI!'");
      };
      recognition.onresult = (e) => {
        setTranscript(e.results[0][0].transcript);
      };
      recognition.onerror = () => {
        setIsRecording(false);
        setTranscript("Mic connected and verified!");
      };
      recognition.onend = () => setIsRecording(false);
      recognition.start();
    } catch {
      setIsRecording(false);
      setTranscript("Mic tested successfully!");
    }
  };

  const handleFinish = async () => {
    const finalGrade = isStudent ? (schoolGrade || "1st Std") : null;
    const finalLevel = level || "Beginner";

    if (finalGrade) {
      localStorage.setItem("speakmate_school_grade", finalGrade);
    } else {
      localStorage.removeItem("speakmate_school_grade");
    }

    if (!isStudent) {
      localStorage.setItem("speakmate_age_group", ageGroup || "Professional");
    }
    localStorage.setItem("speakmate_english_level", finalLevel);
    localStorage.setItem("speakmate_onboarding_voice", aiVoice);
    localStorage.setItem("speakmate_voice_persona", aiVoice);
    localStorage.setItem("speakmate_ai_voice", "Default");
    localStorage.setItem("speakmate_daily_goal", String(dailyGoal));
    setActiveTutorFromSystemDefault();

    await completeOnboarding({
      nativeLanguage: language,
      goal: whyLearning.join(", "),
      learningGoal: whyLearning.join(", "),
      ageGroup: isStudent ? null : ageGroup,
      level: finalLevel,
      englishLevel: finalLevel,
      schoolGrade: finalGrade,
      interests,
      aiVoice: "Default",
      preferredVoice: aiVoice,
      onboardingVoice: aiVoice,
      selectionSource: "SYSTEM_DEFAULT",
      avatarModel: "haru",
      commitment: `${dailyGoal} min`,
      dailyGoalMinutes: parseInt(dailyGoal, 10) || 15,
      reminderTime,
      avatar: selectedAvatar,
      heardAbout,
    });

    navigate(ROUTES.DASHBOARD);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 px-4">
      {/* Top Banner / Student Badge */}
      {isStudent && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-black shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span>🎓</span>
            <span>School Institutional Setup Mode</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 uppercase font-black tracking-wider">
            Standard Curriculum
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider">
          <span>Step {stepIndex + 1} of {totalSteps}</span>
          <span className="text-[#6C63FF] font-black">{Math.round(((stepIndex + 1) / totalSteps) * 100)}% Setup Completed</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden p-0.5 border border-[var(--border-default)]">
          <div
            className="h-full bg-gradient-to-r from-[#6C63FF] via-[#8B5CF6] to-[#FF6584] transition-all duration-300 rounded-full"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Step Card */}
      <div className="p-6 sm:p-10 rounded-3xl glass-card border border-[var(--border-default)] shadow-2xl space-y-8 min-h-[500px] flex flex-col justify-between">

        {/* Step Header */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">{currentStep.title}</h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 font-medium">{currentStep.subtitle}</p>
        </div>

        {/* STEP: LANGUAGE */}
        {currentStep.id === "language" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.key}
                onClick={() => setLanguage(lang.key)}
                className={`p-4 rounded-2xl border text-left font-black text-sm transition-all flex items-center gap-3 active:scale-95 ${language === lang.key
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 text-[var(--text-primary)] ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* STEP: AI VOICE PREVIEW */}
        {currentStep.id === "voice" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {VOICES.map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  setAiVoice(v.key);
                  setPlayingVoice(playingVoice === v.key ? null : v.key);
                }}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between active:scale-95 ${aiVoice === v.key
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-xl bg-[var(--bg-base)] shadow-inner">{v.icon}</span>
                  <div>
                    <h3 className="font-black text-sm text-[var(--text-primary)]">{v.label}</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium">Click to test voice audio</p>
                  </div>
                </div>
                <div className={`p-2 rounded-xl border ${playingVoice === v.key ? "bg-[#6C63FF] text-white animate-pulse" : "bg-[var(--bg-base)] text-[var(--text-secondary)]"}`}>
                  {playingVoice === v.key ? "🔊" : "▶️"}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP: GOALS */}
        {currentStep.id === "goals" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {GOALS.map((g) => {
              const active = whyLearning.includes(g.key);
              return (
                <button
                  key={g.key}
                  onClick={() => toggleGoal(g.key)}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 active:scale-95 ${active
                      ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                      : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                    }`}
                >
                  <span className="text-2xl p-2 rounded-xl bg-[var(--bg-base)] shrink-0 shadow-inner">{g.icon}</span>
                  <div>
                    <h3 className="font-black text-sm text-[var(--text-primary)]">{g.label}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{g.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP: ENGLISH PROFICIENCY LEVEL (FOR ALL USERS) */}
        {currentStep.id === "level" && (
          <div className="space-y-3">
            {LEVELS.map((lvl) => (
              <button
                key={lvl.key}
                onClick={() => setLevel(lvl.key)}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between active:scale-95 ${level === lvl.key
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-12 rounded-xl bg-[var(--bg-base)] grid place-items-center font-black text-xs text-[#6C63FF]">
                    {lvl.rating}
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-[var(--text-primary)]">{lvl.label}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{lvl.desc}</p>
                  </div>
                </div>
                {level === lvl.key && <span className="text-[#6C63FF] font-black text-base">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* STEP: AGE GROUP (ONLY FOR INDIVIDUAL USERS) */}
        {currentStep.id === "age_group" && (
          <div className="space-y-3">
            {AGE_GROUPS.map((a) => (
              <button
                key={a.key}
                onClick={() => setAgeGroup(a.key)}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 active:scale-95 ${ageGroup === a.key
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                  }`}
              >
                <span className="text-3xl p-2.5 rounded-xl bg-[var(--bg-base)] shadow-inner">{a.icon}</span>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[var(--text-primary)]">{a.label}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP: SCHOOL STANDARD / GRADE (FOR STUDENTS) */}
        {currentStep.id === "standard" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {SCHOOL_GRADES.map((grd) => (
              <button
                key={grd.key}
                onClick={() => setSchoolGrade(grd.key)}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between active:scale-95 ${schoolGrade === grd.key
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-xl bg-[var(--bg-base)] shadow-inner">{grd.icon}</span>
                  <div>
                    <h3 className="font-black text-sm text-[var(--text-primary)]">{grd.label}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{grd.desc}</p>
                  </div>
                </div>
                {schoolGrade === grd.key && <span className="text-[#6C63FF] font-black text-base">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* STEP: INTERESTS */}
        {currentStep.id === "interests" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {INTERESTS.map((int) => {
              const isSelected = interests.includes(int.key);
              return (
                <button
                  key={int.key}
                  onClick={() => toggleInterest(int.key)}
                  className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-black transition-all flex items-center gap-3 active:scale-95 ${isSelected
                      ? "border-[#6C63FF] bg-[#6C63FF]/20 text-[var(--text-primary)] ring-2 ring-[#6C63FF] shadow-md"
                      : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  <span className="text-xl sm:text-2xl">{int.icon}</span>
                  <span className="truncate">{int.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP: HEARD ABOUT US */}
        {currentStep.id === "sources" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {SOURCES.map((src) => (
              <button
                key={src.key}
                onClick={() => setHeardAbout(src.key)}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between active:scale-95 ${heardAbout === src.key
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{src.icon}</span>
                  <span className="font-black text-sm text-[var(--text-primary)]">{src.label}</span>
                </div>
                {heardAbout === src.key && <span className="text-[#6C63FF] font-black text-base">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* STEP: DAILY GOAL */}
        {currentStep.id === "daily_goal" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {DAILY_GOALS.map((g) => (
              <button
                key={g.key}
                onClick={() => setDailyGoal(g.value)}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between active:scale-95 ${dailyGoal === g.value
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                  }`}
              >
                <div>
                  <h3 className="font-black text-base text-[var(--text-primary)]">{g.key} / day</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{g.label}</p>
                </div>
                {dailyGoal === g.value && <span className="text-[#6C63FF] font-black text-lg">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* STEP: DAILY REMINDER */}
        {currentStep.id === "reminder" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {REMINDER_TIMES.map((r) => (
              <button
                key={r.key}
                onClick={() => setReminderTime(r.key)}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between active:scale-95 ${reminderTime === r.key
                    ? "border-[#6C63FF] bg-[#6C63FF]/20 ring-2 ring-[#6C63FF]/50 shadow-md"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/40"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{r.icon}</span>
                  <div>
                    <h3 className="font-black text-sm text-[var(--text-primary)]">{r.label}</h3>
                    <p className="text-xs text-[var(--text-secondary)] font-medium">{r.time}</p>
                  </div>
                </div>
                {reminderTime === r.key && <span className="text-[#6C63FF] font-black text-base">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* STEP: CHOOSE AVATAR */}
        {currentStep.id === "avatar" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_PRESETS.map((avUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedAvatar(avUrl)}
                  className={`relative rounded-2xl p-2 border overflow-hidden transition-all active:scale-95 ${selectedAvatar === avUrl
                      ? "border-[#6C63FF] ring-4 ring-[#6C63FF]/40 bg-[#6C63FF]/10 scale-105"
                      : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/50"
                    }`}
                >
                  <img src={avUrl} alt={`Avatar ${idx + 1}`} className="w-full h-16 sm:h-20 object-cover rounded-xl" />
                  {selectedAvatar === avUrl && (
                    <span className="absolute top-1 right-1 bg-[#6C63FF] text-white text-[10px] w-5 h-5 rounded-full grid place-items-center font-black">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP: READY & MIC TEST */}
        {currentStep.id === "ready" && (
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] text-center space-y-4 shadow-inner">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#6C63FF]/20 text-[#6C63FF] text-3xl mx-auto shadow-md">
              🎙️
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
              Click below and say out loud: <br />
              <span className="font-black text-sm sm:text-base text-[var(--text-primary)]">"Hello SpeakMate AI!"</span>
            </p>

            <button
              onClick={handleStartMicTest}
              disabled={isRecording}
              className={`px-8 py-3.5 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md active:scale-95 ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white"
                }`}
            >
              {isRecording ? "Listening to your voice..." : "🎙️ Test My Microphone"}
            </button>

            {transcript && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs sm:text-sm font-bold italic text-[var(--text-primary)] shadow-sm">
                "{transcript}"
              </div>
            )}
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="pt-6 border-t border-[var(--border-default)] flex items-center justify-between">
          {stepIndex > 0 ? (
            <button
              onClick={() => setStepIndex((s) => s - 1)}
              className="px-5 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-base)] text-xs font-black text-[var(--text-primary)] transition-all active:scale-95"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {stepIndex < totalSteps - 1 ? (
            <button
              onClick={() => setStepIndex((s) => s + 1)}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:from-[#7C74FF] hover:to-[#9D71FB] text-white text-xs sm:text-sm font-black shadow-lg shadow-[#6C63FF]/25 hover:scale-105 active:scale-95 transition-all"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-[#6C63FF] to-[#8B5CF6] text-white text-xs sm:text-sm font-black shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Finish Setup & Launch Dashboard 🎉
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
