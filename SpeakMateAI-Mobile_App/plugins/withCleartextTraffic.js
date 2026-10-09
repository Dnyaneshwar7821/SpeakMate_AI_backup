const { withAndroidManifest } = require('expo/config-plugins');

/**
 * SpeakMate AI - Android Cleartext Traffic Config Plugin
 *
 * Security Hardening:
 * Android cleartext HTTP traffic is restricted strictly to development environments
 * (e.g. local backend testing via HTTP on LAN or emulator).
 * In production / release builds, cleartext traffic is explicitly disabled ('false')
 * to ensure all network communication is encrypted over HTTPS and protected from MITM attacks.
 */
module.exports = function withCleartextTraffic(config, props = {}) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application?.[0];

    if (!mainApplication) {
      return config;
    }

    if (!mainApplication.$) {
      mainApplication.$ = {};
    }

    // Determine environment
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.EAS_BUILD_PROFILE === 'production' ||
      process.env.APP_ENV === 'production' ||
      process.env.EXPO_PUBLIC_APP_ENV === 'production';

    const explicitlyEnabled = props?.enabled === true;
    const explicitlyDisabled = props?.enabled === false;

    // Cleartext is permitted only in non-production builds unless explicitly forced
    const allowCleartext = !explicitlyDisabled && (explicitlyEnabled || !isProduction);

    if (allowCleartext) {
      console.log('[withCleartextTraffic] Development mode: enabling android:usesCleartextTraffic="true"');
      mainApplication.$['android:usesCleartextTraffic'] = 'true';
    } else {
      console.log('[withCleartextTraffic] Production mode: enforcing android:usesCleartextTraffic="false"');
      mainApplication.$['android:usesCleartextTraffic'] = 'false';
    }

    return config;
  });
};

