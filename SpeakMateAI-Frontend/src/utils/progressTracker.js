import { progressService } from "../services/appServices";

const getStorageKey = (userContext = null) => {
  let user = userContext;
  if (!user) {
    try {
      const raw = localStorage.getItem("speakmate_user");
      if (raw) user = JSON.parse(raw);
    } catch (e) { }
  }
  const identifier = user?.id || user?.email || user?.username || "guest";
  return `speakmate_user_progress_stats_${identifier}`;
};

export const persistProgressToBackend = async (stats) => {
  if (!stats) return;
  try {
    const token = localStorage.getItem("speakmate_token") || localStorage.getItem("speakmate_auth_token");
    if (!token) return;
    progressService.update({
      xp: stats.xp || 0,
      level: Math.max(1, Math.floor((stats.xp || 0) / 500) + 1),
      currentStreak: stats.streak || 0,
      longestStreak: stats.longestStreak || stats.streak || 0,
      totalPracticeMinutes: stats.speakingMins || 0,
      totalSpeakingSessions: stats.speakingSessions || 0,
      totalGrammarChecks: stats.grammarChecks || 0,
      totalVocabularyWords: stats.wordsLearned || 0,
    }).catch(() => { });
  } catch (e) { }
};

export const getLocalDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDaysDifference = (dateStr1, dateStr2) => {
  const [y1, m1, d1] = dateStr1.split("-").map(Number);
  const [y2, m2, d2] = dateStr2.split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
};

const STREAK_MILESTONES = [
  { days: 3, xp: 50, title: "3-Day Ember 🔥", desc: "First 3 consecutive practice days." },
  { days: 7, xp: 100, title: "7-Day Flame ⚡", desc: "One full week of continuous English mastery." },
  { days: 14, xp: 200, title: "14-Day Blaze 🌟", desc: "Two straight weeks of fluency commitment." },
  { days: 30, xp: 500, title: "30-Day Phoenix 🏆", desc: "One month habit mastery with fluent reflexes." },
  { days: 50, xp: 800, title: "50-Day Titan 💎", desc: "50 days of dedication and conversational ease." },
  { days: 100, xp: 1500, title: "100-Day Centurion 👑", desc: "Legendary 100-day mastery status." },
];

// Calculate badges unlocked dynamically matching all 18 Master Achievements
export const calculateUnlockedBadges = (stats) => {
  if (!stats) return 0;
  let badges = 0;
  // 1. Speaking & Fluency (4 badges)
  if ((stats.speakingSessions || 0) >= 1) badges += 1;
  if ((stats.distinctScenarios || 0) >= 5 || (stats.speakingSessions || 0) >= 5) badges += 1;
  if ((stats.speakingSessions || 0) >= 15) badges += 1;
  if ((stats.speakingSessions || 0) >= 30) badges += 1;
  // 2. Grammar & Accuracy (4 badges)
  if ((stats.grammarChecks || 0) >= 1) badges += 1;
  if ((stats.grammarChecks || 0) >= 10) badges += 1;
  if ((stats.grammarChecks || 0) >= 25) badges += 1;
  if ((stats.grammarChecks || 0) >= 50) badges += 1;
  // 3. Vocabulary & Word Bank (3 badges)
  if ((stats.wordsLearned || 0) >= 5) badges += 1;
  if ((stats.wordsLearned || 0) >= 20) badges += 1;
  if ((stats.wordsLearned || 0) >= 50) badges += 1;
  // 4. Streaks & Consistency (4 badges)
  const maxStreak = Math.max(stats.streak || 0, stats.longestStreak || 0);
  if (maxStreak >= 3) badges += 1;
  if (maxStreak >= 7) badges += 1;
  if (maxStreak >= 14) badges += 1;
  if (maxStreak >= 30) badges += 1;
  // 5. Mastery & Experience (3 badges)
  if ((stats.xp || 0) >= 250) badges += 1;
  if ((stats.level || 1) >= 5 || (stats.xp || 0) >= 2000) badges += 1; // Level 5 Achiever (2,000 XP)
  if ((stats.xp || 0) >= 2000) badges += 1; // Mastery Grandmaster (2,000 XP)

  return badges;
};

export const getLiveProgressStats = (userContext = null) => {
  const today = getLocalDateStr();
  const storageKey = getStorageKey(userContext);
  let stored = null;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) stored = JSON.parse(raw);
  } catch (e) { }

  if (!stored) {
    stored = {
      speakingMins: 0,
      speakingSessions: 0,
      distinctScenarios: 0,
      level: 1,
      wordsLearned: 0,
      grammarChecks: 0,
      lessonsCompleted: 0,
      accuracySum: 0,
      accuracyCount: 0,
      xp: userContext?.xp || 0,
      streak: userContext?.streak || 0,
      longestStreak: userContext?.longestStreak || 0,
      streakFreezes: 1, // New users start with 1 Free Freeze ❄️
      lastActiveDate: today,
      lastGoalMetDate: null,
      lastQuoteClaimDate: null,
      badgesUnlocked: 0,
      todayMins: 0,
      claimedMilestones: [],
      streakHistory: {}, // { [dateStr]: { mins: number, status: 'completed' | 'frozen' | 'missed' } }
      brokenStreakSnapshot: null, // Holds last broken streak for 48h recovery
      lastFreeFreezeClaimedDate: null,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch (e) { }
  }

  // Ensure default fallback attributes
  if (stored.streakFreezes === undefined) stored.streakFreezes = 1;
  if (!stored.claimedMilestones) stored.claimedMilestones = [];
  if (!stored.streakHistory) stored.streakHistory = {};
  if (stored.streak === undefined || stored.streak === null) {
    stored.streak = userContext?.streak || 0;
  }
  if (stored.longestStreak === undefined || stored.longestStreak === null) {
    stored.longestStreak = stored.streak || 0;
  }

  // Accurate Streak Rollover & Missed Day Management
  if (stored.lastActiveDate !== today) {
    const diffDays = getDaysDifference(stored.lastActiveDate, today);

    if (diffDays === 1) {
      // Checked in next day. Did user meet goal yesterday?
      const wasGoalMet = stored.lastGoalMetDate === stored.lastActiveDate;
      if (!wasGoalMet && stored.streak > 0) {
        if (stored.streakFreezes > 0) {
          stored.streakFreezes -= 1;
          stored.streakHistory[stored.lastActiveDate] = { mins: stored.todayMins || 0, status: "frozen" };
        } else {
          stored.brokenStreakSnapshot = { streak: stored.streak, brokenDate: stored.lastActiveDate };
          stored.streak = 0;
          stored.streakHistory[stored.lastActiveDate] = { mins: stored.todayMins || 0, status: "missed" };
        }
      }
    } else if (diffDays === 2) {
      // Missed exactly 1 full day between last active and today
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateStr(yesterday);

      if (stored.streakFreezes > 0) {
        stored.streakFreezes -= 1;
        stored.streakHistory[yesterdayStr] = { mins: 0, status: "frozen" };
      } else {
        stored.brokenStreakSnapshot = { streak: stored.streak, brokenDate: yesterdayStr };
        stored.streak = 0;
        stored.streakHistory[yesterdayStr] = { mins: 0, status: "missed" };
      }
    } else if (diffDays > 2) {
      // Missed 2 or more consecutive days
      if (stored.streak > 0) {
        stored.brokenStreakSnapshot = { streak: stored.streak, brokenDate: stored.lastActiveDate };
        stored.streak = 0;
      }
    }

    stored.todayMins = 0;
    stored.lastActiveDate = today;
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch (e) { }
  }

  const accuracy = stored.accuracyCount > 0
    ? Math.round(stored.accuracySum / stored.accuracyCount)
    : (stored.backendAccuracy != null && stored.backendAccuracy > 0 ? Math.round(stored.backendAccuracy) : null);

  const totalHours = (stored.speakingMins / 60).toFixed(1);

  stored.badgesUnlocked = calculateUnlockedBadges(stored);

  // Generate 7-day visual calendar data aligned Monday to Sunday for the current week
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyData = [];
  const curr = new Date();
  const currentDay = curr.getDay(); // 0 is Sun, 1 is Mon...
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(curr);
  monday.setDate(curr.getDate() + mondayOffset);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dStr = getLocalDateStr(d);
    const dayName = daysOfWeek[i];
    const record = stored.streakHistory[dStr];
    const isToday = dStr === today;
    const mins = isToday ? (stored.todayMins || 0) : (record?.mins || 0);
    const isFuture = d > curr && !isToday;
    const status = isFuture
      ? "upcoming"
      : (record?.status || (mins >= 15 ? "completed" : isToday ? "active" : mins > 0 ? "completed" : "missed"));

    weeklyData.push({
      dateStr: dStr,
      day: dayName,
      studyMinutes: mins,
      status,
      isToday,
      isFuture,
      isGoalMet: mins >= 15,
    });
  }

  return {
    ...stored,
    accuracy,
    totalHours: parseFloat(totalHours),
    weeklyData,
    milestones: STREAK_MILESTONES,
  };
};

export const saveProgressStats = (stats, userContext = null, syncToBackend = true) => {
  const key = getStorageKey(userContext);
  try {
    localStorage.setItem(key, JSON.stringify(stats));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("speakmate_progress_updated", { detail: stats }));
    }
  } catch (e) { }

  if (syncToBackend) {
    persistProgressToBackend(stats);
  }
};

export const syncBackendProgress = (backendData, userContext = null) => {
  if (!backendData) return getLiveProgressStats(userContext);
  const current = getLiveProgressStats(userContext);

  const rawBackendXp = backendData.xp ?? backendData.progress?.xp ?? backendData.profile?.xp;
  const rawBackendStreak = backendData.streak ?? backendData.progress?.currentStreak ?? backendData.progress?.streak;
  const rawBackendMins = backendData.progress?.totalPracticeMinutes ?? backendData.totalPracticeMinutes;

  let finalXp = Number(current.xp || 0);
  let shouldPushToBackend = false;

  if (rawBackendXp !== undefined && rawBackendXp !== null) {
    const backendXp = Number(rawBackendXp);
    const didSpendRecently = Boolean(current.lastSpentAt && (Date.now() - current.lastSpentAt < 120000));

    if (didSpendRecently && current.xp < backendXp) {
      // User recently spent XP on a freeze or streak repair locally. Preserve deduction!
      finalXp = current.xp;
      shouldPushToBackend = true;
    } else {
      // Backend DB is the authoritative single source of truth for user XP.
      finalXp = backendXp;
      shouldPushToBackend = false;
    }
  } else if (userContext?.xp !== undefined && userContext?.xp !== null) {
    finalXp = Number(userContext.xp);
  }

  const finalStreak = rawBackendStreak !== undefined && rawBackendStreak !== null
    ? Math.max(Number(current.streak || 0), Number(rawBackendStreak))
    : Number(current.streak || 0);

  const backendStats = backendData.statistics || {};
  const rawBackendAvgScore = backendStats.averageScore ?? backendData.averageScore;
  const rawBackendVocab = backendStats.vocabularyLearned ?? backendData.progress?.totalVocabularyWords ?? backendData.profile?.totalVocabularyWords;
  const rawBackendSessions = backendStats.speakingSessions ?? backendData.progress?.totalSpeakingSessions ?? backendData.profile?.totalSpeakingSessions;
  const rawBackendDistinctScenarios = backendStats.distinctScenarios ?? backendData.progress?.distinctSpeakingScenarios ?? backendData.distinctScenarios;
  const rawBackendGrammar = backendStats.grammarExercises ?? backendData.progress?.totalGrammarChecks ?? backendData.profile?.totalGrammarChecks;
  const rawBackendLessons = backendStats.completedLessons ?? backendData.completedLessons;

  let finalMins = Number(current.speakingMins || 0);
  if (backendStats.totalStudyHours != null) {
    finalMins = Math.round(Number(backendStats.totalStudyHours) * 60);
  } else if (rawBackendMins !== undefined && rawBackendMins !== null) {
    finalMins = Number(rawBackendMins);
  }

  const backendAccuracy = rawBackendAvgScore !== undefined && rawBackendAvgScore !== null && Number(rawBackendAvgScore) > 0
    ? Number(rawBackendAvgScore)
    : (current.backendAccuracy || null);

  const finalWords = rawBackendVocab !== undefined && rawBackendVocab !== null
    ? Math.max(Number(current.wordsLearned || 0), Number(rawBackendVocab))
    : Number(current.wordsLearned || 0);

  const finalSessions = rawBackendSessions !== undefined && rawBackendSessions !== null
    ? Number(rawBackendSessions)
    : Number(current.speakingSessions || 0);

  const finalDistinctScenarios = rawBackendDistinctScenarios !== undefined && rawBackendDistinctScenarios !== null
    ? Number(rawBackendDistinctScenarios)
    : Number(current.distinctScenarios || 0);

  const finalGrammar = rawBackendGrammar !== undefined && rawBackendGrammar !== null
    ? Math.max(Number(current.grammarChecks || 0), Number(rawBackendGrammar))
    : Number(current.grammarChecks || 0);

  const finalLessons = rawBackendLessons !== undefined && rawBackendLessons !== null
    ? Math.max(Number(current.lessonsCompleted || 0), Number(rawBackendLessons))
    : Number(current.lessonsCompleted || 0);

  const rawBackendFreezes = backendData.streakFreezes ?? backendData.progress?.streakFreezes ?? backendData.profile?.streakFreezes;
  const finalFreezes = rawBackendFreezes !== undefined && rawBackendFreezes !== null
    ? Number(rawBackendFreezes)
    : Number(current.streakFreezes ?? 1);

  const finalHours = parseFloat(((finalMins || 0) / 60).toFixed(1));

  const synced = {
    ...current,
    xp: finalXp,
    level: Math.max(1, Math.floor((finalXp || 0) / 500) + 1),
    streak: finalStreak,
    speakingMins: finalMins,
    totalHours: finalHours,
    longestStreak: Math.max(current.longestStreak || 0, finalStreak),
    wordsLearned: finalWords,
    speakingSessions: finalSessions,
    distinctScenarios: finalDistinctScenarios,
    grammarChecks: finalGrammar,
    lessonsCompleted: finalLessons,
    backendAccuracy,
    streakFreezes: finalFreezes,
  };

  const calculatedBadges = calculateUnlockedBadges(synced);
  synced.badgesUnlocked = backendData.badgesUnlocked != null ? Number(backendData.badgesUnlocked) : calculatedBadges;

  saveProgressStats(synced, userContext, false);

  if (shouldPushToBackend) {
    persistProgressToBackend(synced);
  }

  return synced;
};

// Check and increment streak when daily target is satisfied
const checkAndUpdateDailyGoal = (stats, userContext = null) => {
  const today = getLocalDateStr();
  const rawGoal = localStorage.getItem("speakmate_daily_goal") || "15";
  const dailyGoalMins = parseInt(userContext?.dailyGoalMins || rawGoal, 10) || 15;

  stats.todayMins = stats.todayMins || 0;
  if (!stats.streakHistory) stats.streakHistory = {};
  stats.streakHistory[today] = { mins: stats.todayMins, status: stats.todayMins >= dailyGoalMins ? "completed" : "active" };

  if (stats.todayMins >= dailyGoalMins && stats.lastGoalMetDate !== today) {
    stats.lastGoalMetDate = today;
    stats.streak = (stats.streak || 0) + 1;
    stats.longestStreak = Math.max(stats.longestStreak || 1, stats.streak);
  }
};

// 1. Record Speaking Practice (+3 to +45 XP based on effort and score)
export const recordSpeakingSession = (durationMins = 5, accuracyScore = 90, userContext = null) => {
  if (durationMins <= 0 || accuracyScore <= 0) {
    return getLiveProgressStats(userContext);
  }
  const stats = getLiveProgressStats(userContext);
  stats.speakingMins += durationMins;
  stats.todayMins = (stats.todayMins || 0) + durationMins;
  stats.speakingSessions += 1;
  stats.accuracySum += accuracyScore;
  stats.accuracyCount += 1;

  const timeReward = Math.min(25, Math.max(3, durationMins * 5));
  const scoreBonus = accuracyScore >= 90 ? 15 : (accuracyScore >= 80 ? 10 : (accuracyScore >= 60 ? 5 : 0));
  stats.xp += Math.min(45, Math.max(3, timeReward + scoreBonus));

  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

// 2. Record Grammar Practice (+8 XP)
export const recordGrammarCheck = (accuracyScore = 95, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  stats.grammarChecks += 1;
  stats.todayMins = (stats.todayMins || 0) + 1;
  stats.accuracySum += accuracyScore;
  stats.accuracyCount += 1;
  stats.xp += 8;

  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

// 3. Record Vocabulary Mastered (0 XP - mastering earns 0 XP, adding earns 5 XP)
export const recordVocabularyMastered = (count = 1, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  // Do not award XP for mastering words (0 XP)
  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

// 4. Record Word Added (+5 XP)
export const recordWordAdded = (count = 1, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  stats.wordsLearned += count;
  stats.todayMins = (stats.todayMins || 0) + 1;
  stats.xp += count * 5;

  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

// 4b. Record Word Deleted
export const recordWordDeleted = (count = 1, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  stats.wordsLearned = Math.max(0, (stats.wordsLearned || 0) - count);
  saveProgressStats(stats, userContext);
  return stats;
};

// 5. Record AI Chat Message (+5 XP)
export const recordChatMessage = (count = 1, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  stats.todayMins = (stats.todayMins || 0) + 1;
  stats.xp += count * 5;

  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

// 6. Record Lesson Completion (+35 XP)
export const recordLessonCompleted = (accuracyScore = 90, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  stats.lessonsCompleted += 1;
  stats.todayMins = (stats.todayMins || 0) + 5;
  stats.accuracySum += accuracyScore;
  stats.accuracyCount += 1;
  stats.xp += 35;

  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

// 7. Record Quiz Completed (+35 to +50 XP)
export const recordQuizCompleted = (quizType = "grammar", score = 8, total = 8, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  const baseXP = score * 5;
  const perfectBonus = score === total && total > 0 ? 10 : 0;
  const totalAwarded = baseXP + perfectBonus;

  if (quizType === "grammar") {
    stats.grammarChecks += score;
  } else {
    stats.wordsLearned += score;
  }
  stats.todayMins = (stats.todayMins || 0) + 3;
  stats.xp += totalAwarded;

  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

// 8. Buy Streak Freeze using XP (100 XP per Freeze)
export const buyStreakFreeze = async (costXP = 100, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  if (stats.xp < costXP) {
    return { success: false, stats, message: `Insufficient XP. You need ${costXP} XP to buy a Streak Freeze.` };
  }

  try {
    const backendRes = await progressService.buyFreeze();
    if (backendRes) {
      stats.xp = backendRes.xp !== undefined && backendRes.xp !== null ? backendRes.xp : (stats.xp - costXP);
      stats.streakFreezes = backendRes.streakFreezes !== undefined && backendRes.streakFreezes !== null ? backendRes.streakFreezes : ((stats.streakFreezes || 0) + 1);
      stats.lastUpdatedTime = Date.now();
      stats.lastSpentAt = Date.now();
      saveProgressStats(stats, userContext, false);
      return { success: true, stats, message: "Streak Freeze ❄️ added to your reserve!" };
    }
  } catch (err) {
    console.warn("Backend buyFreeze offline fallback:", err);
  }

  stats.xp -= costXP;
  stats.streakFreezes = (stats.streakFreezes || 0) + 1;
  stats.lastUpdatedTime = Date.now();
  stats.lastSpentAt = Date.now();
  saveProgressStats(stats, userContext, true);
  return { success: true, stats, message: "Streak Freeze ❄️ added to your reserve!" };
};

// 9. Repair Broken Streak with XP (150 XP to recover lost streak within 48 hours)
export const repairBrokenStreak = (costXP = 150, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  if (!stats.brokenStreakSnapshot || !stats.brokenStreakSnapshot.streak) {
    return { success: false, stats, message: "No broken streak eligible for recovery." };
  }

  if (stats.xp < costXP) {
    return { success: false, stats, message: `Insufficient XP. You need ${costXP} XP to repair your streak.` };
  }

  stats.xp -= costXP;
  stats.streak = stats.brokenStreakSnapshot.streak + 1;
  stats.longestStreak = Math.max(stats.longestStreak || 1, stats.streak);
  stats.brokenStreakSnapshot = null;
  stats.lastUpdatedTime = Date.now();
  stats.lastSpentAt = Date.now();
  saveProgressStats(stats, userContext);
  return { success: true, stats, message: `Streak Repaired! Restored to ${stats.streak}-Day Streak 🔥` };
};

// 10. Claim Milestone XP Reward
export const claimStreakMilestoneReward = (days = 3, userContext = null) => {
  const stats = getLiveProgressStats(userContext);
  const milestone = STREAK_MILESTONES.find((m) => m.days === days);
  if (!milestone) return { success: false, message: "Milestone not found." };

  if (stats.claimedMilestones && stats.claimedMilestones.includes(days)) {
    return { success: false, message: "Reward already claimed." };
  }

  if (stats.streak < days && (stats.longestStreak || 0) < days) {
    return { success: false, message: `Reach a ${days}-day streak to claim this milestone!` };
  }

  stats.xp += milestone.xp;
  if (!stats.claimedMilestones) stats.claimedMilestones = [];
  stats.claimedMilestones.push(days);
  stats.lastUpdatedTime = Date.now();
  saveProgressStats(stats, userContext);
  return { success: true, stats, message: `🎉 Claimed +${milestone.xp} Bonus XP for ${milestone.title}!` };
};

// 11. Claim Daily Inspiration Quote XP (+20 XP, Strictly 1 time per day)
export const getDailyQuoteClaimKey = (userContext = null, dateStr = getLocalDateStr()) => {
  let user = userContext;
  if (!user) {
    try {
      const raw = localStorage.getItem("speakmate_user");
      if (raw) user = JSON.parse(raw);
    } catch (_) {}
  }
  const identifier = (user?.email || user?.id || user?.username || "guest").toString().toLowerCase().trim();
  return `speakmate_daily_quote_claimed_${identifier}_${dateStr}`;
};

export const isDailyQuoteClaimedToday = (userContext = null) => {
  const today = getLocalDateStr();
  const dedicatedKey = getDailyQuoteClaimKey(userContext, today);
  try {
    if (localStorage.getItem(dedicatedKey) === "true") {
      return true;
    }
  } catch (_) {}

  const stats = getLiveProgressStats(userContext);
  return stats?.lastQuoteClaimDate === today;
};

export const claimDailyQuoteXP = (amount = 20, userContext = null) => {
  const today = getLocalDateStr();
  const dedicatedKey = getDailyQuoteClaimKey(userContext, today);
  const stats = getLiveProgressStats(userContext);

  if (isDailyQuoteClaimedToday(userContext)) {
    return { success: false, stats, message: "You have already accepted today's quote goal!" };
  }

  stats.xp = (stats.xp || 0) + amount;
  stats.lastQuoteClaimDate = today;
  stats.lastUpdatedTime = Date.now();

  try {
    localStorage.setItem(dedicatedKey, "true");
  } catch (_) {}

  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return { success: true, stats, message: `🎉 +${amount} XP earned! Today's goal accepted!` };
};

// 12. Record Warmup Practice (+30 XP without injecting artificial speech scores)
export const recordWarmupSession = (durationMins = 5, xpReward = 30, userContext = null) => {
  if (durationMins <= 0) return getLiveProgressStats(userContext);
  const stats = getLiveProgressStats(userContext);
  stats.speakingMins += durationMins;
  stats.todayMins = (stats.todayMins || 0) + durationMins;
  stats.xp = (stats.xp || 0) + xpReward;
  checkAndUpdateDailyGoal(stats, userContext);
  saveProgressStats(stats, userContext);
  return stats;
};

