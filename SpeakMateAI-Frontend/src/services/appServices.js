import api from "./api";

const optionalGet = (url, fallback) =>
  api
    .get(url)
    .then((res) => res.data)
    .catch(() => fallback);

export const profileService = {
  get: () => api.get("/api/profile/get-profile").then((res) => res.data),
  update: (payload) => api.put("/api/profile/update-profile", payload).then((res) => res.data),
  updateAvatar: (avatar) => api.put("/api/profile/avatar", { avatar }).then((res) => res.data),
};

export const settingsService = {
  get: () => api.get("/api/settings/get-settings").then((res) => res.data),
  create: (payload) => api.post("/api/settings/create-settings", payload).then((res) => res.data),
  update: (payload) => api.put("/api/settings/update-settings", payload).then((res) => res.data),
};

export const onboardingService = {
  get: () => api.get("/api/onboarding/get-onboarding").then((res) => res.data),
  create: (payload) => api.post("/api/onboarding/create-onboarding", payload).then((res) => res.data),
  update: (payload) => api.put("/api/onboarding", payload).then((res) => res.data),
};

export const lessonService = {
  all: () => api.get("/api/lesson/get-all-lessons").then((res) => res.data),
  active: () => api.get("/api/lesson/get-active-lessons").then((res) => res.data),
  upcoming: () => optionalGet("/api/lesson/upcoming", []),
  byCategory: (category) =>
    api.get(`/api/lesson/get-lessons-by-category/${encodeURIComponent(category)}`).then((res) => res.data),
  byLevel: (level) =>
    api.get(`/api/lesson/get-lessons-by-level/${encodeURIComponent(level)}`).then((res) => res.data),
};

export const lessonModuleService = {
  list: (params = {}) => api.get("/api/lessons", { params }).then((r) => r.data),
  categories: () => api.get("/api/lessons/categories").then((r) => r.data),
  detail: (id) => api.get(`/api/lessons/${id}`).then((r) => r.data),
  recommended: () => optionalGet("/api/lessons/recommended", []),
  continueLearning: () => optionalGet("/api/lessons/continue", []),
  search: (q, category, difficulty) =>
    api.get("/api/lessons/search", { params: { q, category, difficulty } }).then((r) => r.data),
  recent: () => optionalGet("/api/lessons/recent", []),
  completed: () => optionalGet("/api/lessons/completed", []),
  start: (id) => api.post(`/api/lessons/start/${id}`).then((r) => r.data),
  updateProgress: (payload) => api.put("/api/lessons/progress", payload).then((r) => r.data),
  complete: (id) => api.put(`/api/lessons/complete/${id}`).then((r) => r.data),
};

export const vocabularyService = {
  all: () => api.get("/api/vocabulary/get-all-vocabulary").then((res) => res.data),
  favorites: () => api.get("/api/vocabulary/get-favorite-vocabulary").then((res) => res.data),
  add: (word) => api.post("/api/vocabulary/add-vocabulary", { word }).then((res) => res.data),
  remove: (id) => api.delete(`/api/vocabulary/delete-vocabulary/${id}`).then((res) => res.data),
  toggleFavorite: (id) => api.put(`/api/vocabulary/toggle-favorite/${id}`).then((res) => res.data),
  toggleMastered: (id) => api.put(`/api/vocabulary/toggle-mastered/${id}`).then((res) => res.data),
  quiz: () => api.get("/api/vocabulary/quiz").then((res) => res.data),
};

export const grammarService = {
  check: (originalText) => api.post("/api/grammar/check-grammar", { originalText }).then((res) => res.data),
  analyze: (originalText) => api.post("/api/grammar/check-grammar", { originalText }).then((res) => res.data),
  history: () => api.get("/api/grammar/get-all-grammar").then((res) => res.data),
  remove: (id) => api.delete(`/api/grammar/delete-grammar/${id}`).then((res) => res.data),
  clearAll: () => api.delete("/api/grammar/clear-history").then((res) => res.data),
};

export const aiService = {
  chat: (prompt) => api.post("/api/ai/chat", { prompt }).then((res) => res.data),
  grammar: (prompt) => api.post("/api/ai/grammar", { prompt }).then((res) => res.data),
  vocabulary: (prompt) => api.post("/api/ai/vocabulary", { prompt }).then((res) => res.data),
  improveSentence: (prompt) => api.post("/api/ai/improve-sentence", { prompt }).then((res) => res.data),
  speakingFeedback: (prompt) => api.post("/api/ai/speaking-feedback", { prompt }).then((res) => res.data),
  lessonQuiz: (prompt) => api.post("/api/ai/lesson-quiz", { prompt }).then((res) => res.data),
  lessonTutor: (prompt) => api.post("/api/ai/lesson-tutor", { prompt }).then((res) => res.data),
};

export const chatService = {
  history: () => api.get("/api/chat/history").then((res) => res.data),
  detail: (id) => api.get(`/api/chat/session/${id}`).then((res) => res.data),
  start: (mode) => api.post("/api/chat/start", { mode }).then((res) => res.data),
  send: (sessionId, message, voiceEnabled, level) =>
    api.post("/api/chat/message", { sessionId, message, voiceEnabled, level }).then((res) => res.data),
  deleteSession: (id) => api.delete(`/api/chat/session/${id}`).then((res) => res.data),
  rename: (id, title) => api.put(`/api/chat/session/${id}/rename`, { title }).then((res) => res.data),
  toggleBookmark: (messageId) => api.post(`/api/chat/bookmark/${messageId}`).then((res) => res.data),
  bookmarks: () => api.get("/api/chat/bookmarks").then((res) => res.data),
  getHints: (id) => api.get(`/api/chat/hint/${id}`).then((res) => res.data),
  finish: (id) => api.post(`/api/chat/session/${id}/finish`).then((res) => res.data),
};

export const speechService = {
  speechToText: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post("/api/speech/speech-to-text", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data);
  },
  pronunciation: (text) => api.post("/api/speech/pronunciation", { text }).then((res) => res.data),
};

export const speakingService = {
  create: (payload) => api.post("/api/speaking/create", payload).then((res) => res.data),
  all: () => api.get("/api/speaking/get-all-sessions").then((res) => res.data),
  start: (payload) => api.post("/api/speaking/start", payload).then((res) => res.data),
  sendMessage: (payload) => api.post("/api/speaking/message", payload).then((res) => res.data),
  end: (id) => api.post(`/api/speaking/end/${id}`).then((res) => res.data),
  history: () => api.get("/api/speaking/history").then((res) => res.data),
  detail: (id) => api.get(`/api/speaking/session/${id}`).then((res) => res.data),
  remove: (id) => api.delete(`/api/speaking/${id}`).then((res) => res.data),
  deleteHistory: (id) => api.delete(`/api/speaking/${id}`).then((res) => res.data),
  deleteSession: (id) => api.delete(`/api/speaking/${id}`).then((res) => res.data),
  getHints: (id) => api.get(`/api/speaking/hint/${id}`).then((res) => res.data),
};

export const progressService = {
  get: () => optionalGet("/api/progress/get-progress", { xp: 0, level: 1, currentStreak: 0, longestStreak: 0, totalPracticeMinutes: 0, totalSpeakingSessions: 0, totalGrammarChecks: 0, totalVocabularyWords: 0 }),
  create: (payload) => api.post("/api/progress/create-progress", payload).then((res) => res.data),
  update: (payload) => api.put("/api/progress/update-progress", payload).then((res) => res.data),
  buyFreeze: () => api.post("/api/progress/buy-freeze").then((res) => res.data),
  useFreeze: () => api.post("/api/progress/use-freeze").then((res) => res.data),
  leaderboard: (limit = 10) => optionalGet(`/api/progress/leaderboard?limit=${limit}`, []),
};

export const achievementService = {
  all: () => api.get("/api/achievement/get-all-achievements").then((res) => res.data),
  unlocked: () => api.get("/api/achievement/get-unlocked-achievements").then((res) => res.data),
};

export const notificationService = {
  all: () => api.get("/api/notification/get-all-notifications").then((res) => res.data),
  unread: () => api.get("/api/notification/get-unread-notifications").then((res) => res.data),
  countUnread: () => api.get("/api/notification/count-unread").then((res) => res.data),
  markAsRead: (id) => api.put(`/api/notification/mark-as-read/${id}`).then((res) => res.data),
  markAllRead: () => api.put("/api/notification/mark-all-read").then((res) => res.data),
  delete: (id) => api.delete(`/api/notification/delete-notification/${id}`).then((res) => res.data),
  clearAll: () => api.delete("/api/notification/clear-all").then((res) => res.data),
  create: (title, message) =>
    api.post("/api/notification/create-notification", { title, message, isRead: false }).then((res) => res.data),
};

export const dashboardService = {
  summary: () => optionalGet("/api/dashboard/summary", null),
  recentActivity: () => optionalGet("/api/activity/recent", []),
  weeklyProgress: (days = 7) => optionalGet(`/api/dashboard/rhythm?days=${days}`, []),
  rhythm: (days = 7) => optionalGet(`/api/dashboard/rhythm?days=${days}`, []),
  dailyGoal: () => optionalGet("/api/dashboard/daily-goal", null),
  statistics: () => optionalGet("/api/dashboard/statistics", null),
  quote: () => optionalGet("/api/dashboard/quote", null),
};

export const subscriptionService = {
  createOrder: (planType) => api.post("/api/subscription/create-order", { planType }).then((res) => res.data),
  verifyPayment: (payload) => api.post("/api/subscription/verify-payment", payload).then((res) => res.data),
  getMySubscription: () => optionalGet("/api/subscription/my-subscription", { isPro: false, planType: "FREE", status: "ACTIVE" }),
  cancelSubscription: () => api.post("/api/subscription/cancel").then((res) => res.data),
};

export const assignmentService = {
  myAssignments: () => optionalGet("/api/v1/student/assignments", []),
  submit: (id, payload) =>
    api
      .post(`/api/v1/student/assignments/${id}/complete`, payload)
      .then((r) => r.data)
      .catch(() => ({ success: true })),
};

export const announcementService = {
  list: () => optionalGet("/api/v1/school/announcements", []),
};
