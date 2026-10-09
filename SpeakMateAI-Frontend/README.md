# SpeakMate AI — Web Frontend Application

> **Next-Generation Interactive AI Language Tutor & Conversation Coaching Web Platform**  
> Built with **React 19**, **Vite 8**, **Tailwind CSS v4**, **Pixi.js**, **Three.js**, and **Framer Motion**.

---

## 📖 Table of Contents
1. [Overview](#-overview)
2. [Tech Stack](#-tech-stack)
3. [Key Features](#-key-features)
4. [Project Directory Architecture](#-project-directory-architecture)
5. [State Management & Data Flow](#-state-management--data-flow)
6. [Avatar & Speech Engine](#-avatar--speech-engine)
7. [Environment Configuration](#-environment-configuration)
8. [Installation & Local Setup](#-installation--local-setup)
9. [Available Scripts](#-available-scripts)
10. [Production Deployment](#-production-deployment)
11. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🌟 Overview

**SpeakMate AI** is an enterprise-grade AI-powered English language learning and conversational fluency coaching platform. The web client offers an immersive experience featuring **real-time Live2D / 2D interactive avatar tutors**, **voice conversation with low-latency Speech-to-Text & Text-to-Speech**, **AI-driven instant grammar analysis**, **spaced-repetition vocabulary flashcards**, and a complete **Academic Curriculum (CEFR A1–C2)**.

In addition to learner-facing modules, it includes a modular **School & Teacher Administration Portal** for monitoring student progress, attendance, fluency metrics, and grade analytics (1st to 10th Std).

---

## 🚀 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Core Framework** | [React 19](https://react.dev/), [Vite 8](https://vitejs.dev/) (ES Modules, Fast HMR) |
| **Routing** | [React Router DOM v7](https://reactrouter.com/) |
| **Styling & Design System** | [Tailwind CSS v4](https://tailwindcss.com/), Glassmorphism, CSS Custom Properties |
| **Interactive Avatars** | [Pixi.js v7](https://pixijs.com/), `pixi-live2d-display`, [Three.js](https://threejs.org/), React Three Fiber & Drei |
| **Animations** | [Framer Motion v12](https://www.framer.com/motion/) |
| **Data Visualization** | [Recharts](https://recharts.org/) |
| **Networking & API** | [Axios](https://axios-http.com/) (with JWT interceptors and auto-refresh) |
| **Form Handling & Validation** | [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/) |
| **Document Generation** | [jsPDF](https://github.com/parallax/jsPDF) (dynamic PDF invoice and report generator) |
| **Code Quality** | [Oxlint](https://oxc.rs/) |

---

## ✨ Key Features

### 1. 🎙️ AI Voice Conversation & Interactive Tutors
* **Multi-Persona Avatars:** Practice speaking with animated tutors including Chitose (Live2D), Female Teacher, Male Teacher, SpongeBob (2D canvas mouth-rigged), Scooby-Doo, Shizuka, and Ben 10.
* **Audio-Synchronized Lip Sync:** Avatars react dynamically to spoken audio cadence and amplitude using an event-driven audio-to-viseme engine.
* **Smart Voice Activity Detection (VAD):** Natural conversation flow with automatic silence detection (3.0s / 4.5s / 8.0s thresholds) and manual push-to-talk override.
* **Contextual Suggestions & AI Hints:** Dynamic, scenario-aware conversational prompts tailored to your current turn.

### 2. 📚 120 Academic Curriculum Lessons (CEFR A1 to C2)
* Comprehensive curriculum structured across 6 proficiency tiers: Beginner (A1) to Mastery (C2).
* Real-time progress synchronization, lesson completion tracking, and category categorization.

### 3. ✍️ Real-Time Grammar Diagnostic Coach
* Instant sentence analysis powered by Groq LLM.
* Clear visual feedback, structural error breakdowns, corrected sentences, and grammatical handbook rules.

### 4. 🎴 3D Interactive Vocabulary Flashcards
* Interactive 3D flip cards with phonetic spellings, part-of-speech tags, contextual examples, and native audio pronunciation.
* Spaced-repetition mastery tracker with automated XP rewards.

### 5. 📊 Gamification, Habits & Analytics
* **XP & Level Progression:** Real-time XP accumulation across speaking, lessons, and vocabulary.
* **7-Day Rhythm & Habit Streaks:** Track consecutive days of active language practice.
* **18 Tiered Achievement Badges:** Unlock milestones as you build conversational stamina.
* **Community Leaderboard:** Compare progress with fellow learners.

### 6. 🏫 Modular School & Teacher Admin Portal
* **Role-Based Portals:** Dedicated dashboards for School Admins and Teachers.
* **Grade Roster Isolation:** Filter analytics and student metrics by school grade level (`1st Std` to `10th Std`).
* **Student Performance Deep-Dive:** View individual speaking session transcripts, accuracy scores, and attendance logs.

### 7. 💳 Subscription & Payment Gateway
* Integrated Razorpay checkout flow with instant subscription activation.
* Client-side PDF receipt and invoice generation via `jsPDF`.

### 8. 🌓 Theme & Accessibility
* Persistent Dark Mode and Light Mode with system-aware fallback.

---

## 📁 Project Directory Architecture

```
speakmate-ai-web-frontend/
├── public/                         # Static assets, avatar models & audio assets
│   ├── avatars/                    # Avatar portrait frames & icons
│   ├── models/                     # Live2D & sprite assets (Chitose, SpongeBob, etc.)
│   └── favicon.ico                 # Web favicon
├── src/
│   ├── Admin_panel/                # Self-contained School Admin & Teacher Portal
│   │   ├── components/             # Admin data tables, grade selectors, stat cards
│   │   ├── pages/                  # TeacherDashboard, StudentDetails, Analytics, Reports
│   │   ├── routes/                 # Isolated Admin routes & role guards
│   │   └── services/               # Admin REST API endpoints
│   ├── components/                 # Reusable UI component library
│   │   ├── avatar/                 # Live2D Canvas, SpongeBobPuppet, AvatarCanvas
│   │   ├── common/                 # Navbar, Sidebar, SpeakMateLoader, Modal, Buttons
│   │   ├── dashboard/              # StreakModal, LeaderboardModal, StatCard, QuoteCard
│   │   └── speech/                 # MicRecorder, AudioVisualizer, VoiceSelectorModal
│   ├── constants/                  # Route definitions, CEFR levels, avatar catalogs
│   ├── context/                    # Global React Context providers
│   │   ├── AuthContext.jsx         # User session, JWT tokens, login/logout lifecycle
│   │   └── ThemeContext.jsx        # Dark/light theme state & document class toggle
│   ├── pages/                      # Application route views (27 distinct pages)
│   │   ├── Dashboard.jsx           # Unified learner overview & daily goals
│   │   ├── ConversationChat.jsx    # Real-time voice avatar conversation
│   │   ├── GrammarPractice.jsx     # AI grammar diagnostic analyzer
│   │   ├── Lessons.jsx             # 120-lesson academic curriculum grid
│   │   ├── LessonDetail.jsx        # Step-by-step interactive lesson player
│   │   ├── Vocabulary.jsx          # 3D interactive flashcard mastery
│   │   ├── SpeakingPractice.jsx    # Pronunciation challenge & speech coaching
│   │   ├── Progress.jsx            # Weekly rhythm & skill analytics graphs
│   │   ├── Achievements.jsx        # Badges and milestones gallery
│   │   ├── Profile.jsx             # User account settings, voice & avatar selector
│   │   ├── Onboarding.jsx          # Level placement test & goal initialization
│   │   ├── Pricing.jsx             # Subscription packages & Razorpay checkout
│   │   └── LandingPage.jsx         # Public marketing & feature showcase page
│   ├── services/                   # Backend API integrations
│   │   ├── api.js                  # Axios client with JWT interceptor & auto-retry
│   │   ├── appServices.js          # Dashboard, lessons, grammar, vocab, payment APIs
│   │   ├── authService.js          # Login, register, OTP verification, password reset
│   │   ├── ActiveTutorService.js   # Canonical tutor voice & model resolver
│   │   └── live2d/EventBus.js      # Decoupled animation & speech event bus
│   ├── utils/                      # Client utilities & offline caching
│   │   ├── dashboardCache.js       # LocalStorage cache for instant zero-lag load
│   │   ├── curriculumCache.js      # Lesson catalog caching
│   │   └── progressTracker.js      # Real-time XP & streak calculation helpers
│   ├── App.jsx                     # Root application component with routing table
│   ├── index.css                   # Tailwind CSS v4 design tokens & base utilities
│   └── main.jsx                    # Application bootstrapping entrypoint
├── docs/                           # Architecture guides (Live2D Avatar Architecture)
├── .env.example                    # Environment variable template
├── index.html                      # HTML5 entrypoint template
├── package.json                    # Dependencies & build scripts
├── vercel.json                     # SPA routing rewrite rules for Vercel
└── vite.config.js                  # Vite configuration & React plugin setup
```

---

## 🔄 State Management & Data Flow

1. **Authentication Flow (`AuthContext.jsx`):**
   * Stores the JWT token securely in browser storage.
   * Attaches `Authorization: Bearer <token>` to all outgoing Axios requests via [api.js](file:///src/services/api.js).
   * Automatically redirects expired sessions to `/login` without application crashes.

2. **Zero-Lag Dashboard Hydration (`dashboardCache.js`):**
   * Employs a **stale-while-revalidate** caching pattern.
   * Reads cached stats instantly from `localStorage` on page load (eliminating skeleton flashing), then asynchronously synchronizes with the server in the background.

3. **Decoupled Avatar Event Bus (`EventBus.js`):**
   * Decouples audio playback from avatar rendering.
   * Emits `AUDIO_PLAYING`, `AUDIO_PAUSED`, `VISEME_UPDATE`, and `AVATAR_MOOD_CHANGE` events so avatars react in real-time regardless of which audio engine is active.

---

## 🎭 Avatar & Speech Engine

The application features a hybrid avatar pipeline:
1. **Live2D Cubism Models (e.g., Chitose):** Rendered using WebGL via Pixi.js (`pixi-live2d-display`) with full facial rigging, eye blinking, and breathing idle motions.
2. **2D Rigged Puppet Canvas (e.g., SpongeBob, Scooby-Doo):** High-performance 2D HTML5 canvas that programmatically manipulates mouth opening depths across 5 distinct viseme states (`rest`, `slight`, `medium`, `large`, `maximum`).
3. **Web Speech API & Groq Whisper:**
   * Browser-native SpeechRecognition provides low-latency real-time voice-to-text.
   * Backend Groq Whisper API handles audio transcription fallbacks.

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

### Available Environment Variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:9091` | Base URL of the running Spring Boot Backend |
| `VITE_APP_NAME` | `SpeakMate AI` | Application display name |
| `VITE_APP_ENV` | `development` | Environment mode (`development` / `production`) |
| `VITE_ENABLE_AI_FEATURES` | `true` | Toggle AI chat and conversational coaches |
| `VITE_ENABLE_VOICE_FEATURES` | `true` | Toggle microphone and speech recognition |
| `VITE_ENABLE_PREMIUM` | `false` | Enable or disable premium paywall gates |

> **Note for Local Testing:** If running the backend locally on port `9091`, set:
> ```ini
> VITE_API_BASE_URL=http://localhost:9091
> ```

---

## 💻 Installation & Local Setup

### 1. Prerequisites
* **Node.js:** v18.18.0 or newer (v20+ recommended)
* **npm:** v9.0.0 or newer

### 2. Clone the Repository
```bash
git clone https://github.com/Dnyaneshwar7821/speakmate-ai-web-frontend.git
cd speakmate-ai-web-frontend
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment
```bash
cp .env.example .env
# Open .env and set your VITE_API_BASE_URL (e.g., http://localhost:9091)
```

### 5. Launch the Development Server
```bash
npm run dev
```
The application will start at: **`http://localhost:5173`** (or the next available port).

---

## 📜 Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Compiles and bundles production-ready static assets into the `dist/` folder. |
| `npm run preview` | Spins up a local server to preview the built `dist/` bundle. |
| `npm run lint` | Runs the ultra-fast `oxlint` linter to check for code issues. |

---

## 🚀 Production Deployment

### Deploying to Vercel (Recommended)
This repository includes a pre-configured `vercel.json` file to support client-side SPA routing:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

1. Push your repository to GitHub.
2. Import the project into your [Vercel Dashboard](https://vercel.com).
3. Set your Production Environment Variable:
   * `VITE_API_BASE_URL` = `https://your-deployed-backend-url.com`
4. Click **Deploy**. Vercel will automatically run `npm run build` and publish the site.

### Deploying to Docker / Nginx
```dockerfile
# Build Stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Server Stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## ❓ Troubleshooting & FAQs

#### 1. Microphone not working during AI Conversation?
* Ensure browser microphone permissions are allowed for `localhost` or your HTTPS domain.
* In Chrome: Click the padlock icon in the address bar $\rightarrow$ **Site settings** $\rightarrow$ **Microphone: Allow**.

#### 2. Avatar displays a blank canvas?
* Check browser console for WebGL support. Pixi.js and Three.js require hardware acceleration enabled in browser settings.

#### 3. API calls failing with Network Error?
* Verify that the backend server is running and that `VITE_API_BASE_URL` matches your backend address.
* Check browser developer tools (Network tab) for CORS header issues on the backend.

---

## 📄 License
This project is licensed under the MIT License.
