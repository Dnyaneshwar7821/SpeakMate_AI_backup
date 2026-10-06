/**
 * ConversationScreen — Phase 2
 * Voice conversation practice UI with AI tutor roleplay.
 * Handles microphone recording (expo-audio), transcript submission,
 * Groq AI evaluations, and automatic text-to-speech feedback (expo-speech).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { speechService, speakingService, settingsService, profileService } from '../../services/appServices';
import { COLORS } from '../../constants/colors';
import { VoiceService } from '../../services/VoiceService';
import AIAvatar from '../../components/common/AIAvatar';
import { getAvatarById, getCachedAvatarModel, setCachedAvatarModel } from '../../config/AvatarCatalog';
import JumpingDotsIndicator from '../../components/common/JumpingDotsIndicator';
import LevelSegmentedControl from '../../components/common/LevelSegmentedControl';

// ── Voice Activity Timing & Hesitation Thresholds (Web Parity) ────────────────
const NORMAL_SILENCE_THRESHOLD = 3000; // 3.0s: comfortable complete-thought pause
const INCOMPLETE_SILENCE_THRESHOLD = 4500; // 4.5s: extra hesitation tolerance for connectors

const INCOMPLETE_CONNECTORS = new Set([
  "and", "because", "but", "or", "so", "that", "to", "with", "like",
  "if", "when", "while", "although", "since", "for"
]);

const isIncompleteSentence = (text) => {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim().toLowerCase().replace(/[.,!?;:]+$/, "").trim();
  if (!clean) return false;
  const words = clean.split(/\s+/);
  const lastWord = words[words.length - 1];
  return INCOMPLETE_CONNECTORS.has(lastWord);
};

// ── Animated Message Bubble Component ────────────────────────────────────────
const AnimatedMessageBubble = React.memo(function AnimatedMessageBubble({ item, isUser, formatDisplayMessage }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const opacity    = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View
      style={[
        styles.bubbleWrapper,
        isUser ? styles.userWrapper : styles.aiWrapper,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {!isUser && (
        <View style={styles.aiAvatarIcon}>
          <Ionicons name="sparkles" size={12} color="#FFF" />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
          {formatDisplayMessage ? formatDisplayMessage(item.message) : item.message}
        </Text>
      </View>
    </Animated.View>
  );
});

// ─── Sound Wave / Dynamic Mic Component ───────────────────────────────────────
function SoundWave({ isRecording }) {
  const animatedValues = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const pulseRing = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(0)).current;

  // Idle subtle breathing
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Recording audio wave & pulse
  useEffect(() => {
    let anim = null;
    let ringLoop = null;
    let frameId = null;

    if (isRecording) {
      frameId = requestAnimationFrame(() => {
        const animations = animatedValues.map((val) => {
          return Animated.loop(
            Animated.sequence([
              Animated.timing(val, {
                toValue: 1.5 + Math.random() * 2.2,
                duration: 180 + Math.random() * 160,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
              Animated.timing(val, {
                toValue: 0.6 + Math.random() * 0.4,
                duration: 180 + Math.random() * 160,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ])
          );
        });
        anim = Animated.parallel(animations);
        anim.start();

        ringLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseRing, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulseRing, { toValue: 0, duration: 40, useNativeDriver: true }),
          ])
        );
        ringLoop.start();
      });
    } else {
      animatedValues.forEach(val => val.setValue(1));
      pulseRing.setValue(0);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (anim) anim.stop();
      if (ringLoop) ringLoop.stop();
    };
  }, [isRecording]);

  const idleScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const ringScale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = pulseRing.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.7, 0.35, 0] });

  if (isRecording) {
    return (
      <View style={styles.micStageContainer}>
        {/* Outer active pulse ring */}
        <Animated.View
          style={[
            styles.micPulseRing,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <LinearGradient
          colors={['#EC4899', '#EF4444', '#DC2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.activeMicCircle}
        >
          <View style={styles.voiceWaveContainer}>
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
        </LinearGradient>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.micStageContainer, { transform: [{ scale: idleScale }] }]}>
      <LinearGradient
        colors={['#8B5CF6', '#6366F1', '#4F46E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatarCircle}
      >
        <Ionicons name="mic" size={28} color="#FFF" />
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Screen Component ────────────────────────────────────────────────────────

export default function ConversationScreen({ navigation, route }) {
  const {
    sessionId: initialSessionId,
    scenario,
    xpReward,
    sessionPromise,
    difficulty,
    estimatedDuration,
  } = route.params || {};

  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const sessionIdRef = useRef(initialSessionId || null);

  const [messages, setMessages] = useState([]);
  const [corrections, setCorrections] = useState(null); // Latest message correction feedback
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(1.0); // Always default to 1.0x normal speed
  const [statusText, setStatusText] = useState('Waiting for Response');
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [chatLevel, setChatLevel] = useState('1st Std');
  const [avatarExpression, setAvatarExpression] = useState(undefined);
  const [hints, setHints] = useState([]);
  const [loadingHints, setLoadingHints] = useState(false);

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const flatListRef = useRef(null);
  const isInitialMount = useRef(true);
  const timerInterval = useRef(null);
  const recordingRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const wasSpeakingOnPause = useRef(false);
  const pausedAiText = useRef('');
  const isPausedRef = useRef(false);
  const micPressAnim = useRef(new Animated.Value(1)).current;
  const hasEndedRef = useRef(false);
  const lastSuggestedResponsesRef = useRef([]);

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

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Start backend session in background upon mount without blocking avatar speech or UI
  useEffect(() => {
    let isMounted = true;
    if (!sessionIdRef.current) {
      speakingService.start({
        scenario: scenario || 'General Conversation',
        difficulty: difficulty || 'Intermediate',
        estimatedDuration: estimatedDuration || 5,
        xpReward: xpReward || 10,
      }).then((res) => {
        if (isMounted && res?.id) {
          sessionIdRef.current = res.id;
          setSessionId(res.id);
        }
      }).catch((err) => {
        console.warn("Background session link note:", err);
      });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Clean up incomplete session draft ONLY when user navigates away without finishing (on unmount)
  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current;
      if (!hasEndedRef.current && sid && !String(sid).startsWith('sim_')) {
        speakingService.deleteSession(sid).catch(() => {});
      }
    };
  }, []); // Run ONLY on unmount

  // Live Speech Recognition & Silence Auto-Stop refs & Session Token
  const [currentTranscript, setCurrentTranscript] = useState('');
  const silenceTimerRef = useRef(null);
  const stoppingRef = useRef(false);
  const startingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const recordingSessionIdRef = useRef(0);
  const accumulatedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isSendingRef = useRef(false);

  // Auto-collapse top avatar on keyboard show to maximize chat view
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const updateIsPaused = (val) => {
    isPausedRef.current = val;
    setIsPaused(val);
  };

  const [availableVoices, setAvailableVoices] = useState([]);
  const [preferredVoice, setPreferredVoice] = useState('Friendly');
  const [onboardingVoiceStyle, setOnboardingVoiceStyle] = useState('Friendly');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpokenText, setCurrentSpokenText] = useState('');
  const initialAvatar = route.params?.avatarModel || getCachedAvatarModel() || 'haru';
  const [selectedAvatarModel, setSelectedAvatarModel] = useState(initialAvatar);

  const avatarGender = VoiceService.getAvatarGender(preferredVoice, onboardingVoiceStyle);

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

  // ── Conversation Setup ──────────────────────────────────────────────
  useEffect(() => {
    // Start session timer
    timerInterval.current = setInterval(() => {
      if (!isPaused) {
        setTimer((t) => t + 1);
      }
    }, 1000);

    async function initAndGreeting() {
      // 1. Fetch available voices
      let enVoices = [];
      try {
        enVoices = await VoiceService.getAvailableEnglishVoices();
        setAvailableVoices(enVoices);
      } catch (e) {
        console.warn("Failed to get available voices in session:", e);
      }

      // 2. Fetch user preferences & onboarding defaults & profile level
      let currentVoice = 'Friendly';
      try {
        const [settings, onboardingVoice, profile, savedVoice, savedGender, savedAvatarModel] = await Promise.all([
          settingsService.get().catch(() => null),
          AsyncStorage.getItem('speakmate_onboarding_voice'),
          profileService.get().catch(() => null),
          AsyncStorage.getItem('speakmate_selected_voice'),
          AsyncStorage.getItem('speakmate_voice_gender'),
          AsyncStorage.getItem('speakmate_avatar_model'),
        ]);
        let rawVoice = savedVoice || settings?.aiVoice || (savedGender === 'male' ? 'US Male' : 'Default');
        setPreferredVoice(rawVoice);
        if (onboardingVoice) {
          setOnboardingVoiceStyle(onboardingVoice);
        }
        const savedGrade = await AsyncStorage.getItem('speakmate_school_grade');
        const savedAgeGroup = await AsyncStorage.getItem('speakmate_age_group');
        const isKids = Boolean(
          (savedAgeGroup && savedAgeGroup.toLowerCase() === 'kids') ||
          (savedGrade && ['1st std', '2nd std', '3rd std', '4th std', '5th std'].includes(savedGrade.toLowerCase()))
        );
        const isMaleVoice = savedGender === 'male' || (rawVoice && rawVoice.toLowerCase().includes('male') && !rawVoice.toLowerCase().includes('female'));

        // Prioritize explicit user selection (route param -> saved -> cache -> sensible default)
        let modelToUse = route.params?.avatarModel || savedAvatarModel || getCachedAvatarModel();
        if (!modelToUse) {
          if (isKids) {
            modelToUse = 'robopaws';
          } else if (isMaleVoice) {
            modelToUse = 'chitose';
          } else {
            modelToUse = 'haru';
          }
        }
        const resolvedAvatar = getAvatarById(modelToUse);
        setSelectedAvatarModel(resolvedAvatar.id);
        setCachedAvatarModel(resolvedAvatar.id);
        if (savedGrade) {
          setChatLevel(savedGrade);
        } else if (profile && profile.englishLevel) {
          setChatLevel(profile.englishLevel);
        }
        // Always reset voice speed to 1.0x (Normal Default) when entering a session
        setSpeechSpeed(1.0);
        await AsyncStorage.setItem('speakmate_voice_speed', '1.0');

        currentVoice = rawVoice;
      } catch (e) {
        console.warn("Failed to load user voice preference:", e);
      }

      // 3. Immediately speak the opening scenario greeting
      let initialGreetingText = route.params?.initialGreeting;
      if (!initialGreetingText) {
        const cleanScn = (scenario || '').replace(/\b(conversation|practice|session)\b/gi, '').trim();
        const scnLabel = cleanScn ? `${cleanScn} ` : '';
        initialGreetingText = `Hello! Welcome to our ${scnLabel}conversation practice. How can I help you today?`;
      }
      
      // 4. Sync background session if live backend session is available
      try {
        const sid = sessionIdRef.current || sessionId;
        if (sid && !String(sid).startsWith('sim_') && !isNaN(Number(sid))) {
          const detail = await speakingService.detail(sid).catch(() => null);
          if (detail && detail.messages && detail.messages.length > 0) {
            const cleanMsgs = detail.messages.map((m) => {
              if (m.sender === 'ai' && (m.message.includes('Analyze User Input:') || m.message.includes('Context:') || m.message.includes('Requirements:'))) {
                const idx = m.message.lastIndexOf('\n\n');
                return {
                  ...m,
                  message: (idx !== -1 && idx < m.message.length - 1) ? m.message.substring(idx).trim() : initialGreetingText
                };
              }
              return m;
            });
            setMessages(cleanMsgs);
          }
        }
      } catch (e) {
        // Quietly ignore draft sync
      }

      const initialMessageObj = {
        id: 'intro_0',
        sender: 'ai',
        message: initialGreetingText,
        createdAt: new Date().toISOString(),
      };
      if (messages.length === 0) setMessages([initialMessageObj]);
      if (!isMuted) {
        speakTextWithVoice(initialGreetingText, currentVoice, enVoices);
      }
    }

    initAndGreeting();

    return () => {
      VoiceService.stop();
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
    };
  }, []); // Run only once on mount

  // Reload settings and voices whenever the screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const [settings, voices, onboardingVoice, savedVoice] = await Promise.all([
          settingsService.get().catch(() => null),
          VoiceService.getAvailableEnglishVoices(),
          AsyncStorage.getItem('speakmate_onboarding_voice'),
          AsyncStorage.getItem('speakmate_selected_voice'),
        ]);
        const effectiveVoice = savedVoice || settings?.aiVoice;
        if (effectiveVoice) {
          setPreferredVoice(effectiveVoice);
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

  // Screen blur cleanup: Stop TTS, cancel recording and VAD, pause timer
  useEffect(() => {
    const unsubBlur = navigation.addListener('blur', () => {
      VoiceService.stop();
      setIsSpeaking(false);
      setCurrentSpokenText('');
      setStatusText('Waiting for Response');
      updateIsPaused(true);

      if (isRecordingRef.current) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch (_) {}
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    });

    return unsubBlur;
  }, [navigation]);

  // Separate effect: manage timer based on isPaused
  useEffect(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
    if (!isPaused) {
      timerInterval.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [isPaused]);

  const getSpeakableText = (msg) => {
    if (!msg) return '';
    let text = msg.message || msg.aiReply || '';
    if (text.includes('Analyze User Input:') || text.includes('Context:')) {
      const idx = text.lastIndexOf('\n\n');
      if (idx !== -1 && idx < text.length - 1) {
        text = text.substring(idx).trim();
      }
    }
    if (msg.followUpQuestion && !text.includes(msg.followUpQuestion)) {
      text += ` ${msg.followUpQuestion}`;
    }
    return text;
  };

  const formatVocabulary = (text) => {
    if (!text) return '';
    let clean = String(text);
    clean = clean.replace(/[\[\]{}"']/g, '');
    clean = clean.replace(/^(vocabulary|words|suggestions)\s*:\s*/i, '');
    return clean.replace(/\s+/g, ' ').trim();
  };

  const speakAiWithCoaching = (aiMsg) => {
    if (!aiMsg || isPausedRef.current || isMuted) return;

    // 1. Build dynamic in-character reply + dynamic follow-up question
    let mainReply = aiMsg.message || aiMsg.aiReply || '';
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

      pausedAiText.current = fullSpeech;
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
    pausedAiText.current = coachingPhrase;
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
        if (!isPausedRef.current && !isMuted) {
          setTimeout(() => {
            if (!isPausedRef.current && !isMuted) {
              setStatusText('Speaking');
              setIsSpeaking(true);
              pausedAiText.current = mainReply;
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

  const speakTextWithVoice = (text, voiceOverride = preferredVoice, voicesList = availableVoices, speedOverride = null) => {
    if (isPausedRef.current) return;
    const rawVoice = voiceOverride || preferredVoice;
    const effectiveSpeed = speedOverride !== null && speedOverride !== undefined ? speedOverride : speechSpeed;
    pausedAiText.current = text;
    setCurrentSpokenText(text);
    VoiceService.speak(text, {
      isMuted,
      avatarId: selectedAvatarModel,
      voiceType: rawVoice,
      speechSpeed: effectiveSpeed,
      availableVoices: voicesList,
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
  };

  const speakText = (text) => {
    speakTextWithVoice(text, preferredVoice);
  };

  const toggleSpeechSpeed = async () => {
    const speeds = [0.5, 0.75, 1.0, 1.5, 2.0];
    const currentIndex = speeds.indexOf(speechSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setSpeechSpeed(nextSpeed);
    await AsyncStorage.setItem('speakmate_voice_speed', String(nextSpeed));

    if (isSpeaking && pausedAiText.current) {
      VoiceService.stop();
      speakTextWithVoice(pausedAiText.current, preferredVoice, availableVoices, nextSpeed);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      VoiceService.stop();
      setIsSpeaking(false);
      setCurrentSpokenText('');
      setStatusText('Waiting for Response');
    }
  };

  // ── Pause / Resume Handler ─────────────────────────────────────────
  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    isPausedRef.current = nextPaused;

    if (nextPaused) {
      // 1. Immediately stop recording if active
      if (isRecording || isRecordingRef.current) {
        try {
          recordingRef.current?.stop().catch(() => {});
        } catch (_) {}
        recordingRef.current = null;
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsUserPausing(false);
      }
      // 2. Immediately stop AI voice playback
      if (isSpeaking) {
        wasSpeakingOnPause.current = true;
        VoiceService.stop();
        setIsSpeaking(false);
      } else {
        wasSpeakingOnPause.current = false;
      }
      setStatusText('Session Paused');
    } else {
      // 3. Resume session
      setStatusText('Waiting for Response');
      if (wasSpeakingOnPause.current && pausedAiText.current && !isMuted) {
        wasSpeakingOnPause.current = false;
        setTimeout(() => {
          speakTextWithVoice(pausedAiText.current, preferredVoice, availableVoices, speechSpeed);
        }, 150);
      }
    }
  };

  const cleanHintText = (raw) => {
    if (!raw) return null;
    let str = String(raw).trim();
    // Strip prefixes like "Suggestion 1:", "Option 1 -", "1. ", "Hint 1:"
    str = str.replace(/^(suggestion|option|hint|response|choice)\s*\d*\s*[:\-.]?\s*/i, '');
    str = str.replace(/^\d+[\.\)]\s*/, '');
    str = str.replace(/^["'`]|["'`]$/g, '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (
      lower === 'suggestion one' ||
      lower === 'suggestion two' ||
      lower === 'suggestion three' ||
      lower.startsWith('suggestion ') ||
      lower.startsWith('option ') ||
      lower === 'simple option' ||
      lower === 'natural idiom option' ||
      lower === 'follow-up question option' ||
      lower === 'first realistic sentence student can speak' ||
      lower === 'second realistic sentence student can speak' ||
      lower === 'third realistic sentence student can speak' ||
      lower === 'none' ||
      lower === 'null'
    ) {
      return null;
    }
    return str;
  };

  const getScenarioHints = (scenarioTitle = '') => {
    const t = (scenarioTitle || '').toLowerCase();
    if (t.includes('daily conversation') || t.includes('small talk') || t.includes('routine') || t.includes('relaxed daily')) {
      return [
        "I've had a busy but really good day!",
        "How has your day been going so far?",
        "I'm planning to relax with some music later."
      ];
    } else if (t.includes('restaurant') || t.includes('food') || t.includes('burger') || t.includes('dining')) {
      return [
        "Could I please see the dinner menu?",
        "What do you recommend as today's special?",
        "Could we get a table for two, please?"
      ];
    } else if (t.includes('coffee') || t.includes('cafe')) {
      return [
        "I'd like a cappuccino with oat milk, please.",
        "Do you have any fresh pastries today?",
        "Can I get this to go, please?"
      ];
    } else if (t.includes('hotel') || t.includes('check-in')) {
      return [
        "Hi, I have a reservation under my name.",
        "What time is breakfast served tomorrow?",
        "Could you tell me the Wi-Fi password, please?"
      ];
    } else if (t.includes('airport') || t.includes('customs') || t.includes('travel') || t.includes('flight')) {
      return [
        "Here are my passport and boarding pass.",
        "I am traveling for a short vacation.",
        "Which gate does my connecting flight depart from?"
      ];
    } else if (t.includes('interview') || t.includes('job') || t.includes('career')) {
      return [
        "I have strong hands-on experience in problem solving.",
        "My greatest strength is communicating under pressure.",
        "I am excited about this role and your team culture."
      ];
    } else if (t.includes('shopping') || t.includes('store') || t.includes('clothes')) {
      return [
        "Excuse me, do you have this in a medium size?",
        "Where are the fitting rooms located?",
        "Is this item currently on discount?"
      ];
    } else if (t.includes('doctor') || t.includes('pharmacy') || t.includes('health') || t.includes('hospital')) {
      return [
        "I've had a mild headache since yesterday.",
        "How often should I take this medication?",
        "Thank you for the helpful advice, doctor."
      ];
    } else if (t.includes('zoo') || t.includes('animal')) {
      return [
        "Where can we find the elephant enclosure?",
        "What time is the animal feeding show?",
        "My favorite animals are the giant pandas!"
      ];
    } else if (t.includes('school') || t.includes('class') || t.includes('grade') || t.includes('std')) {
      return [
        "Good morning! I finished my homework assignment.",
        "Could you please explain that question again?",
        "My favorite subjects are science and English."
      ];
    } else if (t.includes('meeting') || t.includes('business') || t.includes('presentation')) {
      return [
        "Let's review the main milestones on the agenda.",
        "I agree with that strategy and propose next steps.",
        "Does anyone have questions on this slide?"
      ];
    } else if (t.includes('hobbies') || t.includes('gaming') || t.includes('music')) {
      return [
        "I love playing strategy games and listening to music.",
        "Have you played any good video games recently?",
        "I enjoy spending my free time outdoors."
      ];
    }
    return [
      "Could you tell me a bit more about that?",
      "That sounds interesting! What should we do next?",
      "Could you give me an example of that?"
    ];
  };

  const handleFetchHints = async () => {
    if (loadingHints || isPaused) {
      if (isPaused) Alert.alert('Session Paused ⏸️', 'Please tap Resume to view suggestions.');
      return;
    }

    // Toggle off if already showing
    if (hints.length > 0) {
      setHints([]);
      return;
    }

    // If the latest AI reply has contextual suggested responses ready, display them on button click!
    if (lastSuggestedResponsesRef.current && lastSuggestedResponsesRef.current.length >= 2) {
      setHints(lastSuggestedResponsesRef.current);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    setLoadingHints(true);
    try {
      const sid = sessionIdRef.current || sessionId;
      if (sid && !String(sid).startsWith('sim_')) {
        const data = await speakingService.getHints(sid);
        if (data && data.length > 0) {
          const cleanList = data.map(cleanHintText).filter(Boolean);
          if (cleanList.length >= 2) {
            setHints(cleanList);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            return;
          }
        }
      }
      setHints(getScenarioHints(scenario));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setHints(getScenarioHints(scenario));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setLoadingHints(false);
    }
  };

  // ── Speech Recognition Event Listeners (Continuous Streaming Speech-to-Text) ──
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
        setIsRecording(false);
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
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
    };
  }, []);

  const startRecording = async () => {
    if (startingRef.current || isRecordingRef.current || isPaused || isSendingRef.current) return;
    startingRef.current = true;

    try {
      VoiceService.stop();
      setIsSpeaking(false);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const granted = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted?.granted) {
        Alert.alert('Microphone Access Denied', 'Please grant microphone and speech recognition permissions to speak with your AI tutor.');
        startingRef.current = false;
        return;
      }

      recordingSessionIdRef.current += 1;
      accumulatedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      setCurrentTranscript('');
      isRecordingRef.current = true;
      setIsRecording(true);
      setStatusText('Listening');

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        continuous: true,
        interimResults: true,
      });
    } catch (error) {
      console.warn('[SpeechRecognition] Failed to start:', error);
      Alert.alert('Speech Recognition Error', 'Could not initialize speech recognition. Please check permissions.');
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatusText('Waiting for Response');
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecordingAndSend = async () => {
    if (stoppingRef.current || isSendingRef.current) return;
    stoppingRef.current = true;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    setStatusText('Thinking');

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
      await sendUserText(finalSpoken);
    } catch (error) {
      console.warn('Sending spoken text failed:', error);
      Alert.alert('Transcription Failed', 'Make sure you have an active network connection and try again.');
      setStatusText('Waiting for Response');
    } finally {
      setLoading(false);
      stoppingRef.current = false;
      isSendingRef.current = false;
    }
  };

  const handleToggleRecording = () => {
    if (isPaused) {
      Alert.alert('Session Paused ⏸️', 'Please tap Resume to start recording or speaking practice.');
      return;
    }

    if (isRecording || isRecordingRef.current) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  };

  const sendUserText = async (text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    try {
      setHints([]); // clear suggestions
      setStatusText('Thinking');
      setLoading(true);

      // Optimistically push user message
      const tempUserMsg = { id: Date.now(), sender: 'user', message: cleanText };
      setMessages((prev) => [...prev, tempUserMsg]);

      let feedback;
      const sid = sessionIdRef.current || sessionId;
      if (sid && !String(sid).startsWith('sim_')) {
        feedback = await speakingService.sendMessage({
          sessionId: sid,
          message: cleanText,
          level: chatLevel,
        });
      } else {
        const aiRes = await aiService.speakingFeedback(cleanText);
        feedback = {
          aiReply: aiRes?.response || "That is very interesting! Could you share a bit more about that?",
          grammarCorrection: "✅ Your sentence is correct.",
          betterSentence: null,
          vocabularySuggestions: null,
          explanation: null,
          followUpQuestion: "What should we discuss next?",
          nativeTip: "Keep a natural, relaxed speaking cadence.",
          suggestedResponses: [
            "I would love to tell you more about it.",
            "Can you give me an example?"
          ],
        };
      }

      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        message: feedback.aiReply,
        grammarCorrection: feedback.grammarCorrection,
        betterSentence: feedback.betterSentence,
        vocabularySuggestions: feedback.vocabularySuggestions,
        explanation: feedback.explanation,
        followUpQuestion: feedback.followUpQuestion,
        nativeTip: feedback.nativeTip,
        suggestedResponses: feedback.suggestedResponses,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setCorrections(feedback);

      if (feedback.suggestedResponses && feedback.suggestedResponses.length > 0) {
        const cleanList = feedback.suggestedResponses.map(cleanHintText).filter(Boolean);
        if (cleanList.length > 0) {
          lastSuggestedResponsesRef.current = cleanList;
          // Note: Kept hidden until user explicitly taps the AI Hint button
        }
      }

      const isCorrect = feedback.grammarCorrection && (
        feedback.grammarCorrection.includes('✅') || 
        feedback.grammarCorrection.toLowerCase().includes('correct')
      );
      if (isCorrect) {
        setAvatarExpression('happy');
        setTimeout(() => setAvatarExpression(undefined), 3500);
      }

      // Speak AI in-character response, pause 1.2s, then speak coaching phrasing
      speakAiWithCoaching(aiMessage);
    } catch (err) {
      console.warn('Backend speaking message failed, using resilient fallback:', err);
      const fallbackAiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        message: "That's a very good point! Let's continue exploring this topic.",
        grammarCorrection: "✅ Your sentence is correct.",
        betterSentence: null,
        vocabularySuggestions: null,
        explanation: null,
        followUpQuestion: "What do you think is the best next step?",
        nativeTip: "Speak with clear pauses between thoughts.",
        suggestedResponses: [
          "I think we should practice more.",
          "Could you give me another question?"
        ]
      };
      setMessages((prev) => [...prev, fallbackAiMsg]);
      setCorrections(fallbackAiMsg);
      lastSuggestedResponsesRef.current = fallbackAiMsg.suggestedResponses;
      speakAiWithCoaching(fallbackAiMsg);
    } finally {
      setLoading(false);
      setStatusText('Waiting for Response');
    }
  };

  // ── End Session ────────────────────────────────────────────────────
  const handleEndConversation = () => {
    Alert.alert(
      'End Conversation? 🏁',
      'Are you ready to submit your session and review your grammar feedback?',
      [
        { text: 'Continue Practice', style: 'cancel' },
        {
          text: 'End & Evaluate',
          style: 'default',
          onPress: async () => {
            hasEndedRef.current = true;
            setEnding(true);
            try {
              const sid = sessionIdRef.current || sessionId;
              if (sid && !String(sid).startsWith('sim_')) {
                const summary = await speakingService.end(sid);
                navigation.replace('SpeakingSummary', { summary });
                return;
              }
              throw new Error('Local session summary fallback');
            } catch (e) {
              const calcXp = (dur) => {
                const mins = Math.floor((dur || 0) / 60);
                return Math.min(40, Math.max(25, 20 + mins * 3 + 5));
              };
              const sessionDur = timer || 0;
              const fallbackSummary = {
                score: 85,
                summary: 'Completed speaking practice session.',
                durationSeconds: sessionDur,
                totalMessages: Array.isArray(messages) ? messages.length : 0,
                vocabularyLearned: 'General conversation vocabulary.',
                grammarCorrections: 'Good effort in sentence structure.',
                betterSentences: 'Keep practicing daily to improve fluency!',
                motivationalMessage: 'Great job completing your speaking practice today! 🌟',
                xpEarned: calcXp(sessionDur),
              };
              navigation.replace('SpeakingSummary', { summary: fallbackSummary });
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  };

  // ── Format Timer ───────────────────────────────────────────────────
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const subtitleText = isPaused
    ? '⏸️ Session paused — tap Resume'
    : isSpeaking
    ? '✨ Tutor speaking...'
    : loading
    ? '✨ Processing speech...'
    : isRecording
    ? '🎙️ Listening... speak or tap mic to send'
    : '✨ Tap mic to speak';

  // ── Feedback helpers (used in FlatList footer) ────────────────────────
  const hasFeedbackText = (text) => {
    if (!text) return false;
    const clean = text.trim().toLowerCase();
    return clean !== 'none' && clean !== 'null' && clean !== '' && !clean.includes('[better_sentence] none') && !clean.includes('[vocabulary] none');
  };

  const showGrammar   = corrections && hasFeedbackText(corrections.grammarCorrection);
  const showBetter    = corrections && hasFeedbackText(corrections.betterSentence);
  const showVocab     = corrections && hasFeedbackText(corrections.vocabularySuggestions);
  const showFollowup  = corrections && hasFeedbackText(corrections.followUpQuestion);
  const showNativeTip = corrections && hasFeedbackText(corrections.nativeTip);
  const hasAnyFeedback = corrections && (showGrammar || showBetter || showVocab || showFollowup || showNativeTip);

  const avatarState = isPaused
    ? 'paused'
    : isSpeaking
    ? 'speaking'
    : loading
    ? 'thinking'
    : isRecording
    ? 'listening'
    : 'idle';

  const formatDisplayMessage = useCallback((text) => {
    if (!text) return '';
    let t = String(text);
    if (t.includes('Analyze User Input:') || t.includes('Context:') || t.includes('Identify Key Constraints:')) {
      const idx = t.lastIndexOf('\n\n');
      if (idx !== -1 && idx < t.length - 1) {
        t = t.substring(idx).trim();
      }
    }
    t = t.replace(/\[[^\]]*\]/g, '');
    t = t.replace(/\bdot\s*dot\s*dot\b/gi, '');
    t = t.replace(/\.{2,}/g, '');
    t = t.replace(/…/g, '');
    t = t.replace(/[*#_~`]/g, '');
    return t.replace(/\s+/g, ' ').trim() || text;
  }, []);

  const keyExtractor = useCallback((item) => String(item.id), []);

  const renderMessageItem = useCallback(({ item }) => {
    const isUser = item.sender === 'user';
    return (
      <AnimatedMessageBubble
        item={item}
        isUser={isUser}
        formatDisplayMessage={formatDisplayMessage}
      />
    );
  }, [formatDisplayMessage]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
    <LinearGradient colors={['#070A12', '#0A0F1D', '#080C18']} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.exitBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{scenario}</Text>
              <Text style={{ fontSize: 11, color: '#A5B4FC', marginTop: 2, fontWeight: '700' }}>{subtitleText}</Text>
            </View>
            <View style={styles.timerBadge}>
              <Ionicons name="time-outline" size={14} color="#FFF" />
              <Text style={styles.timerVal}>{formatTime(timer)}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* ─── AI Tutor Avatar Stage (collapses when keyboard is active) ─── */}
      {!isKeyboardVisible && (
        <View style={styles.avatarContainer}>
          <AIAvatar
            model={selectedAvatarModel}
            gender={getAvatarById(selectedAvatarModel).gender}
            isSpeaking={isSpeaking && !isPaused}
            spokenText={currentSpokenText}
            speechSpeed={speechSpeed}
            state={avatarState}
            expression={avatarExpression}
            style={styles.avatar3d}
            hideStatusPill={false}
          />
        </View>
      )}

      {/* ── Chat Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        style={{ flex: 1 }}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.chatList}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        renderItem={renderMessageItem}
        initialNumToRender={10}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        ListEmptyComponent={
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 40 }} />
        }
        ListFooterComponent={(
          <>
            {loading && (
              <View style={[styles.bubbleWrapper, styles.aiWrapper]}>
                <View style={styles.aiAvatarIcon}>
                  <Ionicons name="sparkles" size={12} color="#FFF" />
                </View>
                <View style={[styles.bubble, styles.aiBubble, { flexDirection: 'row', alignItems: 'center' }]}>
                  <JumpingDotsIndicator color={COLORS.primary} size={6} space={3} />
                  <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginLeft: 8 }}>Thinking...</Text>
                </View>
              </View>
            )}

            {/* ── Real-Time "How to Say It" Coach Card ── */}
            {hasAnyFeedback && (
              <View style={styles.correctionBox}>
                <View style={styles.correctionHeader}>
                  <Ionicons name="sparkles" size={16} color="#818CF8" />
                  <Text style={styles.correctionTitle}>Speaking Coach & Phrasing</Text>
                </View>

                {showBetter && (
                  <View style={styles.betterSectionBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.betterSectionLabel}>Native Phrasing ("How to say it")</Text>
                      <TouchableOpacity
                        style={styles.listenPhraseMiniBtn}
                        onPress={() => speakTextWithVoice(corrections.betterSentence)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="volume-high" size={14} color="#6366F1" />
                        <Text style={styles.listenPhraseMiniText}>Listen</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.betterSectionContent}>"{corrections.betterSentence}"</Text>
                  </View>
                )}

                {showGrammar && (
                  <View style={styles.correctionSection}>
                    <Text style={styles.correctionLabel}>Grammar Check</Text>
                    {corrections.grammarCorrection.includes('✅') || corrections.grammarCorrection.toLowerCase().includes('correct') ? (
                      <Text style={[styles.correctionContent, { color: '#10B981', fontWeight: '700' }]}>
                        {corrections.grammarCorrection}
                      </Text>
                    ) : (
                      <Text style={styles.correctionContent}>👉 {corrections.grammarCorrection}</Text>
                    )}
                  </View>
                )}

                {showVocab && (
                  <View style={styles.correctionSection}>
                    <Text style={styles.correctionLabel}>Vocabulary Upgrade</Text>
                    <Text style={styles.correctionContent}>✨ {formatVocabulary(corrections.vocabularySuggestions)}</Text>
                  </View>
                )}

                {showNativeTip && (
                  <View style={styles.correctionSection}>
                    <Text style={styles.correctionLabel}>Fluency & Pronunciation Tip</Text>
                    <Text style={[styles.correctionContent, { color: '#38BDF8' }]}>💡 {corrections.nativeTip}</Text>
                  </View>
                )}

                {corrections && hasFeedbackText(corrections.explanation) && (
                  <Text style={styles.correctionExplanation}>{corrections.explanation}</Text>
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
                        onPress={() => speakTextWithVoice(corrections.followUpQuestion)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="volume-high" size={13} color="#34D399" />
                        <Text style={styles.listenFollowUpMiniText}>Listen</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.followUpContent}>"{corrections.followUpQuestion}"</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      />

      {/* ── Fixed Chat-to-Controls Boundary (Hints Tray & AI Hint button) ── */}
      <View style={styles.chatBoundaryContainer}>
        {/* Quick Reply Chips Drawer if hints are active */}
        {hints.length > 0 && (
          <View style={styles.hintsContainer}>
            <View style={styles.hintsHeaderRow}>
              <View style={styles.hintsHeaderTitleRow}>
                <Ionicons name="chatbox-ellipses-outline" size={14} color="#A5B4FC" />
                <Text style={styles.hintsHeaderText}>Suggested Responses (Tap to speak or listen):</Text>
              </View>
              <TouchableOpacity
                onPress={() => setHints([])}
                style={styles.hintsCloseCrossBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={14} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hintsScroll}>
              {hints.map((hint, i) => (
                <View key={i} style={styles.hintChipWrapper}>
                  <TouchableOpacity
                    style={styles.hintChip}
                    onPress={() => {
                      setHints([]);
                      sendUserText(hint);
                    }}
                  >
                    <Text style={styles.hintChipText}>{hint}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.hintAudioBtn}
                    onPress={() => speakTextWithVoice(hint)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="volume-medium-outline" size={15} color="#818CF8" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI Hint Button — Only shown when hints are closed, anchored cleanly above Sound On */}
        {hints.length === 0 && (
          <View style={styles.fixedHintAnchorRow}>
            <TouchableOpacity
              style={styles.floatingHintBtn}
              onPress={handleFetchHints}
              activeOpacity={0.85}
              disabled={loadingHints}
            >
              <LinearGradient
                colors={['#8B5CF6', '#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.floatingHintGradient}
              >
                {loadingHints ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <View style={styles.hintIconAura}>
                      <Ionicons name="bulb" size={11} color="#FDE047" />
                    </View>
                    <Text style={styles.floatingHintText}>AI Hint ✨</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Live Streaming Transcript Bubble ── */}
      {isRecording && (
        <View style={styles.liveTranscriptBar}>
          <View style={styles.liveTranscriptIndicator}>
            <View style={styles.liveTranscriptPulseDot} />
            <Text style={styles.liveTranscriptLabel}>LIVE TRANSCRIPT</Text>
          </View>
          <Text style={styles.liveTranscriptText} numberOfLines={2} ellipsizeMode="tail">
            {currentTranscript ? `"${currentTranscript}"` : 'Listening to your voice...'}
          </Text>
        </View>
      )}

      {/* ── Bottom Controls ── */}
      <View style={styles.controlsBar}>
        <View style={styles.controlsRow}>
          {/* Speed Toggle */}
          <TouchableOpacity style={styles.auxBtn} onPress={toggleSpeechSpeed}>
            <Ionicons name="speedometer-outline" size={20} color="#9CA3AF" />
            <Text style={styles.auxBtnText}>{speechSpeed.toFixed(2).replace(/\.?0+$/, '')}x</Text>
          </TouchableOpacity>

          {/* Voice Wave & Main Mic Button */}
          <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <ActivityIndicator size="large" color="#FFF" />
            ) : (
              <TouchableOpacity
                onPress={handleToggleRecording}
                onPressIn={() => Animated.spring(micPressAnim, { toValue: 0.94, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(micPressAnim, { toValue: 1.0, friction: 5, tension: 40, useNativeDriver: true }).start()}
                activeOpacity={0.9}
              >
                <Animated.View style={{ transform: [{ scale: micPressAnim }] }}>
                  <SoundWave isRecording={isRecording} />
                </Animated.View>
              </TouchableOpacity>
            )}
          </View>

          {/* Mute AI */}
          <TouchableOpacity style={styles.auxBtn} onPress={handleToggleMute}>
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color={isMuted ? '#EF4444' : '#9CA3AF'} />
            <Text style={[styles.auxBtnText, isMuted && { color: '#EF4444' }]}>{isMuted ? 'Muted' : 'Sound On'}</Text>
          </TouchableOpacity>
        </View>

        {/* Action Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.pauseBtn, isPaused && styles.resumeActiveBtn]}
            onPress={handleTogglePause}
          >
            <Ionicons name={isPaused ? 'play-outline' : 'pause-outline'} size={18} color={isPaused ? '#FFF' : '#E5E7EB'} />
            <Text style={[styles.pauseText, isPaused && { color: '#FFF' }]}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.endBtn} onPress={handleEndConversation} disabled={ending}>
            {ending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color="#FFF" />
                <Text style={styles.endBtnText}>End Conversation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070A12' },

  avatarContainer: {
    width: '100%',
    height: 252,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 2,
    marginBottom: 6,
  },
  avatar3d: {
    width: '100%',
    height: '100%',
  },

  // Header
  header: { paddingBottom: 8, paddingHorizontal: 16, backgroundColor: 'transparent' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exitBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', maxWidth: 220, textAlign: 'center', letterSpacing: 0.2 },
  statusText: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 9, paddingVertical: 4.5, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  timerVal: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Chat Bubbles
  chatList: { padding: 16, paddingTop: 4, paddingBottom: 36 },
  bubbleWrapper: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%' },
  userWrapper: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  aiWrapper: { alignSelf: 'flex-start', justifyContent: 'flex-start', gap: 6 },
  aiAvatarIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  userBubble: { backgroundColor: '#4F46E5', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(22, 28, 45, 0.75)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFF', fontWeight: '500' },
  aiText: { color: '#E5E7EB', fontWeight: '500' },

  // Tutor Feedback & Corrections — inside FlatList so it scrolls with chat
  correctionBox: {
    backgroundColor: 'rgba(30, 27, 75, 0.9)',
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  correctionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  correctionTitle: { fontSize: 13, fontWeight: '800', color: '#FFF', flex: 1 },
  betterSectionBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  betterSectionLabel: { fontSize: 10, fontWeight: '800', color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 0.5 },
  betterSectionContent: { fontSize: 13, color: '#FFF', marginTop: 4, fontWeight: '700', lineHeight: 18 },
  listenPhraseMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  listenPhraseMiniText: { fontSize: 10, fontWeight: '800', color: '#A5B4FC' },
  correctionSection: { marginTop: 8 },
  correctionLabel: { fontSize: 9, fontWeight: '700', color: '#818CF8', textTransform: 'uppercase', letterSpacing: 0.5 },
  correctionContent: { fontSize: 13, color: '#E5E7EB', marginTop: 3, fontWeight: '600', lineHeight: 18 },
  correctionExplanation: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(99, 102, 241, 0.2)', paddingTop: 8 },
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

  // Sound Wave mic & stage
  micStageContainer: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  micPulseRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  activeMicCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  voiceWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    width: 54,
  },
  voiceWaveBar: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },

  // Fixed Chat-to-Controls Boundary Container
  chatBoundaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  fixedHintAnchorRow: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 4,
  },
  floatingHintContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 4,
    zIndex: 99,
  },
  floatingHintBtn: {
    borderRadius: 14,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  floatingHintGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    gap: 4,
  },
  hintIconAura: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: 'rgba(253, 224, 71, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHintText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  hintsContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
    marginBottom: 4,
  },
  hintsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  hintsHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  hintsHeaderText: {
    fontSize: 11,
    color: '#A5B4FC',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hintsCloseCrossBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  hintsScroll: {
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
  },

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

  // Bottom controls
  controlsBar: { backgroundColor: '#090E1A', paddingHorizontal: 16, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 28 : 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 8 },
  auxBtn: { alignItems: 'center', gap: 4, width: 70 },
  auxBtnText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },

  // End / Pause actions
  actionsRow: { flexDirection: 'row', gap: 8 },
  pauseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 12, paddingVertical: 9 },
  resumeActiveBtn: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  pauseText: { fontSize: 12, fontWeight: '700', color: '#E5E7EB' },
  endBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 9 },
  endBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
});
