import { Link, useLocation } from "react-router-dom";
import ROUTES from "../constants/routes";
import { stripQuotes } from "../utils/aiConversationEngine";

export function SpeakingSummary() {
  const location = useLocation();
  const summary = location.state?.summary || {
    score: 88,
    overallScore: 88,
    grammarScore: 85,
    vocabularyScore: 90,
    fluencyScore: 86,
    pronunciationScore: 91,
    xpEarned: 20,
    duration: 360,
    messagesExchanged: 6,
    summary: "Great job completing your AI speaking session. You demonstrated good vocabulary variety and clear pronunciation.",
    vocabularyLearned: "Proficiency, Natural fluency, Articulate, Scenario",
    grammarCorrections: "Excellent overall tense consistency. Tip: Use Present Perfect Continuous for ongoing duration.",
    betterSentences: "I would like to enhance my English speaking proficiency for professional meetings.",
    motivationalMessage: "Keep practicing every day to sound more natural and confident!",
  };

  const score = Math.round(summary.overallScore || summary.score || 0);
  const xp = summary.xpEarned || 0;
  const mins = summary.duration ? Math.floor(summary.duration / 60) : 0;
  const secs = summary.duration ? summary.duration % 60 : 0;

  const fluencyScore = Math.round(summary.fluencyScore ?? (score > 0 ? Math.max(20, score - 3) : 0));
  const grammarScore = Math.round(summary.grammarScore ?? (score > 0 ? Math.max(20, score + 2) : 0));
  const vocabularyScore = Math.round(summary.vocabularyScore ?? (score > 0 ? Math.max(20, score - 1) : 0));
  const pronunciationScore = Math.round(summary.pronunciationScore ?? (score > 0 ? Math.max(20, score + 1) : 0));

  const getHeaderTitle = () => {
    if (score === 0) return "Session Completed";
    if (score >= 85) return "Outstanding Effort! 🎉";
    if (score >= 70) return "Great Practice! 🌟";
    if (score >= 50) return "Good Progress! 💪";
    return "Keep Practicing! 🚀";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 px-2">
      {/* Top Header Banner */}
      <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#6C63FF] text-white shadow-2xl flex flex-col items-center justify-center text-center space-y-5 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-3xl pointer-events-none rounded-full" />
        
        <span className="text-[10px] font-black uppercase tracking-wider bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
          Session Results & AI Evaluation
        </span>

        {/* Score Ring */}
        <div className="grid h-32 w-32 place-items-center rounded-full bg-white/10 border-4 border-[#6C63FF] shadow-2xl my-2">
          <div>
            <span className="text-4xl font-black">{score}%</span>
            <p className="text-[9px] font-bold uppercase opacity-80 mt-0.5">Overall Score</p>
          </div>
        </div>

        <div className="space-y-1 max-w-md">
          <h1 className="text-2xl sm:text-3xl font-black">{getHeaderTitle()}</h1>
          <p className="text-xs sm:text-sm text-indigo-200 font-medium">
            {summary.motivationalMessage || "Keep practicing daily to build lasting spoken confidence."}
          </p>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-3xl text-center space-y-1 border border-[var(--border-default)] shadow-sm bg-[var(--bg-card)]">
          <span className="text-2xl">⚡</span>
          <p className="text-xl font-black text-amber-500">+{xp} XP</p>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">XP Earned</p>
        </div>

        <div className="glass-card p-5 rounded-3xl text-center space-y-1 border border-[var(--border-default)] shadow-sm bg-[var(--bg-card)]">
          <span className="text-2xl">⏱️</span>
          <p className="text-xl font-black text-[#6C63FF]">
            {mins > 0 ? `${mins}m ` : ""}{secs}s
          </p>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Speaking Time</p>
        </div>

        <div className="glass-card p-5 rounded-3xl text-center space-y-1 border border-[var(--border-default)] shadow-sm bg-[var(--bg-card)]">
          <span className="text-2xl">💬</span>
          <p className="text-xl font-black text-emerald-500">{summary.messagesExchanged || 0}</p>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Dialogue Turns</p>
        </div>
      </div>

      {/* ── Skill Evaluation Breakdown ── */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl border border-[var(--border-default)] space-y-4 shadow-sm bg-[var(--bg-card)]">
        <h2 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <span>📊 Skill Evaluation Breakdown</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Fluency & Flow */}
          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-[var(--text-primary)]">🗣️ Fluency & Flow</span>
              <span className="text-[#6C63FF]">{fluencyScore}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] transition-all duration-500" style={{ width: `${fluencyScore}%` }} />
            </div>
          </div>

          {/* Grammar Accuracy */}
          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-[var(--text-primary)]">✍️ Grammar Accuracy</span>
              <span className="text-emerald-500">{grammarScore}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${grammarScore}%` }} />
            </div>
          </div>

          {/* Vocabulary Variety */}
          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-[var(--text-primary)]">📖 Vocabulary Variety</span>
              <span className="text-amber-500">{vocabularyScore}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500" style={{ width: `${vocabularyScore}%` }} />
            </div>
          </div>

          {/* Speech Clarity */}
          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-[var(--text-primary)]">🎙️ Speech Clarity</span>
              <span className="text-cyan-500">{pronunciationScore}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-500" style={{ width: `${pronunciationScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Sections */}
      <div className="space-y-4">
        {/* Session Summary */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-[var(--border-default)] space-y-2 shadow-sm bg-[var(--bg-card)]">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
            <span>📄 Comprehensive Evaluation</span>
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] leading-relaxed">{summary.summary}</p>
        </div>

        {/* Vocabulary Suggested */}
        {summary.vocabularyLearned && (
          <div className="glass-card p-6 sm:p-7 rounded-3xl border border-amber-500/30 space-y-2 shadow-sm bg-amber-500/5">
            <h2 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <span>💡 Vocabulary & Synonyms Suggested</span>
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">{summary.vocabularyLearned}</p>
          </div>
        )}

        {/* Grammar Notes */}
        {summary.grammarCorrections && (
          <div className="glass-card p-6 sm:p-7 rounded-3xl border border-emerald-500/30 space-y-2 shadow-sm bg-emerald-500/5">
            <h2 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-2">
              <span>✓ Grammar Doctor Recommendations</span>
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">{summary.grammarCorrections}</p>
          </div>
        )}

        {/* Native Expressions */}
        {summary.betterSentences && (
          <div className="glass-card p-6 sm:p-7 rounded-3xl border border-[#6C63FF]/30 space-y-2 shadow-sm bg-[#6C63FF]/5">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#6C63FF] flex items-center gap-2">
              <span>📈 Recommended Native Phrasing</span>
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">💡 "{stripQuotes(summary.betterSentences)}"</p>
          </div>
        )}
      </div>

      {/* Done Action Button */}
      <div className="pt-4 flex justify-center">
        <Link
          to={ROUTES.SPEAKING}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#6C63FF] via-[#7C74FF] to-[#8B5CF6] hover:from-[#7C74FF] hover:to-[#9D71FB] text-white font-black text-sm shadow-xl shadow-[#6C63FF]/25 text-center active:scale-95 transition-all"
        >
          Return to Speaking Practice Studio →
        </Link>
      </div>
    </div>
  );
}

export default SpeakingSummary;
