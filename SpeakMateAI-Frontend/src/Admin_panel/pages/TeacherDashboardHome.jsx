import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Card from "@components/common/Card";
import { containerVariants, itemVariants } from "@animations/variants";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/Admin_panel/context/AuthContext";
import { teacherDataApi } from "@services/admin/teacherDataApi";
import { Building2 } from "lucide-react";
import { updateAdminSessionUser } from "@/Admin_panel/services/adminSession";

const toneStyles = {
    indigo: {
        soft: "bg-indigo-50 text-indigo-600",
        dot: "bg-indigo-500",
        bar: "bg-indigo-500",
    },
    emerald: {
        soft: "bg-emerald-50 text-emerald-600",
        dot: "bg-emerald-500",
        bar: "bg-emerald-500",
    },
    rose: {
        soft: "bg-rose-50 text-rose-600",
        dot: "bg-rose-500",
        bar: "bg-rose-500",
    },
    amber: {
        soft: "bg-amber-50 text-amber-600",
        dot: "bg-amber-500",
        bar: "bg-amber-500",
    },
    violet: {
        soft: "bg-violet-50 text-violet-600",
        dot: "bg-violet-500",
        bar: "bg-violet-500",
    },
};

const overviewIcons = {
    students: (
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-3-11.96a4 4 0 0 1 0 7.75" />
    ),
    progress: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
    attention: (
        <path d="M10.3 2.86 1.82 17a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 2.86a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01" />
    ),
    completion: <path d="m4 12 5 5L20 6" />,
};

const actionIcons = {
    students: overviewIcons.students,
    reports: (
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8m-6-6 6 6m-6-6v6h6M8 13h8m-8 4h8" />
    ),
    analytics: overviewIcons.progress,
};

function LineIcon({ children, className = "h-5 w-5" }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {children}
        </svg>
    );
}

function SectionHeading({ id, eyebrow, title, description }) {
    return (
        <div>
            {eyebrow && (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                    {eyebrow}
                </p>
            )}
            <h2 id={id} className={`${eyebrow ? "mt-2" : ""} text-xl font-black text-[var(--text-primary)]`}>
                {title}
            </h2>
            {description && (
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
            )}
        </div>
    );
}

function OverviewCards({ metrics = [] }) {
    if (!metrics || metrics.length === 0) return null;
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
            {metrics.map((metric) => {
                const styles = toneStyles[metric.tone] || toneStyles.indigo;

                return (
                    <motion.div key={metric.id} variants={itemVariants}>
                        <Card className="h-full p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] motion-reduce:transform-none">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-[var(--text-secondary)]">{metric.label}</p>
                                    <p className="mt-3 text-3xl font-black tracking-tight text-[var(--text-primary)]">
                                        {metric.value}
                                    </p>
                                </div>
                                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${styles.soft}`}>
                                    <LineIcon>{overviewIcons[metric.id]}</LineIcon>
                                </span>
                            </div>
                            <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-muted)]">
                                {metric.helper}
                            </p>
                        </Card>
                    </motion.div>
                );
            })}
        </motion.div>
    );
}

function PerformanceOverview({ skills = [] }) {
    return (
        <section className="mt-6" aria-labelledby="performance-heading">
            <SectionHeading
                id="performance-heading"
                eyebrow="Class skills"
                title="Performance overview"
                description="A simple view of the learning areas shaping your class progress."
            />
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
                {skills.map((skill) => {
                    const styles = toneStyles[skill.tone] || toneStyles.indigo;

                    return (
                        <motion.div key={skill.id} variants={itemVariants}>
                            <Card className="h-full overflow-hidden p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                                    <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                        Active
                                    </span>
                                </div>
                                <h3 className="mt-5 text-base font-bold text-[var(--text-primary)]">
                                    {skill.label}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{skill.summary}</p>
                                <div className="mt-5 flex h-16 items-end gap-1.5" aria-hidden="true">
                                    {[36, 52, 43, 65, 58, 76, 68].map((height, index) => (
                                        <span
                                            key={`${skill.id}-${height}-${index}`}
                                            className={`flex-1 rounded-t-sm ${styles.bar} opacity-20`}
                                            style={{ height: `${height}%` }}
                                        />
                                    ))}
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </motion.div>
        </section>
    );
}

function AttentionList({ onOpenStudent, students = [] }) {
    return (
        <Card className="h-full p-5 sm:p-6">
            <SectionHeading
                title="Students requiring attention"
                description="A focused view of learners who may benefit from support."
            />
            {!students || students.length === 0 ? (
                <p className="mt-5 rounded-xl bg-[var(--bg-subtle)] px-4 py-6 text-center text-sm font-medium text-[var(--text-muted)]">
                    No students currently require attention.
                </p>
            ) : (
                <div className="mt-5 divide-y divide-[var(--border-subtle)]">
                    {students.map((student) => (
                        <button
                            key={student.id}
                            type="button"
                            onClick={() => onOpenStudent(student.id)}
                            aria-label={`View ${student.name}'s student profile`}
                            className="group block w-full cursor-pointer rounded-xl py-4 text-left transition duration-200 first:pt-0 last:pb-0 hover:bg-[var(--color-primary)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 active:scale-[0.99] motion-reduce:transform-none"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500/10 text-xs font-black text-rose-600">
                                            {(student.name || "Student")
                                                .split(" ")
                                                .map((part) => part[0])
                                                .join("")}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{student.name}</p>
                                            <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-secondary)]">
                                                {student.reason}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600">
                                    {student.progress}%
                                </span>
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                                <div
                                    className="h-full rounded-full bg-rose-400"
                                    style={{ width: `${student.progress}%` }}
                                />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </Card>
    );
}

function RecentActivity({ activities = [] }) {
    return (
        <Card className="h-full p-5 sm:p-6">
            <SectionHeading
                title="Recent activity"
                description="Latest learning moments from your assigned class."
            />
            {!activities || activities.length === 0 ? (
                <p className="mt-5 rounded-xl bg-[var(--bg-subtle)] px-4 py-6 text-center text-sm font-medium text-[var(--text-muted)]">
                    No recent activity is available.
                </p>
            ) : (
                <ol className="mt-5 space-y-4">
                    {activities.map((activity, idx) => {
                        const styles = toneStyles[activity.tone] || toneStyles.indigo;

                        return (
                            <li key={`${activity.student}-${activity.action}-${idx}`} className="flex gap-3">
                                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />
                                <div className="min-w-0 flex-1 border-b border-[var(--border-subtle)] pb-4 last:border-0 last:pb-0">
                                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                                        <span className="font-bold text-[var(--text-primary)]">{activity.student}</span>{" "}
                                        {activity.action}
                                    </p>
                                    <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">{activity.time}</p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Card>
    );
}

const quickActionsList = [
    { title: "View Students", description: "Review class rosters, roll numbers, and progress.", icon: "students" },
    { title: "View Analytics", description: "Inspect skill scores and performance over time.", icon: "analytics" },
    { title: "Generate Reports", description: "Create summary reports for parent meetings.", icon: "reports" },
];

function QuickActions({ onOpenAction }) {
    return (
        <section className="mt-6" aria-labelledby="quick-actions-heading">
            <SectionHeading
                id="quick-actions-heading"
                eyebrow="Next steps"
                title="Quick actions"
                description="Common teacher tasks, ready for future workspace pages."
            />
            <div className="mt-4 grid gap-4 md:grid-cols-3">
                {quickActionsList.map((action) => (
                    <Card
                        key={action.title}
                        className="group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30 hover:shadow-[var(--shadow-md)] focus-within:-translate-y-0.5 focus-within:border-[var(--color-primary)]/30 focus-within:shadow-[var(--shadow-md)] motion-reduce:transform-none"
                    >
                        <button
                            type="button"
                            onClick={() => onOpenAction(action.icon)}
                            aria-label={`${action.title}: ${action.description}`}
                            className="h-full w-full cursor-pointer p-5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] active:scale-[0.99] motion-reduce:transform-none"
                        >
                            <div className="flex items-start gap-4">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-colors duration-200 group-hover:bg-[var(--color-primary)] group-hover:text-white">
                                    <LineIcon>{actionIcons[action.icon]}</LineIcon>
                                </span>
                                <div>
                                    <h3 className="text-base font-bold text-[var(--text-primary)]">{action.title}</h3>
                                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                                        {action.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    </Card>
                ))}
            </div>
        </section>
    );
}

const defaultMetrics = [
    { id: "students", label: "Total Students", value: "0", helper: "Assigned to your class", tone: "indigo" },
    { id: "progress", label: "Average Class Progress", value: "0%", helper: "Across all learning skills", tone: "emerald" },
    { id: "attention", label: "Students Requiring Attention", value: "0", helper: "Based on recent practice", tone: "rose" },
    { id: "completion", label: "Weekly Practice Completion", value: "0%", helper: "0 students completed goals", tone: "amber" },
];

const TEACHER_DASHBOARD_CACHE_KEY = "speakmate_teacher_dashboard_cache";
let inMemoryTeacherDashboardCache = null;

function getTeacherCachedData() {
    if (inMemoryTeacherDashboardCache) return inMemoryTeacherDashboardCache;
    try {
        const stored = sessionStorage.getItem(TEACHER_DASHBOARD_CACHE_KEY);
        if (stored) {
            inMemoryTeacherDashboardCache = JSON.parse(stored);
            return inMemoryTeacherDashboardCache;
        }
    } catch (e) {
        console.warn("Failed to read teacher dashboard cache", e);
    }
    return null;
}

function setTeacherCachedData(data) {
    inMemoryTeacherDashboardCache = data;
    try {
        sessionStorage.setItem(TEACHER_DASHBOARD_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("Failed to write teacher dashboard cache", e);
    }
}

export function TeacherDashboardHome() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const cachedData = getTeacherCachedData();

    const [overviewMetrics, setOverviewMetrics] = useState(() => cachedData?.overviewMetrics || defaultMetrics);
    const [performanceSkills, setPerformanceSkills] = useState(() => cachedData?.performanceSkills || []);
    const [attentionItems, setAttentionItems] = useState(() => cachedData?.attentionItems || []);
    const [recentActivities, setRecentActivities] = useState(() => cachedData?.recentActivities || []);
    const [assignedClasses, setAssignedClasses] = useState(() => cachedData?.assignedClasses || []);
    const [assignedStandards, setAssignedStandards] = useState(() => cachedData?.assignedStandards || []);
    const [assignedDivisions, setAssignedDivisions] = useState(() => cachedData?.assignedDivisions || []);
    const [assignedClassTitle, setAssignedClassTitle] = useState(() => cachedData?.assignedClassTitle || null);
    const [schoolName, setSchoolName] = useState(() => cachedData?.schoolName || user?.schoolName || "");

    const teacherName = user?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) || user?.email || "Teacher";
    const currentSchool = schoolName || user?.schoolName || "";
    const teacherTitle = assignedClassTitle || (user?.designation || user?.department ? `${user?.designation || 'Teacher'}${user?.department ? ` • ${user.department}` : ''}` : (currentSchool ? `${currentSchool} Teacher` : "Teacher"));

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const stats = await teacherDataApi.getDashboardStats();
                if (stats) {
                    let resolvedSchool = stats.schoolName || stats.teacherInfo?.schoolName || user?.schoolName || "";
                    if (!resolvedSchool) {
                        try {
                            const prof = await teacherDataApi.getProfile();
                            if (prof?.schoolName && prof.schoolName !== "No School Assigned") {
                                resolvedSchool = prof.schoolName;
                            }
                        } catch (e) {
                            // Non-critical fallback
                        }
                    }
                    if (resolvedSchool) {
                        setSchoolName(resolvedSchool);
                        if (!user?.schoolName || user.schoolName !== resolvedSchool) {
                            updateAdminSessionUser({
                                schoolName: resolvedSchool,
                                schoolId: stats.schoolId || stats.teacherInfo?.schoolId
                            });
                        }
                    }

                    const rawClasses = Array.isArray(stats.assignedClasses) ? stats.assignedClasses : [];
                    setAssignedClasses(rawClasses);

                    const stds = Array.isArray(stats.assignedStandards) ? stats.assignedStandards : [];
                    setAssignedStandards(stds);

                    const divs = Array.isArray(stats.assignedDivisions) ? stats.assignedDivisions : [];
                    setAssignedDivisions(divs);

                    // Build formatted title covering all assigned standards and divisions
                    const formattedTitle = stats.assignedStandardString
                        || (rawClasses.length > 0
                            ? rawClasses.map(c => c.name || (c.grade ? `${c.grade} Standard` : null)).filter(Boolean).join(", ")
                            : null);

                    let computedTitle = null;
                    if (formattedTitle) {
                        computedTitle = rawClasses.length === 1 ? `${formattedTitle} Teacher` : `${formattedTitle} • Teacher`;
                    } else if (rawClasses.length > 0) {
                        const firstClass = rawClasses[0];
                        const cName = firstClass.name || (firstClass.grade ? `${firstClass.grade} Standard` : null);
                        if (cName) computedTitle = `${cName} Teacher`;
                    }
                    setAssignedClassTitle(computedTitle);

                    const totalStus = stats.totalStudents ?? (stats.students ? stats.students.length : 0);
                    const avgProg = stats.averageProgress !== undefined && stats.averageProgress !== null
                        ? Math.round(stats.averageProgress)
                        : (stats.avgProgress !== undefined ? Math.round(stats.avgProgress) : 0);
                    const attCount = (stats.studentsRequiringAttention || stats.attentionStudents || []).length;
                    const compCount = stats.completedStudents !== undefined ? stats.completedStudents : 0;
                    const compRate = totalStus > 0 ? Math.round((compCount / totalStus) * 100) : 0;

                    const computedMetrics = [
                        {
                            id: "students",
                            label: "Total Students",
                            value: `${totalStus}`,
                            helper: "Assigned to your class",
                            tone: "indigo",
                        },
                        {
                            id: "progress",
                            label: "Average Class Progress",
                            value: `${avgProg}%`,
                            helper: "Across all learning skills",
                            tone: "emerald",
                        },
                        {
                            id: "attention",
                            label: "Students Requiring Attention",
                            value: `${attCount}`,
                            helper: "Based on recent practice",
                            tone: "rose",
                        },
                        {
                            id: "completion",
                            label: "Weekly Practice Completion",
                            value: `${compRate}%`,
                            helper: `${compCount} students completed goals`,
                            tone: "amber",
                        },
                    ];
                    setOverviewMetrics(computedMetrics);

                    let computedSkills = [];
                    if (stats.skillPerformance) {
                        const sp = stats.skillPerformance;
                        computedSkills = [
                            {
                                id: "speaking",
                                label: "Speaking Confidence",
                                summary: `Average Score: ${Math.round(sp.speaking || 0)}%`,
                                tone: "indigo",
                            },
                            {
                                id: "grammar",
                                label: "Grammar Accuracy",
                                summary: `Average Score: ${Math.round(sp.grammar || 0)}%`,
                                tone: "emerald",
                            },
                            {
                                id: "vocabulary",
                                label: "Vocabulary Growth",
                                summary: `Average Words: ${Math.round(sp.vocabulary || 0)}`,
                                tone: "violet",
                            },
                            {
                                id: "listening",
                                label: "Pronunciation & Listening",
                                summary: `Average Score: ${Math.round(sp.listening || 0)}%`,
                                tone: "amber",
                            },
                        ];
                        setPerformanceSkills(computedSkills);
                    }

                    const rawAttention = stats.studentsRequiringAttention || stats.attentionStudents || [];
                    const computedAttention = rawAttention.map((s, idx) => ({
                        id: s.studentId || s.id || `att-${idx}`,
                        name: s.studentName || s.name || `${s.firstName || 'Student'} ${s.lastName || ''}`.trim(),
                        reason: s.reason || "Requires additional practice",
                        progress: s.progress || s.percentage || 45,
                    }));
                    setAttentionItems(computedAttention);

                    const rawActivity = stats.recentActivity || [];
                    const computedActivities = rawActivity.map((a, idx) => ({
                        student: a.studentName || a.title || "Student",
                        action: a.action || a.title || "completed a practice session",
                        time: a.time ? new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
                        tone: ["indigo", "emerald", "violet", "amber"][idx % 4],
                    }));
                    setRecentActivities(computedActivities);

                    // Cache the computed dashboard dataset for instant 0ms subsequent loads
                    setTeacherCachedData({
                        overviewMetrics: computedMetrics,
                        performanceSkills: computedSkills,
                        attentionItems: computedAttention,
                        recentActivities: computedActivities,
                        assignedClasses: rawClasses,
                        assignedStandards: stds,
                        assignedDivisions: divs,
                        assignedClassTitle: computedTitle,
                        schoolName: resolvedSchool || schoolName,
                    });
                }
            } catch (err) {
                console.error("Failed to load teacher dashboard data:", err);
            }
        };
        fetchDashboard();
    }, []);

    const quickActionRoutes = {
        students: ROUTES.TEACHER_STUDENTS,
        analytics: ROUTES.TEACHER_ANALYTICS,
        reports: ROUTES.TEACHER_REPORTS,
    };
    const navigateTo = (path) => navigate(path);

    const handleNavigateToClass = (cls) => {
        const params = new URLSearchParams();
        if (cls?.standard || cls?.grade) params.set("standard", cls.standard || cls.grade);
        if (cls?.division) params.set("division", cls.division);
        navigate(`${ROUTES.TEACHER_STUDENTS}?${params.toString()}`);
    };

    const formattedDate = new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <motion.section variants={itemVariants} className="mb-6" aria-labelledby="welcome-heading">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-primary)]">
                                Teacher dashboard
                            </p>
                            {currentSchool && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                                    <Building2 className="h-3 w-3" />
                                    {currentSchool}
                                </span>
                            )}
                        </div>
                        <p className="mt-3 text-base font-semibold text-[var(--text-secondary)]">Welcome,</p>
                        <h1 id="welcome-heading" className="mt-1 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
                            {teacherName}
                        </h1>
                        <div className="mt-2.5 flex flex-wrap items-center gap-3">
                            {currentSchool && (
                                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] shadow-xs">
                                    <Building2 className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                                    <span className="text-[var(--text-muted)]">School:</span>
                                    <span className="font-bold text-[var(--text-primary)]">{currentSchool}</span>
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                                    {assignedClasses.length > 1
                                        ? "Assigned Classes:"
                                        : (assignedClassTitle || teacherTitle)}
                                </p>
                                {assignedClasses.length > 1 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {assignedClasses.map((cls, idx) => (
                                            <button
                                                key={cls.id || `${cls.grade}-${cls.division}-${idx}`}
                                                type="button"
                                                onClick={() => handleNavigateToClass(cls)}
                                                title={`Filter roster by ${cls.name || cls.grade}`}
                                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-primary)] transition hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/10 active:scale-95"
                                            >
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                {cls.name || (cls.grade ? `Grade ${cls.grade}${cls.division ? ` - ${cls.division}` : ''}` : `Class ${idx + 1}`)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Today</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formattedDate}</p>
                    </div>
                </div>
            </motion.section>

            <section aria-label="Class overview">
                <OverviewCards metrics={overviewMetrics} />
            </section>

            <PerformanceOverview skills={performanceSkills} />

            <motion.section
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="mt-6 grid gap-6 lg:grid-cols-2"
                aria-label="Student attention and recent activity"
            >
                <motion.div variants={itemVariants}>
                    <AttentionList
                        students={attentionItems}
                        onOpenStudent={(studentId) => navigateTo(
                            ROUTES.TEACHER_STUDENT_DETAILS.replace(":studentId", studentId),
                        )}
                    />
                </motion.div>
                <motion.div variants={itemVariants}>
                    <RecentActivity activities={recentActivities} />
                </motion.div>
            </motion.section>

            <QuickActions onOpenAction={(action) => navigateTo(quickActionRoutes[action])} />
        </motion.div>
    );
}

export default TeacherDashboardHome;
