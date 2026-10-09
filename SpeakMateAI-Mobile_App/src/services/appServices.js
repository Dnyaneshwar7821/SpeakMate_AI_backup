import api from '../api/api';

const optionalGet = (url, fallback) =>
  api.get(url)
    .then((res) => res.data)
    .catch((error) => {
      // 404 Not Found or 204 No Content indicates an empty or uninitialized resource; return fallback.
      if (error.response?.status === 404 || error.response?.status === 204) {
        return fallback;
      }
      // Preserve error state for network outages, connection timeouts, and 5xx errors
      // so the UI can distinguish "empty" from "unavailable".
      throw error;
    });

export const profileService = {
  get: () => api.get('/api/profile/get-profile').then((res) => res.data),
  update: (payload) => api.put('/api/profile/update-profile', payload).then((res) => res.data),
  updateAvatar: (avatar) => api.put('/api/profile/avatar', { avatar }).then((res) => res.data),
};

export const settingsService = {
  get: () => api.get('/api/settings/get-settings').then((res) => res.data),
  create: (payload) => api.post('/api/settings/create-settings', payload).then((res) => res.data),
  update: (payload) => api.put('/api/settings/update-settings', payload).then((res) => res.data),
};

export const onboardingService = {
  get: () => api.get('/api/onboarding/get-onboarding').then((res) => res.data),
  create: (payload) => api.post('/api/onboarding/create-onboarding', payload).then((res) => res.data),
  update: (payload) => api.put('/api/onboarding', payload).then((res) => res.data),
};

export const lessonService = {
  all: () => api.get('/api/lesson/get-all-lessons').then((res) => res.data),
  active: () => api.get('/api/lesson/get-active-lessons').then((res) => res.data),
  upcoming: () => optionalGet('/api/lesson/upcoming', []),
  byCategory: (category) => api.get(`/api/lesson/get-lessons-by-category/${encodeURIComponent(category)}`).then((res) => res.data),
  byLevel: (level) => api.get(`/api/lesson/get-lessons-by-level/${encodeURIComponent(level)}`).then((res) => res.data),
};

// Phase 2 — Lessons Module service
export const lessonModuleService = {
  list: (params = {}) => api.get('/api/lessons', { params }).then((r) => r.data),
  categories: () => api.get('/api/lessons/categories').then((r) => r.data),
  detail: (id) => api.get(`/api/lessons/${id}`).then((r) => r.data),
  recommended: () => optionalGet('/api/lessons/recommended', []),
  continueLearning: () => optionalGet('/api/lessons/continue', []),
  search: (q, category, difficulty) =>
    api.get('/api/lessons/search', { params: { q, category, difficulty } }).then((r) => r.data),
  recent: () => optionalGet('/api/lessons/recent', []),
  completed: () => optionalGet('/api/lessons/completed', []),
  start: (id) => api.post(`/api/lessons/start/${id}`).then((r) => r.data),
  updateProgress: (payload) => api.put('/api/lessons/progress', payload).then((r) => r.data),
  complete: (id) => api.put(`/api/lessons/complete/${id}`).then((r) => r.data),
};

export const vocabularyService = {
  all: () => api.get('/api/vocabulary/get-all-vocabulary').then((res) => res.data),
  favorites: () => api.get('/api/vocabulary/get-favorite-vocabulary').then((res) => res.data),
  add: (word) => api.post('/api/vocabulary/add-vocabulary', { word }).then((res) => res.data),
  remove: (id) => api.delete(`/api/vocabulary/delete-vocabulary/${id}`).then((res) => res.data),
  toggleFavorite: (id) => api.put(`/api/vocabulary/toggle-favorite/${id}`).then((res) => res.data),
  toggleMastered: (id) => api.put(`/api/vocabulary/toggle-mastered/${id}`).then((res) => res.data),
  quiz: () => api.get('/api/vocabulary/quiz').then((res) => res.data),
};

export const grammarService = {
  check: (originalText) => api.post('/api/grammar/check-grammar', { originalText }).then((res) => res.data),
  history: () => api.get('/api/grammar/get-all-grammar').then((res) => res.data),
  remove: (id) => api.delete(`/api/grammar/delete-grammar/${id}`).then((res) => res.data),
};

export const aiService = {
  chat: (prompt) => api.post('/api/ai/chat', { prompt }).then((res) => res.data),
  grammar: (prompt) => api.post('/api/ai/grammar', { prompt }).then((res) => res.data),
  vocabulary: (prompt) => api.post('/api/ai/vocabulary', { prompt }).then((res) => res.data),
  improveSentence: (prompt) => api.post('/api/ai/improve-sentence', { prompt }).then((res) => res.data),
  speakingFeedback: (prompt) => api.post('/api/ai/speaking-feedback', { prompt }).then((res) => res.data),
  lessonQuiz: (prompt) => api.post('/api/ai/lesson-quiz', { prompt }).then((res) => res.data),
  lessonTutor: (prompt) => api.post('/api/ai/lesson-tutor', { prompt }).then((res) => res.data),
};

export const chatService = {
  history: () => api.get('/api/chat/history').then((res) => res.data),
  detail: (id) => api.get(`/api/chat/session/${id}`).then((res) => res.data),
  start: (mode) => api.post('/api/chat/start', { mode }).then((res) => res.data),
  send: (sessionId, message, voiceEnabled, level) => api.post('/api/chat/message', { sessionId, message, voiceEnabled, level }).then((res) => res.data),
  deleteSession: (id) => api.delete(`/api/chat/session/${id}`).then((res) => res.data),
  rename: (id, title) => api.put(`/api/chat/session/${id}/rename`, { title }).then((res) => res.data),
  toggleBookmark: (messageId) => api.post(`/api/chat/bookmark/${messageId}`).then((res) => res.data),
  bookmarks: () => api.get('/api/chat/bookmarks').then((res) => res.data),
  getHints: (id) => api.get(`/api/chat/hint/${id}`).then((res) => res.data),
  finish: (id) => api.post(`/api/chat/session/${id}/finish`).then((res) => res.data),
  clearAll: () => api.delete('/api/chat/clear-all').then((res) => res.data),
};

export const speechService = {
  speechToText: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/speech/speech-to-text', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },
  pronunciation: (text) => api.post('/api/speech/pronunciation', { text }).then((res) => res.data),
};

export const speakingService = {
  create: (payload) => api.post('/api/speaking/create', payload).then((res) => res.data),
  all: () => api.get('/api/speaking/get-all-sessions').then((res) => res.data),
  // Phase 2 — Speaking Practice endpoints
  start: (payload) => api.post('/api/speaking/start', payload).then((res) => res.data),
  sendMessage: (payload) => api.post('/api/speaking/message', payload).then((res) => res.data),
  end: (id) => api.post(`/api/speaking/end/${id}`).then((res) => res.data),
  history: () => api.get('/api/speaking/history').then((res) => res.data),
  detail: (id) => api.get(`/api/speaking/session/${id}`).then((res) => res.data),
  remove: (id) => api.delete(`/api/speaking/${id}`).then((res) => res.data),
  deleteHistory: (id) => api.delete(`/api/speaking/${id}`).then((res) => res.data),
  deleteSession: (id) => api.delete(`/api/speaking/${id}`).then((res) => res.data),
  getHints: (id) => api.get(`/api/speaking/hint/${id}`).then((res) => res.data),
};

export const progressService = {
  get: () =>
    api.get('/api/progress/get-progress')
      .then((res) => res.data)
      .catch((error) => {
        // Safe default only for new learners whose progress record does not exist yet (404/204)
        if (error.response?.status === 404 || error.response?.status === 204) {
          return {
            xp: 0,
            level: 1,
            currentStreak: 0,
            longestStreak: 0,
            totalPracticeMinutes: 0,
            totalSpeakingSessions: 0,
            totalGrammarChecks: 0,
            totalVocabularyWords: 0,
          };
        }
        // Preserve error state for server failure or network outages so UI can show error
        throw error;
      }),
  create: (payload) => api.post('/api/progress/create-progress', payload).then((res) => res.data),
  update: (payload) => api.put('/api/progress/update-progress', payload).then((res) => res.data),
  buyFreeze: () => api.post('/api/progress/buy-freeze').then((res) => res.data),
  useFreeze: () => api.post('/api/progress/use-freeze').then((res) => res.data),
  leaderboard: (limit = 10) => optionalGet(`/api/progress/leaderboard?limit=${limit}`, []),
};

export const achievementService = {
  all: () => api.get('/api/achievement/get-all-achievements').then((res) => res.data),
  unlocked: () => api.get('/api/achievement/get-unlocked-achievements').then((res) => res.data),
};

export const notificationService = {
  all: () => api.get('/api/notification/get-all-notifications').then((res) => res.data),
  unread: () => api.get('/api/notification/get-unread-notifications').then((res) => res.data),
  countUnread: () => api.get('/api/notification/count-unread').then((res) => res.data),
  markAsRead: (id) => api.put(`/api/notification/mark-as-read/${id}`).then((res) => res.data),
  markAllRead: () => api.put('/api/notification/mark-all-read').then((res) => res.data),
  delete: (id) => api.delete(`/api/notification/delete-notification/${id}`).then((res) => res.data),
  clearAll: () => api.delete('/api/notification/clear-all').then((res) => res.data),
  create: (title, message) => api.post('/api/notification/create-notification', { title, message, isRead: false }).then((res) => res.data),
};

export const dashboardService = {
  summary: () => optionalGet('/api/dashboard/summary', null),
  recentActivity: () => optionalGet('/api/activity/recent', []),
  weeklyProgress: (days = 7) => optionalGet(`/api/dashboard/rhythm?days=${days}`, []),
  rhythm: (days = 7) => optionalGet(`/api/dashboard/rhythm?days=${days}`, []),
  dailyGoal: () => optionalGet('/api/dashboard/daily-goal', null),
  statistics: () => optionalGet('/api/dashboard/statistics', null),
  quote: () => optionalGet('/api/dashboard/quote', null),
};

export const assignmentService = {
  myAssignments: () => optionalGet('/api/v1/student/assignments', [
    {
      id: 101,
      title: 'Practice Job Interview Conversation',
      description: 'Complete 15 minutes of speaking practice on the Job Interview scenario with a minimum 70% score.',
      type: 'Speaking Session',
      targetId: 'job_interview',
      targetMinutes: 15,
      minimumScore: 70,
      dueDate: 'Tomorrow',
      dueDateRaw: '2026-08-01',
      className: 'Grade 10-A',
      teacherName: 'Prof. Sharma',
      status: 'PENDING',
      score: null,
    },
    {
      id: 102,
      title: 'Master Present Tenses Lesson',
      description: 'Read lesson sections and complete 3-level quiz with score > 80%.',
      type: 'Lesson',
      targetId: 1,
      targetMinutes: 10,
      minimumScore: 80,
      dueDate: 'In 3 Days',
      dueDateRaw: '2026-08-03',
      className: 'Grade 10-A',
      teacherName: 'Prof. Sharma',
      status: 'SUBMITTED',
      score: 88,
    },
    {
      id: 103,
      title: 'Daily Vocabulary Review',
      description: 'Review 10 vocabulary words and take the quiz.',
      type: 'Vocabulary Quiz',
      targetId: 'vocab_quiz',
      targetMinutes: 5,
      minimumScore: 75,
      dueDate: '31 July',
      dueDateRaw: '2026-07-31',
      className: 'Grade 10-A',
      teacherName: 'Prof. Sharma',
      status: 'PENDING',
      score: null,
    }
  ]),
  submit: (id, payload) => api.post(`/api/v1/student/assignments/${id}/complete`, payload).then((r) => r.data).catch(() => ({ success: true })),
};

export const announcementService = {
  list: () => optionalGet('/api/v1/school/announcements', [
    {
      id: 201,
      title: 'Grade 8-B Speaking Assessment Due Tomorrow 🚨',
      content: 'All students of Grade 8-B must complete the Assigned Job Interview conversation before 5 PM tomorrow.',
      sender: 'Principal / School Admin',
      timestamp: '2 hours ago',
      targetClass: 'Grade 8-B',
      isUrgent: true,
    },
    {
      id: 202,
      title: 'Weekly English Challenge Available 🏆',
      content: 'Earn 100 bonus XP by maintaining a 5-day practice streak this week!',
      sender: 'English Department',
      timestamp: 'Yesterday',
      targetClass: 'Entire School',
      isUrgent: false,
    }
  ]),
};
