import React, { memo, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ROUTES from "../../constants/routes";

const SidebarItem = memo(function SidebarItem({ item }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-150 ${
          isActive
            ? "bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white shadow-lg shadow-[#6C63FF]/30 scale-[1.02]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] hover:translate-x-1"
        }`
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </div>
      {item.badge && (
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
});

const MAIN_ITEMS = [
  {
    path: ROUTES.DASHBOARD,
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    path: ROUTES.SPEAKING,
    label: "Live AI Speaking",
    badge: "Live AI",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    path: ROUTES.AI_CHAT,
    label: "AI Chat Coach",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    path: ROUTES.PROGRESS,
    label: "Analytics & Fluency",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const MODULE_ITEMS = [
  {
    path: ROUTES.LESSONS,
    label: "CEFR Lessons",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    path: ROUTES.GRAMMAR,
    label: "Grammar Doctor",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    path: ROUTES.VOCABULARY,
    label: "Vocabulary Builder",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    path: ROUTES.ACHIEVEMENTS,
    label: "Badges & Rewards",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4m6 17v-5m0 0a5 5 0 005-5V7a2 2 0 00-2-2H6a2 2 0 00-2 2v5a5 5 0 005 5v5m6 0H9" />
      </svg>
    ),
  },
];

const ACCOUNT_ITEMS = [
  {
    path: ROUTES.PROFILE,
    label: "Profile & Persona",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    path: ROUTES.SETTINGS,
    label: "Settings & Speech",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      </svg>
    ),
  },
];

export const Sidebar = memo(function Sidebar() {
  const { user } = useAuth();
  const isStudent = useMemo(() => {
    if (user?.accountType === "INDIVIDUAL_USER" || user?.accountType === "USER") return false;
    return Boolean(
      user?.accountType === "STUDENT" ||
      user?.isSchoolStudent ||
      user?.role === "STUDENT" ||
      user?.schoolId ||
      (user?.schoolGrade && user?.accountType !== "INDIVIDUAL_USER") ||
      localStorage.getItem("speakmate_account_type") === "STUDENT"
    );
  }, [user]);

  return (
    <aside className="w-64 lg:w-72 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-surface)] h-[calc(100vh-80px)] sticky top-20 flex flex-col justify-between p-4 overflow-y-auto z-30 transition-colors duration-200 contain-layout">
      <div className="space-y-6">
        {/* SECTION 1: MAIN WORKSPACE */}
        <div className="space-y-1.5">
          <p className="px-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            Main Practice Hub
          </p>
          {MAIN_ITEMS.map((item) => (
            <SidebarItem key={item.path} item={item} />
          ))}
        </div>

        {/* SECTION 2: LEARNING MODULES */}
        <div className="space-y-1.5 pt-3 border-t border-[var(--border-default)]">
          <p className="px-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            Curriculum & Drills
          </p>
          {MODULE_ITEMS.map((item) => (
            <SidebarItem key={item.path} item={item} />
          ))}
        </div>

        {/* SECTION 3: ACCOUNT & SETTINGS */}
        <div className="space-y-1.5 pt-3 border-t border-[var(--border-default)]">
          <p className="px-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            Preferences & Account
          </p>
          {ACCOUNT_ITEMS.map((item) => (
            <SidebarItem key={item.path} item={item} />
          ))}
        </div>
      </div>

      {/* PRO UPGRADE PROMO (FOR INDIVIDUAL FREE USERS ONLY) */}
      {!isStudent && !user?.isPro && !user?.pro && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-700 text-white shadow-lg space-y-2 mb-2 mt-4">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs flex items-center gap-1">⭐ SpeakMate Pro</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-amber-950">Save 33%</span>
          </div>
          <p className="text-[11px] text-white/90 leading-tight">
            Unlock unlimited 24/7 AI speaking, strict grammar & all avatars.
          </p>
          <NavLink
            to={ROUTES.PRICING}
            className="block text-center w-full py-1.5 px-2 rounded-xl bg-white text-indigo-700 font-extrabold text-[11px] hover:bg-white/90 shadow-sm transition-all active:scale-95"
          >
            Upgrade Now (From ₹149) ➔
          </NavLink>
        </div>
      )}

      {/* PRO ACTIVE STATUS (FOR INDIVIDUAL PRO USERS) */}
      {!isStudent && (user?.isPro || user?.pro) && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg space-y-1.5 mb-2 mt-4">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs flex items-center gap-1">👑 SpeakMate Pro VIP</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-300 text-emerald-950">ACTIVE</span>
          </div>
          <p className="text-[10px] text-white/90 leading-tight">
            Unlimited 24/7 AI Speaking & Grammar Doctor Active
          </p>
        </div>
      )}

      {/* USER BOTTOM CARD */}
      <div className="pt-3 border-t border-[var(--border-default)]">
        <div className="p-3.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center gap-3 shadow-inner">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-[#6C63FF] via-[#8B5CF6] to-[#FF6584] text-white font-black text-sm shadow-md overflow-hidden">
            {user?.avatar && user.avatar.length <= 4 ? (
              <span className="text-xl">{user.avatar}</span>
            ) : user?.avatar && user.avatar.startsWith("http") ? (
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              user?.firstName ? user.firstName.charAt(0).toUpperCase() : user?.name ? user.name.charAt(0).toUpperCase() : "U"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs text-[var(--text-primary)] truncate">{user?.firstName || user?.name || "Learner"}</p>
              {!isStudent && (user?.isPro || user?.pro) && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-amber-950">PRO</span>
              )}
            </div>
            <p className="text-[10px] font-extrabold text-[#6C63FF] truncate">
              {isStudent && (user?.schoolGrade || localStorage.getItem("speakmate_school_grade"))
                ? `Std: ${user?.schoolGrade || localStorage.getItem("speakmate_school_grade")}`
                : `CEFR: ${user?.englishLevel || user?.level || localStorage.getItem("speakmate_english_level") || "B1 Intermediate"}`}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
});

export default Sidebar;
