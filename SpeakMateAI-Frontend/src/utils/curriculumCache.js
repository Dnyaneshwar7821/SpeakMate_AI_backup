/**
 * curriculumCache.js
 * In-memory and localStorage cache for web lessons and continue-learning.
 * Guarantees ZERO latency (0ms) and prevents stale data flashing/jumping across route changes.
 */

function getInProgressStorageKey(userId) {
  let id = userId;
  if (!id && typeof window !== "undefined") {
    try {
      const u = JSON.parse(localStorage.getItem("speakmate_user") || "{}");
      id = u?.id || u?.email;
    } catch {}
  }
  return `speakmate_in_progress_lessons_${id || 'guest'}`;
}

function getCompletedStorageKey(userId) {
  let id = userId;
  if (!id && typeof window !== "undefined") {
    try {
      const u = JSON.parse(localStorage.getItem("speakmate_user") || "{}");
      id = u?.id || u?.email;
    } catch {}
  }
  return `speakmate_completed_lessons_${id || 'guest'}`;
}

const _continueItemsMap = new Map();
const _lessonsMap = new Map();
let _completedSet = new Set();
let _completedSetLoaded = false;

function getCacheKey(userId, profileKey) {
  return `${userId || 'guest'}_${(profileKey || 'default').toLowerCase().trim()}`;
}

function loadInitialCompletedSet(userId = null) {
  if (_completedSetLoaded) return _completedSet;
  try {
    const raw = localStorage.getItem(getCompletedStorageKey(userId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        _completedSet = new Set(arr.map((x) => String(x).toLowerCase().trim()));
      }
    }
  } catch (e) {
    // ignore
  }
  _completedSetLoaded = true;
  return _completedSet;
}

export function areListsIdentical(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (!itemA || !itemB) return false;
    if (String(itemA.id || '') !== String(itemB.id || '')) return false;
    if ((itemA.title || '').trim() !== (itemB.title || '').trim()) return false;
    if (Boolean(itemA.completed) !== Boolean(itemB.completed)) return false;
    if (Boolean(itemA.locked) !== Boolean(itemB.locked)) return false;
    if (Number(itemA.progressPercent || 0) !== Number(itemB.progressPercent || 0)) return false;
  }
  return true;
}

export const CurriculumCache = {
  getContinueItems(userId, profileKey, allowedCurriculum = null) {
    const key = getCacheKey(userId, profileKey);
    const allowedTitles = allowedCurriculum && Array.isArray(allowedCurriculum) && allowedCurriculum.length > 0
      ? new Set(allowedCurriculum.map((l) => (l.title || '').toLowerCase().trim()))
      : null;

    if (_continueItemsMap.has(key)) {
      const items = _continueItemsMap.get(key);
      if (allowedTitles && items && Array.isArray(items)) {
        const valid = items.filter((x) => x && allowedTitles.has((x.title || '').toLowerCase().trim()));
        if (valid.length > 0) return valid;
      } else if (items && items.length > 0) {
        return items;
      }
    }
    // Attempt hydration from localStorage
    try {
      const raw = localStorage.getItem(getInProgressStorageKey(userId));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          const completedSet = loadInitialCompletedSet();
          const filtered = arr.filter((item) => {
            if (!item) return false;
            const tKey = (item.title || '').toLowerCase().trim();
            const idKey = String(item.id || '').toLowerCase();
            if (allowedTitles && !allowedTitles.has(tKey)) return false;
            return !completedSet.has(tKey) && !completedSet.has(idKey) && !item.completed && (item.progressPercent || 0) < 100;
          });
          if (filtered.length > 0) {
            _continueItemsMap.set(key, filtered);
            return filtered;
          }
        }
      }
    } catch (_) {}
    return null;
  },

  setContinueItems(userId, profileKey, items) {
    const key = getCacheKey(userId, profileKey);
    _continueItemsMap.set(key, items || []);
  },

  getLessons(userId, profileKey) {
    const key = getCacheKey(userId, profileKey);
    return _lessonsMap.get(key) || null;
  },

  setLessons(userId, profileKey, lessons) {
    const key = getCacheKey(userId, profileKey);
    _lessonsMap.set(key, lessons || []);
  },

  getCompletedSet() {
    return loadInitialCompletedSet();
  },

  setCompletedSet(setOrArray) {
    _completedSetLoaded = true;
    if (setOrArray instanceof Set) {
      _completedSet = setOrArray;
    } else if (Array.isArray(setOrArray)) {
      _completedSet = new Set(setOrArray.map((x) => String(x).toLowerCase().trim()));
    }
    try {
      localStorage.setItem(getCompletedStorageKey(), JSON.stringify(Array.from(_completedSet)));
    } catch (_) {}
  },

  updateLessonProgress(lessonId, lessonTitle, progressPercent, category, level, xpReward, duration) {
    const completedSet = loadInitialCompletedSet();
    const titleKey = (lessonTitle || '').toLowerCase().trim();
    const idKey = String(lessonId || '').toLowerCase();

    // If already completed or >= 100%, mark complete instead
    if (progressPercent >= 100) {
      this.markLessonCompleted(lessonId, lessonTitle);
      return;
    }

    const prog = Math.min(99, Math.max(11, progressPercent || 11));

    // Update in-memory continue items across all active keys
    _continueItemsMap.forEach((items, key) => {
      const idx = items.findIndex(
        (x) =>
          (titleKey && (x.title || '').toLowerCase().trim() === titleKey) ||
          (idKey && String(x.id || '').toLowerCase() === idKey)
      );
      if (idx !== -1) {
        items[idx] = {
          ...items[idx],
          progressPercent: prog,
        };
      } else {
        items.unshift({
          id: lessonId,
          title: lessonTitle,
          category: category || 'General',
          level: level || 'Beginner',
          xpReward: xpReward || 35,
          estimatedMinutes: duration || 15,
          progressPercent: prog,
        });
      }
      _continueItemsMap.set(key, [...items]);
    });

    // Update in-memory lesson lists across keys
    _lessonsMap.forEach((lessons, key) => {
      const idx = lessons.findIndex(
        (l) =>
          (titleKey && (l.title || '').toLowerCase().trim() === titleKey) ||
          (idKey && String(l.id || '').toLowerCase() === idKey)
      );
      if (idx !== -1) {
        lessons[idx] = {
          ...lessons[idx],
          progressPercent: prog,
        };
        _lessonsMap.set(key, [...lessons]);
      }
    });

    // Sync to localStorage
    try {
      const raw = localStorage.getItem(getInProgressStorageKey());
      let inProg = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(inProg)) inProg = [];
      const existingIdx = inProg.findIndex(
        (x) =>
          (titleKey && (x.title || '').toLowerCase().trim() === titleKey) ||
          (idKey && String(x.id || '').toLowerCase() === idKey)
      );
      const itemToSave = {
        id: lessonId,
        title: lessonTitle,
        category: category || 'General',
        level: level || 'Beginner',
        xpReward: xpReward || 35,
        estimatedMinutes: duration || 15,
        progressPercent: prog,
        lastOpenedAt: new Date().toISOString(),
      };
      if (existingIdx !== -1) {
        inProg[existingIdx] = { ...inProg[existingIdx], ...itemToSave };
      } else {
        inProg.unshift(itemToSave);
      }
      localStorage.setItem(getInProgressStorageKey(), JSON.stringify(inProg));
    } catch (_) {}
  },

  markLessonCompleted(lessonId, lessonTitle) {
    const completedSet = loadInitialCompletedSet();
    const titleKey = (lessonTitle || '').toLowerCase().trim();
    const idKey = String(lessonId || '').toLowerCase();

    if (idKey) completedSet.add(idKey);
    if (titleKey) completedSet.add(titleKey);
    this.setCompletedSet(completedSet);

    // Remove from in-memory continue items
    _continueItemsMap.forEach((items, key) => {
      const filtered = items.filter((x) => {
        const t = (x.title || '').toLowerCase().trim();
        const id = String(x.id || '').toLowerCase();
        return t !== titleKey && id !== idKey;
      });
      _continueItemsMap.set(key, filtered);
    });

    // Mark completed in in-memory lessons
    _lessonsMap.forEach((lessons, key) => {
      const updated = lessons.map((l) => {
        const t = (l.title || '').toLowerCase().trim();
        const id = String(l.id || '').toLowerCase();
        if (t === titleKey || id === idKey) {
          return { ...l, completed: true, progressPercent: 100 };
        }
        return l;
      });
      _lessonsMap.set(key, updated);
    });

    // Remove from localStorage in-progress list
    try {
      const raw = localStorage.getItem(getInProgressStorageKey());
      if (raw) {
        const inProg = JSON.parse(raw);
        if (Array.isArray(inProg)) {
          const filtered = inProg.filter((x) => {
            const t = (x.title || '').toLowerCase().trim();
            const id = String(x.id || '').toLowerCase();
            return t !== titleKey && id !== idKey;
          });
          localStorage.setItem(getInProgressStorageKey(), JSON.stringify(filtered));
        }
      }
    } catch (_) {}

    // Instantly notify React components across the app of completion
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("speakmate_curriculum_updated", {
          detail: { lessonId, lessonTitle, completed: true },
        })
      );
      window.dispatchEvent(new CustomEvent("speakmate_progress_updated"));
    }
  },

  clear(broadcast = false) {
    _continueItemsMap.clear();
    _lessonsMap.clear();
    _completedSet.clear();
    _completedSetLoaded = false;
    if (broadcast && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("speakmate_curriculum_updated", { detail: { cleared: true } }));
    }
  },
};

export default CurriculumCache;
