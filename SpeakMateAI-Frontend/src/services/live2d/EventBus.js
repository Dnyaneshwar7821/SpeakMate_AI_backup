/**
 * Decoupled Event Bus for Avatar System
 * Handles event pub/sub for avatar state updates (AvatarLoaded, SpeechStarted, etc.)
 */

export const AVATAR_EVENTS = {
  MODEL_LOADED: 'AvatarLoaded',
  MODEL_ERROR: 'AvatarError',
  SPEECH_STARTED: 'SpeechStarted',
  SPEECH_FINISHED: 'SpeechFinished',
  EXPRESSION_CHANGED: 'ExpressionChanged',
  MOTION_STARTED: 'MotionStarted',
  MOTION_FINISHED: 'MotionFinished',
  LIP_SYNC_UPDATE: 'LipSyncUpdate',
  GENDER_CHANGED: 'GenderChanged',
};

class EventBusService {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscriber function
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EventBus] Error executing listener for event '${event}':`, err);
        }
      });
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export const EventBus = new EventBusService();
