import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { ModelLoader } from '../../services/live2d/ModelLoader';
import { DoraemonPuppet } from './DoraemonPuppet';
import { SuperheroPuppet } from './SuperheroPuppet';
import { MotuPuppet } from './MotuPuppet';
import { PuppyPuppet } from './PuppyPuppet';
import { ShizukaPuppet } from './ShizukaPuppet';
import { SpongeBobPuppet } from './SpongeBobPuppet';
import { ChhotaBheemPuppet } from './ChhotaBheemPuppet';
import { BenTenPuppet } from './BenTenPuppet';
import { NinjaHattoriPuppet } from './NinjaHattoriPuppet';
import { TomPuppet } from './TomPuppet';
import { TeacherPuppet } from './TeacherPuppet';
import { MaleTeacherPuppet } from './MaleTeacherPuppet';
import { DEFAULT_AVATAR_CONFIG } from '../../config/AvatarConfig';
import { getCurrentVoiceGender, resolveAvatarFromVoice } from '../../utils/speechHelper';
import { EventBus, AVATAR_EVENTS } from '../../services/live2d/EventBus';

import { useLipSync } from '../../hooks/useLipSync';
import { getAvatarById, AVATAR_CATALOG } from '../../config/AvatarCatalog';
import { getActiveTutorSync } from '../../services/ActiveTutorService';

// Make PIXI available on window for Live2D SDK Cubism integration
if (typeof window !== 'undefined' && !window.PIXI) {
  window.PIXI = PIXI;
}

class AvatarErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.warn('[AvatarCanvas] Caught runtime error in avatar canvas:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="relative w-full h-full min-h-[350px] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3 animate-pulse">
            🎙️
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Voice Tutor Ready</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Audio practice mode active</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function AvatarCanvasInner({ model, modelPath, onModelLoaded, onError, className = '', framing = 'faceToChest', isSpeaking = false }) {
  const containerRef = useRef(null);
  const pixiAppRef = useRef(null);
  const modelRef = useRef(null);
  const [modelInstance, setModelInstance] = useState(null);
  const [activeModelKey, setActiveModelKey] = useState(() => {
    return model || getActiveTutorSync().avatarModel || localStorage.getItem('speakmate_avatar_model') || resolveAvatarFromVoice(localStorage.getItem('speakmate_ai_voice')).model || getCurrentVoiceGender() || 'haru';
  });

  // Automatic Lip-Sync & Viseme Hook
  useLipSync(modelInstance, isSpeaking);

  useEffect(() => {
    if (model) {
      setActiveModelKey(model);
    }
  }, [model]);

  useEffect(() => {
    const unsubGender = EventBus.on(AVATAR_EVENTS.GENDER_CHANGED, (data) => {
      const chosen = data?.model || data?.gender || model || localStorage.getItem('speakmate_avatar_model') || resolveAvatarFromVoice(localStorage.getItem('speakmate_ai_voice')).model || 'haru';
      setActiveModelKey(chosen);
    });
    return () => unsubGender();
  }, [model]);

  const catalogEntry = getAvatarById(activeModelKey);
  const isPuppet = catalogEntry.type === 'puppet';
  const isPuppy = isPuppet && (catalogEntry.puppetType === 'puppy' || catalogEntry.id === 'puppy');
  const isTom = isPuppet && (catalogEntry.puppetType === 'tom' || catalogEntry.id === 'haruto' || catalogEntry.id === 'tom');
  const isRoboPaws = isPuppet && (catalogEntry.puppetType === 'doraemon' || catalogEntry.id === 'robopaws' || catalogEntry.id === 'doraemon');
  const isBheem = isPuppet && (catalogEntry.puppetType === 'chhotabheem' || catalogEntry.id === 'sparky' || catalogEntry.id === 'bheem');
  const isSuperhero = isPuppet && (catalogEntry.puppetType === 'superhero' || catalogEntry.id === 'hero');
  const isMotu = isPuppet && (catalogEntry.puppetType === 'motu' || catalogEntry.id === 'motu');
  const isShizuka = isPuppet && (catalogEntry.puppetType === 'shizuka' || catalogEntry.id === 'shizuku' || catalogEntry.id === 'shizuka');
  const isSpongeBob = isPuppet && (catalogEntry.puppetType === 'spongebob' || catalogEntry.id === 'spongebob');
  const isBenTen = isPuppet && (catalogEntry.puppetType === 'benten' || catalogEntry.id === 'mao');
  const isHattori = isPuppet && (catalogEntry.puppetType === 'ninjahattori' || catalogEntry.id === 'koharu' || catalogEntry.id === 'hattori');
  const isTeacher = isPuppet && (catalogEntry.puppetType === 'teacher' || catalogEntry.id === 'haru' || catalogEntry.id === 'teacher');
  const isMaleTeacher = isPuppet && (catalogEntry.puppetType === 'maleTeacher' || catalogEntry.id === 'chitose' || catalogEntry.id === 'maleteacher');
  const targetModelPath = modelPath || catalogEntry.modelPath || AVATAR_CATALOG.chitose?.modelPath;

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    const container = containerRef.current;

    // Create PixiJS Application
    const app = new PIXI.Application({
      width: container.clientWidth || DEFAULT_AVATAR_CONFIG.canvas.width,
      height: container.clientHeight || DEFAULT_AVATAR_CONFIG.canvas.height,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      backgroundAlpha: 0,
      antialias: true,
    });

    pixiAppRef.current = app;
    container.appendChild(app.view);

    if (isPuppet) {
      const puppet = isMaleTeacher
        ? new MaleTeacherPuppet()
        : isTeacher
        ? new TeacherPuppet()
        : isPuppy
        ? new PuppyPuppet()
        : isTom
        ? new TomPuppet()
        : isBheem
        ? new ChhotaBheemPuppet()
        : isBenTen
        ? new BenTenPuppet()
        : isHattori
        ? new NinjaHattoriPuppet()
        : isSuperhero
        ? new SuperheroPuppet()
        : isMotu
        ? new MotuPuppet()
        : isShizuka
        ? new ShizukaPuppet()
        : isSpongeBob
        ? new SpongeBobPuppet()
        : new DoraemonPuppet();
      app.stage.addChild(puppet);
      modelRef.current = puppet;
      setModelInstance(puppet);

      const resizePuppet = () => {
        if (!app || !app.renderer || !container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        app.renderer.resize(width, height);
        const scale = isMaleTeacher
          ? Math.min((width * 0.88) / 230, (height * 0.82) / 270)
          : isTeacher
          ? Math.min((width * 0.88) / 230, (height * 0.82) / 270)
          : isPuppy
          ? Math.min((width * 0.88) / 220, (height * 0.82) / 270)
          : isTom
          ? Math.min((width * 0.88) / 220, (height * 0.82) / 270)
          : isHattori
          ? Math.min((width * 0.88) / 220, (height * 0.82) / 270)
          : isBheem
          ? Math.min((width * 0.88) / 230, (height * 0.80) / 280)
          : isBenTen
          ? Math.min((width * 0.88) / 230, (height * 0.80) / 280)
          : isSuperhero
          ? Math.min((width * 0.90) / 240, (height * 0.85) / 280)
          : isMotu
          ? Math.min((width * 0.88) / 230, (height * 0.82) / 270)
          : isShizuka
          ? Math.min((width * 0.88) / 230, (height * 0.82) / 270)
          : isSpongeBob
          ? Math.min((width * 0.88) / 230, (height * 0.82) / 270)
          : Math.min((width * 0.85) / 220, (height * 0.80) / 260);
        puppet.scale.set(scale, scale);
        puppet.x = width / 2;
        puppet.y = isMaleTeacher
          ? height * 0.48
          : isTeacher
          ? height * 0.50
          : isPuppy
          ? height * 0.50
          : isTom
          ? height * 0.50
          : isHattori
          ? height * 0.50
          : isBheem
          ? height * 0.49
          : isBenTen
          ? height * 0.50
          : isShizuka
          ? height * 0.52
          : isSpongeBob
          ? height * 0.50
          : height * 0.50;
      };

      resizePuppet();
      window.addEventListener('resize', resizePuppet);

      const tickerFn = () => {
        puppet.update(performance.now());
      };
      app.ticker.add(tickerFn);

      if (onModelLoaded) onModelLoaded(puppet);

      return () => {
        isMounted = false;
        window.removeEventListener('resize', resizePuppet);
        app.ticker.remove(tickerFn);
        setModelInstance(null);
        if (modelRef.current) {
          try { modelRef.current.destroy({ children: true }); } catch (e) {}
          modelRef.current = null;
        }
        if (app) {
          try { app.destroy(true, { children: true, texture: true, baseTexture: true }); } catch (e) {}
          pixiAppRef.current = null;
        }
        if (container && container.contains(app?.view)) {
          try { container.removeChild(app.view); } catch (e) {}
        }
      };
    }

    // Resize Handler for all Live2D Models
    const handleResize = () => {
      if (!app || !app.renderer || !container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      app.renderer.resize(width, height);

      if (modelRef.current) {
        const model = modelRef.current;
        const nativeHeight = model.internalModel?.height || model.height || 1000;
        const isAnimal = catalogEntry.id === 'wanko' || catalogEntry.id === 'tororo' || catalogEntry.id === 'puppy';

        if (isAnimal) {
          if (model.anchor) {
            model.anchor.set(0.5, 0.0);
          }
          const scaleMultiplier = catalogEntry.scaleMultiplier || 1.35;
          const scale = (height * scaleMultiplier) / nativeHeight;
          model.scale.set(scale, scale);
          model.x = width / 2;
          const yOffset = catalogEntry.yOffsetRatio ?? 0.08;
          model.y = Math.max(6, height * yOffset);
        } else {
          if (model.anchor) {
            model.anchor.set(0.5, 0.0);
          }
          const isShizuku = catalogEntry.id === 'shizuku';
          const isFullBody = catalogEntry.id === 'haru' || catalogEntry.id === 'chitose';
          const scaleMultiplier = catalogEntry.scaleMultiplier || (isShizuku ? 1.18 : (isFullBody ? 3.1 : 1.05));
          const scale = (height * scaleMultiplier) / nativeHeight;
          model.scale.set(scale, scale);
          model.x = width / 2;
          const yOffset = catalogEntry.yOffsetRatio ?? (isShizuku ? 0.02 : (isFullBody ? -0.13 : 0.10));
          model.y = isFullBody ? Math.round(height * yOffset) : Math.max(8, height * yOffset);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Load Live2D Model
    ModelLoader.loadModel(targetModelPath, app)
      .then((loadedModel) => {
        if (!isMounted) return;
        
        // Prevent PixiJS v7 EventBoundary isInteractive recursion errors
        loadedModel.interactive = false;
        loadedModel.interactiveChildren = false;
        loadedModel.eventMode = 'none';
        loadedModel.isInteractive = () => false;

        modelRef.current = loadedModel;
        setModelInstance(loadedModel);
        handleResize();
        if (onModelLoaded) {
          onModelLoaded(loadedModel);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('[AvatarCanvas] Error loading Live2D model:', err);
        if (onError) {
          onError(err);
        }
      });

    // Cleanup on unmount
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      setModelInstance(null);

      if (modelRef.current) {
        ModelLoader.destroyModel(modelRef.current);
        modelRef.current = null;
      }

      if (app) {
        try {
          app.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (e) {
          // ignore
        }
        pixiAppRef.current = null;
      }

      if (container && container.contains(app?.view)) {
        try {
          container.removeChild(app.view);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [targetModelPath, activeModelKey, isPuppet]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[350px] flex items-center justify-center overflow-hidden ${className}`}
      style={{
        touchAction: 'none',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 72%, transparent 95%)',
        maskImage: 'linear-gradient(to bottom, black 0%, black 72%, transparent 95%)',
      }}
    />
  );
}

export function AvatarCanvas(props) {
  const [currentModel, setCurrentModel] = useState(() => {
    return props.model || getActiveTutorSync().avatarModel || localStorage.getItem('speakmate_avatar_model') || resolveAvatarFromVoice(localStorage.getItem('speakmate_ai_voice')).model || getCurrentVoiceGender() || 'haru';
  });

  useEffect(() => {
    if (props.model) setCurrentModel(props.model);
  }, [props.model]);

  useEffect(() => {
    const unsub = EventBus.on(AVATAR_EVENTS.GENDER_CHANGED, (data) => {
      const chosen = data?.model || data?.gender || props.model || localStorage.getItem('speakmate_avatar_model') || resolveAvatarFromVoice(localStorage.getItem('speakmate_ai_voice')).model || 'haru';
      setCurrentModel(chosen);
    });
    return () => unsub();
  }, [props.model]);

  return (
    <AvatarErrorBoundary>
      <AvatarCanvasInner model={currentModel} {...props} />
    </AvatarErrorBoundary>
  );
}
