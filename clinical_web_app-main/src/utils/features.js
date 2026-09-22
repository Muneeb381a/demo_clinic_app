// src/utils/features.js
// Mirrors isDoctor/isOwner in RequireRole.jsx — a plain predicate over the
// user object getUser() returns, which now carries a nested `clinic: {
// plan, features }` (see backend authController.js's login/refresh/me).
// `clinic` is null for a platform admin (no clinic_id) and undefined for a
// still-bootstrapping session, so this stays false rather than throwing
// either way.

export const hasFeature = (user, key) => Boolean(user?.clinic?.features?.[key]);

// `trial_expired` is computed server-side (authController.js's
// withClinicPlan, re-checked on every login/refresh/me) from the DB's own
// clock — this is display-only. The real gate is the backend's
// requireTrialActive middleware, which blocks every request independent of
// whatever this flag says the client thinks.
export const isTrialExpired = (user) => Boolean(user?.clinic?.trial_expired);

// Days left in an active trial, for a "N days left" banner — null when not
// on a trial or once it's expired (trialDaysLeft > 0 only while still active).
export const trialDaysLeft = (user) => {
  if (!user?.clinic?.is_trial || !user.clinic.trial_ends_at || user.clinic.trial_expired) return null;
  const ms = new Date(user.clinic.trial_ends_at) - new Date();
  return Math.max(1, Math.ceil(ms / 86400000));
};
