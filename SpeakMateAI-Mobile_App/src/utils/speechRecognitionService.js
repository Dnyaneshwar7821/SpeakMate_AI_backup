import { NativeModules } from 'react-native';

/**
 * Safe Speech Recognition Service Adapter
 * 
 * Safely inspects native modules directly from runtime global registries without calling
 * throwing requireNativeModule macros. If the native module is not compiled in the running APK,
 * it returns null without triggering any fatal crashes or red screen errors.
 */

const getRawNativeModule = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis?.expo?.modules?.ExpoSpeechRecognition) {
      return globalThis.expo.modules.ExpoSpeechRecognition;
    }
  } catch (_) {}

  try {
    if (typeof global !== 'undefined' && global?.expo?.modules?.ExpoSpeechRecognition) {
      return global.expo.modules.ExpoSpeechRecognition;
    }
  } catch (_) {}

  try {
    if (NativeModules && NativeModules.ExpoSpeechRecognition) {
      return NativeModules.ExpoSpeechRecognition;
    }
  } catch (_) {}

  return null;
};

const rawModule = getRawNativeModule();

export const isNativeSpeechRecognitionAvailable = Boolean(
  rawModule && typeof rawModule.start === 'function'
);

export const ExpoSpeechRecognitionModule = {
  start: (options = {}) => {
    if (rawModule && typeof rawModule.start === 'function') {
      try {
        return rawModule.start(options);
      } catch (e) {
        console.warn('[speechRecognitionService] start error:', e);
      }
    }
    return Promise.resolve();
  },
  stop: () => {
    if (rawModule && typeof rawModule.stop === 'function') {
      try {
        return rawModule.stop();
      } catch (e) {
        console.warn('[speechRecognitionService] stop error:', e);
      }
    }
    return Promise.resolve();
  },
  abort: () => {
    if (rawModule && typeof rawModule.abort === 'function') {
      try {
        return rawModule.abort();
      } catch (e) {
        console.warn('[speechRecognitionService] abort error:', e);
      }
    }
    return Promise.resolve();
  },
  requestPermissionsAsync: async () => {
    if (rawModule && typeof rawModule.requestPermissionsAsync === 'function') {
      try {
        return await rawModule.requestPermissionsAsync();
      } catch (e) {
        console.warn('[speechRecognitionService] requestPermissionsAsync error:', e);
      }
    }
    return { status: 'undetermined', granted: false, canAskAgain: true };
  },
  getStateAsync: async () => {
    if (rawModule && typeof rawModule.getStateAsync === 'function') {
      try {
        return await rawModule.getStateAsync();
      } catch (e) {
        console.warn('[speechRecognitionService] getStateAsync error:', e);
      }
    }
    return { isRecognizing: false };
  },
  addListener: (event, listener) => {
    if (rawModule && typeof rawModule.addListener === 'function') {
      try {
        return rawModule.addListener(event, listener);
      } catch (e) {
        console.warn('[speechRecognitionService] addListener error:', e);
      }
    }
    return { remove: () => {} };
  },
};
