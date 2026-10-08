import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { speakGlobalText, VOICE_PROFILES, VOICE_PERSONAS, ACCENT_LIST, resolveAvatarFromVoice } from "../utils/speechHelper";
import { EventBus, AVATAR_EVENTS } from "../services/live2d/EventBus";
import { settingsService, onboardingService, profileService } from "../services/appServices";
import { getAvatarById } from "../config/AvatarCatalog";
import { CurriculumCache } from "../utils/curriculumCache";
import { saveUserPreferenceField } from "../utils/userPreferences";
import {
  getActiveTutorSync,
  setActiveTutorFromRegional,
  setActiveTutorFromSystemDefault,
  formatActiveVoiceLabel,
  REGIONAL_VOICE_CODES,
  SELECTION_SOURCE,
} from "../services/ActiveTutorService";

const LANGUAGE_OPTIONS = [
  { code: "English", label: "English", native: "English", flag: "🇺🇸" },
];

const AGE_OPTIONS = [
  { code: "Kids", label: "Kids", ageRange: "Age 6–12", emoji: "🎈", badge: "Beginner Friendly", desc: "Simple words, fun stories & high encouragement" },
  { code: "Teens", label: "Teens", ageRange: "Age 13–17", emoji: "⚡", badge: "Casual & Dynamic", desc: "School life, pop culture & casual chatter" },
  { code: "Young Adult", label: "Young Adults", ageRange: "Age 18–24", emoji: "🎓", badge: "Campus & Career", desc: "Campus life, travel & interview prep" },
  { code: "Professional", label: "Professionals", ageRange: "Age 25–50", emoji: "💼", badge: "Executive Tone", desc: "Business English, executive tone & presentations" },
  { code: "Senior", label: "Seniors", ageRange: "Age 50+", emoji: "☕", badge: "Culture & Wisdom", desc: "Relaxed conversation, culture & life stories" },
];

const normalizeAgeGroup = (rawAge) => {
  if (!rawAge) return "Professional";
  const s = String(rawAge).toLowerCase();
  if (s.includes("kid")) return "Kids";
  if (s.includes("teen")) return "Teens";
  if (s.includes("young")) return "Young Adult";
  if (s.includes("senior")) return "Senior";
  if (s.includes("prof")) return "Professional";
  return "Professional";
};

export function Settings() {
  const toast = useToast();
  const { user, updateUser, completeOnboarding } = useAuth();

  const accountType = user?.accountType || user?.role || localStorage.getItem("speakmate_account_type") || "INDIVIDUAL";
  const isStudent = accountType === "STUDENT" || user?.role === "STUDENT" || Boolean(user?.isSchoolStudent) || Boolean(user?.schoolGrade) || Boolean(user?.standard) || Boolean(localStorage.getItem("speakmate_school_grade"));
  const schoolGrade = user?.schoolGrade || (user?.standard ? `${user.standard}th Std` : localStorage.getItem("speakmate_school_grade") || "1st Std");

  const [canonicalState, setCanonicalState] = useState(() => getActiveTutorSync());
  const [accent, setAccent] = useState(() => localStorage.getItem("speakmate_voice_accent") || "US");
  const [selectedVoice, setSelectedVoice] = useState(() => getActiveTutorSync().aiVoice);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(() => normalizeAgeGroup(user?.ageGroup || localStorage.getItem("speakmate_age_group") || "Professional"));
  const [dailyGoal, setDailyGoal] = useState(() => localStorage.getItem("speakmate_daily_goal") || "15 min");
  const [speechSpeed, setSpeechSpeed] = useState(() => parseFloat(localStorage.getItem("speakmate_voice_speed") || "1.0"));

  useEffect(() => {
    if (user?.ageGroup) {
      setSelectedAgeGroup(normalizeAgeGroup(user.ageGroup));
    }
  }, [user?.ageGroup]);

  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);

  const [reminders, setReminders] = useState(() => localStorage.getItem("speakmate_daily_reminder") !== "false");
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [soundEffects, setSoundEffects] = useState(() => localStorage.getItem("speakmate_sound_effects") !== "false");
  const [autoPlayAudio, setAutoPlayAudio] = useState(() => localStorage.getItem("speakmate_autoplay_audio") !== "false");

  const onboardingVoiceStyle =
    localStorage.getItem("speakmate_onboarding_voice") ||
    localStorage.getItem("speakmate_voice_persona") ||
    user?.preferredVoice ||
    "Friendly";

  const [currentModelKey, setCurrentModelKey] = useState(() => getActiveTutorSync().avatarModel);

  useEffect(() => {
    const handleTutorChanged = (e) => {
      const next = e?.detail || getActiveTutorSync();
      setCanonicalState(next);
      setCurrentModelKey(next.avatarModel);
      setSelectedVoice(next.aiVoice);
    };

    const unsub = EventBus.on(AVATAR_EVENTS.GENDER_CHANGED, (data) => {
      const next = getActiveTutorSync();
      setCanonicalState(next);
      const chosen = data?.model || next.avatarModel;
      setCurrentModelKey(chosen.toLowerCase());
      setSelectedVoice(next.aiVoice);
    });

    window.addEventListener("speakmate_tutor_changed", handleTutorChanged);

    return () => {
      unsub();
      window.removeEventListener("speakmate_tutor_changed", handleTutorChanged);
    };
  }, []);

  const activeAvatar = getAvatarById(currentModelKey);
  const isHaruOrChitose = currentModelKey === "haru" || currentModelKey === "chitose";

  const activeVoiceLabel = formatActiveVoiceLabel(
    selectedVoice,
    currentModelKey,
    canonicalState.selectionSource
  );

  const playVoicePreview = (voiceCode, previewMsg, modelOverride = null) => {
    const targetCode = voiceCode || selectedVoice || activeAvatar.voiceProfile;
    let textToSpeak = previewMsg;
    const profile = VOICE_PROFILES.find((p) => p.code.toLowerCase() === (targetCode || "").toLowerCase());

    if (profile) {
      textToSpeak = textToSpeak || profile.previewText;
    } else if (targetCode === "Default") {
      const personaObj = VOICE_PERSONAS.find((p) => p.key.toLowerCase() === (onboardingVoiceStyle || "").toLowerCase());
      textToSpeak = textToSpeak || personaObj?.previewText || `Hello! I am your System Default English tutor using the ${onboardingVoiceStyle} voice selected during onboarding.`;
    } else {
      textToSpeak = textToSpeak || `Hello! I am ${activeAvatar.name}. I am excited to practice English with you!`;
    }

    const effectiveModel = modelOverride || (targetCode && targetCode.toLowerCase().includes("male") && !targetCode.toLowerCase().includes("female") ? "chitose" : currentModelKey);

    setPlayingVoice(targetCode);
    speakGlobalText(textToSpeak, speechSpeed, {
      overrideVoiceCode: targetCode,
      avatarModel: effectiveModel,
      onend: () => setPlayingVoice(null),
      onerror: () => setPlayingVoice(null),
    });
  };

  const handleSelectAccent = (newAccent) => {
    setAccent(newAccent);
    localStorage.setItem("speakmate_voice_accent", newAccent);
    onboardingService.update({ preferredAccent: newAccent }).catch(() => {});
    if (updateUser) {
      updateUser({ preferredAccent: newAccent });
    }
    window.dispatchEvent(new CustomEvent("speakmate_settings_updated", { detail: { preferredAccent: newAccent } }));
    toast.success("Target accent updated ✓");
  };

  const handleSelectVoiceCode = (voiceCode, previewText) => {
    let nextTutor;
    if (voiceCode === "Default") {
      nextTutor = setActiveTutorFromSystemDefault();
    } else {
      nextTutor = setActiveTutorFromRegional(voiceCode);
    }

    setSelectedVoice(nextTutor.aiVoice);
    setCurrentModelKey(nextTutor.avatarModel);
    setCanonicalState(nextTutor);

    // Sync accent if selecting a regional profile
    let newAccent = null;
    const vLower = (voiceCode || "").toLowerCase();
    if (vLower.includes("us") || vLower.includes("american")) newAccent = "US";
    else if (vLower.includes("uk") || vLower.includes("british")) newAccent = "UK";
    else if (vLower.includes("au") || vLower.includes("australian")) newAccent = "AU";
    else if (vLower.includes("in") || vLower.includes("indian")) newAccent = "IN";

    if (newAccent) {
      setAccent(newAccent);
      localStorage.setItem("speakmate_voice_accent", newAccent);
      onboardingService.update({ preferredAccent: newAccent }).catch(() => {});
    }

    settingsService.update({ aiVoice: nextTutor.aiVoice }).catch(() => {});
    onboardingService.update({ preferredVoice: nextTutor.aiVoice }).catch(() => {});
    if (updateUser) {
      updateUser({
        preferredVoice: nextTutor.aiVoice,
        aiVoice: nextTutor.aiVoice,
        avatarModel: nextTutor.avatarModel,
        avatar: nextTutor.avatarModel,
        selectionSource: nextTutor.selectionSource,
        ...(newAccent ? { preferredAccent: newAccent } : {}),
      });
    }

    if (user?.email) {
      saveUserPreferenceField(user.email, 'avatarModel', nextTutor.avatarModel);
      saveUserPreferenceField(user.email, 'aiVoice', nextTutor.aiVoice);
      saveUserPreferenceField(user.email, 'selectionSource', nextTutor.selectionSource);
      saveUserPreferenceField(user.email, 'voiceGender', nextTutor.avatarModel === 'chitose' ? 'male' : 'female');
    }
    window.dispatchEvent(new CustomEvent("speakmate_settings_updated", {
      detail: { preferredVoice: nextTutor.aiVoice, aiVoice: nextTutor.aiVoice, ...(newAccent ? { preferredAccent: newAccent } : {}) }
    }));
    toast.success("AI tutor voice applied ✓");

    playVoicePreview(nextTutor.aiVoice, previewText, nextTutor.avatarModel);
  };

  const handleSelectSpeed = (spd) => {
    setSpeechSpeed(spd);
    localStorage.setItem("speakmate_voice_speed", String(spd));
    toast.success(`Tutor speech speed set to ${spd}x ✓`);
  };

  const handleSelectDailyGoal = (goal) => {
    setDailyGoal(goal);
    const mins = parseInt(goal, 10) || 15;
    localStorage.setItem("speakmate_daily_goal", String(mins));
    onboardingService.update({ dailyGoalMinutes: mins }).catch(() => {});
    window.dispatchEvent(new CustomEvent("speakmate_settings_updated", { detail: { dailyGoalMinutes: mins } }));
    window.dispatchEvent(new Event("speakmate_progress_updated"));
    toast.success(`Daily goal updated to ${goal} ✓`);
  };



  const handleSelectAgeGroup = (val) => {
    if (isStudent) {
      toast.info(`School Student Mode 🔒: Your target persona and curriculum are automatically managed according to your School Standard (${schoolGrade}).`);
      return;
    }
    setSelectedAgeGroup(val);
    localStorage.setItem("speakmate_age_group", val);
    onboardingService.update({ ageGroup: val }).catch(() => {});
    profileService.update({
      ageGroup: val,
      firstName: user?.firstName,
      lastName: user?.lastName,
      email: user?.email,
    }).catch(() => {});
    if (updateUser) {
      updateUser({ ageGroup: val });
    }
    CurriculumCache.clear();
    window.dispatchEvent(new CustomEvent("speakmate_age_group_changed", { detail: { ageGroup: val } }));
    window.dispatchEvent(new CustomEvent("speakmate_settings_updated", { detail: { ageGroup: val } }));
    window.dispatchEvent(new Event("speakmate_progress_updated"));
    toast.success(`Age profile updated to ${val} ✓`);
  };

  const handleOpenPersonaModal = () => {
    if (isStudent) {
      toast.info(`School Student Mode 🔒: Your target persona and learning curriculum are automatically managed according to your School Standard (${schoolGrade}).`);
      return;
    }
    setShowPersonaModal(true);
  };

  const handleToggleReminders = () => {
    const next = !reminders;
    setReminders(next);
    localStorage.setItem("speakmate_daily_reminder", String(next));
    settingsService.update({ dailyReminder: next, notificationsEnabled: next }).catch(() => {});
    toast.success(next ? "Practice reminders enabled ✓" : "Practice reminders disabled");
  };

  const handleToggleSoundEffects = () => {
    const next = !soundEffects;
    setSoundEffects(next);
    localStorage.setItem("speakmate_sound_effects", String(next));
    settingsService.update({ soundEffects: next }).catch(() => {});
    toast.success(next ? "Sound effects enabled ✓" : "Sound effects muted");
  };

  const handleToggleAutoPlay = () => {
    const next = !autoPlayAudio;
    setAutoPlayAudio(next);
    localStorage.setItem("speakmate_autoplay_audio", String(next));
    settingsService.update({ autoPlayAudio: next }).catch(() => {});
    window.dispatchEvent(new CustomEvent("speakmate_autoplay_changed", { detail: { autoPlayAudio: next } }));
    toast.success(next ? "Auto-play spoken audio enabled ✓" : "Auto-play audio disabled (Replay buttons still work)");
  };



  const studentPersona = useMemo(() => ({
    label: `School Student Standard`,
    ageRange: schoolGrade,
    emoji: "🎓",
    badge: "Curriculum Aligned",
    desc: `Auto-configured for ${schoolGrade}. All conversation scenarios, vocabulary, and grammar tests are aligned with your school curriculum.`,
  }), [schoolGrade]);

  const activePersona = isStudent
    ? studentPersona
    : (AGE_OPTIONS.find((a) => a.code === selectedAgeGroup) || AGE_OPTIONS[3]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 px-2 sm:px-4 lg:px-6 py-2">
      {/* Page Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">Application Settings</h1>
          <p className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] mt-0.5">
            Customize target accents, AI tutor voice pitch profiles, speaking pace, and practice goals.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-xs font-black shrink-0 self-start sm:self-auto shadow-sm">
          <span>⚡</span>
          <span>Changes auto-save instantly</span>
        </div>
      </div>

      {/* SECTION 2: TARGET ACCENT & VOICE SELECTION */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-6">
        <div className="border-b border-[var(--border-default)] pb-4">
          <h2 className="text-lg font-black text-[var(--text-primary)]">Target English Accent Profile</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
            Select your primary target accent region for AI speaking practice.
          </p>
        </div>

        {/* ACTIVE SPEAKING TUTOR STATUS CARD */}
        <div className="p-6 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-inner flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-[var(--bg-surface)] border-2 border-[#6C63FF]/30 grid place-items-center shadow-lg shrink-0 overflow-hidden relative">
              {activeAvatar.thumbnail ? (
                <img
                  src={activeAvatar.thumbnail}
                  alt={activeAvatar.name}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  style={{
                    objectPosition: activeAvatar.thumbnailPosition || "center",
                    transform: activeAvatar.thumbnailScale && activeAvatar.thumbnailScale !== 1.0 ? `scale(${activeAvatar.thumbnailScale})` : undefined,
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#6C63FF] to-[#FF6584] text-white grid place-items-center text-3xl">
                  {activeAvatar.emoji || "🎙️"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase text-[#6C63FF] tracking-wider px-2.5 py-0.5 rounded-full bg-[#6C63FF]/15">
                  Active Speaking Tutor
                </span>
                <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                  {activeAvatar.name} ({activeAvatar.gender === 'female' ? 'Female' : 'Male'})
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] border border-[#6C63FF]/20">
                  {canonicalState.selectionSource === SELECTION_SOURCE.AVATAR
                    ? 'Avatar Voice Active'
                    : canonicalState.selectionSource === SELECTION_SOURCE.REGIONAL
                    ? 'Regional Voice Active'
                    : 'System Default Active'}
                </span>
              </div>
              <h3 className="text-xl font-black text-[var(--text-primary)] mt-1 truncate">
                {activeAvatar.emoji} {activeAvatar.name} • {activeVoiceLabel}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                {canonicalState.selectionSource === SELECTION_SOURCE.AVATAR
                  ? `${activeAvatar.name} uses its dedicated character voice across the entire app. Choosing a regional voice below switches your active tutor to Teacher (Female) or Male Teacher.`
                  : `Selecting any regional voice below switches your active tutor to Female Teacher or Male Teacher with that accent.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={() => playVoicePreview(selectedVoice || activeAvatar.voiceProfile)}
              className="px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs font-black text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer"
            >
              {playingVoice === (selectedVoice || activeAvatar.voiceProfile)
                ? "🔊 Playing Audio..."
                : `▶ Test Voice`}
            </button>
            <button
              onClick={() => setShowVoiceModal(true)}
              className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-black shadow-lg shadow-[#6C63FF]/25 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <span>🎙️ Choose Regional Voice</span>
            </button>
          </div>
        </div>

        {/* SPEECH SPEED SELECTOR */}
        <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[var(--text-primary)]">Tutor Speech Speed</p>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">Control how fast your AI tutor talks</p>
          </div>

          <div className="flex items-center gap-2">
            {[0.75, 1.0, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => handleSelectSpeed(spd)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                  speechSpeed === spd
                    ? "bg-[#6C63FF] text-white border-[#6C63FF] shadow-sm"
                    : "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-default)]"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3: LEARNING GOALS & APP LANGUAGE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-black text-[var(--text-primary)]">Daily Practice Goal</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">Set target daily speaking time</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {["10 min", "15 min", "30 min"].map((goal) => (
              <button
                key={goal}
                onClick={() => handleSelectDailyGoal(goal)}
                className={`py-3 rounded-2xl text-xs font-black transition-all border active:scale-95 ${
                  dailyGoal === goal
                    ? "bg-[#6C63FF] text-white border-[#6C63FF] shadow-md"
                    : "bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-default)] hover:border-[#6C63FF]/50"
                }`}
              >
                ⏱️ {goal}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#6C63FF]/15 text-[#6C63FF] flex items-center justify-center text-2xl shadow-inner shrink-0 border border-[#6C63FF]/30">
              🌐
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-[#6C63FF] tracking-wider px-2.5 py-0.5 rounded-full bg-[#6C63FF]/15">
                  Language
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                  English
                </span>
              </div>
              <h2 className="text-base font-black text-[var(--text-primary)] mt-1 truncate">App Language</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">UI prompts, hints, and speech practice</p>
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-black flex items-center gap-2 shrink-0 self-start sm:self-auto shadow-xs">
            <span className="text-base">🇺🇸</span>
            <span>English</span>
          </div>
        </div>
      </div>

      {/* SECTION 3.5: TARGET PERSONA AGE PROFILE HIGHLIGHT CARD (General Users Only) */}
      {!isStudent && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--border-default)]">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                <span>👥</span> Target Persona Age Profile
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                Curates conversation scenarios, speaking cards, and dashboard tone to your age group.
              </p>
            </div>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/30 self-start sm:self-auto">
              Adaptive AI Tone Active ✨
            </span>
          </div>

          {/* Active Selected Persona Highlight Card Container */}
          <div className="relative overflow-hidden rounded-3xl">
            <div className="p-6 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-inner flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#6C63FF]/20 via-[#7C3AED]/15 to-[#EC4899]/20 border-2 border-[#6C63FF]/30 grid place-items-center shadow-lg shrink-0 text-3xl sm:text-4xl">
                  {activePersona.emoji}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase text-[#6C63FF] tracking-wider px-2.5 py-0.5 rounded-full bg-[#6C63FF]/15">
                      Active Persona
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
                      {activePersona.ageRange}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
                      {activePersona.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-[var(--text-primary)] mt-1 truncate">
                    {activePersona.label} ({activePersona.ageRange})
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                    {activePersona.desc}
                  </p>
                </div>
              </div>

              <div className="w-full lg:w-auto shrink-0 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleOpenPersonaModal}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-black shadow-lg shadow-[#6C63FF]/25 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <span>👥 Choose Persona</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: NOTIFICATIONS & SOUND TOGGLES */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-4">
        <h2 className="text-base font-black text-[var(--text-primary)]">🔔 Notifications & Audio Playback</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
            <div>
              <p className="text-xs font-black text-[var(--text-primary)]">Daily Practice Reminders</p>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Receive notifications to maintain your daily streak</p>
            </div>
            <button
              onClick={handleToggleReminders}
              className={`w-12 h-6 rounded-full transition-all relative ${reminders ? "bg-[#6C63FF]" : "bg-gray-400"}`}
            >
              <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${reminders ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
            <div>
              <p className="text-xs font-black text-[var(--text-primary)]">Sound Effects & Chimes</p>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Play celebratory chimes upon quiz completion and XP awards</p>
            </div>
            <button
              onClick={handleToggleSoundEffects}
              className={`w-12 h-6 rounded-full transition-all relative ${soundEffects ? "bg-[#6C63FF]" : "bg-gray-400"}`}
            >
              <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${soundEffects ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
            <div>
              <p className="text-xs font-black text-[var(--text-primary)]">Auto-Play Spoken Audio</p>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Automatically speak tutor responses in AI chat sessions</p>
            </div>
            <button
              onClick={handleToggleAutoPlay}
              className={`w-12 h-6 rounded-full transition-all relative ${autoPlayAudio ? "bg-[#6C63FF]" : "bg-gray-400"}`}
            >
              <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${autoPlayAudio ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </div>



      {/* ── REGIONAL VOICE OPTIONS POPUP MODAL (PORTALED TO BODY TO PREVENT NAVBAR OVERLAP) ── */}
      {showVoiceModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowVoiceModal(false)}
        >
          <div
            className="max-w-4xl w-full rounded-3xl shadow-2xl border border-[var(--border-default)] dark:border-white/10 flex flex-col max-h-[90vh] sm:max-h-[86vh] overflow-hidden bg-[var(--bg-surface)] transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--border-default)] dark:border-white/10 bg-[var(--bg-surface)]/95 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6C63FF] via-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center text-2xl shadow-lg shadow-[#6C63FF]/30 shrink-0">
                  🎙️
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xl text-[var(--text-primary)] tracking-tight">
                    Select AI Tutor Regional Voice
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                    Click any voice to select and test. Audio preview plays automatically!
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="w-10 h-10 rounded-2xl border border-[var(--border-default)] dark:border-white/10 bg-[var(--bg-elevated)] hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center text-xs font-black text-[var(--text-secondary)] cursor-pointer active:scale-90 shadow-sm shrink-0"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Voices Grid */}
            <div className="p-5 sm:p-8 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. System Default Option */}
                {(() => {
                  const isSysDefaultSelected =
                    canonicalState.selectionSource === SELECTION_SOURCE.SYSTEM_DEFAULT ||
                    (selectedVoice === "Default" && canonicalState.selectionSource !== SELECTION_SOURCE.AVATAR);

                  return (
                    <div
                      onClick={() => handleSelectVoiceCode("Default")}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSysDefaultSelected
                          ? "border-[#6C63FF] bg-[#6C63FF]/15 shadow-xl scale-102"
                          : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">✨</span>
                          <div className="flex items-center gap-1.5">
                            {playingVoice === "Default" && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase animate-pulse">
                                🔊 Playing...
                              </span>
                            )}
                            {isSysDefaultSelected && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-black uppercase">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-black text-base text-[var(--text-primary)]">1. System Default</h4>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {onboardingVoiceStyle}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 8 Regional Voice Profiles */}
                {VOICE_PROFILES.filter((vp) => REGIONAL_VOICE_CODES.includes(vp.code)).map((profile, idx) => {
                  const isSelected =
                    canonicalState.selectionSource === SELECTION_SOURCE.REGIONAL &&
                    selectedVoice === profile.code;
                  const flagMap = {
                    American: "🇺🇸",
                    British: "🇬🇧",
                    Australian: "🇦🇺",
                    Indian: "🇮🇳",
                  };
                  const flag = flagMap[profile.accent] || "🌐";
                  return (
                    <div
                      key={profile.code}
                      onClick={() => handleSelectVoiceCode(profile.code)}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-[#6C63FF] bg-[#6C63FF]/15 shadow-xl scale-102"
                          : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-2xl">
                            <span>{flag}</span>
                            <span>{profile.gender === "female" ? "👩‍🏫" : "👨‍🏫"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {playingVoice === profile.code && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase animate-pulse">
                                🔊 Playing...
                              </span>
                            )}
                            {isSelected && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-black uppercase">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-black text-base text-[var(--text-primary)]">
                            {idx + 2}. {profile.label}
                          </h4>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {profile.accent}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer Confirmation */}
            <div className="px-6 py-4 border-t border-[var(--border-default)] dark:border-white/10 bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                <span>✓</span>
                <span>Active Voice: {activeVoiceLabel} (Auto-saved across web app)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white text-xs font-black hover:opacity-95 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* ── TARGET PERSONA POPUP MODAL (PORTALED TO BODY) ── */}
      {showPersonaModal && !isStudent && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowPersonaModal(false)}
        >
          <div
            className="max-w-3xl w-full rounded-3xl shadow-2xl border border-[var(--border-default)] dark:border-white/10 flex flex-col max-h-[90vh] sm:max-h-[86vh] overflow-hidden bg-[var(--bg-surface)] transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--border-default)] dark:border-white/10 bg-[var(--bg-surface)]/95 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6C63FF] via-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center text-2xl shadow-lg shadow-[#6C63FF]/30 shrink-0">
                  👥
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xl text-[var(--text-primary)] tracking-tight">
                    Select Target Persona Age Profile
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                    Personalizes conversation tone, topic depth, vocabulary, and curriculum recommendations.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowPersonaModal(false)}
                className="w-10 h-10 rounded-2xl border border-[var(--border-default)] dark:border-white/10 bg-[var(--bg-elevated)] hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center text-xs font-black text-[var(--text-secondary)] cursor-pointer active:scale-90 shadow-sm shrink-0"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Persona Options Grid */}
            <div className="p-5 sm:p-8 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {AGE_OPTIONS.map((opt) => {
                  const isSelected = selectedAgeGroup === opt.code;
                  return (
                    <div
                      key={opt.code}
                      onClick={() => {
                        handleSelectAgeGroup(opt.code);
                        setShowPersonaModal(false);
                      }}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between group ${
                        isSelected
                          ? "border-[#6C63FF] bg-[#6C63FF]/15 shadow-xl scale-102 ring-2 ring-[#6C63FF]/30"
                          : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] grid place-items-center text-2xl shadow-inner group-hover:scale-105 transition-transform">
                            {opt.emoji}
                          </div>
                          {isSelected ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-black uppercase">
                              ✓ Active
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] text-[10px] font-bold border border-[var(--border-default)]">
                              {opt.ageRange}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-base text-[var(--text-primary)]">
                              {opt.label}
                            </h4>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
                            {opt.desc}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-[var(--border-default)]/60 flex items-center justify-between text-[11px] font-bold">
                        <span className="text-[var(--text-secondary)]">Target: {opt.ageRange}</span>
                        <span className={`transition-colors ${isSelected ? "text-[#6C63FF]" : "text-[var(--text-secondary)] group-hover:text-[#6C63FF]"}`}>
                          {isSelected ? "Selected ✓" : "Select Persona →"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[var(--border-default)] dark:border-white/10 bg-[var(--bg-surface)] flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Active: <strong className="text-[var(--text-primary)]">{activePersona.label} ({activePersona.ageRange})</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowPersonaModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[var(--bg-elevated)] text-xs font-black text-[var(--text-primary)] hover:bg-[#6C63FF] hover:text-white transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


    </div>
  );
}

export default Settings;
