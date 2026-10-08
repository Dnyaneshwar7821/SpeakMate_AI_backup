import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ROUTES from "../../constants/routes";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import Footer from "./Footer";
import useSpeechCleanup from "../../hooks/useSpeechCleanup";
import { LearnerAssistant } from "@components/assistant";
import { SpeakMateLoader } from "../common/SpeakMateLoader";

const NO_SIDEBAR_PATHS = [
  ROUTES.HOME,
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  ROUTES.ONBOARDING,
  ROUTES.NOT_FOUND,
];

export function Layout({ children }) {
  useSpeechCleanup();
  const { isAuthenticated, isPostLoginLoading } = useAuth();
  const location = useLocation();

  if (isPostLoginLoading) {
    return (
      <SpeakMateLoader
        fullScreen
        message="Loading dashboard..."
        subMessage="Synchronizing your learning stats & streak"
      />
    );
  }

  const showSidebar = isAuthenticated && !NO_SIDEBAR_PATHS.includes(location.pathname);
  const showFooter = NO_SIDEBAR_PATHS.includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] relative selection:bg-[#6C63FF]/30 selection:text-[var(--text-primary)]">
      {/* Ambient Top Glow Orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#6C63FF]/5 blur-3xl pointer-events-none rounded-full" />
      <div className="fixed top-1/3 right-10 w-96 h-96 bg-[#FF6584]/5 blur-3xl pointer-events-none rounded-full" />

      <Navbar />

      <div className="flex-1 flex flex-row min-w-0 relative z-10">
        {showSidebar && <Sidebar />}

        <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          <div className="flex-1 p-3 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-8">
            {children || <Outlet />}
          </div>

          {showFooter && <Footer />}
        </main>
      </div>

      {/* Mobile Sticky Bottom Nav */}
      {showSidebar && <BottomNav />}

      {/* Dedicated Learner AI Assistant (Student / General User) */}
      {showSidebar && <LearnerAssistant />}
    </div>
  );
}

export default Layout;
