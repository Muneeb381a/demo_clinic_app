import express from "express";
import {
  requireClinicUser, listDoctors, listWards, createWard, updateWard, addBeds, updateBed, setBedStatus, bedBoard,
  admitPatient, transferPatient, dischargePatient, listAdmissions, getAdmission,
} from "../controllers/ipdController.js";
import { requireOwner } from "../middleware/auth.js";
import { requireFeature } from "../middleware/clinicStatus.js";

const router = express.Router();

router.use(requireFeature("ipd"));
router.use(requireClinicUser);

router.get("/doctors", listDoctors);
router.get("/wards", listWards);
router.post("/wards", requireOwner, createWard);
router.put("/wards/:id", requireOwner, updateWard);
router.post("/wards/:id/beds", requireOwner, addBeds);

router.get("/beds", bedBoard);
router.put("/beds/:id", requireOwner, updateBed);
router.put("/beds/:id/status", setBedStatus);

router.get("/admissions", listAdmissions);
router.post("/admissions", admitPatient);
router.get("/admissions/:id", getAdmission);
router.post("/admissions/:id/transfer", transferPatient);
router.post("/admissions/:id/discharge", dischargePatient);

export default router;
