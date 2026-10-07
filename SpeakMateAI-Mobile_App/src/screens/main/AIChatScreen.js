import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService } from '../../services/appServices';
import { getCachedAvatarModel } from '../../config/AvatarCatalog';

// ─── Chat Modes Specs ────────────────────────────────────────────────────────
const CHAT_MODES = [
  { key: 'General English',     title: 'General English',     desc: 'Improve conversation, general fluency and grammar.', difficulty: 'All levels',   icon: 'chatbubbles-outline', color: '#6366F1' },
  { key: 'Grammar Coach',       title: 'Grammar Coach',       desc: 'Deep-dive into correct syntax, tenses, and sentence styling.', difficulty: 'Beginner',   icon: 'school-outline',     color: '#EC4899' },
  { key: 'Vocabulary Builder',  title: 'Vocabulary Builder',  desc: 'Enrich expression, learn native synonyms and idioms.', difficulty: 'Intermediate', icon: 'bulb-outline',       color: '#F59E0B' },
  { key: 'Daily Conversation',  title: 'Daily Conversation',  desc: 'Practice common everyday talking scenarios.', difficulty: 'Beginner',   icon: 'cafe-outline',       color: '#10B981' },
  { key: 'Interview Coach',     title: 'Interview Coach',     desc: 'Practice responses for job interviews and professional feedback.', difficulty: 'Advanced',   icon: 'briefcase-outline',  color: '#8B5CF6' },
  { key: 'Business English',    title: 'Business English',    desc: 'Master corporate emails, meetings, and business talk.', difficulty: 'Advanced',   icon: 'stats-chart-outline',color: '#3B82F6' },
  { key: 'Travel English',      title: 'Travel English',      desc: 'Learn useful vocabulary for flights, hotels, and directions.', difficulty: 'Beginner',   icon: 'airplane-outline',   color: '#06B6D4' },
  { key: 'IELTS Speaking',      title: 'IELTS Speaking',      desc: 'Simulate official IELTS speaking parts with targeted scoring.', difficulty: 'Advanced',   icon: 'medal-outline',      color: '#EF4444' },
  { key: 'Storytelling',        title: 'Storytelling',        desc: 'Construct narratives, descriptive tales, and explain events.', difficulty: 'Intermediate', icon: 'book-outline',       color: '#10B981' },
  { key: 'Debate',              title: 'Debate',              desc: 'Discuss controversial topics, formulate arguments, and reply.', difficulty: 'Advanced',   icon: 'git-compare-outline',color: '#6366F1' },
  { key: 'Free Chat',           title: 'Free Chat',           desc: 'Open-ended dialogue with your tutor on any topic.', difficulty: 'All levels',   icon: 'sparkles-outline',   color: '#F59E0B' },
];

export default function AIChatScreen({ navigation }) {
  const { isDark, theme } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal for Renaming
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [accountType, setAccountType] = useState('INDIVIDUAL_USER');
  const [userGrade, setUserGrade] = useState('1st Std');

  const fetchHistory = async (silent = false) => {
    if (!silent && history.length === 0) setLoading(true);
    try {
      const data = await chatService.history();
      const validData = Array.isArray(data)
        ? data.filter((s) => s && Number(s.messageCount || 0) > 1)
        : [];
      setHistory(validData);
      const [savedType, savedGrade] = await Promise.all([
        AsyncStorage.getItem('speakmate_account_type'),
        AsyncStorage.getItem('speakmate_school_grade'),
      ]);
      if (savedType) setAccountType(savedType);
      if (savedGrade) setUserGrade(savedGrade);
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory(true);
    }, [])
  );

  const handleStartSession = async (mode) => {
    setLoading(true);
    try {
      const activeAvatar = getCachedAvatarModel() || (await AsyncStorage.getItem('speakmate_avatar_model').catch(() => null));
      const session = await chatService.start(mode);
      navigation.navigate('ConversationChat', {
        sessionId: session.id,
        mode: session.mode,
        title: session.title,
        avatarModel: activeAvatar,
      });
    } catch (e) {
      console.warn('Backend chat start sync note, opening session directly:', e);
      const activeAvatar = getCachedAvatarModel() || (await AsyncStorage.getItem('speakmate_avatar_model').catch(() => null));
      navigation.navigate('ConversationChat', {
        sessionId: 'sim_' + Date.now(),
        mode: mode,
        title: mode + ' Session',
        avatarModel: activeAvatar,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSession = async (session) => {
    const activeAvatar = getCachedAvatarModel() || (await AsyncStorage.getItem('speakmate_avatar_model').catch(() => null));
    navigation.navigate('ConversationChat', {
      sessionId: session.id,
      mode: session.mode,
      title: session.title,
      avatarModel: activeAvatar,
    });
  };

  const handleDeleteSession = (id) => {
    Alert.alert(
      'Delete Conversation?',
      'Are you sure you want to permanently delete this chat session and its full message history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteSession(id);
              setHistory((prev) => prev.filter((s) => s.id !== id));
            } catch {
              Alert.alert('Error', 'Failed to delete session.');
            }
          },
        },
      ]
    );
  };

  const handleOpenRename = (session) => {
    setRenameTargetId(session.id);
    setNewTitle(session.title);
    setRenameModalVisible(true);
  };

  const handleRenameSession = async () => {
    if (!newTitle.trim()) return;
    setRenaming(true);
    try {
      await chatService.rename(renameTargetId, newTitle.trim());
      setRenameModalVisible(false);
      setNewTitle('');
      setRenameTargetId(null);
      fetchHistory();
    } catch {
      Alert.alert('Error', 'Failed to rename session.');
    } finally {
      setRenaming(false);
    }
  };

  const handleClearAllSessions = () => {
    Alert.alert(
      'Clear All Recent Chats',
      'Are you sure you want to delete all your previous conversation threads?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.clearAll().catch(async () => {
                await Promise.all(history.map((s) => chatService.deleteSession(s.id).catch(() => {})));
              });
              setHistory([]);
            } catch {
              Alert.alert('Error', 'Failed to clear sessions.');
            }
          },
        },
      ]
    );
  };

  // Filtering based on search
  const filteredHistory = history.filter((s) => {
    if (!s || Number(s.messageCount || 0) <= 1) return false;
    const q = searchQuery.toLowerCase();
    return (
      (s.title || '').toLowerCase().includes(q) ||
      (s.mode || '').toLowerCase().includes(q)
    );
  });

  const latestSession = history.length > 0 ? history[0] : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <FlatList
        data={filteredHistory}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {/* ─── Gradient Header ─── */}
            <LinearGradient colors={['#0F172A', '#1E1B4B']} style={styles.header}>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>AI Tutor Chat</Text>
                <Ionicons name="sparkles" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.headerSubtitle}>
                Select a learning mode to practice real-time interactive reading, writing, and speaking.
              </Text>
              {accountType === 'STUDENT' && (
                <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                  🎓 Standard Level: {userGrade} (Auto-Configured)
                </Text>
              )}
            </LinearGradient>

            {/* ─── Continue Latest Chat ─── */}
            {latestSession && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Continue Lesson</Text>
                <TouchableOpacity
                  style={[styles.continueCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: isDark ? 1 : 0 }]}
                  onPress={() => handleResumeSession(latestSession)}
                  activeOpacity={0.9}
                >
                  <View style={styles.continueLeft}>
                    <View style={[styles.modeCircle, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF' }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.primary} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={[styles.continueTitle, { color: theme.textPrimary }]}>{latestSession.title}</Text>
                      <Text style={[styles.continueMeta, { color: theme.textSecondary }]}>
                        Mode: {latestSession.mode} • {latestSession.messageCount} turns
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* ─── Suggested Modes ─── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Choose Tutoring Mode</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
              >
                {CHAT_MODES.slice(0, 5).map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modeScrollCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                    onPress={() => handleStartSession(m.key)}
                  >
                    <View style={[styles.modeIconCircle, { backgroundColor: `${m.color}15` }]}>
                      <Ionicons name={m.icon} size={22} color={m.color} />
                    </View>
                    <Text style={[styles.modeCardTitle, { color: theme.textPrimary }]}>{m.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ─── All Tutoring Modes ─── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Explore All Focus Areas</Text>
              <View style={styles.modesGrid}>
                {CHAT_MODES.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.gridCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                    onPress={() => handleStartSession(m.key)}
                  >
                    <View style={[styles.gridIconCircle, { backgroundColor: `${m.color}15` }]}>
                      <Ionicons name={m.icon} size={20} color={m.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.gridCardTitle, { color: theme.textPrimary }]}>{m.title}</Text>
                      <Text style={[styles.gridCardDesc, { color: theme.textSecondary }]} numberOfLines={2}>{m.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ─── Conversation History Section ─── */}
            <View style={[styles.section, { marginBottom: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent Conversations</Text>
                {history.length > 0 && (
                  <TouchableOpacity onPress={handleClearAllSessions} style={{ padding: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>
              {/* Search Box */}
              <View style={[styles.searchContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search previous sessions or topics..."
                  placeholderTextColor={theme.textSecondary}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={styles.historyCardPress}
              onPress={() => handleResumeSession(item)}
            >
              <View style={[styles.historyIconCircle, isDark && { backgroundColor: '#334155' }]}>
                <Ionicons name="chatbubbles" size={20} color={theme.textSecondary} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[styles.historyTitle, { color: theme.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.historySub, { color: theme.textSecondary }]}>
                  {item.mode} • {item.messageCount} messages
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.historyActions}>
              <TouchableOpacity style={[styles.actionIconButton, isDark && { backgroundColor: '#334155' }]} onPress={() => handleOpenRename(item)}>
                <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionIconButton, isDark && { backgroundColor: '#334155' }]} onPress={() => handleDeleteSession(item.id)}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No historical tutoring sessions found.</Text>
            </View>
          )
        }
      />

      {/* ─── Rename Modal ─── */}
      <Modal visible={renameModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Rename Conversation</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? '#334155' : '#FFF', borderColor: theme.cardBorder, color: theme.textPrimary }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new conversation name..."
              placeholderTextColor={theme.textSecondary}
              maxLength={60}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setRenameModalVisible(false);
                  setNewTitle('');
                  setRenameTargetId(null);
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleRenameSession}
                disabled={renaming}
              >
                {renaming ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 24, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.75)', marginTop: 8, lineHeight: 18 },

  // Sections
  section: { marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.black, paddingHorizontal: 16, marginBottom: 12 },

  // Continue session card
  continueCard: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  continueLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  modeCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  continueTitle: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  continueMeta: { fontSize: 11, color: '#64748B', marginTop: 3 },

  // Scrollable cards
  modeScrollCard: {
    backgroundColor: '#FFF',
    width: 140,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.01,
    shadowRadius: 8,
    elevation: 1,
  },
  modeIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modeCardTitle: { fontSize: 12, fontWeight: '800', color: COLORS.black, textAlign: 'center', height: 32 },
  modeCardLevel: { fontSize: 9, fontWeight: '700', color: COLORS.primary, marginTop: 4, textTransform: 'uppercase' },

  // Grid
  modesGrid: { paddingHorizontal: 16, gap: 10 },
  gridCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.01,
    shadowRadius: 6,
    elevation: 1,
  },
  gridIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  gridCardTitle: { fontSize: 13, fontWeight: '800', color: COLORS.black },
  gridCardLevel: { fontSize: 9, fontWeight: '700', color: '#64748B' },
  gridCardDesc: { fontSize: 11, color: COLORS.text, marginTop: 4, lineHeight: 15 },

  // Search box
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, height: '100%', fontSize: 13, color: COLORS.black, fontWeight: '500' },

  // History List
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyCardPress: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  historyIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  historySub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  historyActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  actionIconButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginTop: 10 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '100%', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black, marginBottom: 12 },
  modalInput: { height: 46, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: COLORS.black, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#CBD5E1' },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  modalConfirm: { flex: 1, height: 44, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
});
