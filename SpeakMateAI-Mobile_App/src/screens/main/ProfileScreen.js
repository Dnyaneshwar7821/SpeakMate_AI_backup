import React, { useCallback, useContext, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppButton, AppInput, Card, Screen, StateView } from '../../components/ui';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { profileService } from '../../services/appServices';
import { authService } from '../../services/authService';
import { getDisplayName } from '../../utils/format';
import { validateName, NAME_VALIDATION_ERROR, normalizeEmail, isValidEmail } from '../../utils/validation';
import { COLORS } from '../../constants/colors';
import { DashboardCache, CurriculumCache } from '../../utils/dashboardCache';
import { AVATAR_LIST, getAvatarById, setCachedAvatarModel } from '../../config/AvatarCatalog';
import { prepareAvatarAsync, isImageUri, AVATAR_CATEGORIES, PRESET_EMOJI_AVATARS } from '../../utils/imageUtils';
import { VoiceService } from '../../services/VoiceService';

const PRESET_AVATARS = PRESET_EMOJI_AVATARS;

const getRankTier = (xp = 0) => {
  if (xp < 100) return { name: 'Bronze III', icon: '🥉', colors: ['#CD7F32', '#A0522D'] };
  if (xp < 300) return { name: 'Bronze II', icon: '🥉', colors: ['#D2691E', '#8B4513'] };
  if (xp < 600) return { name: 'Bronze I', icon: '🥉', colors: ['#CD7F32', '#B8860B'] };
  if (xp < 1000) return { name: 'Silver III', icon: '🥈', colors: ['#94A3B8', '#64748B'] };
  if (xp < 1500) return { name: 'Silver II', icon: '🥈', colors: ['#94A3B8', '#64748B'] };
  if (xp < 2200) return { name: 'Silver I', icon: '🥈', colors: ['#CBD5E1', '#475569'] };
  if (xp < 3000) return { name: 'Gold III', icon: '🥇', colors: ['#F59E0B', '#D97706'] };
  if (xp < 4000) return { name: 'Gold II', icon: '🥇', colors: ['#F59E0B', '#D97706'] };
  if (xp < 5000) return { name: 'Gold I', icon: '🥇', colors: ['#F59E0B', '#D97706'] };
  if (xp < 7000) return { name: 'Platinum Master', icon: '💎', colors: ['#06B6D4', '#0284C7'] };
  return { name: 'Diamond Orator', icon: '👑', colors: ['#8B5CF6', '#6D28D9'] };
};

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useContext(AuthContext);
  const { isDark } = useTheme();
  const { showToast } = useToast();

  const [accountType, setAccountType] = useState(() => user?.accountType || (user?.role === 'STUDENT' ? 'STUDENT' : 'INDIVIDUAL_USER'));
  const isStudent = Boolean(
    accountType === 'STUDENT' ||
    user?.role === 'STUDENT' ||
    user?.accountType === 'STUDENT' ||
    user?.schoolId ||
    user?.schoolCode
  );
  
  const [state, setState] = useState(() => ({
    loading: false,
    error: '',
    profile: user ? {
      ...user,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      avatar: user.avatar,
    } : null,
  }));
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  }));
  const [originalForm, setOriginalForm] = useState(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoErrors, setInfoErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatarCategory, setSelectedAvatarCategory] = useState('emojis');
  const [updatingLevel, setUpdatingLevel] = useState(false);
  const [tutorGender, setTutorGender] = useState('female');
  const [selectedAvatarId, setSelectedAvatarId] = useState('haru');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('Professional');
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [playingTutorId, setPlayingTutorId] = useState(null);

  const playAvatarPreview = async (avatarInput) => {
    const entry = typeof avatarInput === 'object' ? avatarInput : getAvatarById(avatarInput);
    setPlayingTutorId(entry.id);
    try {
      VoiceService.stop();
      const greeting = entry.previewGreeting || `Hello! I'm ${entry.name}, your AI speaking coach. Let's practice speaking English together!`;
      VoiceService.speak(greeting, {
        avatarId: entry.id,
        voiceType: entry.voiceProfile,
        onDone: () => setPlayingTutorId(null),
        onError: () => setPlayingTutorId(null),
      });
    } catch (e) {
      setPlayingTutorId(null);
    }
  };

  // Delete Account Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Explicit OTP Verification State: 'IDLE' | 'OTP_REQUESTED' | 'VERIFYING' | 'VERIFIED' | 'INVALID' | 'EXPIRED'
  const [otpVerificationStatus, setOtpVerificationStatus] = useState('IDLE');
  const [otpVerificationError, setOtpVerificationError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Guards against duplicate / concurrent verification calls
  const isVerifyingRef = useRef(false);
  const lastVerifiedOtpRef = useRef('');
  const resendTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  const handleOpenDeleteModal = () => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setDeleteEmail(user?.email || state.profile?.email || form.email || '');
    setDeleteOtp('');
    setOtpSent(false);
    setSendingOtp(false);
    setDeletingAccount(false);
    setOtpVerificationStatus('IDLE');
    setOtpVerificationError('');
    setResendCooldown(0);
    lastVerifiedOtpRef.current = '';
    isVerifyingRef.current = false;
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    if (deletingAccount) return;
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setShowDeleteModal(false);
    setDeleteOtp('');
    setOtpSent(false);
    setOtpVerificationStatus('IDLE');
    setOtpVerificationError('');
    setResendCooldown(0);
    lastVerifiedOtpRef.current = '';
    isVerifyingRef.current = false;
  };

  const handleEmailChange = (newEmail) => {
    setDeleteEmail(newEmail);
    if (otpSent || otpVerificationStatus !== 'IDLE') {
      setOtpSent(false);
      setDeleteOtp('');
      setOtpVerificationStatus('IDLE');
      setOtpVerificationError('');
      lastVerifiedOtpRef.current = '';
      isVerifyingRef.current = false;
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      setResendCooldown(0);
    }
  };

  const handleSendDeleteOtp = async () => {
    if (sendingOtp || resendCooldown > 0) return;
    const cleanEmail = normalizeEmail(deleteEmail);
    if (!cleanEmail) {
      Alert.alert('Validation Error', 'Please enter your registered email address.');
      return;
    }
    if (!isValidEmail(deleteEmail)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    setSendingOtp(true);
    setOtpVerificationError('');
    try {
      await authService.sendDeleteAccountOtp({ email: cleanEmail });
      setOtpSent(true);
      setDeleteOtp('');
      setOtpVerificationStatus('OTP_REQUESTED');
      lastVerifiedOtpRef.current = '';
      isVerifyingRef.current = false;

      // Start 60-second cooldown timer
      setResendCooldown(60);
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      resendTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(resendTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      Alert.alert(
        'Verification Code Sent 📧',
        `A 6-digit OTP verification code has been sent to ${cleanEmail}. Please check your inbox or spam folder.`
      );
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.userMessage || 'Failed to send deletion OTP. Ensure email is registered.';
      Alert.alert('Send Failed', serverMsg);
    } finally {
      setSendingOtp(false);
    }
  };

  const verifySixDigitOtp = async (codeToVerify) => {
    // Prevent duplicate or concurrent requests
    if (isVerifyingRef.current) return;
    if (lastVerifiedOtpRef.current === codeToVerify && otpVerificationStatus === 'VERIFIED') return;

    const cleanEmail = normalizeEmail(deleteEmail);
    if (!cleanEmail || codeToVerify.length !== 6) return;

    isVerifyingRef.current = true;
    setOtpVerificationStatus('VERIFYING');
    setOtpVerificationError('');

    try {
      await authService.verifyDeleteAccountOtp({ email: cleanEmail, otp: codeToVerify });
      lastVerifiedOtpRef.current = codeToVerify;
      setOtpVerificationStatus('VERIFIED');
      setOtpVerificationError('');
    } catch (err) {
      lastVerifiedOtpRef.current = '';
      const msg = err.response?.data?.message || err.userMessage || 'Invalid verification code. Please try again.';
      if (msg.toLowerCase().includes('expired')) {
        setOtpVerificationStatus('EXPIRED');
      } else {
        setOtpVerificationStatus('INVALID');
      }
      setOtpVerificationError(msg);
    } finally {
      isVerifyingRef.current = false;
    }
  };

  const handleOtpChange = (text) => {
    // Rule 6: Digits only, max 6 digits, no letters, no symbols, no emojis
    const cleanDigits = text.replace(/[^0-9]/g, '').slice(0, 6);
    setDeleteOtp(cleanDigits);

    // If user modifies away from 6 digits, reset verified state
    if (cleanDigits.length < 6) {
      if (otpVerificationStatus !== 'OTP_REQUESTED' && otpVerificationStatus !== 'IDLE') {
        setOtpVerificationStatus('OTP_REQUESTED');
      }
      setOtpVerificationError('');
      lastVerifiedOtpRef.current = '';
      return;
    }

    if (cleanDigits.length === 6) {
      verifySixDigitOtp(cleanDigits);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (otpVerificationStatus !== 'VERIFIED') {
      Alert.alert('Verification Required', 'Please enter and verify the 6-digit OTP code sent to your email before deleting your account.');
      return;
    }

    const cleanEmail = normalizeEmail(deleteEmail);
    const cleanOtp = deleteOtp.trim();

    if (!cleanEmail) {
      Alert.alert('Validation Error', 'Please enter your email address.');
      return;
    }
    if (!cleanOtp || cleanOtp.length !== 6) {
      Alert.alert('Validation Error', 'Please enter the 6-digit OTP code.');
      return;
    }

    Alert.alert(
      'Final Confirmation ⚠️',
      'Are you completely sure you want to delete your SpeakMateAI account? This action is permanent and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await authService.deleteAccount({ email: cleanEmail, otp: cleanOtp });
              await AsyncStorage.removeItem(`speakmate_onboarding_${cleanEmail}`);
              if (resendTimerRef.current) clearInterval(resendTimerRef.current);
              setShowDeleteModal(false);
              Alert.alert(
                'Account Deleted',
                'Your account and all related learning data have been permanently deleted. We are sorry to see you go!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      if (logout) logout();
                    },
                  },
                ]
              );
              setTimeout(() => {
                if (logout) logout();
              }, 1200);
            } catch (err) {
              const serverMsg = err.response?.data?.message || err.userMessage || 'Invalid or expired OTP code.';
              Alert.alert('Deletion Failed', serverMsg);
              setOtpVerificationStatus('INVALID');
              setOtpVerificationError(serverMsg);
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const load = async (silent = false) => {
    if (!silent && !state.profile && !user) {
      setState((curr) => ({ ...curr, loading: true }));
    }
    try {
      const [profile, savedAccType, savedVoice, savedGender, savedAvatarModel, savedAgeGroup, savedGrade] = await Promise.all([
        profileService.get().catch(() => null),
        AsyncStorage.getItem('speakmate_account_type'),
        AsyncStorage.getItem('speakmate_selected_voice'),
        AsyncStorage.getItem('speakmate_voice_gender'),
        AsyncStorage.getItem('speakmate_avatar_model'),
        AsyncStorage.getItem('speakmate_age_group'),
        AsyncStorage.getItem('speakmate_school_grade'),
      ]);
      const loadedForm = {
        firstName: profile?.firstName || user?.firstName || '',
        lastName: profile?.lastName || user?.lastName || '',
        email: profile?.email || user?.email || '',
      };
      setForm(loadedForm);
      setOriginalForm(loadedForm);
      const effectiveAccType = savedAccType || profile?.accountType || user?.accountType || (user?.role === 'STUDENT' ? 'STUDENT' : 'INDIVIDUAL_USER');
      setAccountType(effectiveAccType);
      const isStudentUser = Boolean(
        effectiveAccType === 'STUDENT' ||
        profile?.role === 'STUDENT' ||
        user?.role === 'STUDENT' ||
        profile?.accountType === 'STUDENT' ||
        user?.accountType === 'STUDENT' ||
        user?.schoolId ||
        user?.schoolCode ||
        profile?.schoolId
      );

      if (!isStudentUser) {
        AsyncStorage.removeItem('speakmate_school_grade').catch(() => {});
      }

      let modelId = savedAvatarModel;
      const isMaleVoice = savedGender === 'male' || (savedVoice && savedVoice.toLowerCase().includes('male') && !savedVoice.toLowerCase().includes('female'));

      if (!modelId) {
        modelId = isMaleVoice ? 'chitose' : 'haru';
      }

      const effectiveAvatar = getAvatarById(modelId);
      setSelectedAvatarId(effectiveAvatar.id);
      setTutorGender(effectiveAvatar.gender);
      setCachedAvatarModel(effectiveAvatar.id);

      const effectiveAge = savedAgeGroup || profile?.ageGroup || user?.ageGroup || 'Professional';
      const effectiveGrade = isStudentUser ? (savedGrade || profile?.schoolGrade || user?.schoolGrade || '1st Std') : null;
      setSelectedAgeGroup(effectiveAge);
      const mergedProfile = {
        ...profile,
        accountType: effectiveAccType,
        ageGroup: effectiveAge,
        schoolGrade: effectiveGrade,
      };
      setState({ loading: false, error: '', profile: mergedProfile });
      if (updateUser && mergedProfile) {
        updateUser(mergedProfile);
      }
    } catch (error) {
      const isStudentUser = Boolean(
        user?.accountType === 'STUDENT' ||
        user?.role === 'STUDENT' ||
        user?.schoolId ||
        user?.schoolCode
      );
      const savedAge = await AsyncStorage.getItem('speakmate_age_group').catch(() => null);
      const savedGrd = await AsyncStorage.getItem('speakmate_school_grade').catch(() => null);
      const fallbackAge = savedAge || user?.ageGroup || 'Professional';
      setSelectedAgeGroup(fallbackAge);
      setForm({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
      });
      setState({
        loading: false,
        error: error.userMessage || 'Unable to load profile.',
        profile: {
          ...user,
          accountType: isStudentUser ? 'STUDENT' : 'INDIVIDUAL_USER',
          ageGroup: fallbackAge,
          schoolGrade: isStudentUser ? (savedGrd || user?.schoolGrade || '1st Std') : null,
        }
      });
    }
  };

  const handleSelectTutor = async (avatarInput) => {
    const entry = typeof avatarInput === 'object' ? avatarInput : getAvatarById(avatarInput);
    const model = entry.id;
    const gender = entry.gender;
    const voiceCode = entry.voiceProfile;
    const pitch = entry.defaultPitch;

    setSelectedAvatarId(model);
    setTutorGender(gender);
    setCachedAvatarModel(model);
    try {
      await AsyncStorage.setItem('speakmate_avatar_model', model);
      await AsyncStorage.setItem('speakmate_voice_gender', gender);
      await AsyncStorage.setItem('speakmate_selected_voice', voiceCode);
      await AsyncStorage.setItem('speakmate_ai_voice', voiceCode);
      await AsyncStorage.setItem('speakmate_voice_code', voiceCode);
      await AsyncStorage.setItem('speakmate_voice_pitch', String(pitch));

      showToast('Tutor Updated ✓', 'success', `${entry.emoji} ${entry.name} (${entry.badge}) is active!`);
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [])
  );

  const handleCancelEditInfo = () => {
    if (originalForm) {
      setForm({ ...originalForm });
    } else {
      setForm({
        firstName: state.profile?.firstName || user?.firstName || '',
        lastName: state.profile?.lastName || user?.lastName || '',
        email: state.profile?.email || user?.email || '',
      });
    }
    setInfoErrors({});
    setIsEditingInfo(false);
  };

  const save = async () => {
    const cleanFirstName = form.firstName.trim();
    const cleanLastName = form.lastName.trim();
    const cleanEmail = normalizeEmail(form.email);

    const errors = {};
    if (!cleanFirstName) {
      errors.firstName = 'First name is required.';
    } else if (!validateName(cleanFirstName)) {
      errors.firstName = NAME_VALIDATION_ERROR;
    }

    if (!cleanLastName) {
      errors.lastName = 'Last name is required.';
    } else if (!validateName(cleanLastName)) {
      errors.lastName = NAME_VALIDATION_ERROR;
    }

    if (!cleanEmail) {
      errors.email = 'Email cannot be empty.';
    } else if (!isValidEmail(form.email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (Object.keys(errors).length > 0) {
      setInfoErrors(errors);
      const firstError = Object.values(errors)[0];
      Alert.alert('Validation Error', firstError);
      return;
    }

    setInfoErrors({});

    // Check if email has changed
    const emailChanged = state.profile && state.profile.email && state.profile.email.toLowerCase() !== cleanEmail;

    const executeSave = async () => {
      setSaving(true);
      try {
        const profile = await profileService.update({
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
        });
        const savedForm = {
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
        };
        setState({ loading: false, error: '', profile });
        if (updateUser) updateUser(profile);
        setOriginalForm(savedForm);
        setForm(savedForm);
        setIsEditingInfo(false);
        setInfoErrors({});
        showToast('Profile Updated ✓', 'success', 'Your personal details were saved successfully');
      } catch (error) {
        const data = error.response?.data;
        const fieldMsg = data && typeof data === 'object' && !data.message
          ? (data.firstName || data.lastName || Object.values(data)[0])
          : null;
        showToast('Profile Update Failed', 'error', fieldMsg || data?.message || error.userMessage || 'Unable to update profile.');
      } finally {
        setSaving(false);
      }
    };

    if (emailChanged) {
      Alert.alert(
        'Change Email Address? 📧',
        'Changing your email address updates your login username ID. You will need to use this new email to log in next time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Change Email', onPress: executeSave },
        ]
      );
    } else {
      executeSave();
    }
  };

  // ── Gallery Image Upload ─────────────────────────────────────────────
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showToast('Permission Required', 'warning', 'Please enable gallery access in Settings.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      const mimeType = (asset.mimeType || 'image/jpeg').toLowerCase();
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        showToast('Invalid Format', 'error', 'Please choose a JPG, PNG, or WebP image.');
        return;
      }

      // Initial client-side file size check (max 10 MB for uncompressed selection)
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        showToast('File Too Large', 'error', 'Selected image must be 10 MB or less.');
        return;
      }

      setUploadingPhoto(true);

      // Downsample to 256x256 @ 0.5 JPEG if manipulator available, or use native compressed base64
      let processed;
      try {
        processed = await prepareAvatarAsync(asset.uri, asset.base64);
      } catch (procErr) {
        showToast('Compression Failed', 'error', procErr.message || 'Could not process image.');
        setUploadingPhoto(false);
        return;
      }

      try {
        const updated = await profileService.updateAvatar(processed.dataUri);
        DashboardCache.updateProfileAvatar(processed.dataUri);
        DashboardCache.clear();
        CurriculumCache.clear();
        setState((curr) => ({ ...curr, profile: updated }));
        if (updateUser) updateUser(updated);
        showToast('Photo Updated 📸', 'success', `Avatar updated successfully (${processed.approxKb} KB)!`);
      } catch (uploadError) {
        showToast('Upload Failed', 'error', uploadError.userMessage || 'Unable to update profile photo.');
      } finally {
        setUploadingPhoto(false);
      }
    } catch (e) {
      showToast('Gallery Error', 'error', 'Failed to open the image gallery.');
      setUploadingPhoto(false);
    }
  };

  const handleSelectPresetAvatar = async (avatarItem) => {
    setShowAvatarModal(false);
    setUploadingPhoto(true);
    try {
      const updated = await profileService.updateAvatar(avatarItem);
      DashboardCache.updateProfileAvatar(avatarItem);
      DashboardCache.clear();
      CurriculumCache.clear();
      setState((curr) => ({ ...curr, profile: updated }));
      if (updateUser) updateUser(updated);
      const isEmoji = !isImageUri(avatarItem);
      showToast(
        'Avatar Changed 🎉',
        'success',
        isEmoji ? `Avatar set to ${avatarItem}` : 'Profile avatar updated successfully!'
      );
    } catch (uploadError) {
      showToast('Avatar Update Failed', 'error', uploadError.userMessage || 'Unable to update avatar.');
    } finally {
      setUploadingPhoto(false);
    }
  };



  const handleSelectProficiencyLevel = async (newLevel) => {
    setUpdatingLevel(true);
    try {
      const updated = await profileService.update({
        firstName: form.firstName || user?.firstName,
        lastName: form.lastName || user?.lastName,
        email: form.email || user?.email,
        englishLevel: newLevel,
      });
      DashboardCache.clear();
      CurriculumCache.clear();
      setState((curr) => ({ ...curr, profile: updated }));
      if (updateUser) updateUser(updated);
      showToast('Proficiency Updated 🎯', 'success', `AI Tutor level set to ${newLevel}`);
    } catch (err) {
      showToast('Update Failed', 'error', 'Could not update English proficiency level.');
    } finally {
      setUpdatingLevel(false);
    }
  };

  const handleSelectAgeGroup = async (newAge) => {
    setSelectedAgeGroup(newAge);
    setUpdatingLevel(true);
    try {
      await AsyncStorage.setItem('speakmate_age_group', newAge);
      const updated = await profileService.update({
        firstName: form.firstName || user?.firstName,
        lastName: form.lastName || user?.lastName,
        email: form.email || user?.email,
        ageGroup: newAge,
      });
      await onboardingService.update({ ageGroup: newAge }).catch(() => {});
      DashboardCache.clear();
      CurriculumCache.clear();
      setState((curr) => ({
        ...curr,
        profile: {
          ...curr.profile,
          ...updated,
          ageGroup: newAge,
        }
      }));
      if (updateUser) {
        updateUser({
          ...user,
          ...updated,
          ageGroup: newAge,
        });
      }
      showToast('Age Group Updated 👥', 'success', `Target audience set to ${newAge}`);
    } catch (err) {
      showToast('Update Failed', 'error', 'Could not update Age Group.');
    } finally {
      setUpdatingLevel(false);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of SpeakMateAI?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const avatarValue = state.profile?.avatar || user?.avatar || '🎓';
  const isPhotoUri = isImageUri(avatarValue);

  // Math for Level Progress Bar (500 XP per Level)
  const xp = state.profile?.xp || 0;
  const currentLevel = state.profile?.level || 1;
  const xpInCurrentLevel = xp % 500;
  const levelProgress = xpInCurrentLevel / 500;
  const rankTier = getRankTier(xp);
  const rawGrade = state.profile?.schoolGrade || user?.schoolGrade || state.profile?.standard || user?.standard;
  const formatStandardDisplay = (gradeOrStandard) => {
    if (!gradeOrStandard) return '9th Std';
    const str = String(gradeOrStandard).trim();
    if (!str) return '9th Std';
    if (str.toLowerCase().includes('std')) return str;
    const numMatch = str.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
      return `${num}${suffix} Std`;
    }
    return `${str} Std`;
  };
  const currentSchoolGrade = formatStandardDisplay(rawGrade);
  const currentEnglishLevel = state.profile?.englishLevel || user?.englishLevel || 'Beginner';
  const currentAgeGroup = selectedAgeGroup || state.profile?.ageGroup || user?.ageGroup || 'Professional';
  const normAge = (currentAgeGroup || '').toLowerCase();
  const canAccessRoboPaws = Boolean(
    isStudent ||
    normAge === 'kids' ||
    normAge === 'teens' ||
    normAge.includes('kid') ||
    normAge.includes('teen')
  );

  // Custom colors for dark mode sync
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const labelColor = isDark ? '#F1F5F9' : '#0F172A';
  const sublabelColor = isDark ? '#94A3B8' : '#64748B';
  const dividerColor = isDark ? '#334155' : '#F1F5F9';
  const optionRowBg = isDark ? '#1E293B' : '#FFFFFF';
  const optionBorder = isDark ? '#334155' : '#F1F5F9';

  return (
    <Screen title="Profile" subtitle="Manage your SpeakMateAI account details.">
      <StateView loading={state.loading} error={state.error} onRetry={load}>
        {/* Modernized Profile Header Card with Premium Background Decor */}
        <Card style={[styles.profileHeaderCard, { backgroundColor: cardBg }]}>
          <LinearGradient
            colors={isDark ? ['#1E1B4B', '#312E81'] : ['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerDecoBg}
          />
          
          <TouchableOpacity
            style={styles.avatarWrapper}
            activeOpacity={0.9}
            onPress={() => setShowAvatarModal(true)}
            disabled={uploadingPhoto}
          >
            <View style={styles.avatarBorderGlow}>
              {isPhotoUri ? (
                <Image source={{ uri: avatarValue }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{avatarValue}</Text>
                </View>
              )}
            </View>

            {/* Premium Camera Overlay Badge */}
            <View style={styles.avatarEditBadge}>
              {uploadingPhoto ? (
                <Ionicons name="hourglass" size={12} color="#FFF" />
              ) : (
                <Ionicons name="camera" size={12} color="#FFF" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={[styles.profileName, { color: labelColor }]}>{getDisplayName(state.profile)}</Text>
          <Text style={[styles.profileEmail, { color: sublabelColor }]}>{state.profile?.email}</Text>

          {/* Rank Tier Badge */}
          <LinearGradient
            colors={rankTier.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rankTierBadge}
          >
            <Text style={styles.rankTierIcon}>{rankTier.icon}</Text>
            <Text style={styles.rankTierText}>{rankTier.name}</Text>
          </LinearGradient>
        </Card>

        {/* Level Progress Overview Card */}
        <Card style={{ backgroundColor: cardBg, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: labelColor }}>Level {currentLevel} Speaker</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: sublabelColor }}>{xpInCurrentLevel} / 500 XP to Level {currentLevel + 1}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: isDark ? '#334155' : '#E2E8F0', overflow: 'hidden', width: '100%' }}>
            <LinearGradient
              colors={['#6366F1', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: '100%', width: `${Math.min(100, Math.max(5, levelProgress * 100))}%`, borderRadius: 4 }}
            />
          </View>
        </Card>

        {/* School Standard Curriculum (Locked - Compact Web-App Style) */}
        {isStudent && (
          <Card style={{ backgroundColor: cardBg, padding: 13, marginBottom: 12, borderRadius: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: labelColor }}>
                🏫 School Curriculum Standard
              </Text>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#E6FBF2',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#059669' }} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#34D399' : '#059669' }}>
                  Admin Managed 🎓
                </Text>
              </View>
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
              borderWidth: 1,
              borderColor: isDark ? '#334155' : '#E2E8F0',
              gap: 10,
            }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EDE9FE',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 16 }}>🎓</Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: labelColor }}>
                  {currentSchoolGrade}
                </Text>
                <Text style={{ fontSize: 11, color: sublabelColor, fontWeight: '600' }} numberOfLines={1}>
                  Assigned by admin
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* AI Tutor English Level Card (Available for All Learners) */}
        <Card style={{ backgroundColor: cardBg, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View>
              <Text style={[styles.cardHeaderTitle, { color: labelColor, marginBottom: 2 }]}>
                👤 AI Tutor English Level
              </Text>
              <Text style={{ fontSize: 12, color: sublabelColor }}>
                Controls speaking & chat response complexity
              </Text>
            </View>
            {updatingLevel && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          <View style={styles.levelSegmentRow}>
            {['Beginner', 'Intermediate', 'Advanced'].map((lvl) => {
              const active = currentEnglishLevel.toLowerCase() === lvl.toLowerCase();
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.levelSegmentBtn,
                    active && styles.levelSegmentBtnActive,
                    isDark && !active && { backgroundColor: '#334155' },
                  ]}
                  onPress={() => handleSelectProficiencyLevel(lvl)}
                  disabled={updatingLevel}
                >
                  <Text
                    style={[
                      styles.levelSegmentText,
                      active && styles.levelSegmentTextActive,
                      isDark && !active && { color: '#94A3B8' },
                    ]}
                  >
                    {lvl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* AI Speaking Tutor Avatar Active Card */}
        {(() => {
          const activeTutor = getAvatarById(selectedAvatarId);
          const isSpeakingActive = playingTutorId === activeTutor.id;
          return (
            <Card style={{ backgroundColor: cardBg, marginBottom: 14 }}>
              <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.cardHeaderTitle, { color: labelColor, marginBottom: 2 }]}>
                    🎭 Active AI Speaking Tutor
                  </Text>
                  <Text style={{ fontSize: 12, color: sublabelColor }}>
                    Your personalized AI speaking partner
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: isDark ? '#2E224F' : '#EEF2FF', borderWidth: 1, borderColor: '#6366F1' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#6366F1' }}>Auto-Synced</Text>
                </View>
              </View>

              <View style={[styles.activeTutorHighlightCard, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <View style={styles.activeTutorLeft}>
                  <View style={[styles.activeTutorEmojiBox, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: '#6366F1', borderWidth: 1.5 }]}>
                    {activeTutor.thumbnail || activeTutor.image ? (
                      <Image source={activeTutor.thumbnail || activeTutor.image} style={styles.activeTutorImage} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: 32 }}>{activeTutor.emoji}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={[styles.activeTutorName, { color: labelColor }]}>{activeTutor.name}</Text>
                      <View style={[styles.tutorBadgePill, { backgroundColor: activeTutor.category === 'cartoon' ? (isDark ? '#083344' : '#E0F2FE') : (isDark ? '#3B0764' : '#F3E8FF') }]}>
                        <Text style={[styles.tutorBadgeText, { color: activeTutor.category === 'cartoon' ? '#0284C7' : '#9333EA' }]}>
                          {activeTutor.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.activeTutorSubtitle, { color: sublabelColor }]} numberOfLines={1}>
                      {activeTutor.subtitle}
                    </Text>
                    <Text style={[styles.activeTutorVoiceText, { color: COLORS.primary }]} numberOfLines={1}>
                      🎙️ {activeTutor.voiceLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.activeTutorBtnRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => playAvatarPreview(activeTutor)}
                    style={[styles.activeTutorTestBtn, { borderColor: isDark ? '#475569' : '#CBD5E1', backgroundColor: isDark ? '#334155' : '#FFFFFF' }]}
                  >
                    <Ionicons name={isSpeakingActive ? "volume-high" : "play"} size={14} color={COLORS.primary} />
                    <Text style={[styles.activeTutorTestBtnText, { color: COLORS.primary }]}>
                      {isSpeakingActive ? 'Playing...' : 'Test Voice'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setShowTutorModal(true)}
                    style={styles.activeTutorChooseBtn}
                  >
                    <Ionicons name="people" size={14} color="#FFFFFF" />
                    <Text style={styles.activeTutorChooseBtnText}>Choose Avatar (10)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        })()}

        {/* Edit Info Form - Modern layout with full fields */}
        <Card style={{ backgroundColor: cardBg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#E2E8F0' }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.cardHeaderTitle, { color: labelColor, marginBottom: 0 }]}>Personal Information</Text>
                {isEditingInfo ? (
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: isDark ? '#451A03' : '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#D97706' }}>Editing</Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: isDark ? '#064E3B' : '#ECFDF5', borderWidth: 1, borderColor: '#10B981' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#059669' }}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: sublabelColor, marginTop: 2 }}>
                Manage your identity and email
              </Text>
            </View>

            {!isEditingInfo ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setInfoErrors({});
                  setIsEditingInfo(true);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: isDark ? '#312E81' : '#EEF2FF',
                  borderWidth: 1,
                  borderColor: '#6366F1'
                }}
              >
                <Ionicons name="create-outline" size={14} color="#6366F1" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6366F1' }}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleCancelEditInfo}
                disabled={saving}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: isDark ? '#334155' : '#F1F5F9'
                }}
              >
                <Ionicons name="close-circle-outline" size={14} color={sublabelColor} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: sublabelColor }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <AppInput
            label="First Name"
            value={form.firstName}
            editable={isEditingInfo && !saving}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, firstName: value }));
              if (/[^a-zA-Z\s'-]/.test(value)) {
                setInfoErrors((prev) => ({ ...prev, firstName: 'Names can only contain letters.' }));
              } else {
                setInfoErrors((prev) => ({ ...prev, firstName: null }));
              }
            }}
            maxLength={40}
            error={isEditingInfo && infoErrors.firstName ? infoErrors.firstName : null}
            style={!isEditingInfo && { opacity: 0.85 }}
          />

          <AppInput
            label="Last Name"
            value={form.lastName}
            editable={isEditingInfo && !saving}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, lastName: value }));
              if (/[^a-zA-Z\s'-]/.test(value)) {
                setInfoErrors((prev) => ({ ...prev, lastName: 'Names can only contain letters.' }));
              } else {
                setInfoErrors((prev) => ({ ...prev, lastName: null }));
              }
            }}
            maxLength={40}
            error={isEditingInfo && infoErrors.lastName ? infoErrors.lastName : null}
            style={!isEditingInfo && { opacity: 0.85 }}
          />

          <AppInput
            label="Email Address"
            value={form.email}
            editable={isEditingInfo && !saving}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, email: value }));
              if (infoErrors.email && isValidEmail(value.trim())) {
                setInfoErrors((prev) => ({ ...prev, email: null }));
              }
            }}
            onBlur={() => {
              const trimmed = form.email.trim();
              if (!trimmed) {
                setInfoErrors((prev) => ({ ...prev, email: 'Email address is required.' }));
              } else if (!isValidEmail(trimmed)) {
                setInfoErrors((prev) => ({ ...prev, email: 'Please enter a valid email address.' }));
              } else {
                setInfoErrors((prev) => ({ ...prev, email: null }));
              }
            }}
            keyboardType="email-address"
            error={isEditingInfo && infoErrors.email ? infoErrors.email : null}
            style={!isEditingInfo && { opacity: 0.85 }}
          />

          {isEditingInfo && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleCancelEditInfo}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: isDark ? '#334155' : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#E2E8F0' : '#475569' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <AppButton
                  title="Save Changes"
                  onPress={save}
                  loading={saving}
                  style={[styles.saveBtn, { marginTop: 0 }]}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Account Utilities Options */}
        <View style={styles.optionsList}>
          <TouchableOpacity
            style={[styles.optionRow, { backgroundColor: optionRowBg, borderColor: optionBorder }]}
            activeOpacity={0.7}
            onPress={handlePickImage}
            disabled={uploadingPhoto}
          >
            <View style={[styles.optionIconContainer, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="image" size={20} color="#059669" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: labelColor }]}>Upload Profile Photo</Text>
              <Text style={[styles.optionSubtitle, { color: sublabelColor }]}>
                {uploadingPhoto ? 'Uploading your photo…' : 'Choose a photo from your gallery'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={sublabelColor} />
          </TouchableOpacity>

          {/* Subscription & Pro Management for Individual Users */}
          {!isStudent && (
            <TouchableOpacity
              style={[styles.optionRow, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: isDark ? '#4338CA' : '#C7D2FE' }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="diamond" size={20} color="#D97706" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: isDark ? '#FFFFFF' : '#312E81', fontWeight: '800' }]}>
                  {(!isStudent && (user?.isPro || user?.pro)) ? '⭐ SpeakMate Pro Member' : '⭐ Upgrade to Pro'}
                </Text>
                <Text style={[styles.optionSubtitle, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                  {(!isStudent && (user?.isPro || user?.pro)) ? 'Manage your active subscription' : 'Unlimited AI Speaking & Accent Coach'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? '#818CF8' : '#4F46E5'} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.optionRow, { backgroundColor: optionRowBg, borderColor: optionBorder }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={[styles.optionIconContainer, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="settings" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: labelColor }]}>App Settings</Text>
              <Text style={[styles.optionSubtitle, { color: sublabelColor }]}>Languages, AI Voice, Sound effects</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={sublabelColor} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, styles.logoutOptionRow, { backgroundColor: optionRowBg, borderColor: isDark ? '#7f1d1d' : '#FEE2E2' }]}
            activeOpacity={0.7}
            onPress={handleLogoutPress}
          >
            <View style={[styles.optionIconContainer, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out" size={20} color="#EF4444" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: '#EF4444' }]}>Log Out</Text>
              <Text style={[styles.optionSubtitle, { color: sublabelColor }]}>Sign out from this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
          </TouchableOpacity>

          {/* Delete Account Option */}
          <TouchableOpacity
            style={[styles.optionRow, styles.logoutOptionRow, { backgroundColor: optionRowBg, borderColor: isDark ? '#7f1d1d' : '#FEE2E2', marginTop: 10 }]}
            activeOpacity={0.7}
            onPress={handleOpenDeleteModal}
          >
            <View style={[styles.optionIconContainer, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: '#DC2626', fontWeight: '800' }]}>Delete Account</Text>
              <Text style={[styles.optionSubtitle, { color: sublabelColor }]}>Permanently remove account & data via Email OTP</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
          </TouchableOpacity>
        </View>
      </StateView>

      {/* ── DELETE ACCOUNT MODAL ────────────────────────────────────── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: isDark ? '#451A1A' : '#FEF2F2' }]}>
                <Ionicons name="trash" size={24} color="#EF4444" />
              </View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Delete Account</Text>
                <Text style={[styles.modalSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Verification code required to delete account
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseDeleteModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 12 }} keyboardShouldPersistTaps="handled">
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={18} color="#D97706" style={{ marginTop: 2 }} />
                <Text style={styles.warningText}>
                  This action is permanent. Enter your registered email address to receive a 6-digit OTP code before proceeding.
                </Text>
              </View>

              {/* Email Section - Full width input */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                  Registered Email Address
                </Text>
                <View
                  style={[
                    styles.emailInputWrapper,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}
                >
                  <Ionicons name="mail" size={18} color={COLORS.primary} style={{ marginLeft: 14, marginRight: 8 }} />
                  <TextInput
                    value={deleteEmail}
                    onChangeText={handleEmailChange}
                    placeholder="Enter email address"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!otpSent}
                    style={[
                      styles.emailTextInput,
                      { color: isDark ? '#F8FAFC' : '#0F172A' },
                      otpSent && { opacity: 0.8 },
                    ]}
                  />
                  {otpSent && (
                    <TouchableOpacity
                      onPress={() => {
                        setOtpSent(false);
                        setDeleteOtp('');
                        setOtpVerificationStatus('IDLE');
                        setOtpVerificationError('');
                        lastVerifiedOtpRef.current = '';
                        if (resendTimerRef.current) clearInterval(resendTimerRef.current);
                        setResendCooldown(0);
                      }}
                      style={styles.changeEmailSmallBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.changeEmailSmallText}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Send / Resend Code Action Row (Placed cleanly below Email - never squishes input!) */}
                <View style={styles.emailActionRow}>
                  <Text style={[styles.emailHelperText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    {otpSent
                      ? 'Verification code sent to email'
                      : 'We will send a 6-digit code'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleSendDeleteOtp}
                    disabled={sendingOtp || resendCooldown > 0}
                    style={[
                      styles.sendOtpActionBtn,
                      {
                        backgroundColor:
                          resendCooldown > 0
                            ? (isDark ? '#334155' : '#E2E8F0')
                            : otpSent
                            ? '#059669'
                            : COLORS.primary,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.sendOtpActionText,
                          resendCooldown > 0 && { color: isDark ? '#94A3B8' : '#64748B' },
                        ]}
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : otpSent
                          ? 'Resend Code'
                          : 'Send Code'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* OTP Section (Expands when sent) */}
              {otpSent && (
                <View
                  style={[
                    styles.otpExpandCard,
                    {
                      backgroundColor:
                        otpVerificationStatus === 'VERIFIED'
                          ? (isDark ? '#064E3B' : '#ECFDF5')
                          : otpVerificationStatus === 'INVALID' || otpVerificationStatus === 'EXPIRED'
                          ? (isDark ? '#451A1A' : '#FEF2F2')
                          : (isDark ? '#1E293B' : '#F8FAFC'),
                      borderColor:
                        otpVerificationStatus === 'VERIFIED'
                          ? '#10B981'
                          : otpVerificationStatus === 'INVALID' || otpVerificationStatus === 'EXPIRED'
                          ? '#EF4444'
                          : (isDark ? '#334155' : '#E2E8F0'),
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Ionicons
                      name={
                        otpVerificationStatus === 'VERIFIED'
                          ? 'shield-checkmark'
                          : otpVerificationStatus === 'INVALID' || otpVerificationStatus === 'EXPIRED'
                          ? 'alert-circle'
                          : 'key-outline'
                      }
                      size={18}
                      color={
                        otpVerificationStatus === 'VERIFIED'
                          ? '#10B981'
                          : otpVerificationStatus === 'INVALID' || otpVerificationStatus === 'EXPIRED'
                          ? '#EF4444'
                          : COLORS.primary
                      }
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color:
                          otpVerificationStatus === 'VERIFIED'
                            ? (isDark ? '#D1FAE5' : '#065F46')
                            : otpVerificationStatus === 'INVALID' || otpVerificationStatus === 'EXPIRED'
                            ? '#DC2626'
                            : (isDark ? '#F8FAFC' : '#0F172A'),
                      }}
                    >
                      Enter 6-digit OTP Code
                    </Text>
                  </View>

                  <TextInput
                    value={deleteOtp}
                    onChangeText={handleOtpChange}
                    placeholder="••••••"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!deletingAccount}
                    style={[
                      styles.otpTextInput,
                      {
                        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                        color: isDark ? '#F8FAFC' : '#0F172A',
                        borderColor:
                          otpVerificationStatus === 'VERIFIED'
                            ? '#10B981'
                            : otpVerificationStatus === 'INVALID' || otpVerificationStatus === 'EXPIRED'
                            ? '#EF4444'
                            : (isDark ? '#334155' : '#CBD5E1'),
                      },
                    ]}
                  />

                  {/* Verification Status Feedback */}
                  {otpVerificationStatus === 'VERIFYING' && (
                    <View style={styles.otpStatusRow}>
                      <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.otpStatusText, { color: COLORS.primary }]}>
                        Verifying code with server...
                      </Text>
                    </View>
                  )}

                  {otpVerificationStatus === 'VERIFIED' && (
                    <View style={styles.otpStatusRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 5 }} />
                      <Text style={[styles.otpStatusText, { color: '#059669', fontWeight: '800' }]}>
                        Code verified ✓
                      </Text>
                    </View>
                  )}

                  {(otpVerificationStatus === 'INVALID' || otpVerificationStatus === 'EXPIRED') && (
                    <View style={styles.otpStatusRow}>
                      <Ionicons name="close-circle" size={16} color="#EF4444" style={{ marginRight: 5 }} />
                      <Text style={[styles.otpStatusText, { color: '#DC2626' }]}>
                        {otpVerificationError || 'Invalid verification code. Please try again.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Confirm Deletion Button - Enabled ONLY when explicitly VERIFIED */}
              {otpSent && (
                <TouchableOpacity
                  onPress={handleConfirmDeleteAccount}
                  disabled={deletingAccount || otpVerificationStatus !== 'VERIFIED'}
                  activeOpacity={0.8}
                  style={[
                    styles.deleteConfirmBtn,
                    {
                      backgroundColor:
                        otpVerificationStatus === 'VERIFIED'
                          ? '#DC2626'
                          : isDark
                          ? '#334155'
                          : '#CBD5E1',
                      opacity: deletingAccount ? 0.7 : 1,
                    },
                  ]}
                >
                  {deletingAccount ? (
                    <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons
                      name="trash"
                      size={18}
                      color={otpVerificationStatus === 'VERIFIED' ? '#FFF' : '#94A3B8'}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.deleteConfirmBtnText,
                      otpVerificationStatus !== 'VERIFIED' && {
                        color: isDark ? '#94A3B8' : '#64748B',
                      },
                    ]}
                  >
                    {deletingAccount ? 'Deleting Account...' : 'Permanently Delete Account'}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── AVATAR PICKER MODAL ────────────────────────────────────── */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
                <Ionicons name="happy" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Choose Avatar</Text>
                <Text style={[styles.modalSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Select a preset avatar, emoji, or upload custom photo
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAvatarModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Gallery Upload Option Button */}
            <TouchableOpacity
              style={[styles.galleryUploadBtn, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
              onPress={() => {
                setShowAvatarModal(false);
                setTimeout(() => handlePickImage(), 200);
              }}
            >
              <Ionicons name="images" size={22} color={COLORS.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: labelColor }]}>Upload Photo from Gallery</Text>
                <Text style={[styles.optionSubtitle, { color: sublabelColor }]}>Choose a custom image from your device</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={sublabelColor} />
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#475569', marginTop: 14, marginBottom: 8 }]}>
              Avatar Collections
            </Text>

            {/* Category tabs */}
            <View style={{ marginBottom: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarCategoryRow}>
                {[
                  { key: 'emojis', label: '🎓 Emojis' },
                  ...AVATAR_CATEGORIES.map((c) => ({
                    key: c.key,
                    label: `${c.key === 'illustrated' ? '🎨 ' : c.key === 'anime' ? '🌸 ' : c.key === 'adventurer' ? '🧭 ' : c.key === 'pixel' ? '👾 ' : '🤖 '}${c.label}`,
                  })),
                ].map((cat) => {
                  const isActive = selectedAvatarCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.avatarCategoryTab,
                        { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' },
                        isActive && styles.avatarCategoryTabActive,
                      ]}
                      onPress={() => setSelectedAvatarCategory(cat.key)}
                    >
                      <Text
                        style={[
                          styles.avatarCategoryTabText,
                          { color: isDark ? '#94A3B8' : '#64748B' },
                          isActive && styles.avatarCategoryTabTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Avatar Grid inside scrollview */}
            <ScrollView showsVerticalScrollIndicator={false} style={styles.avatarScrollGrid}>
              <View style={styles.avatarGrid}>
                {selectedAvatarCategory === 'emojis' ? (
                  PRESET_AVATARS.map((emoji) => {
                    const isSelected = avatarValue === emoji;
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.avatarGridItem,
                          { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' },
                          isSelected && {
                            borderWidth: 2,
                            borderColor: COLORS.primary,
                            backgroundColor: isDark ? '#312E81' : '#EEF2FF',
                          },
                        ]}
                        onPress={() => handleSelectPresetAvatar(emoji)}
                      >
                        <Text style={{ fontSize: 30 }}>{emoji}</Text>
                        {isSelected && (
                          <View style={styles.avatarCheckBadge}>
                            <Ionicons name="checkmark" size={10} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  AVATAR_CATEGORIES.find((c) => c.key === selectedAvatarCategory)?.avatars.map((url, i) => {
                    const isSelected = avatarValue === url;
                    return (
                      <TouchableOpacity
                        key={url || i}
                        style={[
                          styles.avatarImgCard,
                          { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
                          isSelected && { borderWidth: 2.5, borderColor: COLORS.primary },
                        ]}
                        onPress={() => handleSelectPresetAvatar(url)}
                      >
                        <Image source={{ uri: url }} style={styles.avatarImgPreview} />
                        {isSelected && (
                          <View style={styles.avatarCheckBadge}>
                            <Ionicons name="checkmark" size={10} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 10 AI AVATAR TUTORS SELECTION POPUP MODAL ── */}
      <Modal
        visible={showTutorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTutorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.cardHeaderTitle, { color: labelColor, marginBottom: 2 }]}>
                  Choose AI Speaking Tutor 🎭
                </Text>
                <Text style={{ fontSize: 12, color: sublabelColor }}>
                  Select your tutor — tap <Text style={{ fontWeight: '800', color: labelColor }}>Test Voice</Text> to preview audio!
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTutorModal(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={26} color={sublabelColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.modalTutorGrid}>
                {AVATAR_LIST.map((av) => {
                  const isSelected = selectedAvatarId === av.id;
                  const isSpeakingThis = playingTutorId === av.id;
                  return (
                    <TouchableOpacity
                      key={av.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        handleSelectTutor(av);
                        playAvatarPreview(av);
                        setShowTutorModal(false);
                      }}
                      style={[
                        styles.modalTutorCard,
                        {
                          backgroundColor: isSelected ? (isDark ? '#2E224F' : '#EEF2FF') : (isDark ? '#1E293B' : '#F8FAFC'),
                          borderColor: isSelected ? '#6366F1' : (isDark ? '#334155' : '#E2E8F0'),
                          borderWidth: isSelected ? 2 : 1,
                        }
                      ]}
                    >
                      <View style={styles.tutorCardHeader}>
                        {av.thumbnail || av.image ? (
                          <View style={[styles.tutorThumbWrap, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF' }]}>
                            <Image source={av.thumbnail || av.image} style={styles.tutorThumbImage} resizeMode="contain" />
                          </View>
                        ) : (
                          <Text style={styles.tutorCardEmoji}>{av.emoji}</Text>
                        )}
                        {isSelected ? (
                          <View style={styles.tutorActiveBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#6366F1" />
                            <Text style={styles.tutorActiveText}>Active</Text>
                          </View>
                        ) : (
                          <View style={[styles.tutorBadgePill, { backgroundColor: av.category === 'cartoon' ? (isDark ? '#083344' : '#E0F2FE') : (isDark ? '#3B0764' : '#F3E8FF') }]}>
                            <Text style={[styles.tutorBadgeText, { color: av.category === 'cartoon' ? '#0284C7' : '#9333EA' }]} numberOfLines={1}>
                              {av.badge}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.tutorCardName, { color: isSelected ? '#6366F1' : labelColor }]} numberOfLines={1}>
                        {av.name}
                      </Text>
                      <Text style={[styles.tutorCardDesc, { color: sublabelColor }]} numberOfLines={2}>
                        {av.subtitle}
                      </Text>

                      <View style={styles.modalTutorBottomRow}>
                        <Text style={[styles.tutorVoiceLabel, { color: sublabelColor, flex: 1 }]} numberOfLines={1}>
                          🎙️ {av.voiceLabel}
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => playAvatarPreview(av)}
                          style={[styles.modalTutorTestBtn, { borderColor: isDark ? '#475569' : '#CBD5E1', backgroundColor: isDark ? '#334155' : '#FFFFFF' }]}
                        >
                          <Text style={[styles.modalTutorTestText, { color: COLORS.primary }]}>
                            {isSpeakingThis ? '🔊' : '▶ Test'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHeaderCard: {
    alignItems: 'center',
    padding: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingBottom: 24,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 0,
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  headerDecoBg: {
    height: 115,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarWrapper: {
    marginTop: 28,
    marginBottom: 12,
    position: 'relative',
  },
  avatarBorderGlow: {
    padding: 4,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 42,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFF',
    elevation: 3,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 3,
    textAlign: 'center',
  },
  levelProgressContainer: {
    width: '85%',
    marginTop: 18,
    alignItems: 'center',
  },
  levelLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  levelProgressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 22,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  metricLbl: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  saveBtn: {
    marginTop: 8,
  },
  optionsList: {
    marginTop: 6,
    marginBottom: 24,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  logoutOptionRow: {
    borderWidth: 1,
  },
  optionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  optionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  // Delete Account Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 50,
  },
  emailTextInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  changeEmailSmallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  changeEmailSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emailActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  emailHelperText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  sendOtpActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  sendOtpActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  otpTextInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    height: 54,
  },
  otpStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  otpStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpExpandCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  deleteConfirmBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  deleteConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  rankTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
    elevation: 2,
  },
  rankTierIcon: {
    fontSize: 14,
  },
  rankTierName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  levelSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  levelSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelSegmentBtnActive: {
    backgroundColor: COLORS.primary,
    elevation: 2,
  },
  levelSegmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  levelSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  galleryUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  avatarCategoryRow: {
    paddingVertical: 4,
    gap: 8,
  },
  avatarCategoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  avatarCategoryTabActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#6366F1',
  },
  avatarCategoryTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  avatarCategoryTabTextActive: {
    color: '#FFFFFF',
  },
  avatarScrollGrid: {
    maxHeight: 280,
  },
  avatarImgCard: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    elevation: 2,
  },
  avatarImgPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
  },
  avatarCheckBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  avatarGridItem: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    position: 'relative',
  },
  activeTutorHighlightCard: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  activeTutorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTutorEmojiBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeTutorImage: {
    width: 52,
    height: 52,
  },
  activeTutorName: {
    fontSize: 16,
    fontWeight: '900',
  },
  activeTutorSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  activeTutorVoiceText: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  activeTutorBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.3)',
  },
  activeTutorTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeTutorTestBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  activeTutorChooseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#6366F1',
  },
  activeTutorChooseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalTutorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modalTutorCard: {
    width: '48%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 4,
  },
  modalTutorBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.3)',
  },
  modalTutorTestBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalTutorTestText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tutorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tutorThumbWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  tutorThumbImage: {
    width: 34,
    height: 34,
  },
  tutorCardEmoji: {
    fontSize: 24,
  },
  tutorActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tutorActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366F1',
  },
  tutorBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tutorBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tutorCardName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  tutorCardDesc: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    marginBottom: 4,
  },
  tutorVoiceLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
});
