import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, isNativeSpeechRecognitionAvailable } from '../../utils/speechRecognitionService';
import { VoiceRecorder } from '../../utils/audioRecorder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && !global.nativeFabricUIManager && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { useTheme } from '../../context/ThemeContext';
import { speechService, settingsService } from '../../services/appServices';
import { VoiceService } from '../../services/VoiceService';
import { getCachedAvatarModel } from '../../config/AvatarCatalog';
import {
  DEFAULT_ROLE,
  QUICK_SUGGESTIONS_BY_ROLE,
  ROLE_LABEL,
  WELCOME_TEXT_BY_ROLE,
} from './constants';
import MessageBubble from './MessageBubble';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

function cleanTextForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/\bStd\.?\b/gi, 'Standard')
    .replace(/\bDiv\.?\b/gi, 'Division')
    .replace(/\bXP\b/g, 'X P')
    .replace(/\bNo\.\b/gi, 'Number')
    .replace(/\bno\.\b/gi, 'number')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~#|]/g, ' ')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function AssistantModal({
  isOpen,
  onClose,
  messages = [],
  loading = false,
  error = null,
  role = DEFAULT_ROLE,
  onSendMessage,
  onResetChat,
  onClearError,
}) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [userVoiceSettings, setUserVoiceSettings] = useState({
    voice: 'Default',
    speed: 1.0,
  });
  const [activeAvatarModel, setActiveAvatarModel] = useState(() => getCachedAvatarModel() || 'haru');
  const [activeVoiceCode, setActiveVoiceCode] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);

  // Dynamically sync active tutor avatar and voice whenever assistant modal opens
  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          const [savedAvatar, savedVoice, savedSpeed, voices] = await Promise.all([
            AsyncStorage.getItem('speakmate_avatar_model').catch(() => null),
            AsyncStorage.getItem('speakmate_selected_voice').catch(() => null),
            AsyncStorage.getItem('speakmate_voice_speed').catch(() => null),
            VoiceService.getAvailableEnglishVoices().catch(() => []),
          ]);
          const model = getCachedAvatarModel() || savedAvatar || 'haru';
          setActiveAvatarModel(model);
          setActiveVoiceCode(savedVoice);
          if (savedVoice || savedSpeed) {
            setUserVoiceSettings({
              voice: savedVoice || 'Default',
              speed: savedSpeed ? parseFloat(savedSpeed) : 1.0,
            });
          }
          if (voices && voices.length > 0) setAvailableVoices(voices);
        } catch (_) {}
      })();
    }
  }, [isOpen]);

  const animProgress = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const [isMounted, setIsMounted] = useState(Boolean(isOpen));
  const isOpenRef = useRef(isOpen);

  // Dynamic keyboard state tracking
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isKeyboardVisibleRef = useRef(false);
  const initialHeightRef = useRef(0);
  const [currentLayoutHeight, setCurrentLayoutHeight] = useState(0);

  // Physical keyboard listeners: dynamically track soft keyboard dimensions
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (e) => {
      const height = e?.endCoordinates?.height || 0;
      isKeyboardVisibleRef.current = true;
      setIsKeyboardVisible(true);
      setKeyboardHeight(height);
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (_) {}
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const onKeyboardHide = () => {
      isKeyboardVisibleRef.current = false;
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (_) {}
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isRecordingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const initialSilenceTimerRef = useRef(null);
  const stoppingRef = useRef(false);
  const recordingSessionIdRef = useRef(0);
  const startingRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isSendingRef = useRef(false);
  const fallbackRecorderRef = useRef(null);

  // Continuous Streaming Speech-to-Text Listener
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
      setDraft(full);

      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

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
      console.warn('[SpeechRecognition] AssistantModal notice:', event?.error || event);
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
      if (fallbackRecorderRef.current) {
        fallbackRecorderRef.current.stop().catch(() => {});
        fallbackRecorderRef.current = null;
      }
      VoiceRecorder.resetAudioMode().catch(() => {});
    };
  }, []);

  const welcomeText = WELCOME_TEXT_BY_ROLE[role] || WELCOME_TEXT_BY_ROLE[DEFAULT_ROLE];
  const quickSuggestions = QUICK_SUGGESTIONS_BY_ROLE[role] || [];
  const roleTitle = ROLE_LABEL[role] || role;

  const isEmpty = messages.length === 0;

  // Animate backdrop opacity and panel slide on open/close
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setIsMounted(true);
      Animated.timing(animProgress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animProgress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !isOpenRef.current) {
          setIsMounted(false);
        }
      });
    }
  }, [isOpen, animProgress]);

  // Handle Android hardware back button:
  // If keyboard is open -> dismiss keyboard only, chatbot remains open
  // If keyboard is closed -> close chatbot, preserve underlying navigation
  useEffect(() => {
    if (!isOpen) return;

    const onHardwareBack = () => {
      if (isKeyboardVisibleRef.current) {
        Keyboard.dismiss();
        return true; // Dismiss keyboard only; keep chatbot open
      }
      handleClose();
      return true; // Close chatbot; keep underlying navigation intact
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => {
      backSubscription.remove();
    };
  }, [isOpen]);

  // Control Status Bar theme when chatbot is open: solid black background with crisp white icons
  useEffect(() => {
    if (isOpen) {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#000000', true);
      }
      StatusBar.setBarStyle('light-content', true);
    } else {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent', true);
      }
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    }
    return () => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent', true);
      }
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    };
  }, [isOpen, isDark]);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [isOpen, messages, loading]);

  // Load user voice preferences whenever modal opens
  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          const [savedVoice, savedGender, savedSpeed, settings] = await Promise.all([
            AsyncStorage.getItem('speakmate_selected_voice'),
            AsyncStorage.getItem('speakmate_voice_gender'),
            AsyncStorage.getItem('speakmate_voice_speed'),
            settingsService.get().catch(() => null),
          ]);
          const effectiveVoice =
            savedVoice || settings?.aiVoice || (savedGender === 'male' ? 'IN Male' : 'IN Female');
          const effectiveSpeed = savedSpeed ? parseFloat(savedSpeed) : 1.0;
          setUserVoiceSettings({
            voice: effectiveVoice || 'IN Female',
            speed: effectiveSpeed || 1.0,
          });
        } catch (_) {}
      })();
    }
  }, [isOpen]);

  // Master cleanup whenever modal closes or unmounts: stop STT and TTS completely
  const handleClose = () => {
    Keyboard.dismiss();
    VoiceService.stop();
    setSpeakingMessageId(null);

    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
      if (fallbackRecorderRef.current) {
        fallbackRecorderRef.current.stop().catch(() => {});
        fallbackRecorderRef.current = null;
      }
      VoiceRecorder.resetAudioMode().catch(() => {});
    }

    onClose?.();
  };

  useEffect(() => {
    if (!isOpen) {
      VoiceService.stop();
      setSpeakingMessageId(null);

      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch (_) {}
        if (fallbackRecorderRef.current) {
          fallbackRecorderRef.current.stop().catch(() => {});
          fallbackRecorderRef.current = null;
        }
        VoiceRecorder.resetAudioMode().catch(() => {});
      }
    }
    return () => {
      VoiceService.stop();
    };
  }, [isOpen]);

  // Hoisted, exclusive speech playback handler: only 1 message speaks at a time
  const handleToggleSpeech = (messageId, rawText) => {
    if (speakingMessageId === messageId) {
      VoiceService.stop();
      setSpeakingMessageId(null);
    } else {
      VoiceService.stop();
      setSpeakingMessageId(messageId);

      const cleanText = cleanTextForSpeech(rawText || '');
      if (!cleanText) {
        setSpeakingMessageId(null);
        return;
      }

      VoiceService.speak(cleanText, {
        avatarId: activeAvatarModel,
        voiceType: activeVoiceCode || userVoiceSettings.voice,
        speechSpeed: userVoiceSettings.speed || 1.0,
        availableVoices,
        onStart: () => {
          setSpeakingMessageId(messageId);
        },
        onDone: () => {
          setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
        },
        onError: () => {
          setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
        },
      });
    }
  };

  const handleSend = async (textToSend) => {
    const text = String(textToSend || draft).trim();
    if (!text || loading) return;

    setDraft('');
    if (onSendMessage) {
      await onSendMessage(text);
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
    setIsRecording(false);

    if (isNativeSpeechRecognitionAvailable) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}

      const finalSpoken = `${accumulatedTranscriptRef.current} ${interimTranscriptRef.current}`
        .replace(/\s+/g, ' ')
        .trim() || draft.replace(/\s+/g, ' ').trim();

      accumulatedTranscriptRef.current = '';
      interimTranscriptRef.current = '';

      if (!finalSpoken || finalSpoken.length < 2) {
        stoppingRef.current = false;
        return;
      }

      isSendingRef.current = true;
      try {
        setDraft('');
        await handleSend(finalSpoken);
      } catch (err) {
        console.warn('[AssistantModal] Speech to text error:', err);
        Alert.alert('Voice Input Failed', 'Could not process audio.');
      } finally {
        stoppingRef.current = false;
        isSendingRef.current = false;
      }
    } else {
      // Fallback: stop audio recorder and transcribe via Whisper
      try {
        const recorder = fallbackRecorderRef.current;
        fallbackRecorderRef.current = null;
        if (!recorder) {
          stoppingRef.current = false;
          return;
        }

        const uri = await recorder.stop();
        await VoiceRecorder.resetAudioMode();

        if (!uri) {
          stoppingRef.current = false;
          return;
        }

        isSendingRef.current = true;
        const res = await speechService.speechToText({
          uri,
          name: 'assistant_voice.m4a',
          type: Platform.OS === 'ios' ? 'audio/x-m4a' : 'audio/mp4',
        });

        if (res && res.transcript && res.transcript.trim()) {
          const transcribed = res.transcript.trim();
          setDraft(transcribed);
          await handleSend(transcribed);
        } else {
          Alert.alert('Silence Detected 🤫', 'Could not hear any speech. Please try speaking again.');
        }
      } catch (err) {
        console.warn('[AssistantModal] Fallback audio processing error:', err);
        Alert.alert('Voice Input Failed', 'Could not process audio.');
      } finally {
        stoppingRef.current = false;
        isSendingRef.current = false;
      }
    }
  };

  const startRecording = async () => {
    if (startingRef.current || isRecordingRef.current || isSendingRef.current) return;
    startingRef.current = true;

    try {
      VoiceService.stop();
      setSpeakingMessageId(null);

      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      if (isNativeSpeechRecognitionAvailable) {
        const granted = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted?.granted) {
          Alert.alert('Microphone Permission', 'Please allow microphone access to speak to the assistant.');
          startingRef.current = false;
          return;
        }

        const activeSessionId = recordingSessionIdRef.current + 1;
        recordingSessionIdRef.current = activeSessionId;
        accumulatedTranscriptRef.current = '';
        interimTranscriptRef.current = '';
        setDraft('');
        isRecordingRef.current = true;
        setIsRecording(true);

        // Option B: Auto-close after 8 seconds of complete silence
        initialSilenceTimerRef.current = setTimeout(() => {
          if (
            recordingSessionIdRef.current === activeSessionId &&
            isRecordingRef.current &&
            !isSendingRef.current
          ) {
            isRecordingRef.current = false;
            setIsRecording(false);
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
          Alert.alert('Microphone Permission', 'Please allow microphone access to speak to the assistant.');
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
        setDraft('');
        isRecordingRef.current = true;
        setIsRecording(true);

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
            setIsRecording(false);
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
      console.warn('[AssistantModal] Start recording error:', err);
      Alert.alert('Microphone Error', 'Could not start speech recognition.');
      isRecordingRef.current = false;
      setIsRecording(false);
    } finally {
      startingRef.current = false;
    }
  };

  const handleToggleRecording = async () => {
    if (loading) return;

    if (isRecording || isRecordingRef.current) {
      await stopRecordingAndSend();
    } else {
      await startRecording();
    }
  };

  const panelBg = isDark ? '#0F172A' : '#FFFFFF';
  const panelBorder = isDark ? '#1E293B' : '#E2E8F0';
  const headerBg = isDark ? '#1E293B' : '#F8FAFC';
  const headerBorder = isDark ? '#334155' : '#E2E8F0';
  const inputBg = isDark ? '#1E293B' : '#F1F5F9';
  const inputBorder = isDark ? '#334155' : '#CBD5E1';
  const textColor = isDark ? '#F1F5F9' : '#0F172A';
  const subtextColor = isDark ? '#94A3B8' : '#64748B';

  const safeTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  // On Android with edge-to-edge / translucent status bar, React Native's keyboardDidShow
  // returns `height = imeInsets.bottom - barInsets.bottom` (see ReactRootView.java line 962).
  // Because our full-screen overlay extends to the absolute bottom of the display (including
  // the system navigation bar), the total distance from the bottom of the screen to the top
  // of the keyboard is: keyboardHeight + insets.bottom.
  // We subtract any amount the OS already shrunk the container to prevent double padding.
  const totalKeyboardNeeded = keyboardHeight + (Platform.OS === 'android' ? insets.bottom : 0);
  const osShrunkAmount = initialHeightRef.current && currentLayoutHeight
    ? Math.max(0, initialHeightRef.current - currentLayoutHeight)
    : 0;
  const dynamicKeyboardInset = isKeyboardVisible
    ? Math.max(0, totalKeyboardNeeded - osShrunkAmount)
    : 0;
  const inputDockPaddingBottom = isKeyboardVisible ? 8 : Math.max(insets.bottom, 12);

  if (!isMounted) {
    return null;
  }

  const overlayTranslateY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [windowHeight || SCREEN_HEIGHT, 0],
  });

  const overlayOpacity = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        styles.overlayContainer,
        {
          backgroundColor: panelBg,
          opacity: overlayOpacity,
          transform: [{ translateY: overlayTranslateY }],
        },
      ]}
      pointerEvents={isOpen ? 'auto' : 'none'}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        if (height > 0) {
          setCurrentLayoutHeight(height);
          if (!isKeyboardVisibleRef.current && (!initialHeightRef.current || height > initialHeightRef.current)) {
            initialHeightRef.current = height;
          }
        }
      }}
    >
      {/* Declarative Status Bar when chatbot overlay is rendered */}
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={true} />

      <View
        style={[
          styles.fullScreenWrapper,
          {
            paddingBottom: dynamicKeyboardInset,
          },
        ]}
      >
        {/* Solid Black Top Bar for System Status Bar / Hotspot / Notch */}
        <View style={[styles.statusBarBackground, { height: safeTop }]} />

        {/* Top Accent Gradient Bar */}
        <LinearGradient
          colors={['#5243F5', '#7B61FF', '#00D2FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topAccentBar}
        />

        {/* Assistant Header */}
        <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
          {/* AI Avatar with Live Dot */}
          <View style={styles.avatarBox}>
            <LinearGradient
              colors={['#5243F5', '#8F4FFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </LinearGradient>
            <View style={[styles.liveBadge, { borderColor: headerBg }]}>
              <View style={styles.liveDot} />
            </View>
          </View>

          {/* Title & Role Info */}
          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: textColor }]}>SpeakMate Assistant</Text>
              <View
                style={[
                  styles.aiPill,
                  {
                    backgroundColor: isDark ? '#312E81' : '#EEF2FF',
                    borderColor: isDark ? '#4338CA' : '#C7D2FE',
                  },
                ]}
              >
                <Text style={[styles.aiPillText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>AI</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={[styles.roleText, { color: subtextColor }]}>{roleTitle}</Text>
              <Text style={[styles.dotDivider, { color: subtextColor }]}>•</Text>
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>

          {/* Header Action Buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onResetChat}
              style={[styles.actionBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}
              accessibilityLabel="Reset conversation"
            >
              <Ionicons name="trash-outline" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClose}
              style={[styles.actionBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}
              accessibilityLabel="Close assistant"
            >
              <Ionicons name="close" size={20} color={isDark ? '#F1F5F9' : '#1E293B'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClearError}>
              <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Flexible Message Stream Scroll Area */}
        <ScrollView
          ref={scrollRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {isEmpty ? (
            <View style={styles.emptyContainer}>
              {/* Welcome Message Card */}
              <MessageBubble
                message={{
                  id: 'welcome',
                  sender: 'assistant',
                  content: welcomeText,
                }}
                role={role}
                onClose={handleClose}
                isSpeaking={speakingMessageId === 'welcome'}
                onToggleSpeech={() => handleToggleSpeech('welcome', welcomeText)}
              />

              {/* Suggested Questions */}
              {quickSuggestions.length > 0 ? (
                <View style={styles.suggestionsWrapper}>
                  <View style={styles.suggestionsHeader}>
                    <Ionicons name="sparkles" size={12} color="#F59E0B" style={{ marginRight: 5 }} />
                    <Text style={[styles.suggestionsTitle, { color: subtextColor }]}>
                      SUGGESTED QUESTIONS
                    </Text>
                  </View>

                  <View style={styles.suggestionsList}>
                    {quickSuggestions.map((question, index) => (
                      <TouchableOpacity
                        key={`${question}-${index}`}
                        activeOpacity={0.7}
                        onPress={() => handleSend(question)}
                        disabled={loading}
                        style={[
                          styles.suggestionButton,
                          {
                            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                          },
                        ]}
                      >
                        <Text style={[styles.suggestionText, { color: textColor }]} numberOfLines={2}>
                          {question}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color="#6366F1" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  role={role}
                  onClose={handleClose}
                  isSpeaking={speakingMessageId === msg.id}
                  onToggleSpeech={() => handleToggleSpeech(msg.id, msg.content)}
                />
              ))}

              {/* Thinking / Typing Indicator */}
              {loading ? (
                <View style={styles.thinkingContainer}>
                  <View
                    style={[
                      styles.thinkingCard,
                      {
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                      },
                    ]}
                  >
                    <ActivityIndicator size="small" color="#6366F1" style={{ marginRight: 8 }} />
                    <Text style={[styles.thinkingText, { color: subtextColor }]}>
                      SpeakMate AI is thinking...
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Bottom Chat Input Dock */}
        <View
          style={[
            styles.inputDock,
            {
              backgroundColor: headerBg,
              borderTopColor: headerBorder,
              paddingBottom: inputDockPaddingBottom,
            },
          ]}
        >
          <View style={[styles.inputBar, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                isRecording
                  ? 'Listening... Auto-sends when you finish'
                  : loading
                  ? 'Thinking...'
                  : 'Ask SpeakMate Assistant...'
              }
              placeholderTextColor={subtextColor}
              style={[styles.textInput, { color: textColor }]}
              editable={!loading}
              multiline={true}
              maxHeight={90}
              returnKeyType={draft.trim().length > 0 ? 'send' : 'default'}
              onSubmitEditing={() => {
                if (draft.trim()) {
                  handleSend();
                }
              }}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
            />

            {/* Speech-to-text Microphone Button */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleToggleRecording}
              disabled={loading}
              style={[styles.micBtn, isRecording && styles.micBtnActive]}
              accessibilityLabel={isRecording ? 'Stop voice recording' : 'Voice input'}
            >
              <Ionicons
                name={isRecording ? 'mic' : 'mic-outline'}
                size={18}
                color={isRecording ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B'}
              />
            </TouchableOpacity>

            {/* Send Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSend()}
              disabled={loading || !draft.trim()}
              style={[styles.sendBtn, (!draft.trim() || loading) && styles.sendBtnDisabled]}
              accessibilityLabel="Send question"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
          </View>

          {/* Micro AI Disclaimer */}
          <Text style={[styles.disclaimerText, { color: subtextColor }]}>
            Powered by SpeakMate AI • Grounded Academic Assistant
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 99999,
    elevation: Platform.OS === 'android' ? 999 : 0,
  },
  fullScreenWrapper: {
    flex: 1,
    width: '100%',
  },
  statusBarBackground: {
    width: '100%',
    backgroundColor: '#000000',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  topAccentBar: {
    height: 3,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarBox: {
    position: 'relative',
    marginRight: 10,
  },
  avatarGradient: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  aiPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  aiPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dotDivider: {
    marginHorizontal: 5,
    fontSize: 11,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 11.5,
    color: '#EF4444',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 4,
  },
  suggestionsWrapper: {
    marginTop: 12,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  suggestionsTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  suggestionsList: {
    gap: 6,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
    lineHeight: 16,
  },
  thinkingContainer: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  thinkingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  thinkingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputDock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 36,
    maxHeight: 80,
  },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.45,
  },
  disclaimerText: {
    fontSize: 9.5,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
});

export default AssistantModal;
