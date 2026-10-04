import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Alert,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { Card, Screen } from '../../components/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { vocabularyService, settingsService, progressService } from '../../services/appServices';
import { VoiceService } from '../../services/VoiceService';
import { getCachedAvatarModel } from '../../config/AvatarCatalog';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 36, 400);
const CARD_HEIGHT = 370;

// =========================================================================
// ONBOARDING CALIBRATED VOCABULARY CURRICULUMS (STUDENTS & INDIVIDUAL USERS)
// =========================================================================
const CURRICULUM_DATA = {
  // Students by Grade (1st to 10th Std)
  '1st Std': [
    { id: 'v1_1', word: 'Apple', partOfSpeech: 'noun', meaning: 'A sweet round fruit that grows on trees.', example: 'An apple a day keeps the doctor away.', synonym: 'Fruit', favorite: true },
    { id: 'v1_2', word: 'Friend', partOfSpeech: 'noun', meaning: 'A person you like and enjoy spending time with.', example: 'Sita is my best school friend.', synonym: 'Companion', favorite: false },
    { id: 'v1_3', word: 'Happy', partOfSpeech: 'adjective', meaning: 'Feeling or showing pleasure, contentment, and joy.', example: 'I feel very happy on my birthday.', synonym: 'Joyful', favorite: false },
    { id: 'v1_4', word: 'Smile', partOfSpeech: 'verb', meaning: 'Form a pleased or happy facial expression.', example: 'Always smile when greeting your teacher.', synonym: 'Beam', favorite: false },
    { id: 'v1_5', word: 'Sunny', partOfSpeech: 'adjective', meaning: 'Bright with sunlight and pleasant warm weather.', example: 'It is a sunny morning for playing outside.', synonym: 'Bright', favorite: false },
    { id: 'v1_6', word: 'Puppy', partOfSpeech: 'noun', meaning: 'A young baby dog.', example: 'The playful puppy chased the red ball.', synonym: 'Doggy', favorite: false },
  ],
  '2nd Std': [
    { id: 'v2_1', word: 'Routine', partOfSpeech: 'noun', meaning: 'A regular sequence of actions followed regularly.', example: 'Brushing teeth is part of my morning routine.', synonym: 'Schedule', favorite: true },
    { id: 'v2_2', word: 'Pencil', partOfSpeech: 'noun', meaning: 'An instrument used for writing or drawing on paper.', example: 'I sharpened my yellow pencil for class.', synonym: 'Writing tool', favorite: false },
    { id: 'v2_3', word: 'Weather', partOfSpeech: 'noun', meaning: 'The state of the atmosphere (sunny, rainy, cool).', example: 'The weather today is sunny and bright.', synonym: 'Climate', favorite: false },
    { id: 'v2_4', word: 'Playground', partOfSpeech: 'noun', meaning: 'An outdoor area provided for children to play.', example: 'We play on the swings in the playground.', synonym: 'Park', favorite: false },
    { id: 'v2_5', word: 'Gentle', partOfSpeech: 'adjective', meaning: 'Mild, kind, or tender in behavior.', example: 'Be gentle when holding the baby bird.', synonym: 'Kind', favorite: false },
  ],
  '3rd Std': [
    { id: 'v3_1', word: 'Helper', partOfSpeech: 'noun', meaning: 'A person who helps or assists others in daily life.', example: 'Firefighters are brave community helpers.', synonym: 'Assistant', favorite: true },
    { id: 'v3_2', word: 'Action', partOfSpeech: 'noun', meaning: 'The process of doing something or achieving an aim.', example: 'Running and jumping are active action words.', synonym: 'Activity', favorite: false },
    { id: 'v3_3', word: 'Polite', partOfSpeech: 'adjective', meaning: 'Having or showing behavior that is respectful and considerate.', example: 'Saying please and thank you is very polite.', synonym: 'Courteous', favorite: false },
    { id: 'v3_4', word: 'Schedule', partOfSpeech: 'noun', meaning: 'A plan that lists expected times for activities.', example: 'Check our school timetable schedule.', synonym: 'Timetable', favorite: false },
    { id: 'v3_5', word: 'Curious', partOfSpeech: 'adjective', meaning: 'Eager to know or learn something new.', example: 'The curious student asked wonderful science questions.', synonym: 'Inquisitive', favorite: false },
  ],
  '4th Std': [
    { id: 'v4_1', word: 'Expedition', partOfSpeech: 'noun', meaning: 'A journey undertaken by a group with a specific purpose.', example: 'Astronauts launched a space expedition to Mars.', synonym: 'Journey', favorite: true },
    { id: 'v4_2', word: 'Direction', partOfSpeech: 'noun', meaning: 'The course along which someone or something moves.', example: 'Turn left to find the school library direction.', synonym: 'Route', favorite: false },
    { id: 'v4_3', word: 'Habit', partOfSpeech: 'noun', meaning: 'A settled or regular tendency that is hard to give up.', example: 'Drinking clean water daily is a healthy habit.', synonym: 'Practice', favorite: false },
    { id: 'v4_4', word: 'Courage', partOfSpeech: 'noun', meaning: 'Strength in the face of difficulty or danger.', example: 'It takes courage to speak clearly on stage.', synonym: 'Bravery', favorite: false },
  ],
  '5th Std': [
    { id: 'v5_1', word: 'Environment', partOfSpeech: 'noun', meaning: 'The surroundings and nature in which humans and animals live.', example: 'Planting trees protects our natural environment.', synonym: 'Surroundings', favorite: true },
    { id: 'v5_2', word: 'Experiment', partOfSpeech: 'noun', meaning: 'A scientific test done to discover something.', example: 'We conducted a science experiment on plant growth.', synonym: 'Test', favorite: false },
    { id: 'v5_3', word: 'Recycle', partOfSpeech: 'verb', meaning: 'Convert waste materials into reusable objects.', example: 'We recycle paper and plastic bottles at school.', synonym: 'Reuse', favorite: false },
    { id: 'v5_4', word: 'Discovery', partOfSpeech: 'noun', meaning: 'The act of finding something for the first time.', example: 'The scientist made an important medical discovery.', synonym: 'Breakthrough', favorite: false },
  ],
  '6th Std': [
    { id: 'v6_1', word: 'Robotics', partOfSpeech: 'noun', meaning: 'The branch of engineering dealing with the design and use of robots.', example: 'She joined the school robotics club to build code.', synonym: 'Automation', favorite: true },
    { id: 'v6_2', word: 'Debate', partOfSpeech: 'noun', meaning: 'A formal discussion on a particular topic in public.', example: 'Our team won the inter-school debate competition.', synonym: 'Discussion', favorite: false },
    { id: 'v6_3', word: 'Assistance', partOfSpeech: 'noun', meaning: 'Help or support given to someone.', example: 'The teacher offered polite assistance during the test.', synonym: 'Aid', favorite: false },
  ],
  '7th Std': [
    { id: 'v7_1', word: 'Conservation', partOfSpeech: 'noun', meaning: 'Prevention of wasteful use of a natural resource.', example: 'Water conservation is vital for future generations.', synonym: 'Preservation', favorite: true },
    { id: 'v7_2', word: 'Delegate', partOfSpeech: 'verb', meaning: 'Entrust a task or duty to another person.', example: 'The leader delegates responsibilities to team members.', synonym: 'Assign', favorite: false },
    { id: 'v7_3', word: 'Perspective', partOfSpeech: 'noun', meaning: 'A particular attitude toward or way of regarding something.', example: 'Reading history gives us a broader perspective on life.', synonym: 'Viewpoint', favorite: false },
  ],
  '8th Std': [
    { id: 'v8_1', word: 'Leadership', partOfSpeech: 'noun', meaning: 'The action of leading a group or organization.', example: 'Student council develops strong leadership qualities.', synonym: 'Guidance', favorite: true },
    { id: 'v8_2', word: 'Rebuttal', partOfSpeech: 'noun', meaning: 'A refutation or contradiction in a formal debate.', example: 'She delivered a powerful rebuttal during the debate.', synonym: 'Refutation', favorite: false },
    { id: 'v8_3', word: 'Innovation', partOfSpeech: 'noun', meaning: 'A new method, idea, or technological product.', example: 'Artificial intelligence is a major technological innovation.', synonym: 'Novelty', favorite: false },
  ],
  '9th Std': [
    { id: 'v9_1', word: 'Diplomatic', partOfSpeech: 'adjective', meaning: 'Handling sensitive situations tactfully and politely.', example: 'He used diplomatic language to resolve peer conflict.', synonym: 'Tactful', favorite: true },
    { id: 'v9_2', word: 'Keynote', partOfSpeech: 'noun', meaning: 'A main speech outlining the central theme of an event.', example: 'She delivered the opening keynote on climate change.', synonym: 'Main theme', favorite: false },
    { id: 'v9_3', word: 'Breakthrough', partOfSpeech: 'noun', meaning: 'A sudden, dramatic, and important discovery.', example: 'Scientists announced a breakthrough in solar energy.', synonym: 'Advance', favorite: false },
  ],
  '10th Std': [
    { id: 'v10_1', word: 'Oratory', partOfSpeech: 'noun', meaning: 'Formal public speaking characterized by high eloquence.', example: 'CEFR C1 mastery requires spontaneous oratory skill.', synonym: 'Eloquence', favorite: true },
    { id: 'v10_2', word: 'Simulation', partOfSpeech: 'noun', meaning: 'Imitation of a situation or process in realistic conditions.', example: 'We completed a 10th Board oral exam simulation.', synonym: 'Model', favorite: false },
    { id: 'v10_3', word: 'Proficiency', partOfSpeech: 'noun', meaning: 'A high degree of skill, competence, and fluency.', example: 'Fluency and accuracy demonstrate English proficiency.', synonym: 'Competence', favorite: false },
  ],

  // Individual Users by Age Group
  'Kids': [
    { id: 'vk_1', word: 'Cheerful', partOfSpeech: 'adjective', meaning: 'Noticeably happy, energetic, and optimistic.', example: 'She greeted her classmates with a cheerful smile.', synonym: 'Joyful', favorite: true },
    { id: 'vk_2', word: 'Adventure', partOfSpeech: 'noun', meaning: 'An unusual and exciting or daring experience.', example: 'We had a fun adventure in the treehouse.', synonym: 'Journey', favorite: false },
    { id: 'vk_3', word: 'Playful', partOfSpeech: 'adjective', meaning: 'Fond of games and amusement; lighthearted.', example: 'The playful kitten jumped on the soft cushion.', synonym: 'Frisky', favorite: false },
    { id: 'vk_4', word: 'Brave', partOfSpeech: 'adjective', meaning: 'Ready to face danger or pain without fear.', example: 'The brave knight protected the gentle animals.', synonym: 'Courageous', favorite: false },
  ],
  'Teens': [
    { id: 'vt_1', word: 'Relatable', partOfSpeech: 'adjective', meaning: 'Enabling a person to feel that they can identify with it.', example: 'The song lyrics are very relatable to teenagers.', synonym: 'Understandable', favorite: true },
    { id: 'vt_2', word: 'Spontaneous', partOfSpeech: 'adjective', meaning: 'Performed or occurring as a result of a sudden impulse.', example: 'We took a spontaneous weekend bicycle trip.', synonym: 'Unplanned', favorite: false },
    { id: 'vt_3', word: 'Collaborate', partOfSpeech: 'verb', meaning: 'Work jointly on an activity or creative project.', example: 'Our team collaborated to build the science project.', synonym: 'Cooperate', favorite: false },
  ],
  'Young Adult': [
    { id: 'vy_1', word: 'Articulate', partOfSpeech: 'adjective', meaning: 'Having or showing the ability to speak fluently and coherently.', example: 'An articulate speaker can convey complex ideas effortlessly.', synonym: 'Eloquent', favorite: true },
    { id: 'vy_2', word: 'Resilient', partOfSpeech: 'adjective', meaning: 'Able to withstand or recover quickly from difficulties.', example: 'She showed a resilient mindset throughout university.', synonym: 'Tough', favorite: false },
    { id: 'vy_3', word: 'Pragmatic', partOfSpeech: 'adjective', meaning: 'Dealing with things sensibly and realistically in a practical way.', example: 'They took a pragmatic approach to budget planning.', synonym: 'Practical', favorite: false },
    { id: 'vy_4', word: 'Tenacious', partOfSpeech: 'adjective', meaning: 'Tending to keep a firm hold of something; persistent.', example: 'Her tenacious effort helped her master English speaking.', synonym: 'Persistent', favorite: false },
  ],
  'Professional': [
    { id: 'vw_1', word: 'Strategic', partOfSpeech: 'adjective', meaning: 'Carefully designed or planned to serve a clear advantage.', example: 'We established strategic milestones for quarterly goals.', synonym: 'Calculated', favorite: true },
    { id: 'vw_2', word: 'Leverage', partOfSpeech: 'verb', meaning: 'Use something to maximum advantage.', example: 'We leverage AI technology to accelerate English learning.', synonym: 'Utilize', favorite: false },
    { id: 'vw_3', word: 'Synergy', partOfSpeech: 'noun', meaning: 'The combined effect of items greater than the sum of their individual effects.', example: 'Team synergy enabled us to deliver the project early.', synonym: 'Harmony', favorite: false },
  ],
  'Senior': [
    { id: 'vs_1', word: 'Serenity', partOfSpeech: 'noun', meaning: 'The state of being calm, peaceful, and untroubled.', example: 'She enjoyed the morning serenity of her garden.', synonym: 'Tranquility', favorite: true },
    { id: 'vs_2', word: 'Nostalgia', partOfSpeech: 'noun', meaning: 'A sentimental longing or affection for the past.', example: 'Looking at old family photos brought a wave of nostalgia.', synonym: 'Reminiscence', favorite: false },
    { id: 'vs_3', word: 'Wisdom', partOfSpeech: 'noun', meaning: 'The quality of having experience and sound judgment.', example: 'Her grandmother shared timeless wisdom on life and patience.', synonym: 'Insight', favorite: false },
  ],
};

export default function VocabularyScreen() {
  const { isDark, theme } = useTheme();
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'flashcards', 'quiz'
  const [word, setWord] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'favorites'
  const [saving, setSaving] = useState(false);
  const [userWords, setUserWords] = useState([]);
  const [userProfileTitle, setUserProfileTitle] = useState('My Vocabulary');

  // Settings & Voices
  const [settings, setSettings] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [activeAvatarModel, setActiveAvatarModel] = useState(() => getCachedAvatarModel() || 'haru');

  // 3D Flashcard State & Physics
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isFlippingRef = useRef(false);

  // Animations
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const speakerPulse = useRef(new Animated.Value(1)).current;

  // Next-Level Quiz state
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const [mistakesList, setMistakesList] = useState([]);
  const [showMistakes, setShowMistakes] = useState(false);

  // Load User Profile & Calibrated Curriculums
  const loadUserData = async () => {
    try {
      const [savedAccType, savedGrade, savedAgeGroup, s, voices, savedVoice, savedAvatar, savedAutoPlay, savedSoundEffects, backendWords] = await Promise.all([
        AsyncStorage.getItem('speakmate_account_type'),
        AsyncStorage.getItem('speakmate_school_grade'),
        AsyncStorage.getItem('speakmate_age_group'),
        settingsService.get().catch(() => null),
        VoiceService.getAvailableEnglishVoices(),
        AsyncStorage.getItem('speakmate_selected_voice'),
        AsyncStorage.getItem('speakmate_avatar_model'),
        AsyncStorage.getItem('speakmate_auto_play_audio'),
        AsyncStorage.getItem('speakmate_sound_effects'),
        vocabularyService.all().catch(() => []),
      ]);

      const effAvatar = getCachedAvatarModel() || savedAvatar || 'haru';
      setActiveAvatarModel(effAvatar);

      const effAccType = savedAccType || 'INDIVIDUAL_USER';
      const effectiveVoice = savedVoice || s?.aiVoice || 'Default';
      const effectiveAutoPlay = savedAutoPlay !== null ? savedAutoPlay === 'true' : (s?.autoPlayAudio ?? true);
      const effectiveSoundEffects = savedSoundEffects !== null ? savedSoundEffects === 'true' : (s?.soundEffects ?? true);
      setSettings({
        ...s,
        aiVoice: effectiveVoice,
        autoPlayAudio: effectiveAutoPlay,
        soundEffects: effectiveSoundEffects,
      });
      setAvailableVoices(voices);

      let profileKey = '1st Std';
      let title = 'Vocabulary';

      if (effAccType === 'STUDENT') {
        profileKey = savedGrade || '1st Std';
        title = `Student Standard: ${profileKey}`;
      } else {
        const rawAge = savedAgeGroup || 'Young Adult';
        if (rawAge.toLowerCase().includes('kid')) profileKey = 'Kids';
        else if (rawAge.toLowerCase().includes('teen')) profileKey = 'Teens';
        else if (rawAge.toLowerCase().includes('senior')) profileKey = 'Senior';
        else if (rawAge.toLowerCase().includes('pro') || rawAge.toLowerCase().includes('work')) profileKey = 'Professional';
        else profileKey = 'Young Adult';
        title = `Age Group: ${rawAge}`;
      }

      setUserProfileTitle(title);

      // Base Curated List for User's Profile
      const curatedBase = CURRICULUM_DATA[profileKey] || CURRICULUM_DATA['1st Std'];

      // Merge with custom user added words
      const combined = [...(backendWords || [])];
      for (const cw of curatedBase) {
        if (!combined.some((w) => w.word.toLowerCase() === cw.word.toLowerCase())) {
          combined.push(cw);
        }
      }

      setUserWords(combined);
    } catch (e) {
      console.warn('Failed to load profile vocabulary:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      return () => {
        VoiceService.stop();
        setIsSpeaking(false);
      };
    }, [])
  );

  // Stop speech whenever navigating away from flashcards tab
  useEffect(() => {
    if (activeTab !== 'flashcards') {
      VoiceService.stop();
      setIsSpeaking(false);
    }
  }, [activeTab]);

  // Pulse animation while speaking
  useEffect(() => {
    let pulseAnim = null;
    let frameId = null;

    if (isSpeaking) {
      frameId = requestAnimationFrame(() => {
        pulseAnim = Animated.loop(
          Animated.sequence([
            Animated.timing(speakerPulse, {
              toValue: 1.22,
              duration: 320,
              useNativeDriver: true,
            }),
            Animated.timing(speakerPulse, {
              toValue: 1.0,
              duration: 320,
              useNativeDriver: true,
            }),
          ])
        );
        pulseAnim.start();
      });
    } else {
      speakerPulse.setValue(1);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (pulseAnim) pulseAnim.stop();
    };
  }, [isSpeaking]);

  // Filter and search logic
  const filteredItems = userWords.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (item.word && item.word.toLowerCase().includes(q)) ||
      (item.meaning && item.meaning.toLowerCase().includes(q));

    const matchesFilter = filterType === 'all' || (filterType === 'favorites' && item.favorite);
    return matchesSearch && matchesFilter;
  });

  const currentCard = filteredItems[currentCardIndex] || filteredItems[0];

  // Dedicated Pronunciation Engine with Lifecycle Callbacks
  const playWordPronunciation = (txt) => {
    if (settings?.isMuted || !txt) return;
    VoiceService.stop();
    VoiceService.speak(txt, {
      avatarId: activeAvatarModel,
      voiceType: settings?.aiVoice || 'Default',
      availableVoices,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // STEP 1: Auto-pronounce word on mount or card change without flipping (Respects Auto-play Pronunciation setting)!
  useEffect(() => {
    if (activeTab === 'flashcards' && currentCard && !flipped && settings?.autoPlayAudio !== false) {
      const timer = setTimeout(() => {
        playWordPronunciation(currentCard.word);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentCardIndex, activeTab, settings?.autoPlayAudio]);

  // Add Custom Word with AI
  const addWord = async () => {
    const cleanWord = word.trim();
    if (!cleanWord) return;
    setSaving(true);
    try {
      const response = await vocabularyService.add(cleanWord);
      setWord('');
      Alert.alert('Word Added ✨', `"${cleanWord}" added with AI pronunciation and meaning! (+5 XP)`);
      setUserWords((prev) => [response, ...prev]);
    } catch (error) {
      const localItem = {
        id: 'loc_' + Date.now(),
        word: cleanWord,
        partOfSpeech: 'word',
        meaning: `Definition and conversational usage for ${cleanWord}`,
        example: `Practice using "${cleanWord}" naturally in daily English speaking.`,
        favorite: false,
      };
      setUserWords((prev) => [localItem, ...prev]);
      setWord('');
      Alert.alert('Saved ✨', `"${cleanWord}" added to your word bank!`);
    } finally {
      setSaving(false);
    }
  };

  // Toggle Favorite
  const toggleFavorite = async (item) => {
    const newFav = !item.favorite;
    try {
      if (typeof item.id === 'number' || !String(item.id).startsWith('v')) {
        await vocabularyService.toggleFavorite(item.id);
      }
      setUserWords((prev) => prev.map((w) => (w.id === item.id ? { ...w, favorite: newFav } : w)));
    } catch (e) {
      setUserWords((prev) => prev.map((w) => (w.id === item.id ? { ...w, favorite: newFav } : w)));
    }
  };

  // Toggle Mastered (+10 XP)
  const toggleMastered = async (item) => {
    const newMastered = !item.mastered;
    try {
      if (typeof item.id === 'number' || !String(item.id).startsWith('v')) {
        await vocabularyService.toggleMastered(item.id);
      }
      setUserWords((prev) => prev.map((w) => (w.id === item.id ? { ...w, mastered: newMastered } : w)));
      if (newMastered) {
        Alert.alert('Word Mastered! 🧠', `"${item.word}" marked as Mastered! (+10 XP)`);
        const prog = await progressService.get().catch(() => null);
        if (prog) {
          await progressService.update({
            ...prog,
            xp: (prog.xp || 0) + 10,
            totalVocabularyWords: (prog.totalVocabularyWords || 0) + 1,
          });
        }
      }
    } catch (e) {
      setUserWords((prev) => prev.map((w) => (w.id === item.id ? { ...w, mastered: newMastered } : w)));
      if (newMastered) {
        Alert.alert('Word Mastered! 🧠', `"${item.word}" marked as Mastered! (+10 XP)`);
      }
    }
  };

  // Press feedback handlers for physical tactile card feel
  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1.0,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  // =========================================================================
  // CARD INTERACTION: FRONT TAP -> FLIP & SPEAK MEANING, BACK TAP -> FLIP & SPEAK WORD
  // =========================================================================
  const handleCardTap = () => {
    if (isFlippingRef.current) return;
    isFlippingRef.current = true;

    const nextFlipped = !flipped;

    // When flipping to back (meaning side) -> AI speaks the meaning!
    if (nextFlipped && currentCard) {
      playWordPronunciation(currentCard.meaning ? `${currentCard.word}. ${currentCard.meaning}` : currentCard.word);
    } 
    // When flipping back to front (word side) -> AI speaks the word!
    else if (!nextFlipped && currentCard) {
      playWordPronunciation(currentCard.word);
    }

    Animated.timing(flipAnimation, {
      toValue: nextFlipped ? 180 : 0,
      duration: 520,
      useNativeDriver: true,
    }).start(() => {
      isFlippingRef.current = false;
      setFlipped(nextFlipped);
    });
  };

  // Speaker button on front replays word, on back replays meaning
  const handleSpeakerTap = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (currentCard) {
      if (flipped) {
        playWordPronunciation(currentCard.meaning ? `${currentCard.word}. ${currentCard.meaning}` : currentCard.word);
      } else {
        playWordPronunciation(currentCard.word);
      }
    }
  };

  // 3D Flip Interpolations with Perspective
  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnimation.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = flipAnimation.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  // Navigation handlers with clean state reset & auto-pronounce
  const nextCard = () => {
    VoiceService.stop();
    setIsSpeaking(false);
    if (flipped) {
      Animated.timing(flipAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setFlipped(false);
    }
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    }, 180);
  };

  const prevCard = () => {
    VoiceService.stop();
    setIsSpeaking(false);
    if (flipped) {
      Animated.timing(flipAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setFlipped(false);
    }
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    }, 180);
  };

  // =========================================================================
  // NEXT-LEVEL HIGH-ACCURACY MULTI-FORMAT QUIZ ENGINE
  // =========================================================================
  const startQuiz = () => {
    VoiceService.stop();
    setIsSpeaking(false);
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setStreakCount(0);
    setMaxStreak(0);
    setQuizFinished(false);
    setMistakesList([]);
    setShowMistakes(false);
    setEarnedXP(0);

    const allPools = [
      ...userWords,
      ...CURRICULUM_DATA['1st Std'],
      ...CURRICULUM_DATA['3rd Std'],
      ...CURRICULUM_DATA['5th Std'],
      ...CURRICULUM_DATA['7th Std'],
      ...CURRICULUM_DATA['10th Std'],
      ...CURRICULUM_DATA['Young Adult'],
      ...CURRICULUM_DATA['Professional'],
    ];

    const uniquePool = [];
    const seenWords = new Set();
    for (const w of allPools) {
      if (w.word && !seenWords.has(w.word.toLowerCase().trim())) {
        seenWords.add(w.word.toLowerCase().trim());
        uniquePool.push(w);
      }
    }

    const activePool = userWords.length >= 5 ? userWords : uniquePool;
    const shuffledActive = [...activePool].sort(() => 0.5 - Math.random());
    const selectedTargets = shuffledActive.slice(0, 5);

    const questions = selectedTargets.map((item, idx) => {
      const qType = idx % 4;
      let questionBadge = '';
      let promptTitle = '';
      let promptSubtitle = '';
      let correctAnswer = '';
      let options = [];

      if (qType === 0 && item.example) {
        questionBadge = '📝 Sentence Context';
        const regex = new RegExp(`\\b${item.word}\\b`, 'gi');
        promptTitle = item.example.replace(regex, '_______');
        promptSubtitle = 'Choose the correct word to complete the sentence:';
        correctAnswer = item.word;

        const otherWords = uniquePool
          .filter((w) => w.word.toLowerCase() !== item.word.toLowerCase())
          .map((w) => w.word)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        options = [item.word, ...otherWords].sort(() => 0.5 - Math.random());
      } else if (qType === 1 && item.synonym && item.synonym !== 'None' && item.synonym !== 'Fruit') {
        questionBadge = '🔀 Synonym Finder';
        promptTitle = `Which word is the closest synonym for "${item.word}"?`;
        promptSubtitle = 'Select the word with the most similar meaning:';
        correctAnswer = item.synonym;

        const otherSynonyms = uniquePool
          .filter((w) => w.synonym && w.synonym !== 'None' && w.synonym.toLowerCase() !== item.synonym.toLowerCase())
          .map((w) => w.synonym)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        while (otherSynonyms.length < 3) {
          otherSynonyms.push(['Hesitation', 'Confusion', 'Disruption', 'Hesitant'][otherSynonyms.length]);
        }

        options = [item.synonym, ...otherSynonyms].sort(() => 0.5 - Math.random());
      } else if (qType === 2) {
        questionBadge = '🔊 Listening Comprehension';
        promptTitle = `Listen to the pronunciation of "${item.word}"`;
        promptSubtitle = 'What is the accurate definition of this word?';
        correctAnswer = item.meaning;

        const otherMeanings = uniquePool
          .filter((w) => w.meaning && w.meaning !== item.meaning)
          .map((w) => w.meaning)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        options = [item.meaning, ...otherMeanings].sort(() => 0.5 - Math.random());
      } else {
        questionBadge = '📖 Definition Match';
        promptTitle = `What is the correct definition of "${item.word}"?`;
        promptSubtitle = 'Choose the precise meaning:';
        correctAnswer = item.meaning;

        const otherMeanings = uniquePool
          .filter((w) => w.meaning && w.meaning !== item.meaning)
          .map((w) => w.meaning)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        options = [item.meaning, ...otherMeanings].sort(() => 0.5 - Math.random());
      }

      return {
        id: `quiz_q_${idx}_${Date.now()}`,
        qType,
        questionBadge,
        promptTitle,
        promptSubtitle,
        targetWord: item.word,
        partOfSpeech: item.partOfSpeech,
        correctAnswer,
        options,
        example: item.example,
        meaning: item.meaning,
      };
    });

    setQuizQuestions(questions);
    setActiveTab('quiz');
  };

  const submitQuizAnswer = (option) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(option);
    const currentQ = quizQuestions[currentQuizIndex];
    const isCorrect = option === currentQ.correctAnswer;

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      const newStreak = streakCount + 1;
      setStreakCount(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);

      if (settings?.soundEffects !== false) {
        VoiceService.speak('Correct!', {
          avatarId: activeAvatarModel,
          voiceType: settings?.aiVoice || 'Default',
          availableVoices,
        });
      }
    } else {
      setStreakCount(0);
      setMistakesList((prev) => [...prev, { ...currentQ, userAnswer: option }]);

      if (settings?.soundEffects !== false) {
        VoiceService.speak('Review answer below.', {
          avatarId: activeAvatarModel,
          voiceType: settings?.aiVoice || 'Default',
          availableVoices,
        });
      }
    }
  };

  const finishQuiz = async () => {
    setQuizFinished(true);
    const totalQ = quizQuestions.length;
    const baseXP = quizScore * 5;
    const perfectBonus = quizScore === totalQ && totalQ > 0 ? 10 : 0;
    const totalAwarded = baseXP + perfectBonus;
    setEarnedXP(totalAwarded);

    try {
      const prog = await progressService.get().catch(() => null);
      if (prog) {
        await progressService.update({
          ...prog,
          xp: (prog.xp || 0) + totalAwarded,
          totalVocabularyWords: (prog.totalVocabularyWords || 0) + quizScore,
        });
      }
    } catch (e) {
      console.warn('Quiz progress update error:', e);
    }
  };

  const nextQuizQuestion = () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setSelectedAnswer(null);
      setCurrentQuizIndex((prev) => prev + 1);
    } else {
      finishQuiz();
    }
  };

  return (
    <Screen title="Vocabulary Master" subtitle={userProfileTitle}>
      {/* Dynamic Tab Bar - Fixed Spacing & Zero Overlap */}
      <View style={[styles.tabContainer, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'list' && styles.tabButtonActive]}
          onPress={() => setActiveTab('list')}
        >
          <Ionicons
            name="book-outline"
            size={16}
            color={activeTab === 'list' ? '#FFFFFF' : isDark ? '#94A3B8' : '#475569'}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.tabButtonText,
              { color: isDark ? '#94A3B8' : '#475569' },
              activeTab === 'list' && styles.tabButtonTextActive,
            ]}
          >
            My List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'flashcards' && styles.tabButtonActive]}
          onPress={() => {
            if (!filteredItems.length) {
              Alert.alert('No Words', 'Save vocabulary words to practice 3D flashcards.');
              return;
            }
            setCurrentCardIndex(0);
            setFlipped(false);
            flipAnimation.setValue(0);
            setActiveTab('flashcards');
          }}
        >
          <Ionicons
            name="albums-outline"
            size={16}
            color={activeTab === 'flashcards' ? '#FFFFFF' : isDark ? '#94A3B8' : '#475569'}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.tabButtonText,
              { color: isDark ? '#94A3B8' : '#475569' },
              activeTab === 'flashcards' && styles.tabButtonTextActive,
            ]}
          >
            3D Cards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'quiz' && styles.tabButtonActive]}
          onPress={startQuiz}
        >
          <Ionicons
            name="trophy-outline"
            size={16}
            color={activeTab === 'quiz' ? '#FFFFFF' : isDark ? '#94A3B8' : '#475569'}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.tabButtonText,
              { color: isDark ? '#94A3B8' : '#475569' },
              activeTab === 'quiz' && styles.tabButtonTextActive,
            ]}
          >
            AI Quiz
          </Text>
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          TAB 1: MY LIST (WORD BANK WITH SAMPLE EXAMPLES & FAVORITE STARS)
      ========================================================================= */}
      {activeTab === 'list' && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Add Word Box */}
          <LinearGradient
            colors={isDark ? ['#1E1B4B', '#312E81'] : ['#EEF2FF', '#E0E7FF']}
            style={[styles.addCardGradient, { borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#C7D2FE' }]}
          >
            <View style={styles.addHeaderRow}>
              <View style={styles.addTitleWithIcon}>
                <Ionicons name="sparkles" size={18} color="#6366F1" />
                <Text style={[styles.sectionHeaderTitle, { color: isDark ? '#FFFFFF' : '#1E1B4B' }]}>
                  AI Word Lookup & Add
                </Text>
              </View>
              <Text style={styles.xpBadge}>+10 XP</Text>
            </View>

            <Text style={[styles.addSubtitle, { color: isDark ? '#C7D2FE' : '#4338CA' }]}>
              Type any English word. SpeakMate AI automatically analyzes meaning, part of speech, and examples.
            </Text>

            <View style={styles.addInputRow}>
              <TextInput
                style={[
                  styles.addInput,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                  },
                ]}
                placeholder="e.g. Eloquent, Resilient, Tenacious..."
                value={word}
                onChangeText={setWord}
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addWord}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Ionicons name={saving ? 'hourglass-outline' : 'add'} size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Search and Filters */}
          <View style={styles.searchFilterContainer}>
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholder="Search words, meanings..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Pills */}
            <View style={styles.filterPillsRow}>
              {[
                { key: 'all', label: `All Words (${userWords.length})` },
                { key: 'favorites', label: '⭐ Favorites' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                    },
                    filterType === f.key && styles.filterPillActive,
                  ]}
                  onPress={() => setFilterType(f.key)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: isDark ? '#94A3B8' : '#475569' },
                      filterType === f.key && styles.filterPillTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Word List with Favorite Stars & Audio */}
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={54} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Words Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Add custom words above using the AI word lookup bar!
              </Text>
            </View>
          ) : (
            filteredItems.map((item, idx) => (
              <Card
                key={item.id || idx}
                style={[
                  styles.wordCard,
                  {
                    backgroundColor: isDark ? theme.cardBg : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.wordHeaderRow}>
                  <View style={styles.wordTitleCol}>
                    <View style={styles.wordBadgeRow}>
                      <Text style={[styles.wordText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {item.word}
                      </Text>
                      {item.partOfSpeech ? (
                        <View style={[styles.posBadge, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
                          <Text style={[styles.posBadgeText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                            {item.partOfSpeech}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      onPress={() => playWordPronunciation(item.word)}
                      style={[styles.actionBtn, { backgroundColor: isDark ? '#334155' : '#EEF2FF' }]}
                    >
                      <Ionicons name="volume-high" size={18} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(item)}
                      style={[styles.actionBtn, { backgroundColor: isDark ? '#334155' : '#FEF3C7' }]}
                    >
                      <Ionicons
                        name={item.favorite ? 'star' : 'star-outline'}
                        size={18}
                        color={item.favorite ? '#F59E0B' : theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.meaningText, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                  {item.meaning}
                </Text>

                {item.example ? (
                  <View
                    style={[
                      styles.exampleBox,
                      {
                        backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                      },
                    ]}
                  >
                    <Text style={[styles.exampleLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      EXAMPLE
                    </Text>
                    <Text style={[styles.exampleText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                      "{item.example}"
                    </Text>
                  </View>
                ) : null}

                {item.synonym && item.synonym !== 'None' ? (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#E2E8F0' }}>
                    <View style={styles.synonymsRow}>
                      <Text style={[styles.synonymLabel, { color: theme.textSecondary }]}>Synonym: </Text>
                      <Text style={[styles.synonymText, { color: '#10B981' }]}>{item.synonym}</Text>
                    </View>
                  </View>
                ) : null}
              </Card>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* =========================================================================
          TAB 2: PREMIUM ANIMATED 3D FLASHCARDS (TRUE PHYSICAL FLIP & INTERACTION)
      ========================================================================= */}
      {activeTab === 'flashcards' && currentCard && (
        <ScrollView contentContainerStyle={styles.flashcardContainer} showsVerticalScrollIndicator={false}>
          {/* Card Counter & Favorite Star Header */}
          <View style={styles.flashcardHeader}>
            <View style={[styles.counterBadge, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
              <Text style={[styles.counterBadgeText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                CARD {currentCardIndex + 1} OF {filteredItems.length}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleFavorite(currentCard)}
              style={[
                styles.flashcardStarBtn,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
              accessibilityLabel="Toggle Favorite"
            >
              <Ionicons
                name={currentCard.favorite ? 'star' : 'star-outline'}
                size={22}
                color={currentCard.favorite ? '#F59E0B' : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${((currentCardIndex + 1) / Math.max(1, filteredItems.length)) * 100}%` },
              ]}
            />
          </View>

          {/* 3D Physical Flashcard Container with Stacked Depth Bevel */}
          <View style={styles.cardPerspectiveContainer}>
            {/* Background Physical Layer Shadow (Gives Card Authentic Elevation) */}
            <View
              style={[
                styles.cardLayerBacking,
                {
                  backgroundColor: isDark ? '#0F172A' : '#E2E8F0',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                },
              ]}
            />

            <Animated.View style={[{ transform: [{ scale: pressScale }] }]}>
              <TouchableOpacity
                activeOpacity={0.94}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleCardTap}
                style={styles.cardTouchWrapper}
                accessibilityRole="button"
                accessibilityLabel={
                  flipped
                    ? `Flashcard back side for ${currentCard.word}. Meaning: ${currentCard.meaning}. Tap to flip back.`
                    : `Flashcard front side for ${currentCard.word}. Tap to reveal meaning.`
                }
              >
                {/* ─────────────────────────────────────────────────────────────
                    FRONT OF CARD: CLEAN WORD + PROMINENT SPEAKER + TAP TO REVEAL
                    ───────────────────────────────────────────────────────────── */}
                <Animated.View
                  style={[
                    styles.flashcard3D,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#4338CA' : '#C7D2FE',
                    },
                    {
                      transform: [{ rotateY: frontInterpolate }],
                      opacity: frontOpacity,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
                    style={styles.cardInnerGradient}
                  >
                    {/* Top Row: Part of Speech + Isolated Speaker Button */}
                    <View style={styles.cardTopRow}>
                      <View
                        style={[
                          styles.posBadgeElevated,
                          { backgroundColor: isDark ? '#312E81' : '#EEF2FF', borderColor: isDark ? '#4338CA' : '#C7D2FE' },
                        ]}
                      >
                        <Text style={[styles.posBadgeTextElevated, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                          {currentCard.partOfSpeech || 'VOCABULARY'}
                        </Text>
                      </View>

                      {/* Speaker with Pulse Speaking Animation */}
                      <TouchableOpacity
                        onPress={handleSpeakerTap}
                        activeOpacity={0.75}
                        style={styles.speakerBtnTouchable}
                        accessibilityLabel="Play pronunciation"
                      >
                        <Animated.View
                          style={[
                            styles.audioPulseBtn,
                            isSpeaking && styles.audioPulseBtnActive,
                            { transform: [{ scale: speakerPulse }] },
                          ]}
                        >
                          <Ionicons
                            name={isSpeaking ? 'volume-high' : 'volume-medium'}
                            size={20}
                            color="#FFFFFF"
                          />
                        </Animated.View>
                      </TouchableOpacity>
                    </View>

                    {/* Center: Extra Large High-Contrast Vocabulary Word */}
                    <View style={styles.cardCenterContent}>
                      <Text
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        style={[styles.frontWordText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                      >
                        {currentCard.word}
                      </Text>
                    </View>

                    {/* Bottom: Clear Physical Tap Instruction */}
                    <View
                      style={[
                        styles.cardBottomInstruction,
                        { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' },
                      ]}
                    >
                      <Ionicons name="swap-horizontal" size={16} color="#6366F1" />
                      <Text style={[styles.tapToFlipText, { color: isDark ? '#94A3B8' : '#475569' }]}>
                        Tap card to reveal meaning
                      </Text>
                    </View>
                  </LinearGradient>
                </Animated.View>

                {/* ─────────────────────────────────────────────────────────────
                    BACK OF CARD: DEFINITION + EXAMPLE + TAP TO FLIP BACK
                    ───────────────────────────────────────────────────────────── */}
                <Animated.View
                  style={[
                    styles.flashcard3D,
                    styles.flashcardBack,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#4338CA' : '#C7D2FE',
                    },
                    {
                      transform: [{ rotateY: backInterpolate }],
                      opacity: backOpacity,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
                    style={styles.cardInnerGradient}
                  >
                    {/* Top Row: Word in secondary position + Isolated Speaker Button */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.backWordRow}>
                        <Text style={[styles.backWordTitle, { color: '#6366F1' }]}>{currentCard.word}</Text>
                        {currentCard.partOfSpeech ? (
                          <View style={[styles.posBadgeSmall, { backgroundColor: isDark ? '#312E81' : '#EEF2FF', borderColor: isDark ? '#4338CA' : '#C7D2FE' }]}>
                            <Text style={[styles.posBadgeTextSmall, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                              {currentCard.partOfSpeech}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Speaker with Pulse Speaking Animation */}
                      <TouchableOpacity
                        onPress={handleSpeakerTap}
                        activeOpacity={0.75}
                        style={styles.speakerBtnTouchable}
                        accessibilityLabel="Play meaning"
                      >
                        <Animated.View
                          style={[
                            styles.audioPulseBtn,
                            isSpeaking && styles.audioPulseBtnActive,
                            { transform: [{ scale: speakerPulse }] },
                          ]}
                        >
                          <Ionicons
                            name={isSpeaking ? 'volume-high' : 'volume-medium'}
                            size={20}
                            color="#FFFFFF"
                          />
                        </Animated.View>
                      </TouchableOpacity>
                    </View>

                    {/* Center: Structured Definition & Contextual Example */}
                    <ScrollView style={styles.backScrollContent} showsVerticalScrollIndicator={false}>
                      <View
                        style={[
                          styles.backDefinitionCard,
                          {
                            backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                          },
                        ]}
                      >
                        <View style={styles.sectionHeaderIconRow}>
                          <Ionicons name="book-outline" size={14} color="#6366F1" />
                          <Text style={[styles.backDefinitionLabel, { color: isDark ? '#818CF8' : '#4F46E5' }]}>
                            MEANING & DEFINITION
                          </Text>
                        </View>
                        <Text style={[styles.backMeaningText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {currentCard.meaning}
                        </Text>
                      </View>

                      {currentCard.example ? (
                        <View
                          style={[
                            styles.backExampleCard,
                            {
                              backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
                              borderColor: isDark ? '#4338CA' : '#C7D2FE',
                            },
                          ]}
                        >
                          <View style={styles.sectionHeaderIconRow}>
                            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#6366F1" />
                            <Text style={[styles.backExampleLabel, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                              EXAMPLE IN CONTEXT
                            </Text>
                          </View>
                          <Text style={[styles.backExampleText, { color: isDark ? '#E0E7FF' : '#3730A3' }]}>
                            "{currentCard.example}"
                          </Text>
                        </View>
                      ) : null}

                      {currentCard.synonym && currentCard.synonym !== 'None' ? (
                        <View style={[styles.backSynonymCard, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5', borderColor: isDark ? '#047857' : '#A7F3D0' }]}>
                          <Text style={[styles.backSynonymLabel, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                            🌿 SYNONYM: <Text style={{ fontWeight: '800' }}>{currentCard.synonym}</Text>
                          </Text>
                        </View>
                      ) : null}
                    </ScrollView>

                    {/* Bottom: Clear Reverse Tap Instruction */}
                    <View
                      style={[
                        styles.cardBottomInstruction,
                        { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' },
                      ]}
                    >
                      <Ionicons name="swap-horizontal" size={16} color="#6366F1" />
                      <Text style={[styles.tapToFlipText, { color: isDark ? '#94A3B8' : '#475569' }]}>
                        Tap card to hear word & flip back
                      </Text>
                    </View>
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Navigation Controls */}
          <View style={styles.navControlsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={prevCard}
              style={[
                styles.navBtn,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
              accessibilityLabel="Previous Card"
            >
              <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={nextCard}
              style={[styles.navBtn, styles.navBtnPrimary]}
              accessibilityLabel="Next Card"
            >
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* =========================================================================
          TAB 3: NEXT-LEVEL MULTI-FORMAT HIGH-ACCURACY AI QUIZ
      ========================================================================= */}
      {activeTab === 'quiz' && (
        <ScrollView contentContainerStyle={styles.quizContainer} showsVerticalScrollIndicator={false}>
          {!quizFinished && quizQuestions.length > 0 && (
            <View style={{ width: '100%' }}>
              {/* Question Progress & Live Streak Header */}
              <View style={styles.quizProgressHeader}>
                <Text style={[styles.quizStepText, { color: theme.textSecondary }]}>
                  QUESTION {currentQuizIndex + 1} OF {quizQuestions.length}
                </Text>
                <View style={styles.quizHeaderBadges}>
                  {streakCount >= 2 && (
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakBadgeText}>🔥 {streakCount} Streak!</Text>
                    </View>
                  )}
                  <Text style={[styles.quizLiveScore, { color: '#6366F1' }]}>
                    Score: {quizScore} / {quizQuestions.length}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` },
                  ]}
                />
              </View>

              {/* Multi-Format Question Card */}
              <LinearGradient
                colors={isDark ? ['#1E1B4B', '#312E81'] : ['#EEF2FF', '#E0E7FF']}
                style={[
                  styles.quizQuestionCard,
                  { borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#C7D2FE' },
                ]}
              >
                <View style={styles.quizQuestionHeaderRow}>
                  <View style={styles.quizFormatBadge}>
                    <Text style={styles.quizFormatBadgeText}>{quizQuestions[currentQuizIndex]?.questionBadge}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => playWordPronunciation(quizQuestions[currentQuizIndex]?.promptTitle)}
                    style={styles.audioPulseBtnSmall}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="volume-high" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.quizPromptTitle, { color: isDark ? '#FFFFFF' : '#1E1B4B' }]}>
                  {quizQuestions[currentQuizIndex]?.promptTitle}
                </Text>

                {quizQuestions[currentQuizIndex]?.promptSubtitle ? (
                  <Text style={[styles.quizPromptSubtitle, { color: isDark ? '#C7D2FE' : '#4338CA' }]}>
                    {quizQuestions[currentQuizIndex]?.promptSubtitle}
                  </Text>
                ) : null}
              </LinearGradient>

              {/* Options */}
              <View style={styles.quizOptionsList}>
                {quizQuestions[currentQuizIndex]?.options.map((option, idx) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = option === quizQuestions[currentQuizIndex]?.correctAnswer;
                  let optStyle = [
                    styles.quizOptionBtn,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ];

                  if (selectedAnswer !== null) {
                    if (isCorrect) {
                      optStyle.push(styles.quizOptionCorrect);
                    } else if (isSelected && !isCorrect) {
                      optStyle.push(styles.quizOptionWrong);
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      style={optStyle}
                      disabled={selectedAnswer !== null}
                      onPress={() => submitQuizAnswer(option)}
                    >
                      <View
                        style={[
                          styles.optLetterBadge,
                          { backgroundColor: isDark ? '#312E81' : '#EEF2FF' },
                          isSelected && isCorrect && { backgroundColor: '#10B981' },
                          isSelected && !isCorrect && { backgroundColor: '#EF4444' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optLetterText,
                            { color: isDark ? '#A5B4FC' : '#4F46E5' },
                            isSelected && { color: '#FFFFFF' },
                          ]}
                        >
                          {String.fromCharCode(65 + idx)}
                        </Text>
                      </View>
                      <Text style={[styles.quizOptionText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {option}
                      </Text>
                      {selectedAnswer !== null && isCorrect && (
                        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                      )}
                      {selectedAnswer !== null && isSelected && !isCorrect && (
                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Instant Explanation Box on Answer */}
              {selectedAnswer !== null && (
                <View
                  style={[
                    styles.explanationCard,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                      borderColor: isDark ? '#334155' : '#BFDBFE',
                    },
                  ]}
                >
                  <View style={styles.explanationHeader}>
                    <Ionicons name="information-circle" size={18} color="#3B82F6" />
                    <Text style={styles.explanationTitle}>Word Context & Definition</Text>
                  </View>
                  <Text style={[styles.explanationMeaning, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    <Text style={{ fontWeight: '800' }}>{quizQuestions[currentQuizIndex]?.targetWord}:</Text>{' '}
                    {quizQuestions[currentQuizIndex]?.meaning}
                  </Text>
                  {quizQuestions[currentQuizIndex]?.example ? (
                    <Text style={[styles.explanationExample, { color: isDark ? '#94A3B8' : '#475569' }]}>
                      "{quizQuestions[currentQuizIndex]?.example}"
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Next Question / Finish Button */}
              {selectedAnswer !== null && (
                <TouchableOpacity
                  style={styles.quizNextBtn}
                  onPress={nextQuizQuestion}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quizNextBtnText}>
                    {currentQuizIndex < quizQuestions.length - 1 ? 'Next Question →' : 'View Results 🎉'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* QUIZ FINISHED CELEBRATION WITH MISTAKE REVIEW */}
          {quizFinished && (
            <Card
              style={[
                styles.celebrationCard,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.trophyCircle}>
                <Ionicons name="trophy" size={48} color="#F59E0B" />
              </View>
              <Text style={[styles.celebTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Quiz Completed!
              </Text>
              <Text style={[styles.celebSubtitle, { color: theme.textSecondary }]}>
                You answered <Text style={{ fontWeight: '800', color: '#6366F1' }}>{quizScore}</Text> of{' '}
                {quizQuestions.length} correctly!
              </Text>

              {/* XP Breakdown Box */}
              <View style={styles.rewardXpBox}>
                <Text style={styles.rewardXpText}>+{earnedXP} XP Earned ✨</Text>
              </View>

              {/* Mistakes Review Toggle */}
              {mistakesList.length > 0 ? (
                <TouchableOpacity
                  style={[styles.mistakesToggleBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
                  onPress={() => setShowMistakes(!showMistakes)}
                >
                  <Text style={[styles.mistakesToggleText, { color: theme.textPrimary }]}>
                    {showMistakes ? 'Hide Mistakes Review ▲' : `Review ${mistakesList.length} Mistakes ▼`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.perfectScoreText, { color: '#10B981' }]}>🌟 100% Perfect Accuracy! 🌟</Text>
              )}

              {/* Mistakes Review Content */}
              {showMistakes && mistakesList.length > 0 && (
                <View style={styles.mistakesContainer}>
                  {mistakesList.map((m, i) => (
                    <View
                      key={i}
                      style={[
                        styles.mistakeItem,
                        {
                          backgroundColor: isDark ? '#1E293B' : '#FEF2F2',
                          borderColor: isDark ? '#7F1D1D' : '#FCA5A5',
                        },
                      ]}
                    >
                      <Text style={[styles.mistakeWord, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {m.targetWord}
                      </Text>
                      <Text style={styles.mistakeWrongText}>Your Answer: {m.userAnswer}</Text>
                      <Text style={styles.mistakeCorrectText}>Correct: {m.correctAnswer}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.retakeBtn} onPress={startQuiz} activeOpacity={0.85}>
                <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.retakeBtnText}>Retake Quiz with New Questions</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backToListBtn} onPress={() => setActiveTab('list')}>
                <Text style={[styles.backToListBtnText, { color: theme.textSecondary }]}>Back to Word Bank</Text>
              </TouchableOpacity>
            </Card>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

// =========================================================================
// ULTRA-CLEAN STYLESHEET (MOBILE APP)
// =========================================================================
const styles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 16 },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Add Card Gradient
  addCardGradient: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
  },
  addHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  xpBadge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addSubtitle: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  // Search & Filter
  searchFilterContainer: {
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Word Cards
  wordCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  wordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordTitleCol: {
    flex: 1,
  },
  wordBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordText: {
    fontSize: 18,
    fontWeight: '800',
  },
  posBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  posBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meaningText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  exampleBox: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  exampleLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  exampleText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    fontWeight: '500',
  },
  synonymsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  synonymLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  synonymText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // =========================================================================
  // FLASHCARDS TAB - PREMIUM 3D PHYSICAL DEPTH
  // =========================================================================
  flashcardContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
    paddingBottom: 40,
  },
  flashcardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: CARD_WIDTH,
    marginBottom: 8,
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  counterBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  flashcardStarBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  progressBarBg: {
    width: CARD_WIDTH,
    height: 6,
    borderRadius: 3,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },

  // Physical Perspective Bevel
  cardPerspectiveContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLayerBacking: {
    position: 'absolute',
    width: CARD_WIDTH - 12,
    height: CARD_HEIGHT,
    borderRadius: 26,
    borderWidth: 1,
    top: 6,
    opacity: 0.7,
  },
  cardTouchWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  flashcard3D: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    borderWidth: 1.5,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  flashcardBack: {
    position: 'absolute',
    top: 0,
  },
  cardInnerGradient: {
    flex: 1,
    padding: 22,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  posBadgeElevated: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  posBadgeTextElevated: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  speakerBtnTouchable: {
    padding: 4,
  },
  audioPulseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  audioPulseBtnActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  audioPulseBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  frontWordText: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  cardBottomInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  tapToFlipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Back of Card Styles
  backWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backWordTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  posBadgeSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  posBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  backScrollContent: {
    flex: 1,
    marginVertical: 12,
  },
  sectionHeaderIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  backDefinitionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  backDefinitionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  backMeaningText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  backExampleCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  backExampleLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  backExampleText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    fontWeight: '600',
  },
  backSynonymCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  backSynonymLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Navigation Controls
  navControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  navBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnPrimary: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // Quiz Tab
  quizContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  quizProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quizStepText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quizHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  streakBadgeText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '800',
  },
  quizLiveScore: {
    fontSize: 13,
    fontWeight: '800',
  },
  quizQuestionCard: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
  },
  quizQuestionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quizFormatBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quizFormatBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  quizPromptTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  quizPromptSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  quizOptionsList: {
    gap: 10,
    marginBottom: 16,
  },
  quizOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  optLetterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optLetterText: {
    fontWeight: '800',
    fontSize: 13,
  },
  quizOptionText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  quizOptionCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  quizOptionWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  explanationCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  explanationTitle: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },
  explanationMeaning: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  explanationExample: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  quizNextBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  quizNextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Celebration Card
  celebrationCard: {
    padding: 26,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
  },
  trophyCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  celebTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  celebSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  rewardXpBox: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 16,
  },
  rewardXpText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  perfectScoreText: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },
  mistakesToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 14,
  },
  mistakesToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mistakesContainer: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  mistakeItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  mistakeWord: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  mistakeWrongText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  mistakeCorrectText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  retakeBtn: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  backToListBtn: {
    paddingVertical: 8,
  },
  backToListBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
