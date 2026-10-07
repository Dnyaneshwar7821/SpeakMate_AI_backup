import { useEffect, useRef } from 'react';
import { EventBus, AVATAR_EVENTS } from '../services/live2d/EventBus';
import { getPrimaryVisemeForWord } from '../utils/PhoneticVisemeEngine';

/**
 * Universal Parameter Applier for Cubism 2 (Chitose) and Cubism 4 (Haru)
 * Safely applies parameters directly to the CoreModel buffers every frame.
 */
function applyMouthParameters(model, yVal, formVal, isSpeaking = false) {
  if (!model) return;
  if (model.isMotuPuppet || model.isPuppyPuppet || model.isDoraemonPuppet || model.isSuperheroPuppet || typeof model.setMouthOpen === 'function' || 'mouthY' in model) {
    model.mouthY = yVal;
    model.mouthForm = formVal;
    model.isSpeaking = isSpeaking;
    if (typeof model.setMouthOpen === 'function') {
      model.setMouthOpen(yVal, formVal);
    }
    if (typeof model.setSpeaking === 'function') {
      model.setSpeaking(isSpeaking);
    }
    return;
  }
  if (!model.internalModel) return;
  
  const im = model.internalModel;
  const cm = im.coreModel;
  if (!cm) return;

  const t = performance.now() * 0.001;
  const vocalHeadY = isSpeaking ? Math.sin(t * 2.4) * 2.8 : 0;
  const vocalHeadZ = isSpeaking ? Math.cos(t * 1.5) * 1.8 : 0;
  const vocalBodyX = isSpeaking ? Math.sin(t * 1.1) * 1.4 : 0;

  // 1. Cubism 4 (Haru & Wanko)
  if (typeof cm.setParameterValueById === 'function') {
    try { cm.setParameterValueById('ParamMouthOpenY', Math.max(0, Math.min(1.0, yVal))); } catch (_) {}
    try { cm.setParameterValueById('PARAM_MOUTH_OPEN_Y', Math.max(0, Math.min(1.0, yVal))); } catch (_) {}
    try { cm.setParameterValueById('ParamMouthForm', Math.max(-1.0, Math.min(1.0, formVal))); } catch (_) {}
    try { cm.setParameterValueById('PARAM_MOUTH_FORM', Math.max(-1.0, Math.min(1.0, formVal))); } catch (_) {}
    if (isSpeaking) {
      try { cm.setParameterValueById('ParamAngleY', vocalHeadY); } catch (_) {}
      try { cm.setParameterValueById('PARAM_ANGLE_Y', vocalHeadY); } catch (_) {}
      try { cm.setParameterValueById('ParamAngleZ', vocalHeadZ); } catch (_) {}
      try { cm.setParameterValueById('PARAM_ANGLE_Z', vocalHeadZ); } catch (_) {}
      try { cm.setParameterValueById('ParamBodyAngleX', vocalBodyX); } catch (_) {}
      try { cm.setParameterValueById('PARAM_BODY_ANGLE_X', vocalBodyX); } catch (_) {}
      try { cm.setParameterValueById('PARAM_EAR_L', Math.sin(t * 3.2) * 0.5); } catch (_) {}
      try { cm.setParameterValueById('PARAM_EAR_R', Math.cos(t * 3.2) * 0.5); } catch (_) {}
      try { cm.setParameterValueById('PARAM_HAND_L', Math.sin(t * 2.5) * 0.3); } catch (_) {}
      try { cm.setParameterValueById('PARAM_HAND_R', Math.cos(t * 2.5) * 0.3); } catch (_) {}
    }
  }
  
  // 2. Cubism 2 (Chitose & Robo-Paws & Wanko)
  if (typeof cm.setParamFloat === 'function') {
    const clampedY = Math.max(0, Math.min(1.0, yVal));
    try { cm.setParamFloat('PARAM_MOUTH_OPEN_Y', clampedY, 1.0); } catch (_) {}
    try { cm.setParamFloat('PARAM_MOUTH_OPEN', clampedY, 1.0); } catch (_) {}
    try { cm.setParamFloat('PARAM_MOUTH_A', clampedY, 1.0); } catch (_) {}
    try { cm.setParamFloat('PARAM_MOUTH_O', clampedY, 1.0); } catch (_) {}
    try { cm.setParamFloat('PARAM_MOUTH_FORM', Math.max(-1.0, Math.min(1.0, formVal)), 1.0); } catch (_) {}
    if (isSpeaking) {
      try { cm.setParamFloat('PARAM_ANGLE_Y', vocalHeadY, 1.0); } catch (_) {}
      try { cm.setParamFloat('PARAM_ANGLE_Z', vocalHeadZ, 1.0); } catch (_) {}
      try { cm.setParamFloat('PARAM_BODY_ANGLE_X', vocalBodyX, 1.0); } catch (_) {}
      try { cm.setParamFloat('PARAM_EAR_L', Math.sin(t * 3.2) * 0.5, 1.0); } catch (_) {}
      try { cm.setParamFloat('PARAM_EAR_R', Math.cos(t * 3.2) * 0.5, 1.0); } catch (_) {}
      try { cm.setParamFloat('PARAM_HAND_L', Math.sin(t * 2.5) * 0.3, 1.0); } catch (_) {}
      try { cm.setParamFloat('PARAM_HAND_R', Math.cos(t * 2.5) * 0.3, 1.0); } catch (_) {}
    }
  }
}

/**
 * useLipSync Custom Hook
 * Connects SpeechSynthesis & EventBus to Live2D avatars for perfect phonetic viseme sync.
 */
export function useLipSync(model, isSpeakingProp = false) {
  const currentMouthY = useRef(0);
  const currentMouthForm = useRef(0);
  const targetMouthYRef = useRef(0);
  const targetMouthFormRef = useRef(0);
  const activeSpeaking = useRef(isSpeakingProp);
  const rafRef = useRef(null);
  const lastWordTimeRef = useRef(0);
  const wordDurationRef = useRef(240);

  useEffect(() => {
    activeSpeaking.current = isSpeakingProp;
    if (!isSpeakingProp) {
      targetMouthYRef.current = 0;
      targetMouthFormRef.current = 0;
      currentMouthY.current = 0;
      currentMouthForm.current = 0;
      lastWordTimeRef.current = 0;
      if (model) {
        applyMouthParameters(model, 0, 0, false);
      }
    }
  }, [isSpeakingProp, model]);

  useEffect(() => {
    const unsubStart = EventBus.on(AVATAR_EVENTS.SPEECH_STARTED, () => {
      activeSpeaking.current = true;
      if (typeof window !== 'undefined') window._speakmate_ai_is_speaking = true;
      // Keep mouth at REST until the first actual word arrives
      targetMouthYRef.current = 0;
      targetMouthFormRef.current = 0;
      lastWordTimeRef.current = 0;
    });

    const unsubWord = EventBus.on(AVATAR_EVENTS.LIP_SYNC_UPDATE, (data) => {
      activeSpeaking.current = true;
      if (typeof window !== 'undefined') window._speakmate_ai_is_speaking = true;

      const word = data?.word || '';
      if (word) {
        const visemeObj = (data?.yVal !== undefined && data?.formVal !== undefined)
          ? { yVal: data.yVal, formVal: data.formVal }
          : getPrimaryVisemeForWord(word);

        targetMouthYRef.current = Math.max(0.25, Math.min(1.0, visemeObj.yVal !== undefined ? visemeObj.yVal : 0.80));
        targetMouthFormRef.current = Math.max(-1.0, Math.min(1.0, visemeObj.formVal !== undefined ? visemeObj.formVal : 0.0));
        lastWordTimeRef.current = performance.now();

        // Calculate natural word articulation duration based on length: ~180ms to 320ms
        const len = word.length;
        wordDurationRef.current = Math.max(180, Math.min(320, len * 42));
      }
    });

    const unsubEnd = EventBus.on(AVATAR_EVENTS.SPEECH_FINISHED, () => {
      activeSpeaking.current = false;
      if (typeof window !== 'undefined') {
        window._speakmate_ai_is_speaking = false;
      }
      targetMouthYRef.current = 0;
      targetMouthFormRef.current = 0;
      currentMouthY.current = 0;
      currentMouthForm.current = 0;
      lastWordTimeRef.current = 0;
      if (model) {
        applyMouthParameters(model, 0, 0, false);
      }
    });

    return () => {
      if (typeof unsubStart === 'function') unsubStart();
      if (typeof unsubWord === 'function') unsubWord();
      if (typeof unsubEnd === 'function') unsubEnd();
    };
  }, [model]);

  // Frame update loop (Continuous 60 FPS)
  useEffect(() => {
    const updateStateLoop = () => {
      const now = performance.now();
      const isSpeaking = Boolean(
        activeSpeaking.current ||
        isSpeakingProp ||
        (typeof window !== 'undefined' && window._speakmate_ai_is_speaking)
      );

      let targetMouthY = 0;
      let targetMouthForm = 0;

      if (isSpeaking) {
        if (lastWordTimeRef.current > 0) {
          const elapsed = now - lastWordTimeRef.current;
          const duration = wordDurationRef.current || 240;

          if (elapsed < duration) {
            // Word is actively being pronounced: natural vocalic syllable envelope
            const progress = elapsed / duration;
            const envelope = Math.sin(progress * Math.PI);
            targetMouthY = targetMouthYRef.current * envelope;
            targetMouthForm = targetMouthFormRef.current;
          } else {
            // Discrete word envelope finished or ticker paused, but AI audio is STILL speaking:
            // Sustain natural human vocalic cadence (~3.8 Hz syllable wave modulated by a 1.4 Hz phrasing wave)
            // so mouth moves naturally and never locks shut mid-speech
            const t = now * 0.001;
            const syllablePhase = t * 3.8 * Math.PI * 2;
            const rawSyllable = Math.max(0, Math.sin(syllablePhase));
            const phrasingStress = 0.5 + 0.5 * Math.sin(t * 1.4 * Math.PI * 2);
            targetMouthY = rawSyllable * (0.35 + 0.42 * phrasingStress);
            targetMouthForm = Math.sin(t * 2.2) * 0.25;
          }
        } else {
          // isSpeaking is true right from utterance start before first word viseme lands:
          // Immediately animate mouth with vocal cadence so avatar speaks without initial freeze
          const t = now * 0.001;
          const syllablePhase = t * 3.8 * Math.PI * 2;
          const rawSyllable = Math.max(0, Math.sin(syllablePhase));
          targetMouthY = rawSyllable * 0.52;
          targetMouthForm = 0;
        }
      }

      if (!isSpeaking) {
        currentMouthY.current = 0;
        currentMouthForm.current = 0;
      } else {
        // Fast-attack lerp on opening (0.65), swift crisp release on closing (0.55)
        const isOpening = targetMouthY > currentMouthY.current;
        const lerpSpeed = isOpening ? 0.65 : 0.55;
        currentMouthY.current += (targetMouthY - currentMouthY.current) * lerpSpeed;
        currentMouthForm.current += (targetMouthForm - currentMouthForm.current) * lerpSpeed;

        if (targetMouthY === 0 && currentMouthY.current < 0.05) {
          currentMouthY.current = 0;
          currentMouthForm.current = 0;
        }
      }

      // Apply directly to model core
      if (model) {
        const isActuallyActive = isSpeaking && currentMouthY.current > 0.02;
        applyMouthParameters(model, currentMouthY.current, currentMouthForm.current, isActuallyActive);
      }

      rafRef.current = requestAnimationFrame(updateStateLoop);
    };

    rafRef.current = requestAnimationFrame(updateStateLoop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [model, isSpeakingProp]);

  // Hook motionManager update to guarantee mouth parameter overrides motion curves
  useEffect(() => {
    if (!model || !model.internalModel || !model.internalModel.motionManager) return;

    const motionManager = model.internalModel.motionManager;
    const originalMotionUpdate = motionManager.update ? motionManager.update.bind(motionManager) : null;

    if (originalMotionUpdate) {
      motionManager.update = function (coreModel, now) {
        originalMotionUpdate(coreModel, now);
        const isSpeaking = Boolean(
          activeSpeaking.current ||
          isSpeakingProp ||
          (typeof window !== 'undefined' && window._speakmate_ai_is_speaking)
        );
        const isActuallyActive = isSpeaking && currentMouthY.current > 0.02;
        applyMouthParameters(model, currentMouthY.current, currentMouthForm.current, isActuallyActive);
      };
    }

    return () => {
      if (originalMotionUpdate && model && model.internalModel && model.internalModel.motionManager) {
        model.internalModel.motionManager.update = originalMotionUpdate;
      }
    };
  }, [model, isSpeakingProp]);
}

export default useLipSync;
