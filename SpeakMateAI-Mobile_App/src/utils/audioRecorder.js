import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import { Platform } from 'react-native';

/**
 * Universal SDK 57-compatible Voice Recorder using expo-audio.
 * Provides drop-in parity for microphone recording, VAD metering, and audio file creation.
 */
class VoiceRecorder {
  constructor(onStatusUpdate) {
    this.recorder = null;
    this.onStatusUpdate = onStatusUpdate;
    this.intervalId = null;
    this.isRecording = false;
    this.subscription = null;
  }

  static async requestPermissions() {
    try {
      const response = await requestRecordingPermissionsAsync();
      return response.granted;
    } catch (e) {
      console.warn('[VoiceRecorder] requestPermissions error:', e);
      return false;
    }
  }

  static async getPermissions() {
    try {
      const response = await getRecordingPermissionsAsync();
      return response.granted;
    } catch (e) {
      return false;
    }
  }

  static async configureAudioMode() {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (e) {
      console.warn('[VoiceRecorder] configureAudioMode error:', e);
    }
  }

  static async resetAudioMode() {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch (e) {
      console.warn('[VoiceRecorder] resetAudioMode error:', e);
    }
  }

  async start() {
    await VoiceRecorder.configureAudioMode();

    if (this.recorder) {
      try {
        await this.stop();
      } catch (_) {}
    }

    const basePreset = RecordingPresets.HIGH_QUALITY;
    const platformOptions = {
      extension: basePreset.extension || '.m4a',
      sampleRate: basePreset.sampleRate || 44100,
      numberOfChannels: basePreset.numberOfChannels || 1,
      bitRate: basePreset.bitRate || 128000,
      isMeteringEnabled: true,
      ...(Platform.OS === 'ios' ? basePreset.ios : basePreset.android),
    };

    this.recorder = new AudioModule.AudioRecorder(platformOptions);
    await this.recorder.prepareToRecordAsync(platformOptions);
    this.recorder.record();
    this.isRecording = true;

    // Optional event listener if supported
    try {
      if (typeof this.recorder.addListener === 'function') {
        this.subscription = this.recorder.addListener('recordingStatusUpdate', (status) => {
          if (!this.isRecording) return;
          this.emitStatus(status);
        });
      }
    } catch (_) {}

    // Polling interval ensures consistent 250ms cadence for Voice Activity Detection (VAD)
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.recorder || !this.isRecording) return;
      try {
        const status = this.recorder.getStatus();
        if (status) {
          this.emitStatus(status);
        }
      } catch (_) {}
    }, 250);

    return this.recorder;
  }

  emitStatus(status) {
    if (!this.onStatusUpdate) return;
    this.onStatusUpdate({
      isRecording: Boolean(status?.isRecording),
      durationMillis: status?.durationMillis || 0,
      metering: typeof status?.metering === 'number' ? status.metering : -100,
      url: status?.url || this.recorder?.uri || null,
    });
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.subscription) {
      try {
        this.subscription.remove();
      } catch (_) {}
      this.subscription = null;
    }

    this.isRecording = false;

    if (!this.recorder) {
      return null;
    }

    try {
      await this.recorder.stop();
      const uri = this.recorder.uri;
      this.recorder = null;
      return uri;
    } catch (err) {
      console.warn('[VoiceRecorder] stop error:', err);
      const uri = this.recorder?.uri || null;
      this.recorder = null;
      return uri;
    }
  }

  getURI() {
    return this.recorder?.uri || null;
  }
}

/**
 * Safely delete a temporary local audio recording file from the device filesystem.
 * Handles both file:// URIs and raw paths idempotently without throwing.
 */
export const deleteAudioFileAsync = async (uri) => {
  if (!uri || typeof uri !== 'string') return;
  try {
    const FileSystem = require('expo-file-system');
    if (FileSystem && typeof FileSystem.deleteAsync === 'function') {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (err) {
    // Non-fatal if file was already moved or removed by the OS
    console.warn('[VoiceRecorder] Audio file deletion note:', err?.message);
  }
};

VoiceRecorder.deleteAudioFileAsync = deleteAudioFileAsync;

export {
  VoiceRecorder,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
};
export default VoiceRecorder;
