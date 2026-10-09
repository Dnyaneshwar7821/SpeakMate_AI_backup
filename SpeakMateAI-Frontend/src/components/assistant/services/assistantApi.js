import apiClient from "./apiClient";

/**
 * Consumes POST /api/assistant/message — the stateless assistant endpoint.
 */

const extractErrorMessage = (error, fallback) => {
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }
    if (error?.message) {
        return error.message;
    }
    return fallback;
};

export const assistantApi = {
    /**
     * Send one user message to the assistant.
     * Note: `role` is an optional client-side hint passed to the local apiClient
     * solely to select which local storage token to attach (learner vs admin).
     * The backend strictly authorizes and scopes access using the validated JWT / cookie principal.
     */
    sendMessage: async ({ sessionId, message, currentRoute, history, role }) => {
        const payload = {
            sessionId: sessionId ?? null,
            message,
        };
        if (typeof currentRoute === "string" && currentRoute.trim()) {
            payload.currentRoute = currentRoute.trim();
        }
        if (Array.isArray(history) && history.length > 0) {
            payload.history = history;
        }

        const headers = {};
        if (typeof role === "string" && role.trim()) {
            headers["X-Assistant-Role"] = role.trim();
        }

        const response = await apiClient.post("/api/assistant/message", payload, { headers });
        const data = response.data || {};

        return {
            markdown: typeof data.markdown === "string" ? data.markdown : "",
            intent: typeof data.intent === "string" ? data.intent : "UNKNOWN",
            accessDenied: Boolean(data.accessDenied),
            sessionId: typeof data.sessionId === "string" ? data.sessionId : null,
            stats: Array.isArray(data.stats) ? data.stats : [],
            chart: data.chart || null,
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        };
    },

    /**
     * Map any transport/API error to a stable, user-friendly message.
     */
    toFriendlyError: (error) => {
        const status = error?.response?.status;
        if (status === 403) {
            return "You don't have access to this feature. Please sign in or contact your administrator.";
        }
        if (status === 401) {
            return "Please sign in to your account to use the SpeakMate Assistant.";
        }
        if (status === 400) {
            return extractErrorMessage(error, "That request wasn't valid. Please rephrase and try again.");
        }
        if (status === 500) {
            return extractErrorMessage(error, "The assistant is temporarily unavailable. Please try again in a moment.");
        }
        if (!status && !error?.response) {
            return "Cannot reach the assistant right now. Check your backend server connection and try again.";
        }
        return extractErrorMessage(error, "Something went wrong while contacting the assistant.");
    },
};

export default assistantApi;
