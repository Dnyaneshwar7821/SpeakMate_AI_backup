import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Screen, StateView } from '../../components/ui';
import { dashboardService } from '../../services/appServices';
import { useTheme } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { DashboardCache, RhythmCache } from '../../utils/dashboardCache';
import { COLORS } from '../../constants/colors';

const { width } = Dimensions.get('window');

// Local date string formatter without UTC skew
const formatLocalDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Instant fallback generator for 7-day week (Mon to Sun)
const generateInstant7DayRhythm = (existingWeekly = []) => {
  if (Array.isArray(existingWeekly) && existingWeekly.length > 0) {
    return existingWeekly;
  }
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - distanceToMonday);

  return dayNames.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      day: name,
      date: formatLocalDate(d),
      studyMinutes: 0,
      lessonsCompleted: 0,
      speakingSessions: 0,
    };
  });
};

// CEFR Level Configuration (500 XP per level scale)
const CEFR_LEVELS = [
  { code: 'A1', name: 'Beginner', minXp: 0, maxXp: 500, color: '#3B82F6', desc: 'Can understand basic phrases & introduce oneself.' },
  { code: 'A2', name: 'Elementary', minXp: 500, maxXp: 1500, color: '#06B6D4', desc: 'Can communicate in routine conversational tasks.' },
  { code: 'B1', name: 'Intermediate', minXp: 1500, maxXp: 3000, color: '#10B981', desc: 'Can handle most everyday conversations with ease.' },
  { code: 'B2', name: 'Upper Intermediate', minXp: 3000, maxXp: 5000, color: '#8B5CF6', desc: 'Can converse fluently with native speakers.' },
  { code: 'C1', name: 'Advanced', minXp: 5000, maxXp: 8000, color: '#EC4899', desc: 'Can express ideas fluently and spontaneously.' },
  { code: 'C2', name: 'Mastery / Native', minXp: 8000, maxXp: 15000, color: '#F59E0B', desc: 'Complete effortless fluency in complex discourse.' },
];

export default function ProgressScreen({ navigation }) {
  const { isDark, theme } = useTheme();
  const { user } = useContext(AuthContext);
  const cachedDashboard = DashboardCache.get(user?.id);
  const [state, setState] = useState(() => ({
    loading: !cachedDashboard,
    error: '',
    dashboard: cachedDashboard,
  }));

  // Instant Frame-0 rhythm state initialized from cache or synthesized fallback (0ms)
  const [rhythmData, setRhythmData] = useState(() => {
    const cached7d = RhythmCache.get('7d', user?.id) || cachedDashboard?.weeklyProgress;
    return generateInstant7DayRhythm(cached7d);
  });

  const load = async (silent = false) => {
    if (!silent && !state.dashboard) {
      setState((current) => ({ ...current, loading: true, error: '' }));
    }
    try {
      const dashboard = await dashboardService.summary();
      if (dashboard && user?.id) {
        DashboardCache.set(dashboard, user.id);
        if (Array.isArray(dashboard.weeklyProgress) && dashboard.weeklyProgress.length > 0) {
          RhythmCache.set('7d', dashboard.weeklyProgress, user.id);
          setRhythmData(dashboard.weeklyProgress);
        }
      }
      setState({ loading: false, error: '', dashboard });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: current.dashboard ? '' : (error.userMessage || 'Unable to load progress analytics.'),
      }));
    }
  };

  // Background silent fetch for 7-day weekly rhythm data - NO blocking loaders, seamless UI
  const fetchRhythmsInBackground = useCallback(() => {
    const userId = user?.id;
    dashboardService.rhythm(7).then((res7d) => {
      if (Array.isArray(res7d) && res7d.length > 0) {
        RhythmCache.set('7d', res7d, userId);
        setRhythmData(res7d);
      }
    }).catch(() => {});
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load(Boolean(DashboardCache.get(user?.id)));
      fetchRhythmsInBackground();
    }, [user?.id, fetchRhythmsInBackground])
  );

  // Sync with dashboard summary if updated
  useEffect(() => {
    if (state.dashboard?.weeklyProgress?.length) {
      RhythmCache.set('7d', state.dashboard.weeklyProgress, user?.id);
      setRhythmData(state.dashboard.weeklyProgress);
    }
  }, [state.dashboard?.weeklyProgress, user?.id]);

  const d = state.dashboard;
  const progress = d?.progress || {};
  const stats = d?.statistics || {};
  const activeRhythm = rhythmData || [];

  // Level & XP calculations (500 XP per level)
  const xp = progress.xp || 0;
  const level = progress.level || Math.max(1, Math.floor(xp / 500) + 1);
  const currentLevelBaseXp = (level - 1) * 500;
  const nextLevelXp = level * 500;
  const levelXpProgress = Math.max(0, xp - currentLevelBaseXp);
  const levelPercentage = Math.min(100, Math.max(0, (levelXpProgress / 500) * 100));

  // Determine current CEFR Level
  const currentCefr = CEFR_LEVELS.find((c) => xp >= c.minXp && xp < c.maxXp) || CEFR_LEVELS[CEFR_LEVELS.length - 1];
  const nextCefrIndex = CEFR_LEVELS.findIndex((c) => c.code === currentCefr.code) + 1;
  const nextCefr = nextCefrIndex < CEFR_LEVELS.length ? CEFR_LEVELS[nextCefrIndex] : null;
  const cefrRange = currentCefr.maxXp - currentCefr.minXp;
  const cefrProgress = Math.min(100, Math.max(0, ((xp - currentCefr.minXp) / cefrRange) * 100));

  // Calibrated 6-Dimensional Skill Breakdown calculations
  const hasActivity = (stats.speakingSessions || 0) > 0 || (stats.grammarExercises || 0) > 0 || (stats.vocabularyLearned || 0) > 0 || (stats.completedLessons || 0) > 0 || (stats.totalStudyHours || 0) > 0;
  const accuracy = stats.averageScore || 0;

  const speakingScore = hasActivity
    ? Math.min(100, Math.round(accuracy ? (accuracy * 0.7 + Math.min(30, (stats.speakingSessions || 0) * 3)) : Math.min(85, Math.max(15, (stats.speakingSessions || 0) * 10))))
    : 0;

  const grammarScore = hasActivity
    ? Math.min(100, Math.round((stats.grammarExercises || 0) > 0 ? Math.min(95, 35 + (stats.grammarExercises || 0) * 5) : 0))
    : 0;

  const vocabScore = hasActivity
    ? Math.min(100, Math.round((stats.vocabularyLearned || 0) > 0 ? Math.min(95, 25 + (stats.vocabularyLearned || 0) * 2.5) : 0))
    : 0;

  const pronunciationScore = hasActivity
    ? Math.min(100, Math.round((stats.speakingSessions || 0) > 0 ? (accuracy ? accuracy * 0.95 : Math.min(90, 40 + (stats.speakingSessions || 0) * 4)) : 0))
    : 0;

  const listeningScore = hasActivity
    ? Math.min(100, Math.round((stats.completedLessons || 0) > 0 ? Math.min(95, 30 + (stats.completedLessons || 0) * 5) : 0))
    : 0;

  const currentStreak = Number(progress.currentStreak || progress.streak || stats.currentStreak || 0);
  const staminaScore = hasActivity
    ? Math.min(100, Math.round(Math.min(99, currentStreak * 8 + (stats.totalStudyHours || 0) * 6)))
    : 0;

  const getSkillStatus = (score) => {
    if (score === 0) return 'Calibrating';
    if (score >= 85) return 'Strong';
    if (score >= 70) return 'Proficient';
    if (score >= 45) return 'Developing';
    return 'Starting';
  };

  const skillMatrix = [
    { name: 'Speaking Fluency', score: speakingScore, icon: 'mic', color: '#6366F1', status: getSkillStatus(speakingScore) },
    { name: 'Grammar Accuracy', score: grammarScore, icon: 'text', color: '#10B981', status: getSkillStatus(grammarScore) },
    { name: 'Vocabulary Lexicon', score: vocabScore, icon: 'library', color: '#F59E0B', status: getSkillStatus(vocabScore) },
    { name: 'Pronunciation Clarity', score: pronunciationScore, icon: 'volume-high', color: '#EC4899', status: getSkillStatus(pronunciationScore) },
    { name: 'Audio Comprehension', score: listeningScore, icon: 'ear', color: '#06B6D4', status: getSkillStatus(listeningScore) },
    { name: 'Conversation Stamina', score: staminaScore, icon: 'speedometer', color: '#8B5CF6', status: getSkillStatus(staminaScore) },
  ];

  // Scale chart
  const maxMins = Math.max(20, ...activeRhythm.map((d) => d.studyMinutes || 0));
  const totalRhythmMinutes = activeRhythm.reduce((acc, curr) => acc + (curr.studyMinutes || 0), 0);

  return (
    <Screen title="Progress & Analytics" subtitle="Track your CEFR proficiency, skills, and learning rhythm.">
      <StateView loading={state.loading} error={state.error} onRetry={load}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          
          {/* CEFR Level Banner */}
          <LinearGradient
            colors={['#1E1B4B', '#312E81', '#4338CA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cefrBanner}
          >
            <View style={styles.cefrTopRow}>
              <View>
                <View style={styles.cefrTagRow}>
                  <View style={[styles.cefrBadge, { backgroundColor: currentCefr.color }]}>
                    <Text style={styles.cefrBadgeText}>{currentCefr.code}</Text>
                  </View>
                  <Text style={styles.cefrLevelTitle}>{currentCefr.name}</Text>
                </View>
                <Text style={styles.cefrSubtitle}>{currentCefr.desc}</Text>
              </View>
              <View style={styles.xpCircle}>
                <Text style={styles.xpCircleVal}>{xp}</Text>
                <Text style={styles.xpCircleLbl}>Total XP</Text>
              </View>
            </View>

            {nextCefr && (
              <View style={styles.cefrProgressSection}>
                <View style={styles.cefrProgressLabelRow}>
                  <Text style={styles.cefrNextTargetText}>Target: {nextCefr.code} ({nextCefr.name})</Text>
                  <Text style={styles.cefrPercentText}>{cefrProgress.toFixed(0)}%</Text>
                </View>
                <View style={styles.cefrBarBg}>
                  <LinearGradient
                    colors={['#38BDF8', '#818CF8', '#C084FC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.cefrBarFill, { width: `${cefrProgress}%` }]}
                  />
                </View>
                <Text style={styles.cefrRemainingText}>
                  Earn {Math.max(0, currentCefr.maxXp - xp)} more XP to advance to {nextCefr.code}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Level & Streak Stats Ribbon */}
          <View style={styles.ribbonRow}>
            {/* Level Box */}
            <Card style={[styles.ribbonCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.ribbonCardHeader}>
                <View style={[styles.ribbonIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="sparkles" size={18} color="#6366F1" />
                </View>
                <Text style={[styles.ribbonValue, { color: theme.textPrimary }]}>Lvl {level}</Text>
              </View>
              <Text style={[styles.ribbonLabel, { color: theme.textSecondary }]}>Level Progress ({levelPercentage.toFixed(0)}%)</Text>
              <View style={[styles.ribbonBarBg, isDark && { backgroundColor: '#334155' }]}>
                <View style={[styles.ribbonBarFill, { width: `${levelPercentage}%`, backgroundColor: '#6366F1' }]} />
              </View>
            </Card>

            {/* Streak & Freeze Box */}
            <Card style={[styles.ribbonCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.ribbonCardHeader}>
                <View style={[styles.ribbonIconCircle, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="flame" size={20} color="#F97316" />
                </View>
                <Text style={[styles.ribbonValue, { color: '#F97316' }]}>
                  {Math.max(1, Number(progress.currentStreak || progress.streak || stats.currentStreak || 1))} Days
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.ribbonLabel, { color: theme.textSecondary }]}>
                  Best: {Math.max(1, Number(progress.longestStreak || stats.longestStreak || progress.currentStreak || 1))}d
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#06B6D4' }}>❄️ Shield Active</Text>
              </View>
            </Card>
          </View>

          {/* 6-Dimensional Skill Breakdown */}
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Core Skill Competencies</Text>
          <Card style={[styles.skillsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            {skillMatrix.map((skill, index) => (
              <View key={index} style={[styles.skillItem, index !== skillMatrix.length - 1 && { borderBottomColor: isDark ? '#334155' : '#F1F5F9', borderBottomWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.skillIconCircle, { backgroundColor: `${skill.color}15` }]}>
                      <Ionicons name={skill.icon} size={16} color={skill.color} />
                    </View>
                    <Text style={[styles.skillName, { color: theme.textPrimary }]}>{skill.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.skillStatusBadge, { backgroundColor: `${skill.color}15` }]}>
                      <Text style={[styles.skillStatusText, { color: skill.color }]}>{skill.status}</Text>
                    </View>
                    <Text style={[styles.skillScore, { color: theme.textPrimary }]}>{skill.score}%</Text>
                  </View>
                </View>
                <View style={[styles.skillBarBg, isDark && { backgroundColor: '#334155' }]}>
                  <View style={[styles.skillBarFill, { width: `${skill.score}%`, backgroundColor: skill.color }]} />
                </View>
              </View>
            ))}
          </Card>

          {/* Weekly Practice Rhythm & Goal Tracker */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 }}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 0, marginTop: 0 }]}>
              Weekly Rhythm ({totalRhythmMinutes} mins)
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>🎯 Daily Goal: 20m</Text>
          </View>

          <Card style={[styles.chartCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                Daily Speaking & Practice Minutes
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>Mon – Sun</Text>
            </View>

            <View style={styles.barChartContainer}>
              {activeRhythm.map((item, index) => {
                const barHeight = ((item.studyMinutes || 0) / maxMins) * 110;
                const isGoalMet = (item.studyMinutes || 0) >= 20;
                return (
                  <View key={index} style={styles.chartColumn}>
                    <View style={styles.barWrapper}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(6, barHeight),
                            backgroundColor: isGoalMet ? '#10B981' : COLORS.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartDayText, { color: theme.textSecondary }]}>{item.day || `D${index + 1}`}</Text>
                    <Text style={[styles.chartMinText, { color: isGoalMet ? '#10B981' : theme.textSecondary }]}>
                      {item.studyMinutes || 0}m
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Lifetime Learning Statistics */}
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 14 }]}>Lifetime Milestones</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="time" size={18} color="#6366F1" />
              </View>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.totalStudyHours || 0}h</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Study Hours</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="mic" size={18} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.speakingSessions || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Speaking Chats</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="library" size={18} color="#EC4899" />
              </View>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.vocabularyLearned || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Words Mastered</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="text" size={18} color="#F59E0B" />
              </View>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.grammarExercises || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Grammar Checks</Text>
            </View>
          </View>

          {/* AI Smart Action Recommendations */}
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 8 }]}>AI Practice Recommendations</Text>
          <Card style={[styles.aiCard, { backgroundColor: isDark ? '#1E1B4B' : '#F5F3FF', borderColor: '#C4B5FD' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.aiTitle, { color: isDark ? '#EDE9FE' : '#4C1D95' }]}>Next High-Yield Practice Steps</Text>
                <Text style={[styles.aiDesc, { color: isDark ? '#C4B5FD' : '#5B21B6' }]}>
                  • Practice 1 real-world conversation scenario to strengthen Speaking Stamina.{'\n'}
                  • Review 10 flashcards in Vocabulary to unlock your next CEFR badge.{'\n'}
                  • Explore Verb Tenses in the Grammar Handbook.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.aiActionBtn}
              onPress={() => navigation.navigate('Achievements')}
              activeOpacity={0.85}
            >
              <Text style={styles.aiActionBtnText}>View Medal Showcase & Achievements 🏆</Text>
            </TouchableOpacity>
          </Card>

          <View style={{ height: 30 }} />
        </ScrollView>
      </StateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  cefrBanner: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cefrTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cefrTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  cefrBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cefrBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  cefrLevelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  cefrSubtitle: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: width * 0.55,
    lineHeight: 16,
  },
  xpCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpCircleVal: {
    color: '#FDE047',
    fontSize: 17,
    fontWeight: '900',
  },
  xpCircleLbl: {
    color: '#E0E7FF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cefrProgressSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12,
  },
  cefrProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cefrNextTargetText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  cefrPercentText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '900',
  },
  cefrBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  cefrBarFill: {
    height: 8,
    borderRadius: 4,
  },
  cefrRemainingText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '600',
  },
  ribbonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  ribbonCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
  },
  ribbonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ribbonIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  ribbonLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  ribbonBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  ribbonBarFill: {
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skillsCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  skillItem: {
    paddingVertical: 10,
  },
  skillIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillName: {
    fontSize: 13,
    fontWeight: '800',
  },
  skillStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  skillStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  skillScore: {
    fontSize: 13,
    fontWeight: '900',
    width: 36,
    textAlign: 'right',
  },
  skillBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginTop: 2,
  },
  skillBarFill: {
    height: 6,
    borderRadius: 3,
  },
  timeframeToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
  },
  timeframeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeframeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  timeframeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  timeframeTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  chartCard: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingHorizontal: 6,
  },
  chartColumn: {
    alignItems: 'center',
  },
  barWrapper: {
    height: 110,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  chartDayText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  chartMinText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 50) / 2,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  aiCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  aiDesc: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  aiActionBtn: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  aiActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
