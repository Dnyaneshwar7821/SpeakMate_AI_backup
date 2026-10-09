import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AuthCard,
  AuthInput,
  BackButton,
  ErrorMessage,
  PasswordInput,
  PasswordStrength,
  PrimaryButton,
} from '../../components/auth';
import { authService } from '../../services/authService';

const TOKEN_REGEX = /^[a-zA-Z0-9_-]{16,128}$/;

export default function ResetPasswordScreen({ navigation, route }) {
  const initialRawToken = typeof route?.params?.token === 'string' ? route.params.token.trim() : '';
  const [token, setToken] = useState(TOKEN_REGEX.test(initialRawToken) ? initialRawToken : '');
  const [hasInvalidToken, setHasInvalidToken] = useState(Boolean(initialRawToken && !TOKEN_REGEX.test(initialRawToken)));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialRawToken && !TOKEN_REGEX.test(initialRawToken) ? 'Invalid password reset link.' : '');
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const handleBackPress = () => {
    Alert.alert(
      'Cancel Password Reset? ⚠️',
      'Leaving this screen will cancel your password reset session. To reset your password later, you will need to request a new verification code.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Exit to Sign In',
          style: 'destructive',
          onPress: () => navigation.navigate('Login'),
        },
      ]
    );
    return true; // Prevents default unprompted back navigation
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (route?.params?.token) {
      const raw = String(route.params.token).trim();
      if (TOKEN_REGEX.test(raw)) {
        setToken(raw);
        setHasInvalidToken(false);
        setError('');
      } else {
        setToken('');
        setHasInvalidToken(true);
        setError('Invalid or expired password reset link. Please request a new verification link.');
      }
    }
  }, [route?.params?.token]);

  const getPasswordError = () => {
    if (!password) return 'Please enter your new password.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password.length > 128) return 'Password must not exceed 128 characters.';
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.';
    }
    return null;
  };

  const getConfirmPasswordError = () => {
    if (!confirmPassword) return 'Please confirm your password.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const validate = () => {
    if (!token || !TOKEN_REGEX.test(token.trim())) {
      return 'Valid reset token is missing or expired. Please verify your OTP code or link again.';
    }
    const passErr = getPasswordError();
    if (passErr) return passErr;
    const confErr = getConfirmPasswordError();
    if (confErr) return confErr;
    return null;
  };

  const submit = async () => {
    Keyboard.dismiss();
    setTouched({ password: true, confirmPassword: true });
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword({
        token: token.trim(),
        newPassword: password,
        confirmPassword,
      });
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. Please sign in with your new credentials.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      const serverMsg =
        err.response?.data?.message ||
        (err.response?.data && typeof err.response.data === 'object' && Object.values(err.response.data)[0]) ||
        (typeof err.response?.data === 'string' ? err.response?.data : null) ||
        err.userMessage ||
        'Unable to reset password. The link may have expired or already been used.';
      setError(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0F172A', '#1E1B4B', '#3730A3']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <BackButton onPress={handleBackPress} light />
          <Text style={styles.headerTitle}>Create New Password</Text>
          <Text style={styles.headerSubtitle}>Please enter a secure new password for your account.</Text>
        </SafeAreaView>
      </LinearGradient>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable onPress={Keyboard.dismiss}>
            <AuthCard style={styles.card}>
              <ErrorMessage message={error} />
              
              {!token && (
                <Text style={[styles.errorText, { marginBottom: 20 }]}>
                  ⚠️ Session token is missing. Please enter your email and verify the OTP code again.
                </Text>
              )}

              <PasswordInput
                label="New Password"
                value={password}
                onChangeText={(value) => { setPassword(value); if (error) setError(''); }}
                onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                touched={touched.password}
                error={getPasswordError()}
                placeholder="Strong password"
                returnKeyType="next"
                inputRef={passwordRef}
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!!token}
              />
              <PasswordStrength password={password} />
              <PasswordInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={(value) => { setConfirmPassword(value); if (error) setError(''); }}
                onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                touched={touched.confirmPassword}
                error={getConfirmPasswordError()}
                placeholder="Repeat password"
                returnKeyType="done"
                inputRef={confirmRef}
                onSubmitEditing={submit}
                editable={!!token}
              />
              <PrimaryButton 
                title="Reset Password" 
                onPress={submit} 
                loading={loading} 
                disabled={loading || !token} 
              />
            </AuthCard>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 42 },
  headerContent: { paddingHorizontal: 20, paddingTop: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 22, marginTop: 6 },
  body: { flex: 1, marginTop: -24 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
