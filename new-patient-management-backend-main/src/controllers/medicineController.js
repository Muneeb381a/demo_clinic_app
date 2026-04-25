import { pool } from '../models/db.js';
import { cacheGetSWR, cacheDel } from '../utils/cache.js';

const MEDICINE_LIST_KEY = "medicines:all";
const MEDICINE_HARD_TTL = 86400;  // keep stale data up to 24 hours
const MEDICINE_SOFT_TTL = 3600;   // refresh in background every 1 hour

// Fetch all medicines from DB (used by SWR fetchFn)
const fetchAllMedicines = async () => {
  const result = await pool.query(`SELECT * FROM medicines ORDER BY brand_name ASC`);
  return result.rows.map(med => ({
    ...med,
    urdu_name: med.urdu_name || 'نام دستیاب نہیں',
  }));
};

// Function to parse medicine string
const parseMedicineString = (medicineString) => {
  medicineString = medicineString.trim().replace(/\s+/g, " ");
  const regex = /^(?:(\w+)\s+)?([^(]+?)(?:\s*\(([^)]+)\))?$/;
  const match = medicineString.match(regex);
  if (match) {
    return {
      form: match[1] ? match[1].trim() : "Tablet",
      brand_name: match[2].trim(),
      strength: match[3] ? match[3].trim() : "",
    };
  }
  return null;
};

// Get all medicines — SWR: always instant from cache, refreshes in background every hour
export const getAllMedicines = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    const medicines = await cacheGetSWR(
      MEDICINE_LIST_KEY,
      fetchAllMedicines,
      MEDICINE_HARD_TTL,
      MEDICINE_SOFT_TTL
    );
    res.status(200).json(medicines);
  } catch (error) {
    console.error("Medicine Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch medicines" });
  }
};

// Create a new medicine — invalidates the list cache
export const createMedicine = async (req, res) => {
  try {
    const { medicine_name, generic_name, urdu_name, urdu_form, urdu_strength } = req.body;
    const parsedData = parseMedicineString(medicine_name);
    if (!parsedData) {
      return res.status(400).json({ error: "Invalid medicine format. Use 'Form Name (Strength)'" });
    }
    const { form, brand_name, strength } = parsedData;
    const result = await pool.query(
      `INSERT INTO medicines (brand_name, generic_name, form, strength, urdu_name, urdu_form, urdu_strength)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [brand_name, generic_name, form, strength, urdu_name, urdu_form, urdu_strength]
    );
    // Delete both the data key and the :fresh marker so SWR treats next read as a miss
    await cacheDel(MEDICINE_LIST_KEY, `${MEDICINE_LIST_KEY}:fresh`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create Medicine Error:", error);
    res.status(500).json({ error: "Failed to create medicine" });
  }
};

// Get a medicine by ID
export const getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT * FROM medicines WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Get Medicine by ID Error:", error);
    res.status(500).json({ error: "Failed to fetch medicine details" });
  }
};

// Update a medicine — invalidates the list cache
export const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const { brand_name, generic_name, form, strength, urdu_name, urdu_form, urdu_strength } = req.body;
    const result = await pool.query(
      `UPDATE medicines SET brand_name=$1, generic_name=$2, form=$3, strength=$4,
       urdu_name=$5, urdu_form=$6, urdu_strength=$7 WHERE id=$8 RETURNING *`,
      [brand_name, generic_name, form, strength, urdu_name, urdu_form, urdu_strength, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    await cacheDel(MEDICINE_LIST_KEY, `${MEDICINE_LIST_KEY}:fresh`);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Update Medicine Error:", error);
    res.status(500).json({ error: "Failed to update medicine" });
  }
};

// Delete a medicine — invalidates the list cache
export const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM medicines WHERE id=$1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    await cacheDel(MEDICINE_LIST_KEY, `${MEDICINE_LIST_KEY}:fresh`);
    res.status(200).json({ message: "Medicine deleted successfully" });
  } catch (error) {
    console.error("Delete Medicine Error:", error);
    res.status(500).json({ error: "Failed to delete medicine" });
  }
};

// Search medicines by name
export const searchMedicines = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }
    const result = await pool.query(
      `SELECT * FROM medicines WHERE brand_name ILIKE $1 OR generic_name ILIKE $1`,
      [`%${query}%`]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Search Medicines Error:", error);
    res.status(500).json({ error: "Failed to search medicines" });
  }
};
