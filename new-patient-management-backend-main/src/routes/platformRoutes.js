import express from "express";
import { createClinic, listClinics, updateClinic } from "../controllers/platformController.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireRole("platform_admin"));

router.post("/clinics", createClinic);
router.get("/clinics", listClinics);
router.patch("/clinics/:id", updateClinic);

export default router;
