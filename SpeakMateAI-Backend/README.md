# SpeakMate AI — Backend Service

> **Enterprise Spring Boot 3 & Java 17 Microservice Platform for AI Language Learning**  
> Powers real-time conversational AI tutors, CEFR curriculum lessons, grammar analysis, school administration, multi-tenant RBAC, and subscription billing.

---

## 📖 Table of Contents
1. [Overview](#-overview)
2. [Tech Stack](#-tech-stack)
3. [Architecture & System Design](#-architecture--system-design)
4. [Package & Directory Structure](#-package--directory-structure)
5. [Core Services & Modules](#-core-services--modules)
6. [Database & Connection Pooling](#-database--connection-pooling)
7. [Environment Variables & Configuration](#-environment-variables--configuration)
8. [Getting Started & Local Setup](#-getting-started--local-setup)
9. [Build & Execution Guide](#-build--execution-guide)
10. [Docker Containerization](#-docker-containerization)
11. [Database Maintenance Scripts](#-database-maintenance-scripts)
12. [API Testing with Postman](#-api-testing-with-postman)
13. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🌟 Overview

The **SpeakMate AI Backend** is the core RESTful API engine of the SpeakMate AI ecosystem. It coordinates AI LLM chat sessions, automated audio-to-text transcriptions, curriculum lesson delivery, grammar checking, student progress tracking, institutional school hierarchies, and transactional billing.

Designed for high resilience with serverless cloud databases (Neon PostgreSQL), it features optimized **HikariCP connection pooling**, **stateless JWT security**, **dual-provider transactional email delivery**, and **automatic lesson curriculum dataset seeding**.

---

## 🚀 Tech Stack

| Component | Technology | Version / Specification |
| :--- | :--- | :--- |
| **Language & Framework** | Java, Spring Boot | **Java 17 (LTS)**, Spring Boot **3.3.x** |
| **ORM & Persistence** | Spring Data JPA, Hibernate | PostgreSQL Dialect |
| **Database** | PostgreSQL | Neon Serverless Cloud / Local PostgreSQL |
| **Connection Pool** | HikariCP | Auto-suspend friendly connection pool |
| **Security & Auth** | Spring Security, JJWT | Stateless JWT, BCrypt Password Encoder |
| **AI & LLM Services** | Groq Cloud API | Llama 3.3 / GPT-OSS 120B (Chat), Whisper v3 Turbo (STT) |
| **Email Infrastructure** | Brevo API & Spring Mail | Brevo REST API v3 with Gmail/SMTP fallback |
| **Payment Gateway** | Razorpay Java SDK | Orders, Webhook HMAC-SHA256 Verification, Refunds |
| **Build & Packaging** | Apache Maven | Multi-stage Dockerized executable JAR |

---

## 🏛️ Architecture & System Design

```
                     ┌────────────────────────────────────────┐
                     │          Clients (Web & Mobile)        │
                     └───────────────────┬────────────────────┘
                                         │ HTTPS / REST
                                         ▼
                     ┌────────────────────────────────────────┐
                     │         Spring Security Filter         │
                     │       (JwtAuthenticationFilter)        │
                     └───────────────────┬────────────────────┘
                                         │
                                         ▼
                     ┌────────────────────────────────────────┐
                     │       REST Controllers (43 Endpoints)  │
                     └───────────────────┬────────────────────┘
                                         │
                                         ▼
                     ┌────────────────────────────────────────┐
                     │     Business Service Layer (Services)  │
                     └───────┬───────────┬────────────┬───────┘
                             │           │            │
            ┌────────────────┘           │            └───────────────┐
            ▼                            ▼                            ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│     AI Engine         │   │   Database Layer      │   │   External Providers  │
│ - Groq Chat LLM       │   │ - Spring Data JPA     │   │ - Brevo Email API     │
│ - Whisper Turbo STT   │   │ - HikariCP Pool       │   │ - SMTP Fallback       │
│ - Pedagogical Prompts │   │ - PostgreSQL (Neon)   │   │ - Razorpay Gateway    │
└───────────────────────┘   └───────────────────────┘   └───────────────────────┘
```

### Key Architectural Patterns
* **Stateless Token Authentication:** All endpoints authenticate via bearer tokens validated by `JwtAuthenticationFilter`.
* **Multi-Tenant / Role-Based Access Control (RBAC):** Distinct role boundaries for `ROLE_USER`, `ROLE_STUDENT`, `ROLE_TEACHER`, `ROLE_SCHOOL_ADMIN`, and `ROLE_SUPER_ADMIN`.
* **Double Email Strategy:** Primary delivery via high-speed Brevo REST API (`BrevoEmailProvider`). If unconfigured or rate-limited, automatically falls back to standard SMTP (`SmtpEmailProvider`).
* **Resilient Serverless Pooling:** Configured to gracefully handle Neon's scale-to-zero compute suspension without throwing pool exhaustion errors.

---

## 📁 Package & Directory Structure

```
speakmate-ai-backend/
├── src/
│   ├── main/
│   │   ├── java/com/rslsolution/speakmateai/
│   │   │   ├── assistant/              # Virtual assistant conversation logic
│   │   │   ├── config/                 # Security, CORS, Mail, LessonDataSeeder
│   │   │   ├── controller/             # 43 REST API Controllers
│   │   │   ├── dto/                    # Request and response data transfer objects
│   │   │   ├── entity/                 # 40 JPA Entities (User, Lesson, ChatSession, etc.)
│   │   │   ├── enums/                  # System enumerations (Roles, Statuses, Tiers)
│   │   │   ├── exception/              # Global exception handler and custom errors
│   │   │   ├── mapper/                 # Entity-to-DTO conversion mappers
│   │   │   ├── repository/             # Spring Data JPA Repository interfaces
│   │   │   ├── scheduler/              # Notification and streak reminder cron tasks
│   │   │   ├── security/               # JWT token provider, filter, and user details
│   │   │   ├── service/                # Service interfaces & service/impl implementations
│   │   │   ├── util/                   # Utility helpers and cryptographic tools
│   │   │   └── SpeakMateAiApplication.java # Spring Boot main entrypoint
│   │   └── resources/
│   │       ├── application.properties  # Application configuration & profiles
│   │       ├── curriculum_lessons.json # 120 Academic Curriculum master dataset
│   │       └── curriculum_categories.json # CEFR level categories catalog
│   └── test/                           # Unit and integration test suites
├── scripts/                            # Database backup, restore, and audit scripts (Node.js)
│   ├── backup_db.cjs                   # Full database backup to JSON snapshot
│   ├── restore_db.cjs                  # Restore database from JSON snapshot
│   ├── apply_foreign_keys.cjs          # Foreign key synchronization
│   └── audit_neon_schema.cjs           # Database schema validator
├── sql/                                # Database migration and seed files
│   ├── seed_120_lessons.sql            # Master curriculum SQL seeds
│   └── clean_full_backup.sql           # Database schema and initial data dump
├── postman/                            # API testing suite
│   ├── teacher_admin_postman_collection.json # Ready-to-import Postman collection
│   └── teacher_admin_test_sheet.csv    # Test cases and verification sheet
├── Dockerfile                          # Multi-stage production container build
├── mvnw / mvnw.cmd                     # Maven wrapper scripts
├── pom.xml                             # Maven build dependencies and plugins
└── README.md                           # Master backend documentation
```

---

## 🧩 Core Services & Modules

### 1. AI Conversation & Speech Engine
* **`AIChatService`:** Orchestrates two-way pedagogical dialogue with students using Groq Cloud LLM. Analyzes learner grammar in real time and crafts age-appropriate conversation hints.
* **`SpeechController` & Groq Whisper:** Receives client audio uploads and transcribes speech using `whisper-large-v3-turbo`.

### 2. Academic Curriculum (120 Master Lessons)
* **`LessonService`:** Manages CEFR-aligned lessons across A1, A2, B1, B2, C1, and C2.
* **`LessonDataSeeder`:** Runs on application startup to ensure all 120 lessons from `curriculum_lessons.json` are synchronized without manual database migrations.

### 3. Grammar Diagnostic Coach
* **`GrammarService`:** Accepts arbitrary English sentences, identifies grammar/syntax errors, explains rules, and generates structural corrections.

### 4. Vocabulary Mastery System
* **`VocabularyService`:** Manages flashcards, spaced-repetition schedules, word audio pronunciation links, and auto-mastering states.

### 5. School & Institutional Administration
* **`SchoolService` & `AdminSchoolUserService`:** Full school tenant isolation, standard/grade divisions (1st to 10th Std), teacher assignment, and student roster aggregation.

### 6. Billing, Invoices & Razorpay
* **`PaymentService` & `InvoiceService`:** Creates Razorpay payment orders, verifies HMAC-SHA256 signatures, manages refunds, and tracks subscription validity.

---

## 🗄️ Database & Connection Pooling

The backend is pre-configured to connect to **PostgreSQL** (specifically optimized for **Neon Serverless Cloud**).

### HikariCP Configuration Details ([application.properties](file:///src/main/resources/application.properties)):
```properties
# Cloud Connection string with SSL and Keepalive
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://ep-aged-resonance-azrulowm-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connectTimeout=10&socketTimeout=30&tcpKeepAlive=true}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:neondb_owner}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:}
spring.datasource.driver-class-name=org.postgresql.Driver

# HikariCP Pool Settings Tuned for Neon Serverless
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=0
spring.datasource.hikari.idle-timeout=120000
spring.datasource.hikari.max-lifetime=180000
spring.datasource.hikari.connection-timeout=15000
spring.datasource.hikari.keepalive-time=30000
spring.datasource.hikari.leak-detection-threshold=60000
```

* **`minimum-idle=0`:** When the app is inactive for 2 minutes, all connections are released. This allows Neon to safely enter **Scale-to-Zero**, conserving monthly compute hours!
* **`connection-timeout=15000` (15s):** Gives Neon ample time to wake up from cold starts without failing user requests.
* **`max-lifetime=180000` (3m):** Recycles connections before intermediate cloud NAT gateways terminate idle TCP sockets.

---

## ⚙️ Environment Variables & Configuration

Every configuration value can be customized at runtime using environment variables:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| **`PORT`** | `9091` | Server HTTP port (Render dynamically injects this). |
| **`SPRING_DATASOURCE_URL`** | Neon JDBC URL | PostgreSQL connection string. |
| **`SPRING_DATASOURCE_USERNAME`** | `neondb_owner` | Database username. |
| **`SPRING_DATASOURCE_PASSWORD`** | *(empty)* | Database password. |
| **`JWT_SECRET`** | `SpeakMateAISecretKey...` | 256-bit secret key used to sign JWT tokens. |
| **`JWT_EXPIRATION`** | `86400000` (24h) | JWT token lifespan in milliseconds. |
| **`GROQ_API_KEY`** | *(empty)* | Groq API Key for AI Chat and Whisper STT. |
| **`GROQ_MODEL`** | `openai/gpt-oss-120b` | Groq LLM model name. |
| **`BREVO_API_KEY`** | *(empty)* | Brevo API key for transactional emails. |
| **`BREVO_SENDER_EMAIL`** | `dnyaneshwaralgule2003@gmail.com` | Verified sender email address. |
| **`SPRING_MAIL_HOST`** | `smtp.gmail.com` | SMTP host (fallback provider). |
| **`SPRING_MAIL_PORT`** | `465` | SMTP SSL port. |
| **`SPRING_MAIL_USERNAME`** | *(empty)* | SMTP login username. |
| **`SPRING_MAIL_PASSWORD`** | *(empty)* | SMTP app password. |
| **`RAZORPAY_KEY_ID`** | *(empty)* | Razorpay API Key ID. |
| **`RAZORPAY_KEY_SECRET`** | *(empty)* | Razorpay Secret Key. |
| **`APP_FRONTEND_URL`** | `http://localhost:5173` | Frontend URL for password reset links. |
| **`ENABLE_SCHEDULING`** | `false` | Enable background scheduler cron tasks. |

---

## 💻 Getting Started & Local Setup

### 1. Prerequisites
* **Java Development Kit (JDK):** Version **17** (e.g. Eclipse Temurin, Amazon Corretto, OpenJDK).
* **Maven:** Version **3.8+** (or use the included `./mvnw` wrapper).
* **PostgreSQL:** Neon Cloud account or local PostgreSQL instance.

### 2. Clone the Repository
```bash
git clone https://github.com/Dnyaneshwar7821/speakmate-ai-backend.git
cd speakmate-ai-backend
```

### 3. Configure Database & Keys
Set your database credentials and Groq API key:

**On Linux/macOS:**
```bash
export SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/speakmateai"
export SPRING_DATASOURCE_USERNAME="postgres"
export SPRING_DATASOURCE_PASSWORD="password"
export GROQ_API_KEY="gsk_your_groq_api_key_here"
```

**On Windows (PowerShell):**
```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/speakmateai"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="password"
$env:GROQ_API_KEY="gsk_your_groq_api_key_here"
```

---

## 🛠️ Build & Execution Guide

### Using Maven Wrapper

```bash
# 1. Clean and build the executable JAR (skipping test execution)
./mvnw clean package -DskipTests

# 2. Run the Spring Boot application directly
./mvnw spring-boot:run
```

*(On Windows, use `mvnw.cmd` instead of `./mvnw`)*

The server will initialize on: **`http://localhost:9091`**

### Running the Packaged JAR
```bash
java -jar target/SpeakMateAI-0.0.1-SNAPSHOT.jar
```

---

## 🐳 Docker Containerization

The repository includes an optimized multi-stage `Dockerfile`:

```bash
# Build the production Docker image
docker build -t speakmate-ai-backend .

# Run the container
docker run -p 9091:9091 \
  -e SPRING_DATASOURCE_URL="<DATABASE_URL>" \
  -e SPRING_DATASOURCE_USERNAME="<USER>" \
  -e SPRING_DATASOURCE_PASSWORD="<PASS>" \
  -e GROQ_API_KEY="<KEY>" \
  speakmate-ai-backend
```

*Memory limits in the Dockerfile (`-Xms128m -Xmx384m`) are pre-tuned for cloud free tiers (e.g., Render 512MB RAM).*

---

## 🗃️ Database Maintenance Scripts

The `scripts/` directory contains Node.js database utilities:

```bash
# Backup full database tables to a JSON snapshot
node scripts/backup_db.cjs "<DATABASE_URL>"

# Restore database from a JSON snapshot
node scripts/restore_db.cjs "<DATABASE_URL>"

# Audit database schema and foreign key constraints
node scripts/audit_neon_schema.cjs "<DATABASE_URL>"
```

---

## 🧪 API Testing with Postman

1. Open Postman.
2. Click **Import** and select:
   * **`postman/teacher_admin_postman_collection.json`**
3. Set your collection variable `baseUrl` to `http://localhost:9091`.
4. Run requests to test:
   * User Registration & Login (`/api/auth/login`)
   * AI Conversational Chat (`/api/chat/send`)
   * Grammar Diagnostics (`/api/grammar/check`)
   * School & Teacher Management (`/api/school/...`)

---

## ❓ Troubleshooting & FAQs

#### 1. Port 9091 already in use?
Change the port using an environment variable or flag:
```bash
./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=9092"
```

#### 2. Neon Database cold start timeouts?
If Neon takes a few seconds to wake from auto-suspend, ensure `connectTimeout=10` and Hikari `connection-timeout=15000` (15s) are present in your `application.properties`.

#### 3. Groq API rate limit or authentication error?
Ensure your `GROQ_API_KEY` is exported and valid on [console.groq.com](https://console.groq.com).

---

## 📄 License
This project is licensed under the MIT License.
