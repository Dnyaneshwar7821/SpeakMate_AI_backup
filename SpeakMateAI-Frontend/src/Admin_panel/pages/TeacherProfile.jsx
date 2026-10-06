import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    GraduationCap,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    CalendarDays,
    Save,
    Camera,
    MoreHorizontal,
    CheckCircle2,
    Building2,
    BookOpen,
    ShieldCheck,
    Award,
    Clock,
    AlertCircle,
    Pencil,
    X,
    Copy,
    Check,
    Laptop,
    Globe2,
    School,
} from "lucide-react";

import Button from "@components/common/Button";
import Input from "@components/common/Input";
import PhoneInput from "@components/common/PhoneInput";
import SectionCard from "@admin/components/SectionCard";
import InsigniaBadge from "@components/common/InsigniaBadge";
import InsigniaStudioModal from "@components/common/InsigniaStudioModal";
import { teacherDataApi } from "@services/admin/teacherDataApi";
import { syncInsigniaFromBackend } from "@utils/insigniaHelper";
import { getIndianMobileError, normalizeIndianMobile, sanitizeMobileInput } from "@utils/phoneValidator";
import { updateAdminSessionUser } from "../services/adminSession";
import { invalidateStudentCache } from "@admin/hooks/useStudentManagement";

/**
 * Admin_panel/pages/TeacherProfile.jsx
 *
 * Complete Teacher Profile — aligned with Super Admin Profile layout & UX.
 * Two-column responsive architecture with Identity Card (left) and Account Details (right).
 * Supports View Mode (default) and Edit Mode (via Edit Profile, with Cancel and Save Changes).
 */

const TEACHER_PROFILE = {
    name: "",
    firstName: "",
    lastName: "",
    role: "Teacher",
    email: "",
    phone: "",
    location: "",
    department: "",
    designation: "",
    qualification: "",
    experience: "",
    joinedAt: "",
    bio: "",
    avatar: "",
    schoolName: "",
    assignedStandard: "",
};

// Module-level in-memory cache for instant profile rendering without flicker
let teacherProfileCache = null;

function getInitials(name) {
    if (!name) return "T";
    return name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export function TeacherProfile() {
    const [form, setForm] = useState(() => teacherProfileCache || TEACHER_PROFILE);
    const [initialForm, setInitialForm] = useState(() => teacherProfileCache || TEACHER_PROFILE);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(() => !teacherProfileCache);
    const [isSaving, setIsSaving] = useState(false);
    const [phoneError, setPhoneError] = useState("");

    // Kebab Menu Popover State
    const [menuOpen, setMenuOpen] = useState(false);

    // Toast Notifications State
    const [toasts, setToasts] = useState([]);

    // Insignia Studio Modal
    const [isInsigniaModalOpen, setIsInsigniaModalOpen] = useState(false);

    // 1-Click Copy Feedback State
    const [copiedKey, setCopiedKey] = useState(null);

    const handleCopy = (text, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        triggerToast(`Copied ${key === "email" ? "Email" : "Phone"} to clipboard!`);
        setTimeout(() => {
            setCopiedKey((curr) => (curr === key ? null : curr));
        }, 2000);
    };

    const triggerToast = (message, type = "success") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3200);
    };

    const mapResponseToForm = (res) => {
        const id = res.identity || {};
        const prof = res.professionalInfo || {};
        const contact = res.contactInfo || {};
        const teach = res.teachingOverview || {};

        const fName = id.firstName || "";
        const lName = id.lastName || "";
        const fullName = `${fName} ${lName}`.trim() || fName || id.email || "Teacher";

        let standardName = res.assignedStandard || "";
        if (!standardName && teach.assignedClasses && teach.assignedClasses.length > 0) {
            standardName = teach.assignedClasses
                .map((c) => c.name || (c.grade ? `${c.grade} Standard` : ""))
                .filter(Boolean)
                .join(", ");
        } else if (!standardName && id.standard) {
            standardName = id.standard.toLowerCase().includes("standard")
                ? id.standard
                : `${id.standard} Standard`;
        }
        if (!standardName) {
            standardName = "No Standard Assigned";
        }

        const resolvedSchool = res.schoolName || id.schoolName || contact.address || "No School Assigned";

        const joinedDate = prof.joinedAt
            ? prof.joinedAt.slice(0, 10)
            : id.createdAt
              ? id.createdAt.slice(0, 10)
              : "";

        return {
            name: fullName,
            firstName: fName,
            lastName: lName,
            role: id.role === "TEACHER" ? "Teacher" : id.role || "Teacher",
            email: id.email || "",
            phone: contact.phone || id.phone || "",
            location: contact.location || prof.location || "",
            department: prof.department || "",
            designation: prof.designation || "",
            qualification: prof.qualification || "",
            experience: prof.experience || "",
            joinedAt: joinedDate,
            bio: res.bio || prof.bio || "",
            avatar: id.avatar || "",
            schoolName: resolvedSchool,
            assignedStandard: standardName,
        };
    };

    useEffect(() => {
        let isMounted = true;
        const fetchProfile = async () => {
            if (!teacherProfileCache) {
                setIsLoading(true);
            }
            try {
                const res = await teacherDataApi.getProfile();
                if (res && isMounted) {
                    let profileData = mapResponseToForm(res);

                    // Fallback to dashboard stats if school or standard is missing
                    if (
                        (!profileData.schoolName || profileData.schoolName === "No School Assigned" ||
                         !profileData.assignedStandard || profileData.assignedStandard === "No Standard Assigned")
                    ) {
                        try {
                            const stats = await teacherDataApi.getDashboardStats();
                            if (stats) {
                                if (
                                    (!profileData.schoolName || profileData.schoolName === "No School Assigned") &&
                                    (stats.schoolName || stats.teacherInfo?.schoolName)
                                ) {
                                    profileData.schoolName = stats.schoolName || stats.teacherInfo?.schoolName;
                                }
                                if (
                                    (!profileData.assignedStandard || profileData.assignedStandard === "No Standard Assigned") &&
                                    stats.assignedClasses &&
                                    stats.assignedClasses.length > 0
                                ) {
                                    profileData.assignedStandard = stats.assignedClasses
                                        .map((c) => c.name || (c.grade ? `${c.grade} Standard` : ""))
                                        .filter(Boolean)
                                        .join(", ");
                                }
                            }
                        } catch (e) {
                            // Non-critical fallback
                        }
                    }

                    teacherProfileCache = profileData;
                    setForm(profileData);
                    setInitialForm(profileData);

                    if (profileData.schoolName && profileData.schoolName !== "No School Assigned") {
                        updateAdminSessionUser({ schoolName: profileData.schoolName, schoolId: res.schoolId });
                    }

                    if (res.identity?.avatar || profileData.avatar) {
                        syncInsigniaFromBackend("TEACHER", profileData.email, res.identity?.avatar || profileData.avatar, profileData.name);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch teacher profile:", err);
                if (isMounted) {
                    const msg = err.response?.data?.message || "Failed to load profile.";
                    triggerToast(msg, "error");
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchProfile();
        window.addEventListener("focus", fetchProfile);
        window.addEventListener("admin-session-updated", fetchProfile);
        return () => {
            isMounted = false;
            window.removeEventListener("focus", fetchProfile);
            window.removeEventListener("admin-session-updated", fetchProfile);
        };
    }, []);

    const update = (key) => (e) => {
        let val = e.target.value;
        if (key === "phone") {
            val = sanitizeMobileInput(val);
            setPhoneError("");
        } else if (key === "name") {
            const parts = val.trimStart().split(" ");
            const firstName = parts[0] || "";
            const lastName = parts.slice(1).join(" ") || "";
            setForm((prev) => ({ ...prev, name: val, firstName, lastName }));
            return;
        }
        setForm((prev) => ({ ...prev, [key]: val }));
    };

    const handleCancel = () => {
        setForm(initialForm);
        setPhoneError("");
        setIsEditing(false);
    };

    const handleSave = async () => {
        if (!form.name || !form.name.trim()) {
            triggerToast("Full Name is required", "error");
            return;
        }

        if (form.phone && form.phone.trim()) {
            const err = getIndianMobileError(form.phone, "Phone number", false);
            if (err) {
                setPhoneError(err);
                triggerToast(err, "error");
                return;
            }
        }

        const [fName = "", ...lNameParts] = form.name.trim().split(" ");
        const lName = lNameParts.join(" ") || (form.lastName || "");

        setIsSaving(true);
        try {
            const payload = {
                firstName: form.firstName || fName,
                lastName: form.lastName || lName || fName,
                phone: form.phone ? normalizeIndianMobile(form.phone) : "",
                department: form.department || "",
                designation: form.designation || "",
                qualification: form.qualification || "",
                experience: form.experience || "",
                location: form.location || "",
                bio: form.bio || "",
            };

            const updatedRes = await teacherDataApi.updateProfile(payload);
            if (updatedRes) {
                const updatedData = mapResponseToForm(updatedRes);
                // Preserve schoolName and assignedStandard if not returned by update API
                if (updatedData.schoolName === "No School Assigned" && form.schoolName && form.schoolName !== "No School Assigned") {
                    updatedData.schoolName = form.schoolName;
                }
                if (updatedData.assignedStandard === "No Standard Assigned" && form.assignedStandard && form.assignedStandard !== "No Standard Assigned") {
                    updatedData.assignedStandard = form.assignedStandard;
                }
                teacherProfileCache = updatedData;
                setForm(updatedData);
                setInitialForm(updatedData);
                setPhoneError("");
                setIsEditing(false);

                // Update localStorage admin session so AuthContext and navbar reflect the new name immediately
                updateAdminSessionUser({
                    name: updatedData.name,
                    firstName: updatedData.firstName,
                    lastName: updatedData.lastName,
                    phone: updatedData.phone,
                    department: updatedData.department,
                    designation: updatedData.designation,
                });

                // Clear cached student management data to guarantee fresh fetch
                invalidateStudentCache();

                // Dispatch global events for real-time reactivity across panels
                window.dispatchEvent(new CustomEvent("teacher_profile_updated", {
                    detail: {
                        teacherId: updatedRes.identity?.id || updatedRes.id,
                        name: updatedData.name,
                        firstName: updatedData.firstName,
                        lastName: updatedData.lastName,
                    }
                }));
                window.dispatchEvent(new CustomEvent("school_data_updated", {
                    detail: { type: "teacher", action: "update" }
                }));

                triggerToast("Profile updated successfully");
            }
        } catch (err) {
            console.error("Failed to update teacher profile:", err);
            const msg = err?.response?.data?.message || err?.message || "Failed to save profile changes.";
            triggerToast(msg, "error");
        } finally {
            setIsSaving(false);
        }
    };



    return (
        <div className="space-y-5 sm:space-y-6">
            {/* Page Header matching Super Admin */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <GraduationCap className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                                Teacher Profile
                            </h1>
                            {isEditing && (
                                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    Editing
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">
                            {isLoading
                                ? "Loading profile..."
                                : isEditing
                                  ? "Make changes to your profile and save, or cancel to discard."
                                  : "Manage your personal and professional information"}
                        </p>
                    </div>
                </div>

                {/* Header Action Buttons: View Mode vs Edit Mode */}
                <div className="flex items-center gap-2.5">
                    {!isEditing ? (
                        <Button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            disabled={isLoading}
                            className="!h-11 shrink-0 bg-[var(--color-primary)] shadow-md hover:shadow-[var(--color-primary)]/20 transition-all duration-200"
                        >
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit Profile
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="!h-11 shrink-0 border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-200"
                            >
                                <X className="mr-1.5 h-4 w-4" />
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                                isLoading={isSaving}
                                loadingText="Saving..."
                                className="!h-11 shrink-0 bg-[var(--color-primary)] shadow-md hover:shadow-[var(--color-primary)]/20 transition-all duration-200"
                            >
                                <Save className="mr-1.5 h-4 w-4" />
                                Save Changes
                            </Button>
                        </>
                    )}
                </div>
            </motion.div>

            {/* Skeleton Loading State matching Super Admin */}
            {isLoading ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr] lg:gap-6 animate-pulse">
                    <div className="space-y-5 sm:space-y-6">
                        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[var(--shadow-sm)]">
                            <div className="h-20 bg-slate-200 dark:bg-slate-700/50 rounded-xl mb-4" />
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className="h-24 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                                <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
                                <div className="h-3.5 w-48 rounded bg-slate-100 dark:bg-slate-800" />
                                <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--border-default)] pt-5">
                                <div className="space-y-2">
                                    <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 space-y-6">
                            <div className="space-y-2">
                                <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-700" />
                                <div className="h-3.5 w-60 rounded bg-slate-100 dark:bg-slate-800" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 pt-2">
                                <div className="space-y-2">
                                    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                                <div className="h-20 rounded-xl bg-slate-200 dark:bg-slate-700" />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr] lg:gap-6">
                    {/* Left: Identity Card */}
                    <div className="space-y-5 sm:space-y-6">
                        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] transition-all duration-300 hover:shadow-md">
                            {/* Top banner accent gradient */}
                            <div className="h-24 bg-gradient-to-r from-purple-600/20 via-[var(--color-primary)]/20 to-pink-500/20" />

                            <div className="p-5 sm:p-6 text-center -mt-12">
                                <div className="relative mx-auto w-fit">
                                    <InsigniaBadge
                                        name={form.name}
                                        role="TEACHER"
                                        email={form.email}
                                        size="lg"
                                        showCameraOverlay={true}
                                        onClick={() => setIsInsigniaModalOpen(true)}
                                    />
                                </div>

                                <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
                                    {form.name || "Teacher"}
                                </h2>
                                <p className="text-xs text-[var(--text-secondary)]">{form.email}</p>

                                <span className="mt-3.5 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    {form.role}
                                </span>

                                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--border-default)] pt-5 text-left">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                            Department
                                        </p>
                                        <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                                            <Briefcase className="h-3 w-3" />
                                            {form.department || "General"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                            Member Since
                                        </p>
                                        <p className="mt-1.5 text-sm font-bold text-[var(--text-primary)] pl-1">
                                            {form.joinedAt || "Active"}
                                        </p>
                                    </div>
                                </div>

                                {/* School Affiliation Context */}
                                <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5 text-left space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                                School Affiliation
                                            </p>
                                            <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                                {form.schoolName}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-default)]">
                                        <BookOpen className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                                Assigned Standard
                                            </p>
                                            <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                                {form.assignedStandard}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Active Session & Security Snapshot Card */}
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                    <Laptop className="h-3.5 w-3.5" />
                                    Active Session Snapshot
                                </h3>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active Now
                                </span>
                            </div>
                            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                                <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                                    <span>Client & Portal</span>
                                    <span className="font-semibold text-[var(--text-primary)]">Educator Portal • Web</span>
                                </div>
                                <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                                    <span className="flex items-center gap-1">
                                        <Globe2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                        School Network
                                    </span>
                                    <span className="font-semibold text-[var(--text-primary)]">{form.schoolName || "Institutional Network"}</span>
                                </div>
                                <div className="flex items-center justify-between py-1">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                        Teaching Status
                                    </span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Class In Session</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Editable Account Details Card */}
                    <SectionCard
                        title="Account Details"
                        subtitle={isEditing ? "Edit your information below, then click Save Changes in the header" : "Personal and professional details (click 'Edit Profile' to modify)"}
                        delay={0.1}
                        action={
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen((v) => !v)}
                                    className={`grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus:outline-none ${
                                        menuOpen ? "bg-[var(--bg-hover)] border-[var(--border-strong)] text-[var(--text-primary)]" : ""
                                    }`}
                                    aria-label="More options"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {menuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                                        <div className="absolute right-0 mt-1.5 w-48 z-20 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-lg">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMenuOpen(false);
                                                    handleDownloadProfile();
                                                }}
                                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                                            >
                                                Download Profile Data
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        }
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Full Name */}
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Full Name
                                </label>
                                <Input
                                    value={form.name}
                                    onChange={update("name")}
                                    placeholder="Enter your full name"
                                    disabled={!isEditing || isSaving}
                                />
                            </div>

                            {/* Email Address (Read-only) with 1-Click Copy */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                                        Email Address
                                    </label>
                                    {form.email && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(form.email, "email")}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                                        >
                                            {copiedKey === "email" ? (
                                                <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-500">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copy</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        type="email"
                                        value={form.email}
                                        className="!pl-9"
                                        disabled={true}
                                    />
                                </div>
                            </div>

                            {/* Phone (with Indian mobile validation and 1-Click Copy) */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                                        Phone Number
                                    </label>
                                    {form.phone && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(form.phone, "phone")}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                                        >
                                            {copiedKey === "phone" ? (
                                                <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-500">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copy</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <PhoneInput
                                    label=""
                                    value={form.phone}
                                    placeholder="e.g. 9876543210"
                                    onChange={update("phone")}
                                    error={phoneError}
                                    disabled={!isEditing || isSaving}
                                />
                            </div>

                            {/* Department */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Department
                                </label>
                                <div className="relative">
                                    <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        value={form.department}
                                        placeholder="e.g. English, Science"
                                        onChange={update("department")}
                                        className="!pl-9"
                                        disabled={!isEditing || isSaving}
                                    />
                                </div>
                            </div>

                            {/* Designation */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Designation
                                </label>
                                <div className="relative">
                                    <Award className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        value={form.designation}
                                        placeholder="e.g. Senior Teacher, Head of Dept"
                                        onChange={update("designation")}
                                        className="!pl-9"
                                        disabled={!isEditing || isSaving}
                                    />
                                </div>
                            </div>

                            {/* Qualification */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Qualification
                                </label>
                                <div className="relative">
                                    <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        value={form.qualification}
                                        placeholder="e.g. M.A., B.Ed."
                                        onChange={update("qualification")}
                                        className="!pl-9"
                                        disabled={!isEditing || isSaving}
                                    />
                                </div>
                            </div>

                            {/* Experience */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Experience
                                </label>
                                <div className="relative">
                                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        value={form.experience}
                                        placeholder="e.g. 5 years"
                                        onChange={update("experience")}
                                        className="!pl-9"
                                        disabled={!isEditing || isSaving}
                                    />
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Location
                                </label>
                                <div className="relative">
                                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        value={form.location}
                                        placeholder="e.g. Pune, Maharashtra"
                                        onChange={update("location")}
                                        className="!pl-9"
                                        disabled={!isEditing || isSaving}
                                    />
                                </div>
                            </div>

                            {/* Joined On (Read-only) */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Joined On
                                </label>
                                <div className="relative">
                                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        value={form.joinedAt}
                                        className="!pl-9"
                                        disabled={true}
                                    />
                                </div>
                            </div>

                            {/* Bio / About Me */}
                            <div className="sm:col-span-2 pb-2">
                                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                    Bio / About Me
                                </label>
                                <textarea
                                    rows={4}
                                    value={form.bio}
                                    onChange={update("bio")}
                                    placeholder="Tell us about yourself, your teaching experience, and your areas of expertise..."
                                    disabled={!isEditing || isSaving}
                                    className={`w-full resize-none rounded-xl border border-[var(--border-default)] px-3.5 py-3 text-sm text-[var(--text-primary)] outline-none transition shadow-sm ${
                                        !isEditing
                                            ? "bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] cursor-not-allowed opacity-80"
                                            : "bg-[var(--bg-surface)] hover:border-[var(--border-strong)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20"
                                    }`}
                                />
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Profile Insignia Studio Modal */}
            <InsigniaStudioModal
                isOpen={isInsigniaModalOpen}
                onClose={() => setIsInsigniaModalOpen(false)}
                role="TEACHER"
                name={form.name}
                email={form.email}
                onInsigniaUpdated={(msg) => triggerToast(msg)}
            />

            {/* Toast Notifications matching Super Admin */}
            <div className="fixed bottom-5 right-5 z-[150] flex flex-col gap-2 max-w-sm w-full">
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            role="status"
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.2 } }}
                            className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-xl"
                        >
                            {t.type === "error" ? (
                                <AlertCircle size={18} className="text-rose-500 shrink-0" />
                            ) : (
                                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                            )}
                            <span className="font-medium">{t.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default TeacherProfile;
