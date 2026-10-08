import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ROUTES from "../constants/routes";
import { dashboardService, progressService, achievementService } from "../services/appServices";
import { setCachedDashboardData, getCachedDashboardData, clearDashboardCache } from "../utils/dashboardCache";
import { CurriculumCache } from "../utils/curriculumCache";
import { syncBackendProgress, getLiveProgressStats } from "../utils/progressTracker";
import { SpeakMateLoader } from "../components/common/SpeakMateLoader";

export function Login() {
  const { login, setIsPostLoginLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginType, setLoginType] = useState("STANDARD"); // "STANDARD" | "SCHOOL"
  const [schoolCode, setSchoolCode] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transitioningUser, setTransitioningUser] = useState(null);
  const [touched, setTouched] = useState({
    schoolCode: false,
    email: false,
    password: false,
  });
  const infoMessage = location.state?.infoMessage || "";

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const getSchoolCodeError = () => {
    if (loginType === "SCHOOL" && touched.schoolCode && !schoolCode.trim()) {
      return "School Code is required (e.g. SCH-1082).";
    }
    return null;
  };

  const getEmailError = () => {
    if (!touched.email) return null;
    const trimmed = form.email.trim();
    if (!trimmed) {
      return loginType === "SCHOOL" ? "Student ID or Email is required." : "Email address is required.";
    }
    if (loginType === "STANDARD" && !EMAIL_REGEX.test(trimmed)) {
      return "Please enter a valid email address.";
    }
    if (loginType === "SCHOOL" && !trimmed.includes("@") && trimmed.length < 3) {
      return "Student ID must be at least 3 characters.";
    }
    return null;
  };

  const getPasswordError = () => {
    if (!touched.password) return null;
    if (!form.password) return "Password is required.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    return null;
  };

  const handleTabChange = (type) => {
    if (loginType === type) return;
    setLoginType(type);
    setForm({ email: "", password: "" });
    setSchoolCode("");
    setError("");
    setTouched({ schoolCode: false, email: false, password: false });
    setShowPassword(false);
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    setTouched({ schoolCode: true, email: true, password: true });
    setError("");

    if (loginType === "SCHOOL" && !schoolCode.trim()) {
      setError("Please enter your School Code (e.g. SCH-1082).");
      return;
    }

    const trimmedEmail = form.email.trim();
    if (!trimmedEmail) {
      setError(loginType === "SCHOOL" ? "Please enter your Student ID or Email." : "Please enter your email address.");
      return;
    }
    if (loginType === "STANDARD" && !EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (loginType === "SCHOOL" && !trimmedEmail.includes("@") && trimmedEmail.length < 3) {
      setError("Student ID must be at least 3 characters.");
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      if (loginType === "SCHOOL") {
        localStorage.setItem("speakmate_account_type", "STUDENT");
        localStorage.setItem("speakmate_school_code", schoolCode.trim().toUpperCase());
      } else {
        localStorage.setItem("speakmate_account_type", "INDIVIDUAL_USER");
        localStorage.removeItem("speakmate_school_code");
        localStorage.removeItem("speakmate_school_grade");
        localStorage.removeItem("speakmate_standard");
      }

      const res = await login({
        email: form.email.trim(),
        password: form.password,
        schoolCode: loginType === "SCHOOL" ? schoolCode.trim().toUpperCase() : undefined,
      });

      const isCompleted = Boolean(res?.user?.onboardingCompleted);

      if (res && res.user && !isCompleted) {
        navigate(ROUTES.ONBOARDING, { replace: true });
      } else {
        const userEmail = (res?.user?.email || form.email || "").toLowerCase().trim();
        const authenticatedUser = res?.user || {};
        const isStudentUser = Boolean(
          (loginType === "SCHOOL" ||
          authenticatedUser.accountType === "STUDENT" ||
          authenticatedUser.isSchoolStudent ||
          authenticatedUser.role === "STUDENT") &&
          authenticatedUser.role !== "USER" &&
          authenticatedUser.role !== "TEACHER" &&
          authenticatedUser.role !== "SCHOOL_ADMIN" &&
          authenticatedUser.role !== "ADMIN" &&
          authenticatedUser.role !== "SUPER_ADMIN"
        );
        const displayName = authenticatedUser.firstName || authenticatedUser.name || (userEmail ? userEmail.split("@")[0] : "Learner");
        const isProUser = Boolean((authenticatedUser.isPro || authenticatedUser.pro) && authenticatedUser.subscriptionPlan && authenticatedUser.subscriptionPlan !== "FREE");

        // 1. Show the branded theme-aware loader immediately
        setIsPostLoginLoading(true);
        setTransitioningUser({
          name: displayName,
          avatar: authenticatedUser.avatar,
          isStudent: isStudentUser,
          grade: authenticatedUser.schoolGrade || (isStudentUser ? "Student" : null),
          isPro: !isStudentUser && isProUser,
          email: userEmail,
        });

        // 2. Fetch fresh dashboard summary & achievements while the loader is displayed
        try {
          const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 800));
          const summaryPromise = dashboardService.summary().catch(() => null);
          const achsPromise = achievementService.all().catch(() => null);
          const maxSafetyTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 10000));

          const [summaryData, achsData] = await Promise.all([
            Promise.race([summaryPromise, maxSafetyTimeoutPromise]),
            Promise.race([achsPromise, maxSafetyTimeoutPromise]),
            minDelayPromise,
          ]);

          if (summaryData) {
            const synced = syncBackendProgress(summaryData, authenticatedUser);
            const backendStats = summaryData.statistics || {};
            const backendAccuracy = backendStats.averageScore > 0 ? backendStats.averageScore : null;
            const verifiedAchsCount = Array.isArray(achsData) && achsData.length > 0
              ? achsData.filter((a) => a.unlocked).length
              : (Array.isArray(summaryData.achievements) && summaryData.achievements.length > 0
                ? summaryData.achievements.filter((a) => a.unlocked).length
                : null);

            const finalBadgesUnlocked = verifiedAchsCount != null
              ? verifiedAchsCount
              : (summaryData.badgesUnlocked != null ? Number(summaryData.badgesUnlocked) : (synced.badgesUnlocked ?? 0));

            const finalAccuracy =
              synced.accuracy ??
              backendAccuracy ??
              summaryData.accuracy ??
              null;

            const finalHours = backendStats.totalStudyHours != null
              ? Number(backendStats.totalStudyHours)
              : (synced.totalHours != null ? Number(synced.totalHours) : 0.0);

            const finalWords =
              backendStats.vocabularyLearned ??
              summaryData.progress?.totalVocabularyWords ??
              synced.wordsLearned ??
              0;

            const finalSummary = {
              ...summaryData,
              ...synced,
              badgesUnlocked: finalBadgesUnlocked,
              accuracy: finalAccuracy,
              totalHours: finalHours,
              wordsLearned: finalWords,
              streak: Number(synced.streak ?? summaryData.streak ?? summaryData.progress?.streak ?? 0),
              xp: Number(synced.xp ?? summaryData.progress?.xp ?? summaryData.xp ?? 0),
              streakFreezes: Number(synced.streakFreezes ?? summaryData.progress?.streakFreezes ?? 0),
              todayMins: synced.todayMins ?? 0,
              completedMins: synced.todayMins ?? 0,
              dailyGoalMins: summaryData.dailyGoal?.targetSpeakingMinutes || summaryData.dailyGoal?.dailyGoalMinutes || 15,
              _syncedFromServer: true,
            };

            setCachedDashboardData(finalSummary, userEmail);
            const identifier = authenticatedUser?.id || authenticatedUser?.email || userEmail;
            try {
              localStorage.setItem(`speakmate_user_progress_stats_${identifier}`, JSON.stringify(synced));
            } catch (_) {}
            window.dispatchEvent(new CustomEvent("speakmate_progress_updated", { detail: synced }));
          }
        } catch (prepErr) {
          console.warn("Dashboard prefetch error:", prepErr);
        }

        // 3. AFTER loading is complete and actual data is saved: navigate to Dashboard
        navigate(ROUTES.DASHBOARD, { replace: true });
        setTimeout(() => {
          setIsPostLoginLoading(false);
          setTransitioningUser(null);
        }, 120);
      }
    } catch (err) {
      console.error("Login failed:", err);
      setIsPostLoginLoading(false);
      setTransitioningUser(null);
      const serverMsg = err.userMessage || err.response?.data?.message || err.message;
      let displayMsg = serverMsg;
      if (serverMsg && (serverMsg.toLowerCase().includes("deactivated") || serverMsg.toLowerCase().includes("restricted"))) {
        displayMsg = serverMsg;
      } else if (!serverMsg || serverMsg.toLowerCase() === "invalid email" || serverMsg.toLowerCase().includes("user not found") || serverMsg.toLowerCase().includes("no account found")) {
        displayMsg = "No account found with this email address. Please check your email or register.";
      } else if (serverMsg.toLowerCase() === "incorrect password") {
        displayMsg = "Incorrect password. Please try again or use 'Forgot password?'.";
      } else if (serverMsg.toLowerCase().includes("invalid credentials")) {
        displayMsg = "Invalid credentials. Please check your details and try again.";
      }
      setError(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto relative z-10">
      <div className="glass-card p-6 sm:p-10 lg:p-12 rounded-3xl border border-[var(--border-default)] shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Feature Showcase Panel (Desktop Web App Style) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between space-y-8 bg-gradient-to-br from-[#6C63FF]/15 via-[#8B5CF6]/10 to-[#FF6584]/15 p-8 rounded-3xl border border-[#6C63FF]/20 shadow-inner">
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6C63FF] via-[#7C74FF] to-[#FF6584] flex items-center justify-center text-3xl shadow-xl shadow-[#6C63FF]/30">
                🗣️
              </div>
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-[#6C63FF]/20 text-[#6C63FF] border border-[#6C63FF]/30 uppercase tracking-wider">
                  AI-Powered Learning
                </span>
                <h2 className="text-2xl font-black text-[var(--text-primary)] leading-tight">
                  Speak Confidently, Speak Naturally.
                </h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  Join thousands of learners mastering spoken English with real-time AI conversation and instant feedback.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center gap-3 text-xs font-bold text-[var(--text-primary)]">
                  <span className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-base shadow-sm">
                    🎙️
                  </span>
                  <span>Instant voice pronunciation analysis</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-[var(--text-primary)]">
                  <span className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-base shadow-sm">
                    ⚡
                  </span>
                  <span>100+ interactive speaking scenarios</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-[var(--text-primary)]">
                  <span className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-base shadow-sm">
                    🏆
                  </span>
                  <span>Track streaks and fluency milestones</span>
                </div>
              </div>
            </div>

            {/* Live Streak Card */}
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--border-default)] flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="text-xs font-black text-[var(--text-primary)]">Daily Fluency Streak</p>
                  <p className="text-[10px] font-bold text-emerald-500">Active & growing every day</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white text-xs font-black shadow-sm">
                98% Score
              </span>
            </div>
          </div>

          {/* Right Login Form Container */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Header */}
            <div className="space-y-2">
              <div className="flex lg:hidden w-12 h-12 mb-3 rounded-2xl bg-gradient-to-tr from-[#6C63FF] via-[#7C74FF] to-[#FF6584] items-center justify-center text-2xl shadow-lg shadow-[#6C63FF]/30">
                🗣️
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">Welcome Back</h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">Sign in to continue your English fluency streak</p>
            </div>

            {/* Tab Segmented Control */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white shadow-md shadow-[#6C63FF]/25 text-center transition-all"
              >
                🔑 Log In
              </button>
              <Link
                to={ROUTES.REGISTER}
                className="flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-center transition-all"
              >
                ✨ Register
              </Link>
            </div>

            {/* Login Method Sub-Toggle (Personal vs Student) */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--bg-elevated)]/60 border border-[var(--border-default)]">
              <button
                type="button"
                onClick={() => handleTabChange("STANDARD")}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  loginType === "STANDARD"
                    ? "bg-[var(--bg-surface)] text-[#6C63FF] shadow-sm border border-[var(--border-default)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>👤 Personal</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("SCHOOL")}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  loginType === "SCHOOL"
                    ? "bg-[var(--bg-surface)] text-[#6C63FF] shadow-sm border border-[var(--border-default)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>🎓 Student</span>
              </button>
            </div>

            {/* Info Message Banner */}
            {infoMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 space-y-1">
                <p className="font-black">🎉 Registration Successful!</p>
                <p className="font-medium opacity-90">{infoMessage}</p>
              </div>
            )}

            {/* Error Message Banner */}
            {error && (
              error.toLowerCase().includes("deactivated") || error.toLowerCase().includes("restricted") ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-700 dark:text-rose-300 shadow-md space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-600 text-white shadow-xs">
                      <span className="text-base">🚫</span>
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-tight text-rose-800 dark:text-rose-200 uppercase">
                        Account Access Restricted
                      </p>
                      <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        Status: Deactivated / Inactive
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-rose-700 dark:text-rose-200 pl-1 border-l-2 border-rose-500/40 ml-1">
                    {error}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] italic pl-1">
                    If you believe your account was deactivated in error, please contact your school administrator or reach out to support.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 space-y-1">
                  <p className="font-black">⚠️ Authentication Notice</p>
                  <p className="font-medium opacity-90">{error}</p>
                </div>
              )
            )}

            {/* Login Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              {loginType === "SCHOOL" && (
                <div>
                  <label className="block text-xs font-black text-[var(--text-primary)] uppercase tracking-wider mb-2">
                    School Code
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-base text-[var(--text-muted)]">🏫</span>
                    <input
                      type="text"
                      placeholder="e.g. SCH-1082"
                      value={schoolCode}
                      onChange={(e) => {
                        setSchoolCode(e.target.value.toUpperCase());
                        if (error) setError("");
                      }}
                      onBlur={() => setTouched((p) => ({ ...p, schoolCode: true }))}
                      required
                      className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border ${
                        getSchoolCodeError()
                          ? "border-rose-500 ring-2 ring-rose-500/20"
                          : "border-[var(--border-default)]"
                      } bg-[var(--bg-elevated)] text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 transition-all tracking-wider uppercase`}
                    />
                  </div>
                  {getSchoolCodeError() && (
                    <p className="text-xs font-semibold text-rose-500 mt-1.5 ml-1">
                      {getSchoolCodeError()}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-[var(--text-primary)] uppercase tracking-wider mb-2">
                  {loginType === "SCHOOL" ? "Student ID or Email" : "Email Address"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-base text-[var(--text-muted)]">✉️</span>
                  <input
                    type={loginType === "SCHOOL" ? "text" : "email"}
                    placeholder={loginType === "SCHOOL" ? "e.g. STU-1082 or student@school.edu" : "you@example.com"}
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      if (error) setError("");
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                    required
                    className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border ${
                      getEmailError()
                        ? "border-rose-500 ring-2 ring-rose-500/20"
                        : "border-[var(--border-default)]"
                    } bg-[var(--bg-elevated)] text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 transition-all`}
                  />
                </div>
                {getEmailError() && (
                  <p className="text-xs font-semibold text-rose-500 mt-1.5 ml-1">
                    {getEmailError()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-[var(--text-primary)] uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-base text-[var(--text-muted)]">🔒</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      if (error) setError("");
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                    required
                    className={`w-full pl-12 pr-12 py-3.5 rounded-2xl border ${
                      getPasswordError()
                        ? "border-rose-500 ring-2 ring-rose-500/20"
                        : "border-[var(--border-default)]"
                    } bg-[var(--bg-elevated)] text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-[var(--text-muted)] hover:text-[#6C63FF] transition-colors focus:outline-none flex items-center justify-center"
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <EyeOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {getPasswordError() && (
                  <p className="text-xs font-semibold text-rose-500 mt-1.5 ml-1">
                    {getPasswordError()}
                  </p>
                )}
                <div className="flex justify-end mt-2">
                  <Link
                    to={ROUTES.FORGOT_PASSWORD}
                    className="text-xs font-bold text-[#6C63FF] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#6C63FF] via-[#7C74FF] to-[#8B5CF6] hover:from-[#7C74FF] hover:to-[#9D71FB] active:scale-[0.99] disabled:opacity-50 text-white font-black text-sm shadow-xl shadow-[#6C63FF]/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>{loginType === "SCHOOL" ? "Sign In as Student 🎓" : "Sign In to SpeakMate AI"}</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* Branded Post-Login Theme-Aware Transition Loader */}
      {transitioningUser && (
        <SpeakMateLoader
          fullScreen
          message="Loading dashboard..."
          subMessage={`Welcome back, ${transitioningUser.name}! Synchronizing your stats & streak`}
        />
      )}
    </div>
  );
}

export default Login;
