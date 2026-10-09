import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Automatically detect developer's host machine IP on local Wi-Fi from Expo Packager in development
export const getDevHostIp = () => {
  try {
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || Constants.manifest2?.extra?.expoClient?.hostUri || '';
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') return ip;
    }
  } catch (_) {}
  // Default to standard Android emulator loopback (10.0.2.2) or localhost
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const resolveBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    if (__DEV__ && Platform.OS === 'android' && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      const hostIp = getDevHostIp();
      return envUrl.replace(/localhost|127\.0\.0\.1/, hostIp);
    }
    return envUrl;
  }
  if (__DEV__) {
    return `http://${getDevHostIp()}:9091`;
  }
  return 'https://speakmate-ai-28z5.onrender.com';
};

export const BASE_URL = resolveBaseUrl();

export const getWebAvatarEmbedUrl = (model = 'haru') => {
  const customUrl = process.env.EXPO_PUBLIC_WEB_AVATAR_URL;
  if (customUrl) {
    return `${customUrl}?model=${model}&framing=faceToChest`;
  }
  // Android 100% Offline Standalone Embed
  if (Platform.OS === 'android') {
    return `file:///android_asset/live2d/avatar_embed.html?model=${model}&framing=faceToChest`;
  }
  if (__DEV__) {
    const hostIp = getDevHostIp();
    return `http://${hostIp}:5173/avatar-embed?model=${model}&framing=faceToChest`;
  }
  return `https://speakmate-ai-28z5.onrender.com/avatar-embed?model=${model}&framing=faceToChest`;
};