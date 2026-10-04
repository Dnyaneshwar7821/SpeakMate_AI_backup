import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Live2DAvatarView from '../avatar/Live2DAvatarView';
import NativeAvatarView from '../avatar/NativeAvatarView';
import { getAvatarById } from '../../config/AvatarCatalog';

const BAR_COUNT = 5;

export const STATE_CONFIG = {
  idle: {
    glowCenter: 'rgba(139, 92, 246, 0.12)',
    glowOuter:  'rgba(139, 92, 246, 0.0)',
    innerRing:  'rgba(192, 132, 252, 0.35)',
    outerRing:  'rgba(139, 92, 246, 0.18)',
    ringGlow:   '#8B5CF6',
    dot:        '#A855F7',
    label:      'Ready',
    pulseSpeed: 2800,
  },
  paused: {
    glowCenter: 'rgba(245, 158, 11, 0.12)',
    glowOuter:  'rgba(245, 158, 11, 0.0)',
    innerRing:  'rgba(252, 211, 77, 0.40)',
    outerRing:  'rgba(245, 158, 11, 0.20)',
    ringGlow:   '#F59E0B',
    dot:        '#FBBF24',
    label:      'Paused',
    pulseSpeed: 3000,
  },
  listening: {
    glowCenter: 'rgba(6, 182, 212, 0.16)',
    glowOuter:  'rgba(6, 182, 212, 0.0)',
    innerRing:  'rgba(103, 232, 249, 0.50)',
    outerRing:  'rgba(6, 182, 212, 0.25)',
    ringGlow:   '#06B6D4',
    dot:        '#22D3EE',
    label:      'Listening...',
    pulseSpeed: 1000,
  },
  thinking: {
    glowCenter: 'rgba(168, 85, 247, 0.14)',
    glowOuter:  'rgba(168, 85, 247, 0.0)',
    innerRing:  'rgba(192, 132, 252, 0.45)',
    outerRing:  'rgba(168, 85, 247, 0.22)',
    ringGlow:   '#9333EA',
    dot:        '#C084FC',
    label:      'Thinking...',
    pulseSpeed: 1400,
  },
  speaking: {
    glowCenter: 'rgba(244, 114, 182, 0.18)',
    glowOuter:  'rgba(192, 132, 252, 0.0)',
    innerRing:  'rgba(244, 114, 182, 0.55)',
    outerRing:  'rgba(192, 132, 252, 0.28)',
    ringGlow:   '#F472B6',
    dot:        '#F472B6',
    label:      'Speaking',
    pulseSpeed: 600,
  },
};

// ── Animated Waveform Bar for Status Pill ─────────────────────────────────────
function WaveBar({ delay, isSpeaking }) {
  const anim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    let animInstance = null;
    let frameId = null;

    if (isSpeaking) {
      frameId = requestAnimationFrame(() => {
        animInstance = Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 240, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.2, duration: 240, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        );
        animInstance.start();
      });
    } else {
      anim.setValue(0.25);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (animInstance) animInstance.stop();
    };
  }, [isSpeaking, delay]);

  const scaleY = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  return <Animated.View style={[styles.waveBar, { transform: [{ scaleY }] }]} />;
}

// ── Thinking Animated Dots ────────────────────────────────────────────────────
function ThinkingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createAnim = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(400),
        ])
      );

    const a1 = createAnim(dot1, 0);
    const a2 = createAnim(dot2, 150);
    const a3 = createAnim(dot3, 300);

    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.thinkingDot, { opacity: dot1, transform: [{ scale: dot1 }] }]} />
      <Animated.View style={[styles.thinkingDot, { opacity: dot2, transform: [{ scale: dot2 }] }]} />
      <Animated.View style={[styles.thinkingDot, { opacity: dot3, transform: [{ scale: dot3 }] }]} />
    </View>
  );
}

// ── Target Stage Dimensions (Dual Halo: 172px Inner & 232px Outer) ───────────
const INNER_RING_SIZE = 172; // Inner Neon Halo Ring
const OUTER_RING_SIZE = 232; // Outer Luminous Halo Ring
const AVATAR_WIDTH    = 320; // Ample width for full ponytail & both shoulders
const AVATAR_HEIGHT   = 224; // Generous height with natural headroom matching halo stage

// ── Main AIAvatar Component (Dual Concentric Halo & Cosmic Studio) ────────────
export default function AIAvatar({
  gender     = 'female',
  model,
  isSpeaking = false,
  spokenText = '',
  speechSpeed = 1.0,
  state      = 'idle',
  expression,
  style,
  hideStatusPill = false,
  showOnlyPill = false,
  forceStatic = false,
}) {
  const avatarObj = getAvatarById(model || gender);
  const targetModel = avatarObj.id;
  const resolvedState = isSpeaking ? 'speaking' : state;
  const config        = STATE_CONFIG[resolvedState] || STATE_CONFIG.idle;
  const isHappy       = expression === 'happy' || expression === 'encouraging';

  const [useLive2D, setUseLive2D] = useState(!forceStatic);
  const [live2dReady, setLive2dReady] = useState(false);
  const [live2dError, setLive2dError] = useState(false);
  
  const isLive2DModel = true;
  const defaultEngine = 'live2d';
  const [engineOverride, setEngineOverride] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('speakmate_avatar_engine').then((engine) => {
      if (engine === 'live2d' || engine === 'native') setEngineOverride(engine);
    }).catch(() => {});
  }, []);

  const avatarEngine = engineOverride || defaultEngine;

  useEffect(() => {
    setLive2dError(false);
    setLive2dReady(false);
    // Safety guard: guarantee spinner is dismissed within 3.5s even on slow network
    const timer = setTimeout(() => {
      setLive2dReady(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [targetModel]);

  useEffect(() => {
    AsyncStorage.getItem('speakmate_avatar_mode').then((val) => {
      if (val === 'static') setUseLive2D(false);
      else if (!forceStatic) setUseLive2D(true);
    }).catch(() => {});
  }, [forceStatic]);

  // ── Animated Values ─────────────────────────────────────────────────────────
  const entranceAnim   = useRef(new Animated.Value(0)).current;
  const breatheAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim      = useRef(new Animated.Value(0)).current;

  // 1. Entrance Spring
  useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  // 2. Idle Natural Breathing Motion (Slow, Organic Floating ±2px)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // 3. Continuous Ambient Glow Pulse (Mounted once, zero loop teardown/restart on state changes)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Interpolations ─────────────────────────────────────────────────────────
  const entranceScale   = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const entranceOpacity = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Floating: ±2.0px
  const floatY = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [-2.0, 2.0] });
  
  // Presence Scale
  const stateScale = resolvedState === 'listening' ? 1.02 : resolvedState === 'speaking' ? 1.015 : 1.0;
  const breatheScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.008] });

  // Diffused Glow (Soft, translucent ambient halo)
  const glowScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.04] });
  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: isSpeaking ? [0.45, 0.65] : resolvedState === 'listening' ? [0.35, 0.55] : [0.20, 0.35],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: entranceOpacity,
          transform: [{ scale: entranceScale }],
        },
      ]}
    >
      {/* ── STAGE WRAPPER (Centered & Responsive) ── */}
      <View style={styles.stageWrapper}>
        
        {/* ── Layer 1: Soft Ambient Studio Spotlight Bloom ── */}
        <Animated.View
          style={[
            styles.ambientGlowContainer,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }, { translateY: floatY }],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', config.glowCenter, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.diffuseGlowGradient}
          />
        </Animated.View>

        {/* ── Layer 2: Ethereal Sound Wave Energy Aura (Subtle Curves) ── */}
        <Animated.View pointerEvents="none" style={[styles.soundWaveAura, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['transparent', 'rgba(168, 85, 247, 0.12)', 'rgba(139, 92, 246, 0.06)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.soundWaveGradient}
          />
        </Animated.View>

        {/* ── Layer 3: Luminous Outer Neon Halo Ring (232px) ── */}
        <Animated.View
          style={[
            styles.outerHaloRing,
            {
              borderColor: config.outerRing,
              shadowColor: config.ringGlow,
              opacity: glowOpacity,
              transform: [{ translateY: floatY }],
            },
          ]}
        />

        {/* ── Layer 4: Luminous Inner Neon Halo Ring (172px Centered behind Head) ── */}
        <Animated.View
          style={[
            styles.innerHaloRing,
            {
              borderColor: config.innerRing,
              shadowColor: config.ringGlow,
              opacity: glowOpacity,
              transform: [{ translateY: floatY }],
            },
          ]}
        />

        {/* ── Layer 5: Ambient Celestial Sparkle Dust ── */}
        <Animated.View pointerEvents="none" style={[styles.starsOverlay, { opacity: glowOpacity }]}>
          <Ionicons name="sparkles" size={9} color="#E9D5FF" style={[styles.starIcon, { top: 16, left: 38 }]} />
          <Ionicons name="sparkles" size={8} color="#C084FC" style={[styles.starIcon, { top: 42, right: 34 }]} />
          <Ionicons name="sparkles" size={7} color="#A78BFA" style={[styles.starIcon, { bottom: 50, left: 24 }]} />
          <Ionicons name="sparkles" size={8} color="#F472B6" style={[styles.starIcon, { bottom: 56, right: 28 }]} />
        </Animated.View>

        {/* ── Layer 6: Clean Upper-Bust Avatar Canvas (Head to Mid-Chest) ── */}
        <Animated.View
          style={[
            styles.avatarContainer,
            {
              transform: [
                { translateY: floatY },
                { scale: Animated.multiply(breatheScale, new Animated.Value(stateScale)) },
              ],
            },
          ]}
        >
          {avatarEngine === 'live2d' && !live2dError ? (
            <>
              <Live2DAvatarView
                key={targetModel}
                isSpeaking={isSpeaking}
                spokenText={spokenText}
                speechSpeed={speechSpeed}
                state={resolvedState}
                mood={isHappy ? 'happy' : 'neutral'}
                model={targetModel}
                style={styles.avatarCanvas}
                onLoaded={() => setLive2dReady(true)}
                onError={() => {
                  setLive2dError(true);
                  setLive2dReady(true);
                }}
              />

              {!live2dReady && (
                <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }]}>
                  <ActivityIndicator size="small" color="#A855F7" />
                </View>
              )}
            </>
          ) : (
            <NativeAvatarView
              key={targetModel}
              isSpeaking={isSpeaking}
              spokenText={spokenText}
              speechSpeed={speechSpeed}
              state={resolvedState}
              mood={isHappy ? 'happy' : 'neutral'}
              model={targetModel}
              style={styles.avatarCanvas}
            />
          )}

          {/* ── Synchronized Torso Dissolve (Moves with Avatar to guarantee zero gap) ── */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              'transparent',
              'rgba(7, 10, 18, 0.0)',
              'rgba(7, 10, 18, 0.35)',
              'rgba(7, 10, 18, 0.75)',
              'rgba(7, 10, 18, 0.98)',
              '#070A12',
            ]}
            locations={[0, 0.20, 0.48, 0.76, 0.92, 1.0]}
            style={styles.softTorsoDissolve}
          />
        </Animated.View>

        {/* ── Layer 7: Stationary Base Floor Fade (Anchored to Stage Floor) ── */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            'transparent',
            'rgba(7, 10, 18, 0.0)',
            'rgba(7, 10, 18, 0.35)',
            'rgba(7, 10, 18, 0.75)',
            'rgba(7, 10, 18, 0.98)',
            '#070A12',
          ]}
          locations={[0, 0.20, 0.48, 0.76, 0.92, 1.0]}
          style={styles.softTorsoDissolve}
        />
      </View>

      {/* ── Layer 8: Glassmorphic State / Speaking Pill (Stable, anchored in pink box zone) ── */}
      {!hideStatusPill && (
        <Animated.View
          style={[
            styles.statusPill,
            {
              borderColor: `${config.ringGlow}40`,
              shadowColor: config.ringGlow,
            },
          ]}
        >
          {resolvedState === 'speaking' ? (
            <>
              <View style={styles.waveRow}>
                {Array.from({ length: BAR_COUNT }).map((_, i) => (
                  <WaveBar key={i} delay={i * 70} isSpeaking={isSpeaking} />
                ))}
              </View>
              <Text style={[styles.statusText, { color: '#F3E8FF' }]}>Speaking</Text>
            </>
          ) : resolvedState === 'thinking' ? (
            <>
              <ThinkingDots />
              <Text style={[styles.statusText, { color: '#E9D5FF' }]}>Thinking</Text>
            </>
          ) : (
            <>
              <View style={[styles.statusDot, { backgroundColor: config.dot, shadowColor: config.dot }]} />
              <Text style={[styles.statusText, { color: '#E9D5FF' }]}>{config.label}</Text>
            </>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width:          '100%',
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },

  stageWrapper: {
    width:          '100%',
    height:         AVATAR_HEIGHT,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
    overflow:       'visible',
  },

  // 1. Diffused Soft Ambient Radial Glow
  ambientGlowContainer: {
    position:        'absolute',
    width:           OUTER_RING_SIZE + 40,
    height:          OUTER_RING_SIZE + 40,
    borderRadius:    (OUTER_RING_SIZE + 40) / 2,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  diffuseGlowGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: (OUTER_RING_SIZE + 40) / 2,
  },

  // 2. Ethereal Horizontal Sound Wave Energy Aura
  soundWaveAura: {
    position:   'absolute',
    width:      '100%',
    height:     70,
    top:        65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundWaveGradient: {
    width:  '100%',
    height: '100%',
  },

  // 3. Luminous Outer Neon Halo Ring (232px)
  outerHaloRing: {
    position:      'absolute',
    width:         OUTER_RING_SIZE,
    height:        OUTER_RING_SIZE,
    borderRadius:  OUTER_RING_SIZE / 2,
    borderWidth:   1.0,
    top:           -18,
    shadowOpacity: 0.35,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 0 },
  },

  // 4. Luminous Inner Neon Halo Ring (172px Centered on Face & Hair)
  innerHaloRing: {
    position:      'absolute',
    width:         INNER_RING_SIZE,
    height:        INNER_RING_SIZE,
    borderRadius:  INNER_RING_SIZE / 2,
    borderWidth:   1.2,
    top:           6,
    shadowOpacity: 0.45,
    shadowRadius:  10,
    shadowOffset:  { width: 0, height: 0 },
  },

  // 5. Ambient Stars & Sparkles
  starsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  starIcon: {
    position: 'absolute',
    shadowColor: '#FFF',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  // 6. Avatar Container & Canvas (Head to Chest Portrait, no hard bottom clipping)
  avatarContainer: {
    width:           '100%',
    height:          AVATAR_HEIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
    overflow:        'visible',
    backgroundColor: 'transparent',
    zIndex:          10,
  },
  avatarCanvas: {
    width:           '100%',
    height:          AVATAR_HEIGHT,
    backgroundColor: 'transparent',
  },

  // 7. Stationary & Moving Smooth Chest-Line Fade into Dark Background
  softTorsoDissolve: {
    position:     'absolute',
    width:        '100%',
    height:       76,
    bottom:       0,
    alignSelf:    'center',
    zIndex:       15,
  },

  // 8. Glassmorphic Status Pill (Anchored stably in pink box area, completely clear of chat)
  statusPill: {
    position:          'absolute',
    bottom:            10,
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    minWidth:          120,
    paddingHorizontal: 15,
    paddingVertical:   6.5,
    borderRadius:      22,
    backgroundColor:   'rgba(15, 23, 42, 0.85)',
    borderWidth:       1.5,
    shadowOpacity:     0.35,
    shadowRadius:      8,
    shadowOffset:      { width: 0, height: 2 },
    elevation:         6,
    zIndex:            25,
  },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: 0.3,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
    height:        16,
  },
  waveBar: {
    width:           3,
    height:          16,
    borderRadius:    2,
    backgroundColor: '#F472B6',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  thinkingDot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: '#C084FC',
  },
});
