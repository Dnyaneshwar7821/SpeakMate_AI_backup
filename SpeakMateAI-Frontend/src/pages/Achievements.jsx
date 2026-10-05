import { useState, useEffect, useMemo } from "react";
import { achievementService, dashboardService } from "../services/appServices";
import { getLiveProgressStats, syncBackendProgress, saveProgressStats } from "../utils/progressTracker";

const MASTER_ACHIEVEMENTS = [
  // --- Speaking & Fluency ---
  {
    id: "spk_1",
    category: "SPEAKING",
    icon: "🎙️",
    tier: 1,
    tierName: "Bronze",
    title: "First Voice Conversation",
    description: "Complete your very 1st AI speaking practice session.",
    target: 1,
    metricKey: "speakingSessions",
    xpReward: 50,
  },
  {
    id: "spk_2",
    category: "SPEAKING",
    icon: "💬",
    tier: 2,
    tierName: "Silver",
    title: "Confident Conversationalist",
    description: "Complete 5 distinct AI speaking conversations.",
    target: 5,
    metricKey: "distinctScenarios",
    xpReward: 120,
  },
  {
    id: "spk_3",
    category: "SPEAKING",
    icon: "⚡",
    tier: 3,
    tierName: "Gold",
    title: "Fluency Champion",
    description: "Complete 15 speaking sessions across various scenarios.",
    target: 15,
    metricKey: "speakingSessions",
    xpReward: 250,
  },
  {
    id: "spk_4",
    category: "SPEAKING",
    icon: "🏆",
    tier: 4,
    tierName: "Diamond",
    title: "Orator Supreme",
    description: "Complete 30 speaking sessions with high conversational stamina.",
    target: 30,
    metricKey: "speakingSessions",
    xpReward: 500,
  },

  // --- Grammar & Accuracy ---
  {
    id: "grm_1",
    category: "GRAMMAR",
    icon: "📝",
    tier: 1,
    tierName: "Bronze",
    title: "Grammar Inspector",
    description: "Perform your first instant sentence grammar analysis.",
    target: 1,
    metricKey: "grammarChecks",
    xpReward: 40,
  },
  {
    id: "grm_2",
    category: "GRAMMAR",
    icon: "🔍",
    tier: 2,
    tierName: "Silver",
    title: "Syntax Detective",
    description: "Complete 10 sentence grammar checks and error corrections.",
    target: 10,
    metricKey: "grammarChecks",
    xpReward: 100,
  },
  {
    id: "grm_3",
    category: "GRAMMAR",
    icon: "📖",
    tier: 3,
    tierName: "Gold",
    title: "Tense Master",
    description: "Analyze 25 sentences and explore handbook rules.",
    target: 25,
    metricKey: "grammarChecks",
    xpReward: 200,
  },
  {
    id: "grm_4",
    category: "GRAMMAR",
    icon: "🎖️",
    tier: 4,
    tierName: "Diamond",
    title: "Grammar Scholar",
    description: "Complete 50 comprehensive grammar checks.",
    target: 50,
    metricKey: "grammarChecks",
    xpReward: 450,
  },

  // --- Vocabulary & Word Bank ---
  {
    id: "voc_1",
    category: "VOCABULARY",
    icon: "💡",
    tier: 1,
    tierName: "Bronze",
    title: "Word Collector",
    description: "Save and master 5 vocabulary words in your word bank.",
    target: 5,
    metricKey: "wordsLearned",
    xpReward: 50,
  },
  {
    id: "voc_2",
    category: "VOCABULARY",
    icon: "📚",
    tier: 2,
    tierName: "Silver",
    title: "Lexicon Expander",
    description: "Master 20 vocabulary flashcards and collocations.",
    target: 20,
    metricKey: "wordsLearned",
    xpReward: 120,
  },
  {
    id: "voc_3",
    category: "VOCABULARY",
    icon: "🧠",
    tier: 3,
    tierName: "Gold",
    title: "Vocabulary Maestro",
    description: "Build an active lexicon of 50 mastered words.",
    target: 50,
    metricKey: "wordsLearned",
    xpReward: 300,
  },

  // --- Streaks & Consistency ---
  {
    id: "stk_1",
    category: "STREAKS",
    icon: "🔥",
    tier: 1,
    tierName: "Bronze",
    title: "3-Day Habit Starter",
    description: "Maintain a consecutive 3-day learning streak.",
    target: 3,
    metricKey: "streak",
    xpReward: 60,
  },
  {
    id: "stk_2",
    category: "STREAKS",
    icon: "🛡️",
    tier: 2,
    tierName: "Silver",
    title: "7-Day Week Warrior",
    description: "Complete daily practice for 7 days in a row.",
    target: 7,
    metricKey: "streak",
    xpReward: 150,
  },
  {
    id: "stk_3",
    category: "STREAKS",
    icon: "✨",
    tier: 3,
    tierName: "Gold",
    title: "14-Day Dedication",
    description: "Maintain an unbroken 14-day study streak.",
    target: 14,
    metricKey: "streak",
    xpReward: 300,
  },
  {
    id: "stk_4",
    category: "STREAKS",
    icon: "🌟",
    tier: 4,
    tierName: "Diamond",
    title: "30-Day Legend",
    description: "Achieve a monumental 30-day streak of daily English growth.",
    target: 30,
    metricKey: "streak",
    xpReward: 600,
  },

  // --- Mastery & Experience ---
  {
    id: "mst_1",
    category: "MASTERY",
    icon: "⭐",
    tier: 1,
    tierName: "Bronze",
    title: "XP Explorer",
    description: "Earn a total of 250 XP across all learning activities.",
    target: 250,
    metricKey: "xp",
    xpReward: 75,
  },
  {
    id: "mst_2",
    category: "MASTERY",
    icon: "💎",
    tier: 2,
    tierName: "Silver",
    title: "Level 5 Achiever",
    description: "Reach Level 5 Learner status by accumulating 2,000 XP.",
    target: 5,
    metricKey: "level",
    xpReward: 200,
  },
  {
    id: "mst_3",
    category: "MASTERY",
    icon: "👑",
    tier: 4,
    tierName: "Diamond",
    title: "Mastery Grandmaster",
    description: "Accumulate 2,000 XP to establish true English mastery.",
    target: 2000,
    metricKey: "xp",
    xpReward: 1000,
  },
];

const CATEGORIES = [
  { id: "ALL", name: "All Medals", icon: "🏆" },
  { id: "SPEAKING", name: "Speaking", icon: "🎙️" },
  { id: "GRAMMAR", name: "Grammar", icon: "📚" },
  { id: "VOCABULARY", name: "Vocab", icon: "💡" },
  { id: "STREAKS", name: "Streaks", icon: "⚡" },
  { id: "MASTERY", name: "Mastery", icon: "👑" },
];

export function Achievements() {
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedFilter, setSelectedFilter] = useState("ALL"); // 'ALL' | 'UNLOCKED' | 'LOCKED'
  const [searchQuery, setSearchQuery] = useState("");
  const [liveStats, setLiveStats] = useState(() => getLiveProgressStats());
  const [backendAchievements, setBackendAchievements] = useState([]);

  const syncAchievements = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        achievementService.all().catch(() => []),
        dashboardService.summary().catch(() => null),
      ]);
      setBackendAchievements(list || []);
      if (summary) {
        syncBackendProgress(summary);
      }
      setLiveStats(getLiveProgressStats());
    } catch (e) {
      setLiveStats(getLiveProgressStats());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncAchievements(false);
    const handleRefresh = () => syncAchievements(false);
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("speakmate_progress_updated", handleRefresh);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("speakmate_progress_updated", handleRefresh);
    };
  }, []);

  // Merge live metrics with master achievements and backend unlock status
  const enrichedAchievements = useMemo(() => {
    return MASTER_ACHIEVEMENTS.map((ach) => {
      const currentVal = liveStats[ach.metricKey] || 0;
      const backendItem = backendAchievements.find(
        (b) => b.title && b.title.trim().toLowerCase() === ach.title.trim().toLowerCase()
      );
      const meetsTarget = currentVal >= ach.target;
      const unlocked = backendItem ? (Boolean(backendItem.unlocked) && meetsTarget) : (loading ? false : meetsTarget);
      const progressPercent = Math.min(100, Math.max(0, (currentVal / ach.target) * 100));

      return {
        ...ach,
        currentVal,
        unlocked,
        progressPercent,
      };
    });
  }, [liveStats, backendAchievements, loading]);

  useEffect(() => {
    if (loading) return;
    const unlockedCount = enrichedAchievements.filter((i) => i.unlocked).length;
    const current = getLiveProgressStats();
    if (current && current.badgesUnlocked !== unlockedCount) {
      saveProgressStats({ ...current, badgesUnlocked: unlockedCount }, null, false);
    }
  }, [enrichedAchievements, loading]);

  // Filter items
  const filteredItems = useMemo(() => {
    return enrichedAchievements.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      if (selectedFilter === "UNLOCKED" && !item.unlocked) return false;
      if (selectedFilter === "LOCKED" && item.unlocked) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [enrichedAchievements, selectedCategory, selectedFilter, searchQuery]);

  const totalEarnedXp = enrichedAchievements
    .filter((i) => i.unlocked)
    .reduce((acc, curr) => acc + curr.xpReward, 0);

  const totalUnlockedCount = enrichedAchievements.filter((i) => i.unlocked).length;
  const totalCount = enrichedAchievements.length;
  const showcasePercentage = Math.round((totalUnlockedCount / totalCount) * 100);

  const getTierBadge = (tier) => {
    if (tier === 1) return { bg: "bg-amber-700/10 text-amber-700 dark:text-amber-400 border-amber-700/20", label: "Bronze" };
    if (tier === 2) return { bg: "bg-slate-400/10 text-slate-600 dark:text-slate-300 border-slate-400/20", label: "Silver" };
    if (tier === 3) return { bg: "bg-amber-400/10 text-amber-600 dark:text-amber-300 border-amber-400/20", label: "Gold" };
    return { bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20", label: "Diamond" };
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-2 sm:px-4 lg:px-6 py-2">
      {/* Header Banner */}
      <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white shadow-2xl space-y-4 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300 border border-white/20 shadow-sm mb-3.5 sm:mb-4">
              🏆 Hall of Fame & Trophy Room
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-2.5">Medals & Achievements</h1>
            <p className="text-xs sm:text-sm text-indigo-200 font-medium leading-relaxed">
              Unlock milestones across Speaking, Grammar, Vocabulary, and Streaks to earn XP rewards.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center min-w-[140px]">
            {loading ? (
              <div className="h-8 w-16 bg-white/20 rounded-lg animate-pulse mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-black text-amber-400">+{totalEarnedXp}</p>
            )}
            <p className="text-[10px] font-bold uppercase text-indigo-200">Total XP Claimed</p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-black text-indigo-200">
            <span>
              Showcase Mastery: {`${totalUnlockedCount} of ${totalCount} Medals`}
            </span>
            <span className="text-amber-300">{`${showcasePercentage}%`}</span>
          </div>
          <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 rounded-full transition-all duration-500"
              style={{ width: `${showcasePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/20"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <input
            type="text"
            placeholder="🔍 Search medals or objectives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[#6C63FF] w-full sm:w-64"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2">
          {[
            { id: "ALL", label: `All (${enrichedAchievements.length})` },
            { id: "UNLOCKED", label: `Unlocked (${totalUnlockedCount})` },
            { id: "LOCKED", label: `In Progress (${totalCount - totalUnlockedCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                selectedFilter === f.id
                  ? "bg-[var(--text-primary)] text-[var(--bg-base)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Achievement Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full p-16 rounded-3xl glass-card text-center space-y-2">
            <span className="text-4xl">🏅</span>
            <p className="text-sm font-black text-[var(--text-primary)]">No achievements match your filter</p>
            <p className="text-xs text-[var(--text-secondary)]">Try selecting a different category or search term.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const tierStyle = getTierBadge(item.tier);
            return (
              <div
                key={item.id}
                className={`p-5 rounded-3xl border transition-all space-y-4 relative overflow-hidden flex flex-col justify-between ${
                  item.unlocked
                    ? "bg-[var(--bg-surface)] border-amber-400/40 shadow-lg shadow-amber-500/5 hover:border-amber-400"
                    : "bg-[var(--bg-surface)]/60 border-[var(--border-default)] opacity-85 hover:opacity-100"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl shadow-sm ${
                          item.unlocked
                            ? "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-amber-500/20"
                            : "bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                        }`}
                      >
                        {item.unlocked ? item.icon : "🔒"}
                      </div>
                      <div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${tierStyle.bg}`}>
                          {item.tierName}
                        </span>
                        <h3 className="text-sm font-black text-[var(--text-primary)] mt-1">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-500">
                      +{item.xpReward} XP
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Progress Bar for In-Progress Medals */}
                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                  {item.unlocked ? (
                    <div className="flex items-center justify-between text-xs font-black text-emerald-500">
                      <span>✅ Completed & Unlocked</span>
                      <span>100%</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)]">
                        <span>Progress</span>
                        <span>{item.currentVal} / {item.target} ({item.progressPercent.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#6C63FF] rounded-full transition-all duration-500"
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Achievements;
