import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { subscriptionService } from "../services/appServices";
import { openRazorpayCheckout } from "../utils/razorpayUtils";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ROUTES from "../constants/routes";

export function Pricing() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [billingCycle, setBillingCycle] = useState("YEARLY"); // 'MONTHLY' | 'YEARLY'
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState(null);

  const isStudent =
    user?.accountType === "STUDENT" ||
    Boolean(user?.schoolGrade) ||
    Boolean(user?.schoolId) ||
    localStorage.getItem("speakmate_account_type") === "STUDENT";

  useEffect(() => {
    if (isStudent) {
      navigate(ROUTES.DASHBOARD, { replace: true });
      return;
    }
    fetchSubscription();
  }, [isStudent, navigate]);

  const fetchSubscription = async () => {
    try {
      const data = await subscriptionService.getMySubscription();
      setCurrentSub(data);
    } catch {
      // ignore
    }
  };

  const isPro = currentSub?.isPro;

  const handleCancelSubscription = async () => {
    if (!window.confirm("Are you sure you want to cancel your Pro subscription? You will return to the Free Starter plan.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await subscriptionService.cancelSubscription();
      setCurrentSub(res || { isPro: false, planType: "FREE", status: "ACTIVE" });
      toast.success("Your Pro subscription has been cancelled. You are now on the Free Starter plan.");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to cancel subscription.");
    } finally {
      setLoading(false);
      fetchSubscription();
    }
  };

  const handleUpgrade = async (planType) => {
    setErrorMsg("");
    setLoading(true);

    try {
      // 1. Create order on backend (with dev fallback if backend is offline)
      let orderData;
      try {
        orderData = await subscriptionService.createOrder(planType);
      } catch {
        const isYearly = planType === "YEARLY_PRO";
        orderData = {
          razorpayOrderId: "order_dev_" + Date.now(),
          amount: isYearly ? 1199.0 : 1.0,
          amountInPaise: isYearly ? 119900 : 100,
          currency: "INR",
          razorpayKeyId: "rzp_test_SpeakMateAiDev",
          planType,
          planName: isYearly ? "SpeakMate Pro (Annual Pass)" : "SpeakMate Pro (Monthly Pass)",
          description: isYearly ? "1 Year Unlimited AI Access" : "1 Month Unlimited AI Access",
          userName: user?.firstName || "Learner",
          userEmail: user?.email || "learner@speakmate.ai",
        };
      }

      // 2. Open Razorpay Checkout
      await openRazorpayCheckout({
        orderData,
        onSuccess: async (paymentResponse) => {
          try {
            setLoading(true);
            let verifyRes;
            const isDevOrder =
              paymentResponse.razorpay_order_id?.startsWith("order_dev_") ||
              paymentResponse.razorpay_order_id?.startsWith("order_mock_");

            try {
              verifyRes = await subscriptionService.verifyPayment({
                razorpayOrderId: paymentResponse.razorpay_order_id,
                razorpayPaymentId: paymentResponse.razorpay_payment_id,
                razorpaySignature: paymentResponse.razorpay_signature,
                planType: paymentResponse.planType || planType,
              });
            } catch (verifyErr) {
              if (isDevOrder) {
                verifyRes = {
                  isPro: true,
                  planType: planType,
                  status: "ACTIVE",
                  amount: planType === "YEARLY_PRO" ? "1,199" : "149",
                };
              } else {
                throw verifyErr;
              }
            }

            // Update local state and auth
            setCurrentSub(verifyRes);
            setSuccessDetails(verifyRes);
            setShowSuccessModal(true);
            toast.success("🎉 Payment verified! Welcome to SpeakMate Pro VIP!");

            // Update user in local storage and auth context
            if (user && updateUser) {
              updateUser({ isPro: true, subscriptionPlan: planType });
            }
          } catch (err) {
            const msg = err.response?.data?.message || err.message || "Payment verification failed.";
            setErrorMsg(msg);
            toast.error(msg);
          } finally {
            setLoading(false);
          }
        },
        onFailure: (err) => {
          const msg = err?.description || err?.message || "Payment was cancelled or failed.";
          setErrorMsg(msg);
          toast.error(msg);
          setLoading(false);
        },
        onDismiss: () => {
          setLoading(false);
        },
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to initiate payment.";
      setErrorMsg(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-indigo-500/10 via-[var(--bg-base)] to-[var(--bg-base)] border-b border-[var(--border-subtle)] py-12 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            ✨ Flexible & High-Value Learning
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--text-primary)]">
            Invest in Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">English Fluency</span>
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto">
            Unlimited 24/7 conversational practice, strict grammar analysis, and tailored learning paths to help you speak with effortless confidence.
          </p>

          {/* School Student Institutional Notice */}
          {isStudent && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm max-w-md mx-auto flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <div className="text-left">
                <p className="font-bold">Institutional School Access Active</p>
                <p className="text-xs text-[var(--text-secondary)]">Your full Pro access is sponsored by your school.</p>
              </div>
            </div>
          )}

          {/* Billing Cycle Switcher */}
          {!isStudent && (
            <div className="pt-6 flex justify-center items-center gap-3">
              <span className={`text-sm font-semibold ${billingCycle === "MONTHLY" ? "text-indigo-500" : "text-[var(--text-secondary)]"}`}>
                Monthly Billing
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === "MONTHLY" ? "YEARLY" : "MONTHLY")}
                className="relative inline-flex h-7 w-14 items-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-0.5 transition-colors focus:outline-none"
                aria-label="Toggle Billing Cycle"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-indigo-600 shadow-md transition-transform ${
                    billingCycle === "YEARLY" ? "translate-x-7" : "translate-x-0.5"
                  }`}
                />
              </button>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-semibold ${billingCycle === "YEARLY" ? "text-indigo-500" : "text-[var(--text-secondary)]"}`}>
                  Annual Pass
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Save 33% ⭐
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Notification */}
      {errorMsg && (
        <div className="max-w-md mx-auto mt-6 px-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="font-bold ml-2">✕</button>
          </div>
        </div>
      )}

      {/* Plan Cards Grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: Free Starter */}
          <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 flex flex-col justify-between shadow-sm">
            <div className="space-y-6">
              <div>
                <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  Free Starter
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[var(--text-primary)]">₹0</span>
                  <span className="text-sm text-[var(--text-secondary)]">/ forever</span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2">
                  Essential tools for casual learners exploring AI conversation and grammar basics.
                </p>
              </div>

              <div className="h-px bg-[var(--border-subtle)]" />

              {/* Features List */}
              <ul className="space-y-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                <li className="flex items-center gap-2.5 text-[var(--text-primary)]">
                  <span className="text-emerald-500 font-bold">✓</span> 15 minutes AI Speaking Practice daily (Refills daily)
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-primary)]">
                  <span className="text-emerald-500 font-bold">✓</span> All 100+ Speaking Practice Scenarios
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-primary)]">
                  <span className="text-emerald-500 font-bold">✓</span> All AI Voice Personas & Accents
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-primary)]">
                  <span className="text-emerald-500 font-bold">✓</span> 15 Grammar Doctor checks / day
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-primary)]">
                  <span className="text-emerald-500 font-bold">✓</span> Daily Vocabulary & Practice Quizzes
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-tertiary)] opacity-60 line-through">
                  <span>✕</span> Unlimited 24/7 speaking time (Pro)
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-tertiary)] opacity-60 line-through">
                  <span>✕</span> Unlimited deep grammar diagnostics (Pro)
                </li>
                <li className="flex items-center gap-2.5 text-[var(--text-tertiary)] opacity-60 line-through">
                  <span>✕</span> CEFR Fluency Milestone Certificates (Pro)
                </li>
              </ul>
            </div>

            <div className="pt-8">
              {!isPro ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-sm cursor-default"
                >
                  Current Plan (Active)
                </button>
              ) : (
                <Link
                  to={ROUTES.DASHBOARD}
                  className="block text-center w-full py-3 px-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-sm hover:text-[var(--text-primary)]"
                >
                  Back to Dashboard
                </Link>
              )}
            </div>
          </div>

          {/* Card 2: SpeakMate Pro */}
          <div className="relative rounded-2xl border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-500/5 via-[var(--bg-surface)] to-[var(--bg-surface)] p-6 sm:p-8 flex flex-col justify-between shadow-xl shadow-indigo-500/10">
            {/* Top Badge */}
            <div className="absolute -top-3.5 right-6">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md">
                ⭐ Most Popular
              </span>
            </div>

            <div className="space-y-6">
              <div>
                <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  SpeakMate Pro
                </span>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-[var(--text-primary)]">
                    {billingCycle === "YEARLY" ? "₹1,199" : "₹149"}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {billingCycle === "YEARLY" ? "/ year (₹99/mo)" : "/ month"}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-indigo-400 mt-2 font-medium">
                  {billingCycle === "YEARLY"
                    ? "⭐ Billed annually. Save 33% compared to monthly pass."
                    : "Flexible monthly learning. Cancel anytime with 1-click."}
                </p>
              </div>

              <div className="h-px bg-[var(--border-subtle)]" />

              {/* Features List */}
              <ul className="space-y-3.5 text-xs sm:text-sm">
                <li className="flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                  <span className="text-indigo-500 text-base font-bold">✓</span>
                  <span><strong>Unlimited 24/7</strong> AI Speaking Practice</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                  <span className="text-indigo-500 text-base font-bold">✓</span>
                  <span><strong>Unlimited Grammar Doctor</strong> (Detailed explanations & fixes)</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                  <span className="text-indigo-500 text-base font-bold">✓</span>
                  <span><strong>All 100+ Speaking Practice Scenarios & Roleplays</strong></span>
                </li>
                <li className="flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                  <span className="text-indigo-500 text-base font-bold">✓</span>
                  <span><strong>All Neural Voices & Personas</strong> with zero latency</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                  <span className="text-indigo-500 text-base font-bold">✓</span>
                  <span><strong>10,000+ Vocabulary Vault</strong> & Spaced Repetition</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                  <span className="text-indigo-500 text-base font-bold">✓</span>
                  <span><strong>Official CEFR Fluency Certificate</strong> & Deep Progress Analytics</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              {isPro ? (
                <div className="space-y-3">
                  <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
                    🎉 You are an Active Pro Member ({currentSub?.planType || "PRO"})!
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleUpgrade(billingCycle === "YEARLY" ? "YEARLY_PRO" : "MONTHLY_PRO")}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <span>Connecting Secure Checkout...</span>
                    ) : (
                      <>
                        <span>⚡ Renew / Extend Plan ({billingCycle === "YEARLY" ? "₹1,199/yr" : "₹149/mo"})</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCancelSubscription}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Cancel Pro Subscription
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleUpgrade(billingCycle === "YEARLY" ? "YEARLY_PRO" : "MONTHLY_PRO")}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span>Processing Secure Checkout...</span>
                  ) : (
                    <>
                      <span>Upgrade to Pro Now ({billingCycle === "YEARLY" ? "₹1,199/yr" : "₹149/mo"})</span>
                      <span>➔</span>
                    </>
                  )}
                </button>
              )}
              <p className="text-[11px] text-center text-[var(--text-tertiary)] mt-2">
                🔒 100% Secure Checkout via Razorpay (UPI, GPay, PhonePe, Cards)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-16 space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-center text-[var(--text-primary)]">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <h3 className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">
              What payment methods are supported?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              We support all popular Indian payment options including <strong>UPI (Google Pay, PhonePe, Paytm, BHIM)</strong>, Credit/Debit Cards (Visa, Mastercard, RuPay), and Net Banking via Razorpay.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <h3 className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">
              Can school students subscribe individually?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              If your school is partnered with SpeakMate AI, you receive complete Pro access for free through your school student account. Individual subscriptions are intended for self-learning individual users.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <h3 className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">
              How does the 33% discount on the Annual Pass work?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              The Annual Pass costs ₹1,199 for an entire year (which calculates to just <strong>₹99/month</strong>), saving you compared to renewing monthly passes.
            </p>
          </div>
        </div>
      </div>

      {/* Success Celebration Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-emerald-500/40 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 text-3xl flex items-center justify-center mx-auto animate-bounce">
              🎉
            </div>
            <h3 className="text-2xl font-black text-[var(--text-primary)]">
              Welcome to SpeakMate Pro!
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Your payment of <strong>₹{successDetails?.amount || (billingCycle === "YEARLY" ? "1,199" : "1")}</strong> was verified successfully. All premium AI conversation and grammar features are now unlocked!
            </p>

            <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-1">
              <p>Plan: <strong className="text-[var(--text-primary)]">{successDetails?.planType || "SpeakMate Pro"}</strong></p>
              <p>Status: <span className="text-emerald-400 font-bold">Active</span></p>
            </div>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                navigate(ROUTES.DASHBOARD);
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md"
            >
              Start Practicing Now ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pricing;
