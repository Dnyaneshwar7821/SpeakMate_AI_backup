import React, { useCallback, useContext, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen, StateView } from '../../components/ui';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { settingsService, onboardingService, profileService } from '../../services/appServices';
import { VoiceService, VOICE_PROFILES } from '../../services/VoiceService';
import { OnboardingVoiceService } from '../../services/OnboardingVoiceService';
import { COLORS } from '../../constants/colors';
import { DashboardCache } from '../../utils/dashboardCache';
import { getAvatarById, getCachedAvatarModel, setCachedAvatarModel } from '../../config/AvatarCatalog';
import { NotificationHelper } from '../../services/NotificationHelper';

const AGE_OPTIONS = [
  { code: 'Kids', label: 'Kids (6-12) 🎈', desc: 'Simple words, fun stories & high encouragement' },
  { code: 'Teens', label: 'Teens (13-17) ⚡', desc: 'School life, pop culture & casual chatter' },
  { code: 'Young Adult', label: 'Young Adults (18-24) 🎓', desc: 'Campus life, travel & interview prep' },
  { code: 'Professional', label: 'Professionals (25-50) 💼', desc: 'Business English, executive tone & presentations' },
  { code: 'Senior', label: 'Seniors (50+) ☕', desc: 'Relaxed conversation, culture & life stories' },
];

const LANGUAGE_OPTIONS = [
  { code: 'English', label: 'English 🇺🇸', native: 'English' },
  { code: 'Spanish', label: 'Spanish 🇪🇸', native: 'Español' },
  { code: 'French', label: 'French 🇫🇷', native: 'Français' },
  { code: 'German', label: 'German 🇩🇪', native: 'Deutsch' },
  { code: 'Japanese', label: 'Japanese 🇯🇵', native: '日本語' },
  { code: 'Chinese', label: 'Chinese 🇨🇳', native: '中文' },
  { code: 'Italian', label: 'Italian 🇮🇹', native: 'Italiano' },
  { code: 'Portuguese', label: 'Portuguese 🇵🇹', native: 'Português' },
  { code: 'Russian', label: 'Russian 🇷🇺', native: 'Русский' },
  { code: 'Korean', label: 'Korean 🇰🇷', native: '한국어' },
  { code: 'Hindi', label: 'Hindi 🇮🇳', native: 'हिन्दी' },
  { code: 'Arabic', label: 'Arabic 🇦🇪', native: 'العربية' },
  { code: 'Dutch', label: 'Dutch 🇳🇱', native: 'Nederlands' },
  { code: 'Turkish', label: 'Turkish 🇹🇷', native: 'Türkçe' },
  { code: 'Vietnamese', label: 'Vietnamese 🇻🇳', native: 'Tiếng Việt' },
  { code: 'Swedish', label: 'Swedish 🇸🇪', native: 'Svenska' },
  { code: 'Polish', label: 'Polish 🇵🇱', native: 'Polski' },
];

const defaults = {
  darkMode: false,
  notificationsEnabled: true,
  language: 'English',
  aiVoice: 'Default',
  ageGroup: 'Professional',
  soundEffects: true,
  autoPlayAudio: false,
  dailyReminder: true,
};

export default function SettingsScreen({ navigation }) {
  const { user, updateUser } = useContext(AuthContext);
  const { isDark: globalIsDark, setDarkMode } = useTheme();
  const { showToast } = useToast();
  const [form, setForm] = useState(defaults);
  const [state, setState] = useState({ loading: true, error: '' });
  const [saving, setSaving] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  
  // Search text for language modal
  const [languageSearch, setLanguageSearch] = useState('');

  // Onboarding voice style fallback for system default
  const [onboardingVoiceStyle, setOnboardingVoiceStyle] = useState('Friendly');

  // Modals visibility
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);

  const [accountType, setAccountType] = useState(() => user?.accountType || (user?.role === 'STUDENT' ? 'STUDENT' : 'INDIVIDUAL_USER'));
  const isStudent = Boolean(
    accountType === 'STUDENT' ||
    user?.role === 'STUDENT' ||
    user?.accountType === 'STUDENT' ||
    user?.schoolId ||
    user?.schoolCode
  );

  const [currentAvatarModel, setCurrentAvatarModel] = useState(() => getCachedAvatarModel() || 'haru');
  const [justSaved, setJustSaved] = useState(false);

  // Saved baseline to distinguish pending draft changes from persisted preferences (Hybrid UX)
  const [savedBaseline, setSavedBaseline] = useState({
    language: defaults.language,
    aiVoice: defaults.aiVoice,
    ageGroup: defaults.ageGroup,
  });

  const savedBaselineRef = useRef({
    language: defaults.language,
    aiVoice: defaults.aiVoice,
    ageGroup: defaults.ageGroup,
  });
  const savedAvatarRef = useRef(getCachedAvatarModel() || 'haru');

  const load = async () => {
    try {
      setJustSaved(false);
      const [
        settings,
        voices,
        onboardingVoice,
        onboardingData,
        savedType,
        savedVoice,
        savedAvatarModel,
        savedAutoPlay,
        savedSound,
        savedNotif,
        savedReminder,
      ] = await Promise.all([
        settingsService.get().catch(() => null),
        VoiceService.getAvailableEnglishVoices(),
        AsyncStorage.getItem('speakmate_onboarding_voice'),
        onboardingService.get().catch(() => null),
        AsyncStorage.getItem('speakmate_account_type'),
        AsyncStorage.getItem('speakmate_selected_voice'),
        AsyncStorage.getItem('speakmate_avatar_model'),
        AsyncStorage.getItem('speakmate_auto_play_audio'),
        AsyncStorage.getItem('speakmate_sound_effects'),
        AsyncStorage.getItem('speakmate_notifications_enabled'),
        AsyncStorage.getItem('speakmate_daily_reminder'),
      ]);
      if (savedType) setAccountType(savedType);
      if (savedAvatarModel) {
        setCurrentAvatarModel(savedAvatarModel);
        setCachedAvatarModel(savedAvatarModel);
        savedAvatarRef.current = savedAvatarModel;
      }
      const effectiveVoice = savedVoice || settings?.aiVoice || defaults.aiVoice;
      const initialAgeGroup = onboardingData?.ageGroup || user?.ageGroup || 'Professional';
      const initialLanguage = settings?.language || defaults.language;
      const effAutoPlay = savedAutoPlay !== null ? savedAutoPlay === 'true' : (settings?.autoPlayAudio ?? false);
      const effSound = savedSound !== null ? savedSound === 'true' : (settings?.soundEffects ?? true);
      const effNotif = savedNotif !== null ? savedNotif === 'true' : (settings?.notificationsEnabled ?? true);
      const effReminder = savedReminder !== null ? savedReminder === 'true' : (settings?.dailyReminder ?? true);

      const baseline = {
        language: initialLanguage,
        aiVoice: effectiveVoice,
        ageGroup: initialAgeGroup,
      };

      setForm({
        ...defaults,
        ...settings,
        language: initialLanguage,
        darkMode: globalIsDark,
        aiVoice: effectiveVoice,
        ageGroup: initialAgeGroup,
        autoPlayAudio: effAutoPlay,
        soundEffects: effSound,
        notificationsEnabled: effNotif,
        dailyReminder: effReminder,
      });

      setSavedBaseline(baseline);
      savedBaselineRef.current = baseline;

      setAvailableVoices(voices);
      if (onboardingVoice) {
        setOnboardingVoiceStyle(onboardingVoice);
      }
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: '' });
    }
  };

  useFocusEffect(
    useCallback(() => {
      // 1. Immediately reset any unsaved in-memory draft on focus
      if (savedBaselineRef.current) {
        setForm((current) => ({
          ...current,
          language: savedBaselineRef.current.language,
          aiVoice: savedBaselineRef.current.aiVoice,
          ageGroup: savedBaselineRef.current.ageGroup,
        }));
      }
      if (savedAvatarRef.current) {
        setCurrentAvatarModel(savedAvatarRef.current);
        setCachedAvatarModel(savedAvatarRef.current);
      }

      load();

      // 2. Discard uncommitted changes immediately when leaving/escaping screen
      return () => {
        if (savedBaselineRef.current) {
          setForm((current) => ({
            ...current,
            language: savedBaselineRef.current.language,
            aiVoice: savedBaselineRef.current.aiVoice,
            ageGroup: savedBaselineRef.current.ageGroup,
          }));
        }
        if (savedAvatarRef.current) {
          setCurrentAvatarModel(savedAvatarRef.current);
          setCachedAvatarModel(savedAvatarRef.current);
        }
      };
    }, [])
  );

  const update = (key, value) => {
    setJustSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      // 1. Save Settings (Dark Mode, Voice, Language, Sound Effects, Reminders)
      const savedSettings = await settingsService.update({ ...form, darkMode: globalIsDark });
      if (savedSettings && savedSettings.darkMode !== undefined) {
        await setDarkMode(savedSettings.darkMode);
      }

      // 2. Sync Voice and Avatar to AsyncStorage
      // Regional voice selection in Settings ALWAYS automatically switches avatar model to:
      // - Male Teacher ('chitose') for male regional voices
      // - Female Teacher ('haru') for female regional voices
      if (form.aiVoice) {
        const profile = VOICE_PROFILES.find((p) => p.code === form.aiVoice);
        await AsyncStorage.setItem('speakmate_selected_voice', form.aiVoice);
        await AsyncStorage.setItem('speakmate_ai_voice', form.aiVoice);
        const coachGender = profile?.gender || 'female';
        const coachModel = coachGender === 'male' ? 'chitose' : 'haru';
        await AsyncStorage.setItem('speakmate_voice_gender', coachGender);
        await AsyncStorage.setItem('speakmate_avatar_model', coachModel);
        setCachedAvatarModel(coachModel);
        setCurrentAvatarModel(coachModel);
      }

      // 3. Sync Age Group via Profile Service, Onboarding Service, AuthContext & AsyncStorage
      if (form.ageGroup && !isStudent) {
        await AsyncStorage.setItem('speakmate_age_group', form.ageGroup);
        await profileService.update({
          firstName: user?.firstName,
          lastName: user?.lastName,
          email: user?.email,
          ageGroup: form.ageGroup,
        }).catch((e) => console.warn('Profile age sync warning:', e));
        await onboardingService.update({ ageGroup: form.ageGroup }).catch((e) => console.warn('Onboarding age sync warning:', e));
        if (updateUser) {
          await updateUser({ ageGroup: form.ageGroup });
        }
      }

      // 4. Update saved baseline to reflect committed values
      const committedBaseline = {
        language: form.language,
        aiVoice: form.aiVoice,
        ageGroup: form.ageGroup,
      };
      setSavedBaseline(committedBaseline);
      savedBaselineRef.current = committedBaseline;
      if (form.aiVoice) {
        const profile = VOICE_PROFILES.find((p) => p.code === form.aiVoice);
        const coachModel = (profile?.gender || 'female') === 'male' ? 'chitose' : 'haru';
        savedAvatarRef.current = coachModel;
      }

      // 5. Sync behavioral toggles to local storage and schedule device notifications
      await Promise.all([
        AsyncStorage.setItem('speakmate_auto_play_audio', String(form.autoPlayAudio)),
        AsyncStorage.setItem('speakmate_sound_effects', String(form.soundEffects)),
        AsyncStorage.setItem('speakmate_notifications_enabled', String(form.notificationsEnabled)),
        AsyncStorage.setItem('speakmate_daily_reminder', String(form.dailyReminder)),
      ]).catch(() => {});

      if (form.notificationsEnabled && form.dailyReminder) {
        NotificationHelper.scheduleDailyReminder(true).catch(() => {});
      } else {
        NotificationHelper.scheduleDailyReminder(false).catch(() => {});
      }

      setJustSaved(true);
      setTimeout(() => {
        setJustSaved(false);
      }, 3500);

      DashboardCache.clear();
      showToast('Preferences Saved ✓', 'success', 'All tutor voice and language settings updated');
    } catch (error) {
      console.error('Settings save error:', error);
      showToast('Save Failed', 'error', error.response?.data?.message || error.userMessage || 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const isDark = globalIsDark;
  const labelColor = isDark ? '#F1F5F9' : '#0F172A';
  const sublabelColor = isDark ? '#94A3B8' : '#64748B';
  const dividerColor = isDark ? '#334155' : '#F1F5F9';
  const modalBg = isDark ? '#1E293B' : '#FFFFFF';
  const optionActiveBg = isDark ? '#334155' : '#EEF2FF';

  // Badges & pending highlight colors
  const pendingBadgeBg = isDark ? '#451A03' : '#FEF3C7';
  const pendingBadgeBorder = isDark ? '#92400E' : '#F59E0B';
  const pendingBadgeTextColor = isDark ? '#FDE68A' : '#B45309';

  // Track pending changes that require explicit Save
  const pendingChanges = [];
  if (form.language !== savedBaseline.language) pendingChanges.push('Language Focus');
  if (form.aiVoice !== savedBaseline.aiVoice) pendingChanges.push('Voice Accent');
  if (!isStudent && form.ageGroup !== savedBaseline.ageGroup) pendingChanges.push('Age Group');
  const hasPendingChanges = pendingChanges.length > 0;

  const isMaleTutor = VoiceService.getAvatarGender(form.aiVoice, onboardingVoiceStyle) === 'male';
  const activeAvatar = getAvatarById(
    form.aiVoice !== savedBaseline.aiVoice
      ? (isMaleTutor ? 'chitose' : 'haru')
      : (currentAvatarModel || (isMaleTutor ? 'chitose' : 'haru'))
  ) || getAvatarById('haru');
  const isCharacterAvatar = currentAvatarModel && currentAvatarModel !== 'haru' && currentAvatarModel !== 'chitose';

  // Filtered languages based on search query
  const filteredLanguages = LANGUAGE_OPTIONS.filter((lang) => 
    lang.label.toLowerCase().includes(languageSearch.toLowerCase()) || 
    lang.native.toLowerCase().includes(languageSearch.toLowerCase())
  );

  return (
    <Screen title="Settings" subtitle="Sync learning preferences with your backend account.">
      <StateView loading={state.loading} error={state.error} onRetry={load}>
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* ACTIVE SPEAKING TUTOR STATUS CARD */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              try {
                navigation.navigate('BottomTabs', { screen: 'Profile' });
              } catch (_) {
                navigation.navigate('Profile');
              }
            }}
          >
            <Card style={[styles.statusCard, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={styles.statusContainer}>
                <View style={[styles.avatarBg, { backgroundColor: isDark ? '#2E224F' : '#F3E8FF' }]}>
                  {activeAvatar?.thumbnail || activeAvatar?.image ? (
                    <Image source={activeAvatar.thumbnail || activeAvatar.image} style={styles.tutorThumbImage} resizeMode="contain" />
                  ) : (
                    <Ionicons name="mic-sharp" size={24} color="#7C3AED" />
                  )}
                </View>
                <View style={styles.statusInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={styles.statusLabel}>ACTIVE SPEAKING TUTOR</Text>
                    {form.aiVoice !== savedBaseline.aiVoice && (
                      <View style={[styles.pendingBadgeMini, { backgroundColor: pendingBadgeBg }]}>
                        <Text style={[styles.pendingBadgeMiniText, { color: pendingBadgeTextColor }]}>Pending Save</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.statusVoiceName, { color: labelColor }]} numberOfLines={1}>
                    {activeAvatar.emoji} {activeAvatar.name} ({activeAvatar.gender === 'female' ? 'Female' : 'Male'}) •{' '}
                    {isCharacterAvatar && form.aiVoice === savedBaseline.aiVoice
                      ? `${activeAvatar.name} Signature Voice`
                      : OnboardingVoiceService.isSystemDefault(form.aiVoice)
                      ? 'System Default'
                      : (VOICE_PROFILES.find((o) => o.code === form.aiVoice)?.label || form.aiVoice)}
                  </Text>
                </View>
                <View style={styles.waveContainer}>
                  <View style={[styles.waveBar, { height: 10, backgroundColor: '#7C3AED' }]} />
                  <View style={[styles.waveBar, { height: 22, backgroundColor: '#7C3AED', marginHorizontal: 3 }]} />
                  <View style={[styles.waveBar, { height: 14, backgroundColor: '#7C3AED' }]} />
                  <Ionicons name="chevron-forward" size={16} color={sublabelColor} style={{ marginLeft: 6 }} />
                </View>
              </View>
            </Card>
          </TouchableOpacity>

          {/* CATEGORY 0: SUBSCRIPTION & MEMBERSHIP (FOR INDIVIDUAL USERS ONLY) */}
          {!isStudent && (
            <>
              <View style={styles.sectionHeaderContainer}>
                <Ionicons name="diamond-outline" size={16} color="#D97706" />
                <Text style={[styles.sectionHeader, { color: sublabelColor }]}>Subscription & Plan</Text>
              </View>
              <Card style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }}>
                <TouchableOpacity
                  style={styles.pickerRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Subscription')}
                >
                  <View style={styles.pickerRowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="sparkles" size={18} color="#D97706" />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.rowTitle, { color: labelColor, fontWeight: '800' }]}>
                        {(!isStudent && (user?.isPro || user?.pro)) ? '⭐ SpeakMate Pro Active' : '⭐ Upgrade to Pro'}
                      </Text>
                      <Text style={[styles.rowDesc, { color: sublabelColor }]}>
                        {(!isStudent && (user?.isPro || user?.pro)) ? 'Manage active plan & Razorpay receipts' : 'Unlimited AI Speaking & Accent Coach'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pickerRowRight}>
                    <Text style={[styles.pickerValueText, { color: '#4F46E5', fontWeight: '800' }]}>
                      {(!isStudent && (user?.isPro || user?.pro)) ? 'Manage' : 'View Plans'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={sublabelColor} />
                  </View>
                </TouchableOpacity>
              </Card>
            </>
          )}

          {/* CATEGORY 1: LEARNING & PREFERENCES */}
          <View style={styles.sectionHeaderContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="school-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.sectionHeader, { color: sublabelColor }]}>Learning Preferences</Text>
            </View>
            <View style={[styles.badgeTag, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
              <Text style={[styles.badgeTagText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>Requires Save</Text>
            </View>
          </View>
          <Card style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }}>
            {/* Target Language Selector */}
            <TouchableOpacity 
              style={styles.pickerRow} 
              activeOpacity={0.7}
              onPress={() => {
                setLanguageSearch('');
                setShowLanguageModal(true);
              }}
            >
              <View style={styles.pickerRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#1D2D44' : '#E0F2FE' }]}>
                  <Ionicons name="language" size={18} color="#0284C7" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.rowTitle, { color: labelColor }]}>Language Focus</Text>
                  <Text style={[styles.rowDesc, { color: sublabelColor }]}>Language you are learning</Text>
                </View>
              </View>
              <View style={styles.pickerRowRight}>
                {form.language !== savedBaseline.language && (
                  <View style={[styles.pendingBadge, { backgroundColor: pendingBadgeBg, borderColor: pendingBadgeBorder }]}>
                    <Text style={[styles.pendingBadgeText, { color: pendingBadgeTextColor }]}>Pending</Text>
                  </View>
                )}
                <Text style={styles.pickerValueText} numberOfLines={1} ellipsizeMode="tail">{form.language}</Text>
                <Ionicons name="chevron-forward" size={16} color={sublabelColor} />
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* AI Voice Selector */}
            <TouchableOpacity 
              style={styles.pickerRow} 
              activeOpacity={0.7}
              onPress={() => setShowVoiceModal(true)}
            >
              <View style={styles.pickerRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#2E224F' : '#F3E8FF' }]}>
                  <Ionicons name="volume-medium" size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.rowTitle, { color: labelColor }]}>Voice Accent & Dialect</Text>
                  <Text style={[styles.rowDesc, { color: sublabelColor }]}>
                    {isCharacterAvatar && form.aiVoice === savedBaseline.aiVoice
                      ? `${activeAvatar.name} Signature Voice (Tap to switch tutor)`
                      : 'Audio pronunciation tutor model'}
                  </Text>
                </View>
              </View>
              <View style={styles.pickerRowRight}>
                {form.aiVoice !== savedBaseline.aiVoice && (
                  <View style={[styles.pendingBadge, { backgroundColor: pendingBadgeBg, borderColor: pendingBadgeBorder }]}>
                    <Text style={[styles.pendingBadgeText, { color: pendingBadgeTextColor }]}>Pending</Text>
                  </View>
                )}
                <Text style={styles.pickerValueText} numberOfLines={1} ellipsizeMode="tail">
                  {isCharacterAvatar && form.aiVoice === savedBaseline.aiVoice
                    ? `${activeAvatar.name} Voice`
                    : OnboardingVoiceService.isSystemDefault(form.aiVoice)
                    ? 'System Default'
                    : (VOICE_PROFILES.find((o) => o.code === form.aiVoice)?.label || form.aiVoice)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={sublabelColor} />
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* DYNAMIC ROW: Age Group (Locked for Students with Onboarding Note, Interactive for Individual Users) */}
            {isStudent ? (
              <TouchableOpacity 
                style={[styles.pickerRow, { opacity: 0.65 }]}
                activeOpacity={0.7}
                onPress={() => {
                  Alert.alert(
                    'School Student Mode 🔒',
                    `Your age group and learning curriculum are automatically managed according to your School Standard (${user?.schoolGrade || '1st Std'}) selected during onboarding.`
                  );
                }}
              >
                <View style={styles.pickerRowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF' }]}>
                    <Ionicons name="people" size={18} color="#6366F1" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.rowTitle, { color: labelColor }]}>
                      Age Group 🔒 (Student Mode)
                    </Text>
                    <Text style={[styles.rowDesc, { color: sublabelColor }]}>
                      Auto-configured for {user?.schoolGrade || 'School Standard'} (Selected at Onboarding)
                    </Text>
                  </View>
                </View>
                <View style={styles.pickerRowRight}>
                  <Text style={[styles.pickerValueText, { color: '#6366F1', fontWeight: '700' }]} numberOfLines={1} ellipsizeMode="tail">
                    {user?.schoolGrade || 'Standard Grade'}
                  </Text>
                  <Ionicons name="lock-closed" size={16} color={sublabelColor} />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.pickerRow} 
                activeOpacity={0.7}
                onPress={() => setShowAgeModal(true)}
              >
                <View style={styles.pickerRowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: isDark ? '#3B2E1E' : '#FEF3C7' }]}>
                    <Ionicons name="people" size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.rowTitle, { color: labelColor }]}>
                      Target Age Group
                    </Text>
                    <Text style={[styles.rowDesc, { color: sublabelColor }]}>
                      Personalizes conversation topics & level
                    </Text>
                  </View>
                </View>
                <View style={styles.pickerRowRight}>
                  {form.ageGroup !== savedBaseline.ageGroup && (
                    <View style={[styles.pendingBadge, { backgroundColor: pendingBadgeBg, borderColor: pendingBadgeBorder }]}>
                      <Text style={[styles.pendingBadgeText, { color: pendingBadgeTextColor }]}>Pending</Text>
                    </View>
                  )}
                  <Text style={styles.pickerValueText} numberOfLines={1} ellipsizeMode="tail">
                    {AGE_OPTIONS.find((a) => a.code === form.ageGroup)?.label || form.ageGroup || 'Professional'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={sublabelColor} />
                </View>
              </TouchableOpacity>
            )}
          </Card>

          {/* CATEGORY 2: GENERAL APP BEHAVIOR */}
          <View style={styles.sectionHeaderContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="options-outline" size={16} color="#7C3AED" />
              <Text style={[styles.sectionHeader, { color: sublabelColor }]}>App Behavior</Text>
            </View>
            <View style={[styles.badgeTag, { backgroundColor: isDark ? '#064E3B' : '#DEF7EC' }]}>
              <Text style={[styles.badgeTagText, { color: isDark ? '#6EE7B7' : '#03543F' }]}>Auto-applied</Text>
            </View>
          </View>
          <Card style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }}>
            {/* Auto Play Audio Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#2E224F' : '#F3E8FF' }]}>
                  <Ionicons name="play-circle" size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: labelColor }]}>Auto-play Pronunciation</Text>
                  <Text style={[styles.rowDesc, { color: sublabelColor }]}>Automatically play audio voice clips</Text>
                </View>
              </View>
              <Switch 
                value={Boolean(form.autoPlayAudio)} 
                onValueChange={(value) => {
                  update('autoPlayAudio', value);
                  AsyncStorage.setItem('speakmate_auto_play_audio', String(value)).catch(() => {});
                  settingsService.update({
                    ...form,
                    language: savedBaseline.language,
                    aiVoice: savedBaseline.aiVoice,
                    ageGroup: savedBaseline.ageGroup,
                    autoPlayAudio: value,
                    darkMode: globalIsDark,
                  }).catch(() => {});
                }} 
                trackColor={{ true: COLORS.primary }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* Sound Effects Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#3B1E30' : '#FCE7F3' }]}>
                  <Ionicons name="musical-notes" size={18} color="#EC4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: labelColor }]}>Sound Effects</Text>
                  <Text style={[styles.rowDesc, { color: sublabelColor }]}>Audio effects on correct quiz answers</Text>
                </View>
              </View>
              <Switch 
                value={Boolean(form.soundEffects)} 
                onValueChange={(value) => {
                  update('soundEffects', value);
                  AsyncStorage.setItem('speakmate_sound_effects', String(value)).catch(() => {});
                  settingsService.update({
                    ...form,
                    language: savedBaseline.language,
                    aiVoice: savedBaseline.aiVoice,
                    ageGroup: savedBaseline.ageGroup,
                    soundEffects: value,
                    darkMode: globalIsDark,
                  }).catch(() => {});
                }} 
                trackColor={{ true: COLORS.primary }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* Dark Mode Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                  <Ionicons name="moon" size={18} color={isDark ? '#E2E8F0' : '#475569'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: labelColor }]}>Night Theme Mode</Text>
                  <Text style={[styles.rowDesc, { color: sublabelColor }]}>Toggle dark mode visual layout</Text>
                </View>
              </View>
              <Switch 
                value={Boolean(globalIsDark)} 
                onValueChange={async (value) => {
                  update('darkMode', value);
                  await setDarkMode(value);
                  settingsService.update({
                    ...form,
                    language: savedBaseline.language,
                    aiVoice: savedBaseline.aiVoice,
                    ageGroup: savedBaseline.ageGroup,
                    darkMode: value,
                  }).catch(() => {});
                }} 
                trackColor={{ true: COLORS.primary }}
              />
            </View>
          </Card>

          {/* CATEGORY 3: NOTIFICATIONS */}
          <View style={styles.sectionHeaderContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="notifications-outline" size={16} color="#059669" />
              <Text style={[styles.sectionHeader, { color: sublabelColor }]}>Alerts & Notifications</Text>
            </View>
            <View style={[styles.badgeTag, { backgroundColor: isDark ? '#064E3B' : '#DEF7EC' }]}>
              <Text style={[styles.badgeTagText, { color: isDark ? '#6EE7B7' : '#03543F' }]}>Auto-applied</Text>
            </View>
          </View>
          <Card style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }}>
            {/* Notifications Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#122D25' : '#D1FAE5' }]}>
                  <Ionicons name="notifications" size={18} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: labelColor }]}>Push Notifications</Text>
                  <Text style={[styles.rowDesc, { color: sublabelColor }]}>Receive vocabulary reminders</Text>
                </View>
              </View>
              <Switch 
                value={Boolean(form.notificationsEnabled)} 
                onValueChange={async (value) => {
                  update('notificationsEnabled', value);
                  await AsyncStorage.setItem('speakmate_notifications_enabled', String(value)).catch(() => {});
                  if (value) {
                    const granted = await NotificationHelper.requestPermissions();
                    if (granted) {
                      await NotificationHelper.registerPushToken();
                      if (form.dailyReminder) {
                        await NotificationHelper.scheduleDailyReminder(true);
                      }
                      showToast('Notifications Active ✓', 'success', 'Push notifications enabled');
                    } else {
                      showToast('Permission Needed', 'info', 'Please enable notifications in device settings');
                    }
                  } else {
                    await NotificationHelper.cancelAllReminders();
                    showToast('Notifications Paused', 'info', 'Push notifications turned off');
                  }
                  settingsService.update({
                    ...form,
                    language: savedBaseline.language,
                    aiVoice: savedBaseline.aiVoice,
                    ageGroup: savedBaseline.ageGroup,
                    notificationsEnabled: value,
                    darkMode: globalIsDark,
                  }).catch(() => {});
                }} 
                trackColor={{ true: COLORS.primary }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* Daily Reminder Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#3B2A18' : '#FEF3C7' }]}>
                  <Ionicons name="alarm" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: labelColor }]}>Daily Reminder Alerts</Text>
                  <Text style={[styles.rowDesc, { color: sublabelColor }]}>Maintain your daily study streak (7:00 PM)</Text>
                </View>
              </View>
              <Switch 
                value={Boolean(form.dailyReminder)} 
                onValueChange={async (value) => {
                  update('dailyReminder', value);
                  await AsyncStorage.setItem('speakmate_daily_reminder', String(value)).catch(() => {});
                  if (value) {
                    if (form.notificationsEnabled !== false) {
                      await NotificationHelper.scheduleDailyReminder(true);
                      showToast('Daily Reminder Set ✓', 'success', 'Alert set for 7:00 PM daily');
                    } else {
                      showToast('Turn On Notifications', 'info', 'Enable Push Notifications to receive daily reminders');
                    }
                  } else {
                    await NotificationHelper.scheduleDailyReminder(false);
                    showToast('Daily Reminder Off', 'info', 'Daily study streak reminder cancelled');
                  }
                  settingsService.update({
                    ...form,
                    language: savedBaseline.language,
                    aiVoice: savedBaseline.aiVoice,
                    ageGroup: savedBaseline.ageGroup,
                    dailyReminder: value,
                    darkMode: globalIsDark,
                  }).catch(() => {});
                }} 
                trackColor={{ true: COLORS.primary }}
              />
            </View>
          </Card>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            style={[
              styles.enhancedSaveBtn,
              justSaved && { backgroundColor: '#10B981', shadowColor: '#10B981' }
            ]}
          >
            <Ionicons
              name={justSaved ? "checkmark-circle" : "save-outline"}
              size={20}
              color="#FFFFFF"
              style={styles.saveBtnIcon}
            />
            <Text style={styles.enhancedSaveBtnText}>
              {saving
                ? 'Saving Preferences...'
                : justSaved
                ? 'All Preferences Saved ✓'
                : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ENHANCED LANGUAGE SELECTION MODAL */}
        <Modal
          visible={showLanguageModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
              <View style={[styles.modalHeader, { borderBottomColor: dividerColor }]}>
                <Text style={[styles.modalTitle, { color: labelColor }]}>Select Language</Text>
                <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                  <Ionicons name="close" size={24} color={sublabelColor} />
                </TouchableOpacity>
              </View>

              {/* SEARCH INPUT BAR */}
              <View style={[styles.searchBarContainer, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                <Ionicons name="search" size={18} color={sublabelColor} style={styles.searchIcon} />
                <TextInput
                  value={languageSearch}
                  onChangeText={setLanguageSearch}
                  placeholder="Search languages..."
                  placeholderTextColor={sublabelColor}
                  style={[styles.searchInput, { color: labelColor }]}
                />
                {languageSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setLanguageSearch('')} style={styles.searchClearIcon}>
                    <Ionicons name="close-circle" size={18} color={sublabelColor} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map((item) => {
                    const isSelected = form.language === item.code;
                    return (
                      <TouchableOpacity
                        key={item.code}
                        style={[
                          styles.modalOptionRow, 
                          isSelected && { backgroundColor: optionActiveBg }
                        ]}
                        onPress={() => {
                          update('language', item.code);
                          setShowLanguageModal(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[
                            styles.modalOptionText, 
                            { color: isDark ? '#E2E8F0' : '#475569' },
                            isSelected && { color: COLORS.primary }
                          ]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.modalOptionSubtext, { color: sublabelColor }]}>{item.native}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Ionicons name="search-outline" size={32} color={sublabelColor} />
                    <Text style={[styles.noResultsText, { color: sublabelColor }]}>No languages match search</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* VOICE SELECTION MODAL */}
        <Modal
          visible={showVoiceModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowVoiceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
              <View style={[styles.modalHeader, { borderBottomColor: dividerColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.modalTitle, { color: labelColor }]}>Choose Speaking Tutor Voice</Text>
                  <Text style={{ fontSize: 12, color: sublabelColor, marginTop: 2 }}>
                    Selecting a regional voice switches your active tutor to Female Teacher or Male Teacher.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
                  <Ionicons name="close" size={24} color={sublabelColor} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
                {VOICE_PROFILES.map((profile) => {
                  const isSelected = form.aiVoice === profile.code;
                  return (
                    <TouchableOpacity
                      key={profile.code}
                      style={[
                        styles.modalOptionRow,
                        isSelected && { backgroundColor: optionActiveBg }
                      ]}
                      onPress={async () => {
                        update('aiVoice', profile.code);

                        // Selecting a regional voice switches the draft active tutor to Male or Female Teacher
                        const targetCoach = profile.gender === 'male' ? 'chitose' : 'haru';
                        setCurrentAvatarModel(targetCoach);

                        // Direct UX: Play audio voice preview sample so user hears the accent immediately with teacher avatar
                        if (profile.code === 'Default') {
                          // Load the exact saved onboarding voice config and play it
                          const onboardingConfig = await OnboardingVoiceService.load();
                          const previewMsg = `Hello! I am your ${onboardingConfig.style.toLowerCase()} English tutor.`;
                          VoiceService.speak(previewMsg, {
                            avatarId: targetCoach,
                            voiceType: 'Default',
                            availableVoices,
                          });
                        } else {
                          const previewMsg = `Hello! I'm your ${profile.accent} English tutor.`;
                          VoiceService.speak(previewMsg, {
                            avatarId: targetCoach,
                            voiceType: profile.code,
                            availableVoices,
                          });
                        }

                        setShowVoiceModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          { color: isDark ? '#E2E8F0' : '#475569', flex: 1, paddingRight: 8 },
                          isSelected && { color: COLORS.primary }
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {profile.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* AGE GROUP SELECTION MODAL */}
        <Modal
          visible={showAgeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAgeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
              <View style={[styles.modalHeader, { borderBottomColor: dividerColor }]}>
                <Text style={[styles.modalTitle, { color: labelColor }]}>Select Target Age Group</Text>
                <TouchableOpacity onPress={() => setShowAgeModal(false)}>
                  <Ionicons name="close" size={24} color={sublabelColor} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
                {AGE_OPTIONS.map((item) => {
                  const isSelected = form.ageGroup === item.code;
                  return (
                    <TouchableOpacity
                      key={item.code}
                      style={[
                        styles.modalOptionRow,
                        isSelected && { backgroundColor: optionActiveBg }
                      ]}
                      onPress={() => {
                        update('ageGroup', item.code);
                        setShowAgeModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[
                          styles.modalOptionText,
                          { color: isDark ? '#E2E8F0' : '#475569' },
                          isSelected && { color: COLORS.primary }
                        ]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.modalOptionSubtext, { color: sublabelColor }]}>{item.desc}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
        </>
      </StateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  statusCard: {
    marginBottom: 20,
    borderWidth: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  tutorThumbImage: {
    width: 38,
    height: 38,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  statusVoiceName: {
    fontSize: 14,
    fontWeight: '800',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  pickerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
    minWidth: 140,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowDesc: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  pickerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 1,
    maxWidth: '52%',
    gap: 4,
  },
  pickerValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    flexShrink: 1,
  },
  divider: {
    height: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  switchRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  enhancedSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 18,
    marginTop: 28,
    marginBottom: 24,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  enhancedSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  saveBtnIcon: {
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  searchClearIcon: {
    padding: 2,
  },
  modalScrollView: {
    marginTop: 2,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOptionSubtext: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  noResultsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pendingBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pendingBadgeMini: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  pendingBadgeMiniText: {
    fontSize: 9,
    fontWeight: '800',
  },
});
