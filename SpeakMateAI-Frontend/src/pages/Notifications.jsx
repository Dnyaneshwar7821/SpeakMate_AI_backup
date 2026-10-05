import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { notificationService } from "../services/appServices";
import {
  Bell,
  CheckCheck,
  Trash2,
  Flame,
  Sparkles,
  BookOpen,
  Mic,
  Lightbulb,
  Check,
  RefreshCw,
  Trophy,
} from "lucide-react";

export function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL"); // 'ALL' | 'UNREAD'
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const notifs = await notificationService.all().catch(() => []);
      setNotifications(Array.isArray(notifs) ? notifs : []);
      window.dispatchEvent(new CustomEvent("speakmate_notifications_updated"));
    } catch (e) {
      console.error("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener("focus", loadData);
    return () => window.removeEventListener("focus", loadData);
  }, [loadData]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      window.dispatchEvent(new CustomEvent("speakmate_notifications_updated"));
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (!unread.length) return;
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent("speakmate_notifications_updated"));
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new CustomEvent("speakmate_notifications_updated"));
    } catch (e) {
      console.error("Failed to delete notification:", e);
    }
  };

  const handleClearAll = async () => {
    try {
      await notificationService.clearAll();
      setNotifications([]);
      setShowClearConfirm(false);
      window.dispatchEvent(new CustomEvent("speakmate_notifications_updated"));
    } catch (e) {
      console.error("Failed to clear notifications:", e);
    }
  };

  const getNotifIcon = (title = "") => {
    const t = title.toLowerCase();
    if (t.includes("achievement") || t.includes("trophy") || t.includes("medal")) {
      return { icon: Trophy, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" };
    }
    if (t.includes("welcome") || t.includes("start")) {
      return { icon: Sparkles, color: "text-purple-400 bg-purple-500/15 border-purple-500/30" };
    }
    if (t.includes("streak") || t.includes("flame")) {
      return { icon: Flame, color: "text-orange-400 bg-orange-500/15 border-orange-500/30" };
    }
    if (t.includes("vocab") || t.includes("word")) {
      return { icon: Lightbulb, color: "text-pink-400 bg-pink-500/15 border-pink-500/30" };
    }
    if (t.includes("lesson") || t.includes("quiz") || t.includes("grammar")) {
      return { icon: BookOpen, color: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30" };
    }
    if (t.includes("speak") || t.includes("session") || t.includes("voice")) {
      return { icon: Mic, color: "text-sky-400 bg-sky-500/15 border-sky-500/30" };
    }
    return { icon: Bell, color: "text-[#6C63FF] bg-[#6C63FF]/15 border-[#6C63FF]/30" };
  };

  // Live timer tick every 5 seconds to update 's ago' and 'm ago' in real-time
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    let str = String(dateStr).trim();
    if (str.includes("T") && !str.endsWith("Z") && !str.includes("+") && !str.match(/-\d{2}:\d{2}$/)) {
      str = `${str}Z`;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date(dateStr) : d;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Just now";
    try {
      const date = parseDate(dateStr);
      if (!date || isNaN(date.getTime())) return "Just now";
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - date.getTime());
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 10) return "Just now";
      if (diffSecs < 60) return `${diffSecs}s ago`;
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "Just now";
    }
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "UNREAD") return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-2 sm:px-4 lg:px-6 py-2">
      {/* ── Top Hero Header ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white shadow-2xl space-y-4 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 mb-3.5 sm:mb-4">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-amber-300 border border-white/20 shadow-sm flex items-center gap-1.5">
                <Bell className="w-3 h-3" />
                Live Notification Center
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-rose-500 text-white animate-pulse shadow-sm">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-2">Notifications & Alerts</h1>
            <p className="text-xs text-indigo-200 font-medium leading-relaxed">
              Stay updated with daily practice reminders, streak updates, and achievement rewards.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh notifications"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-black text-white transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                Mark All Read
              </button>
            )}

            {notifications.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-black text-rose-300 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs Ribbon */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              filter === "ALL"
                ? "bg-white text-[#1E1B4B] shadow-md"
                : "bg-white/10 text-white/80 hover:bg-white/15 border border-white/10"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("UNREAD")}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              filter === "UNREAD"
                ? "bg-white text-[#1E1B4B] shadow-md"
                : "bg-white/10 text-white/80 hover:bg-white/15 border border-white/10"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* ── General System Notifications ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#6C63FF]" />
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
            General Activity & Practice Alerts
          </h2>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] grid place-items-center mx-auto text-2xl">
              🔔
            </div>
            <p className="font-extrabold text-base text-[var(--text-primary)]">
              {filter === "UNREAD" ? "No unread notifications!" : "No notifications right now!"}
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              You're completely caught up! We'll notify you when you earn new achievements or need to maintain your streak.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((item) => {
              const { icon: ItemIcon, color } = getNotifIcon(item.title);
              const isUnread = !item.isRead;

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 group ${
                    isUnread
                      ? "bg-[var(--bg-surface)] border-[#6C63FF]/40 ring-1 ring-[#6C63FF]/20 shadow-md shadow-[#6C63FF]/5"
                      : "bg-[var(--bg-surface)]/60 border-[var(--border-default)] opacity-85 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`p-3 rounded-2xl shrink-0 border ${color}`}>
                      <ItemIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-sm text-[var(--text-primary)] truncate ${
                            isUnread ? "font-black" : "font-bold"
                          }`}
                        >
                          {item.title}
                        </h3>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed break-words">
                        {item.message}
                      </p>

                      <span className="text-[10px] text-[var(--text-muted)] font-bold block pt-1">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        title="Mark as read"
                        className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border border-emerald-500/30 transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(item.id)}
                      title="Delete notification"
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-500 border border-rose-500/20 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Clear All Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 grid place-items-center mx-auto text-xl border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-[var(--text-primary)]">Clear All Notifications?</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Are you sure you want to delete all notifications? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-default)] text-xs font-bold text-[var(--text-primary)] hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-black text-white shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;
