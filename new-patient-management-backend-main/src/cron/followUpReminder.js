// src/cron/followUpReminder.js
// Automated follow-up reminder handler.
// Called daily by Vercel Cron at 9:00 AM PKT (4:00 UTC).
// Sends WhatsApp messages to patients whose follow-up is tomorrow.
//
// Vercel Cron triggers a GET /api/cron/follow-up-reminders request.
// The route is protected by CRON_SECRET to prevent public access.

import { pool } from "../models/db.js";
import { logger } from "../../logger.js";

const urduDate = (date) => {
  const urduMonths = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];
  const d = new Date(date);
  return `${d.getDate()} ${urduMonths[d.getMonth()]} ${d.getFullYear()}`;
};

const formatPhone = (mobile) =>
  mobile.startsWith("+") ? mobile : mobile.startsWith("0") ? `+92${mobile.slice(1)}` : `+${mobile}`;

/**
 * Sends WhatsApp reminders for all follow-ups scheduled for tomorrow.
 * Returns a summary of results.
 */
export const sendFollowUpReminders = async () => {
  // Get tomorrow's date in YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Fetch all pending follow-ups for tomorrow in one query
  const { rows: followUps } = await pool.query(
    `SELECT f.id, f.follow_up_date, f.notes,
            p.name AS patient_name, p.mobile
     FROM follow_ups f
     JOIN consultations c ON f.consultation_id = c.id
     JOIN patients p ON c.patient_id = p.id
     WHERE f.follow_up_date = $1
       AND f.is_completed = false
       AND p.mobile IS NOT NULL`,
    [tomorrowStr]
  );

  if (followUps.length === 0) {
    logger.info("Follow-up reminders: no follow-ups scheduled for tomorrow");
    return { sent: 0, failed: 0, date: tomorrowStr };
  }

  logger.info(`Follow-up reminders: sending ${followUps.length} reminders for ${tomorrowStr}`);

  // Twilio WhatsApp integration
  // Uncomment and configure when TWILIO_* env vars are set
  /*
  const twilio = (await import("twilio")).default;
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  */

  let sent = 0;
  let failed = 0;

  for (const followUp of followUps) {
    try {
      const formattedPhone = formatPhone(followUp.mobile);
      const message = `محترم ${followUp.patient_name}،\nآپ کا فالو اپ کل ${urduDate(followUp.follow_up_date)} کو ہے۔\nنوٹس: ${followUp.notes || "عام چیک اپ"}\nبراہ کرم وقت پر تشریف لائیں۔`;

      // Uncomment when Twilio is configured:
      // await twilioClient.messages.create({
      //   from: process.env.TWILIO_WHATSAPP_NUMBER,
      //   to: `whatsapp:${formattedPhone}`,
      //   body: message,
      // });

      logger.info(`Reminder queued for ${followUp.patient_name} (${formattedPhone})`);
      sent++;
    } catch (error) {
      logger.error(`Failed to send reminder to follow-up ${followUp.id}`, { error: error.message });
      failed++;
    }
  }

  return { sent, failed, date: tomorrowStr, total: followUps.length };
};

/**
 * Express route handler for the Vercel Cron endpoint.
 * GET /api/cron/follow-up-reminders
 */
export const followUpReminderHandler = async (req, res) => {
  // Verify the request is from Vercel Cron (not a random visitor)
  const secret = req.headers["authorization"];
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const result = await sendFollowUpReminders();
    logger.info("Follow-up cron completed", result);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Follow-up cron failed", { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};
