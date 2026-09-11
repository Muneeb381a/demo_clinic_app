// src/config/plans.js
// Named presets a platform admin can hand a clinic at creation time (or
// switch it to later) — seat limits (max_doctors/max_receptionists, on
// `clinics` since migration 0005) plus which optional modules are on
// (`clinics.features`, since migration 0007). A preset only supplies
// defaults: every field it sets stays independently editable per clinic
// afterward, exactly like max_doctors already was before plans existed.
//
// Retuning a preset's numbers/flags here only changes what NEW clinics (or
// clinics explicitly re-applying a plan via PATCH) get — it never rewrites
// an already-provisioned clinic's stored values.

export const PLAN_PRESETS = {
  clinic: {
    max_doctors: 1,
    max_receptionists: 1,
    features: {
      ai_suggestions: false,
      chatbot: true,
      whatsapp_reminders: false,
    },
  },
  hospital: {
    max_doctors: 10,
    max_receptionists: 5,
    features: {
      ai_suggestions: true,
      chatbot: true,
      whatsapp_reminders: true,
    },
  },
};

export const PLAN_NAMES = Object.keys(PLAN_PRESETS);

// Every flag any preset sets — the full set requireFeature() and the
// platform admin's per-clinic feature toggles know about.
export const FEATURE_KEYS = [
  ...new Set(Object.values(PLAN_PRESETS).flatMap((p) => Object.keys(p.features))),
];

export const isValidPlan = (plan) => PLAN_NAMES.includes(plan);
