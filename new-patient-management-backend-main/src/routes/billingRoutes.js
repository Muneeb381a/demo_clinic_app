import express from "express";
import {
  requireClinicUser, listDoctorFees, upsertDoctorFee, listServices, createService, updateService,
  createBill, listBills, getBill, addPayment, voidBill, todaySummary,
} from "../controllers/billingController.js";
import { requireOwner } from "../middleware/auth.js";
import { requireFeature } from "../middleware/clinicStatus.js";

const router = express.Router();

// Whole module is a plan feature and is per-clinic; platform admins have no clinic.
router.use(requireFeature("billing"));
router.use(requireClinicUser);

router.get("/doctors", listDoctorFees);
router.put("/doctors/:doctorId", requireOwner, upsertDoctorFee);

router.get("/services", listServices);
router.post("/services", requireOwner, createService);
router.put("/services/:id", requireOwner, updateService);

router.get("/summary/today", todaySummary);
router.get("/bills", listBills);
router.post("/bills", createBill);
router.get("/bills/:id", getBill);
router.post("/bills/:id/payments", addPayment);
router.post("/bills/:id/void", requireOwner, voidBill);

export default router;
