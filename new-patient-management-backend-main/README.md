# Clinic Management System — Backend API

A production-ready REST API for a neurology clinic management system built with **Node.js**, **Express**, and **PostgreSQL (NeonDB)**. Handles patients, consultations, prescriptions, neurological examinations, vitals, follow-ups, and a real-time dashboard — all secured with JWT authentication.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Database Schema Overview](#database-schema-overview)
- [Performance Features](#performance-features)
- [Security Features](#security-features)
- [Health Check and Monitoring](#health-check-and-monitoring)
- [Deployment Notes](#deployment-notes)
- [Common Errors](#common-errors)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js >= 20 |
| Framework | Express 4 (ESM modules) |
| Database | PostgreSQL via `pg` (NeonDB / Supabase compatible) |
| Auth | JSON Web Tokens (`jsonwebtoken`) + bcryptjs |
| Validation | Zod |
| Logging | Morgan + structured JSON logger |
| Security | Helmet, express-rate-limit, CORS |
| Compression | `compression` (Gzip — ~70% smaller JSON responses) |
| Dev | Nodemon |

---

## Project Structure

```
new-2026-patient_management_backend-main/
├── logger.js                         # Root-level structured JSON logger
├── package.json
├── .env                              # Environment variables (not committed)
│
└── src/
    ├── app.js                        # Express app — middleware, routes, error handler
    ├── index.js                      # Server entry point — startup, shutdown, DB indexes
    │
    ├── controllers/
    │   ├── authController.js         # Login / register
    │   ├── patientController.js      # CRUD + search patients
    │   ├── consultationController.js # Consultations + batch save endpoint
    │   ├── vitalController.js        # Vital signs (BP, pulse, temp, SpO2, NIHSS)
    │   ├── prescriptionController.js # Prescriptions linked to consultations
    │   ├── symptomController.js      # Symptom catalogue
    │   ├── testController.js         # Lab/diagnostic tests
    │   ├── neuroExamController.js    # Neurological examination records
    │   ├── neuroOptionsController.js # Dropdown options for neuro exam fields
    │   ├── followupController.js     # Follow-up scheduling
    │   ├── dashboardController.js    # Aggregated dashboard statistics
    │   ├── getPatientHistory.js      # Full patient history with pagination
    │   ├── suggestionController.js   # Medicine suggestions by symptoms
    │   ├── medicineController.js     # Medicine catalogue
    │   └── medicineInstructionsController.js
    │
    ├── routes/
    │   ├── authRoutes.js
    │   ├── patientRoutes.js
    │   ├── consultationRoutes.js
    │   ├── vitalRoutes.js
    │   ├── prescriptionRoutes.js
    │   ├── symptomRoutes.js
    │   ├── testRoutes.js
    │   ├── neuroExamRoutes.js
    │   ├── neuroOptionsRoutes.js
    │   ├── followupRoutes.js
    │   ├── dashboardRoutes.js
    │   ├── patientHistoryRoutes.js
    │   ├── suggestionRoutes.js
    │   └── medicineRoutes.js
    │
    ├── middleware/
    │   ├── auth.js                   # JWT requireAuth + requireRole guards
    │   └── validate.js               # Zod schema validation middleware
    │
    ├── models/
    │   └── db.js                     # PostgreSQL connection pool + ensureIndexes()
    │
    ├── cron/
    │   └── followUpReminder.js       # Follow-up reminder handler
    │
    └── utils/
        ├── ApiError.js               # Structured error class
        ├── ApiResponse.js            # Consistent response wrapper
        ├── asyncHandler.js           # try/catch wrapper for async handlers
        └── cache.js                  # In-memory cache utility
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# ── Server ────────────────────────────────────────────────
PORT=4500
NODE_ENV=development          # development | production | test

# ── Database ──────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
DB_POOL_SIZE=10               # Max concurrent DB connections
DB_CONNECTION_TIMEOUT=10000   # ms before connection attempt fails
DB_MAX_RETRIES=5
DB_RETRY_DELAY=2000

# ── Authentication ────────────────────────────────────────
JWT_SECRET=your-very-long-random-secret-minimum-32-chars

# ── CORS ─────────────────────────────────────────────────
# Comma-separated list of allowed frontend origins
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app

# ── Security ─────────────────────────────────────────────
TRUST_PROXY=false             # Set true behind a reverse proxy (Vercel, Nginx)
CRON_SECRET=your-cron-secret  # Shared secret for /api/cron/* endpoints

# ── Optional ─────────────────────────────────────────────
CLUSTER_MODE=false            # true = use all CPU cores
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- A PostgreSQL database (NeonDB free tier works perfectly)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Then edit .env with your values

# 3. Run database migrations
# Execute your SQL schema against your PostgreSQL database first.

# 4. Start in development mode (hot reload)
npm run dev

# 5. Start in production mode
npm start
```

Server starts at `http://localhost:4500` by default.

### Quick verification

```bash
curl http://localhost:4500/health
# Should return: { "status": "connected", "database": { ... } }

curl http://localhost:4500/ping
# Should return: Pong at 2026-03-08T...
```

---

## API Reference

### Base URL

```
http://localhost:4500/api
```

All routes except `/api/auth/*` require a `Bearer` token in the `Authorization` header.

---

### Authentication

#### POST /api/auth/login

Login and receive a JWT token.

**Request body:**
```json
{
  "email": "doctor@clinic.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": 1, "email": "doctor@clinic.com", "role": "doctor" }
}
```

#### POST /api/auth/register

Register a new user account.

```json
{
  "email": "newdoctor@clinic.com",
  "password": "securepassword",
  "role": "doctor"
}
```

---

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/patients` | List all patients |
| `POST` | `/api/patients` | Create a new patient |
| `GET` | `/api/patients/:id` | Get patient by ID |
| `PUT` | `/api/patients/:id` | Update patient details |
| `DELETE` | `/api/patients/:id` | Delete a patient |
| `GET` | `/api/patients/search?mobile=03001234567` | Search by mobile number |
| `GET` | `/api/patients/search?name=Ahmad` | Search by name |

**Create patient — request body:**
```json
{
  "name": "Ahmad Ali",
  "mobile": "03001234567",
  "age": 45,
  "gender": "male",
  "address": "Lahore, Pakistan"
}
```

**Search response:**
```json
{
  "success": true,
  "exists": true,
  "data": {
    "id": 42,
    "name": "Ahmad Ali",
    "mobile": "03001234567",
    "age": 45,
    "gender": "male"
  }
}
```

When multiple patients match a name search, `data` is an array.

---

### Consultations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/consultations` | Create a basic consultation |
| `GET` | `/api/consultations` | List all consultations |
| `GET` | `/api/consultations/:id` | Get consultation with symptoms and vitals |
| `GET` | `/api/consultations/patient/:patientId` | All consultations for a patient |
| `POST` | `/api/consultations/:consultationId/symptoms` | Add symptoms to a consultation |
| `POST` | **`/api/consultations/complete`** | **Batch save (recommended)** |

---

#### POST /api/consultations/complete — Batch Save

The primary endpoint. Saves the entire consultation in **one database transaction** — replaces 7 separate API calls with a single round-trip.

**Request body (all fields except `patient_id` are optional):**

```json
{
  "patient_id": 42,
  "doctor_name": "Dr. Abdul Rauf",
  "visit_date": "2026-03-08T10:00:00.000Z",

  "vitals": {
    "pulse_rate": 80,
    "blood_pressure": "120/80",
    "temperature": 98.6,
    "spo2_level": 98,
    "nihss_score": 2,
    "fall_assessment": "Done"
  },

  "symptom_ids": [1, 3, 7],

  "medicines": [
    {
      "medicine_id": 15,
      "dosage_en": "1 tablet",
      "dosage_urdu": "1 گولی",
      "frequency_en": "Twice daily",
      "frequency_urdu": "دن میں دو بار",
      "duration_en": "7 days",
      "duration_urdu": "7 دن",
      "instructions_en": "After meals",
      "instructions_urdu": "کھانے کے بعد",
      "how_to_take_en": "With water",
      "how_to_take_urdu": "پانی کے ساتھ"
    }
  ],

  "test_ids": [2, 5],

  "neuro": {
    "motor_function": "Normal",
    "muscle_tone": "Normal",
    "muscle_strength": "5/5",
    "deep_tendon_reflexes": "2+",
    "plantar_reflex": "Flexor",
    "coordination": "Intact",
    "gait_assessment": "Normal",
    "speech_assessment": "Clear",
    "cranial_nerves": "Intact",
    "pupillary_reaction": "Equal and reactive",
    "eye_movements": "Full",
    "romberg_test": "Negative",
    "diagnosis": "Tension headache",
    "treatment_plan": "Rest and analgesics",
    "notes": "Patient to return if symptoms worsen",
    "mmse_score": 28,
    "gcs_score": 15
  },

  "follow_up": {
    "follow_up_date": "2026-03-22",
    "notes": "Review in 2 weeks"
  }
}
```

**Success response (201):**
```json
{
  "message": "Consultation saved successfully",
  "consultation": { "id": 101, "patient_id": 42, "visit_date": "..." },
  "vitals": { "id": 55, "pulse_rate": 80, ... },
  "symptoms_added": 3,
  "prescriptions": [ { "id": 201, "medicine_id": 15, ... } ],
  "tests": [ { "id": 2, "test_name": "MRI Brain" } ],
  "neuro": { "id": 77, "diagnosis": "Tension headache", ... },
  "follow_up": { "id": 33, "follow_up_date": "2026-03-22", ... }
}
```

**Error responses:**

| Status | When |
|--------|------|
| `400` | `patient_id` is missing or not a number |
| `400` | One or more `medicine_id` values are 0, negative, or non-integer |
| `400` | Medicine IDs sent do not exist in the `medicines` table |
| `400` | Test IDs sent do not exist in the `tests` table |
| `500` | Any other database error (full ROLLBACK happens automatically) |

---

### Patient History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/patient-history/:patientId` | Full paginated history |

**Query parameters:**
- `page` — page number (default: 1)
- `limit` — records per page (default: 5)

**Example:**
```
GET /api/patient-history/42?page=1&limit=5
```

Returns consultations with all nested data (vitals, prescriptions, symptoms, tests, neuro exam, follow-ups) fetched in a single optimized CTE query. No N+1.

---

### Vital Signs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/vitals` | Record vital signs |
| `GET` | `/api/vitals/consultation/:consultationId` | Vitals for a consultation |
| `GET` | `/api/vitals/patient/:patientId` | All vitals for a patient |

**Record vitals body:**
```json
{
  "consultation_id": 101,
  "patient_id": 42,
  "pulse_rate": 80,
  "blood_pressure": "120/80",
  "temperature": 98.6,
  "spo2_level": 98,
  "nihss_score": 2,
  "fall_assessment": "Done"
}
```

---

### Medicines

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/medicines` | List all medicines (Cache-Control: 5 min) |
| `POST` | `/api/medicines` | Create a new medicine |
| `PUT` | `/api/medicines/:id` | Update medicine |
| `DELETE` | `/api/medicines/:id` | Delete medicine |

**Create medicine body:**
```json
{
  "brand_name": "Brufen",
  "generic_name": "Ibuprofen",
  "form": "Tablet",
  "strength": "400mg"
}
```

---

### Symptoms

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/symptoms` | List all symptoms (Cache-Control: 5 min) |
| `POST` | `/api/symptoms` | Create a symptom |

---

### Diagnostic Tests

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tests` | List all tests (Cache-Control: 5 min) |
| `POST` | `/api/tests` | Create a test |
| `POST` | `/api/tests/assign` | Assign tests to a consultation |

---

### Prescriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prescriptions/consultation/:id` | Prescriptions for a consultation |
| `POST` | `/api/prescriptions` | Add a prescription |
| `PUT` | `/api/prescriptions/:id` | Update a prescription |
| `DELETE` | `/api/prescriptions/:id` | Delete a prescription |

---

### Neurological Examination

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/examination` | Create a neuro exam record |
| `GET` | `/api/examination/:id` | Get exam by ID |
| `GET` | `/api/examination/consultation/:consultationId` | Exams for a consultation |
| `GET` | `/api/examination/patient/:patientId` | All exams for a patient |
| `PUT` | `/api/examination/:id` | Update exam |
| `DELETE` | `/api/examination/:id` | Delete exam |

---

### Neuro Options (Dropdown Values)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/neuro-options/all` | All dropdown options (Cache-Control: 1 hour) |

Returns all valid values for every neuro exam dropdown field (motor function, muscle tone, reflexes, gait, coordination, etc.).

---

### Follow-Ups

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/followups/:consultation_id` | Schedule a follow-up |
| `GET` | `/api/followups/:consultation_id` | Get follow-ups for a consultation |
| `PUT` | `/api/followups/:id` | Update / mark as completed |

**Schedule follow-up body:**
```json
{
  "follow_up_date": "2026-03-22",
  "notes": "Review blood pressure and MRI results"
}
```

**Mark as completed:**
```json
{
  "follow_up_date": "2026-03-22",
  "notes": "Patient reviewed",
  "is_completed": true
}
```

---

### Medicine Suggestions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/suggestions` | Get medicine suggestions based on symptom IDs |

**Request body:**
```json
{ "symptom_ids": [1, 3, 7] }
```

---

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stats` | Overview counts, recent patients, follow-ups, trend |

**Response:**
```json
{
  "counts": {
    "total_patients": 250,
    "consultations_today": 8,
    "upcoming_followups": 12
  },
  "recent_patients": [
    { "id": 42, "name": "Ahmad Ali", "visit_date": "2026-03-08" }
  ],
  "upcoming_followups": [
    { "patient_name": "Sara Khan", "follow_up_date": "2026-03-10", "notes": "..." }
  ],
  "monthly_trend": [
    { "month": "2026-03", "count": 45 }
  ]
}
```

---

### Cron Endpoints

Called by an external cron service. Require the `x-cron-secret` header matching `CRON_SECRET` env var.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cron/follow-up-reminders` | Send WhatsApp reminders for upcoming follow-ups |
| `GET` | `/api/cron/db-keepalive` | Ping the DB to prevent cold starts |

**Example cron-job.org setup:**
```
URL: https://your-backend.vercel.app/api/cron/db-keepalive
Headers: x-cron-secret: your-cron-secret
Schedule: Every 5 minutes
```

---

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Full health check — DB status, version, latency, memory |
| `GET` | `/ping` | Lightweight DB ping — returns "Pong at {timestamp}" |
| `GET` | `/` | API info and version |

---

## Authentication

The API uses **JWT Bearer token** authentication.

**Flow:**

1. Call `POST /api/auth/login` with credentials → receive `token`
2. Include the token in all subsequent requests:
   ```
   Authorization: Bearer eyJhbGci...
   ```
3. Tokens expire after **24 hours** by default
4. On expiry, the API returns `401 Token expired` — the frontend should redirect to login

**Public endpoints (no token required):**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /health`
- `GET /ping`
- `GET /` (root)
- `GET /api/cron/*` (protected by `CRON_SECRET` instead)

**Role-based access:**

The `requireRole` middleware can restrict routes to specific user roles. Current roles: `doctor`, `admin`.

---

## Database Schema Overview

### Core Tables

```sql
-- Patients
patients (id, name, mobile, age, gender, address, created_at)

-- Consultations
consultations (id, patient_id, doctor_name, visit_date, created_at)

-- Vital Signs
vital_signs (
  id, consultation_id, patient_id,
  pulse_rate, blood_pressure, temperature,
  spo2_level, nihss_score, fall_assessment, recorded_at
)

-- Medicines Catalogue
medicines (id, brand_name, generic_name, form, strength, created_at)

-- Prescriptions
prescriptions (
  id, consultation_id, patient_id, medicine_id,
  dosage_en, dosage_urdu,
  frequency_en, frequency_urdu,
  duration_en, duration_urdu,
  instructions_en, instructions_urdu,
  how_to_take_en, how_to_take_urdu,
  prescribed_at
)

-- Symptoms Catalogue
symptoms (id, name, created_at)

-- Junction: Consultation <-> Symptoms
consultation_symptoms (consultation_id, symptom_id)  -- UNIQUE

-- Diagnostic Tests Catalogue
tests (id, test_name, created_at)

-- Junction: Consultation <-> Tests
consultation_tests (consultation_id, test_id, assigned_at)  -- UNIQUE

-- Neurological Exams (40 fields)
neurological_exams (
  id, patient_id, consultation_id,
  motor_function, muscle_tone, muscle_strength,
  deep_tendon_reflexes, plantar_reflex, sensory_examination,
  pain_sensation,          -- boolean
  vibration_sense,         -- boolean
  proprioception,          -- boolean
  temperature_sensation,   -- boolean
  coordination, finger_nose_test, heel_shin_test,
  gait_assessment, romberg_test, cranial_nerves,
  pupillary_reaction, eye_movements,
  facial_sensation,        -- boolean
  swallowing_function,     -- boolean
  tongue_movement,
  straight_leg_raise_test, straight_leg_raise_left, straight_leg_raise_right,
  lasegue_test,
  brudzinski_sign,         -- boolean
  kernig_sign,             -- boolean
  cognitive_assessment, speech_assessment,
  tremors, involuntary_movements,
  diagnosis, treatment_plan, notes, fundoscopy, power,
  mmse_score, gcs_score,
  created_at
)

-- Follow-Ups
follow_ups (id, consultation_id, follow_up_date, notes, is_completed, created_at)

-- Users
users (id, email, password_hash, role, created_at)
```

### Auto-created Performance Indexes

Created automatically at every server startup via `ensureIndexes()` (safe — uses `IF NOT EXISTS`):

```sql
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id      ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_visit_date      ON consultations(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_vital_signs_consultation_id   ON vital_signs(consultation_id);
CREATE INDEX IF NOT EXISTS idx_vital_signs_patient_id        ON vital_signs(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_symptoms_*       ON consultation_symptoms(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_tests_*          ON consultation_tests(consultation_id);
CREATE INDEX IF NOT EXISTS idx_neurological_exams_*          ON neurological_exams(consultation_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_consultation_id    ON follow_ups(consultation_id);
```

---

## Performance Features

| Feature | Details |
|---------|---------|
| **Gzip compression** | All JSON responses compressed ~70% via `compression` middleware |
| **HTTP Cache-Control** | Symptoms, medicines, tests cached `max-age=300` (5 min); neuro-options cached `max-age=3600` (1 hour) |
| **Batch consultation** | `POST /api/consultations/complete` replaces 7 round-trips with 1 DB transaction |
| **DB connection pooling** | `pg.Pool` — `min: 0`, `max: 10`, `idleTimeoutMillis: 10000` — serverless-optimised |
| **Auto performance indexes** | 9 indexes on foreign keys — created at startup |
| **Single-query history** | Patient history uses CTE + JSON aggregation — no N+1 queries |
| **Response-time header** | `X-Response-Time` header on every request for performance monitoring |
| **Rate limiting** | 500 requests per 15 minutes per IP prevents abuse |

---

## Security Features

| Feature | Details |
|---------|---------|
| **JWT authentication** | All `/api/*` routes require a valid Bearer token |
| **Bcrypt password hashing** | Passwords hashed with bcryptjs before storage |
| **Helmet** | Sets: CSP, HSTS (1 year), X-Content-Type-Options, X-XSS-Protection, frameguard |
| **CORS whitelist** | Only origins in `ALLOWED_ORIGINS` can call the API |
| **Rate limiting** | 500 req/15 min per IP |
| **Zod validation** | Request bodies validated with strict schemas |
| **Input sanitization** | String inputs strip `' " ;` characters to prevent injection |
| **Body size limit** | Requests capped at 200 KB |
| **Request IDs** | UUID in `X-Request-ID` header on every response for distributed tracing |
| **Permissions-Policy header** | Disables geolocation and microphone APIs |

---

## Health Check and Monitoring

```bash
# Full health check
GET http://localhost:4500/health
```

**Healthy response (200):**
```json
{
  "status": "connected",
  "database": {
    "type": "PostgreSQL",
    "version": "16.2",
    "latency": "4ms"
  },
  "uptime": 3600.5,
  "memory": {
    "rss": 45678592,
    "heapUsed": 23456789,
    "heapTotal": 67108864
  }
}
```

**Unhealthy response (503):**
```json
{
  "status": "DB_ERROR",
  "error": "Connection refused"
}
```

Every request also logs structured JSON:
```json
{
  "level": "INFO",
  "timestamp": "2026-03-08T10:00:00.000Z",
  "method": "POST",
  "path": "/api/consultations/complete",
  "status": 201,
  "duration": "45.23",
  "requestId": "a1b2c3d4-..."
}
```

---

## Deployment Notes

### Vercel (Serverless)

The app is fully serverless-compatible:

- Set `DB_POOL_SIZE=3` — Vercel functions don't share pool state across invocations
- Set `TRUST_PROXY=true` — needed behind Vercel's proxy
- Set all env vars in Vercel Dashboard > Project > Settings > Environment Variables
- The `allowExitOnIdle: true` pool option lets functions exit cleanly after each request

### Environment differences

| Setting | Development | Production |
|---------|-------------|------------|
| DB SSL | Disabled | Enabled (`rejectUnauthorized: true`) |
| Morgan log format | `dev` (coloured, compact) | `combined` (Apache-style) |
| JWT secret | Falls back to `dev-secret` | Required — throws on startup if missing |
| Request ID header | Set | Set |

### Keep-alive cron for NeonDB

NeonDB suspends after ~5 minutes of inactivity. Set up a cron job on [cron-job.org](https://cron-job.org) or Vercel Cron:

```
URL:     https://your-backend.vercel.app/api/cron/db-keepalive
Header:  x-cron-secret: <your CRON_SECRET>
Every:   5 minutes
```

---

## Common Errors

| HTTP Status | Error Message | Cause | Fix |
|-------------|---------------|-------|-----|
| `400` | `patient_id is required and must be a number` | Missing or non-numeric `patient_id` | Send `patient_id` as a positive integer |
| `400` | `One or more medicine_ids are invalid` | A `medicine_id` is 0, negative, or NaN | Filter out zero/null medicine IDs before submitting |
| `400` | `Medicine IDs do not exist: 5, 12` | Sent IDs that don't exist in the `medicines` table | Use IDs returned from `GET /api/medicines` |
| `400` | `Test IDs do not exist: 3` | Sent IDs that don't exist in the `tests` table | Use IDs returned from `GET /api/tests` |
| `400` | `Invalid JSON payload` | Malformed JSON body | Check `Content-Type: application/json` and valid JSON |
| `401` | `Authentication required` | Missing `Authorization` header | Add `Bearer <token>` header |
| `401` | `Token expired` | JWT has expired (24h default) | Re-login to get a fresh token |
| `401` | `Invalid token` | Token is forged or signed with wrong secret | Re-login |
| `403` | `Insufficient permissions` | User role not allowed for this route | Use an account with correct role |
| `404` | `Consultation not found` | ID doesn't exist in DB | Check the consultation ID |
| `404` | `Patient not found` | Patient ID doesn't exist | Check the patient ID |
| `429` | `Too many requests` | Rate limit exceeded (500/15min) | Wait and retry |
| `500` | `Failed to save consultation` | DB error in batch transaction (automatically rolled back) | Check server logs for SQL error details |
| `503` | `DB_ERROR` | Database unreachable | Check `DATABASE_URL` and NeonDB status |
