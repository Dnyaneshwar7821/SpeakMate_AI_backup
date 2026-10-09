# SpeakMate AI - Live2D Avatar Technical Architecture & Documentation

## Overview

This documentation details the production-ready **Interactive Live2D AI Avatar System** built for **SpeakMate AI** using **React**, **PixiJS**, and **Web Audio API**.

The avatar provides real-time audio-driven lip sync, smooth cursor/touch head tracking, natural eye blinking, facial expression controls, motion animations, and abstract multi-provider speech/AI connections.

---

## Directory Structure

```
src/
├── config/
│   ├── AvatarConfig.js        # Live2D parameters, canvas defaults, tracking limits
│   ├── SpeechConfig.js        # Voice settings, pitch, TTS providers
│   ├── MotionConfig.js        # Motion & expression mappings
│   └── AIConfig.js            # LLM backend endpoints & prompts
├── utils/
│   ├── AudioAnalyzer.js       # Web Audio API AnalyserNode & amplitude math
│   ├── Interpolation.js       # Lerp math & normalized cursor coordinates
│   └── AnimationLoop.js       # 60 FPS tick manager
├── services/
│   ├── live2d/
│   │   ├── ModelLoader.js     # Live2D model loader & texture memory disposal
│   │   ├── ExpressionManager.js # Programmatic expression blending
│   │   ├── MotionManager.js   # Motion queues (Idle, Wave, Greeting, Speaking)
│   │   └── EventBus.js        # Pub/Sub event system
│   ├── speech/
│   │   └── SpeechService.js   # Web Speech API & OpenAI TTS + Audio Analyzer
│   └── ai/
│       └── AIService.js       # SpeakMate AI backend connector (secure server credentials)
├── hooks/
│   ├── useAvatar.js           # Reactive avatar state
│   ├── useLipSync.js          # ParamMouthOpenY audio binding
│   ├── useSpeech.js           # Speech playback state hook
│   ├── useMouseTracking.js    # Cursor/touch head rotation hook
│   ├── useBlink.js            # Natural blinking scheduler
│   ├── useExpressions.js      # Facial expression hook
│   └── useMotion.js           # Body/head animation hook
└── components/
    └── avatar/
        ├── AvatarCanvas.jsx   # PixiJS canvas mounting point
        ├── ExpressionPicker.jsx # Emotion debug & selector pill bar
        ├── AvatarStatusBadge.jsx # Real-time state indicator (Idle, Listening, Speaking)
        └── AvatarContainer.jsx  # Top-level unified avatar container
```

---

## Technical Workflows

### 1. Real-Time Lip Sync Engine (Web Audio API)

```
[Audio Source / TTS] ──> [Web Audio API AudioContext] ──> [AnalyserNode]
                                                                │
                                                                ▼
                                                      [Frequency Byte Data]
                                                                │
                                                                ▼
                                                   [Noise Gate + Gain Scaler]
                                                                │
                                                                ▼
                                                [Exponential Moving Average (Lerp)]
                                                                │
                                                                ▼
                                                   [Live2D: ParamMouthOpenY]
```

Unlike fixed timed viseme frames, `AudioAnalyzer.js` calculates real-time decibel energy from the audio output using `AnalyserNode`. It applies:
1. **Noise Gate Threshold**: Filters out background noise below 3% amplitude.
2. **Gain Multiplier**: Scales soft audio up to a normalized `0.0 .. 1.0` range.
3. **Exponential Moving Average (Lerp)**: Smooths mouth movement to prevent erratic jitter.

---

### 2. Smooth Cursor / Head Tracking

`useMouseTracking` captures `pointermove` events on the window or container rect. 
It converts screen coordinates `(clientX, clientY)` into normalized values `(-1.0 .. +1.0)` and interpolates current angles towards target angles using Linear Interpolation:

$$\text{currentAngle} = \text{lerp}(\text{currentAngle}, \text{targetAngle}, 0.1)$$

The resulting angles are applied to:
- `ParamAngleX`: Head tilt left/right ($-30^\circ \dots +30^\circ$)
- `ParamAngleY`: Head pitch up/down ($-30^\circ \dots +30^\circ$)
- `ParamAngleZ`: Head roll side-to-side ($-15^\circ \dots +15^\circ$)

---

### 3. Facial Expression & Motion Management

Expressions (Happy, Sad, Angry, Thinking, Surprised, Neutral) are triggered via `ExpressionManager`.

Motions (Idle, Wave, Greeting, Thinking, Listening, Speaking) are queued via `MotionManager`.

When AI transitions to **Thinking**, the avatar automatically:
1. Triggers the `thinking` expression.
2. Plays the `Thinking` motion.
3. Updates `AvatarStatusBadge` to "Thinking".

When speech starts playing:
1. Triggers `happy` or `speaking` expression.
2. Begins continuous real-time lip sync.
3. Updates `AvatarStatusBadge` to "Speaking".

---

## How to Add New Models, Expressions, or Voices

### Adding a New Live2D Model
1. Place your model files into `/public/models/avatar/` (ensure it includes `.model3.json`, textures `.png`, `.physics3.json`, `.moc3`).
2. Update `DEFAULT_AVATAR_CONFIG.modelPath` in `src/config/AvatarConfig.js`:
```js
modelPath: '/models/avatar/your_custom_model.model3.json'
```

### Adding New Expressions
1. Ensure your model's expression `.exp3.json` files are listed inside `.model3.json`.
2. Add expression keys to `EXPRESSIONS` in `src/config/MotionConfig.js`.

### Connecting a New TTS Provider
1. Open `src/services/speech/SpeechService.js`.
2. Implement your custom audio fetch/stream method and attach `audioAnalyzer.attachSource(audioElement)`.

---

## Verification & Performance

- **Target Framerate**: 60 FPS achieved through requestAnimationFrame decoupling and PixiJS WebGL hardware acceleration.
- **Resource Cleanup**: `AvatarCanvas.jsx` disposes textures (`texture: true, baseTexture: true`) and cancels animation loops on React unmount to ensure 0 memory leaks.
