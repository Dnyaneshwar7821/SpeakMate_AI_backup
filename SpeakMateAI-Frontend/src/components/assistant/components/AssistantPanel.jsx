import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Mic, MicOff, Send, Sparkles, Trash2, X } from "lucide-react";

import { useAssistant } from "../AssistantContext";
import { useAssistantTheme } from "../useAssistantTheme";
import {
    WELCOME_TEXT_BY_ROLE,
    QUICK_SUGGESTIONS_BY_ROLE,
    ROLE_LABEL,
    DEFAULT_ROLE,
} from "../constants";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

// Conversational Voice Activity Thresholds (Matches Speaking Practice, AI Chat & Mobile Assistant)
const NORMAL_SILENCE_THRESHOLD = 3000; // 3.0s: comfortable complete-thought pause
const INCOMPLETE_SILENCE_THRESHOLD = 4500; // 4.5s: extra hesitation tolerance for connectors
const INITIAL_SILENCE_THRESHOLD = 8000; // 8.0s: auto-close if user stays completely silent

const INCOMPLETE_CONNECTORS = new Set([
    "and", "because", "but", "or", "so", "that", "to", "with", "like",
    "if", "when", "while", "although", "since", "for"
]);

const isIncompleteSentence = (text) => {
    if (!text || typeof text !== "string") return false;
    const clean = text.trim().toLowerCase().replace(/[.,!?;:]+$/, "").trim();
    if (!clean) return false;
    const words = clean.split(/\s+/);
    const lastWord = words[words.length - 1];
    return INCOMPLETE_CONNECTORS.has(lastWord);
};

export const AssistantPanel = React.forwardRef(function AssistantPanel(props, ref) {
    const {
        messages,
        loading,
        error,
        role,
        send,
        startNewChat,
        closeWidget,
        clearError,
    } = useAssistant();

    const theme = useAssistantTheme();

    const [draft, setDraft] = useState("");
    const [isListening, setIsListening] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const isListeningRef = useRef(false);
    const silenceTimerRef = useRef(null);
    const initialSilenceTimerRef = useRef(null);
    const recordingSessionRef = useRef(0);
    const stoppingByUserRef = useRef(false);
    const accumulatedTranscriptRef = useRef("");
    const interimTranscriptRef = useRef("");
    const handleStopListeningAndSendRef = useRef(null);
    const sendRef = useRef(send);

    useEffect(() => {
        sendRef.current = send;
    }, [send]);

    const welcome = WELCOME_TEXT_BY_ROLE[role] || WELCOME_TEXT_BY_ROLE[DEFAULT_ROLE];
    const suggestions = QUICK_SUGGESTIONS_BY_ROLE[role] || [];
    const roleLabel = ROLE_LABEL[role] || role || "Guest";

    const isEmpty = messages.length === 0;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    useEffect(() => {
        if (!loading && isEmpty) {
            inputRef.current?.focus();
        }
    }, [loading, isEmpty]);

    const clearAllSilenceTimers = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (initialSilenceTimerRef.current) {
            clearTimeout(initialSilenceTimerRef.current);
            initialSilenceTimerRef.current = null;
        }
    };

    // Speech-to-Text setup using browser Web Speech API with Continuous VAD & Auto-Send
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-US";

            recognition.onresult = (e) => {
                let interim = "";
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const textChunk = e.results[i][0].transcript;
                    if (e.results[i].isFinal) {
                        accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + " " + textChunk).trim();
                    } else {
                        interim += textChunk;
                    }
                }
                interimTranscriptRef.current = interim;

                const fullTranscript = (accumulatedTranscriptRef.current + " " + interim).trim();
                setDraft(fullTranscript);

                // Reset timers on active speech
                clearAllSilenceTimers();

                // Arm auto-send timer with smart connector hesitation tolerance (3.0s normal vs 4.5s incomplete connector)
                if (fullTranscript.length > 0) {
                    const activeSessionId = recordingSessionRef.current;
                    const threshold = isIncompleteSentence(fullTranscript)
                        ? INCOMPLETE_SILENCE_THRESHOLD
                        : NORMAL_SILENCE_THRESHOLD;

                    silenceTimerRef.current = setTimeout(() => {
                        if (
                            recordingSessionRef.current === activeSessionId &&
                            handleStopListeningAndSendRef.current
                        ) {
                            handleStopListeningAndSendRef.current();
                        }
                    }, threshold);
                }
            };

            recognition.onerror = (err) => {
                if (err?.error === "no-speech") return;
                if (err?.error === "not-allowed" || err?.error === "service-not-allowed") {
                    setIsListening(false);
                    isListeningRef.current = false;
                    clearAllSilenceTimers();
                }
            };

            recognition.onend = () => {
                if (isListeningRef.current && !stoppingByUserRef.current) {
                    try {
                        recognition.start();
                    } catch (e) {}
                } else {
                    setIsListening(false);
                    isListeningRef.current = false;
                    clearAllSilenceTimers();
                }
            };

            recognitionRef.current = recognition;
        }

        return () => {
            clearAllSilenceTimers();
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch {
                    // Ignore abort errors on cleanup
                }
            }
        };
    }, []);

    const handleStopListeningAndSend = async () => {
        clearAllSilenceTimers();

        stoppingByUserRef.current = true;
        isListeningRef.current = false;
        setIsListening(false);

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (err) {}
        }

        const finalSpoken = (
            accumulatedTranscriptRef.current + " " + (interimTranscriptRef.current || "")
        ).trim() || draft.trim();

        accumulatedTranscriptRef.current = "";
        interimTranscriptRef.current = "";
        setDraft("");

        if (!finalSpoken) return;

        if (sendRef.current) {
            await sendRef.current(finalSpoken);
        }
        inputRef.current?.focus();
    };
    handleStopListeningAndSendRef.current = handleStopListeningAndSend;

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
            return;
        }
        if (isListeningRef.current) {
            handleStopListeningAndSend();
        } else {
            const activeSessionId = ++recordingSessionRef.current;
            clearAllSilenceTimers();
            stoppingByUserRef.current = false;
            accumulatedTranscriptRef.current = "";
            interimTranscriptRef.current = "";
            setDraft("");

            // Arm 8.0s initial silence timer - auto stops if user doesn't say anything
            initialSilenceTimerRef.current = setTimeout(() => {
                if (
                    recordingSessionRef.current === activeSessionId &&
                    isListeningRef.current
                ) {
                    stoppingByUserRef.current = true;
                    isListeningRef.current = false;
                    setIsListening(false);
                    if (recognitionRef.current) {
                        try {
                            recognitionRef.current.stop();
                        } catch (e) {}
                    }
                }
            }, INITIAL_SILENCE_THRESHOLD);

            try {
                recognitionRef.current.start();
                isListeningRef.current = true;
                setIsListening(true);
            } catch (err) {
                console.warn("Speech recognition start collision:", err);
                isListeningRef.current = true;
                setIsListening(true);
            }
        }
    };

    const handleStartNewChat = () => {
        if (isListeningRef.current) {
            clearAllSilenceTimers();
            stoppingByUserRef.current = true;
            isListeningRef.current = false;
            setIsListening(false);
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
            }
        }
        startNewChat();
    };

    const handleCloseWidget = () => {
        if (isListeningRef.current) {
            clearAllSilenceTimers();
            stoppingByUserRef.current = true;
            isListeningRef.current = false;
            setIsListening(false);
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
            }
        }
        closeWidget();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isListeningRef.current) {
            handleStopListeningAndSend();
            return;
        }
        const trimmed = draft.trim();
        if (!trimmed || loading) return;

        setDraft("");
        const ok = await send(trimmed);
        if (!ok) {
            setDraft((prev) => (prev ? prev : trimmed));
        }
        inputRef.current?.focus();
    };

    const handleSuggestion = (text) => {
        if (loading) return;
        send(text);
    };

    return (
        <div
            ref={ref}
            className="fixed bottom-24 right-5 z-[9999] flex h-[min(620px,calc(100dvh-7.5rem))] w-[min(430px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[26px] border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-[0_24px_64px_-12px_rgba(15,23,42,0.28)] ring-1 ring-black/5 dark:ring-white/10"
        >
            {/* Top Gradient Accent Bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${theme.topRibbon}`} />

            {/* Modern Chatbot Header */}
            <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 px-4 py-3 backdrop-blur-md">
                {/* AI Avatar with Online Pulse */}
                <div
                    style={{
                        boxShadow: `0 8px 20px -4px ${theme.glow}`,
                    }}
                    className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr ${theme.avatarGradient} text-white`}
                >
                    <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-slate-900">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </span>
                </div>

                {/* Title & Role Metadata */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                            SpeakMate Assistant
                        </p>
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${theme.badgeBg}`}>
                            AI
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate font-medium">{roleLabel}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleStartNewChat}
                        title="Start New Chat"
                        aria-label="Start new chat and reset conversation"
                        className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 dark:text-slate-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 cursor-pointer"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={handleCloseWidget}
                        title="Close Chat"
                        aria-label="Close SpeakMate Assistant"
                        className={`grid h-8 w-8 place-items-center rounded-xl text-slate-500 dark:text-slate-400 transition-all duration-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus:outline-none focus-visible:ring-2 ${theme.ring} cursor-pointer`}
                    >
                        <X className="h-4.5 w-4.5" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Error Notification Banner */}
            {error ? (
                <div className="flex items-start gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-400 backdrop-blur-sm">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1 leading-snug">{error}</span>
                    <button
                        type="button"
                        onClick={clearError}
                        aria-label="Dismiss error"
                        className="text-red-600/70 hover:text-red-600 dark:text-red-400/70 dark:hover:text-red-400 cursor-pointer"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                </div>
            ) : null}

            {/* Conversation Stream Scroll Area */}
            <div
                ref={scrollRef}
                className="flex-1 space-y-3.5 overflow-y-auto p-4 text-xs leading-relaxed scroll-smooth"
            >
                {isEmpty ? (
                    <div className="flex flex-col gap-3.5">
                        <MessageBubble
                            message={{
                                id: "welcome",
                                sender: "assistant",
                                content: welcome,
                            }}
                            role={role}
                            onClose={closeWidget}
                        />

                        {suggestions.length > 0 ? (
                            <div className="pt-2">
                                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    <Sparkles className="h-3 w-3 text-amber-500" />
                                    <span>Suggested questions</span>
                                </p>
                                <div className="flex flex-col gap-2">
                                    {suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            onClick={() => handleSuggestion(suggestion)}
                                            disabled={loading}
                                            className={`group flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-300 transition-all duration-200 ${theme.hoverBorder} hover:shadow-sm focus:outline-none focus-visible:ring-2 ${theme.ring} disabled:opacity-50 cursor-pointer`}
                                        >
                                            <span className="truncate pr-2">{suggestion}</span>
                                            <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform duration-200 shrink-0">
                                                →
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                role={role}
                                onClose={closeWidget}
                            />
                        ))}
                        {loading ? <TypingIndicator /> : null}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Modern Floating Chat Input Dock */}
            <div className="border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 p-3 backdrop-blur-md">
                <form
                    onSubmit={handleSubmit}
                    className={`flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-1.5 pl-3.5 shadow-sm ${theme.focusBorder} focus-within:ring-2 transition-all duration-200`}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={
                            isListening
                                ? "Listening... Auto-sends when you finish speaking..."
                                : loading
                                ? "Thinking..."
                                : "Ask SpeakMate Assistant..."
                        }
                        disabled={loading}
                        className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50"
                    />

                    {/* Speech-to-Text Microphone Button */}
                    <button
                        type="button"
                        onClick={toggleListening}
                        disabled={loading}
                        aria-label={isListening ? "Stop listening" : "Voice input"}
                        title={isListening ? "Listening... Click to stop" : "Speak your question"}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 ${theme.ring} disabled:opacity-40 cursor-pointer ${
                            isListening
                                ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30"
                                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/70"
                        }`}
                    >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>

                    {/* Send Button */}
                    <button
                        type="submit"
                        disabled={loading || !draft.trim()}
                        aria-label={loading ? "Generating response..." : "Send message"}
                        title={loading ? "Assistant is thinking..." : "Send"}
                        style={{
                            boxShadow: `0 4px 14px -2px ${theme.glow}`,
                        }}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-tr ${theme.sendGradient} text-white shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 ${theme.ring} disabled:opacity-40 disabled:hover:scale-100 cursor-pointer`}
                    >
                        {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" aria-hidden="true" />
                        ) : (
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                    </button>
                </form>

                {/* Micro AI Disclaimer */}
                <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500 select-none">
                    Powered by SpeakMate AI • Grounded Academic Assistant
                </p>
            </div>
        </div>
    );
});

export default AssistantPanel;

