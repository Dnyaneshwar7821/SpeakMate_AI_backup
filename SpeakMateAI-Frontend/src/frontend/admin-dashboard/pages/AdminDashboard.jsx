import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Plus, Download, ArrowRight } from "lucide-react";
import ROUTES from "@constants/routes";

import Button from "@components/common/Button";
import Input from "@components/common/Input";

import KpiCard from "@admin/components/KpiCard";
import SectionCard from "@admin/components/SectionCard";
import UsersTable from "@admin/components/UsersTable";
import UserFormModal from "@admin/components/UserFormModal";
import DeleteUserDialog from "@admin/components/DeleteUserDialog";

import { useUserManagement } from "@admin/hooks/useUserManagement";
import { useAuth } from "@/Admin_panel/context/AuthContext";
import { adminDashboardApi } from "@services/admin/adminDashboardApi";

const baseKpiTemplates = [
    {
        id: "enrolled-schools",
        label: "Enrolled Schools",
        value: 0,
        subtitle: "Institutions onboarded",
        icon: "school",
        accent: "#6366f1",
    },
    {
        id: "school-users",
        label: "School Users",
        value: 0,
        subtitle: "Enrolled students",
        icon: "graduation-cap",
        accent: "#10b981",
    },
    {
        id: "faculty-teachers",
        label: "Faculty Teachers",
        value: 0,
        subtitle: "Classroom educators",
        icon: "book-open",
        accent: "#0284c7",
    },
    {
        id: "platform-users",
        label: "Platform Users",
        value: 0,
        subtitle: "Registered accounts",
        icon: "users",
        accent: "#8b5cf6",
    },
];

/**
 * admin-dashboard/pages/AdminDashboard.jsx
 *
 * Super Admin Panel > Dashboard.
 *
 * Pattern A Layout:
 *   - Balanced 4-column KPI cards (Enrolled Schools, School Users, Faculty Teachers, Platform Users)
 *   - Each card features integrated active vs. inactive micro-filter pills
 *   - User Management section (Add / Update / Delete) kept on the same page.
 */
const SUPER_ADMIN_DASHBOARD_CACHE_KEY = "speakmate_super_admin_dashboard_cache";
let dashboardStatsCache = null;

function getAdminDashboardCache() {
    if (dashboardStatsCache) return dashboardStatsCache;
    try {
        const stored = sessionStorage.getItem(SUPER_ADMIN_DASHBOARD_CACHE_KEY);
        if (stored) {
            dashboardStatsCache = JSON.parse(stored);
            return dashboardStatsCache;
        }
    } catch {}
    return null;
}

function setAdminDashboardCache(data) {
    dashboardStatsCache = data;
    try {
        sessionStorage.setItem(SUPER_ADMIN_DASHBOARD_CACHE_KEY, JSON.stringify(data));
    } catch {}
}

export function AdminDashboard() {
    const navigate = useNavigate();
    const { users, totalUsers, searchTerm, setSearchTerm, addUser, updateUser, deleteUser, exportUsers, isLoading } =
        useUserManagement();
    const { user } = useAuth();

    const [formModal, setFormModal] = useState({ isOpen: false, mode: "add", user: null });
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const openAddModal = () => setFormModal({ isOpen: true, mode: "add", user: null });
    const openEditModal = (u) => setFormModal({ isOpen: true, mode: "edit", user: u });
    const closeFormModal = () => setFormModal((prev) => ({ ...prev, isOpen: false }));

    const cachedStats = getAdminDashboardCache();
    const [stats, setStats] = useState(() => cachedStats);
    const [statsLoading, setStatsLoading] = useState(() => !cachedStats);
    const [statsError, setStatsError] = useState("");
    const [showSlowLoader, setShowSlowLoader] = useState(false);

    useEffect(() => {
        let timer;
        if (statsLoading && !stats) {
            timer = setTimeout(() => setShowSlowLoader(true), 300);
        } else {
            setShowSlowLoader(false);
        }
        return () => clearTimeout(timer);
    }, [statsLoading, stats]);

    const loadStats = async (isBackground = false) => {
        const hasCached = Boolean(getAdminDashboardCache());
        if (!isBackground && !hasCached && !stats) {
            setStatsLoading(true);
        }
        setStatsError("");
        try {
            const res = await adminDashboardApi.getDetailedDashboardStats();
            setAdminDashboardCache(res);
            setStats(res);
        } catch (err) {
            console.error("Failed to load dashboard stats:", err);
            if (!hasCached && !stats) {
                setStatsError("Failed to load statistics");
            }
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        const isCached = Boolean(getAdminDashboardCache());
        loadStats(isCached);
    }, []);

    const handleFormSubmit = async (data) => {
        try {
            if (formModal.mode === "edit" && formModal.user) {
                await updateUser(formModal.user.id, data);
                alert(`User "${data.name}" updated successfully.`);
            } else {
                const res = await addUser(data);
                const emailSent = res?.data?.emailSent !== false && res?.emailSent !== false;
                if (emailSent) {
                    alert("General User created successfully and login credentials have been sent to the user's email address.");
                } else {
                    alert("General User created successfully, but the credential email could not be sent.");
                }
            }
            closeFormModal();
            loadStats(true);
        } catch (err) {
            console.error("Form submission failed:", err);
            alert(err?.response?.data?.message || err.message || "Failed to save user.");
        }
    };

    const handleConfirmDelete = async (u) => {
        if (!u?.id) return;
        const role = (u.raw?.role || u.role || "").toString().toUpperCase();
        if (
            role.includes("SUPER_ADMIN") ||
            role.includes("SUPER ADMIN") ||
            role.includes("SCHOOL_ADMIN") ||
            role.includes("SCHOOL ADMIN") ||
            role.includes("TEACHER") ||
            role.includes("ADMIN")
        ) {
            alert("Administrative accounts cannot be deleted.");
            setDeleteTarget(null);
            return;
        }
        setIsDeleting(true);
        try {
            await deleteUser(u.id);
            loadStats(true);
        } catch (err) {
            console.error("Delete user failed:", err);
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    const recentUsers = users.slice(0, 5);
    const firstName = user?.name === "Super Admin" ? "Super Admin" : (user?.name?.split(" ")[0] || "Super Admin");

    const mappedKpis = useMemo(() => {
        return baseKpiTemplates.map((kpi) => {
            if (statsLoading && !stats) {
                return { ...kpi, value: "..." };
            }
            if (statsError && !stats) {
                return { ...kpi, value: "—" };
            }

            if (kpi.id === "enrolled-schools") {
                const schoolData = stats?.schools || {
                    total: stats?.totalSchools ?? 0,
                    active: stats?.totalSchools ?? 0,
                    inactive: 0,
                };
                return {
                    ...kpi,
                    value: schoolData.total,
                    subtitle: `${schoolData.total} institutions total`,
                    onClick: () => navigate(ROUTES.ADMIN_ADD_SCHOOL),
                    statusBreakdown: {
                        active: schoolData.active,
                        inactive: schoolData.inactive,
                        activeLabel: "Active",
                        inactiveLabel: "Inactive",
                        onActiveClick: () => navigate(`${ROUTES.ADMIN_ADD_SCHOOL}?status=active`),
                        onInactiveClick: () => navigate(`${ROUTES.ADMIN_ADD_SCHOOL}?status=inactive`),
                    },
                };
            }

            if (kpi.id === "school-users") {
                const studentData = stats?.schoolUsers && typeof stats.schoolUsers === "object"
                    ? stats.schoolUsers
                    : {
                        total: stats?.schoolUsers ?? 0,
                        active: stats?.schoolUsers ?? 0,
                        inactive: 0,
                    };
                return {
                    ...kpi,
                    value: studentData.total,
                    subtitle: "Students across schools",
                    onClick: () => navigate(ROUTES.ADMIN_SCHOOL_USERS),
                    statusBreakdown: {
                        active: studentData.active,
                        inactive: studentData.inactive,
                        activeLabel: "Active",
                        inactiveLabel: "Inactive",
                        onActiveClick: () => navigate(`${ROUTES.ADMIN_SCHOOL_USERS}?status=active`),
                        onInactiveClick: () => navigate(`${ROUTES.ADMIN_SCHOOL_USERS}?status=inactive`),
                    },
                };
            }

            if (kpi.id === "faculty-teachers") {
                const teacherData = stats?.teachers || { total: 0, active: 0, inactive: 0 };
                return {
                    ...kpi,
                    value: teacherData.total,
                    subtitle: "Educators assigned",
                    onClick: () => navigate(ROUTES.ADMIN_TEACHERS),
                    statusBreakdown: {
                        active: teacherData.active,
                        inactive: teacherData.inactive,
                        activeLabel: "Active",
                        inactiveLabel: "Inactive",
                        onActiveClick: () => navigate(`${ROUTES.ADMIN_TEACHERS}?status=active`),
                        onInactiveClick: () => navigate(`${ROUTES.ADMIN_TEACHERS}?status=inactive`),
                    },
                };
            }

            if (kpi.id === "platform-users") {
                const userData = stats?.users || {
                    total: stats?.totalUsers ?? 0,
                    active: stats?.activeUsers ?? 0,
                    inactive: stats?.inactiveUsers ?? 0,
                    newThisMonth: stats?.newUsers ?? 0,
                };
                return {
                    ...kpi,
                    value: userData.total,
                    growthBadge: userData.newThisMonth > 0 ? `+${userData.newThisMonth} new` : null,
                    subtitle: "Total registered accounts",
                    onClick: () => navigate(ROUTES.ADMIN_USERS),
                    statusBreakdown: {
                        active: userData.active,
                        inactive: userData.inactive,
                        activeLabel: "Active",
                        inactiveLabel: "Inactive",
                        onActiveClick: () => navigate(`${ROUTES.ADMIN_USERS}?status=active`),
                        onInactiveClick: () => navigate(`${ROUTES.ADMIN_USERS}?status=inactive`),
                    },
                };
            }

            return kpi;
        });
    }, [stats, statsLoading, statsError, navigate]);

    return (
        <div className="space-y-5 sm:space-y-6">
            {/* ============ Global Loader (only on cold load if taking > 300ms) ============ */}
            {statsLoading && !stats && showSlowLoader && (
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[var(--bg-base)] transition-all duration-300">
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                        {/* Animated Logo */}
                        <div className="relative flex h-24 w-24 items-center justify-center">
                            {/* Outer spinning ring */}
                            <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-primary)]/20 border-t-[var(--color-primary)] animate-spin"></div>
                            {/* Inner counter-spinning ring */}
                            <div className="absolute inset-2 rounded-full border-[3px] border-purple-500/20 border-b-purple-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                            {/* Center Icon */}
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-500 text-white shadow-lg shadow-[var(--color-primary)]/30">
                                <Sparkles className="h-6 w-6" />
                            </div>
                        </div>
                        
                        {/* Text */}
                        <h2 className="mt-6 text-xl font-extrabold tracking-tight text-[var(--color-primary)]">
                            SpeakMate AI
                        </h2>
                        <div className="mt-2 flex items-center gap-1 text-sm font-semibold tracking-wide text-[var(--text-secondary)]">
                            Loading
                            <span className="flex w-4">
                                <span className="animate-[ping_1.4s_infinite] text-xl leading-none">.</span>
                                <span className="animate-[ping_1.4s_0.2s_infinite] text-xl leading-none">.</span>
                                <span className="animate-[ping_1.4s_0.4s_infinite] text-xl leading-none">.</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Welcome / Hero ============ */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)] sm:p-8"
            >
                <div className="admin-grid-bg pointer-events-none absolute inset-0 opacity-60" />
                <div
                    className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl"
                    style={{ background: "linear-gradient(135deg,#6c63ff,#ff6584)" }}
                />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                            <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                            Super Admin Console
                        </span>
                        <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                            Welcome back, {firstName} 👋
                        </h1>
                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                            Here's what's happening across SpeakMate AI today. Monitor users,
                            engagement and learning progress from one place.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2.5">
                        <Button variant="secondary" onClick={exportUsers} className="!h-10 !px-4">
                            <Download className="mr-1.5 h-4 w-4" />
                            Export
                        </Button>
                        <Button onClick={openAddModal} className="!h-10 !px-4">
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add User
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* ============ KPI Cards (Pattern A: Balanced 4-column Grid) ============ */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statsLoading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
                            <div className="flex items-center justify-between">
                                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                                <div className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="mt-3 h-7 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                            <div className="mt-2 h-3 w-28 rounded bg-slate-100 dark:bg-slate-800" />
                            <div className="mt-3 flex gap-2 border-t border-[var(--border-subtle)] pt-2.5">
                                <div className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
                                <div className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
                            </div>
                        </div>
                    ))
                ) : (
                    mappedKpis.map((kpi, i) => (
                        <KpiCard key={kpi.id} kpi={kpi} index={i} />
                    ))
                )}
            </div>

            {/* ============ User Management (kept on the same page) ============ */}
            <SectionCard
                title="User Management"
                subtitle={isLoading ? "Loading users..." : `${totalUsers} total users on the platform`}
                className="xl:col-span-2"
                delay={0.05}
                bodyClassName="p-0"
                action={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <Input
                            placeholder="Search users…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button onClick={openAddModal} className="!h-11 shrink-0">
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add User
                        </Button>
                    </div>
                }
            >
                <UsersTable users={recentUsers} isLoading={isLoading} onEdit={openEditModal} onDelete={setDeleteTarget} />
                <div className="border-t border-[var(--border-subtle)] px-4 py-3 sm:px-5">
                    <button
                        onClick={() => navigate(ROUTES.ADMIN_USERS)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:gap-2.5"
                    >
                        View all users
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </SectionCard>

            {/* ============ Modals (unchanged logic) ============ */}
            <UserFormModal
                isOpen={formModal.isOpen}
                mode={formModal.mode}
                initialData={formModal.user}
                onClose={closeFormModal}
                onSubmit={handleFormSubmit}
            />

            <DeleteUserDialog
                isOpen={Boolean(deleteTarget)}
                user={deleteTarget}
                isDeleting={isDeleting}
                onClose={() => !isDeleting && setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}

export default AdminDashboard;
