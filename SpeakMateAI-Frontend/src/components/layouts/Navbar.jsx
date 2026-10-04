import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import ROUTES from "../../constants/routes";
import { getLiveProgressStats } from "../../utils/progressTracker";
import { StreakModal } from "../dashboard/StreakModal";
import { AdminLoginModal } from "../common/AdminLoginModal";
import { notificationService } from "../../services/appServices";
import { MASTER_LESSONS } from "../../constants/masterCurriculum";

export const Navbar = memo(function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [liveStats, setLiveStats] = useState(() => getLiveProgressStats(user));
  const [unreadCount, setUnreadCount] = useState(0);

  // Searchable Quick Pages & Modules with exact sidebar titles and full keyword mappings
  const SEARCHABLE_PAGES = useMemo(
    () => [
      {
        id: "p-speaking",
        title: "Live AI Speaking",
        subtitle: "Real-time AI voice conversation & pronunciation",
        route: ROUTES.SPEAKING,
        icon: "🎙️",
        category: "Practice Hub",
        keywords: ["speaking", "speak", "voice", "conversation", "live speaking", "practice", "audio", "mic", "talk"],
      },
      {
        id: "p-aichat",
        title: "AI Chat Coach",
        subtitle: "Interactive text & speech conversation tutor",
        route: ROUTES.AI_CHAT,
        icon: "💬",
        category: "Practice Hub",
        keywords: ["ai chat", "chat", "coach", "ai coach", "chat coach", "assistant", "bot", "message", "text"],
      },
      {
        id: "p-lessons",
        title: "CEFR Lessons",
        subtitle: "Structured curriculum, vocabulary & phonics",
        route: ROUTES.LESSONS,
        icon: "📚",
        category: "Curriculum",
        keywords: ["lesson", "lessons", "cefr", "cefr lessons", "curriculum", "course", "study", "units"],
      },
      {
        id: "p-grammar",
        title: "Grammar Doctor",
        subtitle: "Tenses, conditionals, active/passive voice mastery",
        route: ROUTES.GRAMMAR,
        icon: "📝",
        category: "Curriculum",
        keywords: ["grammar", "grammar doctor", "doctor", "tenses", "rule", "rules", "verbs"],
      },
      {
        id: "p-vocab",
        title: "Vocabulary Builder",
        subtitle: "Top 500 words, idioms & phrasal verbs",
        route: ROUTES.VOCABULARY,
        icon: "📖",
        category: "Curriculum",
        keywords: ["vocabulary", "vocab", "vocabulary builder", "words", "idioms", "phrasal", "flashcards"],
      },
      {
        id: "p-progress",
        title: "Analytics & Fluency",
        subtitle: "Track daily streaks, XP & vocabulary mastery",
        route: ROUTES.PROGRESS,
        icon: "📊",
        category: "Practice Hub",
        keywords: ["progress", "analytics", "fluency", "stats", "statistics", "streak", "analytics & fluency"],
      },
      {
        id: "p-achieve",
        title: "Badges & Rewards",
        subtitle: "View fluency milestones and earned trophies",
        route: ROUTES.ACHIEVEMENTS,
        icon: "🏆",
        category: "Curriculum",
        keywords: ["achievements", "achievement", "badges", "rewards", "trophies", "milestones", "badges & rewards"],
      },
      {
        id: "p-profile",
        title: "Profile & Persona",
        subtitle: "Customize accent, speed & AI avatar",
        route: ROUTES.PROFILE,
        icon: "👤",
        category: "Account",
        keywords: ["profile", "avatar", "persona", "account", "voice", "profile & persona"],
      },
      {
        id: "p-settings",
        title: "Settings & Speech",
        subtitle: "Adjust difficulty, speech feedback & theme",
        route: ROUTES.SETTINGS,
        icon: "⚙️",
        category: "Account",
        keywords: ["settings", "preferences", "config", "speech settings", "theme", "settings & speech"],
      },
      {
        id: "p-dashboard",
        title: "Dashboard",
        subtitle: "Overview of your daily learning journey",
        route: ROUTES.DASHBOARD,
        icon: "🧭",
        category: "Main",
        keywords: ["dashboard", "home", "main"],
      },
    ],
    []
  );

  // Searchable Lessons dynamically mapped from Master Curriculum
  const SEARCHABLE_LESSONS = useMemo(
    () =>
      MASTER_LESSONS.slice(0, 30).map((l) => ({
        id: `l-${l.id}`,
        title: l.title,
        category: l.category,
        level: l.level,
        route: `/lessons/${l.id}`,
        icon: "📚",
      })),
    []
  );

  // Directly matched module for fast Enter navigation & dynamic CTA
  const matchedModuleDirectly = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      SEARCHABLE_PAGES.find((p) => {
        const titleLower = p.title.toLowerCase();
        if (titleLower === q) return true;
        if (p.keywords && p.keywords.some((k) => k === q || q === `${k}s` || `${q}s` === k)) return true;
        if (q.length >= 3 && (titleLower.includes(q) || p.keywords?.some((k) => k.includes(q)))) return true;
        return false;
      }) || null
    );
  }, [searchQuery, SEARCHABLE_PAGES]);

  // Filtered dropdown results
  const filteredResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        pages: SEARCHABLE_PAGES.slice(0, 6),
        lessons: SEARCHABLE_LESSONS.slice(0, 4),
        totalCount: 10,
      };
    }

    const matchedPages = SEARCHABLE_PAGES.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.keywords && p.keywords.some((k) => k.includes(q) || q.includes(k)))
    );

    const matchedLessons = SEARCHABLE_LESSONS.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.level.toLowerCase().includes(q)
    );

    return {
      pages: matchedPages,
      lessons: matchedLessons,
      totalCount: matchedPages.length + matchedLessons.length,
    };
  }, [searchQuery, SEARCHABLE_PAGES, SEARCHABLE_LESSONS]);

  // Flattened list for arrow-key navigation
  const allResultItems = useMemo(() => {
    return [...filteredResults.pages, ...filteredResults.lessons];
  }, [filteredResults]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Sync navbar search with URL when on lessons page
  useEffect(() => {
    if (location.pathname === ROUTES.LESSONS) {
      const params = new URLSearchParams(location.search);
      const q = params.get("search") || "";
      setSearchQuery(q);
    }
  }, [location.pathname, location.search]);

  // Global ⌘K / Ctrl+K shortcut listener to focus search bar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setSearchOpen(true);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Live Unread Notifications fetcher & listener
  const fetchUnreadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationService.countUnread().catch(() => 0);
      const count = typeof res === "number" ? res : typeof res?.count === "number" ? res.count : 0;
      setUnreadCount(Math.max(0, count));
    } catch {
      setUnreadCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 60000);
    const handleUpdate = () => fetchUnreadNotifications();
    window.addEventListener("focus", handleUpdate);
    window.addEventListener("speakmate_notifications_updated", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleUpdate);
      window.removeEventListener("speakmate_notifications_updated", handleUpdate);
    };
  }, [fetchUnreadNotifications]);

  useEffect(() => {
    if (location.pathname === ROUTES.NOTIFICATIONS) {
      fetchUnreadNotifications();
    }
  }, [location.pathname, fetchUnreadNotifications]);

  // Keyboard navigation within the dropdown
  const handleInputKeyDown = (e) => {
    if (!searchOpen) {
      if (e.key === "ArrowDown") {
        setSearchOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allResultItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allResultItems.length - 1));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < allResultItems.length) {
        e.preventDefault();
        const selected = allResultItems[selectedIndex];
        handleSelectResult(selected.route);
      } else {
        handleSearchSubmit(e);
      }
    } else if (e.key === "Escape") {
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const handleSelectResult = (route) => {
    setSearchOpen(false);
    navigate(route);
  };

  useEffect(() => {
    const updateStats = (e) => {
      if (e?.detail) {
        setLiveStats(e.detail);
      } else {
        setLiveStats(getLiveProgressStats(user));
      }
    };
    updateStats();
    window.addEventListener("focus", updateStats);
    window.addEventListener("speakmate_progress_updated", updateStats);
    window.addEventListener("speakmate_settings_updated", updateStats);
    return () => {
      window.removeEventListener("focus", updateStats);
      window.removeEventListener("speakmate_progress_updated", updateStats);
      window.removeEventListener("speakmate_settings_updated", updateStats);
    };
  }, [user]);

  const isStudent =
    user?.accountType === "INDIVIDUAL_USER" || user?.accountType === "USER"
      ? false
      : Boolean(
          user?.accountType === "STUDENT" ||
          user?.isSchoolStudent ||
          user?.schoolGrade ||
          user?.schoolId ||
          localStorage.getItem("speakmate_account_type") === "STUDENT"
        );

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate(ROUTES.HOME);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setSearchOpen(false);
    const query = searchQuery.trim();
    if (!query) {
      navigate(ROUTES.LESSONS);
      return;
    }

    // 1. If direct module match was found for the query, navigate to it immediately
    if (matchedModuleDirectly) {
      navigate(matchedModuleDirectly.route);
      return;
    }

    // 2. If first item in filtered dropdown is an exact or strong page/module match
    if (filteredResults.pages.length > 0) {
      const topPage = filteredResults.pages[0];
      const qLower = query.toLowerCase();
      const topTitle = topPage.title.toLowerCase();
      if (
        topTitle === qLower ||
        (topPage.keywords && topPage.keywords.some((k) => k === qLower || qLower.startsWith(k)))
      ) {
        navigate(topPage.route);
        return;
      }
    }

    // 3. Fallback: Keep current search functionality (navigate to lessons search)
    navigate(`${ROUTES.LESSONS}?search=${encodeURIComponent(query)}`);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedIndex(-1);
    if (location.pathname === ROUTES.LESSONS) {
      navigate(ROUTES.LESSONS);
    }
    searchInputRef.current?.focus();
  };

  return (
    <header className="sticky top-0 left-0 w-full z-40 border-b border-[var(--border-default)] bg-[var(--bg-base)]/80 backdrop-blur-xl transition-colors duration-200">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Left Section: Brand Logo */}
        <div className="flex items-center gap-6">
          <Link
            to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.HOME}
            className="flex items-center gap-3 min-w-0 group"
          >
            <img
              src={isDark ? "/assets/speakmate_logo.png" : "/assets/speakmate_logo_light.png"}
              alt="SpeakMate AI"
              className="h-11 sm:h-12 w-auto object-contain transition-transform group-hover:scale-[1.02] dark:drop-shadow-md"
            />
          </Link>

          {/* Desktop Search Bar & Dropdown Container */}
          {isAuthenticated && (
            <div ref={searchContainerRef} className="hidden md:block relative w-72 lg:w-96">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center group">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search lessons, vocabulary, grammar..."
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleInputKeyDown}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                    setSelectedIndex(-1);
                  }}
                  className="w-full pl-10 pr-16 py-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs sm:text-sm font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 transition-all shadow-inner"
                />
                <button
                  type="submit"
                  className="absolute left-3.5 text-xs text-[var(--text-muted)] hover:text-[#6C63FF] transition-colors cursor-pointer"
                  title="Search"
                >
                  🔍
                </button>

                <div className="absolute right-3 flex items-center gap-1.5">
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="w-5 h-5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-black flex items-center justify-center transition-all cursor-pointer"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[10px] font-black text-[var(--text-muted)] group-focus-within:border-[#6C63FF] group-focus-within:text-[#6C63FF] transition-colors">
                      ⌘K
                    </span>
                  )}
                </div>
              </form>

              {/* ── Instant Live Search Dropdown ── */}
              {searchOpen && (
                <div className="absolute left-0 top-full mt-2 w-[420px] lg:w-[480px] max-h-[460px] overflow-y-auto rounded-3xl bg-[var(--bg-surface)]/95 backdrop-blur-2xl border border-[var(--border-default)] shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">

                  {filteredResults.totalCount === 0 ? (
                    <div className="p-6 text-center space-y-2">
                      <p className="text-2xl">🔎</p>
                      <p className="text-sm font-black text-[var(--text-primary)]">No matching results found</p>
                      <p className="text-xs text-[var(--text-secondary)] font-medium">
                        Try searching for grammar, present tenses, interview, vocabulary, or speaking drills.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">

                      {/* Section 1: Modules & Features */}
                      {filteredResults.pages.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            <span>{searchQuery ? "Modules & Features" : "Quick Modules"}</span>
                            <span>{filteredResults.pages.length}</span>
                          </div>
                          <div className="space-y-1">
                            {filteredResults.pages.map((item, idx) => {
                              const isSelected = selectedIndex === idx;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectResult(item.route)}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer group ${isSelected
                                      ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30"
                                      : "hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                                    }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] group-hover:scale-105 border border-[var(--border-default)] flex items-center justify-center text-base shrink-0">
                                      {item.icon}
                                    </span>
                                    <div className="min-w-0">
                                      <p className={`text-xs font-black truncate ${isSelected ? "text-white" : "text-[var(--text-primary)]"}`}>
                                        {item.title}
                                      </p>
                                      <p className={`text-[10px] font-medium truncate ${isSelected ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                                        {item.subtitle}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ml-2 tracking-wider ${isSelected ? "bg-white/20 text-white" : "bg-[#6C63FF]/10 text-[#6C63FF] border border-[#6C63FF]/20"
                                    }`}>
                                    Module
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Lessons & Topics */}
                      {filteredResults.lessons.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            <span>Lessons & Topics</span>
                            <span>{filteredResults.lessons.length}</span>
                          </div>
                          <div className="space-y-1">
                            {filteredResults.lessons.map((lesson, idx) => {
                              const actualIdx = filteredResults.pages.length + idx;
                              const isSelected = selectedIndex === actualIdx;
                              return (
                                <button
                                  key={lesson.id}
                                  type="button"
                                  onClick={() => handleSelectResult(lesson.route)}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer group ${isSelected
                                      ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30"
                                      : "hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                                    }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] group-hover:scale-105 border border-[var(--border-default)] flex items-center justify-center text-base shrink-0">
                                      {lesson.icon}
                                    </span>
                                    <div className="min-w-0">
                                      <p className={`text-xs font-black truncate ${isSelected ? "text-white" : "text-[var(--text-primary)]"}`}>
                                        {lesson.title}
                                      </p>
                                      <p className={`text-[10px] font-medium ${isSelected ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                                        {lesson.category} • {lesson.level}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${isSelected ? "bg-white/20 text-white" : "bg-[#6C63FF]/10 text-[#6C63FF]"
                                    }`}>
                                    Open ▶
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Dropdown Footer: Full Search Action / Direct Module Action */}
                      {searchQuery.trim() && (
                        <div className="pt-2 border-t border-[var(--border-default)]">
                          <button
                            type="button"
                            onClick={handleSearchSubmit}
                            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#6C63FF]/10 via-[#8B5CF6]/10 to-[#FF6584]/10 hover:from-[#6C63FF]/20 hover:to-[#8B5CF6]/20 border border-[#6C63FF]/25 text-xs font-black text-[#6C63FF] transition-all cursor-pointer"
                          >
                            <span>
                              {matchedModuleDirectly
                                ? `Open ${matchedModuleDirectly.title} ➔`
                                : `Search all lessons for "${searchQuery.trim()}"`}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                              Enter ↵
                            </span>
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {isAuthenticated ? (
            <div className="relative flex items-center gap-2.5 sm:gap-4">
              {/* Notifications Button */}
              <Link
                to={ROUTES.NOTIFICATIONS}
                className={`grid h-11 w-11 place-items-center rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] relative transition-all shadow-sm active:scale-95 ${location.pathname === ROUTES.NOTIFICATIONS ? "border-[#6C63FF] text-[#6C63FF]" : ""
                  }`}
                title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : "Notifications"}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-red-500/30 ring-2 ring-[var(--bg-base)] animate-in zoom-in duration-200">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              {/* Streak & XP Badges */}
              <div className="hidden lg:flex items-center gap-2.5">
                <button
                  onClick={() => setStreakModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 text-xs font-black shadow-sm backdrop-blur-sm hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer"
                  title="View Streak Calendar & Milestones"
                >
                  <span>🔥</span>
                  <span>{Number(liveStats.streak ?? user?.streak ?? 0)}d Streak</span>
                  {liveStats.streakFreezes > 0 && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                      ❄️{liveStats.streakFreezes}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#6C63FF]/10 border border-[#6C63FF]/25 text-[#6C63FF] text-xs font-black shadow-sm backdrop-blur-sm">
                  <span>⭐</span>
                  <span>{liveStats.xp || 0} XP</span>
                </div>
              </div>

              {/* User Avatar & Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white font-black text-base shadow-md shadow-[#6C63FF]/30 hover:scale-105 active:scale-95 transition-all overflow-hidden cursor-pointer"
                  aria-label="Open user menu"
                >
                  {user?.avatar && (user.avatar.startsWith("data:image/") || user.avatar.startsWith("http") || user.avatar.startsWith("/")) ? (
                    <img src={user.avatar} alt="User Avatar" className="w-full h-full object-cover" />
                  ) : user?.avatar ? (
                    <span className="text-xl">{user.avatar}</span>
                  ) : (
                    user?.firstName ? user.firstName.charAt(0).toUpperCase() : user?.name ? user.name.charAt(0).toUpperCase() : "U"
                  )}
                </button>
                {!isStudent && (user?.isPro || user?.pro) && (
                  <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-amber-950 shadow-md pointer-events-none">
                    👑
                  </span>
                )}

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-3 w-72 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-2xl p-2 z-20 animate-scale-in">
                      <div className="px-4 py-3 rounded-2xl bg-[var(--bg-elevated)] mb-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <p className="text-sm font-black text-[var(--text-primary)] truncate">{user?.firstName || user?.name || "Learner"}</p>
                            {!isStudent && (user?.isPro || user?.pro) && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-amber-950">PRO</span>
                            )}
                          </div>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#6C63FF]/20 text-[#6C63FF]">
                            {user?.englishLevel || user?.level || "Beginner"}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] font-medium truncate">{user?.email || ""}</p>
                      </div>

                      <div className="space-y-1">
                        <Link
                          to={ROUTES.DASHBOARD}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <span>📊</span> Dashboard
                        </Link>

                        <Link
                          to={ROUTES.SPEAKING}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <span>🎙️</span> Speaking Practice
                        </Link>

                        <Link
                          to={ROUTES.ACHIEVEMENTS}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <span>🏆</span> Achievements & Badges
                        </Link>

                        <Link
                          to={ROUTES.PROFILE}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <span>👤</span> Profile & Voice
                        </Link>

                        <Link
                          to={ROUTES.SETTINGS}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <span>⚙️</span> Settings & Persona
                        </Link>

                        {!isStudent && (
                          <Link
                            to={ROUTES.PRICING}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10 transition-all"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <span>⭐</span> {(user?.isPro || user?.pro) ? "Manage Pro Plan" : "Upgrade to Pro"}
                          </Link>
                        )}

                        <div className="pt-1 mt-1 border-t border-[var(--border-default)]">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                          >
                            <span>🚪</span> Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <button
                type="button"
                id="navbar-admin-login-btn"
                onClick={() => setAdminLoginModalOpen(true)}
                className="hidden md:inline-flex px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
              >
                Login as Admin
              </button>
              <Link
                to={ROUTES.LOGIN}
                className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
              >
                Log In
              </Link>
              <Link
                to={ROUTES.REGISTER}
                className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white text-xs sm:text-sm font-black shadow-md shadow-[#6C63FF]/25 hover:shadow-lg hover:shadow-[#6C63FF]/35 active:scale-95 transition-all whitespace-nowrap"
              >
                Get Started Free
              </Link>
            </div>
          )}
        </div>
      </div>

      <StreakModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        stats={liveStats}
        onRefresh={() => setLiveStats(getLiveProgressStats(user))}
      />

      <AdminLoginModal
        isOpen={adminLoginModalOpen}
        onClose={() => setAdminLoginModalOpen(false)}
      />
    </header>
  );
});

export default Navbar;
