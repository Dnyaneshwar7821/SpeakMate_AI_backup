import React from "react";
import { Sparkles } from "lucide-react";

/**
 * SpeakMateLoader
 * Premium dual-spinning ring loader matching the Admin Dashboard design token.
 * Features outer primary ring, inner counter-spinning accent ring, center glowing gradient emblem,
 * and animated typing/pulsing dots.
 */
export function SpeakMateLoader({
  message = "Loading...",
  subMessage = "Synchronizing your learning workspace",
  fullScreen = false,
  size = "md", // "sm", "md", "lg"
  className = "",
}) {
  const sizeMap = {
    sm: {
      ring: "h-14 w-14",
      innerRing: "inset-1.5",
      badge: "h-7 w-7",
      icon: "h-3.5 w-3.5",
      title: "text-sm",
      sub: "text-[11px]",
    },
    md: {
      ring: "h-20 w-20",
      innerRing: "inset-2",
      badge: "h-10 w-10",
      icon: "h-5 w-5",
      title: "text-lg",
      sub: "text-xs",
    },
    lg: {
      ring: "h-24 w-24",
      innerRing: "inset-2",
      badge: "h-12 w-12",
      icon: "h-6 w-6",
      title: "text-xl",
      sub: "text-sm",
    },
  };

  const s = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`relative z-10 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 ${className}`}>
      {/* Animated Dual-Ring Emblem Matching Web App Theme */}
      <div className={`relative flex ${s.ring} items-center justify-center`}>
        {/* Outer spinning ring - Primary brand #6C63FF */}
        <div className="absolute inset-0 rounded-full border-[3px] border-[#6C63FF]/20 border-t-[#6C63FF] animate-spin shadow-sm shadow-[#6C63FF]/20" />
        {/* Inner counter-spinning ring - Brand accent #FF6584 */}
        <div className={`absolute ${s.innerRing} rounded-full border-[3px] border-[#FF6584]/20 border-b-[#FF6584] animate-[spin_1.5s_linear_infinite_reverse]`} />
        {/* Center glowing badge with brand gradient */}
        <div className={`flex ${s.badge} items-center justify-center rounded-full bg-gradient-to-br from-[#6C63FF] via-indigo-600 to-[#FF6584] text-white shadow-xl shadow-[#6C63FF]/30`}>
          <Sparkles className={`${s.icon} animate-pulse text-white`} />
        </div>
      </div>

      {/* Brand title matching web app gradient */}
      <h3 className={`mt-5 font-black tracking-tight bg-gradient-to-r from-[#6C63FF] via-purple-600 to-[#FF6584] bg-clip-text text-transparent ${s.title}`}>
        SpeakMate AI
      </h3>

      {/* Message with theme-colored animated pulsing dots */}
      <div className="mt-2 flex items-center justify-center gap-1.5 font-semibold text-[var(--text-secondary)] text-sm">
        <span>{message}</span>
        <span className="flex w-5 justify-start">
          <span className="animate-[ping_1.4s_infinite] text-lg leading-none text-[#6C63FF]">.</span>
          <span className="animate-[ping_1.4s_0.2s_infinite] text-lg leading-none text-purple-500">.</span>
          <span className="animate-[ping_1.4s_0.4s_infinite] text-lg leading-none text-[#FF6584]">.</span>
        </span>
      </div>

      {subMessage && (
        <p className={`mt-1.5 font-medium text-[var(--text-muted)] max-w-xs ${s.sub}`}>
          {subMessage}
        </p>
      )}

      {/* Thin brand theme progress indicator */}
      <div className="w-52 sm:w-60 mt-4 h-1.5 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-full overflow-hidden p-0.5">
        <div className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] via-purple-500 to-[#FF6584] animate-[pulse_1.2s_ease-in-out_infinite]" style={{ width: "100%" }} />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[var(--bg-base)] text-[var(--text-primary)] transition-all duration-300 select-none overflow-hidden">
        {/* Ambient Subtle Theme Glow Orbs */}
        <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-[#6C63FF]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-[#FF6584]/10 blur-3xl pointer-events-none" />
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] w-full flex items-center justify-center py-12">
      {content}
    </div>
  );
}

/**
 * Shimmer card skeleton for cards, statistics, and list placeholders.
 */
export function SpeakMateCardSkeleton({ className = "h-32" }) {
  return (
    <div className={`rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-sm animate-pulse flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded-lg bg-slate-200 dark:bg-slate-700/60" />
        <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-700/60" />
      </div>
      <div className="space-y-2 mt-4">
        <div className="h-7 w-20 rounded-lg bg-slate-200 dark:bg-slate-700/80" />
        <div className="h-3 w-36 rounded-md bg-slate-100 dark:bg-slate-800/80" />
      </div>
    </div>
  );
}

export default SpeakMateLoader;
