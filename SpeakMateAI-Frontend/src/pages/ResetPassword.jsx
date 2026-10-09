import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { authService } from "../services/authService";
import ROUTES from "../constants/routes";

const TOKEN_REGEX = /^[a-zA-Z0-9_-]{16,128}$/;

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Safely extract and validate token from query parameter
  const rawToken = searchParams.get("token") || "";
  const token = useMemo(() => {
    const trimmed = rawToken.trim();
    return TOKEN_REGEX.test(trimmed) ? trimmed : null;
  }, [rawToken]);

  const hasInvalidTokenParam = Boolean(rawToken.trim() && !token);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const passwordRules = [
    { label: "At least 8 characters", test: (p) => p.length >= 8 },
    { label: "At least one uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
    { label: "At least one lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
    { label: "At least one number (0-9)", test: (p) => /\d/.test(p) },
    { label: "At least one special character (!@#$%...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  const passedRulesCount = passwordRules.filter((r) => r.test(password)).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Valid reset token is required. Please request a new password reset link.");
      return;
    }

    if (passedRulesCount < 5) {
      setError("Please ensure your new password satisfies all security criteria.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        token,
        newPassword: password,
      });
      setSubmitted(true);
      setTimeout(() => {
        navigate(ROUTES.LOGIN);
      }, 2500);
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data || err.message;
      setError(typeof serverMsg === "string" ? serverMsg : "Unable to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-[#6c63ff]/10 text-[#6c63ff] font-extrabold text-xl mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Reset Password</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {token ? "Enter your new secure password below." : "A valid password reset link is required."}
          </p>
        </div>

        {submitted ? (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto" />
            <p className="font-bold text-sm">Password reset successfully!</p>
            <p className="text-xs text-[var(--text-secondary)]">Redirecting you to login page...</p>
          </div>
        ) : !token ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-center space-y-2">
              <AlertTriangle className="w-7 h-7 mx-auto text-rose-500" />
              <p className="font-bold text-sm">
                {hasInvalidTokenParam ? "Invalid or Malformed Token" : "Missing Reset Token"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {hasInvalidTokenParam
                  ? "The reset token provided in the link is invalid or malformed. For your security, please request a fresh reset link."
                  : "No reset token was found in this link. If you forgot your password, please request a new verification code."}
              </p>
            </div>

            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="w-full py-3 rounded-xl bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#6c63ff]/20 transition-all"
            >
              Request Password Reset
            </Link>

            <div className="text-center mt-3">
              <Link to={ROUTES.LOGIN} className="text-xs font-bold text-[#6c63ff] hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Log In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm font-semibold focus:outline-none focus:border-[#6c63ff] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password requirements */}
            {password && (
              <div className="space-y-1.5 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">Security Criteria:</span>
                {passwordRules.map((rule, idx) => {
                  const passed = rule.test(password);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-[11px]">
                      <span className={passed ? "text-emerald-500 font-bold" : "text-[var(--text-muted)]"}>
                        {passed ? "✓" : "○"}
                      </span>
                      <span className={passed ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-[var(--text-secondary)]"}>
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm font-semibold focus:outline-none focus:border-[#6c63ff] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || passedRulesCount < 5 || password !== confirmPassword}
              className="w-full py-3 rounded-xl bg-[#6c63ff] hover:bg-[#5b52e0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md shadow-[#6c63ff]/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Updating Password..." : "Update Password"}
            </button>

            <div className="text-center mt-4">
              <Link to={ROUTES.LOGIN} className="text-xs font-bold text-[#6c63ff] hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Log In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
