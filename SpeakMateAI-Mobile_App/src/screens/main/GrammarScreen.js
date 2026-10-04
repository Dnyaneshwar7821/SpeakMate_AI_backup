import React, { useCallback, useState } from 'react';
import {
  Alert,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { AppButton, Card, Screen, StateView } from '../../components/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { grammarService, settingsService, progressService } from '../../services/appServices';
import { VoiceService } from '../../services/VoiceService';
import { OnboardingVoiceService } from '../../services/OnboardingVoiceService';
import { COLORS } from '../../constants/colors';
import {
  analyzeSentenceGrammarLocally,
  EXTENSIVE_GRAMMAR_GUIDE,
  getTailoredDailyGrammarQuizzes,
  parseBackendGrammarExplanation,
  generateSpokenGrammarSegments,
} from '../../utils/grammarEngine';

const SAMPLE_SENTENCES = [
  { label: '🚨 Multiple Errors', text: "She don't goes to school yesterday and discuss about exam." },
  { label: '✅ 100% Correct', text: "He ate an apple and completed his homework on time." },
  { label: '⚖️ Subject-Verb Agreement', text: "Neither of my two friend are interested in the project." },
  { label: '⏱️ Tense & Time', text: "I have been living in this city since four years." },
  { label: '🔮 Subjunctive', text: "If I was you, I would have accepted the job offer." },
];

export default function GrammarScreen() {
  const { theme, isDark } = useTheme();

  // Active Tab: 'checker' | 'guide' | 'quiz'
  const [activeTab, setActiveTab] = useState('checker');

  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [state, setState] = useState({ loading: false, error: '', history: [] });

  const [userSettings, setUserSettings] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);

  // Audience & Track (Automatically loaded from user profile/onboarding)
  const [accountType, setAccountType] = useState('INDIVIDUAL');
  const [selectedGrade, setSelectedGrade] = useState('8th Std');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('Professional');

  // Guide state
  const [guideSearch, setGuideSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedGuideId, setExpandedGuideId] = useState(EXTENSIVE_GRAMMAR_GUIDE[0]?.id || null);

  // Daily Sentence Quiz State (Tailored by standard/age)
  const [quizOffset, setQuizOffset] = useState(0);
  const [dailyQuizzes, setDailyQuizzes] = useState(() =>
    getTailoredDailyGrammarQuizzes({
      userType: 'INDIVIDUAL',
      targetGrade: '8th Std',
      ageGroup: 'Professional',
      customDate: new Date(),
      offset: 0,
    })
  );
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedQuizOption, setSelectedQuizOption] = useState(null);
  const [isQuizAnswerSubmitted, setIsQuizAnswerSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);

  const reloadDailyQuizzes = (type, grade, age, offset = 0) => {
    const fresh = getTailoredDailyGrammarQuizzes({
      userType: type,
      targetGrade: grade,
      ageGroup: age,
      customDate: new Date(),
      offset,
    });
    setDailyQuizzes(fresh);
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setIsQuizAnswerSubmitted(false);
    setQuizScore(0);
    setIsQuizCompleted(false);
  };

  const loadSettingsAndVoices = async () => {
    try {
      const [s, voices, storedType, storedGrade, storedAge] = await Promise.all([
        settingsService.get().catch(() => null),
        VoiceService.getAvailableEnglishVoices(),
        AsyncStorage.getItem('speakmate_account_type').catch(() => null),
        AsyncStorage.getItem('speakmate_school_grade').catch(() => null) || AsyncStorage.getItem('speakmate_user_grade').catch(() => null),
        AsyncStorage.getItem('speakmate_age_group').catch(() => null),
      ]);

      setUserSettings(s);
      setAvailableVoices(voices);

      const effType = storedType === 'STUDENT' ? 'STUDENT' : 'INDIVIDUAL';
      const effGrade = storedGrade || '8th Std';
      const effAge = storedAge || 'Professional';

      setAccountType(effType);
      setSelectedGrade(effGrade);
      setSelectedAgeGroup(effAge);

      reloadDailyQuizzes(effType, effGrade, effAge, 0);
    } catch (e) {
      console.warn("Failed to load settings in grammar screen:", e);
    }
  };

  const loadHistory = async (silent = false) => {
    if (!silent && (!state.history || state.history.length === 0)) {
      setState((current) => ({ ...current, loading: true, error: '' }));
    }
    try {
      const history = await grammarService.history();
      setState({ loading: false, error: '', history: Array.isArray(history) ? history : [] });
    } catch {
      setState((current) => ({ ...current, loading: false }));
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory(Boolean(state.history && state.history.length > 0));
      loadSettingsAndVoices();

      return () => {
        VoiceService.stop();
      };
    }, [state.history])
  );

  const check = async (overrideText) => {
    const cleanText = (typeof overrideText === 'string' ? overrideText : text).trim();
    if (!cleanText) return;
    setChecking(true);
    setResult(null);

    const localResult = analyzeSentenceGrammarLocally(cleanText);
    setResult(localResult);

    try {
      const backendRes = await grammarService.check(cleanText).catch(() => null);

      if (backendRes && backendRes.correctedText) {
        const structuredErrors = parseBackendGrammarExplanation(
          backendRes.explanation,
          backendRes.correctedText,
          localResult.errors
        );

        const normOrig = cleanText.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const normCorr = backendRes.correctedText.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const backendNoChange = normOrig === normCorr;

        // If local engine detected concrete grammar errors but backend returned no change or praise, prefer local fix
        const effectiveErrors = (localResult.errors.length > 0 && backendNoChange)
          ? localResult.errors
          : (structuredErrors.length > 0 ? structuredErrors : (backendNoChange ? [] : localResult.errors));

        const effectiveCorrected = (localResult.errors.length > 0 && backendNoChange && localResult.correctedText)
          ? localResult.correctedText
          : backendRes.correctedText;

        const effectiveNormCorr = effectiveCorrected.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const isCorrect = effectiveErrors.length === 0 && normOrig === effectiveNormCorr;

        const merged = {
          id: backendRes.id || Date.now(),
          isCorrect,
          accuracyScore: isCorrect ? 100 : Math.min(localResult.errors.length > 0 ? localResult.accuracyScore : (backendRes.grammarScore || 70), 85),
          originalText: cleanText,
          correctedText: effectiveCorrected,
          nativeAlternative: localResult.nativeAlternative,
          errors: effectiveErrors,
          explanation: isCorrect ? "Your sentence is 100% grammatically correct!" : (localResult.errors.length > 0 && backendNoChange ? localResult.explanation : (backendRes.explanation || localResult.explanation)),
          praiseMessage: isCorrect
            ? "🌟 Perfect English Grammar! Your sentence is 100% accurate with no grammar errors."
            : "",
          createdAt: backendRes.createdAt || new Date().toISOString(),
        };

        setResult(merged);
        speakFullFeedback(merged);
        await loadHistory();
      } else {
        speakFullFeedback(localResult);
      }

      try {
        const currProgress = await progressService.get().catch(() => null);
        if (currProgress) {
          await progressService.update({
            ...currProgress,
            xp: (currProgress.xp || 0) + 8,
            totalGrammarChecks: (currProgress.totalGrammarChecks || 0) + 1,
          });
        }
      } catch {}
    } catch {
      speakFullFeedback(localResult);
    } finally {
      setChecking(false);
    }
  };

  const getActiveVoiceType = async () => {
    try {
      const saved = await AsyncStorage.getItem('speakmate_selected_voice');
      if (saved) return saved;
    } catch {}

    if (userSettings && userSettings.aiVoice) return userSettings.aiVoice;
    try {
      const onboardingConfig = await OnboardingVoiceService.load();
      if (onboardingConfig && onboardingConfig.style) return onboardingConfig.style;
    } catch {}

    return 'Default';
  };

  const speakFullFeedback = async (res) => {
    if (!res) return;

    let currentVoices = availableVoices;
    try {
      if (!currentVoices || currentVoices.length === 0) {
        currentVoices = await VoiceService.getAvailableEnglishVoices();
        setAvailableVoices(currentVoices);
      }
    } catch {}

    if (userSettings?.isMuted) return;

    const voiceType = await getActiveVoiceType();
    const spokenSegments = generateSpokenGrammarSegments(res);

    VoiceService.speakSequential(spokenSegments, {
      voiceType,
      availableVoices: currentVoices,
    }, 400);
  };

  const removeHistoryItem = async (id) => {
    Alert.alert('Delete Entry', 'Remove this check from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await grammarService.remove(id);
            setState((prev) => ({
              ...prev,
              history: prev.history.filter((h) => h.id !== id),
            }));
            if (result?.id === id) setResult(null);
          } catch {
            Alert.alert('Error', 'Unable to delete entry.');
          }
        },
      },
    ]);
  };

  // Daily Quiz Handling
  const activeQuiz = dailyQuizzes[currentQuizIdx] || dailyQuizzes[0];

  const handleSelectQuizAnswer = (idx) => {
    if (isQuizAnswerSubmitted) return;
    setSelectedQuizOption(idx);
  };

  const handleSubmitQuizAnswer = async () => {
    if (selectedQuizOption === null || isQuizAnswerSubmitted) return;
    setIsQuizAnswerSubmitted(true);
    const isCorrect = selectedQuizOption === activeQuiz.correctAnswerIndex;

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
    }

    try {
      const voiceType = await getActiveVoiceType();
      if (!userSettings?.isMuted) {
        if (isCorrect) {
          VoiceService.speak("Correct! Well done.", { voiceType, availableVoices });
        } else {
          VoiceService.speak("Not quite. " + activeQuiz.explanation, { voiceType, availableVoices });
        }
      }
    } catch {}
  };

  const handleNextQuizQuestion = async () => {
    if (currentQuizIdx + 1 < dailyQuizzes.length) {
      setCurrentQuizIdx((prev) => prev + 1);
      setSelectedQuizOption(null);
      setIsQuizAnswerSubmitted(false);
    } else {
      setIsQuizCompleted(true);
      const totalAwarded = quizScore * 5 + (quizScore === dailyQuizzes.length && quizScore > 0 ? 10 : 0);
      try {
        const prog = await progressService.get().catch(() => null);
        if (prog) {
          await progressService.update({
            ...prog,
            xp: (prog.xp || 0) + totalAwarded,
            totalGrammarChecks: (prog.totalGrammarChecks || 0) + quizScore,
          });
        }
      } catch (e) {}
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setIsQuizAnswerSubmitted(false);
    setQuizScore(0);
    setIsQuizCompleted(false);
  };

  const handleLoadNewQuizBatch = () => {
    const nextOffset = quizOffset + 1;
    setQuizOffset(nextOffset);
    reloadDailyQuizzes(accountType, selectedGrade, selectedAgeGroup, nextOffset);
  };

  // Filtered guide items
  const filteredGuides = EXTENSIVE_GRAMMAR_GUIDE.filter((g) => {
    const matchesCat = selectedCategory === 'ALL' || g.category === selectedCategory;
    const q = guideSearch.toLowerCase();
    const matchesSearch =
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.summary.toLowerCase().includes(q) ||
      g.rules.some((r) => r.name.toLowerCase().includes(q) || r.usage.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const guideCategories = ['ALL', ...new Set(EXTENSIVE_GRAMMAR_GUIDE.map((g) => g.category))];

  return (
    <Screen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Grammar Doctor ✍️</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Sentence analyzer, rule guides, and tailored daily quizzes
          </Text>
        </View>
      </View>

      {/* Navigation Segment Tabs */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'checker' && styles.activeTabBtn]}
          onPress={() => setActiveTab('checker')}
        >
          <Ionicons
            name="medical"
            size={16}
            color={activeTab === 'checker' ? '#FFFFFF' : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'checker' && styles.activeTabText]}>
            AI Doctor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'guide' && styles.activeTabBtn]}
          onPress={() => setActiveTab('guide')}
        >
          <Ionicons
            name="book"
            size={16}
            color={activeTab === 'guide' ? '#FFFFFF' : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'guide' && styles.activeTabText]}>
            Handbook
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'quiz' && styles.activeTabBtn]}
          onPress={() => setActiveTab('quiz')}
        >
          <Ionicons
            name="trophy"
            size={16}
            color={activeTab === 'quiz' ? '#FFFFFF' : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'quiz' && styles.activeTabText]}>
            Quizzes
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: AI GRAMMAR DOCTOR */}
      {activeTab === 'checker' && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={[styles.inputCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>Enter Any Sentence to Check:</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: theme.textPrimary, borderColor: theme.cardBorder }]}
              placeholder="e.g. She don't goes to school yesterday and discuss about exam."
              placeholderTextColor={theme.textSecondary}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={3}
            />

            {/* Quick Practice Chips */}
            <Text style={[styles.chipSectionTitle, { color: theme.textSecondary }]}>⚡ Try Sample Sentences:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {SAMPLE_SENTENCES.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.chip, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
                  onPress={() => {
                    setText(item.text);
                    check(item.text);
                  }}
                >
                  <Text style={[styles.chipText, { color: theme.textPrimary }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <AppButton
              title="✨ Check Sentence Grammar"
              onPress={() => check()}
              loading={checking}
              disabled={!text.trim()}
              style={{ marginTop: 14 }}
            />
          </Card>

          {/* RESULTS DISPLAY: ORDERED PROMINENTLY */}
          {result && (
            <Card style={[styles.resultCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              {/* 1. TOP HEADER & SCORE */}
              <View style={styles.resultTopHeader}>
                <View style={[styles.badge, { backgroundColor: result.isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(108,99,255,0.15)' }]}>
                  <Text style={[styles.badgeText, { color: result.isCorrect ? '#16A34A' : COLORS.primary }]}>
                    {result.isCorrect ? '✅ 100% Perfect Sentence' : '🌟 Corrected Sentence'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.speakerBtn}
                  onPress={() => speakFullFeedback(result)}
                >
                  <Ionicons name="volume-high" size={20} color="#FFFFFF" />
                  <Text style={styles.speakerBtnText}>Hear Audio</Text>
                </TouchableOpacity>
              </View>

              {/* 2. CORRECTED SENTENCE PROMINENT DISPLAY */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                  {result.isCorrect ? "Your Sentence:" : "Corrected English Sentence:"}
                </Text>
                <View style={[styles.feedbackBox, {
                  backgroundColor: result.isCorrect ? (isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4') : (isDark ? '#1E293B' : '#F8FAFC'),
                  borderColor: result.isCorrect ? '#86EFAC' : COLORS.primary
                }]}>
                  <Text style={[styles.correctedMainText, { color: result.isCorrect ? (isDark ? '#4ADE80' : '#166534') : theme.textPrimary }]}>
                    "{result.correctedText}"
                  </Text>
                </View>
              </View>

              {/* Praise message if perfect */}
              {result.isCorrect && (
                <View style={[styles.praiseBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#DCFCE7' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                  <Text style={[styles.praiseText, { color: isDark ? '#86EFAC' : '#166534' }]}>
                    {result.praiseMessage || "Given sentence is correct with no grammar mistakes!"}
                  </Text>
                </View>
              )}

              {/* Native Upgrade Phrasing */}
              {result.nativeAlternative && (
                <View style={[styles.nativeBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF' }]}>
                  <Ionicons name="sparkles" size={18} color="#6366F1" />
                  <Text style={[styles.nativeText, { color: isDark ? '#A5B4FC' : '#3730A3' }]}>
                    <Text style={{ fontWeight: 'bold' }}>Native Upgrade: </Text>"{result.nativeAlternative}"
                  </Text>
                </View>
              )}

              {/* 3. ITEMIZED MISTAKES BREAKDOWN (IF NOT PERFECT) */}
              {!result.isCorrect && result.errors && result.errors.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.subLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
                    🔍 Identified Mistakes & Rules ({result.errors.length}):
                  </Text>

                  {result.errors.map((err, idx) => {
                    const hasValidSnippet =
                      err.errorSnippet &&
                      err.errorSnippet.length <= 25 &&
                      !err.errorSnippet.includes('[') &&
                      !err.errorSnippet.toLowerCase().includes('missing');

                    return (
                      <View key={idx} style={[styles.errorItemCard, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: theme.cardBorder }]}>
                        <View style={styles.errorItemHeader}>
                          <View style={styles.errorNumBadge}>
                            <Text style={styles.errorNumText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.errorTypeBadge}>{err.type || 'Grammar Rule'}</Text>
                          {hasValidSnippet && (
                            <Text style={styles.errorSnippetBadge}>Wrong: "{err.errorSnippet}"</Text>
                          )}
                        </View>

                        <Text style={[styles.errorIssueText, { color: theme.textPrimary }]}>
                          👉 {err.issue}
                        </Text>

                        {err.rule && (
                          <View style={[styles.errorRuleBox, { backgroundColor: isDark ? '#0F172A' : '#EDE9FE' }]}>
                            <Text style={[styles.errorRuleText, { color: isDark ? '#DDD6FE' : '#5B21B6' }]}>
                              <Text style={{ fontWeight: 'bold' }}>Rule: </Text>{err.rule}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          )}

          {/* History Timeline */}
          <Text style={[styles.sectionHeaderTitle, { color: theme.textSecondary, marginTop: 20, marginBottom: 8 }]}>
            Recent Analysis History ({state.history.length})
          </Text>
          <StateView
            loading={state.loading}
            error={state.error}
            empty={!state.history.length ? 'No previous grammar analysis entries yet.' : null}
            onRetry={loadHistory}
          >
            {state.history.map((item) => (
              <TouchableOpacity key={item.id} activeOpacity={0.85} onPress={() => setResult(item)}>
                <Card style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, result?.id === item.id && { borderColor: COLORS.primary, borderWidth: 1.5 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.historyCorrected, { color: theme.textPrimary }]} numberOfLines={1}>
                      👉 {item.correctedText}
                    </Text>
                    <TouchableOpacity onPress={() => removeHistoryItem(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.historyOriginal, { color: theme.textSecondary }]} numberOfLines={1}>
                    Original: "{item.originalText}"
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </StateView>
        </ScrollView>
      )}

      {/* TAB 2: COMPREHENSIVE GRAMMAR HANDBOOK */}
      {activeTab === 'guide' && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <TextInput
            style={[styles.searchBar, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: theme.textPrimary, borderColor: theme.cardBorder }]}
            placeholder="🔍 Search grammar rules or topics..."
            placeholderTextColor={theme.textSecondary}
            value={guideSearch}
            onChangeText={setGuideSearch}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {guideCategories.map((cat, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat ? styles.categoryChipActive : { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredGuides.map((guide) => {
            const isExpanded = expandedGuideId === guide.id;
            return (
              <Card key={guide.id} style={[styles.guideCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <TouchableOpacity
                  style={styles.guideHeader}
                  onPress={() => setExpandedGuideId(isExpanded ? null : guide.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Text style={styles.guideIcon}>{guide.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.guideLevelBadge, { color: COLORS.primary }]}>{guide.level}</Text>
                      <Text style={[styles.guideTitle, { color: theme.textPrimary }]}>{guide.title}</Text>
                      <Text style={[styles.guideSummary, { color: theme.textSecondary }]} numberOfLines={1}>{guide.summary}</Text>
                    </View>
                  </View>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.guideBody, { borderTopColor: theme.cardBorder }]}>
                    {guide.rules.map((r, rIdx) => (
                      <View key={rIdx} style={[styles.ruleCard, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                        <Text style={[styles.ruleName, { color: COLORS.primary }]}>📌 {r.name}</Text>
                        {r.formula && (
                          <Text style={[styles.ruleFormula, { color: theme.textPrimary }]}>Formula: {r.formula}</Text>
                        )}
                        <Text style={[styles.ruleUsage, { color: theme.textSecondary }]}>{r.usage}</Text>
                        
                        <View style={{ gap: 4, marginTop: 4 }}>
                          <Text style={styles.exCorrect}>✅ {r.correctExample}</Text>
                          <Text style={styles.exWrong}>❌ {r.wrongExample}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* TAB 3: USER-TAILORED DAILY GRAMMAR QUIZZES */}
      {activeTab === 'quiz' && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {!isQuizCompleted ? (
            <Card style={[styles.quizCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.quizHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.quizProgressText, { color: COLORS.primary }]}>
                    Daily Challenge: {currentQuizIdx + 1} of {dailyQuizzes.length}
                  </Text>
                  {activeQuiz.formatBadge && (
                    <Text style={styles.formatBadgeText}>{activeQuiz.formatBadge}</Text>
                  )}
                </View>
                <Text style={[styles.quizScoreText, { color: theme.textSecondary }]}>
                  Score: <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>{quizScore}</Text>
                </Text>
              </View>

              {/* Problem / Target Prompt Sentence */}
              {(activeQuiz.promptSentence || activeQuiz.sentenceWithProblem) && (
                <View style={styles.problemBox}>
                  <Text style={styles.problemLabel}>Given Sentence:</Text>
                  <Text style={styles.problemText}>
                    "{activeQuiz.promptSentence || activeQuiz.sentenceWithProblem}"
                  </Text>
                </View>
              )}

              <Text style={[styles.quizQuestion, { color: theme.textPrimary }]}>{activeQuiz.question}</Text>

              {/* Options */}
              <View style={{ gap: 8, marginTop: 12 }}>
                {activeQuiz.options.map((opt, idx) => {
                  const isSelected = selectedQuizOption === idx;
                  const isCorrect = idx === activeQuiz.correctAnswerIndex;

                  let optBg = isDark ? '#1E293B' : '#F8FAFC';
                  let optBorder = theme.cardBorder;
                  let optColor = theme.textPrimary;

                  if (isQuizAnswerSubmitted) {
                    if (isCorrect) {
                      optBg = 'rgba(34,197,94,0.15)';
                      optBorder = '#86EFAC';
                      optColor = isDark ? '#86EFAC' : '#166534';
                    } else if (isSelected && !isCorrect) {
                      optBg = 'rgba(239,68,68,0.15)';
                      optBorder = '#FCA5A5';
                      optColor = '#EF4444';
                    }
                  } else if (isSelected) {
                    optBg = 'rgba(108,99,255,0.15)';
                    optBorder = COLORS.primary;
                    optColor = COLORS.primary;
                  }

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.quizOption, { backgroundColor: optBg, borderColor: optBorder }]}
                      onPress={() => handleSelectQuizAnswer(idx)}
                      disabled={isQuizAnswerSubmitted}
                    >
                      <Text style={[styles.quizOptionText, { color: optColor }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Explanation upon submit */}
              {isQuizAnswerSubmitted && (
                <View style={[styles.quizExplanationBox, { backgroundColor: isDark ? '#1E293B' : '#EDE9FE' }]}>
                  <Text style={[styles.quizExplanationLabel, { color: COLORS.primary }]}>Rule Explanation:</Text>
                  <Text style={[styles.quizExplanationText, { color: theme.textPrimary }]}>
                    {activeQuiz.explanation}
                  </Text>
                </View>
              )}

              {/* Action button */}
              <View style={{ marginTop: 16 }}>
                {!isQuizAnswerSubmitted ? (
                  <AppButton
                    title="Submit Answer"
                    onPress={handleSubmitQuizAnswer}
                    disabled={selectedQuizOption === null}
                  />
                ) : (
                  <AppButton
                    title={currentQuizIdx + 1 < dailyQuizzes.length ? "Next Question →" : "View Results 🏆"}
                    onPress={handleNextQuizQuestion}
                  />
                )}
              </View>
            </Card>
          ) : (
            <Card style={[styles.quizCompletedCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <Text style={{ fontSize: 50, textAlign: 'center' }}>🏆</Text>
              <Text style={[styles.completedTitle, { color: theme.textPrimary }]}>Grammar Quiz Completed!</Text>
              <Text style={[styles.completedSubtitle, { color: theme.textSecondary }]}>
                You scored <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>{quizScore}</Text> out of {dailyQuizzes.length}!
              </Text>

              <AppButton
                title="🔄 Retake Today's 8 Quizzes"
                onPress={handleRestartQuiz}
                style={{ marginTop: 20 }}
              />

              <AppButton
                title="⚡ Load Next 8 New Quizzes"
                onPress={handleLoadNewQuizBatch}
                style={{ marginTop: 10 }}
              />
            </Card>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 10, borderRadius: 16, padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 12 },
  activeTabBtn: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  inputCard: { padding: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  chipSectionTitle: { fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8 },
  chipText: { fontSize: 11, fontWeight: '700' },
  resultCard: { padding: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, marginTop: 14 },
  resultTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  speakerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  speakerBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  subLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  feedbackBox: { padding: 12, borderRadius: 14, borderWidth: 1 },
  correctedMainText: { fontSize: 15, fontWeight: '800', lineHeight: 22 },
  praiseBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginTop: 10 },
  praiseText: { fontSize: 12, fontWeight: '700', flex: 1 },
  nativeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginTop: 8 },
  nativeText: { fontSize: 12, flex: 1 },
  errorItemCard: { padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  errorItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  errorNumBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F43F5E', alignItems: 'center', justifyContent: 'center' },
  errorNumText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  errorTypeBadge: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: COLORS.primary, backgroundColor: 'rgba(108,99,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  errorSnippetBadge: { fontSize: 10, fontWeight: '700', color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  errorIssueText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  errorRuleBox: { padding: 8, borderRadius: 8, marginTop: 6 },
  errorRuleText: { fontSize: 11, fontWeight: '500' },
  sectionHeaderTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  historyCard: { padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  historyCorrected: { fontSize: 13, fontWeight: '800', flex: 1, marginRight: 8 },
  historyOriginal: { fontSize: 11, marginTop: 2 },
  searchBar: { borderWidth: 1, borderRadius: 14, padding: 10, fontSize: 13, marginBottom: 10 },
  categoryScroll: { flexDirection: 'row', marginBottom: 12 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 6 },
  categoryChipActive: { backgroundColor: COLORS.primary },
  categoryChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  categoryChipTextActive: { color: '#FFFFFF' },
  guideCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10, overflow: 'hidden' },
  guideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  guideIcon: { fontSize: 24 },
  guideLevelBadge: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  guideTitle: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  guideSummary: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  guideBody: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  ruleCard: { padding: 10, borderRadius: 12, gap: 4 },
  ruleName: { fontSize: 12, fontWeight: '800' },
  ruleFormula: { fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
  ruleUsage: { fontSize: 11, fontWeight: '500' },
  exCorrect: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  exWrong: { fontSize: 11, color: '#EF4444', textDecorationLine: 'line-through' },
  quizCard: { padding: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  quizProgressText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  formatBadgeText: { fontSize: 10, fontWeight: '900', color: '#D97706', backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  quizScoreText: { fontSize: 12, fontWeight: '600' },
  problemBox: { padding: 12, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: '#FCD34D', marginBottom: 10 },
  problemLabel: { fontSize: 10, fontWeight: '800', color: '#D97706', textTransform: 'uppercase' },
  problemText: { fontSize: 13, fontWeight: '700', color: '#92400E', marginTop: 2 },
  quizQuestion: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  quizOption: { padding: 12, borderRadius: 12, borderWidth: 1 },
  quizOptionText: { fontSize: 13, fontWeight: '600' },
  quizExplanationBox: { padding: 10, borderRadius: 10, marginTop: 10 },
  quizExplanationLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  quizExplanationText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  quizCompletedCard: { padding: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  completedTitle: { fontSize: 18, fontWeight: '900', marginTop: 10 },
  completedSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 4 },
});
