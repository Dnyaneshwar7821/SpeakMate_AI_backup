import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Folder } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { lessonModuleService } from "../services/appServices";
import {
  MASTER_LESSONS,
  getLessonsForSchoolGrade,
  getLessonsForAgeGroup,
} from "../constants/masterCurriculum";
import { CurriculumCache, areListsIdentical } from "../utils/curriculumCache";
import { SpeakMateLoader } from "../components/common/SpeakMateLoader";

const DIFFICULTY_TABS = ["All", "Beginner", "Intermediate", "Advanced"];

const DIFF_COLORS = {
  Beginner: { bg: "bg-emerald-500/15", text: "text-emerald-500" },
  Intermediate: { bg: "bg-amber-500/15", text: "text-amber-500" },
  Advanced: { bg: "bg-rose-500/15", text: "text-rose-500" },
};

export function Lessons() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get("search") || "";

  // Reactive User Profile State
  const [accountType, setAccountType] = useState(
    () => user?.accountType || user?.role || localStorage.getItem("speakmate_account_type") || "INDIVIDUAL_USER"
  );
  const [rawGrade, setRawGrade] = useState(
    () => user?.schoolGrade || user?.standard || localStorage.getItem("speakmate_school_grade") || localStorage.getItem("speakmate_standard") || "1st Std"
  );
  const [rawAge, setRawAge] = useState(
    () => user?.ageGroup || localStorage.getItem("speakmate_age_group") || "Professional"
  );

  useEffect(() => {
    if (user?.accountType) setAccountType(user.accountType);
    if (user?.schoolGrade) setRawGrade(user.schoolGrade);
    if (user?.ageGroup) setRawAge(user.ageGroup);
  }, [user?.accountType, user?.schoolGrade, user?.ageGroup]);

  useEffect(() => {
    const handleSettings = (e) => {
      const d = e?.detail;
      if (d?.schoolGrade) setRawGrade(d.schoolGrade);
      if (d?.ageGroup) setRawAge(d.ageGroup);
      if (d?.accountType) setAccountType(d.accountType);
    };
    const handleAge = (e) => {
      const a = e?.detail?.ageGroup || (typeof e?.detail === "string" ? e.detail : null);
      if (a) setRawAge(a);
    };

    window.addEventListener("speakmate_settings_updated", handleSettings);
    window.addEventListener("speakmate_age_group_changed", handleAge);
    return () => {
      window.removeEventListener("speakmate_settings_updated", handleSettings);
      window.removeEventListener("speakmate_age_group_changed", handleAge);
    };
  }, []);

  const isStudent = accountType === "STUDENT" || user?.role === "STUDENT" || Boolean(user?.isSchoolStudent) || Boolean(user?.schoolGrade) || Boolean(user?.standard) || Boolean(localStorage.getItem("speakmate_school_grade"));

  const normalizeGradeStr = (raw) => {
    const s = String(raw || '').trim().toLowerCase();
    const numMatch = s.match(/\b(10|[1-9])\b/) || s.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
      return `${num}${suffix} Std`;
    }
    return '1st Std';
  };
  const schoolGrade = normalizeGradeStr(rawGrade);

  const normalizeAgeGroup = (raw) => {
    if (!raw) return "Professional";
    const s = String(raw).toLowerCase();
    if (s.includes("kid") || s.includes("6-12")) return "Kids";
    if (s.includes("teen") || s.includes("13-24") || s.includes("young")) return "Teens";
    if (s.includes("senior")) return "Senior";
    if (s.includes("prof") || s.includes("25+")) return "Professional";
    return "Professional";
  };
  const effectiveAge = normalizeAgeGroup(rawAge);
  const profileKey = isStudent ? schoolGrade : effectiveAge;

  // Exact profile-scoped 20 academic lessons
  const profileLessons = useMemo(() => {
    if (isStudent) {
      return getLessonsForSchoolGrade(schoolGrade);
    }
    if (effectiveAge === "Kids") return getLessonsForAgeGroup("Kids (Age 6–12)");
    if (effectiveAge === "Teens") return getLessonsForAgeGroup("Teens & Young Adults (Age 13–24)");
    return getLessonsForAgeGroup("Professionals & Seniors (Age 25+)");
  }, [isStudent, schoolGrade, effectiveAge]);

  const [lessons, setLessons] = useState(() => {
    const cached = CurriculumCache.getLessons(user?.id, profileKey);
    return cached && cached.length > 0 ? cached : profileLessons;
  });

  const [continueItems, setContinueItems] = useState(() => {
    const cached = CurriculumCache.getContinueItems(user?.id, profileKey, profileLessons);
    return (cached && cached.length > 0) ? cached : [];
  });

  const continueRowRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState(urlSearchQuery);
  const [searchResults, setSearchResults] = useState(null);
  const [activeTab, setActiveTab] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Sync lessons and continue items reactively when profile changes
  useEffect(() => {
    const cached = CurriculumCache.getLessons(user?.id, profileKey);
    setLessons(cached && cached.length > 0 ? cached : profileLessons);
    setContinueItems(CurriculumCache.getContinueItems(user?.id, profileKey, profileLessons) || []);
  }, [profileLessons, profileKey, user?.id]);

  // Distinct categories computed strictly from user's profile lessons
  const categories = useMemo(() => {
    const counts = {};
    profileLessons.forEach((l) => {
      const cat = l.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, lessonCount]) => ({ name, lessonCount }));
  }, [profileLessons]);

  const loadData = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [cont, list] = await Promise.all([
        lessonModuleService.continueLearning().catch(() => null),
        lessonModuleService.list({}).catch(() => null),
      ]);

      // Target titles and IDs belonging strictly to this user's 20-lesson list
      const targetTitles = new Set(profileLessons.map((t) => (t.title || "").toLowerCase().trim()));
      const userCurriculumTitles = targetTitles;
      const userCurriculumIds = new Set(profileLessons.flatMap((t) => [String(t.id || "").toLowerCase(), String(t.numericId || "").toLowerCase()].filter(Boolean)));
      const completedSet = CurriculumCache.getCompletedSet();

      // Retrieve and sanitize local in-progress items from localStorage
      let localInProgress = [];
      try {
        const raw = localStorage.getItem("speakmate_in_progress_lessons");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localInProgress = parsed.filter((item) => {
              if (!item) return false;
              const titleKey = (item.title || "").toLowerCase().trim();
              const idKey = String(item.id || "").toLowerCase();
              const isDone = completedSet.has(titleKey) || completedSet.has(idKey) || Boolean(item.completed) || ((item.progressPercent || 0) >= 100);
              return userCurriculumTitles.has(titleKey) && !isDone;
            });
            if (localInProgress.length !== parsed.length) {
              localStorage.setItem("speakmate_in_progress_lessons", JSON.stringify(localInProgress));
            }
          }
        }
      } catch (_) {}

      // Combine backend and local in-progress items
      const combinedCont = [...(cont || [])];
      localInProgress.forEach((localItem) => {
        if (!localItem) return;
        const titleKey = (localItem.title || "").toLowerCase().trim();
        const idKey = String(localItem.id || "");
        const existingIdx = combinedCont.findIndex(
          (c) =>
            (titleKey && (c.title || "").toLowerCase().trim() === titleKey) ||
            (idKey && String(c.id || "") === idKey)
        );
        if (existingIdx === -1) {
          combinedCont.push(localItem);
        } else if ((localItem.progressPercent || 0) > (combinedCont[existingIdx].progressPercent || 0)) {
          combinedCont[existingIdx] = { ...combinedCont[existingIdx], ...localItem };
        }
      });

      const userSpecificInProgress = combinedCont.filter((c) => {
        if (!c) return false;
        const titleKey = (c.title || "").toLowerCase().trim();
        const idKey = String(c.id || "").toLowerCase();
        const numIdKey = String(c.numericId || "").toLowerCase();
        
        const belongsToUserList = titleKey
          ? userCurriculumTitles.has(titleKey)
          : (userCurriculumIds.has(idKey) || (numIdKey && userCurriculumIds.has(numIdKey)));
        const isDone = Boolean(c.completed) || ((c.progressPercent || 0) >= 100) || completedSet.has(titleKey) || completedSet.has(idKey);
        return belongsToUserList && !isDone;
      });

      // Enrich with profileLesson data (xpReward, category, level, etc.)
      const enrichedCont = userSpecificInProgress.map((c) => {
        const titleKey = (c.title || "").toLowerCase().trim();
        const matched = profileLessons.find(
          (p) => (p.title || "").toLowerCase().trim() === titleKey
        ) || profileLessons.find(
          (p) => String(p.id) === String(c.id) || String(p.numericId) === String(c.id) || String(p.numericId) === String(c.numericId)
        );
        return {
          ...(matched || {}),
          ...c,
          title: matched?.title || c.title,
          progressPercent: Math.min(100, Math.max(10, c.progressPercent || 11)),
        };
      });

      let finalCont = [];
      if (enrichedCont.length > 0) {
        finalCont = enrichedCont;
      } else if (profileLessons.length > 0) {
        // Fallback to first uncompleted lesson in this user's 20-lesson list
        const firstUncompleted = profileLessons.find((p) => {
          const titleKey = (p.title || "").toLowerCase().trim();
          const idKey = String(p.id || "").toLowerCase();
          return !completedSet.has(titleKey) && !completedSet.has(idKey) && !p.completed && (p.progressPercent || 0) < 100;
        }) || profileLessons[0];
        finalCont = [firstUncompleted];
      }

      CurriculumCache.setContinueItems(user?.id, profileKey, finalCont);
      setContinueItems((prev) => areListsIdentical(prev, finalCont) ? prev : finalCont);

      let finalLessons = profileLessons;
      if (list && Array.isArray(list) && list.length > 0) {
        const matchedBackend = list.filter((b) => targetTitles.has((b.title || "").toLowerCase().trim()));
        const backendTitles = new Set(matchedBackend.map((b) => (b.title || "").toLowerCase().trim()));
        const unseeded = profileLessons.filter((t) => !backendTitles.has((t.title || "").toLowerCase().trim()));
        finalLessons = [...matchedBackend, ...unseeded];
      }
      CurriculumCache.setLessons(user?.id, profileKey, finalLessons);
      setLessons((prev) => areListsIdentical(prev, finalLessons) ? prev : finalLessons);
    } catch {
      CurriculumCache.setLessons(user?.id, profileKey, profileLessons);
      setLessons((prev) => areListsIdentical(prev, profileLessons) ? prev : profileLessons);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Instantly check cache on profile change so there is ZERO ms lag/flash
    const cachedCont = CurriculumCache.getContinueItems(user?.id, profileKey, profileLessons);
    if (cachedCont && cachedCont.length > 0) {
      setContinueItems((prev) => areListsIdentical(prev, cachedCont) ? prev : cachedCont);
    } else {
      setContinueItems([]);
    }

    const cachedLessons = CurriculumCache.getLessons(user?.id, profileKey);
    if (cachedLessons && cachedLessons.length > 0) {
      setLessons((prev) => areListsIdentical(prev, cachedLessons) ? prev : cachedLessons);
    } else {
      setLessons(profileLessons);
    }

    loadData(false);
  }, [profileLessons, profileKey, user?.id]);

  useEffect(() => {
    const handleSettingsUpdated = () => {
      CurriculumCache.clear();
      loadData();
    };
    window.addEventListener("speakmate_settings_updated", handleSettingsUpdated);
    window.addEventListener("speakmate_curriculum_updated", handleSettingsUpdated);
    window.addEventListener("speakmate_progress_updated", handleSettingsUpdated);
    return () => {
      window.removeEventListener("speakmate_settings_updated", handleSettingsUpdated);
      window.removeEventListener("speakmate_curriculum_updated", handleSettingsUpdated);
      window.removeEventListener("speakmate_progress_updated", handleSettingsUpdated);
    };
  }, []);

  const handleOpenLesson = useCallback((lessonItem) => {
    if (!lessonItem) return;
    const curProg = Math.max(11, lessonItem.progressPercent || 0);
    CurriculumCache.updateLessonProgress(
      lessonItem.id,
      lessonItem.title,
      curProg,
      lessonItem.category,
      lessonItem.level,
      lessonItem.xpReward,
      lessonItem.estimatedMinutes || lessonItem.duration
    );
    navigate(`/lessons/${lessonItem.id}`);
  }, [navigate]);

  const handleSearch = useCallback(
    async (text, currentLessons = lessons) => {
      setSearchText(text);
      const trimmed = (text || '').trim();
      if (!trimmed) {
        setSearchResults(null);
        return;
      }
      try {
        const words = trimmed
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);

        if (words.length === 0) {
          setSearchResults(null);
          return;
        }

        const wordRegexes = words.map((w) => {
          const safe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp('(?:^|[\\s\\-_/:(\\[])' + safe, 'i');
        });

        const localResults = currentLessons.filter((l) => {
          if (!l) return false;
          const title = l.title || '';
          const cat = l.category || '';
          const desc = l.description || '';

          return wordRegexes.every((regex) => {
            if (regex.test(title)) return true;
            if (regex.test(cat)) return true;
            if (trimmed.length >= 3 && regex.test(desc)) return true;
            return false;
          });
        });

        // Sort: title starts with query first
        const lowerQ = trimmed.toLowerCase();
        localResults.sort((a, b) => {
          const aStarts = (a.title || '').toLowerCase().startsWith(lowerQ);
          const bStarts = (b.title || '').toLowerCase().startsWith(lowerQ);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });

        setSearchResults(localResults);
      } catch (e) {
        setSearchResults([]);
      }
    },
    [lessons]
  );

  useEffect(() => {
    handleSearch(urlSearchQuery, lessons);
  }, [urlSearchQuery, lessons, handleSearch]);

  const onSearchInputChange = (text) => {
    setSearchText(text);
    if (text.trim()) {
      setSearchParams({ search: text.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const filteredLessons = useMemo(() => {
    let result = searchResults !== null ? searchResults : lessons;
    // 1. Filter by difficulty tab
    if (activeTab !== "All") {
      result = result.filter((l) => l.level === activeTab || l.difficulty === activeTab);
    }
    // 2. Filter by category
    if (selectedCategory) {
      result = result.filter((l) => l.category === selectedCategory);
    }
    return result;
  }, [lessons, searchResults, activeTab, selectedCategory]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-2 sm:px-4 lg:px-6 py-2">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4338CA] p-6 sm:p-10 text-white shadow-2xl space-y-6 border border-white/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-wider text-amber-300 border border-white/20 shadow-sm mb-3.5 sm:mb-4">
            {isStudent ? `🎓 School Grade: ${schoolGrade}` : `👤 Target Profile: ${effectiveAge}`}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-2.5">
            {isStudent ? `${schoolGrade} Academic Lessons` : `${effectiveAge} English Masterclasses`}
          </h1>
          <p className="text-sm sm:text-base text-indigo-200 font-medium leading-relaxed">
            {isStudent
              ? `20 structured academic masterclasses teaching grammar formulas, phonics rules, and sentence syntax tailored to your ${schoolGrade} curriculum.`
              : `20 structured academic masterclasses teaching grammar formulas, executive sentence syntax, and formal communication tailored to your ${effectiveAge} profile.`}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xl">
          <input
            type="text"
            placeholder="🔍 Search lessons, grammar rules, phonics, topics..."
            value={searchText}
            onChange={(e) => onSearchInputChange(e.target.value)}
            className="w-full pl-5 pr-4 py-3.5 rounded-2xl bg-white/15 border border-white/25 text-white placeholder-indigo-200 text-sm font-bold focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Difficulty Level Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider px-2 shrink-0">
            Level Tier:
          </span>
          {DIFFICULTY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black shrink-0 transition-all active:scale-95 ${
                activeTab === tab
                  ? "bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white shadow-md shadow-[#6C63FF]/25 scale-102"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Continue Learning Row (Horizontally Slideable Right or Left) */}
      {searchResults === null && (
        continueItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h2 className="text-2xl font-black text-[var(--text-primary)]">
                  Continue Learning
                  {continueItems.length > 1 && (
                    <span className="text-xs font-bold text-[#6C63FF] ml-2 px-2.5 py-0.5 rounded-full bg-[#6C63FF]/10">
                      {continueItems.length} in progress
                    </span>
                  )}
                </h2>
              </div>
              {continueItems.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)] font-medium hidden sm:inline">
                    Slide or use arrows
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (continueRowRef.current) {
                        continueRowRef.current.scrollBy({ left: -340, behavior: 'smooth' });
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-[#6C63FF]/20 text-[var(--text-primary)] border border-white/10 flex items-center justify-center transition-all shadow-sm active:scale-95 text-xs font-bold"
                    title="Slide Left"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (continueRowRef.current) {
                        continueRowRef.current.scrollBy({ left: 340, behavior: 'smooth' });
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-[#6C63FF]/20 text-[var(--text-primary)] border border-white/10 flex items-center justify-center transition-all shadow-sm active:scale-95 text-xs font-bold"
                    title="Slide Right"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>

            <div
              ref={continueRowRef}
              className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x scrollbar-thin scrollbar-thumb-[#6C63FF]/30 scrollbar-track-transparent"
              style={{ scrollbarWidth: 'thin' }}
            >
              {continueItems.map((item, idx) => {
                const percent = Math.min(100, Math.max(10, item.progressPercent || 11));
                return (
                  <div
                    key={item.id ? `cont-${item.id}` : `cont-${item.title || idx}`}
                    className="min-w-[290px] sm:min-w-[340px] max-w-[380px] flex-shrink-0 snap-start p-6 rounded-3xl bg-gradient-to-br from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-white shadow-xl flex flex-col justify-between gap-4 border border-white/10 hover:shadow-2xl transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-3 py-0.5 rounded-full border border-white/20">
                          In Progress
                        </span>
                        <span className="text-xs font-bold text-[#FCD34D] flex items-center gap-1">
                          ⭐ +{item.xpReward || 35} XP
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black line-clamp-1">{item.title}</h3>
                        <p className="text-xs font-semibold opacity-85 mt-0.5">
                          {item.category} • {item.level || 'All Levels'} • {item.estimatedMinutes || item.duration || 15} min
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div className="pt-1 space-y-1">
                        <div className="w-full h-2 rounded-full bg-white/25 overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="text-[11px] font-semibold text-white/80 text-right">
                          {percent}% complete
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenLesson(item)}
                      className="w-full py-3 rounded-2xl bg-white text-[#4F46E5] font-black text-sm shadow-md hover:bg-slate-100 hover:scale-[1.02] active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                    >
                      Resume Masterclass ▶
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      )}

      {/* Categories Grid */}
      {categories.length > 0 && searchResults === null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-[var(--text-primary)]">Curriculum Categories</h2>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs font-black text-[#6C63FF] hover:underline"
              >
                Clear Filter ({selectedCategory})
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.slice(0, 12).map((cat) => (
              <div
                key={cat.name}
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all text-center space-y-1 ${
                  selectedCategory === cat.name
                    ? "bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] border-[#6C63FF] text-white shadow-xl scale-102"
                    : "glass-card glass-card-hover border-[var(--border-default)]"
                }`}
              >
                <div className="flex items-center justify-center gap-2 min-w-0">
                  <Folder
                    className={`w-5 h-5 shrink-0 transition-all ${
                      selectedCategory === cat.name
                        ? "text-yellow-300 fill-yellow-300 drop-shadow-sm"
                        : "text-amber-400 fill-amber-400 drop-shadow-sm"
                    }`}
                  />
                  <p className="font-black text-xs truncate">{cat.name}</p>
                </div>
                <p className="text-[10px] opacity-80 font-black">{cat.lessonCount} lessons</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Lessons Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-[var(--text-primary)]">
            {isStudent ? `${schoolGrade} Academic Lessons` : `${effectiveAge} Lessons`} ({filteredLessons.length})
          </h2>
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            Showing 20 targeted concept lessons
          </span>
        </div>

        {filteredLessons.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-secondary)] space-y-2 glass-card rounded-3xl">
            <p className="text-4xl">📖</p>
            <p className="font-extrabold text-base text-[var(--text-primary)]">
              No lessons found matching your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.map((l) => {
              const diffBadge = DIFF_COLORS[l.level] || DIFF_COLORS[l.difficulty] || DIFF_COLORS.Beginner;
              return (
                <div
                  key={l.id}
                  onClick={() => handleOpenLesson(l)}
                  className="group glass-card glass-card-hover p-6 rounded-3xl space-y-4 flex flex-col justify-between cursor-pointer border border-[var(--border-default)] hover:border-[#6C63FF]/50 transition-all duration-300"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-[#6C63FF]/15 text-[#6C63FF]">
                        {l.category || "General"}
                      </span>
                      <span
                        className={`text-[10px] font-black px-3 py-1 rounded-full ${diffBadge.bg} ${diffBadge.text}`}
                      >
                        {l.level || l.difficulty || "Beginner"}
                      </span>
                    </div>

                    <h3 className="font-black text-lg text-[var(--text-primary)] group-hover:text-[#6C63FF] transition-colors leading-snug">
                      {l.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium line-clamp-2">
                      {l.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[var(--border-default)] flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)] font-extrabold">
                      ⏱️ {l.estimatedMinutes || 15} mins • +{l.xpReward || 35} XP
                    </span>
                    <button className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] group-hover:opacity-95 text-white font-black text-xs shadow-md transition-all">
                      Start →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Lessons;
