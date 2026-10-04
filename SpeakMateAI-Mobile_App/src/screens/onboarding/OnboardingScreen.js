import React, { useContext, useRef, useState, useEffect } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onboardingService,
  settingsService,
  profileService,
} from '../../services/appServices';
import { OnboardingVoiceService } from '../../services/OnboardingVoiceService';
import { VoiceService } from '../../services/VoiceService';
import { PrimaryButton, ErrorMessage } from '../../components/auth';
import { prepareAvatarAsync, AVATAR_CATEGORIES } from '../../utils/imageUtils';
import { DashboardCache, CurriculumCache } from '../../utils/dashboardCache';

const { width } = Dimensions.get('window');

// ─── Constants ───
const LANGUAGES = [
  { key: 'English', label: 'English', flag: '🇬🇧' },
  { key: 'Hindi', label: 'Hindi', flag: '🇮🇳' },
  { key: 'Marathi', label: 'Marathi', flag: '🇮🇳' },
  { key: 'Spanish', label: 'Spanish', flag: '🇪🇸' },
  { key: 'French', label: 'French', flag: '🇫🇷' },
  { key: 'German', label: 'German', flag: '🇩🇪' },
  { key: 'Japanese', label: 'Japanese', flag: '🇯🇵' },
];

const VOICES = [
  { key: 'Friendly', label: 'Friendly', gender: 'Female', icon: 'chatbubble-ellipses-outline' },
  { key: 'Professional', label: 'Professional', gender: 'Female', icon: 'briefcase-outline' },
  { key: 'Energetic', label: 'Energetic', gender: 'Female', icon: 'flash-outline' },
  { key: 'Calm', label: 'Calm', gender: 'Female', icon: 'rainy-outline' },
  { key: 'Teacher', label: 'Teacher', gender: 'Female', icon: 'school-outline' },
  { key: 'Native Speaker', label: 'Native Speaker', gender: 'Female', icon: 'earth-outline' },
];

const GOALS = [
  { key: 'Career', label: 'Career Advancement', icon: 'trending-up-outline' },
  { key: 'Interview', label: 'Job Interviews', icon: 'document-text-outline' },
  { key: 'Study', label: 'Academic Studies', icon: 'book-outline' },
  { key: 'Travel', label: 'Travel & Exploration', icon: 'airplane-outline' },
  { key: 'Business', label: 'Business & Networking', icon: 'briefcase-outline' },
  { key: 'Communication', label: 'Daily Communication', icon: 'chatbubbles-outline' },
  { key: 'Exam', label: 'English Exams (IELTS/TOEFL)', icon: 'ribbon-outline' },
  { key: 'Fun', label: 'Self-Improvement & Fun', icon: 'happy-outline' },
];

const LEVELS = [
  { key: 'Beginner', label: 'Beginner', desc: 'No prior experience or basic vocabulary', rating: 'A1' },
  { key: 'Elementary', label: 'Elementary', desc: 'Understand simple sentences & expressions', rating: 'A2' },
  { key: 'Intermediate', label: 'Intermediate', desc: 'Describe experiences and speak with minor mistakes', rating: 'B1/B2' },
  { key: 'Advanced', label: 'Advanced', desc: 'Express ideas fluently & spontaneously', rating: 'C1' },
  { key: 'Fluent', label: 'Fluent', desc: 'Completely fluent, close to native proficiency', rating: 'C2' },
];

const SCHOOL_GRADES = [
  { key: '1st Std', label: '1st Standard', desc: 'Alphabet phonics, colors, animals & simple greetings', icon: 'color-palette-outline' },
  { key: '2nd Std', label: '2nd Standard', desc: 'Classroom items, daily routines, food & hobbies', icon: 'ice-cream-outline' },
  { key: '3rd Std', label: '3rd Standard', desc: 'Action verbs, community helpers, time & past stories', icon: 'medkit-outline' },
  { key: '4th Std', label: '4th Standard', desc: 'Describing places, canteen lunch, healthy habits & directions', icon: 'planet-outline' },
  { key: '5th Std', label: '5th Standard', desc: 'First day in 5th grade, science projects & story reviews', icon: 'school-outline' },
  { key: '6th Std', label: '6th Standard', desc: 'Asking teacher questions, school clubs & sports day', icon: 'create-outline' },
  { key: '7th Std', label: '7th Standard', desc: 'Group discussions, environmental care & movie reviews', icon: 'water-outline' },
  { key: '8th Std', label: '8th Standard', desc: 'School debates, student council & tech innovations', icon: 'chatbubbles-outline' },
  { key: '9th Std', label: '9th Standard', desc: 'High school admission interviews & keynote speeches', icon: 'globe-outline' },
  { key: '10th Std', label: '10th Standard', desc: '10th Board oral exam prep & career roadmaps', icon: 'document-text-outline' },
];

const INTERESTS = [
  { key: 'Technology', label: 'Technology', icon: 'desktop-outline' },
  { key: 'Business', label: 'Business', icon: 'business-outline' },
  { key: 'Movies', label: 'Movies & TV', icon: 'film-outline' },
  { key: 'Gaming', label: 'Gaming', icon: 'game-controller-outline' },
  { key: 'Sports', label: 'Sports', icon: 'football-outline' },
  { key: 'Travel', label: 'Travel', icon: 'compass-outline' },
  { key: 'Programming', label: 'Programming', icon: 'code-slash-outline' },
  { key: 'Finance', label: 'Finance', icon: 'wallet-outline' },
  { key: 'Music', label: 'Music', icon: 'musical-notes-outline' },
  { key: 'Cooking', label: 'Cooking', icon: 'restaurant-outline' },
  { key: 'Health', label: 'Health & Fitness', icon: 'heart-outline' },
  { key: 'Science', label: 'Science', icon: 'flask-outline' },
  { key: 'Books', label: 'Books & Lit', icon: 'journal-outline' },
  { key: 'Daily Conversation', label: 'Daily Chat', icon: 'chatbox-ellipses-outline' },
];

const SOURCES = [
  { key: 'Google', label: 'Google Search', icon: 'logo-google' },
  { key: 'LinkedIn', label: 'LinkedIn', icon: 'logo-linkedin' },
  { key: 'Instagram', label: 'Instagram', icon: 'logo-instagram' },
  { key: 'Friend', label: 'Friend Recommendation', icon: 'people-outline' },
  { key: 'YouTube', label: 'YouTube', icon: 'logo-youtube' },
  { key: 'College', label: 'College / School', icon: 'school-outline' },
  { key: 'Company', label: 'Company Recommendation', icon: 'ribbon-outline' },
  { key: 'Other', label: 'Other Source', icon: 'help-circle-outline' },
];

const DAILY_GOALS = [
  { key: '5 min', label: 'Casual', value: 5 },
  { key: '10 min', label: 'Regular', value: 10 },
  { key: '20 min', label: 'Serious', value: 20 },
  { key: '30 min', label: 'Intense', value: 30 },
  { key: '45 min', label: 'Super Learner', value: 45 },
  { key: '60 min', label: 'Insane', value: 60 },
];

const AGE_GROUPS = [
  { key: 'Kids', label: 'Kids (6-12)', icon: '🎈', desc: 'Fun stories, simple words & games' },
  { key: 'Teens', label: 'Teens (13-17)', icon: '⚡', desc: 'School life, pop culture, gaming & casual chatter' },
  { key: 'Young Adult', label: 'Young Adults (18-24)', icon: '🎓', desc: 'Campus life, travel, socializing & interview prep' },
  { key: 'Professional', label: 'Professionals (25-50)', icon: '💼', desc: 'Business English, executive tone & presentations' },
  { key: 'Senior', label: 'Seniors (50+)', icon: '☕', desc: 'Relaxed conversations, culture & life stories' },
];

const REMINDER_TIMES = [
  { key: 'Morning', label: 'Morning', time: '7:00 AM', icon: 'sunny-outline' },
  { key: 'Afternoon', label: 'Afternoon', time: '12:00 PM', icon: 'partly-sunny-outline' },
  { key: 'Evening', label: 'Evening', time: '6:00 PM', icon: 'moon-outline' },
  { key: 'Night', label: 'Night', time: '9:00 PM', icon: 'star-outline' },
  { key: 'None', label: 'No Reminder', time: '—', icon: 'notifications-off-outline' },
];

export default function OnboardingScreen({ navigation }) {
  const { completeOnboarding, isAuthenticated, user } = useContext(AuthContext);

  // --- Step Tracking state ---
  // Steps: 1=Welcome, 2=Language, 3=Voice, 4=Goals, 5=Level, 6=Interests,
  //        7=HeardAbout, 8=DailyGoal, 9=Accent, 10=Reminder, 11=Avatar, 12=Ready
  const [step, setStep] = useState(isAuthenticated ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- User Selections ---
  const [language, setLanguage] = useState('English');
  const [aiVoice, setAiVoice] = useState('Friendly');
  const [ageGroup, setAgeGroup] = useState('Professional');
  const [schoolGrade, setSchoolGrade] = useState(null);
  const [reminderTime, setReminderTime] = useState('Evening');
  const [whyLearning, setWhyLearning] = useState([]);
  const [level, setLevel] = useState('Intermediate');
  const [interests, setInterests] = useState([]);
  const [heardAbout, setHeardAbout] = useState('Google');
  const [dailyGoal, setDailyGoal] = useState(15);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [customPhoto, setCustomPhoto] = useState(null);
  const [avatarCategory, setAvatarCategory] = useState('illustrated');

  const [accountType, setAccountType] = useState('INDIVIDUAL_USER'); // 'INDIVIDUAL_USER' | 'STUDENT'
  // --- Speech & Voice selection ---
  const [availableVoices, setAvailableVoices] = useState([]);
  
  useEffect(() => {
    async function initOnboardingSpeech() {
      try {
        const storedAccountType = await AsyncStorage.getItem('speakmate_account_type');
        if (storedAccountType) setAccountType(storedAccountType);
        const enVoices = await VoiceService.getAvailableEnglishVoices();
        setAvailableVoices(enVoices);
      } catch (e) {
        // Fallback
      }
    }
    initOnboardingSpeech();
  }, []);

  const selectSystemVoice = (genderSelection) => {
    if (availableVoices.length === 0) return null;

    const isTargetMale = genderSelection.toLowerCase() === 'male';

    // Prioritize standard Google TTS US Female voice 'sfg' for authentic onboarding tutor
    if (!isTargetMale) {
      const sfg = availableVoices.find(v => {
        const id = (v.identifier || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return id.includes('sfg') || name.includes('sfg');
      });
      if (sfg) return sfg.identifier;
    }

    // 1. Try to match by explicit gender property if present
    const match = availableVoices.find(v => v.gender && v.gender.toLowerCase() === (isTargetMale ? 'male' : 'female'));
    if (match) return match.identifier;

    // Indicators for categorization
    const MALE_INDICATORS = [
      'male', 'david', 'daniel', 'george', 'mister', 'guy', 'alex', 'bruce', 'tom',
      'tpf', 'tpc', 'iog', 'nep', 'rjs', 'jcb', 'ndf', 'iol', 'iom'
    ];

    const FEMALE_INDICATORS = [
      'female', 'samantha', 'zira', 'karen', 'hazel', 'siri', 'victoria', 'tessa',
      'sfg', 'rgf', 'cbf', 'lpf', 'fis', 'cxx', 'html', 'aef', 'khf', 'gpf', 'ahp'
    ];

    const getVoiceGender = (voice) => {
      const name = (voice.name || '').toLowerCase();
      const id = (voice.identifier || '').toLowerCase();
      const nameAndId = name + ' ' + id;

      if (FEMALE_INDICATORS.some(indicator => nameAndId.includes(indicator))) {
        return 'female';
      }
      if (MALE_INDICATORS.some(indicator => nameAndId.includes(indicator))) {
        return 'male';
      }
      return 'unknown';
    };

    // 2. Try to find a voice that matches our target gender based on indicators
    const targetVoice = availableVoices.find(v => getVoiceGender(v) === (isTargetMale ? 'male' : 'female'));
    if (targetVoice) return targetVoice.identifier;

    // 3. Fallback: if we want a male voice but found no match, try to find a voice that is NOT explicitly female
    if (isTargetMale) {
      const nonFemaleVoice = availableVoices.find(v => getVoiceGender(v) !== 'female');
      if (nonFemaleVoice) return nonFemaleVoice.identifier;
    } else {
      // If we want a female voice but found no match, try to find a voice that is NOT explicitly male
      const nonMaleVoice = availableVoices.find(v => getVoiceGender(v) !== 'male');
      if (nonMaleVoice) return nonMaleVoice.identifier;
    }

    // 4. Hard fallback to alternate indices if available
    if (isTargetMale && availableVoices.length > 1) {
      return availableVoices[1].identifier;
    }
    return availableVoices[0].identifier;
  };

  // --- Animation Refs ---
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Voice Preview Speech Player
  const [playingVoice, setPlayingVoice] = useState(null);
  useEffect(() => {
    if (playingVoice) {
      let previewText = "Hello! I am your AI English tutor.";
      let options = {
        rate: 1.0,
        pitch: 1.0,
        language: 'en-US',
        onDone: () => setPlayingVoice(null),
        onError: (err) => {
          console.warn("Speech preview error:", err);
          setPlayingVoice(null);
        },
      };

      if (playingVoice === 'Friendly') {
        previewText = "Hello there! I am your friendly AI English tutor. I'm excited to practice English with you!";
        options.pitch = 1.15;
        options.rate = 1.0;
      } else if (playingVoice === 'Professional') {
        previewText = "Hello. I am your professional AI tutor. Let's work together to polish your English communication skills.";
        options.pitch = 0.9;
        options.rate = 0.9;
      } else if (playingVoice === 'Energetic') {
        previewText = "Hey! Ready to level up your English? Let's get started and have some fun!";
        options.pitch = 1.15;
        options.rate = 1.2;
      } else if (playingVoice === 'Calm') {
        previewText = "Welcome. I am your calm AI tutor. We will practice English step by step at your own pace.";
        options.pitch = 0.95;
        options.rate = 0.85;
      } else if (playingVoice === 'Teacher') {
        previewText = "Hello. I am your English teacher. Today we will focus on building your confidence in speaking.";
        options.pitch = 1.05;
        options.rate = 0.95;
      } else if (playingVoice === 'Native Speaker') {
        previewText = "Hey friend! I'm your native speaker tutor. Let's practice speaking naturally and fluently.";
        options.pitch = 1.0;
        options.rate = 1.05;
      }

      // Assign system voice matching preferred gender
      const systemVoiceId = selectSystemVoice('female');
      if (systemVoiceId) {
        options.voice = systemVoiceId;
      }

      try {
        Speech.stop();
        Speech.speak(previewText, options);
      } catch (err) {
        console.warn("Speech invocation failed:", err);
        setPlayingVoice(null);
      }

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      try {
        Speech.stop();
      } catch (err) {
        // ignore
      }
      pulseAnim.setValue(1);
    }

    return () => {
      try {
        Speech.stop();
      } catch (err) {
        // ignore
      }
    };
  }, [playingVoice]);

  // Transition animation helper
  const transitionToNext = (nextStep) => {
    setPlayingVoice(null);
    Speech.stop();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      setError('');
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const isStudentMode = Boolean(
    accountType === 'STUDENT' ||
    user?.accountType === 'STUDENT' ||
    user?.role === 'STUDENT' ||
    user?.isSchoolStudent
  );

  const handleNext = () => {
    if (step === 1) {
      transitionToNext(2);
    } else if (step === 2) {
      transitionToNext(3);
    } else if (step === 3) {
      transitionToNext(4);
    } else if (step === 4) {
      if (whyLearning.length === 0) {
        setError('Please select at least one learning goal.');
        return;
      }
      transitionToNext(5);
    } else if (step === 5) {
      transitionToNext(6);
    } else if (step === 6) {
      transitionToNext(7);
    } else if (step === 7) {
      if (interests.length === 0) {
        setError('Please select at least one interest.');
        return;
      }
      transitionToNext(8);
    } else if (step === 8) {
      transitionToNext(9);
    } else if (step === 9) {
      transitionToNext(10);
    } else if (step === 10) {
      transitionToNext(11);
    } else if (step === 11) {
      transitionToNext(12);
    } else if (step === 12) {
      handleFinishOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      transitionToNext(step - 1);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const mimeType = (asset.mimeType || 'image/jpeg').toLowerCase();
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        Alert.alert('Invalid Format', 'Please choose a JPG, PNG, or WebP image.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Profile image must be 10 MB or less.');
        return;
      }

      try {
        const processed = await prepareAvatarAsync(asset.uri, asset.base64);
        setCustomPhoto(processed.dataUri);
        setSelectedAvatar(processed.dataUri);
      } catch (err) {
        Alert.alert('Compression Error', err.message || 'Could not process selected image.');
      }
    }
  };

  // --- Backend Sync on Finish ---
  const handleFinishOnboarding = async () => {
    setLoading(true);
    setError('');
    try {
      const isStudentMode = Boolean(
        accountType === 'STUDENT' ||
        user?.accountType === 'STUDENT' ||
        user?.role === 'STUDENT' ||
        user?.isSchoolStudent
      );
      const finalGrade = isStudentMode ? (schoolGrade || '1st Std') : null;
      const finalLevel = level || 'Intermediate';
      const finalAgeGroup = isStudentMode ? null : (ageGroup || 'Professional');

      await AsyncStorage.setItem('speakmate_account_type', isStudentMode ? 'STUDENT' : 'INDIVIDUAL_USER');
      if (finalGrade) {
        await AsyncStorage.setItem('speakmate_school_grade', finalGrade);
      } else {
        await AsyncStorage.removeItem('speakmate_school_grade');
      }
      if (finalAgeGroup) {
        await AsyncStorage.setItem('speakmate_age_group', finalAgeGroup);
      }
      if (finalLevel) {
        await AsyncStorage.setItem('speakmate_english_level', finalLevel);
      }
      if (aiVoice) {
        await AsyncStorage.setItem('speakmate_onboarding_voice', aiVoice);
        await AsyncStorage.setItem('speakmate_voice_persona', aiVoice);
      }
      if (dailyGoal) {
        await AsyncStorage.setItem('speakmate_daily_goal', String(dailyGoal));
      }

      DashboardCache.clear();
      CurriculumCache.clear();
      if (finalGrade) CurriculumCache.setGrade(finalGrade);
      if (finalAgeGroup) CurriculumCache.setAgeGroup(finalAgeGroup);
      CurriculumCache.setAccountType(isStudentMode ? 'STUDENT' : 'INDIVIDUAL_USER');

      // 1. Sync onboarding details (Avoids any 404 blockages)
      await onboardingService.update({
        englishLevel: finalLevel,
        schoolGrade: finalGrade,
        learningGoal: (whyLearning && whyLearning.length > 0) ? whyLearning.join(', ') : 'Improve English speaking skills',
        dailyGoalMinutes: parseInt(dailyGoal, 10) || 15,
        nativeLanguage: language || 'English',
        preferredLearningTime: reminderTime || 'Evening',
        interests: (interests && interests.length > 0) ? interests.join(', ') : 'General',
        onboardingCompleted: true,
        preferredVoice: aiVoice || 'Friendly',
        ageGroup: finalAgeGroup,
        studyReminder: reminderTime !== 'None',
      }).catch(err => console.warn('Onboarding sync skipped/failed:', err));

      // 2. Sync settings
      await settingsService.update({
        darkMode: false,
        notificationsEnabled: true,
        language: language || 'English',
        aiVoice: aiVoice || 'Friendly',
        soundEffects: true,
        autoPlayAudio: true,
        dailyReminder: true,
      }).catch(err => console.warn('Settings sync skipped/failed:', err));

      // 3. Save onboarding voice selection + the actual device voice identifier
      try {
        const systemVoiceId = selectSystemVoice('female');
        await OnboardingVoiceService.save(aiVoice || 'Friendly', systemVoiceId);
      } catch (voiceErr) {
        console.warn('Voice save failed:', voiceErr);
      }

      // 4. Save selected avatar to profile
      if (selectedAvatar) {
        await profileService.updateAvatar(selectedAvatar)
          .catch(err => console.warn('Avatar update failed:', err));
      }

      // 5. Mark onboarding complete in client auth context with immediate profile synchronization
      await completeOnboarding({
        englishLevel: finalLevel,
        schoolGrade: finalGrade,
        ageGroup: finalAgeGroup,
        learningGoal: (whyLearning && whyLearning.length > 0) ? whyLearning.join(', ') : 'Improve English speaking skills',
        dailyGoalMinutes: parseInt(dailyGoal, 10) || 15,
        nativeLanguage: language || 'English',
        preferredVoice: aiVoice || 'Friendly',
        interests: (interests && interests.length > 0) ? interests.join(', ') : 'General',
        onboardingCompleted: true,
      });
    } catch (err) {
      console.error('Error finalizing onboarding setup:', err);
      setError('Failed to finalize onboarding setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGoal = (key) => {
    setWhyLearning((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
    if (error) setError('');
  };

  const handleToggleInterest = (key) => {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
    if (error) setError('');
  };

  // Total user-facing steps (Welcome + 11 config steps): 1..12
  const totalSteps = 12;
  const currentStepLabel = step;

  return (
    <SafeAreaView style={styles.container}>
      {/* --- Step progress bar --- */}
      {step > 1 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(currentStepLabel / totalSteps) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Step {currentStepLabel} of {totalSteps}
          </Text>
        </View>
      )}

      {/* --- Main Content Area --- */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              width: '100%',
            }}
          >
            {/* Step 1: Welcome */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.welcomeIllust}>
                  <LinearGradient
                    colors={['#EEF2FF', '#E0E7FF']}
                    style={styles.illustCircle}
                  >
                    <Ionicons name="sparkles-outline" size={72} color="#4F46E5" />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Learn English with AI</Text>
                <Text style={styles.subtitle}>
                  SpeakMateAI is your 24/7 personalized AI English coach. Practice daily, get instant feedback, and speak like a native speaker.
                </Text>
                <TouchableOpacity
                  style={styles.welcomeStartBtn}
                  onPress={handleNext}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#6366F1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    <Text style={styles.welcomeStartText}>Get Started</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.welcomeLoginBtn}
                  onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
                >
                  <Text style={styles.welcomeLoginPrefix}>Already have an account? </Text>
                  <Text style={styles.welcomeLoginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Language */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Learning Language</Text>
                <Text style={styles.subtitle}>Select the language you want to study.</Text>
                <View style={styles.cardList}>
                  {LANGUAGES.map((lang) => (
                    <TouchableOpacity
                      key={lang.key}
                      onPress={() => setLanguage(lang.key)}
                      style={[
                        styles.selectCard,
                        language === lang.key && styles.selectCardActive,
                      ]}
                    >
                      <Text style={styles.flagIcon}>{lang.flag}</Text>
                      <Text style={styles.selectCardLabel}>{lang.label}</Text>
                      {language === lang.key && (
                        <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 3: AI Voice Preview */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Choose AI Voice</Text>
                <Text style={styles.subtitle}>Choose your preferred tutor assistant voice. You can listen to previews.</Text>
                <View style={styles.cardList}>
                  {VOICES.map((voice) => (
                    <TouchableOpacity
                      key={voice.key}
                      onPress={() => {
                        setAiVoice(voice.key);
                        setPlayingVoice(playingVoice === voice.key ? null : voice.key);
                      }}
                      style={[
                        styles.selectCard,
                        aiVoice === voice.key && styles.selectCardActive,
                      ]}
                    >
                      <View style={styles.voiceLeft}>
                        <Ionicons name={voice.icon} size={20} color="#4F46E5" style={styles.voiceIcon} />
                        <View>
                          <Text style={styles.selectCardLabel}>{voice.label}</Text>
                        </View>
                      </View>
                      <View style={styles.voicePlayBtn}>
                        <Animated.View
                          style={{
                            transform: [
                              { scale: playingVoice === voice.key ? pulseAnim : 1 },
                            ],
                          }}
                        >
                          <Ionicons
                            name={playingVoice === voice.key ? 'volume-high-outline' : 'play-circle-outline'}
                            size={24}
                            color="#4F46E5"
                          />
                        </Animated.View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 4: Goals */}
            {step === 4 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Why are you learning?</Text>
                <Text style={styles.subtitle}>Select all reasons that apply to you.</Text>
                {!!error && <ErrorMessage message={error} />}
                <View style={styles.cardList}>
                  {GOALS.map((goal) => {
                    const active = whyLearning.includes(goal.key);
                    return (
                      <TouchableOpacity
                        key={goal.key}
                        onPress={() => handleToggleGoal(goal.key)}
                        style={[
                          styles.selectCard,
                          active && styles.selectCardActive,
                        ]}
                      >
                        <View style={styles.goalLeft}>
                          <Ionicons name={goal.icon} size={20} color="#4F46E5" style={styles.voiceIcon} />
                          <Text style={styles.selectCardLabel}>{goal.label}</Text>
                        </View>
                        {active && (
                          <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 5: English Level (For Both User and Student) */}
            {step === 5 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Select Your English Level</Text>
                <Text style={styles.subtitle}>Choose your current proficiency level in English.</Text>
                <View style={styles.cardList}>
                  {LEVELS.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setLevel(item.key)}
                      style={[
                        styles.selectCardLarge,
                        level === item.key && styles.selectCardLargeActive,
                      ]}
                    >
                      <View style={styles.levelLeft}>
                        <View style={styles.levelRatingBox}>
                          <Text style={styles.levelRatingText}>{item.rating}</Text>
                        </View>
                        <View style={styles.levelInfo}>
                          <Text style={styles.selectCardLabel}>{item.label}</Text>
                          <Text style={styles.levelDesc}>{item.desc}</Text>
                        </View>
                      </View>
                      {level === item.key && (
                        <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 6: School Standard (Student) OR Age Group (Individual User) */}
            {step === 6 && (
              <View style={styles.stepContent}>
                {isStudentMode ? (
                  <>
                    <Text style={styles.title}>Select Your School Standard</Text>
                    <Text style={styles.subtitle}>Choose your current school grade. Your speaking scenarios, AI tutor conversations, and lessons will adapt to this level.</Text>
                    <View style={styles.cardList}>
                      {SCHOOL_GRADES.map((grd) => (
                        <TouchableOpacity
                          key={grd.key}
                          onPress={() => {
                            setSchoolGrade(grd.key);
                            AsyncStorage.setItem('speakmate_school_grade', grd.key);
                          }}
                          style={[
                            styles.selectCardLarge,
                            schoolGrade === grd.key && styles.selectCardLargeActive,
                          ]}
                        >
                          <View style={styles.levelLeft}>
                            <View style={styles.levelRatingBox}>
                              <Ionicons name={grd.icon} size={20} color="#4F46E5" />
                            </View>
                            <View style={styles.levelInfo}>
                              <Text style={styles.selectCardLabel}>{grd.label}</Text>
                              <Text style={styles.levelDesc}>{grd.desc}</Text>
                            </View>
                          </View>
                          {schoolGrade === grd.key && (
                            <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.title}>Select Your Age Group</Text>
                    <Text style={styles.subtitle}>
                      Helps our AI tailor conversational topics, pace, and context for your daily practice.
                    </Text>
                    <View style={styles.cardList}>
                      {AGE_GROUPS.map((grp) => {
                        const active = ageGroup === grp.key;
                        return (
                          <TouchableOpacity
                            key={grp.key}
                            onPress={() => {
                              setAgeGroup(grp.key);
                              AsyncStorage.setItem('speakmate_age_group', grp.key);
                            }}
                            style={[
                              styles.selectCardLarge,
                              active && styles.selectCardLargeActive,
                            ]}
                          >
                            <View style={styles.levelLeft}>
                              <View style={styles.levelRatingBox}>
                                <Text style={{ fontSize: 22 }}>{grp.icon}</Text>
                              </View>
                              <View style={styles.levelInfo}>
                                <Text style={styles.selectCardLabel}>{grp.label}</Text>
                                <Text style={styles.levelDesc}>{grp.desc}</Text>
                              </View>
                            </View>
                            {active && (
                              <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Step 7: Interests */}
            {step === 7 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>What interests you?</Text>
                <Text style={styles.subtitle}>Select topics you enjoy. We use these for AI practice sessions.</Text>
                {!!error && <ErrorMessage message={error} />}
                <View style={styles.interestsGrid}>
                  {INTERESTS.map((interest) => {
                    const active = interests.includes(interest.key);
                    return (
                      <TouchableOpacity
                        key={interest.key}
                        onPress={() => handleToggleInterest(interest.key)}
                        style={[
                          styles.interestChip,
                          active && styles.interestChipActive,
                        ]}
                      >
                        <Ionicons
                          name={interest.icon}
                          size={16}
                          color={active ? '#FFFFFF' : '#4F46E5'}
                        />
                        <Text
                          style={[
                            styles.interestChipText,
                            active && styles.interestChipTextActive,
                          ]}
                        >
                          {interest.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 8: Heard About Us */}
            {step === 8 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Where did you hear about us?</Text>
                <Text style={styles.subtitle}>Help us understand how you discovered SpeakMateAI.</Text>
                <View style={styles.cardList}>
                  {SOURCES.map((src) => (
                    <TouchableOpacity
                      key={src.key}
                      onPress={() => setHeardAbout(src.key)}
                      style={[
                        styles.selectCard,
                        heardAbout === src.key && styles.selectCardActive,
                      ]}
                    >
                      <View style={styles.goalLeft}>
                        <Ionicons name={src.icon} size={20} color="#4F46E5" style={styles.voiceIcon} />
                        <Text style={styles.selectCardLabel}>{src.label}</Text>
                      </View>
                      {heardAbout === src.key && (
                        <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 9: Daily Goal */}
            {step === 9 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Choose Daily Goal</Text>
                <Text style={styles.subtitle}>Consistency is key! Set a daily learning goal to build habits.</Text>
                <View style={styles.cardList}>
                  {DAILY_GOALS.map((goal) => (
                    <TouchableOpacity
                      key={goal.key}
                      onPress={() => setDailyGoal(goal.value)}
                      style={[
                        styles.selectCard,
                        dailyGoal === goal.value && styles.selectCardActive,
                      ]}
                    >
                      <View style={styles.goalLeft}>
                        <Ionicons name="time-outline" size={20} color="#4F46E5" style={styles.voiceIcon} />
                        <Text style={styles.selectCardLabel}>{goal.key} / day</Text>
                      </View>
                      <Text style={styles.goalPillText}>{goal.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 10: Study Reminder */}
            {step === 10 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Daily Reminder</Text>
                <Text style={styles.subtitle}>When should we remind you to practice? Consistency builds fluency.</Text>
                <View style={styles.cardList}>
                  {REMINDER_TIMES.map((reminder) => (
                    <TouchableOpacity
                      key={reminder.key}
                      onPress={() => setReminderTime(reminder.key)}
                      style={[
                        styles.selectCard,
                        reminderTime === reminder.key && styles.selectCardActive,
                      ]}
                    >
                      <View style={styles.goalLeft}>
                        <Ionicons name={reminder.icon} size={20} color="#4F46E5" style={styles.voiceIcon} />
                        <View>
                          <Text style={styles.selectCardLabel}>{reminder.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.goalPillText}>{reminder.time}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 11: Avatar Picker with Categories + Photo Upload */}
            {step === 11 && (
              <View style={styles.stepContent}>
                <Text style={styles.title}>Choose Your Avatar</Text>
                <Text style={styles.subtitle}>Pick a style or upload your own photo.</Text>

                {/* Upload custom photo */}
                <TouchableOpacity style={styles.photoUploadBtn} onPress={handlePickPhoto}>
                  {customPhoto ? (
                    <Image source={{ uri: customPhoto }} style={styles.photoPreview} />
                  ) : (
                    <LinearGradient colors={['#EEF2FF', '#E0E7FF']} style={styles.photoUploadInner}>
                      <Ionicons name="camera-outline" size={28} color="#4F46E5" />
                      <Text style={styles.photoUploadText}>Upload Photo</Text>
                    </LinearGradient>
                  )}
                  {customPhoto && (
                    <View style={styles.photoCheckBadge}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Avatar style category tabs */}
                <View style={styles.avatarCategoryRow}>
                  {AVATAR_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => {
                        setAvatarCategory(cat.key);
                        setCustomPhoto(null);
                      }}
                      style={[
                        styles.avatarCategoryTab,
                        avatarCategory === cat.key && styles.avatarCategoryTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarCategoryTabText,
                          avatarCategory === cat.key && styles.avatarCategoryTabTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Avatar grid */}
                <View style={styles.avatarGrid}>
                  {AVATAR_CATEGORIES.find((c) => c.key === avatarCategory)?.avatars.map((url, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        setSelectedAvatar(url);
                        setCustomPhoto(null);
                      }}
                      style={[
                        styles.avatarCard,
                        selectedAvatar === url && !customPhoto && styles.avatarCardActive,
                      ]}
                    >
                      <Image source={{ uri: url }} style={styles.avatarImg} />
                      {selectedAvatar === url && !customPhoto && (
                        <View style={styles.avatarCheck}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedAvatar(null);
                    setCustomPhoto(null);
                    handleNext();
                  }}
                  style={styles.avatarSkipBtn}
                >
                  <Text style={styles.avatarSkipText}>Skip — Use Initials Avatar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 12: Ready */}
            {step === 12 && (
              <View style={styles.stepContent}>
                <View style={styles.welcomeIllust}>
                  <LinearGradient
                    colors={['#ECFDF5', '#D1FAE5']}
                    style={styles.illustCircle}
                  >
                    <Ionicons name="sparkles" size={72} color="#10B981" />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Your Path is Ready!</Text>
                <Text style={styles.subtitle}>
                  We've initialized your personalized learning program. Ready to achieve fluency? Let's begin!
                </Text>

                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>Your Setup Summary</Text>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>🎯 Target Language:</Text>
                    <Text style={styles.summaryValue}>{language}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>🎤 AI Voice:</Text>
                    <Text style={styles.summaryValue}>{aiVoice}</Text>
                  </View>
                  {!isStudentMode && (
                    <>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>🎈 Age Group:</Text>
                        <Text style={styles.summaryValue}>{ageGroup}</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>📈 English Level:</Text>
                        <Text style={styles.summaryValue}>{level}</Text>
                      </View>
                    </>
                  )}
                  {isStudentMode && (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>🎓 School Standard:</Text>
                      <Text style={styles.summaryValue}>{schoolGrade || '1st Std'}</Text>
                    </View>
                  )}
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>⏱️ Daily Goal:</Text>
                    <Text style={styles.summaryValue}>{dailyGoal} minutes</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>⏰ Reminder:</Text>
                    <Text style={styles.summaryValue}>{REMINDER_TIMES.find(r => r.key === reminderTime)?.time || '—'}</Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- Wizard Navigation Buttons --- */}
      {step > 1 && (
        <View style={styles.footerContainer}>
          {error ? <ErrorMessage message={error} /> : null}
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={loading}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color="#4F46E5" />
            </TouchableOpacity>

            <PrimaryButton
              title={step === 12 ? "Let's Start Learning" : 'Next'}
              onPress={handleNext}
              loading={loading}
              disabled={loading}
              style={styles.nextBtn}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'right',
  },
  keyboardContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stepContent: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
    fontWeight: '500',
  },
  welcomeIllust: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 32,
  },
  illustCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeStartBtn: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 24,
  },
  gradientBtn: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  welcomeStartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  welcomeLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  welcomeLoginPrefix: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeLoginLink: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
  },
  cardList: {
    width: '100%',
    gap: 12,
  },
  selectCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  selectCardActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  selectCardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  flagIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  voiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceIcon: {
    marginRight: 4,
  },
  voiceGender: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  voicePlayBtn: {
    padding: 6,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalPillText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '800',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  selectCardLarge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  selectCardLargeActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  levelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  levelRatingBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelRatingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  levelInfo: {
    flex: 1,
  },
  levelDesc: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 4,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  interestChipActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  interestChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
  interestChipTextActive: {
    color: '#FFFFFF',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    width: '100%',
  },
  avatarCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  avatarCardActive: {
    borderColor: '#4F46E5',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarSkipBtn: {
    marginTop: 32,
    paddingVertical: 12,
  },
  avatarSkipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '800',
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
  },
  nextBtn: {
    flex: 1,
  },
  accentFlag: {
    fontSize: 28,
    lineHeight: 34,
  },
  photoUploadBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  photoUploadInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoUploadText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoCheckBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarCategoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  avatarCategoryTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  avatarCategoryTabActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  avatarCategoryTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  avatarCategoryTabTextActive: {
    color: '#4F46E5',
  },
  avatarCheck: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
