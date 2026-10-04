/**
 * LessonsScreen — Phase 2
 * Full-featured lesson browser: categories, difficulty tabs, search,
 * continue-learning, recommended, lesson cards, filters.
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lessonModuleService } from '../../services/appServices';
import { COLORS } from '../../constants/colors';
import { STANDARD_LESSONS, GENERAL_LESSONS, MASTER_LESSONS } from '../../constants/standardLessons';
import { CurriculumCache } from '../../utils/dashboardCache';

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTINUE_CARD_WIDTH = Math.min(340, Math.round(SCREEN_WIDTH * 0.84));

const DIFFICULTY_TABS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const DIFF_COLORS = {
  Beginner: { bg: '#DCFCE7', text: '#16A34A' },
  Intermediate: { bg: '#FEF9C3', text: '#CA8A04' },
  Advanced: { bg: '#FEE2E2', text: '#DC2626' },
};

const CATEGORY_COLORS = [
  ['#4F46E5', '#7C3AED'],
  ['#0EA5E9', '#0284C7'],
  ['#10B981', '#059669'],
  ['#F59E0B', '#D97706'],
  ['#EF4444', '#DC2626'],
  ['#8B5CF6', '#7C3AED'],
  ['#06B6D4', '#0891B2'],
  ['#F97316', '#EA580C'],
  ['#EC4899', '#DB2777'],
  ['#84CC16', '#65A30D'],
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonBox({ width, height, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: 8, backgroundColor: '#E2E8F0', opacity }, style]}
    />
  );
}

function LessonSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[styles.cardOuter, { backgroundColor: theme.cardBg }]}>
      <SkeletonBox width="100%" height={120} style={{ borderRadius: 16, marginBottom: 12 }} />
      <SkeletonBox width="70%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonBox width="50%" height={10} />
    </View>
  );
}

const DifficultyBadge = React.memo(function DifficultyBadge({ level }) {
  if (!level) return null;
  const c = DIFF_COLORS[level] || { bg: '#F1F5F9', text: '#64748B' };
  return (
    <View style={[styles.diffBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.diffBadgeText, { color: c.text }]}>{level}</Text>
    </View>
  );
});

const ProgressRing = React.memo(function ProgressRing({ percent = 0, size = 44 }) {
  const { isDark } = useTheme();
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (percent / 100) * circ;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: isDark ? '#334155' : '#E2E8F0',
          position: 'absolute',
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: percent > 0 ? COLORS.primary : 'transparent',
          position: 'absolute',
          borderRightColor: 'transparent',
          borderBottomColor: percent < 50 ? 'transparent' : COLORS.primary,
          transform: [{ rotate: `${(percent / 100) * 360 - 90}deg` }],
        }}
      />
      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.primary }}>{percent}%</Text>
    </View>
  );
});

const CategoryCard = React.memo(function CategoryCard({ item, index, onPress }) {
  const [start, end] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  const scale = useRef(new Animated.Value(1)).current;
  const pIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const pOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={pIn} onPressOut={pOut}>
        <LinearGradient colors={[start, end]} style={styles.catCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.catIconCircle}>
            <Ionicons name={item.icon} size={22} color="#FFF" />
          </View>
          <Text style={styles.catName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.catLessons}>{item.lessonCount} lessons</Text>
          {item.completedCount > 0 && (
            <View style={styles.catProgress}>
              <View
                style={[
                  styles.catProgressFill,
                  { width: `${Math.round((item.completedCount / item.lessonCount) * 100)}%` },
                ]}
              />
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
});

const LessonCard = React.memo(function LessonCard({ lesson, onPress }) {
  const { isDark, theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const pIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const pOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const prog = lesson.progressPercent || 0;
  const isCompleted = lesson.completed;
  const isLocked = lesson.locked;

  const btnLabel = isLocked ? 'Locked' : isCompleted ? 'Review' : prog > 0 ? 'Resume' : 'Start';
  const btnColor = isLocked ? '#9CA3AF' : isCompleted ? COLORS.success : COLORS.primary;

  const handlePress = useCallback(() => {
    if (!isLocked && onPress) {
      onPress(lesson);
    }
  }, [isLocked, lesson, onPress]);

  return (
    <Animated.View style={[styles.cardOuter, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: isDark ? 1 : 0 }, { transform: [{ scale }] }]}>
      <Pressable onPress={isLocked ? undefined : handlePress} onPressIn={pIn} onPressOut={pOut}>
        {/* Gradient header band */}
        <LinearGradient
          colors={isLocked ? ['#94A3B8', '#64748B'] : ['#4F46E5', '#7C3AED']}
          style={styles.cardBand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {isLocked && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={28} color="rgba(255,255,255,0.9)" />
            </View>
          )}
          <View style={styles.cardBandRow}>
            <View style={styles.catChip}>
              <Text style={styles.catChipText}>{lesson.category}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={styles.completedBadgeText}>Completed</Text>
                </View>
              )}
              <View style={styles.xpChip}>
                <Ionicons name="star" size={12} color="#FCD34D" />
                <Text style={styles.xpChipText}>{lesson.xpReward || 0} XP</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Card body */}
        <View style={styles.cardBody}>
          <View style={styles.cardBodyTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={2}>{lesson.title}</Text>
              <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>{lesson.description}</Text>
            </View>
            {prog > 0 && <ProgressRing percent={prog} />}
          </View>

          <View style={styles.cardMeta}>
            <DifficultyBadge level={lesson.level} />
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>{lesson.estimatedMinutes || lesson.duration || '—'} min</Text>
            </View>
            {isLocked && lesson.requiredXP > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="lock-closed-outline" size={13} color={theme.textSecondary} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>{lesson.requiredXP} XP needed</Text>
              </View>
            )}
          </View>

          {prog > 0 && !isCompleted && (
            <View style={[styles.progressBarBg, isDark && { backgroundColor: '#334155' }]}>
              <View style={[styles.progressBarFill, { width: `${prog}%` }]} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.cardBtn, { backgroundColor: btnColor, opacity: isLocked ? 0.6 : 1 }]}
            onPress={isLocked ? undefined : handlePress}
            activeOpacity={0.8}
          >
            {isLocked && <Ionicons name="lock-closed" size={14} color="#FFF" style={{ marginRight: 4 }} />}
            <Text style={styles.cardBtnText}>{btnLabel}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const ContinueLearningCard = React.memo(function ContinueLearningCard({ lesson, onPress }) {
  const percent = Math.min(100, Math.max(10, lesson.progressPercent || 11));
  return (
    <TouchableOpacity style={styles.continueCard} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.continueGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.continueLeft}>
          <View style={styles.continueBadgeRow}>
            <Text style={styles.continueLabel}>Continue Learning</Text>
            <View style={styles.continueProgressBadge}>
              <Text style={styles.continueProgressBadgeText}>{percent}%</Text>
            </View>
          </View>
          <Text style={styles.continueTitle} numberOfLines={1}>{lesson.title}</Text>
          <Text style={styles.continueCat}>{lesson.category} · {lesson.level || lesson.difficulty || 'All Levels'}</Text>
          <View style={styles.continueMeta}>
            <Ionicons name="star" size={13} color="#FCD34D" />
            <Text style={styles.continueXP}>{lesson.xpReward || 35} XP</Text>
            <Text style={styles.continueDot}>·</Text>
            <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.continueTime}>{lesson.estimatedMinutes || lesson.duration || 15} min</Text>
          </View>
          <View style={styles.continueProg}>
            <View style={[styles.continueProgFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.continueProgText}>{percent}% complete</Text>
        </View>
        <View style={styles.continueRight}>
          <View style={styles.continuePlayBtn}>
            <Ionicons name="play" size={22} color={COLORS.primary} />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const SectionHeader = React.memo(function SectionHeader({ title, subtitle, onSeeAll }) {
  const { theme } = useTheme();
  return (
    <View style={styles.secHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.secTitle, { color: theme.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.secSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const EmptyState = React.memo(function EmptyState({ icon = 'search-outline', title, message }) {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={48} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{title}</Text>
      {message && <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>{message}</Text>}
    </View>
  );
});

// Helper to normalize grade key into standard curriculum keys
const normalizeGradeKey = (grade) => {
  if (!grade) return '1st Std';
  const str = String(grade).trim();
  if (!str) return '1st Std';
  if (STANDARD_LESSONS[str]) return str;
  const numMatch = str.match(/\b(10|[1-9])\b/) || str.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
    const key = `${num}${suffix} Std`;
    if (STANDARD_LESSONS[key]) return key;
  }
  return '1st Std';
};

// Helper to get curriculum tailored to student grade or general age group
const getProfileCurriculum = (user, savedGrade, savedAccType, savedAgeGroup) => {
  const cachedGrade = CurriculumCache.getGrade();
  const cachedAccType = CurriculumCache.getAccountType();
  const cachedAgeGroup = CurriculumCache.getAgeGroup();

  const isStudent = Boolean(
    savedAccType === 'STUDENT' ||
    cachedAccType === 'STUDENT' ||
    user?.accountType === 'STUDENT' ||
    user?.role === 'STUDENT' ||
    user?.isSchoolStudent ||
    user?.schoolId ||
    user?.schoolCode ||
    user?.schoolGrade ||
    user?.standard ||
    savedGrade ||
    cachedGrade
  );

  if (isStudent) {
    const rawGrd = savedGrade || cachedGrade || user?.schoolGrade || user?.standard || user?.grade;
    const grade = normalizeGradeKey(rawGrd);
    return {
      curriculum: STANDARD_LESSONS[grade] || STANDARD_LESSONS['1st Std'],
      isStudent: true,
      grade,
      ageGroup: null,
    };
  }

  const rawAge = String(savedAgeGroup || cachedAgeGroup || user?.ageGroup || 'Professional').toLowerCase();
  let targetGroup = 'Professionals & Seniors (Age 25+)';
  if (rawAge.includes('kid') || rawAge.includes('6-12')) {
    targetGroup = 'Kids (Age 6–12)';
  } else if (rawAge.includes('teen') || rawAge.includes('young') || rawAge.includes('13-24')) {
    targetGroup = 'Teens & Young Adults (Age 13–24)';
  }
  return {
    curriculum: GENERAL_LESSONS[targetGroup] || GENERAL_LESSONS['Professionals & Seniors (Age 25+)'],
    isStudent: false,
    grade: null,
    ageGroup: targetGroup,
  };
};

function areListsIdentical(a, b) {
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

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LessonsScreen({ navigation }) {
  const { isDark, theme } = useTheme();
  const { user } = useContext(AuthContext);

  const initialProfile = useMemo(
    () => getProfileCurriculum(user),
    [user?.id, user?.schoolGrade, user?.standard, user?.ageGroup, user?.accountType, user?.role]
  );
  const initialProfileKey = initialProfile.grade || initialProfile.ageGroup;

  const [categories, setCategories] = useState(() => {
    const catCounts = {};
    initialProfile.curriculum.forEach((l) => {
      const c = l.category || 'General';
      catCounts[c] = (catCounts[c] || 0) + 1;
    });
    return Object.keys(catCounts).map((catName) => ({
      name: catName,
      lessonCount: catCounts[catName],
      completedCount: 0,
      icon: 'book-outline',
    }));
  });

  const [lessons, setLessons] = useState(() => {
    const cached = CurriculumCache.getLessons(user?.id, initialProfileKey);
    return cached && cached.length > 0 ? cached : initialProfile.curriculum;
  });

  const [continueItems, setContinueItems] = useState(() => {
    const cached = CurriculumCache.getContinueItems(user?.id, initialProfileKey, initialProfile.curriculum);
    return (cached && cached.length > 0) ? cached : [];
  });

  const [recommended, setRecommended] = useState(() => initialProfile.curriculum.slice(0, 5));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('All'); // difficulty tab
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState('');

  const searchTimer = useRef(null);
  const activeSearchQueryRef = useRef('');
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const headerTranslate = useRef(new Animated.Value(0)).current;

  const [userGrade, setUserGrade] = useState(() => initialProfile.grade || '1st Std');
  const [accountType, setAccountType] = useState(() => initialProfile.isStudent ? 'STUDENT' : 'INDIVIDUAL_USER');
  const [userAgeGroup, setUserAgeGroup] = useState(() => initialProfile.ageGroup || user?.ageGroup || 'Professional');

  // React immediately whenever logged in user changes
  useEffect(() => {
    const fresh = getProfileCurriculum(user);
    setAccountType(fresh.isStudent ? 'STUDENT' : 'INDIVIDUAL_USER');
    if (fresh.grade) setUserGrade(fresh.grade);
    if (fresh.ageGroup) setUserAgeGroup(fresh.ageGroup);

    const freshKey = fresh.grade || fresh.ageGroup;
    const catCounts = {};
    fresh.curriculum.forEach((l) => {
      const c = l.category || 'General';
      catCounts[c] = (catCounts[c] || 0) + 1;
    });
    const freshCats = Object.keys(catCounts).map((catName) => ({
      name: catName,
      lessonCount: catCounts[catName],
      completedCount: 0,
      icon: 'folder-outline',
    }));
    setCategories(freshCats);

    const cachedLessons = CurriculumCache.getLessons(user?.id, freshKey);
    setLessons(cachedLessons && cachedLessons.length > 0 ? cachedLessons : fresh.curriculum);

    const cachedCont = CurriculumCache.getContinueItems(user?.id, freshKey, fresh.curriculum);
    if (cachedCont && cachedCont.length > 0) {
      setContinueItems(cachedCont);
    } else {
      setContinueItems([]);
    }
    setRecommended(fresh.curriculum.slice(0, 5));
  }, [user?.id, user?.schoolGrade, user?.standard, user?.ageGroup, user?.accountType, user?.role]);

  // ── Load data ──────────────────────────────────────────────────────
  const loadAll = useCallback(async (silent = false) => {
    if (!silent && lessons.length === 0) setLoading(true);
    setError('');
    try {
      const [cats, recs, cont, savedGrade, savedAccType, savedAgeGroup] = await Promise.all([
        lessonModuleService.categories(),
        lessonModuleService.recommended(),
        lessonModuleService.continueLearning(),
        AsyncStorage.getItem('speakmate_school_grade'),
        AsyncStorage.getItem('speakmate_account_type'),
        AsyncStorage.getItem('speakmate_age_group'),
      ]);

      const profileInfo = getProfileCurriculum(user, savedGrade, savedAccType, savedAgeGroup);
      const effAccType = profileInfo.isStudent ? 'STUDENT' : 'INDIVIDUAL_USER';
      setAccountType(effAccType);
      if (profileInfo.grade) setUserGrade(profileInfo.grade);
      if (profileInfo.ageGroup) setUserAgeGroup(profileInfo.ageGroup);

      CurriculumCache.setGrade(profileInfo.grade);
      CurriculumCache.setAccountType(effAccType);
      CurriculumCache.setAgeGroup(profileInfo.ageGroup);

      const baseCurriculum = profileInfo.curriculum;
      const profileKey = profileInfo.grade || profileInfo.ageGroup;

      // Categories from newly defined profile lessons
      const storedCompletedRaw = await AsyncStorage.getItem('speakmate_completed_standard_lessons').catch(() => null);
      const completedSet = new Set(storedCompletedRaw ? JSON.parse(storedCompletedRaw).map(x => String(x).toLowerCase()) : []);
      CurriculumCache.setCompletedSet(completedSet);

      const catCounts = {};
      const catCompletedCounts = {};
      baseCurriculum.forEach(l => {
        const c = l.category || 'General';
        catCounts[c] = (catCounts[c] || 0) + 1;
        const titleKey = (l.title || '').trim().toLowerCase();
        const idKey = String(l.id || '').toLowerCase();
        if (completedSet.has(idKey) || completedSet.has(titleKey)) {
          catCompletedCounts[c] = (catCompletedCounts[c] || 0) + 1;
        }
      });
      const curatedCategories = Object.keys(catCounts).map(catName => ({
        name: catName,
        lessonCount: catCounts[catName],
        completedCount: catCompletedCounts[catName] || 0,
        icon: 'folder-outline',
      }));
      setCategories(curatedCategories);

      // Continue learning: include ALL lessons that have been opened/started but not completed
      const storedInProgressRaw = await AsyncStorage.getItem('speakmate_in_progress_lessons').catch(() => null);
      const localInProgressList = storedInProgressRaw ? JSON.parse(storedInProgressRaw) : [];

      // Keep lessons strictly present in THIS user's 20-lesson curriculum list (not random lessons)
      const userCurriculumTitles = new Set(baseCurriculum.map(l => (l.title || '').trim().toLowerCase()));
      const userCurriculumIds = new Set(baseCurriculum.flatMap(l => [String(l.id || '').toLowerCase(), String(l.numericId || '').toLowerCase()].filter(Boolean)));

      // Sanitize stored in-progress lessons so stale cross-cluster or completed items are permanently purged
      const validLocalInProgress = localInProgressList.filter(item => {
        if (!item) return false;
        const titleKey = (item.title || '').trim().toLowerCase();
        const idKey = String(item.id || '').toLowerCase();
        const isCompleted = completedSet.has(idKey) || completedSet.has(titleKey) || Boolean(item.completed) || ((item.progressPercent || 0) >= 100);
        return userCurriculumTitles.has(titleKey) && !isCompleted;
      });
      if (validLocalInProgress.length !== localInProgressList.length) {
        AsyncStorage.setItem('speakmate_in_progress_lessons', JSON.stringify(validLocalInProgress)).catch(() => {});
      }

      // Merge backend in-progress items and sanitized local in-progress items
      const combinedCont = [...(cont || [])];
      validLocalInProgress.forEach(localItem => {
        if (!localItem) return;
        const titleKey = (localItem?.title || '').trim().toLowerCase();
        const idKey = String(localItem?.id || '');
        const existingIdx = combinedCont.findIndex(c => 
          (titleKey && (c.title || '').trim().toLowerCase() === titleKey) ||
          (idKey && String(c.id || '') === idKey)
        );
        if (existingIdx === -1) {
          combinedCont.push(localItem);
        } else if ((localItem.progressPercent || 0) > (combinedCont[existingIdx].progressPercent || 0)) {
          combinedCont[existingIdx] = { ...combinedCont[existingIdx], ...localItem };
        }
      });

      const userSpecificInProgress = combinedCont.filter(c => {
        if (!c) return false;
        const titleKey = (c.title || '').trim().toLowerCase();
        const idKey = String(c.id || '').toLowerCase();
        const numIdKey = String(c.numericId || '').toLowerCase();
        
        // Compulsion: If title is present, it MUST match the user's specific curriculum titles.
        if (titleKey) {
          return userCurriculumTitles.has(titleKey);
        }
        return userCurriculumIds.has(idKey) || (numIdKey && userCurriculumIds.has(numIdKey));
      });

      // Filter to strictly non-completed lessons (progress < 100 and not marked done)
      const activeCont = userSpecificInProgress.filter(c => {
        const titleKey = (c.title || '').trim().toLowerCase();
        const idKey = String(c.id || '').toLowerCase();
        const isDone = Boolean(c.completed) || ((c.progressPercent || 0) >= 100) || completedSet.has(idKey) || completedSet.has(titleKey);
        return !isDone;
      });

      // Enrich with metadata from user's curriculum item (so icons, xp, duration, level are exact)
      const enrichedCont = activeCont.map(c => {
        const titleKey = (c.title || '').trim().toLowerCase();
        const matchedCurriculumLesson = baseCurriculum.find(l => 
          (l.title || '').trim().toLowerCase() === titleKey
        ) || baseCurriculum.find(l => 
          String(l.id) === String(c.id) || 
          String(l.numericId) === String(c.id) ||
          String(l.numericId) === String(c.numericId)
        );
        return {
          ...(matchedCurriculumLesson || {}),
          ...c,
          title: matchedCurriculumLesson?.title || c.title,
          progressPercent: Math.min(100, Math.max(10, c.progressPercent || 11)),
        };
      });

      let finalContinueList = [];
      if (enrichedCont.length > 0) {
        finalContinueList = enrichedCont;
      } else {
        // Fallback: pick the first uncompleted lesson in the user's 20-lesson curriculum
        const nextLesson = baseCurriculum.find(l => {
          const titleKey = (l.title || '').trim().toLowerCase();
          const idKey = String(l.id || '').toLowerCase();
          const isDone = Boolean(l.completed) || ((l.progressPercent || 0) >= 100) || completedSet.has(idKey) || completedSet.has(titleKey);
          return !isDone;
        }) || baseCurriculum[0];

        finalContinueList = nextLesson ? [nextLesson] : [];
      }

      CurriculumCache.setContinueItems(user?.id, profileKey, finalContinueList);
      setContinueItems(prev => areListsIdentical(prev, finalContinueList) ? prev : finalContinueList);

      // Recommended from newly defined profile lessons
      setRecommended(baseCurriculum.slice(0, 5));

      // Load lessons based on current filter
      await applyFilter(selectedCategory, activeTab, silent, baseCurriculum);
    } catch (e) {
      setError('Unable to load lessons. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedCategory, activeTab, lessons.length]);

  const applyFilter = useCallback(async (category, difficulty, silent = false, overrideCurriculum = null) => {
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (category && category !== 'All') params.category = category;
      if (difficulty && difficulty !== 'All') params.difficulty = difficulty;
      const [data, storedCompleted] = await Promise.all([
        lessonModuleService.list(params).catch(() => []),
        AsyncStorage.getItem('speakmate_completed_standard_lessons').catch(() => null),
      ]);
      const completedSet = new Set(storedCompleted ? JSON.parse(storedCompleted).map(x => String(x).toLowerCase()) : []);
      CurriculumCache.setCompletedSet(completedSet);
      
      const baseCurriculum = overrideCurriculum || getProfileCurriculum(user, userGrade, accountType, userAgeGroup).curriculum;
      const profileKey = userGrade || userAgeGroup;

      // Map any backend completion/progress into the newly defined profile lessons
      const backendMap = new Map();
      if (Array.isArray(data) && data.length > 0) {
        data.forEach(item => {
          if (item?.title) backendMap.set(item.title.trim().toLowerCase(), item);
        });
      }

      let list = baseCurriculum.map((sl) => {
        const backendMatch = backendMap.get((sl.title || '').trim().toLowerCase());
        const isDone = completedSet.has(String(sl.id).toLowerCase()) ||
                       completedSet.has(String(backendMatch?.id).toLowerCase()) ||
                       completedSet.has((sl.title || '').trim().toLowerCase()) ||
                       Boolean(backendMatch?.completed);
        const prog = isDone ? 100 : (backendMatch?.progressPercent || sl.progressPercent || 0);
        return {
          ...sl,
          ...(backendMatch || {}),
          id: backendMatch?.id || sl.id,
          title: sl.title,
          category: sl.category,
          level: sl.level,
          description: sl.description,
          completed: isDone,
          progressPercent: prog,
        };
      });

      if (category && category !== 'All') {
        list = list.filter((l) => l.category?.toLowerCase() === category?.toLowerCase());
      }
      if (difficulty && difficulty !== 'All') {
        list = list.filter((l) => (l.level || '').toLowerCase() === difficulty.toLowerCase());
      }
      CurriculumCache.setLessons(user?.id, profileKey, list);
      setLessons(prev => areListsIdentical(prev, list) ? prev : list);
    } catch {
      const fallbackList = overrideCurriculum || getProfileCurriculum(user, userGrade, accountType, userAgeGroup).curriculum;
      setLessons(prev => areListsIdentical(prev, fallbackList) ? prev : fallbackList);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, userGrade, accountType, userAgeGroup]);

  useFocusEffect(
    useCallback(() => {
      // 1. Instantly sync in-memory cache to UI state with ZERO lag
      const profileInfo = getProfileCurriculum(user, userGrade, accountType, userAgeGroup);
      const profileKey = profileInfo.grade || profileInfo.ageGroup;
      const cachedCont = CurriculumCache.getContinueItems(user?.id, profileKey, profileInfo.curriculum);
      if (cachedCont && cachedCont.length > 0) {
        setContinueItems(prev => areListsIdentical(prev, cachedCont) ? prev : cachedCont);
      }
      const cachedLessons = CurriculumCache.getLessons(user?.id, profileKey);
      if (cachedLessons && cachedLessons.length > 0) {
        setLessons(prev => areListsIdentical(prev, cachedLessons) ? prev : cachedLessons);
      }

      // 2. Fetch fresh server data silently in background
      loadAll(true);
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(headerTranslate, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, [loadAll, user?.id, userGrade, userAgeGroup, accountType])
  );

  // ── Helper: Build strict word-prefix matcher (compulsion: strictly related) ──
  const buildWordPrefixMatcher = useCallback((query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return null;

    const words = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) return null;

    const wordRegexes = words.map((w) => {
      const safe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(?:^|[\\s\\-_/:(\\[])' + safe, 'i');
    });

    return (lesson) => {
      if (!lesson) return false;
      const title = lesson.title || '';
      const cat = lesson.category || '';
      const desc = lesson.description || '';

      // Every word typed must match as a word prefix on a visible, relevant field
      return wordRegexes.every((regex) => {
        // 1. Strict word-prefix match on Title
        if (regex.test(title)) return true;
        // 2. Strict word-prefix match on Category
        if (regex.test(cat)) return true;
        // 3. For queries >= 3 characters, allow word-prefix match on description
        if (trimmed.length >= 3 && regex.test(desc)) return true;
        return false;
      });
    };
  }, []);

  // ── Instant Local Search + Debounced Server Sync ────────────────────
  const executeLocalSearch = useCallback((query, cat, tab) => {
    const q = (query || '').trim();
    if (!q) {
      setSearchResults(null);
      return;
    }

    const matcher = buildWordPrefixMatcher(q);
    if (!matcher) {
      setSearchResults(null);
      return;
    }

    const profileInfo = getProfileCurriculum(user, userGrade, accountType, userAgeGroup);
    const primaryLessons = profileInfo.curriculum || [];

    const seenIds = new Set();
    const candidateList = [];

    // Prioritize user's active curriculum
    primaryLessons.forEach((l) => {
      if (l && l.id) {
        seenIds.add(String(l.id));
        candidateList.push({ ...l, isPrimary: true });
      }
    });

    // Also include master curriculum for platform-wide topic discovery
    (MASTER_LESSONS || []).forEach((l) => {
      if (l && l.id && !seenIds.has(String(l.id))) {
        seenIds.add(String(l.id));
        candidateList.push({ ...l, isPrimary: false });
      }
    });

    const matches = candidateList.filter((l) => {
      // 1. Safe category filter
      if (cat && cat !== 'All') {
        const lessonCat = (l.category || '').toLowerCase();
        if (lessonCat !== cat.toLowerCase()) return false;
      }

      // 2. Safe tab/level filter
      if (tab && tab !== 'All') {
        const lvl = (l.level || l.difficulty || '').toLowerCase();
        if (!lvl.includes(tab.toLowerCase())) return false;
      }

      // 3. Compulsion: Strictly related lessons only (word-boundary prefix)
      return matcher(l);
    });

    // Sort: 1) Title starts with query, 2) Primary curriculum
    const lowerQ = q.toLowerCase();
    matches.sort((a, b) => {
      const aStarts = (a.title || '').toLowerCase().startsWith(lowerQ);
      const bStarts = (b.title || '').toLowerCase().startsWith(lowerQ);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;

      return 0;
    });

    setSearchResults(matches);
  }, [user, userGrade, accountType, userAgeGroup, buildWordPrefixMatcher]);

  const handleSearchChange = useCallback((text) => {
    const trimmed = text.trim();
    activeSearchQueryRef.current = trimmed;
    setSearchText(text);
    clearTimeout(searchTimer.current);

    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    // 1. Instant local search on frame 0
    executeLocalSearch(text, selectedCategory, activeTab);

    // 2. Non-blocking debounced server query (with race-condition protection & strict filter)
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const catParam = selectedCategory && selectedCategory !== 'All' ? selectedCategory : undefined;
        const tabParam = activeTab && activeTab !== 'All' ? activeTab : undefined;
        const serverResults = await lessonModuleService.search(trimmed, catParam, tabParam).catch(() => []);

        // Discard stale responses if user typed something else while request was in-flight
        if (activeSearchQueryRef.current !== trimmed) {
          return;
        }

        if (Array.isArray(serverResults) && serverResults.length > 0) {
          const matcher = buildWordPrefixMatcher(trimmed);
          if (matcher) {
            // COMPULSION: Strictly filter server results with the exact same word-prefix matcher
            const strictlyRelated = serverResults.filter(matcher);
            if (strictlyRelated.length > 0) {
              setSearchResults((prev) => {
                if (activeSearchQueryRef.current !== trimmed) return prev;
                const current = prev || [];
                const currentIds = new Set(current.map((l) => String(l.id)));
                const newLessons = strictlyRelated.filter((l) => l && l.id && !currentIds.has(String(l.id)));
                return newLessons.length > 0 ? [...current, ...newLessons] : current;
              });
            }
          }
        }
      } catch {
        // Keep instant local search results intact
      } finally {
        if (activeSearchQueryRef.current === trimmed) {
          setSearching(false);
        }
      }
    }, 350);
  }, [executeLocalSearch, selectedCategory, activeTab, buildWordPrefixMatcher]);

  const handleClearSearch = useCallback(() => {
    clearTimeout(searchTimer.current);
    activeSearchQueryRef.current = '';
    setSearchText('');
    setSearchResults(null);
    setSearching(false);
  }, []);

  // ── Filter by tab/category ─────────────────────────────────────────
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (searchText.trim()) {
      executeLocalSearch(searchText, selectedCategory, tab);
    } else {
      applyFilter(selectedCategory, tab);
    }
  }, [selectedCategory, searchText, executeLocalSearch, applyFilter]);

  const handleCategoryPress = useCallback((catName) => {
    const next = selectedCategory === catName ? null : catName;
    setSelectedCategory(next);
    if (searchText.trim()) {
      executeLocalSearch(searchText, next, activeTab);
    } else {
      applyFilter(next, activeTab);
    }
  }, [selectedCategory, activeTab, searchText, executeLocalSearch, applyFilter]);

  // ── Navigate to detail ─────────────────────────────────────────────
  const openLesson = useCallback(async (lesson) => {
    if (!lesson) return;
    try {
      const stored = await AsyncStorage.getItem('speakmate_in_progress_lessons').catch(() => null);
      const inProg = stored ? JSON.parse(stored) : [];
      const titleKey = (lesson.title || '').trim().toLowerCase();
      const idKey = String(lesson.id || '');
      const existingIdx = inProg.findIndex(item =>
        (titleKey && (item?.title || '').trim().toLowerCase() === titleKey) ||
        (idKey && String(item?.id || '') === idKey)
      );
      const curProg = existingIdx !== -1 ? Math.max(11, inProg[existingIdx].progressPercent || 0) : Math.max(11, lesson.progressPercent || 0);
      const itemToSave = {
        id: lesson.id,
        numericId: lesson.numericId,
        title: lesson.title,
        category: lesson.category || 'General',
        level: lesson.level || lesson.difficulty || 'Beginner',
        xpReward: lesson.xpReward || 35,
        estimatedMinutes: lesson.estimatedMinutes || lesson.duration || 15,
        progressPercent: curProg,
        lastOpenedAt: new Date().toISOString(),
      };
      if (existingIdx !== -1) {
        inProg[existingIdx] = { ...inProg[existingIdx], ...itemToSave };
      } else {
        inProg.unshift(itemToSave);
      }
      await AsyncStorage.setItem('speakmate_in_progress_lessons', JSON.stringify(inProg));
      CurriculumCache.updateLessonProgress(
        lesson.id,
        lesson.title,
        curProg,
        lesson.category || 'General',
        lesson.level || lesson.difficulty || 'Beginner'
      );
    } catch (_) {}

    navigation.navigate('LessonDetail', { lessonId: lesson.id, lessonTitle: lesson.title, lesson });
  }, [navigation]);

  // ── Displayed lessons ──────────────────────────────────────────────
  const displayedLessons = searchResults !== null ? searchResults : lessons;

  // ── Render header (static part used in ListHeaderComponent) ───────
  const ListHeader = useMemo(() => (
    <View>
      {/* ── Hero gradient header ── */}
      <LinearGradient
        colors={['#0F172A', '#1E1B4B', '#312E81']}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.heroDeco1} />
        <View style={styles.heroDeco2} />
        <SafeAreaView edges={['top']}>
          <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }}>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroHi}>Welcome back 👋</Text>
                <Text style={styles.heroTitle}>Continue your learning</Text>
                {accountType === 'STUDENT' ? (
                  <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                    🎓 School Grade: {userGrade || '1st Std'}
                  </Text>
                ) : (
                  <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                    👤 Target Profile: {String(userAgeGroup || 'Professional').replace(/\s*\(Age.*?\)/i, '')}
                  </Text>
                )}
              </View>
            </View>

            {/* Search bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search lessons, categories, topics…"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={searchText}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />}
              {searchText.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={19} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Difficulty tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsRow, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder }]}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {DIFFICULTY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => handleTabChange(tab)}
            style={[styles.tab, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, { color: isDark ? '#94A3B8' : '#64748B' }, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Continue Learning ── */}
      {continueItems.length > 0 && searchResults === null && (
        <View style={styles.section}>
          <SectionHeader
            title={`📚 Continue Learning${continueItems.length > 1 ? ` (${continueItems.length})` : ''}`}
            subtitle={continueItems.length > 1 ? "Swipe horizontally to resume" : undefined}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.continueScrollContainer}
            decelerationRate="fast"
            snapToInterval={continueItems.length > 1 ? CONTINUE_CARD_WIDTH + 12 : undefined}
            snapToAlignment="start"
          >
            {continueItems.map((lesson, idx) => (
              <View
                key={lesson.id ? `cont-${lesson.id}` : `cont-${lesson.title || idx}`}
                style={[
                  styles.continueSlideWrapper,
                  { width: continueItems.length === 1 ? SCREEN_WIDTH - 32 : CONTINUE_CARD_WIDTH },
                  idx === continueItems.length - 1 && { marginRight: 16 },
                ]}
              >
                <ContinueLearningCard lesson={lesson} onPress={() => openLesson(lesson)} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Categories ── */}
      {searchResults === null && (
        <View style={styles.section}>
          <SectionHeader title="📂 Categories" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
          >
            {categories.map((cat, i) => (
              <View key={cat.name} style={{ marginRight: 12 }}>
                <CategoryCard
                  item={cat}
                  index={i}
                  onPress={() => handleCategoryPress(cat.name)}
                />
                {selectedCategory === cat.name && (
                  <View style={styles.catSelected} />
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Recommended ── */}
      {searchResults === null && recommended.length > 0 && (
        <View style={[styles.section, { paddingBottom: 0 }]}>
          <SectionHeader title="⭐ Recommended" />
        </View>
      )}

      {/* ── Search / filter heading ── */}
      {(searchResults !== null || selectedCategory || activeTab !== 'All') && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionHeader
              title={
                searchResults !== null
                  ? `Results for "${searchText}" (${displayedLessons.length})`
                  : selectedCategory
                    ? `${selectedCategory} · ${activeTab}`
                    : `${activeTab} Lessons`
              }
            />
            {searchResults !== null && (
              <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Regular lessons heading ── */}
      {searchResults === null && !selectedCategory && activeTab === 'All' && (
        <View style={[styles.section, { paddingBottom: 0 }]}>
          <SectionHeader title="🎓 All Lessons" />
        </View>
      )}
    </View>
  ), [categories, continueItems, recommended, searchResults, searchText, selectedCategory, activeTab, searching, headerOpacity, headerTranslate, isDark, theme, handleSearchChange, handleClearSearch, openLesson, handleCategoryPress, handleTabChange, displayedLessons.length]);

  // ── Main render ────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <LinearGradient colors={['#0F172A', '#1E1B4B', '#312E81']} style={[styles.hero, { paddingBottom: 60 }]}>
          <SafeAreaView edges={['top']}>
            <View style={styles.heroRow}>
              <Text style={styles.heroTitle}>Lessons</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map((k) => <LessonSkeleton key={k} />)}
        </View>
      </View>
    );
  }

  const keyExtractor = useCallback((item) => String(item.id), []);

  const renderLessonItem = useCallback(({ item }) => (
    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
      <LessonCard lesson={item} onPress={openLesson} />
    </View>
  ), [openLesson]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <FlatList
        data={displayedLessons}
        keyExtractor={keyExtractor}
        renderItem={renderLessonItem}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !loading && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <EmptyState
                icon={searchResults !== null ? 'search-outline' : 'book-outline'}
                title={error || (searchResults !== null ? `No lessons found for "${searchText}"` : 'No lessons yet')}
                message={
                  error
                    ? 'Pull down to retry'
                    : searchResults !== null
                      ? 'Try different keywords like "Grammar", "Speaking", "Vowels", or tap below to reset.'
                      : undefined
                }
              />
              {searchResults !== null && (
                <TouchableOpacity
                  style={[styles.clearSearchBtn, { borderColor: COLORS.primary }]}
                  onPress={handleClearSearch}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.clearSearchBtnText, { color: COLORS.primary }]}>
                    Clear Search & Show All Lessons
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAll(true); }}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  // Hero
  hero: { paddingBottom: 24, overflow: 'hidden' },
  heroDeco1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)', top: -100, right: -80,
  },
  heroDeco2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', top: 40, left: -60,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  heroHi: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },
  heroTitle: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  heroIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 16, marginTop: 14, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '400' },

  // Difficulty tabs
  tabsRow: { paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFF' },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 20 },
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontSize: 17, fontWeight: '800', color: COLORS.black },
  seeAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Category cards
  catCard: {
    width: 130, padding: 14, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
  },
  catIconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  catName: { color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  catLessons: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500' },
  catProgress: { height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, marginTop: 8 },
  catProgressFill: { height: 3, backgroundColor: '#FFF', borderRadius: 2 },
  catSelected: { height: 3, backgroundColor: COLORS.primary, borderRadius: 2, marginTop: 6 },

  // Lesson cards
  cardOuter: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  cardBand: { padding: 14, paddingTop: 16, minHeight: 80 },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  completedBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  cardBandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catChip: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  catChipText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  xpChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  xpChipText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  cardBody: { padding: 14 },
  cardBodyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  cardDesc: { fontSize: 12, color: COLORS.text, lineHeight: 17 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: COLORS.text, fontWeight: '500' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  diffBadgeText: { fontSize: 11, fontWeight: '700' },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 10 },
  progressBarFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  cardBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  cardBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Continue Learning
  continueScrollContainer: { paddingLeft: 16, paddingRight: 8, paddingBottom: 6 },
  continueSlideWrapper: { marginRight: 12 },
  continueCard: { borderRadius: 20, overflow: 'hidden', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 5 },
  continueGradient: { flexDirection: 'row', padding: 18, alignItems: 'center' },
  continueLeft: { flex: 1 },
  continueBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  continueLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  continueProgressBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  continueProgressBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  continueTitle: { color: '#FFF', fontSize: 17, fontWeight: '900', marginBottom: 2 },
  continueCat: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500', marginBottom: 8 },
  continueMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  continueXP: { color: '#FCD34D', fontSize: 12, fontWeight: '700' },
  continueDot: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  continueTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  continueProg: { height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, marginBottom: 4 },
  continueProgFill: { height: 4, backgroundColor: '#FFF', borderRadius: 2 },
  continueProgText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },
  continueRight: { marginLeft: 14 },
  continuePlayBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  secSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#94A3B8', marginTop: 14, textAlign: 'center' },
  emptyMsg: { fontSize: 13, color: '#CBD5E1', marginTop: 6, textAlign: 'center' },
  clearSearchBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(79,70,229,0.06)',
  },
  clearSearchBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
