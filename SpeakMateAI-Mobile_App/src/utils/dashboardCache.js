import AsyncStorage from '@react-native-async-storage/async-storage';

const DASHBOARD_CACHE_PREFIX = 'speakmate_dashboard_summary_cache_';
const RHYTHM_CACHE_PREFIX = 'speakmate_rhythm_cache_';

// In-memory cache + persistent disk cache to make dashboard load instantly (0ms) on cold & warm starts
let cachedDashboardData = null;
let cachedUserId = null;

// In-memory cache + persistent disk cache for rhythm data ('7d' and '30d')
let cachedRhythmData = { '7d': null, '30d': null };
let cachedRhythmUserId = null;

export const RhythmCache = {
  init: async (userId) => {
    try {
      cachedRhythmUserId = userId || null;
      const key7d = `${RHYTHM_CACHE_PREFIX}7d_${userId || 'default'}`;
      const key30d = `${RHYTHM_CACHE_PREFIX}30d_${userId || 'default'}`;
      const [raw7d, raw30d] = await Promise.all([
        AsyncStorage.getItem(key7d),
        AsyncStorage.getItem(key30d),
      ]);
      if (raw7d) {
        try {
          const parsed7d = JSON.parse(raw7d);
          if (Array.isArray(parsed7d) && parsed7d.length > 0) cachedRhythmData['7d'] = parsed7d;
        } catch (_) {}
      }
      if (raw30d) {
        try {
          const parsed30d = JSON.parse(raw30d);
          if (Array.isArray(parsed30d) && parsed30d.length > 0) cachedRhythmData['30d'] = parsed30d;
        } catch (_) {}
      }
    } catch (e) {
      console.warn('RhythmCache.init error:', e);
    }
    return cachedRhythmData;
  },
  get: (timeframe, userId) => {
    if (userId && cachedRhythmUserId && String(cachedRhythmUserId) !== String(userId)) {
      return null;
    }
    return cachedRhythmData[timeframe] || null;
  },
  getAll: (userId) => {
    if (userId && cachedRhythmUserId && String(cachedRhythmUserId) !== String(userId)) {
      return { '7d': null, '30d': null };
    }
    return cachedRhythmData;
  },
  set: (timeframe, data, userId) => {
    if (!data || !Array.isArray(data)) return;
    if (userId) cachedRhythmUserId = userId;
    cachedRhythmData[timeframe] = data;
    try {
      const key = `${RHYTHM_CACHE_PREFIX}${timeframe}_${userId || cachedRhythmUserId || 'default'}`;
      AsyncStorage.setItem(key, JSON.stringify(data)).catch((err) => {
        console.warn('RhythmCache disk save error:', err);
      });
    } catch (_) {}
  },
  clearMemory: () => {
    cachedRhythmData = { '7d': null, '30d': null };
    cachedRhythmUserId = null;
  },
  clear: (userId) => {
    cachedRhythmData = { '7d': null, '30d': null };
    cachedRhythmUserId = null;
    if (userId) {
      AsyncStorage.removeItem(`${RHYTHM_CACHE_PREFIX}7d_${userId}`).catch(() => {});
      AsyncStorage.removeItem(`${RHYTHM_CACHE_PREFIX}30d_${userId}`).catch(() => {});
    }
  },
};

export const DashboardCache = {
  init: async (userId) => {
    try {
      RhythmCache.init(userId).catch(() => {});
      const key = `${DASHBOARD_CACHE_PREFIX}${userId || 'default'}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) {
          cachedDashboardData = parsed;
          cachedUserId = userId || null;
          if (Array.isArray(parsed.weeklyProgress) && parsed.weeklyProgress.length > 0) {
            RhythmCache.set('7d', parsed.weeklyProgress, userId);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('DashboardCache.init error:', e);
    }
    return cachedDashboardData;
  },
  get: (userId) => {
    if (userId && cachedUserId && String(cachedUserId) !== String(userId)) {
      return null;
    }
    return cachedDashboardData;
  },
  set: (data, userId) => {
    if (!data) return;
    cachedDashboardData = data;
    if (userId) cachedUserId = userId;
    if (Array.isArray(data.weeklyProgress) && data.weeklyProgress.length > 0) {
      RhythmCache.set('7d', data.weeklyProgress, userId || cachedUserId);
    }
    try {
      const key = `${DASHBOARD_CACHE_PREFIX}${userId || cachedUserId || 'default'}`;
      AsyncStorage.setItem(key, JSON.stringify(data)).catch((err) => {
        console.warn('DashboardCache disk save error:', err);
      });
    } catch (_) {}
  },
  updateProfileAvatar: (avatar) => {
    if (cachedDashboardData && cachedDashboardData.profile) {
      cachedDashboardData.profile.avatar = avatar;
      if (cachedUserId) {
        DashboardCache.set(cachedDashboardData, cachedUserId);
      }
    }
  },
  clearMemory: () => {
    cachedDashboardData = null;
    cachedUserId = null;
    RhythmCache.clearMemory();
  },
  clear: (userId) => {
    cachedDashboardData = null;
    cachedUserId = null;
    RhythmCache.clear(userId);
    if (userId) {
      AsyncStorage.removeItem(`${DASHBOARD_CACHE_PREFIX}${userId}`).catch(() => {});
    }
  },
};

// In-memory cache for lessons and continue-learning items to prevent stale flashing
let cachedContinueItems = null;
let cachedLessonsList = null;
let cachedCompletedSet = new Set();
let cachedCurriculumUserId = null;
let cachedCurriculumGrade = null;
let cachedCurriculumAccountType = null;
let cachedCurriculumAgeGroup = null;

export const CurriculumCache = {
  getGrade: () => cachedCurriculumGrade,
  setGrade: (grade) => {
    cachedCurriculumGrade = grade;
  },
  getAccountType: () => cachedCurriculumAccountType,
  setAccountType: (type) => {
    cachedCurriculumAccountType = type;
  },
  getAgeGroup: () => cachedCurriculumAgeGroup,
  setAgeGroup: (age) => {
    cachedCurriculumAgeGroup = age;
  },
  getContinueItems: (userId, grade, allowedCurriculum = null) => {
    if (userId && cachedCurriculumUserId && String(cachedCurriculumUserId) !== String(userId)) return null;
    if (grade && cachedCurriculumGrade && String(cachedCurriculumGrade).toLowerCase() !== String(grade).toLowerCase()) return null;
    if (!cachedContinueItems || !Array.isArray(cachedContinueItems)) return null;

    if (allowedCurriculum && Array.isArray(allowedCurriculum) && allowedCurriculum.length > 0) {
      const allowedTitles = new Set(allowedCurriculum.map(l => (l.title || '').trim().toLowerCase()));
      const valid = cachedContinueItems.filter(item => {
        const t = (item?.title || item?.lessonTitle || '').trim().toLowerCase();
        return allowedTitles.has(t);
      });
      return valid.length > 0 ? valid : null;
    }
    return cachedContinueItems;
  },
  setContinueItems: (a, b, c) => {
    let items, userId, grade;
    if (Array.isArray(a)) {
      items = a;
      userId = b;
      grade = c;
    } else {
      userId = a;
      grade = b;
      items = c;
    }
    cachedContinueItems = items || [];
    if (userId) cachedCurriculumUserId = userId;
    if (grade) cachedCurriculumGrade = grade;
  },
  getLessons: (userId, grade) => {
    if (userId && cachedCurriculumUserId && String(cachedCurriculumUserId) !== String(userId)) return null;
    if (grade && cachedCurriculumGrade && String(cachedCurriculumGrade).toLowerCase() !== String(grade).toLowerCase()) return null;
    return cachedLessonsList;
  },
  setLessons: (a, b, c) => {
    let lessons, userId, grade;
    if (Array.isArray(a)) {
      lessons = a;
      userId = b;
      grade = c;
    } else {
      userId = a;
      grade = b;
      lessons = c;
    }
    cachedLessonsList = lessons || [];
    if (userId) cachedCurriculumUserId = userId;
    if (grade) cachedCurriculumGrade = grade;
  },
  getCompletedSet: () => cachedCompletedSet,
  setCompletedSet: (set) => {
    cachedCompletedSet = set instanceof Set ? set : new Set(set || []);
  },
  markLessonCompleted: (lessonId, lessonTitle) => {
    const idKey = String(lessonId || '').toLowerCase();
    const titleKey = (lessonTitle || '').trim().toLowerCase();
    if (idKey) cachedCompletedSet.add(idKey);
    if (titleKey) cachedCompletedSet.add(titleKey);

    // Remove completed lesson from cached continue items
    if (cachedContinueItems && Array.isArray(cachedContinueItems)) {
      cachedContinueItems = cachedContinueItems.filter(item => {
        const iId = String(item.id || item.lessonId || '').toLowerCase();
        const iTitle = (item.title || item.lessonTitle || '').trim().toLowerCase();
        if (idKey && iId === idKey) return false;
        if (titleKey && iTitle === titleKey) return false;
        return true;
      });
    }

    // Update in cached lessons list
    if (cachedLessonsList && Array.isArray(cachedLessonsList)) {
      cachedLessonsList = cachedLessonsList.map(item => {
        const iId = String(item.id || '').toLowerCase();
        const iTitle = (item.title || '').trim().toLowerCase();
        if ((idKey && iId === idKey) || (titleKey && iTitle === titleKey)) {
          return { ...item, completed: true, progressPercent: 100 };
        }
        return item;
      });
    }
  },
  updateLessonProgress: (lessonId, lessonTitle, progressPercent, extraData = {}) => {
    const idKey = String(lessonId || '').toLowerCase();
    const titleKey = (lessonTitle || '').trim().toLowerCase();

    // Update in cached lessons list
    if (cachedLessonsList && Array.isArray(cachedLessonsList)) {
      cachedLessonsList = cachedLessonsList.map(item => {
        const iId = String(item.id || '').toLowerCase();
        const iTitle = (item.title || '').trim().toLowerCase();
        if ((idKey && iId === idKey) || (titleKey && iTitle === titleKey)) {
          return { ...item, progressPercent, ...extraData };
        }
        return item;
      });
    }

    // Update in cached continue items
    if (!cachedContinueItems || !Array.isArray(cachedContinueItems)) {
      cachedContinueItems = [];
    }

    let found = false;
    cachedContinueItems = cachedContinueItems.map(item => {
      const iId = String(item.id || item.lessonId || '').toLowerCase();
      const iTitle = (item.title || item.lessonTitle || '').trim().toLowerCase();
      if ((idKey && iId === idKey) || (titleKey && iTitle === titleKey)) {
        found = true;
        return { ...item, progressPercent, ...extraData };
      }
      return item;
    });
    if (!found) {
      cachedContinueItems.unshift({
        id: lessonId,
        title: extraData.title || lessonTitle,
        progressPercent,
        ...extraData,
      });
    }
  },
  clear: () => {
    cachedContinueItems = null;
    cachedLessonsList = null;
    cachedCompletedSet = new Set();
    cachedCurriculumUserId = null;
    cachedCurriculumGrade = null;
    cachedCurriculumAccountType = null;
    cachedCurriculumAgeGroup = null;
  },
};

export default DashboardCache;
