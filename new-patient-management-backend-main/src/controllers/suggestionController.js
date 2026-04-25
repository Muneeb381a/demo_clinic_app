// src/controllers/suggestionController.js
// Smart Prescription Assistant — core suggestion engine.
//
// Three endpoints:
//   GET  /api/suggest/symptoms?q=fever&lang=en   — symptom autocomplete
//   POST /api/suggest/prescription               — ranked medicines + tests from symptom_ids
//   POST /api/suggest/feedback                   — record doctor's accepted/dismissed choices
//   POST /api/suggest/process-feedback           — (admin/cron) run frequency update job

import { pool } from "../models/db.js";
import { cacheGet, cacheSet } from "../utils/cache.js";

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM AUTOCOMPLETE
// GET /api/suggest/symptoms?q=fev&lang=en
//
// Searches symptom names AND aliases. Returns deduplicated list ranked by:
//   1. Exact prefix match (starts with)
//   2. Contains match
//   3. Trigram similarity (fuzzy, catches typos)
// ─────────────────────────────────────────────────────────────────────────────
export const symptomAutocomplete = async (req, res) => {
  try {
    const q    = (req.query.q    || "").trim();
    const lang = (req.query.lang || "en").trim();
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 30);

    if (q.length < 1) {
      return res.json({ data: [] });
    }

    // Cache key (short TTL — symptoms are relatively stable)
    const cacheKey = `suggest:symptoms:${lang}:${q.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ data: cached });

    // Single query: union exact symptom name matches + alias matches, ranked by relevance
    const result = await pool.query(
      `SELECT DISTINCT ON (s.id)
         s.id,
         s.name,
         -- rank: 1 = prefix match on name, 2 = contains on name, 3 = alias match
         CASE
           WHEN lower(s.name) LIKE lower($1 || '%') THEN 1
           WHEN lower(s.name) LIKE lower('%' || $1 || '%') THEN 2
           ELSE 3
         END AS match_rank
       FROM symptoms s
       LEFT JOIN symptom_aliases sa ON sa.symptom_id = s.id
         AND (sa.language = $2 OR sa.language = 'en')
       WHERE
         s.name ILIKE '%' || $1 || '%'
         OR sa.alias ILIKE '%' || $1 || '%'
       ORDER BY s.id, match_rank ASC
       LIMIT $3`,
      [q, lang, limit]
    );

    const data = result.rows.map(r => ({ id: r.id, name: r.name }));
    await cacheSet(cacheKey, data, 120); // 2 min cache — fast invalidation for new symptoms
    res.json({ data });
  } catch (error) {
    console.error("symptomAutocomplete error:", error.message);
    res.status(500).json({ error: "Failed to search symptoms" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PRESCRIPTION SUGGESTION ENGINE
// POST /api/suggest/prescription
// Body: { symptom_ids: [1, 5, 12, ...] }
//
// SCORING ALGORITHM:
//
//   Disease score = (match_ratio × 0.7) + (capped_matched_weight × 0.3)
//     match_ratio        = sum(matched symptom weights) / sum(ALL symptom weights for disease)
//     capped_match_weight = LEAST(matched_weight, 1.0)
//
//   Medicine score = Σ over top-5 diseases of:
//     disease_score × (1.5 if first_line else 1.0) × (1 + log(1 + frequency)) / rank
//
//   Test score     = same formula using disease_tests columns
//
// Returns: top 5 diseases, top 10 medicines, top 10 tests — all in one DB round-trip.
// ─────────────────────────────────────────────────────────────────────────────
export const getPrescriptionSuggestions = async (req, res) => {
  try {
    const { symptom_ids } = req.body;

    if (!Array.isArray(symptom_ids) || symptom_ids.length === 0) {
      return res.status(400).json({ error: "symptom_ids must be a non-empty array of integers" });
    }

    const ids = symptom_ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      return res.status(400).json({ error: "No valid symptom IDs provided" });
    }

    // Cache key based on sorted symptom IDs (order-independent)
    const sortedIds = [...ids].sort((a, b) => a - b);
    const cacheKey = `suggest:prescription:${sortedIds.join(",")}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // ── Core CTE query — single round-trip ──────────────────────────────────
    const result = await pool.query(
      `
      WITH
      -- Step 1: Score every disease by how well its symptom profile matches input
      disease_scores AS (
        SELECT
          ds.disease_id,
          SUM(ds.weight)::float                            AS matched_weight,
          COUNT(*)::int                                    AS matched_count,
          SUM(ds.weight)::float / NULLIF(
            (SELECT SUM(ds2.weight)
               FROM disease_symptoms ds2
              WHERE ds2.disease_id = ds.disease_id), 0
          )                                                AS match_ratio
        FROM disease_symptoms ds
        WHERE ds.symptom_id = ANY($1::int[])
        GROUP BY ds.disease_id
      ),

      -- Step 2: Compute composite relevance and keep top 5
      ranked_diseases AS (
        SELECT
          sc.disease_id,
          d.name          AS disease_name,
          d.icd10_code,
          d.category,
          sc.matched_count,
          ROUND(sc.match_ratio::numeric, 3)               AS match_ratio,
          ROUND(
            (COALESCE(sc.match_ratio, 0) * 0.7
             + LEAST(sc.matched_weight, 1.0)  * 0.3)::numeric, 4
          )                                               AS relevance_score
        FROM disease_scores sc
        JOIN diseases d ON d.id = sc.disease_id
        ORDER BY relevance_score DESC
        LIMIT 5
      ),

      -- Step 3: Aggregate medicine scores across all ranked diseases
      medicine_agg AS (
        SELECT
          dm.medicine_id,
          m.brand_name,
          m.generic_name,
          m.form,
          m.strength,
          m.urdu_name,
          m.urdu_form,
          m.urdu_strength,
          ROUND(SUM(
            rd.relevance_score
            * CASE WHEN dm.is_first_line THEN 1.5 ELSE 1.0 END
            * (1.0 + LN(1.0 + dm.frequency))
            / GREATEST(dm.rank, 1)
          )::numeric, 4)                                  AS score,
          ARRAY_AGG(DISTINCT rd.disease_name)             AS suggested_for,
          BOOL_OR(dm.is_first_line)                       AS is_first_line
        FROM ranked_diseases rd
        JOIN disease_medicines dm ON dm.disease_id = rd.disease_id
        JOIN medicines m ON m.id = dm.medicine_id
        GROUP BY
          dm.medicine_id, m.brand_name, m.generic_name,
          m.form, m.strength, m.urdu_name, m.urdu_form, m.urdu_strength
        ORDER BY score DESC
        LIMIT 10
      ),

      -- Step 4: Aggregate test scores across all ranked diseases
      test_agg AS (
        SELECT
          dt.test_id,
          t.test_name,
          t.test_notes,
          ROUND(SUM(
            rd.relevance_score
            * CASE WHEN dt.is_essential THEN 1.5 ELSE 1.0 END
            * (1.0 + LN(1.0 + dt.frequency))
            / GREATEST(dt.rank, 1)
          )::numeric, 4)                                  AS score,
          ARRAY_AGG(DISTINCT rd.disease_name)             AS suggested_for,
          BOOL_OR(dt.is_essential)                        AS is_essential
        FROM ranked_diseases rd
        JOIN disease_tests dt ON dt.disease_id = rd.disease_id
        JOIN tests t ON t.id = dt.test_id
        GROUP BY dt.test_id, t.test_name, t.test_notes
        ORDER BY score DESC
        LIMIT 10
      )

      -- Final SELECT: pack everything into a single JSON response
      SELECT
        (SELECT COALESCE(JSON_AGG(rd ORDER BY rd.relevance_score DESC), '[]')
           FROM ranked_diseases rd)    AS diseases,
        (SELECT COALESCE(JSON_AGG(ma ORDER BY ma.score DESC), '[]')
           FROM medicine_agg ma)       AS medicines,
        (SELECT COALESCE(JSON_AGG(ta ORDER BY ta.score DESC), '[]')
           FROM test_agg ta)           AS tests
      `,
      [ids]
    );

    const row = result.rows[0];
    let diseases  = row.diseases  || [];
    let medicines = row.medicines || [];
    let tests     = row.tests     || [];

    // ── Fallback: disease graph is empty → use historical prescription data ──
    // This happens when the disease_symptoms/disease_medicines tables have no
    // seed data yet. History-based fallback queries real past prescriptions.
    if (medicines.length === 0 && diseases.length === 0) {
      try {
        const histResult = await pool.query(
          `
          WITH matching_consultations AS (
            SELECT
              cs.consultation_id,
              COUNT(DISTINCT cs.symptom_id)::float / $2  AS symptom_overlap_ratio
            FROM consultation_symptoms cs
            WHERE cs.symptom_id = ANY($1::int[])
            GROUP BY cs.consultation_id
            HAVING COUNT(DISTINCT cs.symptom_id) >= GREATEST(1, FLOOR($2 * 0.6))
            ORDER BY symptom_overlap_ratio DESC
            LIMIT 100
          ),
          top_medicines AS (
            SELECT
              p.medicine_id,
              m.brand_name,
              m.generic_name,
              m.form,
              m.strength,
              m.urdu_name,
              m.urdu_form,
              m.urdu_strength,
              COUNT(*) AS times_prescribed,
              ROUND(AVG(mc.symptom_overlap_ratio)::numeric, 3) AS score
            FROM matching_consultations mc
            JOIN prescriptions p ON p.consultation_id = mc.consultation_id
            JOIN medicines m ON m.id = p.medicine_id
            GROUP BY p.medicine_id, m.brand_name, m.generic_name, m.form, m.strength, m.urdu_name, m.urdu_form, m.urdu_strength
            ORDER BY times_prescribed DESC, score DESC
            LIMIT 10
          ),
          top_tests AS (
            SELECT
              ct.test_id,
              t.test_name,
              t.test_notes,
              COUNT(*) AS times_ordered,
              ROUND(AVG(mc.symptom_overlap_ratio)::numeric, 3) AS score
            FROM matching_consultations mc
            JOIN consultation_tests ct ON ct.consultation_id = mc.consultation_id
            JOIN tests t ON t.id = ct.test_id
            GROUP BY ct.test_id, t.test_name, t.test_notes
            ORDER BY times_ordered DESC, score DESC
            LIMIT 10
          )
          SELECT
            (SELECT COALESCE(JSON_AGG(tm ORDER BY tm.times_prescribed DESC), '[]') FROM top_medicines tm) AS medicines,
            (SELECT COALESCE(JSON_AGG(tt ORDER BY tt.times_ordered DESC), '[]') FROM top_tests tt) AS tests
          `,
          [ids, ids.length]
        );
        const hist = histResult.rows[0];
        medicines = hist.medicines || [];
        tests     = hist.tests     || [];
      } catch (histErr) {
        console.error("History fallback failed:", histErr.message);
        // non-fatal — return empty arrays
      }
    }

    const response = {
      symptom_ids: ids,
      source: (diseases.length > 0 || medicines.length > 0) ? "ai" : "historical",
      diseases,
      medicines,
      tests,
    };

    // Cache for 5 minutes — same symptoms = same suggestions
    await cacheSet(cacheKey, response, 300);
    res.json(response);
  } catch (error) {
    console.error("getPrescriptionSuggestions error:", error.message);
    res.status(500).json({ error: "Failed to generate prescription suggestions" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK RECORDER
// POST /api/suggest/feedback
// Body:
//   {
//     consultation_id:       123,
//     symptom_ids:           [1, 5, 12],
//     suggested_disease_ids: [3, 7],
//     accepted_medicine_ids:  [4, 9],
//     dismissed_medicine_ids: [2],
//     accepted_test_ids:      [6],
//     dismissed_test_ids:     []
//   }
//
// Just inserts the record. The frequency update happens asynchronously via
// process_suggestion_feedback() called by the cron endpoint below.
// ─────────────────────────────────────────────────────────────────────────────
export const recordFeedback = async (req, res) => {
  try {
    const {
      consultation_id,
      symptom_ids           = [],
      suggested_disease_ids = [],
      accepted_medicine_ids  = [],
      dismissed_medicine_ids = [],
      accepted_test_ids      = [],
      dismissed_test_ids     = [],
    } = req.body;

    if (!Array.isArray(symptom_ids) || symptom_ids.length === 0) {
      return res.status(400).json({ error: "symptom_ids is required" });
    }

    await pool.query(
      `INSERT INTO suggestion_feedback
         (consultation_id, symptom_ids, suggested_disease_ids,
          accepted_medicine_ids, dismissed_medicine_ids,
          accepted_test_ids, dismissed_test_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        consultation_id || null,
        symptom_ids,
        suggested_disease_ids,
        accepted_medicine_ids,
        dismissed_medicine_ids,
        accepted_test_ids,
        dismissed_test_ids,
      ]
    );

    res.status(201).json({ ok: true, message: "Feedback recorded" });
  } catch (error) {
    console.error("recordFeedback error:", error.message);
    res.status(500).json({ error: "Failed to record feedback" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK PROCESSOR  (admin / cron endpoint)
// POST /api/suggest/process-feedback
// Header: x-cron-secret: <CRON_SECRET>
//
// Calls the PostgreSQL process_suggestion_feedback() function that reads all
// unprocessed feedback rows and increments disease_medicines.frequency and
// disease_tests.frequency accordingly.
// ─────────────────────────────────────────────────────────────────────────────
export const processFeedback = async (req, res) => {
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await pool.query("SELECT process_suggestion_feedback() AS processed_count");
    const count = result.rows[0].processed_count;
    res.json({ ok: true, processed: count, message: `${count} feedback records processed` });
  } catch (error) {
    console.error("processFeedback error:", error.message);
    res.status(500).json({ error: "Failed to process feedback" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY-BASED SUGGESTIONS  (no disease graph needed)
// GET /api/suggest/history?symptom_ids=1,5,12
//
// Looks directly at past prescriptions for patients with the same symptoms.
// Useful as a fallback when the disease graph has sparse data.
// Returns the top medicines and tests prescribed historically for these symptoms.
// ─────────────────────────────────────────────────────────────────────────────
export const getHistorySuggestions = async (req, res) => {
  try {
    const rawIds = (req.query.symptom_ids || "")
      .split(",")
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0);

    if (rawIds.length === 0) {
      return res.status(400).json({ error: "symptom_ids query param required (comma-separated IDs)" });
    }

    const cacheKey = `suggest:history:${[...rawIds].sort((a,b)=>a-b).join(",")}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const result = await pool.query(
      `
      -- Find consultations that contained ALL (or most) of the given symptoms
      WITH matching_consultations AS (
        SELECT
          cs.consultation_id,
          COUNT(DISTINCT cs.symptom_id)::float / $2  AS symptom_overlap_ratio
        FROM consultation_symptoms cs
        WHERE cs.symptom_id = ANY($1::int[])
        GROUP BY cs.consultation_id
        HAVING COUNT(DISTINCT cs.symptom_id) >= GREATEST(1, FLOOR($2 * 0.6))
        ORDER BY symptom_overlap_ratio DESC
        LIMIT 100
      ),

      -- Top medicines from those consultations, ranked by prescription frequency
      top_medicines AS (
        SELECT
          p.medicine_id,
          m.brand_name,
          m.generic_name,
          m.form,
          m.strength,
          m.urdu_name,
          COUNT(*) AS times_prescribed,
          ROUND(AVG(mc.symptom_overlap_ratio)::numeric, 3) AS avg_symptom_match
        FROM matching_consultations mc
        JOIN prescriptions p ON p.consultation_id = mc.consultation_id
        JOIN medicines m ON m.id = p.medicine_id
        GROUP BY p.medicine_id, m.brand_name, m.generic_name, m.form, m.strength, m.urdu_name
        ORDER BY times_prescribed DESC, avg_symptom_match DESC
        LIMIT 10
      ),

      -- Top tests from those consultations
      top_tests AS (
        SELECT
          ct.test_id,
          t.test_name,
          t.test_notes,
          COUNT(*) AS times_ordered,
          ROUND(AVG(mc.symptom_overlap_ratio)::numeric, 3) AS avg_symptom_match
        FROM matching_consultations mc
        JOIN consultation_tests ct ON ct.consultation_id = mc.consultation_id
        JOIN tests t ON t.id = ct.test_id
        GROUP BY ct.test_id, t.test_name, t.test_notes
        ORDER BY times_ordered DESC, avg_symptom_match DESC
        LIMIT 10
      )

      SELECT
        (SELECT COALESCE(JSON_AGG(tm ORDER BY tm.times_prescribed DESC), '[]') FROM top_medicines tm) AS medicines,
        (SELECT COALESCE(JSON_AGG(tt ORDER BY tt.times_ordered DESC), '[]') FROM top_tests tt) AS tests
      `,
      [rawIds, rawIds.length]
    );

    const row = result.rows[0];
    const response = {
      source: "historical",
      symptom_ids: rawIds,
      medicines: row.medicines || [],
      tests:     row.tests     || [],
    };

    await cacheSet(cacheKey, response, 300);
    res.json(response);
  } catch (error) {
    console.error("getHistorySuggestions error:", error.message);
    res.status(500).json({ error: "Failed to fetch history suggestions" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SIMILAR CASES ENGINE
// GET /api/suggest/similar-cases?symptom_ids=1,5,12&limit=5
//
// Finds past consultations that share the most symptoms with the current input.
// Uses Jaccard similarity:  score = |A ∩ B| / |A ∪ B|
// Returns top N cases with: diagnosis text, all symptoms, full prescription data.
// This is the "learn from past data" engine — no external AI required.
// ─────────────────────────────────────────────────────────────────────────────
export const getSimilarCases = async (req, res) => {
  try {
    const raw   = (req.query.symptom_ids || "").split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit || "5", 10)));

    if (raw.length === 0) {
      return res.status(400).json({ success: false, message: "symptom_ids is required" });
    }

    const sortedIds  = [...new Set(raw)].sort((a, b) => a - b);
    const cacheKey   = `suggest:similar:${sortedIds.join("-")}:${limit}`;
    const cached     = await cacheGet(cacheKey);
    if (cached) return res.json({ success: true, cached: true, data: cached });

    // ── Core similarity query ────────────────────────────────────────────
    // Step 1: overlap — consultations sharing ≥1 input symptom
    // Step 2: consult_size — total symptoms per candidate consultation
    // Step 3: scored — Jaccard score, top N
    // Step 4: enrich each result with diagnosis + symptoms + prescriptions
    // All via correlated subqueries (efficient: only runs for top-N rows)
    const { rows } = await pool.query(
      `WITH
         overlap AS (
           SELECT cs.consultation_id,
                  COUNT(*)::float AS matched
           FROM   consultation_symptoms cs
           WHERE  cs.symptom_id = ANY($1::int[])
           GROUP  BY cs.consultation_id
         ),
         consult_size AS (
           SELECT consultation_id,
                  COUNT(*)::float AS total
           FROM   consultation_symptoms
           WHERE  consultation_id IN (SELECT consultation_id FROM overlap)
           GROUP  BY consultation_id
         ),
         scored AS (
           SELECT o.consultation_id,
                  o.matched::int                                           AS matched,
                  cs.total::int                                           AS consult_total,
                  $2::int                                                 AS input_total,
                  ROUND(
                    (o.matched / (($2)::float + cs.total - o.matched))::numeric, 3
                  )                                                       AS score
           FROM   overlap o
           JOIN   consult_size cs ON cs.consultation_id = o.consultation_id
           ORDER  BY score DESC, matched DESC
           LIMIT  $3
         )
       SELECT
         sc.consultation_id,
         sc.score,
         sc.matched,
         sc.consult_total,
         sc.input_total,
         c.visit_date,
         ne.diagnosis,
         /* All symptoms of this consultation */
         (SELECT COALESCE(
            JSON_AGG(JSON_BUILD_OBJECT('id', s.id, 'name', s.name) ORDER BY s.name),
            '[]'::json
          )
          FROM   consultation_symptoms cs2
          JOIN   symptoms s ON s.id = cs2.symptom_id
          WHERE  cs2.consultation_id = sc.consultation_id
         ) AS symptoms,
         /* Full prescription rows — maps directly to selectedMedicines state */
         (SELECT COALESCE(
            JSON_AGG(JSON_BUILD_OBJECT(
              'medicine_id',       p.medicine_id,
              'name',              COALESCE(m.brand_name, m.generic_name, 'Unknown'),
              'generic_name',      COALESCE(m.generic_name, ''),
              'form',              COALESCE(m.form, 'Tablet'),
              'strength',          COALESCE(m.strength, ''),
              'dosage_en',         COALESCE(p.dosage_en,        '1'),
              'dosage_urdu',       COALESCE(p.dosage_urdu,      'ایک گولی'),
              'frequency_en',      COALESCE(p.frequency_en,     'morning'),
              'frequency_urdu',    COALESCE(p.frequency_urdu,   'صبح'),
              'duration_en',       COALESCE(p.duration_en,      '7_days'),
              'duration_urdu',     COALESCE(p.duration_urdu,    '1 ہفتہ (7 دن)'),
              'instructions_en',   COALESCE(p.instructions_en,  'after_meal'),
              'instructions_urdu', COALESCE(p.instructions_urdu,'کھانے کے بعد')
            )),
            '[]'::json
          )
          FROM   prescriptions p
          JOIN   medicines m ON m.id = p.medicine_id
          WHERE  p.consultation_id = sc.consultation_id
         ) AS medicines
       FROM   scored sc
       JOIN   consultations c ON c.id = sc.consultation_id
       LEFT   JOIN neurological_exams ne ON ne.consultation_id = sc.consultation_id
       ORDER  BY sc.score DESC`,
      [sortedIds, sortedIds.length, limit]
    );

    const data = rows.map((r) => ({
      consultation_id: r.consultation_id,
      score:           parseFloat(r.score),
      matched:         r.matched,
      consult_total:   r.consult_total,
      input_total:     r.input_total,
      visit_date:      r.visit_date,
      diagnosis:       r.diagnosis || "",
      symptoms:        r.symptoms  || [],
      medicines:       r.medicines || [],
    }));

    await cacheSet(cacheKey, data, 300); // 5-min cache
    res.json({ success: true, cached: false, data });
  } catch (error) {
    console.error("getSimilarCases error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch similar cases" });
  }
};
