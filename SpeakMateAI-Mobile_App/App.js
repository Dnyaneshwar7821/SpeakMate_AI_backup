import './global.css';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/context/AuthContext';
import { DrawerProvider } from './src/context/DrawerContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ToastProvider } from './src/context/ToastContext';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { LearnerAssistantWidget } from './src/components/assistant/LearnerAssistantWidget';
import api from './src/api/api';

// ─── Error Boundary ──────────────────────────────────────────────────────────
// Catches React render/lifecycle errors with production-safe error containment.
// In release builds, internal stack traces are hidden and users are provided
// with a clean recovery action (Updates.reloadAsync).
class ErrorBoundary extends React.Component {
  state = { error: null, isReloading: false };

  static getDerivedStateFromError(error) {
    return { error, isReloading: false };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught:', error.message);
    console.error('[ErrorBoundary] stack:', error.stack);
    console.error('[ErrorBoundary] component stack:', info?.componentStack);
  }

  handleReload = async () => {
    this.setState({ isReloading: true });
    try {
      if (Updates && typeof Updates.reloadAsync === 'function') {
        await Updates.reloadAsync();
        return;
      }
    } catch (err) {
      console.warn('[ErrorBoundary] Updates.reloadAsync not available or failed:', err?.message);
    }
    // Fallback: reset error state to attempt re-rendering the tree
    this.setState({ error: null, isReloading: false });
  };

  handleTryAgain = () => {
    this.setState({ error: null, isReloading: false });
  };

  render() {
    const { error, isReloading } = this.state;
    if (error) {
      const isDev = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);

      return (
        <View style={errorStyles.container}>
          <View style={errorStyles.card}>
            <View style={errorStyles.iconContainer}>
              <Text style={errorStyles.iconText}>⚠️</Text>
            </View>

            <Text style={errorStyles.title}>
              {isDev ? 'App Error (Development Mode)' : 'Something went wrong'}
            </Text>

            <Text style={errorStyles.subtitle}>
              {isDev
                ? error?.message || 'Unknown runtime error'
                : 'SpeakMate AI encountered an unexpected problem. Please restart the app to resume your learning session.'}
            </Text>

            <View style={errorStyles.buttonRow}>
              <TouchableOpacity
                style={[errorStyles.primaryButton, isReloading && errorStyles.buttonDisabled]}
                onPress={this.handleReload}
                disabled={isReloading}
                activeOpacity={0.8}
              >
                {isReloading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={errorStyles.primaryButtonText}>Restart App</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={errorStyles.secondaryButton}
                onPress={this.handleTryAgain}
                disabled={isReloading}
                activeOpacity={0.8}
              >
                <Text style={errorStyles.secondaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>

            {isDev && error?.stack && (
              <View style={errorStyles.debugContainer}>
                <Text style={errorStyles.debugHeader}>Stack Trace (Dev Only):</Text>
                <ScrollView style={errorStyles.debugScroll}>
                  <Text style={errorStyles.debugText}>{error.stack}</Text>
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6c63ff',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  debugContainer: {
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f87171',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  debugScroll: {
    maxHeight: 180,
    backgroundColor: '#090d16',
    borderRadius: 10,
    padding: 10,
  },
  debugText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
// ─────────────────────────────────────────────────────────────────────────────

const linking = {
  prefixes: [Linking.createURL('/'), 'speakmateai://', 'https://speakmateai.com'],
  config: {
    screens: {
      Auth: {
        path: 'auth',
        screens: {
          ResetPassword: 'reset-password',
        },
      },
    },
  },
};

// Inner component so hooks work inside providers
function AppContent() {
  const { isDark } = useTheme();
  usePushNotifications();
  return (
    <View style={styles.rootContainer}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent={true} backgroundColor="transparent" />
      <AppNavigator />
      <LearnerAssistantWidget />
    </View>
  );
}

export default function App() {
  useEffect(() => {
    const registerExpoUrl = async () => {
      try {
        if (typeof Linking.createURL === 'function') {
          const url = Linking.createURL('/');
          console.log('[Registering Expo URL with Backend]:', url);
          await api.post('/api/users/register-expo-url', { url });
        }
      } catch (err) {
        console.warn('Failed to register Expo URL with backend:', err?.message);
      }
    };
    registerExpoUrl();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <NotificationProvider>
              <DrawerProvider>
                <ToastProvider>
                  <NavigationContainer ref={navigationRef} linking={linking}>
                    <AppContent />
                  </NavigationContainer>
                </ToastProvider>
              </DrawerProvider>
            </NotificationProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
});
