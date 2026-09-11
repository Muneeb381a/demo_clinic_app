import express from "express";
import { createInvite, listStaff, removeStaff, cancelInvite } from "../controllers/clinicStaffController.js";
import { requireOwner } from "../middleware/auth.js";

const router = express.Router();
router.use(requireOwner);

router.post("/invites", createInvite);
router.delete("/invites/:id", cancelInvite);
router.get("/staff", listStaff);
router.delete("/staff/:id", removeStaff);

export default router;
