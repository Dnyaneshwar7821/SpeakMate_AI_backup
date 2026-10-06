import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, X, GraduationCap } from "lucide-react";
import { useAuth } from "@/Admin_panel/context/AuthContext";
import { useTheme } from "@/Admin_panel/context/ThemeContext";
import ROUTES from "@constants/routes";
import {
    TEACHER_SIDEBAR_MENU,
    TEACHER_SIDEBAR_FOOTER_MENU,
    LOGOUT_ITEM,
} from "@/Admin_panel/constants/teacherSidebarConfig";
import LogoutDialog from "@/Admin_panel/components/teacher/common/LogoutDialog";
import { useNotifications } from "@hooks/useNotifications";

function SidebarLink({ item }) {
    const { sidebarDensity } = useTheme();
    const paddingY = sidebarDensity === "compact" ? "py-1.5" : "py-2.5";
    return (
        <NavLink
            to={item.path}
            className={({ isActive }) =>
                [
                    "group relative flex items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200",
                    paddingY,
                    isActive
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                ].join(" ")
            }
        >
            {({ isActive }) => (
                <>
                    <span
                        className={[
                            "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-primary)] transition-all duration-200",
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30",
                        ].join(" ")}
                    />
                    <item.icon
                        className={[
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            isActive
                                ? "text-[var(--color-primary)]"
                                : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]",
                        ].join(" ")}
                        strokeWidth={isActive ? 2.4 : 2}
                    />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge && (
                        <span className="ml-auto rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                            {item.badge}
                        </span>
                    )}
                </>
            )}
        </NavLink>
    );
}

export function TeacherSidebar({
    className = "",
    onNavigate,
    labelId = "teacher-sidebar-title",
}) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { unreadCount, formattedUnreadCount } = useNotifications();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);

    const handleLogoutClick = () => {
        setMobileOpen(false);
        setLogoutOpen(true);
    };

    const handleConfirmLogout = () => {
        setLogoutOpen(false);
        logout();
        navigate(ROUTES.TEACHER_LOGIN, { replace: true });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="fixed top-3 left-3 z-30 grid h-10 w-10 place-items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-colors hover:text-[var(--text-primary)] lg:hidden"
                aria-label="Open sidebar"
            >
                <Menu className="h-5 w-5" />
            </button>

            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                className={[
                    "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] transition-transform duration-300 ease-in-out",
                    mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    className,
                ].join(" ")}
            >
                <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] px-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#6c63ff] to-[#ff6584] text-white shadow-[var(--shadow-md)]">
                            <GraduationCap className="h-5 w-5" strokeWidth={2.4} />
                        </span>
                        <div className="min-w-0 leading-tight">
                            <p className="truncate brand-gradient-text text-[15px] font-bold tracking-tight">
                                SpeakMate AI
                            </p>
                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                Teacher Workspace
                            </p>
                            {user?.schoolName && (
                                <p className="truncate text-[11px] font-medium text-[var(--color-primary)]" title={user.schoolName}>
                                    {user.schoolName}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] lg:hidden"
                        aria-label="Close sidebar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="no-scrollbar flex-1 overflow-y-auto">
                    <nav className="flex flex-col gap-0.5 px-3 py-3">
                        {TEACHER_SIDEBAR_MENU.map((item) => {
                            const itemWithBadge = item.id === "notifications" && unreadCount > 0 ? { ...item, badge: formattedUnreadCount } : item;
                            return <SidebarLink key={item.id} item={itemWithBadge} />;
                        })}

                        {TEACHER_SIDEBAR_FOOTER_MENU.map((item) => (
                            <SidebarLink key={item.id} item={item} />
                        ))}

                        <button
                            type="button"
                            onClick={handleLogoutClick}
                            className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-500 transition-all duration-200 hover:bg-rose-500/10"
                        >
                            <LOGOUT_ITEM.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                            <span className="truncate">{LOGOUT_ITEM.label}</span>
                        </button>
                    </nav>
                </div>
            </aside>

            <LogoutDialog
                isOpen={logoutOpen}
                onClose={() => setLogoutOpen(false)}
                onConfirm={handleConfirmLogout}
            />
        </>
    );
}

export default TeacherSidebar;
