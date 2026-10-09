import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Navigate, Route, Routes, Outlet } from "react-router-dom";

import AppLayout from "../components/layouts/Layout";
import AuthLayout from "../components/layout/AuthLayout";

import ROUTES from "../constants/routes";

// Lazy-loaded administrative and teacher portal modules (Bundle isolation)
const AdminLogin = lazy(() => import("@/Admin_panel/pages/AdminLogin"));
const AdminForgotPassword = lazy(() => import("@/Admin_panel/pages/AdminForgotPassword"));
const AdminOtpVerification = lazy(() => import("@/Admin_panel/pages/AdminOtpVerification"));
const AdminResetPassword = lazy(() => import("@/Admin_panel/pages/AdminResetPassword"));
const SchoolAdminLogin = lazy(() => import("@/Admin_panel/pages/SchoolAdminLogin"));
const SchoolAdminForgotPassword = lazy(() => import("@/Admin_panel/pages/SchoolAdminForgotPassword"));
const SchoolAdminSetPassword = lazy(() => import("@/Admin_panel/pages/SchoolAdminSetPassword"));
const SchoolAdminOtpVerification = lazy(() => import("@/Admin_panel/pages/SchoolAdminOtpVerification"));
const SchoolAdminResetPassword = lazy(() => import("@/Admin_panel/pages/SchoolAdminResetPassword"));
const TeacherLogin = lazy(() => import("@/Admin_panel/pages/TeacherLogin"));
const TeacherForgotPassword = lazy(() => import("@/Admin_panel/pages/TeacherForgotPassword"));
const TeacherOtpVerification = lazy(() => import("@/Admin_panel/pages/TeacherOtpVerification"));
const TeacherResetPassword = lazy(() => import("@/Admin_panel/pages/TeacherResetPassword"));
const VerifyEmail = lazy(() => import("@/Admin_panel/pages/VerifyEmail"));

const TeacherDashboardHome = lazy(() => import("@/Admin_panel/pages/TeacherDashboardHome"));
const TeacherStudents = lazy(() => import("@/Admin_panel/pages/TeacherStudents"));
const TeacherStudentDetails = lazy(() => import("@/Admin_panel/pages/TeacherStudentDetails"));
const TeacherAnalytics = lazy(() => import("@/Admin_panel/pages/TeacherAnalytics"));
const TeacherReports = lazy(() => import("@/Admin_panel/pages/TeacherReports"));
const TeacherProfile = lazy(() => import("@/Admin_panel/pages/TeacherProfile"));
const TeacherSettings = lazy(() => import("@/Admin_panel/pages/TeacherSettings"));

const AdminDashboard = lazy(() => import("@admin/pages/AdminDashboard"));
const AdminInsights = lazy(() => import("@admin/pages/AdminInsights"));
const AllUsers = lazy(() => import("@admin/pages/AllUsers"));
const SchoolUsers = lazy(() => import("@admin/pages/SchoolUsers"));
const AddSchool = lazy(() => import("@admin/pages/AddSchool"));
const Teachers = lazy(() => import("@admin/pages/Teachers"));
const SubscriptionBilling = lazy(() => import("@admin/pages/SubscriptionBilling"));
const AdminProfile = lazy(() => import("@admin/pages/Profile"));
const AdminSettings = lazy(() => import("@admin/pages/Settings"));
const NotificationsPage = lazy(() => import("@admin/pages/NotificationsPage"));

const SchoolDashboard = lazy(() => import("@school-admin/pages/Dashboard"));
const SchoolStudents = lazy(() => import("@school-admin/pages/Students"));
const SchoolTeachers = lazy(() => import("@school-admin/pages/Teachers"));
const SchoolResults = lazy(() => import("@school-admin/pages/Results"));
const SchoolInsights = lazy(() => import("@school-admin/pages/Insights"));
const AddTeacher = lazy(() => import("@school-admin/pages/AddTeacher"));
const SchoolAdminProfile = lazy(() => import("@school-admin/pages/Profile"));
const SchoolAdminSettings = lazy(() => import("@school-admin/pages/Settings"));

const AdminLayout = lazy(() => import("@admin/layout/AdminLayout"));
const SchoolLayout = lazy(() => import("@school-admin/layout/SchoolLayout"));
const TeacherDashboardLayout = lazy(() => import("@/Admin_panel/components/teacher/layout/TeacherDashboardLayout"));

import AdminProtectedRoute from "@/Admin_panel/routes/AdminProtectedRoute";
import { ADMIN_ROLES } from "@/Admin_panel/constants/adminRoles";
import { AuthProvider as AdminAuthProvider } from "@/Admin_panel/context/AuthContext";
import { ThemeProvider as AdminThemeProvider } from "@/Admin_panel/context/ThemeContext";

function AdminPortalLayout() {
  return (
    <AdminThemeProvider>
      <AdminAuthProvider>
        <Outlet />
      </AdminAuthProvider>
    </AdminThemeProvider>
  );
}

// Core immediate routes (fast initial paint)
import LandingPage from "../pages/LandingPage";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import Dashboard from "../pages/Dashboard";
import SpeakingPractice from "../pages/SpeakingPractice";
import SpeakingHistoryDetail from "../pages/SpeakingHistoryDetail";
import NotFound from "../pages/NotFound";

// Lazy-loaded heavy learner pages (bundle splitting & instant initial load)
const Onboarding = lazy(() => import("../pages/Onboarding"));
const AiChat = lazy(() => import("../pages/AiChat"));
const ConversationChat = lazy(() => import("../pages/ConversationChat"));
const ConversationSession = lazy(() => import("../pages/ConversationSession"));
const SpeakingSummary = lazy(() => import("../pages/SpeakingSummary"));
const Lessons = lazy(() => import("../pages/Lessons"));
const LessonDetail = lazy(() => import("../pages/LessonDetail"));
const GrammarPractice = lazy(() => import("../pages/GrammarPractice"));
const Vocabulary = lazy(() => import("../pages/Vocabulary"));
const Progress = lazy(() => import("../pages/Progress"));
const Achievements = lazy(() => import("../pages/Achievements"));
const Notifications = lazy(() => import("../pages/Notifications"));
const Profile = lazy(() => import("../pages/Profile"));
const Settings = lazy(() => import("../pages/Settings"));
const Pricing = lazy(() => import("../pages/Pricing"));
const Help = lazy(() => import("../pages/Help"));
const About = lazy(() => import("../pages/About"));
const AvatarEmbed = lazy(() => import("../pages/AvatarEmbed"));

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

function RouteFallback() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-pulse">
      {/* Top Header / Breadcrumb Placeholder */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-1.5">
            <div className="w-32 h-4 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="w-20 h-2.5 rounded-md bg-slate-100 dark:bg-slate-700" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-slate-800/40 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-16 h-3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20" />
            </div>
            <div className="w-24 h-6 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="w-32 h-2 rounded bg-slate-100 dark:bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton with Center Brand Spinner */}
      <div className="min-h-[380px] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="w-9 h-9 border-3 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Loading module...</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Preparing your interactive learning view</span>
        </div>
      </div>
    </div>
  );
}

function PageTransition({ children }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Standalone Live2D Avatar Embed for Mobile App WebView */}
        <Route
          path="/avatar-embed"
          element={
            <Suspense
              fallback={
                <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-3 bg-transparent">
                  <div className="w-8 h-8 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-slate-400">Loading Avatar...</span>
                </div>
              }
            >
              <AvatarEmbed />
            </Suspense>
          }
        />

        {/* Public Marketing Landing */}
        <Route element={<AppLayout />}>
          <Route
            path={ROUTES.HOME}
            element={
              <PublicRoute>
                <PageTransition>
                  <LandingPage />
                </PageTransition>
              </PublicRoute>
            }
          />
        </Route>

        {/* Authentication Pages */}
        <Route element={<AuthLayout />}>
          <Route
            path={ROUTES.LOGIN}
            element={
              <PublicRoute>
                <PageTransition>
                  <Login />
                </PageTransition>
              </PublicRoute>
            }
          />

          <Route
            path={ROUTES.REGISTER}
            element={
              <PublicRoute>
                <PageTransition>
                  <Register />
                </PageTransition>
              </PublicRoute>
            }
          />

          <Route
            path={ROUTES.FORGOT_PASSWORD}
            element={
              <PublicRoute>
                <PageTransition>
                  <ForgotPassword />
                </PageTransition>
              </PublicRoute>
            }
          />

          <Route
            path={ROUTES.RESET_PASSWORD}
            element={
              <PublicRoute>
                <PageTransition>
                  <ResetPassword />
                </PageTransition>
              </PublicRoute>
            }
          />
        </Route>

        {/* Onboarding Flow */}
        <Route
          path={ROUTES.ONBOARDING}
          element={
            <ProtectedRoute>
              <PageTransition>
                <Onboarding />
              </PageTransition>
            </ProtectedRoute>
          }
        />

        {/* Main Authenticated Application Pages */}
        <Route element={<AppLayout />}>
          <Route
            path={ROUTES.DASHBOARD}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.AI_CHAT}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <AiChat />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.CONVERSATION_CHAT}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <ConversationChat />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.SPEAKING}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <SpeakingPractice />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.CONVERSATION_SESSION}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <ConversationSession />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.SPEAKING_SUMMARY}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <SpeakingSummary />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.SPEAKING_HISTORY_DETAIL}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <SpeakingHistoryDetail />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.LESSONS}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Lessons />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.LESSON_DETAIL}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <LessonDetail />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.GRAMMAR}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <GrammarPractice />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.VOCABULARY}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Vocabulary />
                </PageTransition>
              </ProtectedRoute>
            }
          />


          <Route
            path={ROUTES.PROGRESS}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Progress />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.ACHIEVEMENTS}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Achievements />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.NOTIFICATIONS}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Notifications />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.PROFILE}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Profile />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.SETTINGS}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Settings />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.PRICING}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Pricing />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.HELP}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Help />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.ABOUT}
            element={
              <ProtectedRoute>
                <PageTransition>
                  <About />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.ASSIGNMENTS || "/assignments"}
            element={
              <ProtectedRoute>
                <Navigate to={ROUTES.DASHBOARD} replace />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* ================= PORTAL SCOPE (ISOLATED AUTH & THEME) ================= */}
        <Route element={<AdminPortalLayout />}>
          {/* Role-based administration authentication */}
          {[
            [ROUTES.ADMIN_LOGIN, AdminLogin],
            [ROUTES.ADMIN_FORGOT_PASSWORD, AdminForgotPassword],
            [ROUTES.ADMIN_VERIFY_OTP, AdminOtpVerification],
            [ROUTES.ADMIN_OTP_VERIFICATION, AdminOtpVerification],
            [ROUTES.ADMIN_RESET_PASSWORD, AdminResetPassword],
            [ROUTES.SCHOOL_ADMIN_LOGIN, SchoolAdminLogin],
            [ROUTES.SCHOOL_ADMIN_FORGOT_PASSWORD, SchoolAdminForgotPassword],
            [ROUTES.SCHOOL_ADMIN_SET_PASSWORD, SchoolAdminSetPassword],
            [ROUTES.SCHOOL_ADMIN_VERIFY_OTP, SchoolAdminOtpVerification],
            [ROUTES.SCHOOL_ADMIN_OTP_VERIFICATION, SchoolAdminOtpVerification],
            [ROUTES.SCHOOL_ADMIN_RESET_PASSWORD, SchoolAdminResetPassword],
            [ROUTES.TEACHER_LOGIN, TeacherLogin],
            [ROUTES.TEACHER_FORGOT_PASSWORD, TeacherForgotPassword],
            [ROUTES.TEACHER_VERIFY_OTP, TeacherOtpVerification],
            [ROUTES.TEACHER_OTP_VERIFICATION, TeacherOtpVerification],
            [ROUTES.TEACHER_RESET_PASSWORD, TeacherResetPassword],
            [ROUTES.VERIFY_EMAIL, VerifyEmail],
          ].map(([path, AuthPage]) => (
            <Route key={path} path={path} element={<PageTransition><AuthPage /></PageTransition>} />
          ))}

          {/* Super Admin Protected Pages */}
          <Route element={
            <AdminProtectedRoute allowedRoles={ADMIN_ROLES.SUPER_ADMIN}>
              <Suspense fallback={<RouteFallback />}>
                <AdminLayout />
              </Suspense>
            </AdminProtectedRoute>
          }>
            <Route path={ROUTES.ADMIN_DASHBOARD} element={<PageTransition><AdminDashboard /></PageTransition>} />
            <Route path={ROUTES.ADMIN_INSIGHTS} element={<PageTransition><AdminInsights /></PageTransition>} />
            <Route path={ROUTES.ADMIN_USERS} element={<PageTransition><AllUsers /></PageTransition>} />
            <Route path={ROUTES.ADMIN_SCHOOL_USERS} element={<PageTransition><SchoolUsers /></PageTransition>} />
            <Route path={ROUTES.ADMIN_ADD_SCHOOL} element={<PageTransition><AddSchool /></PageTransition>} />
            <Route path={ROUTES.ADMIN_TEACHERS} element={<PageTransition><Teachers /></PageTransition>} />
            <Route path={ROUTES.ADMIN_SUBSCRIPTION} element={<PageTransition><SubscriptionBilling /></PageTransition>} />
            <Route path={ROUTES.ADMIN_SUBSCRIPTION_BILLING} element={<PageTransition><SubscriptionBilling /></PageTransition>} />
            <Route path={ROUTES.ADMIN_PROFILE} element={<PageTransition><AdminProfile /></PageTransition>} />
            <Route path={ROUTES.ADMIN_SETTINGS} element={<PageTransition><AdminSettings /></PageTransition>} />
            <Route path={ROUTES.ADMIN_NOTIFICATIONS} element={<PageTransition><NotificationsPage /></PageTransition>} />
          </Route>

          {/* School Admin Protected Pages */}
          <Route element={
            <AdminProtectedRoute allowedRoles={ADMIN_ROLES.SCHOOL_ADMIN}>
              <Suspense fallback={<RouteFallback />}>
                <SchoolLayout />
              </Suspense>
            </AdminProtectedRoute>
          }>
            <Route path={ROUTES.SCHOOL_ADMIN_DASHBOARD} element={<PageTransition><SchoolDashboard /></PageTransition>} />
            <Route path={ROUTES.SCHOOL_ADMIN_STUDENTS} element={<PageTransition><SchoolStudents /></PageTransition>} />
            <Route path={ROUTES.SCHOOL_ADMIN_TEACHERS} element={<PageTransition><SchoolTeachers /></PageTransition>} />
            <Route path={ROUTES.SCHOOL_ADMIN_RESULTS} element={<Navigate to={ROUTES.SCHOOL_ADMIN_DASHBOARD} replace />} />
            <Route path={ROUTES.SCHOOL_ADMIN_INSIGHTS} element={<PageTransition><SchoolInsights /></PageTransition>} />
            <Route path={ROUTES.SCHOOL_ADMIN_ADD_TEACHER} element={<PageTransition><AddTeacher /></PageTransition>} />
            <Route path={ROUTES.SCHOOL_ADMIN_PROFILE} element={<PageTransition><SchoolAdminProfile /></PageTransition>} />
            <Route path={ROUTES.SCHOOL_ADMIN_SETTINGS} element={<PageTransition><SchoolAdminSettings /></PageTransition>} />
            <Route path={ROUTES.SCHOOL_ADMIN_NOTIFICATIONS} element={<PageTransition><NotificationsPage /></PageTransition>} />
          </Route>

          {/* Teacher Protected Pages */}
          <Route element={
            <AdminProtectedRoute allowedRoles={ADMIN_ROLES.TEACHER}>
              <Suspense fallback={<RouteFallback />}>
                <TeacherDashboardLayout>
                  <Outlet />
                </TeacherDashboardLayout>
              </Suspense>
            </AdminProtectedRoute>
          }>
            <Route path={ROUTES.TEACHER_DASHBOARD} element={<PageTransition><TeacherDashboardHome /></PageTransition>} />
            <Route path={ROUTES.TEACHER_ANALYTICS} element={<PageTransition><TeacherAnalytics /></PageTransition>} />
            <Route path={ROUTES.TEACHER_STUDENTS} element={<PageTransition><TeacherStudents /></PageTransition>} />
            <Route path={ROUTES.TEACHER_STUDENT_DETAILS} element={<PageTransition><TeacherStudentDetails /></PageTransition>} />
            <Route path={ROUTES.TEACHER_REPORTS} element={<PageTransition><TeacherReports /></PageTransition>} />
            <Route path={ROUTES.TEACHER_PROFILE} element={<PageTransition><TeacherProfile /></PageTransition>} />
            <Route path={ROUTES.TEACHER_SETTINGS} element={<PageTransition><TeacherSettings /></PageTransition>} />
            <Route path={ROUTES.TEACHER_NOTIFICATIONS} element={<PageTransition><NotificationsPage /></PageTransition>} />
          </Route>
        </Route>

        {/* 404 Fallback */}
        <Route
          path={ROUTES.NOT_FOUND}
          element={
            <PageTransition>
              <NotFound />
            </PageTransition>
          }
        />

        <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
      </Routes>
  );
}

export default AppRoutes;
