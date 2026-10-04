import React, { useCallback, useContext, useMemo, useState, useEffect } from 'react';
import {
  Alert,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedAvatarModel } from '../../config/AvatarCatalog';
import { useTheme } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { useDrawer } from '../../context/DrawerContext';
import {
  chatService,
  dashboardService,
  grammarService,
  lessonService,
  notificationService,
  onboardingService,
  profileService,
  progressService,
  speakingService,
  vocabularyService,
  assignmentService,
  announcementService,
} from '../../services/appServices';
import {
  ContinueLearningCard,
  DailyGoalCard,
  DashboardHeader,
  QuickStatistics,
  QuoteCard,
  RecentActivityTimeline,
  UpcomingLessons,
  WeeklyProgressChart,
  QuickActionsCard,
  LearningStreakCard,
  DailyMotivationCard,
  UpcomingRecommendations,
  AchievementsCard,
  SchoolAnnouncementsCard,
  LeaderboardSheet,
} from '../../components/dashboard';
import { StateView } from '../../components/ui';
import { COLORS } from '../../constants/colors';
import { openLearnerAssistant } from '../../components/assistant/assistantEvents';

import { DashboardCache } from '../../utils/dashboardCache';
export { DashboardCache };

import { useToast } from '../../context/ToastContext';

export default function DashboardScreen({ navigation }) {
  const { user, updateUser } = useContext(AuthContext);
  const { openDrawer, setProfile, setProgress } = useDrawer();
  const { isDark } = useTheme();
  const { showToast, triggerConfetti } = useToast();

  const isStudentUser = Boolean(
    user?.accountType === 'STUDENT' ||
    user?.role === 'STUDENT' ||
    user?.schoolId ||
    user?.schoolCode
  );

  const currentUserId = user?.id || user?._id;
  const initialCache = DashboardCache.get(currentUserId);
  const [state, setState] = useState(() => ({
    loading: false,
    refreshing: false,
    error: '',
    dashboard: initialCache,
  }));

  const [assignments, setAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Immediately hydrate from disk cache if in-memory cache was not yet populated
  useEffect(() => {
    let isMounted = true;
    if (!state.dashboard && currentUserId) {
      DashboardCache.init(currentUserId).then((cached) => {
        if (isMounted && cached) {
          setState((prev) => ({ ...prev, dashboard: cached }));
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [currentUserId, state.dashboard]);

  const loadDashboard = useCallback(async (refreshing = false) => {
    setState((current) => ({
      ...current,
      loading: false,
      refreshing,
      error: '',
    }));

    try {
      const [dashboard, myAssignments, schoolAnnouncements] = await Promise.all([
        dashboardService.summary(),
        isStudentUser ? assignmentService.myAssignments().catch(() => []) : Promise.resolve([]),
        isStudentUser ? announcementService.list().catch(() => []) : Promise.resolve([]),
      ]);

      setAssignments(isStudentUser ? (myAssignments || []) : []);
      setAnnouncements(isStudentUser ? (schoolAnnouncements || []) : []);

      if (dashboard) {
        if (dashboard.profile) {
          setProfile(dashboard.profile);
          if (updateUser) {
            updateUser({
              ...(dashboard.profile.avatar ? { avatar: dashboard.profile.avatar } : {}),
              ...(dashboard.profile.firstName ? { firstName: dashboard.profile.firstName } : {}),
              ...(dashboard.profile.lastName ? { lastName: dashboard.profile.lastName } : {}),
              ...(dashboard.profile.ageGroup ? { ageGroup: dashboard.profile.ageGroup } : {}),
              ...(dashboard.profile.englishLevel ? { englishLevel: dashboard.profile.englishLevel } : {}),
              ...(dashboard.profile.schoolGrade ? { schoolGrade: dashboard.profile.schoolGrade } : {}),
              ...(dashboard.progress?.xp !== undefined ? { xp: dashboard.progress.xp } : {}),
              ...(dashboard.progress?.currentStreak !== undefined ? { streak: dashboard.progress.currentStreak } : {}),
            });
          }
        }
        if (dashboard.progress) {
          setProgress(dashboard.progress);
        }
        // Save to cache scoped by userId
        DashboardCache.set(dashboard, currentUserId);
      }

      setState((curr) => ({
        ...curr,
        loading: false,
        refreshing: false,
        error: '',
        dashboard: dashboard || curr.dashboard,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: current.dashboard ? '' : (error.userMessage || ''),
      }));
    }
  }, [currentUserId, setProfile, setProgress, isStudentUser, updateUser, user]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard(false);
    }, [loadDashboard])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadDashboard(false);
      }
    });
    return () => {
      sub.remove();
    };
  }, [loadDashboard]);

  const viewModel = useMemo(() => {
    if (!state.dashboard) {
      return {
        name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Learner',
        avatar: user?.avatar,
        isStudent: isStudentUser,
        schoolGrade: isStudentUser ? (user?.schoolGrade || '1st Std') : null,
        ageGroup: isStudentUser ? null : (user?.ageGroup || 'Professional'),
        englishLevel: isStudentUser ? null : (user?.englishLevel || 'Beginner'),
        level: Number(user?.level) || 1,
        xp: Number(user?.xp) || 0,
        streak: Number(user?.streak) || 0,
        streakFreezes: Number(user?.streakFreezes ?? 1),
        rank: user?.rank || null,
        activeLesson: null,
        upcomingLessons: [],
        dailyGoal: {
          title: "Today Practice Goal",
          lessonsCompletedToday: Number(user?.lessonsCompletedToday) || 0,
          speakingMinutesToday: Number(user?.speakingMinutesToday) || 0,
          dailyGoalMinutes: Number(user?.dailyGoalMinutes || 15),
          targetSpeakingMinutes: Number(user?.dailyGoalMinutes || 15),
          vocabularyCompleted: Number(user?.vocabularyCompleted) || 0,
          vocabularyTarget: 5,
          percentage: Number(user?.dailyGoalPercentage) || 0,
          remainingLessons: 1,
        },
        weeklyProgress: [],
        recentActivity: [],
        statistics: {
          totalLessons: Number(user?.totalLessons) || 0,
          completedLessons: Number(user?.completedLessons) || 0,
          speakingSessions: Number(user?.speakingSessions) || 0,
          vocabularyLearned: Number(user?.vocabularyLearned) || 0,
          grammarExercises: Number(user?.grammarExercises) || 0,
          totalStudyHours: Number(user?.totalStudyHours) || 0,
          currentStreak: Number(user?.streak) || 0,
          longestStreak: Number(user?.longestStreak || user?.streak) || 0,
          averageScore: Number(user?.averageScore) || 0,
        },
        quote: null,
        continueLearning: null,
        wordOfTheDay: null,
        englishTip: '',
        recommendations: [],
        achievements: [],
        notifications: [],
        unreadCount: 0,
      };
    }

    const d = state.dashboard;
    const profile = d.profile || {};
    const progress = d.progress || {};
    const userFullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    const profileFullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    const name = userFullName || profileFullName || 'Learner';

    const effectiveGrade = isStudentUser ? (profile.schoolGrade || user?.schoolGrade || '1st Std') : null;
    const effectiveAge = isStudentUser ? null : (profile.ageGroup || user?.ageGroup || 'Professional');
    const effectiveLevel = isStudentUser ? null : (profile.englishLevel || user?.englishLevel || 'Beginner');

    return {
      name,
      avatar: user?.avatar || profile.avatar,
      isStudent: isStudentUser,
      schoolGrade: effectiveGrade,
      ageGroup: effectiveAge,
      englishLevel: effectiveLevel,
      level: Number(progress.level) || 1,
      xp: Number(progress.xp) || 0,
      streak: Number(progress.currentStreak ?? progress.streak ?? d.streak ?? user?.streak ?? 0),
      streakFreezes: Number(progress.streakFreezes ?? d.streakFreezes ?? user?.streakFreezes ?? 1),
      rank: d.rank,
      activeLesson: d.activeLessons?.[0] || null,
      dailyGoal: {
        ...(d.dailyGoal || {}),
        dailyGoalMinutes: Number(d.dailyGoal?.dailyGoalMinutes || d.dailyGoal?.targetSpeakingMinutes || user?.dailyGoalMinutes || 15),
        targetSpeakingMinutes: Number(d.dailyGoal?.dailyGoalMinutes || d.dailyGoal?.targetSpeakingMinutes || user?.dailyGoalMinutes || 15),
      },
      weeklyProgress: d.weeklyProgress || [],
      recentActivity: d.recentActivity || [],
      statistics: {
        ...(d.statistics || {}),
        currentStreak: Number(d.statistics?.currentStreak ?? progress.currentStreak ?? progress.streak ?? 0),
        longestStreak: Number(d.statistics?.longestStreak ?? progress.longestStreak ?? 0),
      },
      quote: d.quote,
      continueLearning: d.continueLearning,
      wordOfTheDay: d.wordOfTheDay,
      englishTip: d.englishTip,
      recommendations: d.recommendations || [],
      achievements: d.achievements || [],
      notifications: d.notifications || [],
      unreadCount: Number(d.unreadNotificationsCount) || 0,
    };
  }, [state.dashboard, user, isStudentUser]);

  const handleLessonPress = useCallback((lesson) => {
    navigation.navigate('Lessons', { screen: 'LessonDetail', params: { lessonId: lesson?.id, lessonTitle: lesson?.title, lesson } });
  }, [navigation]);

  const handleNotificationsNav = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  const handleContinueLearningPress = useCallback((item) => {
    if (!item) {
      navigation.navigate('Lessons');
      return;
    }
    if (item.module === 'Speaking Session') {
      navigation.navigate('BottomTabs', { screen: 'Speaking' });
    } else if (item.module === 'Lesson') {
      navigation.navigate('Lessons', {
        screen: 'LessonDetail',
        params: { lessonId: item.targetId, lessonTitle: item.title }
      });
    } else if (item.module === 'Vocabulary Quiz') {
      navigation.navigate('Vocabulary');
    } else if (item.module === 'Grammar Exercise') {
      navigation.navigate('Grammar');
    } else if (item.module === 'AI Chat') {
      navigation.navigate('BottomTabs', {
        screen: 'AIChat',
        params: {
          screen: 'ConversationChat',
          params: { sessionId: item.targetId, title: item.title, avatarModel: getCachedAvatarModel() }
        }
      });
    } else {
      navigation.navigate('Lessons');
    }
  }, [navigation]);

  const [leaderboardVisible, setLeaderboardVisible] = useState(false);

  const handleBuyFreeze = useCallback(async () => {
    try {
      const res = await progressService.buyFreeze();
      if (res) {
        if (updateUser) {
          updateUser({ ...user, xp: res.xp, streakFreezes: res.streakFreezes });
        }
        setState((prev) => {
          if (!prev.dashboard) return prev;
          const updated = {
            ...prev.dashboard,
            progress: {
              ...(prev.dashboard.progress || {}),
              xp: res.xp,
              streakFreezes: res.streakFreezes,
            },
          };
          if (user?.id) DashboardCache.set(updated, user.id);
          return { ...prev, dashboard: updated };
        });
        triggerConfetti();
        showToast('Streak Freeze Purchased! ❄️', 'success', '1 Streak Freeze added to your reserve (-100 XP)');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.userMessage || 'You need at least 100 XP to buy a Streak Freeze';
      showToast('Streak Freeze ❄️', 'info', msg);
    }
  }, [user, updateUser, showToast, triggerConfetti]);

  const handleRecommendationPress = useCallback((rec) => {
    if (!rec) return;
    if (rec.type === 'lesson') {
      if (rec.targetId) {
        navigation.navigate('Lessons', { screen: 'LessonDetail', params: { lessonId: rec.targetId, lessonTitle: rec.title } });
      } else {
        navigation.navigate('Lessons');
      }
    } else if (rec.type === 'speaking') {
      navigation.navigate('BottomTabs', { screen: 'Speaking' });
    } else if (rec.type === 'vocabulary') {
      navigation.navigate('Vocabulary');
    } else if (rec.type === 'grammar') {
      navigation.navigate('Grammar');
    } else if (rec.type === 'chat') {
      navigation.navigate('BottomTabs', { screen: 'AIChat' });
    } else {
      navigation.navigate('Lessons');
    }
  }, [navigation]);

  const handleOpenMenu = useCallback(() => {
    try {
      if (navigation?.openDrawer) {
        navigation.openDrawer();
      } else if (navigation?.getParent) {
        navigation.getParent()?.openDrawer?.();
      } else {
        openDrawer();
      }
    } catch {
      openDrawer();
    }
  }, [navigation, openDrawer]);

  const topSafeBg = '#0F172A';
  const contentBg = isDark ? '#0F172A' : '#F8FAFC';

  if (state.error && !state.dashboard) {
    return (
      <SafeAreaView style={[styles.safeContainer, { backgroundColor: topSafeBg }]} edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <StateView error={state.error} onRetry={() => loadDashboard(false)} />
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: topSafeBg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: contentBg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => loadDashboard(true)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* SECTION 1: PERSONALIZED HEADER */}
        <DashboardHeader
          name={viewModel.name}
          avatar={viewModel.avatar}
          isStudent={viewModel.isStudent}
          isPro={!isStudentUser && Boolean(user?.isPro || user?.pro)}
          schoolGrade={viewModel.schoolGrade}
          ageGroup={viewModel.ageGroup}
          englishLevel={viewModel.englishLevel}
          level={viewModel.level}
          xp={viewModel.xp}
          streak={viewModel.streak}
          rank={viewModel.rank}
          unreadCount={viewModel.unreadCount}
          onMenuPress={handleOpenMenu}
          onNotificationPress={handleNotificationsNav}
          onProfilePress={() => navigation.navigate('BottomTabs', { screen: 'Profile' })}
          onChatbotPress={openLearnerAssistant}
          onLeaderboardPress={() => setLeaderboardVisible(true)}
          isDark={isDark}
        />

        {/* SECTION 2: TODAY'S GOAL */}
        <DailyGoalCard goal={viewModel.dailyGoal} onContinue={() => handleContinueLearningPress(viewModel.continueLearning)} isDark={isDark} />

        {/* SECTION 2.5: SCHOOL ANNOUNCEMENTS (STUDENTS ONLY) */}
        {isStudentUser && (
          <SchoolAnnouncementsCard announcements={announcements} />
        )}

        {/* SECTION 3: CONTINUE LEARNING */}
        {viewModel.continueLearning && (
          <ContinueLearningCard item={viewModel.continueLearning} onResume={handleContinueLearningPress} isDark={isDark} />
        )}

        {/* SECTION 4: QUICK ACTIONS */}
        <QuickActionsCard navigation={navigation} isDark={isDark} />

        {/* SECTION 5: LEARNING STATISTICS */}
        <QuickStatistics stats={viewModel.statistics} isDark={isDark} />

        {/* SECTION 6: WEEKLY ACTIVITY */}
        <WeeklyProgressChart data={viewModel.weeklyProgress} isDark={isDark} />

        {/* SECTION 7: LEARNING STREAK */}
        <LearningStreakCard
          streak={viewModel.streak}
          longestStreak={viewModel.statistics?.longestStreak || 0}
          streakFreezes={viewModel.streakFreezes}
          xp={viewModel.xp}
          onBuyFreeze={handleBuyFreeze}
          isDark={isDark}
        />

        {/* SECTION 8: RECENT ACTIVITY */}
        <RecentActivityTimeline items={viewModel.recentActivity} isDark={isDark} />

        {/* SECTION 9: DAILY MOTIVATION */}
        <DailyMotivationCard
          quote={viewModel.quote}
          tip={viewModel.englishTip}
          word={viewModel.wordOfTheDay}
          isDark={isDark}
        />

        {/* SECTION 10: UPCOMING RECOMMENDATIONS */}
        <UpcomingRecommendations
          recommendations={viewModel.recommendations}
          onPress={handleRecommendationPress}
          isDark={isDark}
        />

        {/* SECTION 11: ACHIEVEMENTS */}
        <AchievementsCard
          achievements={viewModel.achievements}
          onViewAll={() => navigation.navigate('Achievements')}
          isDark={isDark}
        />
      </ScrollView>

      <LeaderboardSheet
        visible={leaderboardVisible}
        onClose={() => setLeaderboardVisible(false)}
        currentUser={user}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});

