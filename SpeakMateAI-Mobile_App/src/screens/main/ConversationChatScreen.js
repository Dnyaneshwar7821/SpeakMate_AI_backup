import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && !global.nativeFabricUIManager && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ExpoSpeechRecognitionModule,
  isNativeSpeechRecognitionAvailable,
  checkAndRequestMicPermissions,
  promptOpenSettingsForMic,
} from '../../utils/speechRecognitionService';
import { VoiceRecorder } from '../../utils/audioRecorder';
import { COLORS } from '../../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService, speechService, settingsService, profileService } from '../../services/appServices';
import { VoiceService } from '../../services/VoiceService';
import AIAvatar from '../../components/common/AIAvatar';
import { getAvatarById, getCachedAvatarModel, setCachedAvatarModel } from '../../config/AvatarCatalog';
import { getActiveTutorSync, getActiveTutorAsync } from '../../services/ActiveTutorService';
import JumpingDotsIndicator from '../../components/common/JumpingDotsIndicator';
import LevelSegmentedControl from '../../components/common/LevelSegmentedControl';

// ── Animated Message Bubble Component ────────────────────────────────────────
const AnimatedChatBubble = React.memo(function AnimatedChatBubble({ children, isUser, onLongPress }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const opacity    = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onLongPress}
        style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.aiWrapper]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});

const formatVocabularyText = (text) => {
  if (!text) return '';
  let clean = String(text);
  clean = clean.replace(/\*\*/g, '');
  clean = clean.replace(/[\[\]{}"']/g, '');
  clean = clean.replace(/^(vocabulary|words|suggestions)\s*:\s*/i, '');
  return clean.replace(/\s+/g, ' ').trim();
};

// ─── Speaking Coach & Phrasing Card Component ────────────────────────────────
const SpeakingCoachCard = React.memo(function SpeakingCoachCard({
  item,
  onSpeakText,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasFeedbackText = (text) => {
    if (!text) return false;
    const clean = text.trim().toLowerCase();
    return clean !== 'none' && clean !== 'null' && clean !== '' && !clean.includes('[better_sentence] none') && !clean.includes('[vocabulary] none');
  };

  const showGrammar = hasFeedbackText(item.grammarCorrection);
  const showBetter = hasFeedbackText(item.betterSentence);
  const showVocab = hasFeedbackText(item.vocabularySuggestions);
  const showFollowup = hasFeedbackText(item.followUpQuestion);
  const showNativeTip = hasFeedbackText(item.nativeTip);
  const showExplanation = hasFeedbackText(item.explanation);

  return (
    <View style={styles.correctionBox}>
      {/* Header with expand/collapse toggle */}
      <TouchableOpacity
        style={styles.correctionHeader}
        activeOpacity={0.8}
        onPress={() => setIsExpanded((prev) => !prev)}
      >
        <View style={styles.correctionTitleRow}>
          <Ionicons name="sparkles" size={16} color="#818CF8" />
          <Text style={styles.correctionTitle}>Speaking Coach & Phrasing</Text>
        </View>
        <View style={styles.expandToggleBtn}>
          <Text style={styles.expandToggleText}>{isExpanded ? 'Hide' : 'Expand'}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#A5B4FC"
          />
        </View>
      </TouchableOpacity>

      {/* Expanded Content matching Speaking Practice module */}
      {isExpanded ? (
        <>
          {showBetter && (
            <View style={styles.betterSectionBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.betterSectionLabel}>Native Phrasing ("How to say it")</Text>
                <TouchableOpacity
                  style={styles.listenPhraseMiniBtn}
                  onPress={() => onSpeakText(item.betterSentence)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high" size={14} color="#6366F1" />
                  <Text style={styles.listenPhraseMiniText}>Listen</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.betterSectionContent}>"{item.betterSentence}"</Text>
            </View>
          )}

          {showGrammar && (
            <View style={styles.correctionSection}>
              <Text style={styles.correctionLabel}>Grammar Check</Text>
              {item.grammarCorrection.includes('✅') || item.grammarCorrection.toLowerCase().includes('correct') ? (
                <Text style={[styles.correctionContent, { color: '#10B981', fontWeight: '700' }]}>
                  {item.grammarCorrection}
                </Text>
              ) : (
                <Text style={styles.correctionContent}>👉 {item.grammarCorrection}</Text>
              )}
            </View>
          )}

          {showVocab && (
            <View style={styles.correctionSection}>
              <Text style={styles.correctionLabel}>Vocabulary Upgrade</Text>
              <Text style={styles.correctionContent}>✨ {formatVocabularyText(item.vocabularySuggestions)}</Text>
            </View>
          )}

          {showNativeTip && (
            <View style={styles.correctionSection}>
              <Text style={styles.correctionLabel}>Fluency & Pronunciation Tip</Text>
              <Text style={[styles.correctionContent, { color: '#38BDF8' }]}>💡 {item.nativeTip}</Text>
            </View>
          )}

          {showExplanation && (
            <Text style={styles.correctionExplanation}>{item.explanation}</Text>
          )}

          {showFollowup && (
            <View style={styles.followUpCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={styles.followUpHeaderRow}>
                  <Ionicons name="chatbubbles-outline" size={14} color="#34D399" />
                  <Text style={styles.followUpLabel}>Next Question / Follow-up</Text>
                </View>
                <TouchableOpacity
                  style={styles.listenFollowUpMiniBtn}
                  onPress={() => onSpeakText(item.followUpQuestion)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high" size={13} color="#34D399" />
                  <Text style={styles.listenFollowUpMiniText}>Listen</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    await Share.share({ message: item.followUpQuestion });
                  } catch (e) {
                    Alert.alert('Follow-up Question', item.followUpQuestion);
                  }
                }}
              >
                <Text style={styles.followUpContent}>"{item.followUpQuestion}"</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsExpanded(true)}
          style={styles.collapsedPreviewRow}
        >
          <Text style={styles.collapsedPreviewText} numberOfLines={1}>
            {showBetter ? `"${item.betterSentence}"` : showGrammar ? item.grammarCorrection : 'Tap to expand feedback'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ─── Memoized Chat Message Item Component ────────────────────────────────────
const ChatMessageItem = React.memo(function ChatMessageItem({
  item,
  onOpenMenu,
  onSpeakText,
}) {
  const isUser = item.sender === 'user';

  const hasFeedbackText = (text) => {
    if (!text) return false;
    const clean = text.trim().toLowerCase();
    return clean !== 'none' && clean !== 'null' && clean !== '' && !clean.includes('[better_sentence] none') && !clean.includes('[vocabulary] none');
  };

  const showGrammar = hasFeedbackText(item.grammarCorrection);
  const showBetter = hasFeedbackText(item.betterSentence);
  const showVocab = hasFeedbackText(item.vocabularySuggestions);
  const showFollowup = hasFeedbackText(item.followUpQuestion);
  const showNativeTip = hasFeedbackText(item.nativeTip);

  const hasAnyFeedback = !isUser && (showGrammar || showBetter || showVocab || showFollowup || showNativeTip);

  if (isUser) {
    return (
      <AnimatedChatBubble isUser={true} onLongPress={() => onOpenMenu(item)}>
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={[styles.bubbleText, styles.userText]}>
            {item.message}
          </Text>
        </View>
        <View style={[styles.avatar, styles.userAvatar]}>
          <Ionicons name="person" size={14} color="#FFF" />
        </View>
      </AnimatedChatBubble>
    );
  }

  return (
    <View style={styles.aiItemContainer}>
      <AnimatedChatBubble isUser={false} onLongPress={() => onOpenMenu(item)}>
        <View style={[styles.avatar, styles.aiAvatar]}>
          <Ionicons name="sparkles" size={14} color="#FFF" />
        </View>

        <View style={[styles.bubble, styles.aiBubble]}>
          <Text style={[styles.bubbleText, styles.aiText]}>
            {item.message}
          </Text>
          {item.bookmarked && (
            <Ionicons name="star" size={12} color="#F59E0B" style={styles.starIcon} />
          )}
        </View>
      </AnimatedChatBubble>

      {/* Speaking Coach & Phrasing Card - Full-width matching Speaking Practice module */}
      {hasAnyFeedback && (
        <SpeakingCoachCard item={item} onSpeakText={onSpeakText} />
      )}
    </View>
  );
}, (prev, next) => {
  return prev.item === next.item && prev.onSpeakText === next.onSpeakText && prev.onOpenMenu === next.onOpenMenu;
});

// ─── Sound Wave Component ────────────────────────────────────────────────────
function VoiceWaveBars({ isRecording }) {
  const animatedValues = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    let anim = null;
    let frameId = null;

    if (isRecording) {
      frameId = requestAnimationFrame(() => {
        const animations = animatedValues.map((val) => {
          return Animated.loop(
            Animated.sequence([
              Animated.timing(val, {
                toValue: 1.5 + Math.random() * 2.0,
                duration: 250 + Math.random() * 200,
                useNativeDriver: true,
              }),
              Animated.timing(val, {
                toValue: 0.5 + Math.random() * 0.5,
                duration: 250 + Math.random() * 200,
                useNativeDriver: true,
              }),
            ])
          );
        });
        anim = Animated.parallel(animations);
        anim.start();
      });
    } else {
      animatedValues.forEach(val => val.setValue(1));
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (anim) anim.stop();
    };
  }, [isRecording]);

  return (
    <View style={styles.voiceWaveRow}>
      {animatedValues.map((val, i) => (
        <Animated.View
          key={i}
          style={[
            styles.voiceWaveBar,
            {
              transform: [{ scaleY: val }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const getModeHints = (modeParam, lastAiMsg) => {
  const m = (modeParam || '').toLowerCase();
  const text = ((lastAiMsg?.message || '') + ' ' + (lastAiMsg?.followUpQuestion || '')).toLowerCase();

  if (text.includes('name') || text.includes('who are you') || text.includes('introduce')) {
    return [
      "Hi! Nice to meet you. I'm excited to practice English!",
      "Hello! I'm here to build my speaking confidence and fluency.",
      "Could you tell me a little about yourself as well?"
    ];
  }
  if (text.includes('hobby') || text.includes('free time') || text.includes('weekend') || text.includes('do for fun')) {
    return [
      "In my free time, I really enjoy reading and listening to music.",
      "I love going for walks outdoors and playing video games.",
      "What are popular weekend activities in your country?"
    ];
  }
  if (text.includes('how are you') || text.includes('how was your day') || text.includes('how is it going')) {
    return [
      "I'm doing great, thank you! How has your day been?",
      "Everything is going well! Ready for today's practice.",
      "It's been a busy day, but I'm excited to learn."
    ];
  }
  if (text.includes('why') && (text.includes('learn') || text.includes('english') || text.includes('practice'))) {
    return [
      "I want to communicate fluently for my career and global travel.",
      "To express myself naturally and connect with people worldwide.",
      "What is your best tip for speaking more like a native?"
    ];
  }
  if (m.includes('travel') || text.includes('trip') || text.includes('flight') || text.includes('hotel') || text.includes('visit')) {
    return [
      "Could you recommend the most famous attractions to visit here?",
      "I would like to book a table for two at seven, please.",
      "What is the best way to get to the airport from the city center?"
    ];
  }
  if (m.includes('interview') || text.includes('job') || text.includes('career') || text.includes('experience') || text.includes('strength')) {
    return [
      "My greatest strength is my problem-solving ability and teamwork.",
      "I have experience collaborating in fast-paced team environments.",
      "Could you give me constructive feedback on my interview answer?"
    ];
  }
  if (m.includes('business') || text.includes('meeting') || text.includes('project') || text.includes('email')) {
    return [
      "Let's review the main agenda items and key deliverables for this project.",
      "I agree with that proposal and suggest we set next steps.",
      "Could you provide your insights on how to improve this strategy?"
    ];
  }
  if (m.includes('grammar') || m.includes('coach') || text.includes('tense') || text.includes('rule')) {
    return [
      "Could you explain the difference between past simple and present perfect?",
      "Is there a more natural, native way to phrase that sentence?",
      "Could you give me another example sentence so I can practice?"
    ];
  }
  if (m.includes('vocabulary') || m.includes('vocab') || text.includes('idiom') || text.includes('synonym')) {
    return [
      "What are common native synonyms for 'good' and 'interesting'?",
      "Could you teach me a useful idiom for everyday conversations?",
      "Let's practice using these new vocabulary words in sentences."
    ];
  }
  if (m.includes('ielts') || text.includes('part 1') || text.includes('part 2') || text.includes('band')) {
    return [
      "In my opinion, technology has brought both significant advantages and drawbacks.",
      "From my personal experience, consistent daily effort makes all the difference.",
      "Could you score my response based on IELTS fluency and vocabulary criteria?"
    ];
  }
  if (m.includes('debate') || text.includes('agree') || text.includes('opinion') || text.includes('think about')) {
    return [
      "While I understand that viewpoint, there is another key factor to consider.",
      "The primary evidence strongly supports taking a proactive approach.",
      "How would you address the strongest counter-argument to that point?"
    ];
  }
  if (m.includes('story') || text.includes('tell me a story') || text.includes('narrate') || text.includes('what happened')) {
    return [
      "It all started on a rainy evening when something unexpected happened.",
      "As soon as we arrived, we realized everything had changed completely.",
      "What do you think happens next in this story?"
    ];
  }
  return [
    "That makes a lot of sense! Could you share an example?",
    "I understand completely. What should we focus on next?",
    "Could you give me an example of how a native speaker would say that?"
  ];
};

const NORMAL_SILENCE_THRESHOLD = 3000;
const INCOMPLETE_SILENCE_THRESHOLD = 4500;
const INITIAL_SILENCE_THRESHOLD = 8000;

const INCOMPLETE_CONNECTORS = [
  'because', 'and', 'or', 'but', 'so', 'if', 'that', 'which', 'who', 'whom',
  'whose', 'although', 'though', 'even though', 'while', 'whereas', 'since',
  'unless', 'until', 'as', 'to', 'for', 'with', 'about', 'like', 'such as',
  'in order to', 'so that', 'after', 'before', 'when', 'whenever', 'where',
  'wherever', 'whether', 'than', 'as well as', 'both', 'either', 'neither',
  'not only', 'also', 'furthermore', 'moreover', 'however', 'therefore',
  'besides', 'meanwhile', 'actually', 'basically', 'honestly', 'well', 'um',
  'uh', 'i mean', 'you know', 'at', 'by', 'from', 'in', 'into', 'of', 'off',
  'on', 'onto', 'out', 'over', 'through', 'toward', 'towards', 'under',
  'upon', 'within', 'without'
];

function isIncompleteSentence(text) {
  if (!text) return false;
  const cleaned = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const lastWord = words[words.length - 1];
  const lastTwoWords = words.length >= 2 ? `${words[words.length - 2]} ${lastWord}` : '';
  const lastThreeWords = words.length >= 3 ? `${words[words.length - 3]} ${words[words.length - 2]} ${lastWord}` : '';
  return (
    INCOMPLETE_CONNECTORS.includes(lastWord) ||
    INCOMPLETE_CONNECTORS.includes(lastTwoWords) ||
    INCOMPLETE_CONNECTORS.includes(lastThreeWords)
  );
}

export default function ConversationChatScreen({ navigation, route }) {
  const { sessionId, mode, title } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [chatLevel, setChatLevel] = useState('Beginner');
  const [avatarExpression, setAvatarExpression] = useState(undefined);
  const [hints, setHints] = useState([]);
  const [loadingHints, setLoadingHints] = useState(false);
  
  // Voice preferences
  const [availableVoices, setAvailableVoices] = useState([]);
  const [preferredVoice, setPreferredVoice] = useState('Friendly');
  const [onboardingVoiceStyle, setOnboardingVoiceStyle] = useState('Friendly');
  const [speechSpeed, setSpeechSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [statusText, setStatusText] = useState('Waiting for Response');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpokenText, setCurrentSpokenText] = useState('');
  const initialAvatar = route.params?.avatarModel || getCachedAvatarModel() || 'haru';
  const [selectedAvatarModel, setSelectedAvatarModel] = useState(initialAvatar);

  const handleSelectAvatarModel = async (modelName) => {
    setSelectedAvatarModel(modelName);
    setCachedAvatarModel(modelName);
  };

  // Immediate local avatar load (zero network delay) if route param wasn't passed
  useEffect(() => {
    if (!route.params?.avatarModel) {
      AsyncStorage.getItem('speakmate_avatar_model').then((saved) => {
        if (saved) {
          setSelectedAvatarModel(saved);
          setCachedAvatarModel(saved);
        }
      }).catch(() => {});
    }
  }, [route.params?.avatarModel]);

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  // Long-press Actions Modal
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const hasUserSentMessageRef = useRef(false);
  const isFinishedRef = useRef(false);
  const currentSessionIdRef = useRef(sessionId);

  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  // Clean up and auto-delete empty ghost session on exit if user never sent any message
  useEffect(() => {
    return () => {
      const sId = currentSessionIdRef.current;
      if (!hasUserSentMessageRef.current && !isFinishedRef.current && sId && !String(sId).startsWith('sim_')) {
        chatService.deleteSession(sId).catch(() => {});
      }
    };
  }, []);

  const flatListRef = useRef(null);
  const isInitialMount = useRef(true);
  const wasSpeakingOnPause = useRef(false);

  const handleScrollToIndexFailed = (info) => {
    setTimeout(() => {
      if (flatListRef.current && messages.length > info.index) {
        try {
          flatListRef.current.scrollToIndex({
            index: info.index,
            animated: true,
            viewPosition: 0,
          });
        } catch (_) {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      }
    }, 100);
  };

  // Align viewport so the AI tutor's response is at the top, followed by suggestions below it
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!messages || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    const scrollTimer = setTimeout(() => {
      if (!flatListRef.current) return;
      if (lastMsg?.sender === 'user') {
        flatListRef.current.scrollToEnd({ animated: true });
      } else {
        const targetIndex = messages.length - 1;
        try {
          flatListRef.current.scrollToIndex({
            index: targetIndex,
            animated: true,
            viewPosition: 0,
          });
        } catch (_) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: targetIndex,
              animated: true,
              viewPosition: 0,
            });
          }, 100);
        }
      }
    }, 120);

    return () => clearTimeout(scrollTimer);
  }, [messages]);

  // Live Speech Recognition & Silence Auto-Stop refs & Session Token
  const [currentTranscript, setCurrentTranscript] = useState('');
  const silenceTimerRef = useRef(null);
  const initialSilenceTimerRef = useRef(null);
  const stoppingRef = useRef(false);
  const startingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const recordingSessionIdRef = useRef(0);
  const accumulatedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isSendingRef = useRef(false);
  const fallbackRecorderRef = useRef(null);

  // Speech Recognition Event Listeners (Continuous Streaming Speech-to-Text)
  useEffect(() => {
    const subResult = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      if (!isRecordingRef.current || isSendingRef.current) return;

      const results = event.results || [];
      let finalChunk = '';
      let interim = '';

      for (let i = 0; i < results.length; i++) {
        const item = results[i];
        if (item.isFinal) {
          finalChunk += (item.transcript || '') + ' ';
        } else {
          interim += (item.transcript || '');
        }
      }

      if (finalChunk) {
        accumulatedTranscriptRef.current += finalChunk;
      }
      interimTranscriptRef.current = interim;

      const full = `${accumulatedTranscriptRef.current} ${interim}`
        .replace(/\s+/g, ' ')
        .trim();
      setCurrentTranscript(full);

      // Reset silence timer on every speech event
      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Arm auto-send timer when speech has been detected (>= 2 chars)
      if (full.length >= 2) {
        const activeSessionId = recordingSessionIdRef.current;
        const threshold = isIncompleteSentence(full)
          ? INCOMPLETE_SILENCE_THRESHOLD
          : NORMAL_SILENCE_THRESHOLD;

        silenceTimerRef.current = setTimeout(() => {
          if (
            recordingSessionIdRef.current === activeSessionId &&
            !isSendingRef.current &&
            isRecordingRef.current
          ) {
            stopRecordingAndSend();
          }
        }, threshold);
      }
    });

    const subError = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      console.warn('[SpeechRecognition] error notice:', event?.error || event);
      if (event?.error === 'no-speech') return;
      if (event?.error === 'not-allowed') {
        isRecordingRef.current = false;
        setRecording(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
    });

    const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
      if (isRecordingRef.current && !isSendingRef.current) {
        try {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            continuous: true,
            interimResults: true,
          });
        } catch (_) {}
      }
    });

    return () => {
      subResult.remove();
      subError.remove();
      subEnd.remove();
      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
    };
  }, []);

  // Auto-collapse top avatar on keyboard show and smoothly lift chat input bar
  useEffect(() => {
    const handleKeyboardShow = (e) => {
      const rawHeight = e?.endCoordinates?.height || 0;
      // On Android with translucent status bar and navigation bar, raw keyboard height is short by system insets (~80px)
      const androidSystemOffset = Platform.OS === 'android' ? 80 : 0;
      const targetHeight = rawHeight > 0 ? rawHeight + androidSystemOffset : 0;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);
      Animated.timing(keyboardHeightAnim, {
        toValue: targetHeight,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 150,
        useNativeDriver: false,
      }).start();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleKeyboardHide = (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 150,
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      handleKeyboardShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      handleKeyboardHide
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Fetch Voice Preference ───
  useEffect(() => {
    async function loadVoices() {
      try {
        const voices = await VoiceService.getAvailableEnglishVoices();
        setAvailableVoices(voices);
      } catch (e) {
        console.warn("Failed to retrieve English voices:", e);
      }

      try {
        const [settings, onboardingVoice, profile, savedVoice, savedGender, savedAvatarModel] = await Promise.all([
          settingsService.get().catch(() => null),
          AsyncStorage.getItem('speakmate_onboarding_voice'),
          profileService.get().catch(() => null),
          AsyncStorage.getItem('speakmate_selected_voice'),
          AsyncStorage.getItem('speakmate_voice_gender'),
          AsyncStorage.getItem('speakmate_avatar_model'),
        ]);
        const canonicalTutor = getActiveTutorSync();
        const effectiveVoice = canonicalTutor?.aiVoice || savedVoice || settings?.aiVoice || (savedGender === 'male' ? 'US Male' : 'Default');
        setPreferredVoice(effectiveVoice);
        if (onboardingVoice) {
          setOnboardingVoiceStyle(onboardingVoice);
        }
        const savedGrade = await AsyncStorage.getItem('speakmate_school_grade');
        const savedAgeGroup = await AsyncStorage.getItem('speakmate_age_group');
        const isKids = Boolean(
          (savedAgeGroup && savedAgeGroup.toLowerCase() === 'kids') ||
          (savedGrade && ['1st std', '2nd std', '3rd std', '4th std', '5th std'].includes(savedGrade.toLowerCase()))
        );
        const isMaleVoice = Boolean(
          savedGender === 'male' ||
          (effectiveVoice && effectiveVoice.toLowerCase().includes('male')) ||
          (savedVoice && savedVoice.toLowerCase().includes('male'))
        );

        // Prioritize explicit user selection (route param -> canonical -> saved -> cache -> sensible default)
        let resolvedModel = route.params?.avatarModel || canonicalTutor?.avatarModel || savedAvatarModel || getCachedAvatarModel();
        if (!resolvedModel) {
          if (isKids) {
            resolvedModel = 'robopaws';
          } else if (isMaleVoice) {
            resolvedModel = 'chitose';
          } else {
            resolvedModel = 'haru';
          }
        }
        const finalAvatar = getAvatarById(resolvedModel);
        setSelectedAvatarModel(finalAvatar.id);
        setCachedAvatarModel(finalAvatar.id);
        if (savedGrade) {
          setChatLevel(savedGrade);
        } else if (profile && profile.englishLevel) {
          setChatLevel(profile.englishLevel);
        }
        // Always reset voice speed to 1.0x (Normal Default) when entering a session
        setSpeechSpeed(1.0);
        await AsyncStorage.setItem('speakmate_voice_speed', '1.0');
      } catch (e) {
        console.warn("Failed to load user voice preferences:", e);
      }
    }
    const speakInitialMessage = (text) => {
      setTimeout(async () => {
        try {
          const [savedVoice, voices] = await Promise.all([
            AsyncStorage.getItem('speakmate_selected_voice'),
            VoiceService.getAvailableEnglishVoices().catch(() => []),
          ]);
          setCurrentSpokenText(text);
          VoiceService.speak(text, {
            isMuted: false,
            avatarId: selectedAvatarModel,
            voiceType: savedVoice || preferredVoice || 'Friendly',
            speechSpeed: 1.0,
            availableVoices: voices && voices.length > 0 ? voices : availableVoices,
            onStart: () => {
              setStatusText('Speaking');
              setIsSpeaking(true);
            },
            onDone: () => {
              setStatusText('Waiting for Response');
              setIsSpeaking(false);
              setCurrentSpokenText('');
            },
            onError: () => {
              setStatusText('Waiting for Response');
              setIsSpeaking(false);
              setCurrentSpokenText('');
            },
          });
        } catch (err) {
          console.warn('Auto speak 1st message note:', err);
        }
      }, 550);
    };

    // Load initial conversation messages
    const defaultGreeting = `Hello! I am SpeakMateAI, your English tutor for ${mode || 'General English'}. What would you like to practice today?`;
    if (sessionId && !String(sessionId).startsWith('sim_')) {
      chatService.detail(sessionId).then((data) => {
        if (data && data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          if (data.messages.some((m) => m.sender === 'user')) {
            hasUserSentMessageRef.current = true;
          }
          const lastAi = [...data.messages].reverse().find((m) => m.sender === 'ai');
          if (lastAi && lastAi.message) {
            speakInitialMessage(lastAi.message);
          }
        } else {
          setMessages([{
            id: 'intro_1',
            sender: 'ai',
            message: defaultGreeting,
            createdAt: new Date().toISOString(),
          }]);
          speakInitialMessage(defaultGreeting);
        }
      }).catch((e) => {
        console.warn('Could not load chat detail, using initial greeting:', e);
        setMessages([{
          id: 'intro_1',
          sender: 'ai',
          message: defaultGreeting,
          createdAt: new Date().toISOString(),
        }]);
        speakInitialMessage(defaultGreeting);
      });
    } else {
      setMessages([{
        id: 'intro_1',
        sender: 'ai',
        message: defaultGreeting,
        createdAt: new Date().toISOString(),
      }]);
      speakInitialMessage(defaultGreeting);
    }

    return () => {
      VoiceService.stop();
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
      if (fallbackRecorderRef.current) {
        fallbackRecorderRef.current.stop().catch(() => {});
        fallbackRecorderRef.current = null;
      }
      VoiceRecorder.resetAudioMode().catch(() => {});
    };
  }, []);

  // Reload settings and voices whenever the screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const [settings, voices, onboardingVoice, savedVoice, savedGender, canonicalTutor] = await Promise.all([
          settingsService.get().catch(() => null),
          VoiceService.getAvailableEnglishVoices(),
          AsyncStorage.getItem('speakmate_onboarding_voice'),
          AsyncStorage.getItem('speakmate_selected_voice'),
          AsyncStorage.getItem('speakmate_voice_gender'),
          getActiveTutorAsync(),
        ]);
        const effectiveVoice = canonicalTutor?.aiVoice || savedVoice || settings?.aiVoice || (savedGender === 'male' ? 'US Male' : undefined);
        if (effectiveVoice) {
          setPreferredVoice(effectiveVoice);
        }
        if (!route.params?.avatarModel && canonicalTutor?.avatarModel) {
          setSelectedAvatarModel(canonicalTutor.avatarModel);
          setCachedAvatarModel(canonicalTutor.avatarModel);
        }
        if (voices && voices.length > 0) {
          setAvailableVoices(voices);
        }
        if (onboardingVoice) {
          setOnboardingVoiceStyle(onboardingVoice);
        }
      } catch (e) {
        console.warn("Failed to reload user voice preference on focus:", e);
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Screen blur cleanup: Stop TTS, cancel recording and VAD, dismiss keyboard and popup menus
  useEffect(() => {
    const unsubBlur = navigation.addListener('blur', () => {
      VoiceService.stop();
      setIsSpeaking(false);
      setCurrentSpokenText('');
      setStatusText('Waiting for Response');
      setMenuVisible(false);
      Keyboard.dismiss();

      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (isRecordingRef.current) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch (_) {}
        if (fallbackRecorderRef.current) {
          fallbackRecorderRef.current.stop().catch(() => {});
          fallbackRecorderRef.current = null;
        }
        VoiceRecorder.resetAudioMode().catch(() => {});
        isRecordingRef.current = false;
        setRecording(false);
      }
    });

    return unsubBlur;
  }, [navigation]);

  const getSpeakableText = (msg) => {
    if (!msg) return '';
    let text = msg.message || '';
    const isCorrect = msg.grammarCorrection && (msg.grammarCorrection.includes('✅') || msg.grammarCorrection.toLowerCase().includes('correct'));
    if (msg.grammarCorrection && !isCorrect) {
      text += `. A better way to say that is: "${msg.grammarCorrection}".`;
      if (msg.explanation) {
        text += ` ${msg.explanation}`;
      }
    } else if (msg.betterSentence) {
      text += `. You could also express it as: "${msg.betterSentence}".`;
      if (msg.explanation) {
        text += ` ${msg.explanation}`;
      }
    }
    if (msg.followUpQuestion) {
      text += ` ${msg.followUpQuestion}`;
    }
    return text;
  };

  const avatarGender = VoiceService.getAvatarGender(preferredVoice, onboardingVoiceStyle);

  const speakText = useCallback((text, speedOverride = null) => {
    const effectiveSpeed = speedOverride !== null && speedOverride !== undefined ? speedOverride : speechSpeed;
    setCurrentSpokenText(text);
    VoiceService.speak(text, {
      isMuted,
      avatarId: selectedAvatarModel,
      voiceType: preferredVoice,
      speechSpeed: effectiveSpeed,
      availableVoices,
      onStart: () => {
        setStatusText('Speaking');
        setIsSpeaking(true);
      },
      onDone: () => {
        setStatusText('Waiting for Response');
        setIsSpeaking(false);
        setCurrentSpokenText('');
      },
      onError: () => {
        setStatusText('Waiting for Response');
        setIsSpeaking(false);
        setCurrentSpokenText('');
      }
    });
  }, [speechSpeed, isMuted, selectedAvatarModel, preferredVoice, availableVoices]);

  const speakAiWithCoaching = (aiMsg) => {
    if (!aiMsg || isMuted) return;

    // Stop any in-flight voice immediately
    VoiceService.stop();

    // 1. Build dynamic in-character reply + dynamic follow-up question
    let mainReply = aiMsg.message || '';
    if (aiMsg.followUpQuestion && !mainReply.includes(aiMsg.followUpQuestion)) {
      mainReply += ` ${aiMsg.followUpQuestion}`;
    }

    // 2. Check if the grammar was already correct
    const cleanCorrection = aiMsg.grammarCorrection && typeof aiMsg.grammarCorrection === 'string'
      ? aiMsg.grammarCorrection.replace(/^👉\s*/, '').replace(/[\[\]"]/g, '').trim()
      : null;

    const isGrammarCorrect = !cleanCorrection ||
      cleanCorrection.includes('✅') ||
      cleanCorrection.toLowerCase().includes('correct') ||
      cleanCorrection.toLowerCase() === 'none' ||
      cleanCorrection.toLowerCase() === 'null';

    // 3. Check for better sentence suggestion
    const cleanBetter = aiMsg.betterSentence && typeof aiMsg.betterSentence === 'string'
      ? aiMsg.betterSentence.replace(/[\[\]"]/g, '').trim()
      : null;

    const hasBetter = cleanBetter &&
      cleanBetter.toLowerCase() !== 'null' &&
      cleanBetter.toLowerCase() !== 'none' &&
      !cleanBetter.includes('✅');

    // 4. Clean explanation
    const cleanExplanation = aiMsg.explanation && typeof aiMsg.explanation === 'string'
      ? aiMsg.explanation.replace(/[\[\]"]/g, '').trim()
      : null;
    const hasExplanation = cleanExplanation &&
      cleanExplanation.toLowerCase() !== 'null' &&
      cleanExplanation.toLowerCase() !== 'none';

    // SCENARIO A: Sentence is 100% correct! (Never say "a better way")
    if (isGrammarCorrect && !hasBetter) {
      const praises = ["Spot on!", "Nicely said!", "Well phrased!", "Great sentence!"];
      const randomPraise = praises[Math.floor(Math.random() * praises.length)];
      const fullSpeech = `${randomPraise} ${mainReply}`;

      setCurrentSpokenText(fullSpeech);
      VoiceService.speak(fullSpeech, {
        isMuted,
        avatarId: selectedAvatarModel,
        voiceType: preferredVoice,
        speechSpeed,
        availableVoices,
        onStart: () => {
          setStatusText('Speaking');
          setIsSpeaking(true);
        },
        onDone: () => {
          setStatusText('Waiting for Response');
          setIsSpeaking(false);
          setCurrentSpokenText('');
          wasSpeakingOnPause.current = false;
        },
        onError: () => {
          setStatusText('Waiting for Response');
          setIsSpeaking(false);
          setCurrentSpokenText('');
          wasSpeakingOnPause.current = false;
        }
      });
      return;
    }

    // SCENARIO B: Sentence has a mistake or better phrasing exists!
    const targetPhrase = (!isGrammarCorrect && cleanCorrection) ? cleanCorrection : cleanBetter;
    const acknowledgments = ["Got it!", "I see what you mean!", "Makes total sense!"];
    const randomAck = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

    const tipPrefixes = [
      "Quick tip—you can say",
      "By the way, you can phrase that as",
      "A natural way to say that is"
    ];
    const randomPrefix = tipPrefixes[Math.floor(Math.random() * tipPrefixes.length)];

    const coachingPhrase = `${randomAck} ${randomPrefix}: "${targetPhrase}".${hasExplanation ? ` ${cleanExplanation}` : ''}`;

    // Stage 1: Speak the coaching tip + reason first
    setStatusText('Coaching Tip');
    setIsSpeaking(true);
    setCurrentSpokenText(coachingPhrase);

    VoiceService.speak(coachingPhrase, {
      isMuted,
      avatarId: selectedAvatarModel,
      voiceType: preferredVoice,
      speechSpeed,
      availableVoices,
      onStart: () => {
        setStatusText('Coaching Tip');
        setIsSpeaking(true);
      },
      onDone: () => {
        // Stop lip movement & clear spoken text during the 0.5s conversational pause
        setIsSpeaking(false);
        setCurrentSpokenText('');

        // Stage 2: 0.5s natural conversational pause before speaking dynamic conversation reply + follow-up
        if (!isMuted) {
          setTimeout(() => {
            if (!isMuted) {
              setStatusText('Speaking');
              setIsSpeaking(true);
              setCurrentSpokenText(mainReply);

              VoiceService.speak(mainReply, {
                isMuted,
                avatarId: selectedAvatarModel,
                voiceType: preferredVoice,
                speechSpeed,
                availableVoices,
                onStart: () => {
                  setStatusText('Speaking');
                  setIsSpeaking(true);
                },
                onDone: () => {
                  setStatusText('Waiting for Response');
                  setIsSpeaking(false);
                  setCurrentSpokenText('');
                  wasSpeakingOnPause.current = false;
                },
                onError: () => {
                  setStatusText('Waiting for Response');
                  setIsSpeaking(false);
                  setCurrentSpokenText('');
                  wasSpeakingOnPause.current = false;
                }
              });
            }
          }, 500);
        } else {
          setStatusText('Waiting for Response');
          setIsSpeaking(false);
          setCurrentSpokenText('');
          wasSpeakingOnPause.current = false;
        }
      },
      onError: () => {
        setStatusText('Waiting for Response');
        setIsSpeaking(false);
        setCurrentSpokenText('');
        wasSpeakingOnPause.current = false;
      }
    });
  };

  const handleSendMessage = async (textToSend = inputText) => {
    const cleanText = textToSend.trim();
    if (!cleanText) return;

    setInputText('');
    setHints([]);
    setEvaluating(true);
    setStatusText('Thinking');

    // Optimistically push user message
    const tempUserMsg = {
      id: Date.now(),
      sender: 'user',
      message: cleanText,
      createdAt: new Date().toISOString(),
    };
    hasUserSentMessageRef.current = true;
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let response;
      if (sessionId && !String(sessionId).startsWith('sim_')) {
        response = await chatService.send(sessionId, cleanText, !isMuted, chatLevel);
      } else {
        const aiRes = await aiService.chat(cleanText);
        response = {
          id: Date.now() + 1,
          sender: 'ai',
          message: aiRes?.response || 'That is a great point! Can you tell me more about that?',
          grammarCorrection: '✅ Your sentence is correct.',
          betterSentence: null,
          vocabularySuggestions: null,
          explanation: null,
          followUpQuestion: 'What else would you like to explore?',
          createdAt: new Date().toISOString(),
        };
      }
      setMessages((prev) => [...prev, response]);

      const isCorrect = response.grammarCorrection && (
        response.grammarCorrection.includes('✅') || 
        response.grammarCorrection.toLowerCase().includes('correct')
      );
      if (isCorrect) {
        setAvatarExpression('happy');
        setTimeout(() => setAvatarExpression(undefined), 3500);
      }

      // Automatically play TTS with 0.45s coaching pause
      speakAiWithCoaching(response);
    } catch {
      try {
        const aiRes = await aiService.chat(cleanText);
        const fallbackMsg = {
          id: Date.now() + 1,
          sender: 'ai',
          message: aiRes?.response || 'That is a great thought! Can you share more about that?',
          grammarCorrection: '✅ Your sentence is correct.',
          betterSentence: null,
          vocabularySuggestions: null,
          explanation: null,
          followUpQuestion: null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        speakAiWithCoaching(fallbackMsg);
      } catch (err2) {
        Alert.alert('Tutor request failed', 'Could not get response. Please try again.');
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      }
    } finally {
      setEvaluating(false);
      setStatusText('Waiting for Response');
    }
  };

  const startRecording = async () => {
    if (startingRef.current || isRecordingRef.current || isSendingRef.current) return;
    startingRef.current = true;

    try {
      VoiceService.stop();
      setIsSpeaking(false);

      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const permResult = await checkAndRequestMicPermissions();
      if (!permResult.granted) {
        startingRef.current = false;
        if (permResult.permanentlyDenied) {
          promptOpenSettingsForMic(
            'Microphone Permission Required',
            'SpeakMate AI needs microphone access to listen to your voice. Please enable microphone permissions in your device settings.'
          );
        } else {
          Alert.alert(
            'Microphone Access Needed',
            'Please allow microphone access to practice speaking with your AI tutor.'
          );
        }
        return;
      }

      if (isNativeSpeechRecognitionAvailable) {

        const activeSessionId = recordingSessionIdRef.current + 1;
        recordingSessionIdRef.current = activeSessionId;
        accumulatedTranscriptRef.current = '';
        interimTranscriptRef.current = '';
        setCurrentTranscript('');
        isRecordingRef.current = true;
        setRecording(true);
        setStatusText('Listening');

        // Option B: Auto-close after 8 seconds of complete silence
        initialSilenceTimerRef.current = setTimeout(() => {
          if (
            recordingSessionIdRef.current === activeSessionId &&
            isRecordingRef.current &&
            !isSendingRef.current
          ) {
            isRecordingRef.current = false;
            setRecording(false);
            setStatusText('Waiting for Response');
            try {
              ExpoSpeechRecognitionModule.stop();
            } catch (_) {}
            Alert.alert('No Speech Detected 🤫', 'No words were heard. Tap the mic when you are ready to speak.');
          }
        }, INITIAL_SILENCE_THRESHOLD);

        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          continuous: true,
          interimResults: true,
        });
      } else {
        // Fallback for dev client APKs where native speech recognition binary is not yet compiled
        const granted = await VoiceRecorder.requestPermissions();
        if (!granted) {
          Alert.alert('Microphone Access Denied', 'Please allow microphone access to use voice chat.');
          startingRef.current = false;
          return;
        }

        if (fallbackRecorderRef.current) {
          try {
            await fallbackRecorderRef.current.stop();
          } catch (_) {}
          fallbackRecorderRef.current = null;
        }

        const activeSessionId = recordingSessionIdRef.current + 1;
        recordingSessionIdRef.current = activeSessionId;
        accumulatedTranscriptRef.current = '';
        interimTranscriptRef.current = '';
        setCurrentTranscript('');
        isRecordingRef.current = true;
        setRecording(true);
        setStatusText('Listening');

        const recorder = new VoiceRecorder();
        fallbackRecorderRef.current = recorder;
        await recorder.start();

        // Option B: Auto-close after 8 seconds of complete silence
        initialSilenceTimerRef.current = setTimeout(async () => {
          if (
            recordingSessionIdRef.current === activeSessionId &&
            isRecordingRef.current &&
            !isSendingRef.current
          ) {
            isRecordingRef.current = false;
            setRecording(false);
            setStatusText('Waiting for Response');
            try {
              if (fallbackRecorderRef.current) {
                await fallbackRecorderRef.current.stop();
                fallbackRecorderRef.current = null;
              }
              await VoiceRecorder.resetAudioMode();
            } catch (_) {}
            Alert.alert('No Speech Detected 🤫', 'No words were heard. Tap the mic when you are ready to speak.');
          }
        }, INITIAL_SILENCE_THRESHOLD);
      }
    } catch (err) {
      console.warn('[SpeechRecognition] Voice chat recording start failed:', err);
      Alert.alert('Speech Recognition Error', 'Could not initialize speech recognition. Please check permissions.');
      isRecordingRef.current = false;
      setRecording(false);
      setStatusText('Waiting for Response');
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecordingAndSend = async () => {
    if (stoppingRef.current || isSendingRef.current) return;
    stoppingRef.current = true;

    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    isRecordingRef.current = false;
    setRecording(false);
    setStatusText('Thinking');

    if (isNativeSpeechRecognitionAvailable) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}

      const finalSpoken = `${accumulatedTranscriptRef.current} ${interimTranscriptRef.current}`
        .replace(/\s+/g, ' ')
        .trim() || currentTranscript.replace(/\s+/g, ' ').trim();

      accumulatedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      setCurrentTranscript('');

      if (!finalSpoken || finalSpoken.length < 2) {
        setStatusText('Waiting for Response');
        stoppingRef.current = false;
        return;
      }

      isSendingRef.current = true;
      setLoading(true);

      try {
        setInputText(finalSpoken);
        await handleSendMessage(finalSpoken);
      } catch (err) {
        console.warn('Voice chat transcription failed:', err);
        Alert.alert('Transcription Failed', 'Make sure you have an active internet connection.');
        setStatusText('Waiting for Response');
      } finally {
        setLoading(false);
        stoppingRef.current = false;
        isSendingRef.current = false;
      }
    } else {
      // Fallback: stop audio recorder and transcribe via Whisper
      try {
        const recorder = fallbackRecorderRef.current;
        fallbackRecorderRef.current = null;
        if (!recorder) {
          setStatusText('Waiting for Response');
          stoppingRef.current = false;
          return;
        }

        const uri = await recorder.stop();
        await VoiceRecorder.resetAudioMode();

        if (!uri) {
          setStatusText('Waiting for Response');
          stoppingRef.current = false;
          return;
        }

        isSendingRef.current = true;
        setLoading(true);

        const res = await speechService.speechToText({
          uri,
          name: 'chat_recording.m4a',
          type: Platform.OS === 'ios' ? 'audio/x-m4a' : 'audio/mp4',
        });

        if (res && res.transcript && res.transcript.trim()) {
          const spoken = res.transcript.trim();
          setInputText(spoken);
          await handleSendMessage(spoken);
        } else {
          Alert.alert('Silence Detected 🤫', 'Could not hear any speech. Please try speaking again.');
          setStatusText('Waiting for Response');
        }
      } catch (err) {
        console.warn('Fallback voice chat audio processing failed:', err);
        Alert.alert('Audio Processing Failed', 'Could not process audio. Please try again.');
        setStatusText('Waiting for Response');
      } finally {
        setLoading(false);
        stoppingRef.current = false;
        isSendingRef.current = false;
      }
    }
  };

  const handleToggleRecording = () => {
    if (recording || isRecordingRef.current) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  };

  // ─── Actions Menus ───
  const handleOpenMenu = useCallback((message) => {
    setSelectedMessage(message);
    setMenuVisible(true);
  }, []);

  const handleCopyMessage = async () => {
    if (selectedMessage) {
      setMenuVisible(false);
      try {
        await Share.share({ message: selectedMessage.message });
      } catch (e) {
        Alert.alert('Message', selectedMessage.message);
      }
    }
  };

  const handleReplayVoice = () => {
    if (selectedMessage) {
      speakAiWithCoaching(selectedMessage);
      setMenuVisible(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (selectedMessage) {
      try {
        const bookmarked = await chatService.toggleBookmark(selectedMessage.id);
        Alert.alert(
          bookmarked ? 'Bookmarked! ⭐' : 'Bookmark Removed',
          bookmarked ? 'Saved grammar/vocabulary tips to your profile.' : 'Removed tip.'
        );
        // Update local message list bookmark state
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selectedMessage.id ? { ...m, bookmarked } : m
          )
        );
      } catch {
        Alert.alert('Error', 'Failed to toggle bookmark.');
      } finally {
        setMenuVisible(false);
      }
    }
  };

  const handleAdjustSpeed = async () => {
    const SPEEDS = [0.5, 0.75, 1.0, 1.5, 2.0];
    const currentIndex = SPEEDS.indexOf(speechSpeed);
    const nextSpeed = SPEEDS[(currentIndex + 1) % SPEEDS.length];
    setSpeechSpeed(nextSpeed);
    await AsyncStorage.setItem('speakmate_voice_speed', String(nextSpeed));
    
    // Play last AI message with new speed
    const lastAi = [...messages].reverse().find((m) => m.sender === 'ai');
    if (lastAi) speakText(getSpeakableText(lastAi), nextSpeed);
  };



  const handleFetchHints = async () => {
    if (loadingHints || evaluating) return;
    if (hints.length > 0) {
      setHints([]);
      return;
    }
    setLoadingHints(true);
    try {
      if (sessionId && !String(sessionId).startsWith('sim_')) {
        const data = await chatService.getHints(sessionId);
        if (data && data.length > 0) {
          setHints(data);
          return;
        }
      }
      const lastAi = [...messages].reverse().find((m) => m.sender === 'ai');
      setHints(getModeHints(mode, lastAi));
    } catch (e) {
      const lastAi = [...messages].reverse().find((m) => m.sender === 'ai');
      setHints(getModeHints(mode, lastAi));
    } finally {
      setLoadingHints(false);
    }
  };

  const handleFinishChat = async () => {
    VoiceService.stop();
    const userMessages = messages.filter((m) => m.sender === 'user');
    const totalWords = userMessages.reduce(
      (sum, m) => sum + (m.message || '').trim().split(/\s+/).filter(Boolean).length,
      0
    );
    const isEligible = userMessages.length >= 3 && totalWords >= 15;

    try {
      let finishData = null;
      if (sessionId && !String(sessionId).startsWith('sim_')) {
        finishData = await chatService.finish(sessionId).catch(() => null);
      }
      isFinishedRef.current = true;

      const xp = finishData?.xpEarned || (isEligible ? 5 : 0);
      const msg = finishData?.feedback || (isEligible
        ? `Great job! You completed ${userMessages.length} exchanges (${totalWords} words) and earned ${xp} XP!`
        : `Session concluded with ${userMessages.length} exchanges. Practice 3+ turns next time to earn XP!`);

      Alert.alert(
        isEligible ? '🎉 Chat Complete!' : 'Session Concluded',
        msg,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch {
      isFinishedRef.current = true;
      navigation.goBack();
    }
  };

  const subtitleText = isSpeaking
    ? '✨ Tutor speaking...'
    : evaluating
    ? '✨ Tutor thinking...'
    : recording
    ? '🎙️ Listening... speak or tap mic to send'
    : '✨ Tap mic to speak';

  const keyExtractor = useCallback((item) => String(item.id), []);

  const renderChatItem = useCallback(({ item }) => (
    <ChatMessageItem
      item={item}
      onOpenMenu={handleOpenMenu}
      onSpeakText={speakText}
    />
  ), [handleOpenMenu, speakText]);

  return (
    <LinearGradient colors={['#0B0F19', '#111827', '#1E1B4B']} style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <TouchableOpacity
                  onPress={() => {
                    const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
                    const nextIdx = (LEVELS.indexOf(chatLevel) + 1) % LEVELS.length;
                    setChatLevel(LEVELS[nextIdx]);
                  }}
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#A5B4FC', fontWeight: '800' }}>⚡ {chatLevel}</Text>
                </TouchableOpacity>
                <Text style={styles.headerSubtitle}>{subtitleText}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.muteBtn}
              onPress={() => {
                if (!isMuted) VoiceService.stop();
                setIsMuted(!isMuted);
              }}
            >
              <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.finishBtn}
              onPress={handleFinishChat}
            >
              <Text style={styles.finishBtnText}>Finish ✨</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* ─── 3D AI Tutor Avatar (collapses height when typing without unmounting) ─── */}
      <View
        style={[
          styles.avatarContainer,
          isKeyboardVisible && styles.avatarContainerCollapsed,
        ]}
        pointerEvents={isKeyboardVisible ? 'none' : 'auto'}
      >
        <AIAvatar
          model={selectedAvatarModel}
          gender={getAvatarById(selectedAvatarModel).gender}
          isSpeaking={isSpeaking}
          spokenText={currentSpokenText}
          speechSpeed={speechSpeed}
          state={isSpeaking ? 'speaking' : evaluating ? 'thinking' : recording ? 'listening' : 'idle'}
          expression={avatarExpression}
          style={styles.avatar3d}
          hideStatusPill={true}
        />
      </View>

      <Animated.View style={[styles.chatContentContainer, { paddingBottom: keyboardHeightAnim }]}>
        {/* ─── Messages List ─── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          style={{ flex: 1 }}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.chatScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollToIndexFailed={handleScrollToIndexFailed}
          renderItem={renderChatItem}
          initialNumToRender={10}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          updateCellsBatchingPeriod={50}
          ListFooterComponent={
          evaluating ? (
            <View style={styles.loadingBubbleWrapper}>
              <View style={styles.loadingBubble}>
                <JumpingDotsIndicator color={COLORS.primary} size={6} space={3} />
                <Text style={[styles.loadingText, { marginLeft: 8 }]}>Thinking...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* ─── AI Hint Suggestions Drawer (Manual Toggle matching Speaking Practice) ─── */}
      {hints.length > 0 && (
        <View style={styles.hintsTray}>
          <View style={styles.hintsHeader}>
            <View style={styles.hintsHeaderTitleRow}>
              <Ionicons name="chatbox-ellipses-outline" size={13} color="#A5B4FC" />
              <Text style={styles.hintsHeaderTitle}>Suggested Responses (Tap to send or listen):</Text>
            </View>
            <TouchableOpacity
              onPress={() => setHints([])}
              style={styles.hintCloseBtn}
            >
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hintsScroll}>
            {hints.map((hint, idx) => (
              <View key={idx} style={styles.hintChipWrapper}>
                <TouchableOpacity
                  style={styles.hintChip}
                  onPress={() => {
                    setHints([]);
                    handleSendMessage(hint);
                  }}
                  disabled={evaluating || loading}
                >
                  <Text style={styles.hintChipText}>{hint}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hintAudioBtn}
                  onPress={() => speakText(hint)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-medium-outline" size={15} color="#818CF8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hintEditBtn}
                  onPress={() => {
                    setInputText(hint);
                    setHints([]);
                  }}
                >
                  <Ionicons name="pencil" size={12} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ─── Bottom Input Bar ─── */}
      <View style={[styles.inputContainer, isKeyboardVisible && styles.inputContainerKeyboard]}>
        {/* Controls row */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleAdjustSpeed}>
            <Ionicons name="speedometer-outline" size={16} color="#64748B" />
            <Text style={styles.controlText}>{speechSpeed}x</Text>
          </TouchableOpacity>

          {loadingHints ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginHorizontal: 12 }} />
          ) : (
            <TouchableOpacity style={styles.controlBtn} onPress={handleFetchHints}>
              <Ionicons name={hints.length > 0 ? "eye-off-outline" : "bulb-outline"} size={16} color={COLORS.primary} />
              <Text style={[styles.controlText, { color: COLORS.primary, fontWeight: '700' }]}>
                {hints.length > 0 ? 'Hide Hints' : 'Suggest Response'}
              </Text>
            </TouchableOpacity>
          )}

          {recording && (
            <View style={styles.liveTranscriptBar}>
              <View style={styles.liveTranscriptIndicator}>
                <View style={styles.liveTranscriptPulseDot} />
                <Text style={styles.liveTranscriptLabel}>LIVE TRANSCRIPT</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <VoiceWaveBars isRecording={recording} />
                </View>
              </View>
              <Text style={styles.liveTranscriptText} numberOfLines={2} ellipsizeMode="tail">
                {currentTranscript ? `"${currentTranscript}"` : 'Listening to your voice...'}
              </Text>
            </View>
          )}
        </View>

        {/* Typing Input */}
        {inputText.length > 450 && (
          <View style={styles.charCountRow}>
            <Text style={[styles.charCountText, inputText.length >= 500 && styles.charCountLimit]}>
              {inputText.length}/500
            </Text>
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.actionBtn, recording && styles.recordingActiveBtn]}
            onPress={handleToggleRecording}
            disabled={loading || evaluating}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons
                name={recording ? 'stop' : 'mic'}
                size={22}
                color={recording ? '#FFF' : '#475569'}
              />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setKeyboardVisible(true);
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
            }}
            placeholder={recording ? "Listening to speak..." : "Type response to tutor..."}
            placeholderTextColor="#94A3B8"
            editable={!recording && !evaluating}
            maxLength={500}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || evaluating}
          >
            <Ionicons name="send" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>

      {/* ─── Long-press Menu Modal ─── */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBg}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Message Options</Text>

            <TouchableOpacity style={styles.modalOption} onPress={handleCopyMessage}>
              <Ionicons name="copy-outline" size={18} color="#475569" style={{ marginRight: 12 }} />
              <Text style={styles.modalOptionText}>Copy Text</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={handleReplayVoice}>
              <Ionicons name="volume-high-outline" size={18} color="#475569" style={{ marginRight: 12 }} />
              <Text style={styles.modalOptionText}>Speak/Replay Voice</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={handleToggleBookmark}>
              <Ionicons
                name={selectedMessage?.bookmarked ? 'star' : 'star-outline'}
                size={18}
                color={selectedMessage?.bookmarked ? '#F59E0B' : '#475569'}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.modalOptionText}>
                {selectedMessage?.bookmarked ? 'Remove Bookmark' : 'Bookmark Tip'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },

  avatarContainer: {
    width: '100%',
    height: 224,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 0,
  },
  avatarContainerCollapsed: {
    height: 0,
    maxHeight: 0,
    opacity: 0,
    marginTop: 0,
    marginBottom: 0,
    overflow: 'hidden',
  },
  chatContentContainer: {
    flex: 1,
  },
  avatar3d: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { paddingBottom: 16, backgroundColor: 'transparent' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 11, color: '#A5B4FC', marginTop: 2, fontWeight: '700' },
  muteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Chat scroll
  chatScroll: { paddingHorizontal: 16, paddingTop: 10, gap: 14, paddingBottom: 80 },

  // Bubble Wrapper
  bubbleWrapper: { flexDirection: 'row', gap: 10, maxWidth: '85%' },
  userWrapper: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  aiWrapper: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  aiItemContainer: { width: '100%', alignSelf: 'stretch', marginBottom: 6 },

  // Avatars
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  aiAvatar: { backgroundColor: '#6366F1' },
  userAvatar: { backgroundColor: '#4F46E5' },

  // Bubbles
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  userBubble: { backgroundColor: '#4F46E5', borderTopRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(22, 28, 45, 0.75)', borderTopLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFF', fontWeight: '500' },
  aiText: { color: '#E5E7EB', fontWeight: '500' },
  starIcon: { alignSelf: 'flex-end', marginTop: 4 },

  // Speaking Coach & Phrasing Card (matching ConversationScreen)
  correctionBox: {
    backgroundColor: 'rgba(30, 27, 75, 0.9)',
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  correctionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  correctionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  correctionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  expandToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A5B4FC',
  },
  collapsedPreviewRow: {
    marginTop: 4,
    paddingVertical: 4,
  },
  collapsedPreviewText: {
    fontSize: 12,
    color: '#A5B4FC',
    fontStyle: 'italic',
  },
  betterSectionBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  betterSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A5B4FC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  betterSectionContent: {
    fontSize: 13,
    color: '#FFF',
    marginTop: 4,
    fontWeight: '700',
    lineHeight: 18,
  },
  listenPhraseMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  listenPhraseMiniText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A5B4FC',
  },
  correctionSection: {
    marginTop: 8,
  },
  correctionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#818CF8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  correctionContent: {
    fontSize: 13,
    color: '#E5E7EB',
    marginTop: 3,
    fontWeight: '600',
    lineHeight: 18,
  },
  correctionExplanation: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99, 102, 241, 0.2)',
    paddingTop: 8,
  },
  followUpCard: {
    marginTop: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  followUpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followUpLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followUpContent: {
    fontSize: 12,
    color: '#E5E7EB',
    marginTop: 4,
    fontWeight: '600',
    lineHeight: 18,
  },
  listenFollowUpMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  listenFollowUpMiniText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
  },

  // Loading bubble
  loadingBubbleWrapper: { alignSelf: 'flex-start', marginLeft: 42, marginBottom: 12 },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(17, 24, 39, 0.7)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  loadingText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

  // Input Container
  inputContainer: { backgroundColor: '#090E1A', paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' },
  inputContainerKeyboard: { paddingBottom: 10 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  controlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  controlText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  // Live Streaming Transcript Box
  liveTranscriptBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 27, 75, 0.85)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.45)',
  },
  liveTranscriptIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveTranscriptPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveTranscriptLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A5B4FC',
    letterSpacing: 0.5,
  },
  liveTranscriptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    lineHeight: 18,
  },
  voiceWaveBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Input row
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center' },
  recordingActiveBtn: { backgroundColor: '#EF4444' },
  textInput: { flex: 1, minHeight: 40, maxHeight: 80, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: '#FFF' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },

  // Wave styles
  voiceWaveRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  voiceWaveBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: '#EF4444' },
  waveBarWrapper: { width: 4, height: 24 },
  waveBarPill: { width: 4, height: 16, borderRadius: 2, backgroundColor: '#EF4444' },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' },
  modalTitle: { fontSize: 14, fontWeight: '800', color: '#FFF', marginBottom: 16 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)' },
  modalOptionText: { fontSize: 13, color: '#E5E7EB', fontWeight: '700' },
  modalCancel: { marginTop: 16, height: 46, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#E5E7EB' },

  // Hints Tray
  hintsTray: {
    backgroundColor: '#090E1A',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  hintsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  hintsHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintsHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A5B4FC',
  },
  hintCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  hintChipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
  },
  hintChip: {
    paddingVertical: 4,
    marginRight: 6,
  },
  hintChipText: {
    fontSize: 12,
    color: '#E5E7EB',
    fontWeight: '600',
  },
  hintAudioBtn: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 4,
  },
  hintEditBtn: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  charCountRow: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  charCountText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  charCountLimit: {
    color: '#EF4444',
  },
  finishBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
