# SpeakMate AI — Mobile Application

> **Cross-Platform AI-Powered English Language Tutor & Speaking Fluency Coach**  
> Built with **React Native 0.86**, **React 19**, **Expo SDK 57**, **NativeWind (Tailwind CSS)**, and **React Navigation v7**.

---

## 📖 Table of Contents
1. [Overview](#-overview)
2. [Tech Stack](#-tech-stack)
3. [Key Features](#-key-features)
4. [Project Directory Architecture](#-project-directory-architecture)
5. [Voice & Speech Engine](#-voice--speech-engine)
6. [Navigation Architecture](#-navigation-architecture)
7. [Environment Configuration](#-environment-configuration)
8. [Installation & Local Setup](#-installation--local-setup)
9. [Running on Devices & Emulators](#-running-on-devices--emulators)
10. [Building with EAS (APK / AAB / IPA)](#-building-with-eas-apk--aab--ipa)
11. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🌟 Overview

The **SpeakMate AI Mobile App** provides an interactive, hands-free language learning experience directly on mobile devices (Android & iOS). It brings AI speech tutoring into your pocket with on-device speech recognition, animated visual avatars, continuous voice conversation with smart silence detection, curriculum-based lessons, grammar correction, and offline-resilient progress caching.

Designed for fluid mobile ergonomics, it features one-tap mic recording, native gesture navigation, forever-authenticated secure sessions, and customizable avatar personas.

---

## 🚀 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework & Runtime** | [React Native 0.86](https://reactnative.dev/), [React 19](https://react.dev/), [Expo SDK 57](https://expo.dev/) |
| **Styling & Design System** | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS v3.4), Custom Design Tokens |
| **Navigation** | [React Navigation v7](https://reactnavigation.org/) (NativeStack, BottomTabs, Drawer) |
| **Speech & Audio** | `expo-speech-recognition` (on-device STT), `expo-speech` (TTS synthesis), `expo-audio` |
| **Animations & UI** | `react-native-reanimated v4.5`, `react-native-gesture-handler`, `react-native-svg` |
| **Visual Effects** | `expo-linear-gradient`, `expo-blur`, `expo-image` |
| **Storage & Security** | `@react-native-async-storage/async-storage`, `expo-secure-store` |
| **Push Notifications** | `expo-notifications` |
| **Networking** | `axios` (with JWT authentication interceptors and auto-retry) |
| **Build & Release** | [Expo Application Services (EAS)](https://expo.dev/eas) |

---

## ✨ Key Features

### 1. 🎙️ Real-Time Voice Conversation & Live Avatar
* **Hands-Free AI Speaking:** Seamless two-way conversational practice with Groq LLM integration.
* **Smart Voice Activity Detection (VAD):** Intelligently detects natural pauses in user speech (3.0s / 4.5s / 8.0s) to automatically send voice queries, or tap-to-send override.
* **Interactive Live2D / Puppet Avatars:** Visual avatars (Chitose, Teachers, Scooby-Doo, SpongeBob, Shizuka, Ben 10) that react to speech feedback and audio cadence.
* **On-Demand Contextual AI Hints:** Dynamic suggestions generate real-time vocabulary and sentence ideas when a learner hesitates.

### 2. 📚 120 Academic Curriculum Lessons (CEFR A1 to C2)
* Six structured proficiency tiers from Beginner (A1) to Advanced/Mastery (C2).
* Interactive sentence ordering, word matching, grammar insights, and pronunciation checks.

### 3. ✍️ Instant AI Grammar Diagnostic Coach
* Speak or type any sentence to receive immediate grammar validation, structural error explanations, and handbook rule cards.

### 4. 🎴 3D Interactive Vocabulary Flashcards
* Swipeable vocabulary cards with audio pronunciations, definitions, and spaced-repetition mastery tracking.

### 5. 📊 Gamification, Habits & Streaks
* **XP Engine & Level Progression:** Real-time XP rewards for speaking sessions, completed lessons, and vocabulary mastery.
* **7-Day Learning Rhythm:** Track consecutive practice days and habit consistency.
* **Milestone Badges:** Unlock up to 18 achievement badges.

### 6. 🔐 Forever Login & Secure Session Management
* Secure token persistence via `expo-secure-store` ensures learners remain logged in across app restarts until explicit sign-out.

---

## 📁 Project Directory Architecture

```
speakmate-ai-mobile/
├── assets/                         # Application icons, avatars, splash screens
│   ├── avatars/                    # High-resolution avatar portrait cards
│   ├── icon.png                    # App launcher icon
│   └── splash.png                  # Native splash screen
├── src/
│   ├── api/                        # Axios instance & HTTP interceptors
│   ├── components/                 # Reusable UI component library
│   │   ├── avatar/                 # Live2D Webview & Puppet Avatar components
│   │   ├── common/                 # Header, AppButton, InputField, ScreenWrapper
│   │   └── dashboard/              # StatCard, StreakCard, QuoteCard, Leaderboard
│   ├── constants/                  # Route constants, colors, CEFR curriculum definitions
│   ├── context/                    # React Context providers (AuthContext, ThemeContext)
│   ├── navigation/                 # React Navigation setup
│   │   ├── AppNavigator.js         # Root navigation switcher (Auth vs Main)
│   │   ├── AuthNavigator.js        # Login, Register, ForgotPassword stack
│   │   ├── BottomNavigator.js      # Core bottom tab navigation (Home, Lessons, Chat, Profile)
│   │   └── DrawerNavigator.js      # Extended sidebar menu
│   ├── screens/                    # Application screens organized by module
│   │   ├── auth/                   # LoginScreen, RegisterScreen, ForgotPasswordScreen
│   │   ├── main/                   # Dashboard, ConversationChat, SpeakingHome, Lessons,
│   │   │                           # LessonDetail, Grammar, Vocabulary, Profile, Settings
│   │   ├── onboarding/             # Placement test, avatar selection, voice calibration
│   │   ├── progress/               # Weekly rhythm stats & CEFR level progression
│   │   └── achievements/           # Badges gallery & milestones overview
│   ├── services/                   # Business services & external integrations
│   │   ├── VoiceService.js         # Core speech recognition & audio synthesis engine (61 KB)
│   │   ├── ActiveTutorService.js   # Canonical tutor voice & model resolver
│   │   ├── appServices.js          # REST API client for lessons, grammar, streaks, XP
│   │   ├── authService.js          # Authentication, OTP, and session management
│   │   └── NotificationHelper.js   # Push notification scheduling & permissions
│   ├── styles/                     # Tailwind custom styling & design tokens
│   └── utils/                      # Storage helpers, date formatting, progress sync
├── app.json                        # Expo app metadata, permissions & plugin config
├── eas.json                        # EAS Build configuration (Android APK/AAB & iOS)
├── babel.config.js                 # Babel preset configuration with NativeWind
├── metro.config.js                 # Metro bundler custom configuration
├── tailwind.config.js              # Tailwind CSS theme extension
├── package.json                    # Dependencies & build scripts
└── README.md                       # Master mobile documentation
```

---

## 🎙️ Voice & Speech Engine

The voice subsystem is centered in [`src/services/VoiceService.js`](file:///src/services/VoiceService.js):

1. **Speech Recognition (`expo-speech-recognition`):**
   * Uses native mobile on-device speech engines (Android SpeechRecognizer & iOS SFSpeechRecognizer) for real-time transcription.
   * Eliminates the need to send large audio files over slow cellular networks.
2. **Text-to-Speech (`expo-speech`):**
   * High-definition synthesized voices matching selected avatar tutor personas (British, American, Australian, Indian English accents).
3. **Smart Silence VAD (Voice Activity Detection):**
   * Continuously monitors user speech input. If silence exceeds the target threshold (default 3.0s after active speech), it automatically triggers the message submission.

---

## 🧭 Navigation Architecture

```
AppNavigator (Root)
├── [Unauthenticated] ──► AuthNavigator (Stack)
│                          ├── LoginScreen
│                          ├── RegisterScreen
│                          └── ForgotPasswordScreen
│
└── [Authenticated]   ──► DrawerNavigator (Drawer)
                           └── BottomNavigator (Tabs)
                                ├── Home ──► DashboardScreen
                                ├── Lessons ──► LessonsScreen ──► LessonDetailScreen
                                ├── Practice ──► SpeakingHomeScreen ──► ConversationChatScreen
                                ├── Grammar ──► GrammarScreen
                                └── Profile ──► ProfileScreen ──► SettingsScreen
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### Supported Environment Variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | `https://speakmate-ai-28z5.onrender.com` | Backend API base URL (must be accessible from your mobile device). |
| `EXPO_PUBLIC_APP_NAME` | `SpeakMateAI` | Application name display. |
| `EXPO_PUBLIC_APP_ENV` | `development` | Mode (`development` / `production`). |
| `EXPO_PUBLIC_ENABLE_LIVE2D` | `true` | Enable or disable animated webview avatars. |
| `EXPO_PUBLIC_ENABLE_AUDIO_FEEDBACK` | `true` | Enable audio playback on speaking results. |

> **⚠️ Testing with Local Backend:**  
> When testing on a physical phone, `localhost` points to your phone, NOT your computer. Set your computer's LAN IP instead:
> ```ini
> EXPO_PUBLIC_API_URL=http://192.168.1.XX:9091
> ```

---

## 💻 Installation & Local Setup

### 1. Prerequisites
* **Node.js:** v18.18.0 or newer (v20+ recommended)
* **Expo CLI:** Built into Expo (`npx expo`)
* **Mobile Device:**
  * **Android:** Expo Go app installed from Google Play or an Android Studio Emulator.
  * **iOS:** Expo Go app installed from App Store or Xcode Simulator (macOS only).

### 2. Clone the Repository
```bash
git clone https://github.com/Dnyaneshwar7821/speakmate-ai-mobile.git
cd speakmate-ai-mobile
```

### 3. Install Dependencies
```bash
npm install
```

---

## 📱 Running on Devices & Emulators

### Starting the Development Server
```bash
npx expo start
```
* Scan the QR code with the **Expo Go app** on Android or Camera app on iOS.

### Running with Expo Dev Client (Recommended for Speech Recognition)
Because `expo-speech-recognition` uses native code, running via Dev Client provides the best experience:
```bash
npx expo start --dev-client
```

### Running on Emulators Directly
```bash
# Start Android Emulator
npm run android

# Start iOS Simulator (macOS only)
npm run ios
```

---

## 📦 Building with EAS (APK / AAB / IPA)

The project includes an optimized [`eas.json`](file:///eas.json) configuration:

### 1. Install EAS CLI & Log In
```bash
npm install -g eas-cli
eas login
```

### 2. Build Standalone Android APK (for Direct Testing / Sideloading)
```bash
eas build --platform android --profile preview
```
* Generates an installable `.apk` file ready to share with testers.

### 3. Build Google Play Store Bundle (AAB)
```bash
eas build --platform android --profile production
```
* Generates an optimized `.aab` (Android App Bundle) ready for the Google Play Console.

### 4. Build iOS Archive (IPA)
```bash
eas build --platform ios --profile production
```

---

## ❓ Troubleshooting & FAQs

#### 1. Microphone permission rejected?
* In Android, verify that `RECORD_AUDIO` permission is declared in [`app.json`](file:///app.json).
* Go to your phone's **Settings $\rightarrow$ Apps $\rightarrow$ SpeakMateAI $\rightarrow$ Permissions $\rightarrow$ Microphone: Allow**.

#### 2. Network request failed when calling Backend?
* Ensure your phone and development computer are connected to the **same Wi-Fi network**.
* Do not use `localhost` in `EXPO_PUBLIC_API_URL`; use your computer's local IP (e.g. `http://192.168.X.X:9091`) or your deployed cloud backend URL.

#### 3. Native module error on `expo-speech-recognition`?
* This native module requires a development build (`--dev-client`) or a standalone APK build. Expo Go may have limited support for custom native speech recognizers on older versions.

---

## 📄 License
This project is licensed under the MIT License.
