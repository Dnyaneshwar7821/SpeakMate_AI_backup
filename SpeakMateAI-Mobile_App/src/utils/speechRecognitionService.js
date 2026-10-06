import { requireOptionalNativeModule } from 'expo';

/**
 * Safe Speech Recognition Service Adapter
 * 
 * Safely wraps ExpoSpeechRecognitionModule so that if the native binary has not yet been compiled
 * into the currently running APK (e.g. running on an older development client build), the JS bundle
 * does NOT throw a fatal "[runtime not ready]: Cannot find native module 'ExpoSpeechRecognition'" crash.
 */

let rawModule = null;
try {
  rawModule = requireOptionalNativeModule('ExpoSpeechRecognition');
} catch (e) {
  rawModule = null;
}

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
