// src/routes/publicRoutes.js
// Mounted at /api/public, before requireAuth in app.js — every route here
// must stay safe for an unauthenticated, unidentified caller.

import express from "express";
import { getClinicBySlug } from "../controllers/publicController.js";

const router = express.Router();

router.get("/clinics/by-slug/:slug", getClinicBySlug);

export default router;
