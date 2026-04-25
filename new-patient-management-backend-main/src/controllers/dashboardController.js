import { pool } from "../models/db.js";
import { cacheGet, cacheSet } from "../utils/cache.js";

const DASHBOARD_TTL = 60; // 1 minute — stats should feel near-realtime

// GET /api/dashboard/stats
// Returns all dashboard data in a single DB round-trip.
export const getDashboardStats = async (req, res) => {
  try {
    const cacheKey = "dashboard:stats";
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const result = await pool.query(`
      WITH
      counts AS (
        SELECT
          (SELECT COUNT(*) FROM patients)                                              AS total_patients,
          (SELECT COUNT(*) FROM consultations
             WHERE visit_date = CURRENT_DATE)                                          AS today_consultations,
          (SELECT COUNT(*) FROM patients
             WHERE checkup_date >= DATE_TRUNC('week', CURRENT_DATE))                  AS new_patients_this_week,
          (SELECT COUNT(*) FROM follow_ups
             WHERE follow_up_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')
                                                                                      AS upcoming_followups_count
      ),

      recent_patients AS (
        SELECT id, name, age, gender, mobile, mr_no,
               TO_CHAR(checkup_date, 'DD Mon YYYY') AS registered_on
        FROM patients
        ORDER BY id DESC
        LIMIT 6
      ),

      upcoming_followups AS (
        SELECT
          f.id,
          f.follow_up_date,
          f.notes,
          p.id   AS patient_id,
          p.name AS patient_name,
          p.mobile,
          TO_CHAR(f.follow_up_date, 'DD Mon YYYY') AS formatted_date
        FROM follow_ups f
        JOIN consultations c ON c.id = f.consultation_id
        JOIN patients p ON p.id = c.patient_id
        WHERE f.follow_up_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        ORDER BY f.follow_up_date ASC
        LIMIT 8
      ),

      monthly_trend AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', visit_date::date), 'Mon') AS month,
          COUNT(*) AS consultations
        FROM consultations
        WHERE visit_date::date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', visit_date::date)
        ORDER BY DATE_TRUNC('month', visit_date::date) ASC
      ),

      top_medicines AS (
        SELECT m.brand_name AS name, COUNT(*) AS count
        FROM prescriptions pr
        JOIN medicines m ON pr.medicine_id = m.id
        GROUP BY m.brand_name
        ORDER BY count DESC
        LIMIT 10
      ),

      top_symptoms AS (
        SELECT s.name, COUNT(*) AS count
        FROM consultation_symptoms cs
        JOIN symptoms s ON cs.symptom_id = s.id
        GROUP BY s.name
        ORDER BY count DESC
        LIMIT 10
      )

      SELECT
        (SELECT ROW_TO_JSON(c) FROM counts c)                                          AS counts,
        (SELECT COALESCE(JSON_AGG(r), '[]') FROM recent_patients r)                    AS recent_patients,
        (SELECT COALESCE(JSON_AGG(u ORDER BY u.follow_up_date ASC), '[]') FROM upcoming_followups u) AS upcoming_followups,
        (SELECT COALESCE(JSON_AGG(m), '[]') FROM monthly_trend m)                      AS monthly_trend,
        (SELECT COALESCE(JSON_AGG(tm), '[]') FROM top_medicines tm)                    AS top_medicines,
        (SELECT COALESCE(JSON_AGG(ts), '[]') FROM top_symptoms ts)                     AS top_symptoms
    `);

    const row = result.rows[0];
    const response = {
      counts: row.counts || {},
      recent_patients: row.recent_patients || [],
      upcoming_followups: row.upcoming_followups || [],
      monthly_trend: row.monthly_trend || [],
      top_medicines: row.top_medicines || [],
      top_symptoms: row.top_symptoms || [],
    };

    await cacheSet(cacheKey, response, DASHBOARD_TTL);
    res.json(response);
  } catch (error) {
    console.error("getDashboardStats error:", error.message);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};
