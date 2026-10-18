# Practical 13: AI API Integration into a Web Application

[![CI Pipeline](https://github.com/mahek1907/24CS018_Practical13_AI_API_Integration/actions/workflows/ci.yml/badge.svg)](https://github.com/mahek1907/24CS018_Practical13_AI_API_Integration/actions/workflows/ci.yml)

**Course:** Advanced Web Development Frameworks (ITUE301)  
**Student ID:** 24CS018  
**Repository:** `24CS018_Practical13_AI_API_Integration`  
**GitHub URL:** [https://github.com/mahek1907/24CS018_Practical13_AI_API_Integration](https://github.com/mahek1907/24CS018_Practical13_AI_API_Integration)  
**Technology Stack:** React 19 (Vite), Node.js (v20), Express.js, OpenAI API / Gemini API, MongoDB, Mongoose, Node-Cache, EventEmitter, Docker, Docker Compose, Jest, Supertest, ESLint

---

## 1. Project Overview

### Aim & Objectives
- **Aim:** To integrate an external Artificial Intelligence (AI) API securely through a Node.js/Express backend into a full-stack Task Management application, generating concise, context-aware task descriptions from task titles while guaranteeing server-side credential isolation, rate limiting, and graceful degradation.
- **Objectives:**
  1. Inspect and preserve all cumulative working features developed across Practicals 1 through 12 (CRUD, JWT auth, lean MongoDB queries, sub-millisecond node-cache caching, EventEmitter background listeners, Docker Compose multi-service architecture, and GitHub Actions CI).
  2. Implement a secure backend endpoint `POST /api/ai/generate-description` utilizing the official OpenAI Node.js SDK with fallback support for Google Gemini API.
  3. Keep secret API keys exclusively in the backend `.env` file—ensuring zero client-side leakage, no `VITE_` prefix exposure, and exclusion from Git version control.
  4. Implement per-task/IP rate limiting (1 request per minute per task) and comprehensive input validation (3–200 characters).
  5. Provide resilient error handling and graceful fallback responses when API keys are unconfigured, rate limits are exceeded, or upstream providers fail.
  6. Enhance the React frontend task creation form with a non-blocking "✨ Generate description" action, loading indicator, editable textarea, and transparent AI disclaimer.
  7. Maintain 100% automated test coverage with Jest and Supertest, passing all 17 integration and AI unit tests under CI.

---

## 2. Architecture & Data Flow

### Secure Backend-Proxy Architecture
Client browsers **never** communicate directly with the AI service. The Express backend acts as an authenticated, validating reverse proxy:

```
┌────────────────────────────────┐
│   React Frontend (Vite SPA)    │
│  - Task Title Input            │
│  - "✨ Generate description"   │
│  - Editable Description Field  │
│  - Disclaimer & Error Badges   │
└───────────────┬────────────────┘
                │  POST /api/ai/generate-description
                │  Body: { title: "Prepare Practical 13 report" }
                ▼
┌────────────────────────────────────────────────────────┐
│              Express Backend (Port 5000)               │
│                                                        │
│  1. Input Validation (title: 3-200 chars)              │
│  2. In-Memory Rate Limiter (1 req/min per task/IP)     │
│  3. Server-Side Secret Key (process.env.OPENAI_API_KEY)│
│  4. Graceful Fallback Interceptor                      │
└───────────────┬─────────────────────────┬──────────────┘
                │                         │
     (Primary Provider)            (Fallback Provider)
                ▼                         ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│       OpenAI API Service      │ │  Google Gemini API   │
│    Model: gpt-4o-mini / gpt-4 │ │ Model: gemini-1.5-fl │
│    Prompt: Concise task desc  │ └──────────────────────┘
└───────────────────────────────┘
```

---

## 3. API Specification

### Endpoint: `POST /api/ai/generate-description`

#### Headers
```http
Content-Type: application/json
```

#### Request Payload
```json
{
  "title": "Prepare Practical 13 report"
}
```

#### Successful Response (HTTP 200)
When an AI provider is configured and returns a completion:
```json
{
  "description": "Review practical requirements, implement AI API integration with backend proxy, execute automated tests, and document testing and security results.",
  "fallback": false
}
```

#### Graceful Fallback Response (HTTP 200)
When no API key is configured or upstream AI services are unreachable:
```json
{
  "description": "",
  "fallback": true,
  "message": "AI suggestions are temporarily unavailable. Please write the description manually."
}
```

#### Validation Error (HTTP 400)
When the title is missing, not a string, or out of character bounds:
```json
{
  "error": "Validation Error",
  "message": "Task title is required and must be between 3 and 200 characters."
}
```

#### Rate Limit Exceeded (HTTP 429)
When repeated generation requests for the same task title are received within 60 seconds:
```json
{
  "error": "Rate limit exceeded",
  "message": "AI description recently requested for this task. Please wait 45s before requesting again.",
  "retryAfter": 45
}
```

---

## 4. Frontend Integration & UX

The React frontend (`frontend/src/App.jsx` and `App.css`) integrates the AI generator directly into the task creation workflow:

1. **Non-Blocking Trigger:** Clicking **✨ Generate description** disables the button, updates its label to `Generating description...`, and displays a spinning indicator without freezing the rest of the form.
2. **Title Pre-Check:** Alerts the user immediately if they attempt to generate a description without entering a title first.
3. **Overwrite Safeguard:** If text is already entered in the description field, the user is prompted for confirmation before the AI suggestion populates the field.
4. **Transparent AI Disclaimer:** Displays an informative banner:  
   `🤖 AI-generated suggestion — please review and edit before saving.`
5. **Full Editability:** The AI response is placed directly into the standard `<textarea>`, allowing the user to accept, edit, expand, or reject the suggestion prior to submitting the task.
6. **Graceful Error UI:** Displays friendly error badges when rate limits are reached or suggestions are unavailable, guiding the user to write their description manually without failing the form submission.

---

## 5. Security & Responsible AI Considerations

### 1. Zero API Key Exposure
- The secret key `OPENAI_API_KEY` (or `GEMINI_API_KEY`) is stored exclusively in `backend/.env`.
- Frontend environment variables (`VITE_*`) are never used for secrets.
- Backend `.env` is ignored by `.gitignore` and never committed to Git.
- `backend/.env.example` provides non-sensitive placeholders only.

### 2. Rate Limiting & Cost Protection
- In-memory rate limiting prevents abuse, bot scraping, and runaway API billing by restricting generation requests to **1 request per 60 seconds** per task title/IP.

### 3. Graceful Degradation
- If the AI service experiences downtime, quota exhaustion, or network disconnects, the backend catches the error and returns `{ fallback: true }`. The core task management functionality (CRUD, authentication, caching) remains 100% operational.

### 4. Human-in-the-Loop & Content Safety
- AI outputs are strictly treated as draft suggestions.
- The user retains complete editorial control before any task is saved to the database.
- Prompts enforce strict task-oriented instructions (concise, professional action steps).

---

## 6. Automated Testing & Verification

The Jest and Supertest test suite (`backend/tests/api.test.js`) verifies all 17 system and AI integration tests:

```text
PASS tests/api.test.js
  Task Management API - CI/CD Automated Test Suite
    1. Health & Server Info Endpoints
      ✓ GET / returns 200 with student ID and active status (50 ms)
      ✓ GET /debug/cache-stats returns 200 with cache metrics (Practical 9) (11 ms)
    2. Authentication & Authorization Enforcement
      ✓ GET /tasks returns 401 when no token is provided (11 ms)
      ✓ GET /tasks returns 401 when token format is invalid (7 ms)
    3. Task Retrieval & In-Memory Caching (Practical 9)
      ✓ GET /tasks returns 200 with task list when authenticated (10 ms)
    4. Task Creation, Validation & Events (Practicals 7 & 10)
      ✓ POST /tasks returns 400 when title is missing or empty (16 ms)
      ✓ POST /tasks returns 201 and emits task-created event when valid (16 ms)
    5. Resource Lookup & Error Handling
      ✓ GET /tasks/:id returns 400 for invalid ObjectId format (7 ms)
      ✓ GET /tasks/:id returns 404 when task does not exist (11 ms)
      ✓ GET /nonexistent-route returns 404 route not found (6 ms)
    6. AI Task Description Integration (Practical 13)
      ✓ POST /api/ai/generate-description returns 400 when title is missing (12 ms)
      ✓ POST /api/ai/generate-description returns 400 when title is too short (10 ms)
      ✓ POST /api/ai/generate-description returns 400 when title exceeds 200 chars (8 ms)
      ✓ POST /api/ai/generate-description returns graceful fallback when no API key configured (10 ms)
      ✓ POST /api/ai/generate-description returns 200 with generated description when AI provider succeeds (9 ms)
      ✓ POST /api/ai/generate-description returns 429 when rate limit is exceeded on same task (809 ms)
      ✓ POST /api/ai/generate-description degrades gracefully on AI provider error (260 ms)

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        2.3 s
```

### ESLint & Build Status
- `npm run lint` (ESLint v10): **0 errors, 0 warnings**
- `npm run build` (Vite frontend production build): **Built cleanly in 803ms**

---

## 7. Setup & Execution Guide

### 1. Clone & Install
```bash
git clone https://github.com/mahek1907/24CS018_Practical13_AI_API_Integration.git
cd 24CS018_Practical13_AI_API_Integration

# Backend setup
cd backend
npm install

# Frontend setup
cd ../frontend
npm install
```

### 2. Configure Environment
Create `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/taskmanager
JWT_SECRET=p7_task_manager_secure_jwt_secret_key_2026_charusat
OPENAI_API_KEY=your_actual_openai_api_key_here
# Optional: GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Automated Tests
```bash
cd backend
npm test
```

### 4. Run Locally
```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 5. Run via Docker Compose (Multi-Service Stack)
```bash
docker compose up -d --build
```
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- MongoDB: `mongodb://localhost:27018`

---

## 8. Viva Questions & Comprehensive Answers

### 1. Why should the AI API key never be exposed in the frontend?
**Answer:** The frontend is client-side code executed directly in the user's browser. Any environment variable prefixed with `VITE_` or embedded in JavaScript bundles is visible through browser DevTools, network inspection, and bundle source maps. If an AI API key is exposed client-side, malicious actors can extract it, consume paid API credits, exceed rate limits, or use it for unauthorized activities resulting in severe financial and security liabilities.

### 2. How does the backend act as a proxy for the AI service?
**Answer:** In the proxy architecture, the client frontend only makes requests to its own backend (`POST /api/ai/generate-description`). The backend validates user input, checks authorization, enforces rate limits, securely loads the secret API key from server environment variables (`process.env.OPENAI_API_KEY`), and dispatches the request to the upstream AI provider. The backend parses and sanitizes the AI output before returning a clean JSON response to the client.

### 3. What happens if the AI API is down or the key is invalid?
**Answer:** The application implements **graceful degradation**. Rather than crashing the Express server or returning an unhandled 500 error, the backend catches provider errors and returns an HTTP 200 fallback response: `{ description: "", fallback: true, message: "AI suggestions are temporarily unavailable..." }`. The frontend detects this fallback flag, displays a friendly notice to the user, and enables manual task description entry so core task management remains uninterrupted.

### 4. What is prompt engineering, and what prompt did you use?
**Answer:** Prompt engineering is the practice of structuring, refining, and optimizing natural language instructions given to an LLM to produce predictable, accurate, and relevant outputs. In this practical, the system prompt instructs the AI:
> *"You are a helpful assistant for a task management application. Given a task title, generate a concise, practical, and actionable task description (1-3 sentences). Return only the description text without quotation marks, bullet points, or markdown headings."*  
This guarantees uniform, production-ready suggestions suitable for direct display in the UI.

### 5. Why is it important to allow the user to edit the generated description?
**Answer:** AI models can hallucinate, misunderstand domain context, or provide descriptions that don't match the user's specific intent. By placing the AI output in an editable `<textarea>` and presenting an explicit disclaimer (`"AI-generated suggestion — please review and edit before saving."`), the application follows Human-in-the-Loop (HITL) best practices, granting the user ultimate authority over their task data.

### 6. What are the rate limits of the AI API you used, and how can you handle rate-limit errors in the app?
**Answer:** Upstream AI providers impose Tier-based rate limits measured in Requests Per Minute (RPM) and Tokens Per Minute (TPM). In our application, rate-limit errors are handled at two levels:
1. **Application-level prevention:** An in-memory rate limiter restricts requests to 1 request per 60 seconds per task title/IP, returning an HTTP `429 Too Many Requests` with a `retryAfter` timestamp.
2. **Provider error handling:** If upstream returns a `429 RateLimitError`, our backend catches it, logs the incident server-side, and delivers a controlled fallback response instructing the user to wait or proceed manually.

### 7. How would you add a rate limiter to prevent abuse of the AI endpoint?
**Answer:** Rate limiting can be implemented using sliding window counters or token buckets in memory (or backed by Redis in distributed deployments). In our implementation, a Map stores timestamps keyed by `clientIP:title`. When a request arrives, the server checks `Date.now() - lastRequestTime`. If the difference is less than 60,000 ms, the request is rejected with HTTP `429` and a header/body indicating the seconds remaining before retry.

### 8. What are some ethical considerations when using AI-generated content in web applications?
**Answer:** Key ethical considerations include:
1. **Transparency & Attribution:** Disclosing to users that content was generated by AI rather than a human.
2. **Bias & Harmful Content Prevention:** Ensuring prompts and provider safety filters prevent toxic, biased, or harmful outputs.
3. **Data Privacy:** Ensuring sensitive task titles or confidential corporate notes are not sent to third-party AI APIs without user consent or used for unauthorized model training.
4. **Accountability & Control:** Never auto-committing AI actions without human verification and editability.

---

*Developed by Mahek Dhebariya (24CS018) for ITUE301 Advanced Web Development Frameworks, CHARUSAT.*
