import twilio from 'twilio';
import { pool } from '../models/db.js';


// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const urduDate = (date) => {
  const urduMonths = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];
  const d = new Date(date);
  return `${d.getDate()} ${urduMonths[d.getMonth()]} ${d.getFullYear()}`;
};

// Phone Formatting (unchanged)
const formatPhoneNumber = (mobile) => mobile.startsWith('+') ? mobile : 
  mobile.startsWith('0') ? `+92${mobile.slice(1)}` : `+${mobile}`;

// Schedule Follow-up
export const scheduleFollowUp = async (req, res) => {
  try {
    const { consultation_id } = req.params;
    const { follow_up_date, notes } = req.body;

    if (!follow_up_date) {
      return res.status(400).json({ error: "Follow-up date is required" });
    }

    if (isNaN(new Date(follow_up_date).getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Single query: validate consultation exists AND insert in one round-trip via CTE
    const result = await pool.query(
      `WITH consultation AS (
         SELECT id FROM consultations WHERE id = $1
       )
       INSERT INTO follow_ups (consultation_id, follow_up_date, notes)
       SELECT $1, $2, $3 FROM consultation
       RETURNING *`,
      [consultation_id, follow_up_date, notes || "عام چیک اپ"]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("scheduleFollowUp error:", error.message);
    res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Enhanced Reminder System (checks next 3 days)
// export const sendFollowUpReminders = async () => {
//   try {
//     const today = new Date();
//     const nextThreeDays = [];
    
//     // Get dates for next 3 days
//     for (let i = 1; i <= 3; i++) {
//       const date = new Date(today);
//       date.setDate(date.getDate() + i);
//       nextThreeDays.push(date.toISOString().split('T')[0]);
//     }

//     // Get follow-ups within next 3 days
//     const result = await pool.query(
//       `SELECT f.*, p.mobile, p.name 
//        FROM follow_ups f
//        JOIN consultations c ON f.consultation_id = c.id
//        JOIN patients p ON c.patient_id = p.id
//        WHERE f.follow_up_date = ANY($1::date[])
//          AND f.is_completed = false`,
//       [nextThreeDays]
//     );

//     // Send reminders
//     for (const followUp of result.rows) {
//       const daysUntil = Math.floor(
//         (new Date(followUp.follow_up_date) - today) / (1000 * 60 * 60 * 24)
//       );

//       const reminderMessage = `یاد دہانی: محترم ${followUp.name}, آپ کا فالو اپ \
// ${daysUntil} دن بعد (${urduDate(followUp.follow_up_date)}) کو ہے۔ نوٹس: ${followUp.notes || 'کوئی نہیں'}`;

//       await twiliopool.messages.create({
//         from: process.env.TWILIO_WHATSAPP_NUMBER,
//         to: `whatsapp:${formatPhoneNumber(followUp.mobile)}`,
//         body: reminderMessage,
//       });
//     }
//   } catch (error) {
//     console.error("Reminder error:", error);
//   }
// };

// Get all follow-ups for a consultation (adapted for your route)
export const getFollowUps = async (req, res) => {
  try {
    const { consultation_id } = req.params;

    const result = await pool.query(`
      SELECT f.* FROM follow_ups f
      WHERE f.consultation_id = $1
      ORDER BY f.follow_up_date DESC
    `, [consultation_id]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching follow-ups" });
  }
};

// Update an existing follow-up
export const updateFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { follow_up_date, notes, is_completed } = req.body;

    if (is_completed !== undefined && typeof is_completed !== "boolean") {
      return res.status(400).json({ error: "is_completed must be a boolean" });
    }

    const result = await pool.query(
      `UPDATE follow_ups SET follow_up_date = $1, notes = $2, is_completed = $3
       WHERE id = $4 RETURNING *`,
      [follow_up_date, notes, is_completed, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Follow-up not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating follow-up" });
  }
};
