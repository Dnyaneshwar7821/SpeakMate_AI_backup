import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ROUTES from "../constants/routes";
import { chatService } from "../services/appServices";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { useToast } from "../context/ToastContext";

const CHAT_MODES = [
  { key: "General English", title: "General English", desc: "Improve conversation, general fluency and grammar.", difficulty: "All levels", icon: "💬", color: "#6C63FF" },
  { key: "Grammar Coach", title: "Grammar Doctor", desc: "Deep-dive into correct syntax, tenses, and sentence styling.", difficulty: "Beginner", icon: "✍️", color: "#EC4899" },
  { key: "Vocabulary Builder", title: "Vocabulary Builder", desc: "Enrich expression, learn native synonyms and idioms.", difficulty: "Intermediate", icon: "📚", color: "#F59E0B" },
  { key: "Daily Conversation", title: "Daily Conversation", desc: "Practice common everyday talking scenarios.", difficulty: "Beginner", icon: "☕", color: "#10B981" },
  { key: "Interview Coach", title: "Interview Coach", desc: "Practice responses for job interviews and professional feedback.", difficulty: "Advanced", icon: "💼", color: "#8B5CF6" },
  { key: "Business English", title: "Business English", desc: "Master corporate emails, meetings, and business talk.", difficulty: "Advanced", icon: "📊", color: "#3B82F6" },
  { key: "Travel English", title: "Travel English", desc: "Learn useful vocabulary for flights, hotels, and directions.", difficulty: "Beginner", icon: "✈️", color: "#06B6D4" },
  { key: "IELTS Speaking", title: "IELTS Speaking", desc: "Simulate official IELTS speaking parts with targeted scoring.", difficulty: "Advanced", icon: "🏅", color: "#EF4444" },
  { key: "Storytelling", title: "Storytelling", desc: "Construct narratives, descriptive tales, and explain events.", difficulty: "Intermediate", icon: "📖", color: "#10B981" },
  { key: "Debate", title: "Debate", desc: "Discuss controversial topics, formulate arguments, and reply.", difficulty: "Advanced", icon: "⚖️", color: "#6C63FF" },
  { key: "Free Chat", title: "Freeform AI Chat", desc: "Open-ended dialogue with your tutor on any topic.", difficulty: "All levels", icon: "✨", color: "#F59E0B" },
];

export function AiChat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showConfirm } = useModal();
  const toast = useToast();
  const [history, setHistory] = useState(() => {
    try {
      const cached = sessionStorage.getItem("speakmate_chat_history_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameTargetSession, setRenameTargetSession] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [renaming, setRenaming] = useState(false);

  const accountType = user?.accountType || localStorage.getItem("speakmate_account_type") || "INDIVIDUAL_USER";
  const isStudent = accountType === "STUDENT" || Boolean(user?.isSchoolStudent);
  const [userAgeGroup, setUserAgeGroup] = useState(() => user?.ageGroup || localStorage.getItem("speakmate_age_group") || "Professional");
  const [userGrade, setUserGrade] = useState(() => user?.schoolGrade || localStorage.getItem("speakmate_school_grade") || "1st Std");

  const fetchHistory = async () => {
    try {
      const data = await chatService.history().catch(() => []);
      const historyList = Array.isArray(data) ? data : [];
      setHistory(historyList);
      try {
        sessionStorage.setItem("speakmate_chat_history_cache", JSON.stringify(historyList));
      } catch (_) {}
      const savedGrade = user?.schoolGrade || localStorage.getItem("speakmate_school_grade");
      const savedAge = user?.ageGroup || localStorage.getItem("speakmate_age_group");
      if (savedGrade) setUserGrade(savedGrade);
      if (savedAge) setUserAgeGroup(savedAge);
    } catch (e) {
      console.warn("Failed to load chat history", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.ageGroup) setUserAgeGroup(user.ageGroup);
    if (user?.schoolGrade) setUserGrade(user.schoolGrade);
  }, [user?.ageGroup, user?.schoolGrade]);

  useEffect(() => {
    fetchHistory();
    const handleAgeUpdate = (e) => {
      const newAge = e?.detail?.ageGroup || user?.ageGroup || localStorage.getItem("speakmate_age_group");
      if (newAge) setUserAgeGroup(newAge);
    };
    window.addEventListener("speakmate_age_group_changed", handleAgeUpdate);
    window.addEventListener("speakmate_settings_updated", handleAgeUpdate);
    window.addEventListener("speakmate_progress_updated", fetchHistory);
    return () => {
      window.removeEventListener("speakmate_age_group_changed", handleAgeUpdate);
      window.removeEventListener("speakmate_settings_updated", handleAgeUpdate);
      window.removeEventListener("speakmate_progress_updated", fetchHistory);
    };
  }, []);

  const handleStartSession = async (modeKey) => {
    try {
      const res = await chatService.start(modeKey);
      const sessionId = res?.id || Date.now().toString();
      const title = res?.title || `${modeKey} Session`;
      navigate(`${ROUTES.CONVERSATION_CHAT}?sessionId=${sessionId}&mode=${encodeURIComponent(modeKey)}&title=${encodeURIComponent(title)}`);
    } catch {
      const sessionId = Date.now().toString();
      const title = `${modeKey} Session`;
      navigate(`${ROUTES.CONVERSATION_CHAT}?sessionId=${sessionId}&mode=${encodeURIComponent(modeKey)}&title=${encodeURIComponent(title)}`);
    }
  };

  const handleResumeSession = (session) => {
    navigate(`${ROUTES.CONVERSATION_CHAT}?sessionId=${session.id}&mode=${encodeURIComponent(session.mode)}&title=${encodeURIComponent(session.title)}`);
  };

  const handleDeleteSession = async (id, e) => {
    e.stopPropagation();
    const confirmed = await showConfirm({
      title: "Delete Chat Session?",
      message: "Are you sure you want to permanently delete this chat session and its message history?",
      confirmText: "Delete Session",
      cancelText: "Keep Session",
      type: "danger",
    });

    if (confirmed) {
      try {
        await chatService.deleteSession(id);
        setHistory((prev) => prev.filter((s) => s.id !== id));
        toast.success("Chat session deleted successfully");
      } catch (err) {
        console.error("Delete session error:", err);
        toast.error("Failed to delete chat session");
      }
    }
  };

  const handleRenameSession = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !renameTargetSession) return;
    setRenaming(true);
    try {
      await chatService.renameSession(renameTargetSession.id, newTitle.trim());
      setHistory((prev) =>
        prev.map((s) => (s.id === renameTargetSession.id ? { ...s, title: newTitle.trim() } : s))
      );
      setRenameTargetSession(null);
      setNewTitle("");
    } catch (e) {
      console.error("Rename session error:", e);
    } finally {
      setRenaming(false);
    }
  };

  const filteredModes = CHAT_MODES.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-2 sm:px-4 lg:px-6 py-2">
      {/* Top Banner */}
      <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white shadow-2xl space-y-4 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border border-white/10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300 border border-white/20 shadow-sm mb-3.5 sm:mb-4">
            <span>✨</span>
            <span>{isStudent ? `24/7 AI Language Tutor · Standard: ${userGrade}` : `24/7 AI Language Tutor · ${userAgeGroup} Profile`}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-2.5">AI Chat Coach</h1>
          <p className="text-xs sm:text-sm text-indigo-200 font-medium leading-relaxed">
            Practice conversational English with immediate spoken AI corrections, grammar advice, and vocabulary hints.
          </p>
        </div>

        <button
          onClick={() => handleStartSession("Free Chat")}
          className="px-7 py-4 rounded-2xl bg-gradient-to-r from-[#6C63FF] via-[#7C74FF] to-[#FF6584] hover:from-[#7C74FF] hover:to-[#FF7593] text-white font-black text-xs sm:text-sm shadow-xl shadow-[#6C63FF]/30 hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          ✨ Launch Free AI Chat
        </button>
      </div>

      {/* Search Input */}
      <div className="glass-card p-4 rounded-3xl border border-[var(--border-default)]">
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3.5 top-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search AI tutor modes and discussion topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-xs sm:text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#6C63FF] shadow-inner"
          />
        </div>
      </div>

      {/* Recent Chat Conversations Row */}
      {history.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-[var(--text-primary)]">Recent Chat Sessions</h2>
            <span className="text-xs font-black text-[#6C63FF]">{history.length} active threads</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {history.slice(0, 6).map((session) => (
              <div
                key={session.id}
                onClick={() => handleResumeSession(session)}
                className="glass-card glass-card-hover p-6 rounded-3xl space-y-3.5 flex flex-col justify-between cursor-pointer group border border-[var(--border-default)]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#6C63FF]/20 text-[#6C63FF]">
                      {session.mode || "General"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTargetSession(session);
                          setNewTitle(session.title);
                        }}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <h3 className="font-black text-base text-[var(--text-primary)] group-hover:text-[#6C63FF] transition-colors truncate">
                    {session.title || "Conversation Thread"}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium truncate">
                    {session.lastMessage || "Click to resume conversation with AI tutor..."}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs font-black text-[#6C63FF]">
                  <span>Resume Conversation</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available AI Chat Modes Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-[var(--text-primary)]">Choose AI Tutor Mode</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredModes.map((mode) => (
            <div
              key={mode.key}
              onClick={() => handleStartSession(mode.key)}
              className="glass-card glass-card-hover p-6 rounded-3xl space-y-4 flex flex-col justify-between cursor-pointer group border border-[var(--border-default)]"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-3xl p-3 rounded-2xl bg-[var(--bg-elevated)] shadow-inner">{mode.icon}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[10px] font-black uppercase">
                    {mode.difficulty}
                  </span>
                </div>

                <h3 className="font-black text-base text-[var(--text-primary)] group-hover:text-[#6C63FF] transition-colors">
                  {mode.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">{mode.desc}</p>
              </div>

              <div className="pt-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
                <span>AI English Coach</span>
                <span className="text-[#6C63FF] font-black group-hover:translate-x-1 transition-transform">Start Chat →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rename Modal */}
      {renameTargetSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRenameSession} className="glass-card p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl border border-[var(--border-default)]">
            <h3 className="text-lg font-black text-[var(--text-primary)]">Rename Chat Session</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new conversation title..."
              className="w-full p-3.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[#6C63FF]"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRenameTargetSession(null)}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] text-xs font-bold text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renaming || !newTitle.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white text-xs font-black shadow-md disabled:opacity-50"
              >
                {renaming ? "Saving..." : "Save Title"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default AiChat;
