import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { useDrawer } from '../../context/DrawerContext';
import { useNotifications } from '../../context/NotificationContext';
import { isImageUri } from '../../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);
const SWIPE_THRESHOLD = 80;

// ─── Navigation items definition ─────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { key: 'Dashboard',  label: 'Dashboard',          icon: 'home',               tab: 'Dashboard' },
      { key: 'Speaking',   label: 'Speaking Practice',  icon: 'mic',                tab: 'Speaking' },
      { key: 'AIChat',     label: 'AI Chat',            icon: 'sparkles',           tab: 'AIChat' },
    ],
  },
  {
    title: 'Learn',
    items: [
      { key: 'Lessons',     label: 'Lessons',            icon: 'library',            tab: 'Lessons' },
      { key: 'Vocabulary',  label: 'Vocabulary',         icon: 'book',               tab: 'Vocabulary' },
      { key: 'Grammar',     label: 'Grammar',            icon: 'create',             tab: 'Grammar' },
    ],
  },
  {
    title: 'Progress',
    items: [
      { key: 'Progress',       label: 'Progress',       icon: 'stats-chart',        tab: 'Progress' },
      { key: 'Achievements',   label: 'Achievements',   icon: 'trophy',             tab: 'Achievements' },
      { key: 'Notifications',  label: 'Notifications',  icon: 'notifications',      tab: 'Notifications' },
    ],
  },
  {
    title: 'Account',
    items: [
      { key: 'Profile',    label: 'Profile',            icon: 'person-circle',      tab: 'Profile' },
      { key: 'Settings',   label: 'Settings',           icon: 'settings',           tab: 'Settings' },
    ],
  },
  {
    title: 'More',
    items: [
      { key: 'Help',       label: 'Help & Support',     icon: 'help-circle',        tab: 'Help' },
      { key: 'About',      label: 'About',              icon: 'information-circle', tab: 'About' },
    ],
  },
];

// Accent colors per section
const ITEM_ACCENT = {
  Dashboard:    '#4F46E5',
  Speaking:     '#7C3AED',
  AIChat:       '#6366F1',
  Lessons:      '#0284C7',
  Vocabulary:   '#059669',
  Grammar:      '#D97706',
  Progress:     '#E11D48',
  Achievements: '#F59E0B',
  Notifications:'#64748B',
  Profile:      '#4F46E5',
  Settings:     '#475569',
  Subscription: '#F59E0B',
  Help:         '#0EA5E9',
  About:        '#8B5CF6',
};

const ROUTE_TO_DRAWER_KEY = {
  SpeakingHome: 'Speaking',
  Conversation: 'Speaking',
  SpeakingSummary: 'Speaking',
  SpeakingHistoryDetail: 'Speaking',
  AIChatHome: 'AIChat',
  ConversationChat: 'AIChat',
  LessonsList: 'Lessons',
  LessonDetail: 'Lessons',
};

function getActiveScreenName(state) {
  if (!state) return 'Dashboard';
  const route = state.routes?.[state.index ?? 0];
  if (!route) return 'Dashboard';
  if (route.state) return getActiveScreenName(route.state);
  const name = route.name || 'Dashboard';
  return ROUTE_TO_DRAWER_KEY[name] || name;
}

// ─── Single drawer item ───────────────────────────────────────────────────────
function DrawerItem({ item, isActive, onPress, isDark, badge }) {
  const scale = useRef(new Animated.Value(1)).current;
  const accent = ITEM_ACCENT[item.key] || '#4F46E5';

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  const baseBg = isDark ? '#1E293B' : '#FFFFFF';
  const baseBorder = isDark ? '#334155' : 'rgba(148, 163, 184, 0.18)';
  const activeBg = isDark ? 'rgba(79, 70, 229, 0.22)' : '#EEF2FF';
  const activeBorder = isDark ? accent : '#C7D2FE';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: `${accent}25`, borderless: false }}
        style={[
          styles.navItem,
          { backgroundColor: baseBg, borderColor: baseBorder },
          isActive && { backgroundColor: activeBg, borderColor: activeBorder }
        ]}
      >
        {/* Icon bubble */}
        <View
          style={[
            styles.navIconBubble,
            isActive
              ? { backgroundColor: accent }
              : { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : `${accent}15` },
          ]}
        >
          <Ionicons
            name={isActive ? item.icon : `${item.icon}-outline`}
            size={18}
            color={isActive ? '#FFFFFF' : (isDark ? '#818CF8' : accent)}
          />
        </View>

        <Text
          style={[
            styles.navLabel,
            isActive
              ? { color: isDark ? '#FFFFFF' : accent, fontWeight: '800' }
              : { color: isDark ? '#94A3B8' : '#374151' },
          ]}
        >
          {item.label}
        </Text>

        {/* Unread badge */}
        {badge > 0 && (
          <View style={styles.notifBadge}>
            <Text style={styles.notifBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}

        {isActive && <View style={[styles.activeIndicator, { backgroundColor: accent }]} />}
      </Pressable>
    </Animated.View>
  );
}

// ─── Drawer Header ────────────────────────────────────────────────────────────
function DrawerHeader({ user, profile, progress, isLoading, isDark, topInset = 0 }) {
  const userFullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const profileFullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
  const displayName = userFullName || profileFullName || 'Learner';

  const getInitials = () => {
    if (!displayName || displayName === 'Learner') return 'SM';
    const parts = displayName.split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  const email   = user?.email   || profile?.email   || '';
  const xp      = progress?.xp ?? profile?.xp ?? user?.xp ?? 0;
  const level   = progress?.level ?? profile?.level ?? user?.level ?? 1;
  const streak  = progress?.currentStreak ?? profile?.currentStreak ?? user?.currentStreak ?? 0;
  const avatar  = user?.avatar  || profile?.avatar;
  const [avatarImgError, setAvatarImgError] = useState(false);

  useEffect(() => {
    setAvatarImgError(false);
  }, [avatar]);

  const levelProgressPct = Math.min(100, Math.max(0, Math.round(((xp % 500) / 500) * 100)));

  const gradientColors = isDark
    ? ['#0F172A', '#1E1B4B', '#312E81']
    : ['#4F46E5', '#4338CA', '#3730A3'];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.headerGradient, { paddingTop: Math.max(topInset, 20) + 12 }]}
    >
      {/* Decorative glowing blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <View style={styles.headerTopRow}>
        {/* Avatar Ring */}
        <View style={styles.avatarRingContainer}>
          <View style={styles.avatarRing}>
            {isImageUri(avatar) && !avatarImgError ? (
              <Image
                source={{ uri: avatar }}
                style={styles.avatarImg}
                onError={() => setAvatarImgError(true)}
              />
            ) : avatar && typeof avatar === 'string' && avatar.trim().length > 0 && !avatarImgError ? (
              <LinearGradient colors={['#818CF8', '#4F46E5']} style={styles.avatarFallback}>
                <Text style={{ fontSize: 28, textAlign: 'center', includeFontPadding: false }}>
                  {avatar}
                </Text>
              </LinearGradient>
            ) : (
              <LinearGradient colors={['#818CF8', '#4F46E5']} style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.onlineBadgeDot} />
        </View>

        {/* User Info */}
        <View style={styles.headerIntro}>
          <Text style={styles.headerTag}>SpeakMate AI Premium</Text>
          <Text style={styles.headerName} numberOfLines={1}>{displayName || 'Learner'}</Text>
          {!!email && (
            <Text style={styles.headerEmail} numberOfLines={1}>{email}</Text>
          )}
        </View>
      </View>

      {/* Level Progress Bar */}
      <View style={styles.levelBarContainer}>
        <View style={styles.levelBarTextRow}>
          <Text style={styles.levelBarLabel}>Level {level} Progress</Text>
          <Text style={styles.levelBarPct}>{Math.round(levelProgressPct)}%</Text>
        </View>
        <View style={styles.levelBarBg}>
          <View style={[styles.levelBarFill, { width: `${levelProgressPct}%` }]} />
        </View>
      </View>

      {/* Stats Chips Row */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Ionicons name="flash" size={13} color="#FCD34D" />
          <Text style={styles.statPillText}>{xp} XP</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="trophy" size={13} color="#818CF8" />
          <Text style={styles.statPillText}>Lv {level}</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="flame" size={13} color="#F97316" />
          <Text style={styles.statPillText}>{streak}d Streak</Text>
        </View>
        {isLoading && (
          <View style={styles.statPill}>
            <Ionicons name="refresh" size={13} color="#F8FAFC" />
            <Text style={styles.statPillText}>Syncing</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

// ─── Main Drawer Sidebar ────────────────────────────────────────────────
export default function DrawerSidebar({ navigation, activeScreen }) {
  const { user, logout } = useContext(AuthContext);
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    profile,
    progress,
    isSyncing: isSummaryLoading,
    refreshSummary,
  } = useDrawer();
  const { unreadCount, refreshUnread } = useNotifications();

  const currentScreen = activeScreen || getActiveScreenName(useNavigationState((state) => state));

  useEffect(() => {
    if (!profile || !progress) {
      refreshSummary();
    }
    // Refresh unread count whenever sidebar becomes visible
    refreshUnread();
  }, [profile, progress, refreshSummary]);

  // ── Navigation handler ──
  const handleNav = (item) => {
    if (navigation?.closeDrawer) {
      navigation.closeDrawer();
    }
    const bottomKeyToTab = {
      Dashboard: 'Dashboard',
      Speaking: 'Speaking',
      AIChat: 'AIChat',
      Profile: 'Profile',
    };

    if (bottomKeyToTab[item.key]) {
      navigation.navigate('BottomTabs', {
        screen: bottomKeyToTab[item.key],
      });
      return;
    }

    navigation.navigate(item.key);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            if (navigation?.closeDrawer) {
              navigation.closeDrawer();
            }
            try { await logout(); } catch (_) {}
          },
        },
      ],
    );
  };

  const isStudentUser = Boolean(
    user?.accountType === 'STUDENT' ||
    user?.role === 'STUDENT' ||
    user?.schoolId ||
    user?.schoolCode
  );

  const isProUser = !isStudentUser && Boolean(user?.isPro || user?.pro);

  const navSections = useMemo(() => {
    return NAV_SECTIONS.map((sec) => {
      let items = [...sec.items];
      if (sec.title === 'Account') {
        if (!isStudentUser) {
          items.push({
            key: 'Subscription',
            label: isProUser ? '⭐ Manage Pro Subscription' : '⭐ Subscription & Pro',
            icon: 'diamond',
            tab: 'Subscription',
          });
        }
      }
      return { ...sec, items };
    });
  }, [isStudentUser, isProUser]);

  const containerBg = isDark ? '#0F172A' : '#F8FAFC';
  const sectionTitleColor = isDark ? '#64748B' : '#94A3B8';
  const dividerColor = isDark ? '#334155' : '#E2E8F0';

  return (
    <View style={[styles.nativeDrawerContainer, { backgroundColor: containerBg }]}>
      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: (insets.top || 20) + 12 }]}
        onPress={() => navigation?.closeDrawer && navigation.closeDrawer()}
      >
        <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      {/* Header */}
      <DrawerHeader
        user={user}
        profile={profile}
        progress={progress}
        isLoading={isSummaryLoading}
        isDark={isDark}
        topInset={insets.top}
      />

      {/* Scrollable nav items */}
      <ScrollView
        style={[styles.navScroll, { backgroundColor: containerBg }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {navSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>{section.title}</Text>
            {section.items.map((item) => (
              <DrawerItem
                key={item.key}
                item={item}
                isActive={currentScreen === item.key}
                onPress={() => handleNav(item)}
                isDark={isDark}
                badge={item.key === 'Notifications' ? unreadCount : 0}
              />
            ))}
          </View>
        ))}

        {/* Pro Upgrade Banner for Individual Free Users */}
        {!isStudentUser && !isProUser && (
          <TouchableOpacity
            onPress={() => {
              if (navigation?.closeDrawer) navigation.closeDrawer();
              navigation.navigate('Subscription');
            }}
            style={styles.proUpgradeBanner}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proUpgradeGradient}
            >
              <View style={styles.proUpgradeIconRow}>
                <Ionicons name="sparkles" size={16} color="#FBBF24" />
                <Text style={styles.proUpgradeTitle}>Upgrade to Pro</Text>
              </View>
              <Text style={styles.proUpgradeSubtitle}>
                Unlock unlimited AI drills from ₹149/mo
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Pro Active Card for Individual Pro Users */}
        {!isStudentUser && isProUser && (
          <TouchableOpacity
            onPress={() => {
              if (navigation?.closeDrawer) navigation.closeDrawer();
              navigation.navigate('Subscription');
            }}
            style={styles.proUpgradeBanner}
          >
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proUpgradeGradient}
            >
              <View style={styles.proUpgradeIconRow}>
                <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.proUpgradeTitle}>SpeakMate Pro Active ⭐</Text>
              </View>
              <Text style={styles.proUpgradeSubtitle}>
                Unlimited 24/7 AI Speaking & Grammar Doctor
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Motivational Tip Card */}
        <LinearGradient
          colors={isDark ? ['#1E293B', '#0F172A'] : ['#EEF2FF', '#F8FAFC']}
          style={[styles.motivationCard, { borderColor: isDark ? '#334155' : '#E0E7FF' }]}
        >
          <View style={styles.motivationIconRow}>
            <Ionicons name="sparkles" size={16} color={isDark ? '#818CF8' : '#4F46E5'} />
            <Text style={[styles.motivationTitle, !isDark && { color: '#4F46E5' }]}>Daily Tip</Text>
          </View>
          <Text style={[styles.motivationText, !isDark && { color: '#475569' }]}>
            "Practice speaking 10 minutes every day to build confidence fast!"
          </Text>
        </LinearGradient>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          android_ripple={{ color: '#FEE2E218', borderless: false }}
          style={[
            styles.logoutBtn,
            !isDark && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }
          ]}
        >
          <View style={[styles.logoutIconBubble, !isDark && { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </View>
          <Text style={styles.logoutLabel}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  nativeDrawerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },

  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#F8FAFC',
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderRightWidth: 1,
    borderRightColor: 'rgba(79, 70, 229, 0.08)',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 24,
    overflow: 'hidden',
  },

  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Header ──
  headerGradient: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  blob1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(99,102,241,0.22)',
    top: -40,
    right: -40,
  },
  blob2: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(67,56,202,0.3)',
    bottom: -20,
    left: -30,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarRingContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  headerIntro: {
    flex: 1,
  },
  headerTag: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerEmail: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  levelBarContainer: {
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  levelBarTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  levelBarLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  levelBarPct: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '800',
  },
  levelBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  statPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Nav scroll area ──
  navScroll: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  section: {
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 6,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  navIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  activeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    position: 'absolute',
    right: 8,
  },

  // ── Pro Upgrade Banner ──
  proUpgradeBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  proUpgradeGradient: {
    padding: 14,
    borderRadius: 18,
  },
  proUpgradeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  proUpgradeTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  proUpgradeSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Motivation Card ──
  motivationCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  motivationIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  motivationTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  motivationText: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },

  // ── Footer ──
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 20,
    marginVertical: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutLabel: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Notification badge ──
  notifBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 'auto',
    marginRight: 4,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
