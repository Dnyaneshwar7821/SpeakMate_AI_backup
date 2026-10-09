import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import assistantApi from "./services/assistantApi";
import { WELCOME_TEXT_BY_ROLE, QUICK_SUGGESTIONS_BY_ROLE, DEFAULT_ROLE } from "./constants";

// Safe auth detection across all SpeakMate roles
const useAuth = () => {
    try {
        const sessionStr = localStorage.getItem("speakmate_admin_session");
        if (sessionStr) {
            const parsed = JSON.parse(sessionStr);
            if (parsed.authenticated) {
                const role = parsed.role || parsed.user?.role || "SUPER_ADMIN";
                return { user: parsed.user || parsed, role };
            }
        }
        const userStr = localStorage.getItem("speakmate_user") || localStorage.getItem("user");
        if (userStr) {
            const parsed = JSON.parse(userStr);
            const role = parsed.role || parsed.accountType || "USER";
            return { user: parsed, role };
        }
    } catch (_) {}
    return { user: { role: DEFAULT_ROLE }, role: DEFAULT_ROLE };
};

const AssistantContext = createContext();

const noop = () => { };

const createUserMessage = (content) => ({
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender: "user",
    content,
    timestamp: new Date().toISOString(),
});

const createAssistantMessage = (content, meta = {}) => ({
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender: "assistant",
    content,
    timestamp: new Date().toISOString(),
    accessDenied: Boolean(meta.accessDenied),
    stats: meta.stats || [],
    chart: meta.chart || null,
    suggestions: meta.suggestions || [],
});

/**
 * Provides state and actions for the SpeakMate assistant widget.
 * Note: The `role` prop configures the client-side UI persona and session storage cache namespace.
 * It is also provided as a hint to apiClient to disambiguate local token storage.
 * All backend API access is strictly authorized by Spring Security using the JWT / session cookie.
 */
export function AssistantProvider({ children, role: explicitRole, user: explicitUser }) {
    const fallbackAuth = useAuth();
    const user = explicitUser || fallbackAuth.user;
    const role = explicitRole || fallbackAuth.role || user?.role || DEFAULT_ROLE;

    const userIdOrEmail = user?.id || user?.email || "guest";
    const storageKey = `speakmate_assistant_${role}_${userIdOrEmail}`;

    const [isOpen, setIsOpen] = useState(() => {
        try {
            return sessionStorage.getItem(`${storageKey}_open`) === "true";
        } catch (_) {
            return false;
        }
    });
    const [sessionId, setSessionId] = useState(() => {
        try {
            return sessionStorage.getItem(`${storageKey}_sid`) || null;
        } catch (_) {
            return null;
        }
    });
    const [messages, setMessages] = useState(() => {
        try {
            const raw = sessionStorage.getItem(`${storageKey}_msgs`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (_) {}
        return [];
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Refs so callbacks stay stable without stale closures
    const sessionIdRef = useRef(sessionId);
    const messagesRef = useRef(messages);

    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        try {
            sessionStorage.setItem(`${storageKey}_open`, isOpen ? "true" : "false");
        } catch (_) {}
    }, [isOpen, storageKey]);

    useEffect(() => {
        try {
            if (sessionId) {
                sessionStorage.setItem(`${storageKey}_sid`, sessionId);
            } else {
                sessionStorage.removeItem(`${storageKey}_sid`);
            }
        } catch (_) {}
    }, [sessionId, storageKey]);

    useEffect(() => {
        try {
            if (messages && messages.length > 0) {
                sessionStorage.setItem(`${storageKey}_msgs`, JSON.stringify(messages));
            } else {
                sessionStorage.removeItem(`${storageKey}_msgs`);
            }
        } catch (_) {}
    }, [messages, storageKey]);

    const openWidget = useCallback(() => {
        setError(null);
        setIsOpen(true);
    }, []);

    const closeWidget = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const startNewChat = useCallback(() => {
        try {
            sessionStorage.removeItem(`${storageKey}_sid`);
            sessionStorage.removeItem(`${storageKey}_msgs`);
        } catch (_) {}
        sessionIdRef.current = null;
        setSessionId(null);
        messagesRef.current = [];
        setMessages([]);
        setError(null);
    }, [storageKey]);

    const send = useCallback(
        async (text) => {
            const trimmed = typeof text === "string" ? text.trim() : "";
            if (!trimmed || loading) return false;

            const priorHistory = messagesRef.current.slice(-6).map((m) => ({
                role: m.sender === "assistant" ? "assistant" : "user",
                content: m.content,
            }));
            const userMessage = createUserMessage(trimmed);
            const nextMessages = [...messagesRef.current, userMessage];
            messagesRef.current = nextMessages;
            setMessages(nextMessages);
            setError(null);
            setLoading(true);

            try {
                const currentRoute = typeof window !== "undefined" ? window.location.pathname : null;
                const response = await assistantApi.sendMessage({
                    sessionId: sessionIdRef.current,
                    message: trimmed,
                    currentRoute,
                    history: priorHistory,
                    role,
                });

                if (response.sessionId) {
                    sessionIdRef.current = response.sessionId;
                    setSessionId(response.sessionId);
                }

                const assistantMessage = createAssistantMessage(response.markdown, {
                    accessDenied: response.accessDenied,
                    stats: response.stats,
                    chart: response.chart,
                    suggestions: response.suggestions,
                });
                const finalMessages = [...messagesRef.current, assistantMessage];
                messagesRef.current = finalMessages;
                setMessages(finalMessages);
                setLoading(false);
                return true;
            } catch (err) {
                setLoading(false);
                setError(assistantApi.toFriendlyError(err));
                return false;
            }
        },
        [loading, role]
    );

    const value = useMemo(
        () => ({
            isOpen,
            sessionId,
            messages,
            loading,
            error,
            role,
            user,
            openWidget,
            closeWidget,
            toggle,
            send,
            startNewChat,
            clearError,
        }),
        [
            isOpen,
            sessionId,
            messages,
            loading,
            error,
            role,
            user,
            openWidget,
            closeWidget,
            toggle,
            send,
            startNewChat,
            clearError,
        ]
    );

    return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
    const context = useContext(AssistantContext);
    if (!context) {
        throw new Error("useAssistant must be used within an AssistantProvider");
    }
    return context;
}

export { noop };
export default AssistantProvider;
