// src/utils/features.js
// Mirrors isDoctor/isOwner in RequireRole.jsx — a plain predicate over the
// user object getUser() returns, which now carries a nested `clinic: {
// plan, features }` (see backend authController.js's login/refresh/me).
// `clinic` is null for a platform admin (no clinic_id) and undefined for a
// still-bootstrapping session, so this stays false rather than throwing
// either way.

export const hasFeature = (user, key) => Boolean(user?.clinic?.features?.[key]);
