// src/docs/openapi.js
// Hand-maintained OpenAPI 3.1 description of the stable public contract.
// It intentionally covers the core surface (auth, patients, consultations,
// prescriptions, vitals, follow-ups, health) rather than every internal
// endpoint. Served at /api-docs (UI) and /api-docs.json (raw).

const bearer = [{ bearerAuth: [] }];

const err = (desc) => ({
  description: desc,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

const idParam = (name) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
});

export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Clinic Management System API",
    version: "1.0.0",
    description:
      "Core contract for the clinic app. All /api routes except /api/auth/* " +
      "require a Bearer access token; sessions are kept alive by the httpOnly " +
      "refresh cookie via POST /api/auth/refresh. Every doctor sees only their " +
      "own patients and consultations.",
  },
  servers: [{ url: "/", description: "same-origin (Vite proxy in dev, Vercel rewrite in prod)" }],
  tags: [
    { name: "Auth" },
    { name: "Patients" },
    { name: "Consultations" },
    { name: "Prescriptions" },
    { name: "Vitals" },
    { name: "Follow-ups" },
    { name: "System" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
          requestId: { type: "string", format: "uuid" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["doctor", "admin"] },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          accessToken: { type: "string", description: "JWT, ~15 min TTL" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      Patient: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          mobile: { type: "string" },
          mr_no: { type: "string" },
          age: { type: "integer", nullable: true },
          gender: { type: "string", enum: ["male", "female", "other"], nullable: true },
          weight: { type: "number", nullable: true },
          height: { type: "number", nullable: true },
        },
      },
      PatientInput: {
        type: "object",
        required: ["name", "mobile"],
        properties: {
          name: { type: "string", maxLength: 100 },
          mobile: { type: "string", pattern: "^\\+?\\d{10,15}$" },
          age: { type: "integer", minimum: 0, maximum: 150 },
          gender: { type: "string", enum: ["male", "female", "other"] },
          weight: { type: "number", minimum: 0 },
          height: { type: "number", minimum: 0 },
        },
      },
      Consultation: {
        type: "object",
        properties: {
          id: { type: "integer" },
          patient_id: { type: "integer" },
          doctor_name: { type: "string" },
          visit_date: { type: "string", format: "date-time" },
          created_by: { type: "integer" },
        },
      },
    },
  },
  security: bearer,
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        security: [],
        summary: "Readiness — is the database reachable?",
        responses: {
          200: { description: "ok" },
          503: { description: "degraded (database unreachable)" },
        },
      },
    },
    "/live": {
      get: {
        tags: ["System"],
        security: [],
        summary: "Liveness — process is up",
        responses: { 200: { description: "ok" } },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Create a doctor account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  specialization: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "created; sets the refresh cookie",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          409: err("email already registered"),
          429: err("too many attempts"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Exchange credentials for an access token + refresh cookie",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "ok; Set-Cookie: rt=…; HttpOnly",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: err("invalid credentials"),
          429: err("too many attempts"),
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Rotate the refresh cookie, get a fresh access token",
        description: "Reads the httpOnly `rt` cookie. Replaying a rotated token revokes the whole session family.",
        responses: {
          200: { content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } }, description: "rotated" },
          401: err("session expired or revoked"),
        },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], security: [], summary: "Revoke the current refresh token", responses: { 200: { description: "ok" } } },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "The authenticated user",
        responses: {
          200: { content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } }, description: "ok" },
          401: err("authentication required"),
        },
      },
    },
    "/api/patients": {
      get: {
        tags: ["Patients"],
        summary: "List the caller's patients",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 1000 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Patient" } } } }, description: "ok" } },
      },
      post: {
        tags: ["Patients"],
        summary: "Register a patient (owned by the caller)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PatientInput" } } } },
        responses: {
          201: { content: { "application/json": { schema: { $ref: "#/components/schemas/Patient" } } }, description: "created" },
          400: err("validation failed"),
        },
      },
    },
    "/api/patients/search": {
      get: {
        tags: ["Patients"],
        summary: "Search the caller's patients by name or mobile",
        parameters: [
          { name: "name", in: "query", schema: { type: "string" } },
          { name: "mobile", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 50 } },
        ],
        responses: { 200: { description: "ok" }, 400: err("name or mobile required") },
      },
    },
    "/api/patients/suggest": {
      get: {
        tags: ["Patients"],
        summary: "Autocomplete the caller's patients by name prefix",
        parameters: [{ name: "name", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "ok" }, 400: err("name required") },
      },
    },
    "/api/patients/{id}": {
      get: { tags: ["Patients"], summary: "Get one patient", parameters: [idParam("id")], responses: { 200: { content: { "application/json": { schema: { $ref: "#/components/schemas/Patient" } } }, description: "ok" }, 404: err("not found / not yours") } },
      put: { tags: ["Patients"], summary: "Update a patient", parameters: [idParam("id")], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/PatientInput" } } } }, responses: { 200: { description: "ok" }, 404: err("not found / not yours") } },
      delete: { tags: ["Patients"], summary: "Delete a patient", parameters: [idParam("id")], responses: { 200: { description: "ok" }, 404: err("not found / not yours") } },
    },
    "/api/patients/{id}/history": {
      get: { tags: ["Patients"], summary: "Consultation history for a patient", parameters: [idParam("id")], responses: { 200: { description: "ok" }, 404: err("not found / not yours") } },
    },
    "/api/consultations": {
      get: {
        tags: ["Consultations"],
        summary: "List the caller's consultations",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Consultation" } } } }, description: "ok" } },
      },
      post: {
        tags: ["Consultations"],
        summary: "Create a consultation for one of the caller's patients",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["patient_id", "doctor_name"], properties: { patient_id: { type: "integer" }, doctor_name: { type: "string" }, visit_date: { type: "string", format: "date-time" } } } } } },
        responses: { 201: { description: "created" }, 400: err("bad request"), 404: err("patient not found / not yours") },
      },
    },
    "/api/consultations/complete": {
      post: {
        tags: ["Consultations"],
        summary: "Save a full consultation in one transaction",
        description: "Consultation + vitals + symptoms + prescriptions + tests + neuro exam + follow-up in a single round-trip.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["patient_id"],
                properties: {
                  patient_id: { type: "integer" },
                  doctor_name: { type: "string" },
                  visit_date: { type: "string", format: "date-time" },
                  vitals: { type: "object" },
                  symptom_ids: { type: "array", items: { type: "integer" } },
                  medicines: { type: "array", items: { type: "object" } },
                  test_ids: { type: "array", items: { type: "integer" } },
                  neuro: { type: "object" },
                  follow_up: { type: "object", properties: { follow_up_date: { type: "string" }, notes: { type: "string" } } },
                },
              },
            },
          },
        },
        responses: { 201: { description: "saved" }, 400: err("invalid medicine/test ids"), 404: err("patient not found / not yours") },
      },
    },
    "/api/consultations/{id}": {
      get: { tags: ["Consultations"], summary: "Consultation detail (with symptoms + vitals)", parameters: [idParam("id")], responses: { 200: { description: "ok" }, 404: err("not found / not yours") } },
    },
    "/api/consultations/patient/{patientId}": {
      get: { tags: ["Consultations"], summary: "All consultations for a patient", parameters: [idParam("patientId")], responses: { 200: { description: "ok" }, 404: err("patient not found / not yours") } },
    },
    "/api/prescriptions": {
      post: {
        tags: ["Prescriptions"],
        summary: "Add prescriptions to a consultation",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["consultation_id", "medicines"], properties: { consultation_id: { type: "integer" }, medicines: { type: "array", items: { type: "object" }, minItems: 1 } } } } } },
        responses: { 201: { description: "created" }, 400: err("validation failed"), 404: err("consultation not found / not yours") },
      },
    },
    "/api/prescriptions/consultation/{consultation_id}": {
      get: { tags: ["Prescriptions"], summary: "Prescriptions for a consultation", parameters: [idParam("consultation_id")], responses: { 200: { description: "ok" }, 404: err("not found / not yours") } },
    },
    "/api/prescriptions/patient/{patient_id}": {
      get: { tags: ["Prescriptions"], summary: "Prescriptions for a patient", parameters: [idParam("patient_id")], responses: { 200: { description: "ok" }, 404: err("not found / not yours") } },
    },
    "/api/vitals": {
      post: {
        tags: ["Vitals"],
        summary: "Record vitals for a consultation",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["consultation_id", "patient_id"], properties: { consultation_id: { type: "integer" }, patient_id: { type: "integer" }, pulse_rate: { type: "integer" }, blood_pressure: { type: "string" }, temperature: { type: "number" }, spo2_level: { type: "number" }, nihss_score: { type: "integer" }, fall_assessment: { type: "string" } } } } } },
        responses: { 201: { description: "created" }, 404: err("consultation not found / not yours") },
      },
    },
    "/api/vitals/{patient_id}": {
      get: { tags: ["Vitals"], summary: "Vitals history for a patient", parameters: [idParam("patient_id")], responses: { 200: { description: "ok" }, 404: err("patient not found / not yours") } },
    },
    "/api/followups/{consultation_id}": {
      post: { tags: ["Follow-ups"], summary: "Schedule a follow-up", parameters: [idParam("consultation_id")], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["follow_up_date"], properties: { follow_up_date: { type: "string" }, notes: { type: "string" } } } } } }, responses: { 201: { description: "created" }, 404: err("consultation not found / not yours") } },
      get: { tags: ["Follow-ups"], summary: "Follow-ups for a consultation", parameters: [idParam("consultation_id")], responses: { 200: { description: "ok" }, 404: err("consultation not found / not yours") } },
    },
  },
};
