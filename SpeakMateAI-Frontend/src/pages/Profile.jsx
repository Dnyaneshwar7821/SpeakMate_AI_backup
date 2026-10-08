import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authService } from "../services/authService";
import { profileService, subscriptionService, onboardingService, settingsService } from "../services/appServices";
import { getLiveProgressStats, syncBackendProgress } from "../utils/progressTracker";
import { EventBus, AVATAR_EVENTS } from "../services/live2d/EventBus";
import { AVATAR_LIST, getAvatarById } from "../config/AvatarCatalog";
import { Link } from "react-router-dom";
import ROUTES from "../constants/routes";
import { speakGlobalText } from "../utils/speechHelper";
import { CurriculumCache } from "../utils/curriculumCache";
import { saveUserPreferenceField } from "../utils/userPreferences";
import { setActiveTutorFromAvatar, getActiveTutorSync } from "../services/ActiveTutorService";
import { getEnglishLevelLabel } from "../utils/formatters";


const PRESET_AVATARS = [
  "🎓", "🦁", "🚀", "🦉", "👑", "⚡",
  "🦊", "🎯", "💎", "🌟", "🔥", "🏆",
  "🌸", "🐱", "🐶", "🦄", "🍀", "🎨"
];

const SCHOOL_GRADES = [
  "1st Std", "2nd Std", "3rd Std", "4th Std", "5th Std",
  "6th Std", "7th Std", "8th Std", "9th Std", "10th Std",
  "11th Std", "12th Std"
];

const ENGLISH_LEVELS = [
  "Beginner", "Intermediate", "Advanced"
];

const ACCENT_OPTIONS = [
  { code: "US", label: "American English (US)", flag: "🇺🇸" },
  { code: "UK", label: "British English (UK)", flag: "🇬🇧" },
  { code: "AU", label: "Australian English (AU)", flag: "🇦🇺" },
  { code: "IN", label: "Indian English (IN)", flag: "🇮🇳" },
];

const AGE_OPTIONS = [
  { code: "Kids", label: "Kids (6-12)", icon: "🎈", desc: "Simple words, fun stories & high encouragement" },
  { code: "Teens", label: "Teens (13-17)", icon: "⚡", desc: "School life, pop culture & casual chatter" },
  { code: "Young Adult", label: "Young Adults (18-24)", icon: "🎓", desc: "Campus life, travel & interview prep" },
  { code: "Professional", label: "Professionals (25-50)", icon: "💼", desc: "Business English, executive tone & presentations" },
  { code: "Senior", label: "Seniors (50+)", icon: "☕", desc: "Relaxed conversation, culture & life stories" },
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

const getRankTier = (xp = 0) => {
  if (xp < 100) return { name: "Bronze III", icon: "🥉", badgeColor: "from-amber-700 to-amber-900", nextXp: 100 };
  if (xp < 300) return { name: "Bronze II", icon: "🥉", badgeColor: "from-amber-600 to-amber-800", nextXp: 300 };
  if (xp < 600) return { name: "Bronze I", icon: "🥉", badgeColor: "from-amber-500 to-amber-700", nextXp: 600 };
  if (xp < 1000) return { name: "Silver III", icon: "🥈", badgeColor: "from-slate-500 to-slate-700", nextXp: 1000 };
  if (xp < 1500) return { name: "Silver II", icon: "🥈", badgeColor: "from-slate-400 to-slate-600", nextXp: 1500 };
  if (xp < 2200) return { name: "Silver I", icon: "🥈", badgeColor: "from-slate-300 to-slate-500", nextXp: 2200 };
  if (xp < 3000) return { name: "Gold III", icon: "🥇", badgeColor: "from-amber-500 to-yellow-600", nextXp: 3000 };
  if (xp < 4000) return { name: "Gold II", icon: "🥇", badgeColor: "from-amber-400 to-yellow-600", nextXp: 4000 };
  if (xp < 5000) return { name: "Gold I", icon: "🥇", badgeColor: "from-amber-300 to-yellow-500", nextXp: 5000 };
  if (xp < 7000) return { name: "Platinum Master", icon: "💎", badgeColor: "from-cyan-500 to-blue-600", nextXp: 7000 };
  return { name: "Diamond Orator", icon: "👑", badgeColor: "from-purple-500 to-indigo-700", nextXp: 10000 };
};

const isImageAvatar = (avatar) => {
  if (!avatar || typeof avatar !== "string") return false;
  const clean = avatar.trim();
  return (
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("/") ||
    clean.startsWith("data:image/") ||
    clean.startsWith("blob:")
  );
};

const NAME_REGEX = /^[a-zA-Z\s'-]{2,40}$/;
const NAME_ERROR_MESSAGE = "Names can only contain letters.";
const EMAIL_REGEX = /^[a-zA-Z0-9_+&*-]+(?:\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,7}$/;

export function Profile() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("general"); // 'general', 'preferences', 'security'
  const accountType = localStorage.getItem("speakmate_account_type") || user?.accountType || "INDIVIDUAL_USER";
  const isStudent = accountType === "STUDENT" || Boolean(user?.schoolGrade);

  const [liveStats, setLiveStats] = useState(() => getLiveProgressStats(user));

  const [form, setForm] = useState({
    firstName: user?.firstName || user?.name?.split(" ")[0] || "",
    lastName: user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "",
    email: user?.email || "",
    nativeLanguage: user?.nativeLanguage || user?.nativeLang || localStorage.getItem("speakmate_native_language") || "English",
  });
  const [originalForm, setOriginalForm] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [selectedAvatar, setSelectedAvatar] = useState(() => user?.avatar || localStorage.getItem("speakmate_avatar") || "🎓");
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const [schoolGrade, setSchoolGrade] = useState(
    isStudent ? (user?.schoolGrade || localStorage.getItem("speakmate_school_grade") || "1st Std") : "1st Std"
  );
  const [ageGroup, setAgeGroup] = useState(
    () => normalizeAgeGroup(user?.ageGroup || localStorage.getItem("speakmate_age_group") || "Professional")
  );
  const [cefrLevel, setCefrLevel] = useState(
    () => (typeof user?.englishLevel === "string" ? user.englishLevel : (typeof user?.level === "string" ? user.level : "Intermediate (B1)"))
  );

  // Preferences State
  const [dailyGoal, setDailyGoal] = useState(
    () => parseInt(localStorage.getItem("speakmate_daily_goal") || "15", 10)
  );
  const [preferredAccent, setPreferredAccent] = useState(
    () => localStorage.getItem("speakmate_accent") || "US"
  );
  const [activeAvatarId, setActiveAvatarId] = useState(
    () => getActiveTutorSync().avatarModel || "haru"
  );
  const [preferredVoice, setPreferredVoice] = useState(
    () => (getActiveTutorSync().avatarModel === 'chitose' ? 'male' : 'female')
  );

  useEffect(() => {
    const handleTutorChanged = (e) => {
      const canonical = e?.detail || getActiveTutorSync();
      if (canonical?.avatarModel) {
        setActiveAvatarId(canonical.avatarModel);
        setPreferredVoice(canonical.avatarModel === 'chitose' ? 'male' : 'female');
      }
    };
    window.addEventListener("speakmate_tutor_changed", handleTutorChanged);
    const unsub = EventBus.on(AVATAR_EVENTS.GENDER_CHANGED, (data) => {
      if (data?.model) {
        setActiveAvatarId(data.model);
        if (data?.gender) setPreferredVoice(data.gender);
      }
    });
    return () => {
      window.removeEventListener("speakmate_tutor_changed", handleTutorChanged);
      unsub();
    };
  }, []);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subInfo, setSubInfo] = useState(null);
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [playingTutor, setPlayingTutor] = useState(null);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Lock body scroll when modal is active
  useEffect(() => {
    if (showTutorModal || showAvatarModal || showDeleteModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showTutorModal, showAvatarModal, showDeleteModal]);

  // Close modals on Escape key
  useEffect(() => {
    if (!showTutorModal && !showAvatarModal && !showDeleteModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowTutorModal(false);
        setShowAvatarModal(false);
        setShowDeleteModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTutorModal, showAvatarModal, showDeleteModal]);

  const rank = getRankTier(liveStats.xp || user?.xp || 0);

  useEffect(() => {
    if (user?.ageGroup) setAgeGroup(normalizeAgeGroup(user.ageGroup));
    if (user?.schoolGrade) setSchoolGrade(user.schoolGrade);
  }, [user?.ageGroup, user?.schoolGrade]);

  useEffect(() => {
    profileService
      .get()
      .then((profile) => {
        if (profile) {
          syncBackendProgress(profile, user);
          setLiveStats(getLiveProgressStats(user));
          const fetchedForm = {
            firstName: profile.firstName || user?.firstName || "",
            lastName: profile.lastName || user?.lastName || "",
            email: profile.email || user?.email || "",
            nativeLanguage: profile.nativeLanguage || "English",
          };
          setForm(fetchedForm);
          setOriginalForm(fetchedForm);
          if (profile.avatar) {
            setSelectedAvatar(profile.avatar);
            localStorage.setItem("speakmate_avatar", profile.avatar);
          }
          if (profile.nativeLanguage) {
            localStorage.setItem("speakmate_native_language", profile.nativeLanguage);
          }
          if (profile.englishLevel && typeof profile.englishLevel === "string") {
            setCefrLevel(profile.englishLevel);
            localStorage.setItem("speakmate_english_level", profile.englishLevel);
          }
          if (profile.ageGroup) {
            const norm = normalizeAgeGroup(profile.ageGroup);
            setAgeGroup(norm);
            localStorage.setItem("speakmate_age_group", norm);
          }
          if (profile.schoolGrade) {
            setSchoolGrade(profile.schoolGrade);
            localStorage.setItem("speakmate_school_grade", profile.schoolGrade);
          }
        }
      })
      .catch(() => { });

    subscriptionService
      .getMySubscription()
      .then((sub) => setSubInfo(sub))
      .catch(() => { });
  }, [user]);

  const playAvatarPreview = (av) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.info(`Switched voice to ${av.name}`);
      return;
    }
    setPlayingTutor(av.id);
    const greetingText =
      av.id === 'spongebob'
        ? "Hey! It's really nice to meet you! Let's practice English together!"
        : (av.id === 'sparky' || av.id === 'bheem' || av.id === 'chhotabheem')
        ? "Hello! I am Chhota Bheem from Dholakpur! Let's practice English together!"
        : (av.id === 'mao' || av.id === 'ben' || av.id === 'ben10')
        ? "Hello! I'm Ben 10! It's hero time! Let's practice English together!"
        : (av.id === 'robopaws' || av.id === 'doraemon')
        ? "Hii, I am Dohraymon, your AI speaking coach. Let's practice English together!"
        : (av.id === 'shizuku' || av.id === 'shizuka')
        ? "Hii, I am Shizuka, your AI speaking coach. Let's practice English together!"
        : (av.id === 'koharu' || av.id === 'hattori' || av.id === 'ninjahattori')
        ? "Hello! I am Ninja Hattori from Iga! Let's practice English together with ninja speed!"
        : (av.id === 'haruto' || av.id === 'tom')
        ? "Hey there! I'm Tom! Let's have fun and practice speaking English together!"
        : (av.id === 'puppy' || av.id === 'wanko' || av.id === 'scoobydoo' || av.id === 'scooby')
        ? (av.previewGreeting || "Ruh-roh! Hello! I'm Scooby-Doo! Let's practice English and solve some mysteries together!")
        : (av.id === 'haru' || av.id === 'teacher')
        ? "Hello! Welcome to SpeakMate. Today, we are going to practice speaking clearly and confidently."
        : (av.id === 'chitose' || av.id === 'maleteacher')
        ? "Hello! Welcome to SpeakMate. Today, we are going to practice speaking clearly and confidently in English."
        : (av.previewGreeting || `Hii, I am ${av.name}, your AI speaking coach. Let's practice English together!`);

    speakGlobalText(greetingText, 1.0, {
      overrideVoiceCode: av.voiceProfile,
      avatarModel: av.id,
      onend: () => setPlayingTutor(null),
      onerror: () => setPlayingTutor(null),
    });
  };

  const handleSelectTutor = (avatarInput) => {
    // 1. Safe Speech Interruption: Cancel any active speech immediately
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        window._speakmate_ai_is_speaking = false;
        window._activeUtterance = null;
      } catch (e) {}
    }
    // Return lip-sync system to resting smile state
    EventBus.emit(AVATAR_EVENTS.SPEECH_FINISHED);

    const entry = typeof avatarInput === "object" ? avatarInput : getAvatarById(avatarInput);
    const model = entry.id;
    const gender = entry.gender;
    const voiceCode = entry.voiceProfile;
    const pitch = entry.defaultPitch;

    setActiveAvatarId(model);
    setPreferredVoice(gender);
    setActiveTutorFromAvatar(model);

    settingsService.update({ aiVoice: voiceCode }).catch(() => {});
    onboardingService.update({ preferredVoice: voiceCode }).catch(() => {});
    if (updateUser) {
      updateUser({
        preferredVoice: voiceCode,
        aiVoice: voiceCode,
        avatarModel: model,
        selectionSource: 'AVATAR',
      });
    }

    if (user?.email) {
      saveUserPreferenceField(user.email, 'avatarModel', model);
      saveUserPreferenceField(user.email, 'aiVoice', voiceCode);
      saveUserPreferenceField(user.email, 'selectionSource', 'AVATAR');
      saveUserPreferenceField(user.email, 'voiceGender', gender);
      saveUserPreferenceField(user.email, 'voicePitch', pitch);
    }

    playAvatarPreview(entry);

    toast.success(`Switched to ${entry.name} (${entry.voiceLabel} Active) ${entry.emoji}`);
  };

  const handleSelectProficiencyLevel = async (newLevel) => {
    setCefrLevel(newLevel);
    localStorage.setItem("speakmate_english_level", newLevel);
    try {
      await Promise.allSettled([
        profileService.update({
          firstName: form.firstName || user?.firstName,
          lastName: form.lastName || user?.lastName,
          email: form.email || user?.email,
          englishLevel: newLevel,
        }),
        onboardingService.update({ englishLevel: newLevel }),
      ]);
      if (updateUser) updateUser({ englishLevel: newLevel });
      window.dispatchEvent(new CustomEvent("speakmate_settings_updated", { detail: { englishLevel: newLevel } }));
      toast.success(`AI Tutor Level set to ${newLevel}! 🎯`);
    } catch {
      toast.error("Could not update proficiency level.");
    }
  };

  const handleSelectAgeGroup = async (newAge) => {
    const val = normalizeAgeGroup(newAge);
    setAgeGroup(val);
    localStorage.setItem("speakmate_age_group", val);
    CurriculumCache.clear();
    try {
      await Promise.allSettled([
        profileService.update({
          firstName: form.firstName || user?.firstName,
          lastName: form.lastName || user?.lastName,
          email: form.email || user?.email,
          ageGroup: val,
        }),
        onboardingService.update({ ageGroup: val }),
      ]);
      if (updateUser) updateUser({ ageGroup: val });
      window.dispatchEvent(new CustomEvent("speakmate_age_group_changed", { detail: { ageGroup: val } }));
      window.dispatchEvent(new CustomEvent("speakmate_settings_updated", { detail: { ageGroup: val } }));
      toast.success(`Target Persona set to ${val}! 👥`);
    } catch {
      toast.error("Could not update age group.");
    }
  };

  const handleSelectSchoolGrade = async (newGrade) => {
    setSchoolGrade(newGrade);
    localStorage.setItem("speakmate_school_grade", newGrade);
    CurriculumCache.clear();
    try {
      await Promise.allSettled([
        profileService.update({
          firstName: form.firstName || user?.firstName,
          lastName: form.lastName || user?.lastName,
          email: form.email || user?.email,
          schoolGrade: newGrade,
          englishLevel: null,
        }),
        onboardingService.update({ schoolGrade: newGrade, englishLevel: null }),
      ]);
      if (updateUser) updateUser({ schoolGrade: newGrade, englishLevel: null });
      window.dispatchEvent(new CustomEvent("speakmate_settings_updated", { detail: { schoolGrade: newGrade } }));
      toast.success(`School Curriculum set to ${newGrade}! 🎓`);
    } catch {
      toast.error("Could not update school grade.");
    }
  };

  const validateField = (fieldName, value) => {
    const val = value || "";
    const trimmed = val.trim();
    if (fieldName === "firstName" || fieldName === "lastName") {
      const label = fieldName === "firstName" ? "First name" : "Last name";
      if (!trimmed) return `${label} is required.`;
      if (/[^a-zA-Z\s'-]/.test(val)) {
        return "Names can only contain letters.";
      }
      if (trimmed.length < 2) {
        return `${label} must be at least 2 characters.`;
      }
      return null;
    }
    if (fieldName === "email") {
      if (!trimmed) return "Email address is required.";
      if (!EMAIL_REGEX.test(trimmed)) return "Please enter a valid email address.";
      return null;
    }
    return null;
  };

  const handleNameChange = (fieldName, val) => {
    setForm((prev) => ({ ...prev, [fieldName]: val }));
    if (/[^a-zA-Z\s'-]/.test(val)) {
      setFieldErrors((prev) => ({ ...prev, [fieldName]: "Names can only contain letters." }));
    } else {
      setFieldErrors((prev) => ({ ...prev, [fieldName]: null }));
    }
  };

  const handleEmailChange = (val) => {
    setForm((prev) => ({ ...prev, email: val }));
    const trimmed = (val || "").trim();
    if (fieldErrors.email && EMAIL_REGEX.test(trimmed)) {
      setFieldErrors((prev) => ({ ...prev, email: null }));
    }
  };

  const handleEmailBlur = (val) => {
    const trimmed = (val || "").trim();
    if (!trimmed) {
      setFieldErrors((prev) => ({ ...prev, email: "Email address is required." }));
    } else if (!EMAIL_REGEX.test(trimmed)) {
      setFieldErrors((prev) => ({ ...prev, email: "Please enter a valid email address." }));
    } else {
      setFieldErrors((prev) => ({ ...prev, email: null }));
    }
  };

  const handleCancelEdit = () => {
    if (originalForm) {
      setForm({ ...originalForm });
    } else {
      setForm({
        firstName: user?.firstName || user?.name?.split(" ")[0] || "",
        lastName: user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "",
        email: user?.email || "",
        nativeLanguage: user?.nativeLanguage || user?.nativeLang || "English",
      });
    }
    setFieldErrors({});
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const firstNameErr = validateField("firstName", form.firstName);
    const lastNameErr = validateField("lastName", form.lastName);
    const emailErr = validateField("email", form.email);

    const errors = {};
    if (firstNameErr) errors.firstName = firstNameErr;
    if (lastNameErr) errors.lastName = lastNameErr;
    if (emailErr) errors.email = emailErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    const cleanFirstName = form.firstName.trim();
    const cleanLastName = form.lastName.trim();
    const cleanEmail = form.email.trim().toLowerCase();

    try {
      if (isStudent && schoolGrade) {
        localStorage.setItem("speakmate_school_grade", schoolGrade);
      } else {
        localStorage.setItem("speakmate_age_group", ageGroup);
        window.dispatchEvent(new CustomEvent("speakmate_age_group_changed", { detail: { ageGroup } }));
      }
      localStorage.setItem("speakmate_english_level", cefrLevel);
      localStorage.setItem("speakmate_daily_goal", dailyGoal.toString());
      localStorage.setItem("speakmate_accent", preferredAccent);
      localStorage.setItem("speakmate_voice_gender", preferredVoice);
      localStorage.setItem("speakmate_avatar_model", activeAvatarId);

      const canonical = getActiveTutorSync();
      if (user?.email) {
        saveUserPreferenceField(user.email, 'avatarModel', canonical.avatarModel);
        saveUserPreferenceField(user.email, 'aiVoice', canonical.aiVoice);
        saveUserPreferenceField(user.email, 'selectionSource', canonical.selectionSource);
      }

      EventBus.emit(AVATAR_EVENTS.GENDER_CHANGED, { gender: preferredVoice, model: activeAvatarId });

      // Directly update backend profile and surface any errors
      const updatedProfile = await profileService.update({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        nativeLanguage: form.nativeLanguage,
        avatar: selectedAvatar,
        ageGroup: isStudent ? undefined : ageGroup,
        englishLevel: cefrLevel,
        schoolGrade: isStudent ? schoolGrade : undefined,
      });

      // Background sync onboarding preferences
      onboardingService.update({
        ageGroup: isStudent ? undefined : ageGroup,
        englishLevel: cefrLevel,
        schoolGrade: isStudent ? schoolGrade : undefined,
        nativeLanguage: form.nativeLanguage,
      }).catch(() => null);

      const savedData = {
        ...(updatedProfile || {}),
        name: `${cleanFirstName} ${cleanLastName}`.trim(),
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        nativeLanguage: form.nativeLanguage,
        avatar: selectedAvatar,
        avatarModel: activeAvatarId,
        selectionSource: 'AVATAR',
        schoolGrade: isStudent ? schoolGrade : null,
        ageGroup: isStudent ? null : ageGroup,
        englishLevel: cefrLevel,
      };

      setOriginalForm({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        nativeLanguage: form.nativeLanguage,
      });

      if (updateUser) updateUser(savedData);

      window.dispatchEvent(new CustomEvent("speakmate_settings_updated", {
        detail: {
          firstName: cleanFirstName,
          lastName: cleanLastName,
          ageGroup: isStudent ? null : ageGroup,
          englishLevel: cefrLevel,
          schoolGrade: isStudent ? schoolGrade : null,
        }
      }));

      setSaved(true);
      setIsEditingProfile(false);
      toast.success("Profile details saved successfully! ✓");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const serverMsg = err.response?.data?.message ||
        (err.response?.data && typeof err.response.data === "object" && !err.response.data.message
          ? (err.response.data.firstName || err.response.data.lastName || err.response.data.email || Object.values(err.response.data)[0])
          : null) ||
        err.message ||
        "Failed to update profile details.";
      toast.error(serverMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPresetAvatar = async (emoji) => {
    setSelectedAvatar(emoji);
    setShowAvatarModal(false);
    try {
      await profileService.updateAvatar(emoji);
      if (updateUser) updateUser({ avatar: emoji });
      toast.success(`Avatar updated to ${emoji}! 🎉`);
    } catch {
      toast.error("Failed to save avatar to server.");
    }
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          // Resize to max 400x400 for crisp high-definition avatar clarity within 500 KB contract
          const canvas = document.createElement("canvas");
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const compressedUri = canvas.toDataURL("image/jpeg", 0.85);

          if (compressedUri.length > 500 * 1024) {
            toast.error("Avatar payload exceeds 500 KB limit. Please choose a smaller photo.");
            return;
          }

          setSelectedAvatar(compressedUri);
          setShowAvatarModal(false);
          await profileService.updateAvatar(compressedUri);
          if (updateUser) updateUser({ avatar: compressedUri });
          toast.success("Profile photo updated successfully! 📸");
        } catch {
          toast.error("Failed to upload profile photo.");
        }
      };
      img.onerror = () => {
        toast.error("Failed to process selected image.");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm("Are you sure you want to cancel your Pro subscription? You will return to the Free Starter plan.")) {
      return;
    }
    try {
      const res = await subscriptionService.cancelSubscription();
      setSubInfo(res || { isPro: false, planType: "FREE", status: "ACTIVE" });
      if (updateUser) {
        updateUser({ ...user, isPro: false, subscriptionPlan: "FREE" });
      }
      toast.success("Your Pro subscription has been cancelled. You are now on the Free Starter plan.");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to cancel subscription.");
    }
  };

  const handleOpenDeleteModal = () => {
    setDeleteEmail(user?.email || form.email || "");
    setDeleteOtp("");
    setOtpSent(false);
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const handleSendDeleteOtp = async () => {
    const cleanEmail = deleteEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setDeleteError("Please enter your registered email address.");
      return;
    }
    setDeleteError("");
    setSendingOtp(true);
    try {
      await authService.sendDeleteAccountOtp({ email: cleanEmail });
      setOtpSent(true);
      toast.success(`Verification code sent to ${cleanEmail}.`);
    } catch (err) {
      setDeleteError("Failed to send deletion OTP. Please verify your email.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmDeleteAccount = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = deleteEmail.trim().toLowerCase();
    const cleanOtp = deleteOtp.trim();

    if (!cleanEmail || !cleanOtp || cleanOtp.length !== 6) {
      setDeleteError("Please enter the 6-digit OTP code sent to your email.");
      return;
    }

    setDeleteError("");
    setDeletingAccount(true);
    try {
      await authService.deleteAccount({ email: cleanEmail, otp: cleanOtp });
      setShowDeleteModal(false);
      toast.success("Account permanently deleted.");
      logout();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (err) {
      setDeleteError("Invalid or expired OTP code.");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 px-2 sm:px-4 lg:px-6 py-2">
      {/* Header Profile Card with Glassmorphism */}
      <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-r from-[#6C63FF] via-[#4F46E5] to-[#312E81] text-white shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/10">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left z-10">
          <div
            onClick={() => setShowAvatarModal(true)}
            className="group relative cursor-pointer grid h-24 w-24 place-items-center rounded-3xl bg-white/20 backdrop-blur-md border-2 border-white/40 shadow-inner shrink-0 hover:scale-105 transition-all overflow-hidden"
            title="Click to change avatar"
          >
            {isImageAvatar(selectedAvatar) ? (
              <img src={selectedAvatar} alt="Profile Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">{selectedAvatar || "🎓"}</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all grid place-items-center text-xs font-black text-white">
              ✏️ Edit
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3.5 sm:mb-4">
              <span className={`text-[10px] font-black px-3.5 py-1.5 rounded-full bg-gradient-to-r ${rank.badgeColor} text-white uppercase tracking-wider shadow-md inline-flex items-center gap-1.5`}>
                {rank.icon} {rank.name}
              </span>
              <span className="text-[10px] font-black px-3.5 py-1.5 rounded-full bg-white/20 uppercase tracking-wider border border-white/30 inline-flex items-center gap-1.5">
                {isStudent ? `🎓 ${schoolGrade || (user?.standard ? `${user.standard}th Standard` : "School Student")}` : `👤 ${typeof cefrLevel === "string" ? cefrLevel : "Intermediate"}`}
              </span>
              {isStudent && typeof cefrLevel === "string" && cefrLevel && (
                <span className="text-[10px] font-black px-3.5 py-1.5 rounded-full bg-white/20 uppercase tracking-wider border border-white/30 inline-flex items-center gap-1.5">
                  🎯 {cefrLevel}
                </span>
              )}
              <span className="text-[10px] font-black px-3.5 py-1.5 rounded-full bg-white/20 uppercase tracking-wider border border-white/30 text-amber-300 inline-flex items-center gap-1.5">
                ⭐ {liveStats.xp || 0} XP
              </span>
              <span className="text-[10px] font-black px-3.5 py-1.5 rounded-full bg-white/20 uppercase tracking-wider border border-white/30 text-rose-300 inline-flex items-center gap-1.5">
                🔥 {liveStats.streak || 0} Day Streak
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-2">
              {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : "Learner"}
            </h1>
            <p className="text-xs sm:text-sm font-medium opacity-90">{form.email}</p>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex sm:flex-col gap-2 z-10 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 ${activeTab === "general" ? "bg-white text-[#6C63FF] shadow-lg" : "bg-white/10 hover:bg-white/20 text-white"
              }`}
          >
            👤 General Details
          </button>
          <button
            onClick={() => setActiveTab("preferences")}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 ${activeTab === "preferences" ? "bg-white text-[#6C63FF] shadow-lg" : "bg-white/10 hover:bg-white/20 text-white"
              }`}
          >
            🎯 Goals & Voices
          </button>
          {!isStudent && (
            <button
              onClick={() => setActiveTab("subscription")}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 ${activeTab === "subscription" ? "bg-white text-amber-600 shadow-lg" : "bg-white/10 hover:bg-white/20 text-white"
                }`}
            >
              ⭐ Subscription
            </button>
          )}
          <button
            onClick={() => setActiveTab("security")}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 ${activeTab === "security" ? "bg-white text-rose-600 shadow-lg" : "bg-white/10 hover:bg-white/20 text-white"
              }`}
          >
            🔒 Security
          </button>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-black text-center animate-in fade-in duration-200">
          ✓ Profile and learning goals updated successfully!
        </div>
      )}

      {/* TAB 1: GENERAL PROFILE DETAILS */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* ── SECTION 1: SCHOOL STANDARD (LOCKED FOR STUDENTS) ── */}
          {isStudent && (
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-default)]">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
                    <span>🏫</span> School Curriculum Standard
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium mt-0.5">
                    Your syllabus, grammar tests, and practice material are aligned with your assigned grade.
                  </p>
                </div>
                <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 self-start sm:self-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Admin Managed 🎓
                </span>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                <div className="w-12 h-12 rounded-2xl bg-[#6C63FF]/15 text-[#6C63FF] flex items-center justify-center text-2xl font-black shrink-0">
                  🎓
                </div>
                <div className="space-y-0.5">
                  <div className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                    {schoolGrade || (user?.standard ? `${user.standard}th Standard` : "Assigned School Standard")}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-medium">
                    Assigned by your School / Super Admin. Contact your school administrator to change standard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 2: AI TUTOR ENGLISH LEVEL (ALL USERS & STUDENTS) ── */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-default)]">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
                  <span>👤</span> AI Tutor English Level
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium mt-0.5">
                  Controls speaking & chat response complexity for your AI tutor
                </p>
              </div>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/30 self-start sm:self-auto">
                Live Speaking Adaptation 🎯
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {[
                { level: "Beginner", icon: "🌱", desc: "Simple words & basic sentence structures" },
                { level: "Intermediate", icon: "🚀", desc: "Fluent conversations & daily situations" },
                { level: "Advanced", icon: "👑", desc: "Complex vocabulary & executive tone" },
              ].map((item) => {
                const active = (getEnglishLevelLabel(cefrLevel) || String(cefrLevel || "")).toLowerCase().includes(item.level.toLowerCase());

                return (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => handleSelectProficiencyLevel(item.level)}
                    className={`p-5 rounded-3xl text-left border transition-all cursor-pointer active:scale-95 group overflow-hidden ${active
                        ? "bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] text-white border-[#6C63FF] shadow-lg shadow-[#6C63FF]/20 ring-2 ring-[#6C63FF]/30"
                        : "bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-default)] hover:border-[#6C63FF]/50"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{item.icon}</span>
                      {active && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white shadow-sm">
                          Active
                        </span>
                      )}
                    </div>
                    <h4 className={`text-base font-black mt-3 ${active ? "text-white" : "text-[var(--text-primary)]"}`}>
                      {item.level}
                    </h4>
                    <p className={`text-xs font-medium mt-1 leading-relaxed ${active ? "text-white/85" : "text-[var(--text-secondary)]"}`}>
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SECTION 2: ACTIVE AI SPEAKING TUTOR SUMMARY CARD WITH POPUP MODAL ── */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-default)]">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
                  <span>🎭</span> Active AI Speaking Tutor Persona
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium mt-0.5">
                  Your personalized AI speaking partner from our full character catalog.
                </p>
              </div>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/30 self-start sm:self-auto">
                Auto Voice Sync Active 🎙️
              </span>
            </div>

            {/* Active Selected Tutor Highlight Card */}
            {(() => {
              const activeTutorObj = getAvatarById(activeAvatarId);
              return (
                <div className="p-6 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-inner flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--bg-surface)] border-2 border-[#6C63FF]/30 grid place-items-center shadow-lg shrink-0 overflow-hidden relative">
                      {activeTutorObj.thumbnail ? (
                        <img
                          src={activeTutorObj.thumbnail}
                          alt={activeTutorObj.name}
                          className="w-full h-full object-cover select-none pointer-events-none"
                          style={{
                            objectPosition: activeTutorObj.thumbnailPosition || "center",
                            transform: activeTutorObj.thumbnailScale && activeTutorObj.thumbnailScale !== 1.0 ? `scale(${activeTutorObj.thumbnailScale})` : undefined,
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-[#6C63FF] to-[#FF6584] text-white grid place-items-center text-3xl">
                          {activeTutorObj.emoji}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-[#6C63FF] tracking-wider px-2.5 py-0.5 rounded-full bg-[#6C63FF]/15">
                          Active Selected Tutor
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
                          {activeTutorObj.badge}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-[var(--text-primary)] mt-1 truncate">
                        {activeTutorObj.name}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                        {activeTutorObj.subtitle} • 🎙️ {activeTutorObj.voiceLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => playAvatarPreview(activeTutorObj)}
                      className="px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs font-black text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer"
                    >
                      {playingTutor === activeTutorObj.id ? "🔊 Speaking..." : "▶ Test Voice"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTutorModal(true)}
                      className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-black shadow-lg shadow-[#6C63FF]/25 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      <span>🎭 Choose AI Avatar</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── SECTION 3: PERSONAL INFORMATION CARD ── */}
          <div className="glass-card p-6 sm:p-10 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--border-default)]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-[var(--text-primary)]">Personal Details</h2>
                  {isEditingProfile ? (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse">
                      ✏️ Editing Mode
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      ✓ Active
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
                  Manage your personal identity, contact email, and language.
                </p>
              </div>

              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setFieldErrors({});
                    setIsEditingProfile(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white text-xs sm:text-sm font-black shadow-lg shadow-[#6C63FF]/25 hover:opacity-95 transition-all cursor-pointer active:scale-95 self-start sm:self-auto"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-4 py-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:border-slate-400 text-xs sm:text-sm font-bold text-[var(--text-secondary)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-5 py-2 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white text-xs sm:text-sm font-black shadow-md shadow-[#6C63FF]/25 hover:opacity-95 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs sm:text-sm font-black text-[var(--text-primary)] mb-2">First Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={form.firstName}
                      disabled={!isEditingProfile || saving}
                      onChange={(e) => handleNameChange("firstName", e.target.value)}
                      placeholder="Enter your first name"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl border text-sm font-bold text-[var(--text-primary)] focus:outline-none transition-all shadow-inner ${
                        !isEditingProfile
                          ? "bg-[var(--bg-card)] border-[var(--border-default)] opacity-85 cursor-not-allowed"
                          : fieldErrors.firstName
                          ? "bg-[var(--bg-elevated)] border-rose-500 ring-2 ring-rose-500/20"
                          : "bg-[var(--bg-elevated)] border-[var(--border-default)] focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20"
                      }`}
                    />
                  </div>
                  {isEditingProfile && fieldErrors.firstName && (
                    <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                      <span>⚠️</span> {fieldErrors.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-[var(--text-primary)] mb-2">Last Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={form.lastName}
                      disabled={!isEditingProfile || saving}
                      onChange={(e) => handleNameChange("lastName", e.target.value)}
                      placeholder="Enter your last name"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl border text-sm font-bold text-[var(--text-primary)] focus:outline-none transition-all shadow-inner ${
                        !isEditingProfile
                          ? "bg-[var(--bg-card)] border-[var(--border-default)] opacity-85 cursor-not-allowed"
                          : fieldErrors.lastName
                          ? "bg-[var(--bg-elevated)] border-rose-500 ring-2 ring-rose-500/20"
                          : "bg-[var(--bg-elevated)] border-[var(--border-default)] focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20"
                      }`}
                    />
                  </div>
                  {isEditingProfile && fieldErrors.lastName && (
                    <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                      <span>⚠️</span> {fieldErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs sm:text-sm font-black text-[var(--text-primary)]">Email Address</label>
                    {!isEditingProfile && <span className="text-[10px] text-[var(--text-secondary)] font-medium">Account ID</span>}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={form.email}
                      disabled={!isEditingProfile || saving}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onBlur={(e) => handleEmailBlur(e.target.value)}
                      placeholder="your.email@example.com"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl border text-sm font-bold text-[var(--text-primary)] focus:outline-none transition-all shadow-inner ${
                        !isEditingProfile
                          ? "bg-[var(--bg-card)] border-[var(--border-default)] opacity-85 cursor-not-allowed"
                          : fieldErrors.email
                          ? "bg-[var(--bg-elevated)] border-rose-500 ring-2 ring-rose-500/20"
                          : "bg-[var(--bg-elevated)] border-[var(--border-default)] focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20"
                      }`}
                    />
                  </div>
                  {isEditingProfile && fieldErrors.email && (
                    <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                      <span>⚠️</span> {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-[var(--text-primary)] mb-2">Language</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={form.nativeLanguage}
                      disabled={!isEditingProfile || saving}
                      onChange={(e) => setForm({ ...form, nativeLanguage: e.target.value })}
                      placeholder="e.g. English, Hindi, Spanish"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl border text-sm font-bold text-[var(--text-primary)] focus:outline-none transition-all shadow-inner ${
                        !isEditingProfile
                          ? "bg-[var(--bg-card)] border-[var(--border-default)] opacity-85 cursor-not-allowed"
                          : "bg-[var(--bg-elevated)] border-[var(--border-default)] focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {isEditingProfile && (
                <div className="pt-4 border-t border-[var(--border-default)] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="py-3 px-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:border-slate-400 text-xs sm:text-sm font-bold text-[var(--text-secondary)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="py-3.5 px-8 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:opacity-95 disabled:opacity-50 text-white text-xs sm:text-sm font-black shadow-xl shadow-[#6C63FF]/25 transition-all cursor-pointer active:scale-95"
                  >
                    {saving ? "Saving Changes..." : "Save Profile Details"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: PREFERENCES & LEARNING GOALS */}
      {activeTab === "preferences" && (
        <div className="glass-card p-6 sm:p-10 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-6">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">Learning Goals & Preferences</h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
              Customize your daily study cadence, target accent, and AI tutor partner.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* ── AI Speaking Tutor Persona inside Preferences (Universal Catalog) ── */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <label className="block text-xs sm:text-sm font-black text-[var(--text-primary)]">
                  🎭 AI Speaking Tutor Persona
                </label>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/30">
                  Auto Voice Sync 🎙️
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {AVATAR_LIST.map((av) => {
                  const isSelected = activeAvatarId === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => handleSelectTutor(av)}
                      className={`p-4 rounded-2xl border text-left font-black transition-all cursor-pointer active:scale-95 flex flex-col justify-between group ${isSelected
                          ? "border-[#6C63FF] bg-[#6C63FF]/15 text-[#6C63FF] shadow-md ring-2 ring-[#6C63FF]/30"
                          : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[#6C63FF]/50"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] grid place-items-center text-3xl shadow-inner shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                          {av.thumbnail ? (
                            <img
                              src={av.thumbnail}
                              alt={av.name}
                              loading="lazy"
                              width="56"
                              height="56"
                              className="w-full h-full object-cover select-none pointer-events-none"
                              style={{
                                objectPosition: av.thumbnailPosition || "center",
                                transform: av.thumbnailScale && av.thumbnailScale !== 1.0 ? `scale(${av.thumbnailScale})` : undefined,
                              }}
                            />
                          ) : (
                            av.emoji
                          )}
                        </div>
                        {isSelected && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#6C63FF] text-white">
                            ✓ Active
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black">{av.name}</span>
                          <span
                            className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${av.category === "cartoon"
                                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                                : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                              }`}
                          >
                            {av.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] font-medium line-clamp-1">
                          {av.subtitle}
                        </p>
                        <div className="pt-1">
                          <span className="text-[9px] font-bold opacity-90 px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-default)] inline-block">
                            🎙️ {av.voiceLabel}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-black text-[var(--text-primary)] mb-3">
                Daily Speaking Target (Minutes)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDailyGoal(mins)}
                    className={`p-4 rounded-2xl border text-center font-black transition-all cursor-pointer active:scale-95 ${dailyGoal === mins
                        ? "border-[#6C63FF] bg-[#6C63FF]/15 text-[#6C63FF] shadow-md"
                        : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      }`}
                  >
                    <span className="text-lg block">⏱️ {mins} Mins</span>
                    <span className="text-[10px] opacity-75">{mins === 15 ? "Recommended" : mins === 30 ? "Intense" : "Casual"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-black text-[var(--text-primary)] mb-3">
                Preferred Tutor Accent
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ACCENT_OPTIONS.map((acc) => (
                  <button
                    key={acc.code}
                    type="button"
                    onClick={() => setPreferredAccent(acc.code)}
                    className={`p-3.5 rounded-2xl border text-center font-black transition-all cursor-pointer active:scale-95 ${preferredAccent === acc.code
                        ? "border-[#6C63FF] bg-[#6C63FF]/15 text-[#6C63FF] shadow-md"
                        : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      }`}
                  >
                    <span className="text-xl block mb-1">{acc.flag}</span>
                    <span className="text-xs">{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border-default)] flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="py-3.5 px-8 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:opacity-95 disabled:opacity-50 text-white text-xs sm:text-sm font-black shadow-xl shadow-[#6C63FF]/25 transition-all cursor-pointer active:scale-95"
              >
                {saving ? "Saving Preferences..." : "Save Preferences"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION & PLAN (INDIVIDUAL USERS ONLY) */}
      {activeTab === "subscription" && !isStudent && (
        <div className="glass-card p-6 sm:p-10 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-6">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">My Subscription & License</h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
              View your active SpeakMate AI plan, daily practice quotas, and upgrade options.
            </p>
          </div>

          {subInfo?.isPro ? (
            <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-indigo-500/15 border border-indigo-500/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🌟</span>
                  <div>
                    <h3 className="font-black text-lg text-indigo-500">
                      SpeakMate Pro Member ({subInfo?.planType === "YEARLY_PRO" ? "Annual Pass" : "Monthly Pass"})
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] font-medium">
                      Status: <span className="text-emerald-500 font-bold">Active</span>
                      {subInfo?.endDate && ` • Valid until ${new Date(subInfo.endDate).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    className="py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold text-center shadow-sm transition-all"
                  >
                    Cancel Plan
                  </button>
                  <Link
                    to={ROUTES.PRICING}
                    className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center shadow-md transition-all active:scale-95"
                  >
                    Change Plan ➔
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">AI Speaking</span>
                  <strong className="text-indigo-400 text-sm">Unlimited</strong>
                </div>
                <div className="p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Grammar Doctor</span>
                  <strong className="text-indigo-400 text-sm">Unlimited</strong>
                </div>
                <div className="p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Voice Personas</span>
                  <strong className="text-indigo-400 text-sm">All Unlocked</strong>
                </div>
                <div className="p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Live2D Avatars</span>
                  <strong className="text-indigo-400 text-sm">All Unlocked</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    Free Starter Plan
                  </span>
                  <h3 className="font-black text-lg text-[var(--text-primary)] mt-2">
                    Free Forever Tier
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                    10 minutes daily AI talk & 5 grammar checks per day.
                  </p>
                </div>

                <Link
                  to={ROUTES.PRICING}
                  className="py-3 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white text-xs font-black text-center shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95"
                >
                  Upgrade to Pro (From ₹149/mo) ➔
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 flex items-center justify-between">
                <span>🔥 Upgrade to Pro for <strong>Unlimited 24/7 practice</strong>, all voice avatars, and interview tracks.</span>
                <span className="font-black">Save 33% on Annual Pass ⭐</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SECURITY & ACCOUNT DELETION */}
      {activeTab === "security" && (
        <div className="glass-card p-6 sm:p-10 rounded-3xl border border-[var(--border-default)] shadow-xl space-y-6">
          <div>
            <h2 className="text-xl font-black text-rose-500">Security & Danger Zone</h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
              Manage account lifecycle and permanent data removal.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-black text-sm">Permanent Account Deletion</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
              Deleting your account permanently removes all your saved vocabulary, speaking practice recordings, learning streak milestones, and progress analytics. This action requires email OTP authentication.
            </p>
            <button
              onClick={handleOpenDeleteModal}
              className="py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-lg shadow-rose-600/25 active:scale-95"
            >
              Request Account Deletion →
            </button>
          </div>
        </div>
      )}

      {/* ── PRESET AVATAR SELECTOR MODAL ── */}
      {showAvatarModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowAvatarModal(false)}
        >
          <div
            className="max-w-md w-full glass-card p-6 sm:p-8 rounded-3xl shadow-2xl border border-[var(--border-default)] space-y-5 bg-[var(--bg-surface)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-black text-lg text-[var(--text-primary)]">Choose Profile Avatar</h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Custom Photo Upload Option */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl overflow-hidden grid place-items-center bg-[#6C63FF]/20 border border-[#6C63FF]/30 shrink-0">
                  {isImageAvatar(selectedAvatar) ? (
                    <img src={selectedAvatar} alt="Current" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">📸</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-[var(--text-primary)]">Custom Photo</p>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">Upload JPG or PNG from device</p>
                </div>
              </div>
              <label className="py-2 px-3.5 rounded-xl bg-[#6C63FF] hover:bg-[#5B52E0] text-white text-xs font-black cursor-pointer shadow-md shadow-[#6C63FF]/25 active:scale-95 transition-all">
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadPhoto}
                />
              </label>
            </div>

            <div className="text-xs font-bold text-[var(--text-secondary)] px-1">Or select an emoji avatar:</div>

            <div className="grid grid-cols-6 gap-3 p-1 max-h-48 overflow-y-auto">
              {PRESET_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelectPresetAvatar(emoji)}
                  className={`h-12 text-2xl rounded-2xl border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${selectedAvatar === emoji
                      ? "border-[#6C63FF] bg-[#6C63FF]/15 scale-105"
                      : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/50"
                    }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── DELETE ACCOUNT WITH OTP MODAL ── */}
      {showDeleteModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="max-w-md w-full glass-card p-6 sm:p-8 rounded-3xl shadow-2xl border-2 border-rose-500/40 space-y-6 relative overflow-hidden bg-[var(--bg-surface)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
              <div className="flex items-center gap-2 text-rose-500 font-black text-lg sm:text-xl">
                <span>🗑️</span>
                <h3>Delete Account</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
                ⚠️ {deleteError}
              </div>
            )}

            {!otpSent ? (
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                  Are you sure you want to delete your account? This action is permanent and cannot be undone.
                </p>

                <div>
                  <label className="block text-xs font-black text-[var(--text-primary)] mb-2">
                    Confirm Your Email Address
                  </label>
                  <input
                    type="email"
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                  🔒 Step 1: Click below to receive a 6-digit verification code.
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-xs font-black text-[var(--text-primary)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendDeleteOtp}
                    disabled={sendingOtp || !deleteEmail.trim()}
                    className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
                  >
                    {sendingOtp ? "Sending OTP..." : "Send Verification OTP →"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmDeleteAccount} className="space-y-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  📧 OTP Code sent to <strong>{deleteEmail}</strong>.
                </div>

                <div>
                  <label className="block text-xs font-black text-[var(--text-primary)] mb-2 text-center">
                    Enter 6-Digit Verification OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={deleteOtp}
                    onChange={(e) => setDeleteOtp(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-rose-500 bg-[var(--bg-elevated)] text-center text-2xl font-black tracking-widest text-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="flex-1 py-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-xs font-black text-[var(--text-primary)] cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={deletingAccount || !deleteOtp.trim()}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-90 disabled:opacity-50 text-white text-xs font-black shadow-xl shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
                  >
                    {deletingAccount ? "Deleting..." : "Verify & Permanently Delete"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── 10 AI AVATAR OPTIONS POPUP MODAL ── */}
      {showTutorModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowTutorModal(false)}
        >
          <div
            className="max-w-5xl w-full rounded-3xl shadow-2xl border border-slate-200/90 dark:border-white/10 flex flex-col max-h-[90vh] sm:max-h-[86vh] overflow-hidden bg-white dark:bg-[#111625] transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#111625]/95 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6C63FF] via-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center text-2xl shadow-lg shadow-[#6C63FF]/30 shrink-0">
                  🎭
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">
                    Choose AI Speaking Partner
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Select your tutor character or click <strong>Test Voice</strong> to preview their speech & personality!
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowTutorModal(false)}
                className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 cursor-pointer active:scale-90 shadow-sm shrink-0"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* AVATAR OPTIONS GRID */}
            <div className="p-5 sm:p-8 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {AVATAR_LIST.map((av) => {
                  const isSelected = activeAvatarId === av.id;
                  const isPlaying = playingTutor === av.id;
                  const displayVoice = (av.voiceLabel || av.voice || "Voice").replace(/\s+Voice$/i, "");
                  return (
                    <div
                      key={av.id}
                      onClick={() => {
                        handleSelectTutor(av);
                        setShowTutorModal(false);
                      }}
                      className={`p-5 rounded-3xl border-2 cursor-pointer transition-all space-y-3 flex flex-col justify-between group ${isSelected
                          ? "border-[#6C63FF] bg-[#6C63FF]/15 shadow-xl scale-102 ring-2 ring-[#6C63FF]/30"
                          : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[#6C63FF]/50"
                        }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] grid place-items-center text-3xl shadow-inner shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                            {av.thumbnail ? (
                              <img
                                src={av.thumbnail}
                                alt={av.name}
                                loading="lazy"
                                width="56"
                                height="56"
                                className="w-full h-full object-cover select-none pointer-events-none"
                                style={{
                                  objectPosition: av.thumbnailPosition || "center",
                                  transform: av.thumbnailScale && av.thumbnailScale !== 1.0 ? `scale(${av.thumbnailScale})` : undefined,
                                }}
                              />
                            ) : (
                              av.emoji
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-[#6C63FF] text-white shadow-sm">
                                ✓ Active
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${av.category === "cartoon"
                                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                                  : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                                }`}
                              >
                                {av.badge}
                              </span>
                            </div>
                          </div>

                          {/* Middle: Character Name + Subtitle */}
                          <h4 className="font-black text-lg text-slate-900 dark:text-white group-hover:text-[#6C63FF] transition-colors mt-3.5 flex items-center gap-2">
                            {av.name}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium line-clamp-2 mt-1 min-h-[32px] leading-relaxed">
                            {av.subtitle}
                          </p>
                        </div>

                        {/* Bottom: Voice Info Tag + Action Button (NO Choose button) */}
                        <div className="pt-3.5 mt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-300 min-w-0 flex-1"
                            title={av.voiceLabel}
                          >
                            <span className="text-xs shrink-0">🎙️</span>
                            <span className="truncate">{displayVoice}</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playAvatarPreview(av);
                            }}
                            className={`py-1.5 px-3 rounded-xl border text-xs font-black transition-all shrink-0 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
                              isPlaying
                                ? "bg-[#6C63FF] text-white border-[#6C63FF] shadow-md shadow-[#6C63FF]/30 animate-pulse"
                                : "bg-[#6C63FF]/10 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white border-[#6C63FF]/25 shadow-sm"
                            }`}
                            title={`Test voice preview for ${av.name}`}
                          >
                            <span>{isPlaying ? "🔊 Speaking..." : "▶ Test Voice"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

export default Profile;
