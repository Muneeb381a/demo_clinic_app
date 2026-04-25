import { pool } from "../models/db.js";

// Get all medicine instructions
export const getMedicineInstructions = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                mi.id,
                mi.medicine_id,
                m.name AS medicine_name,
                mi.how_to_take,
                mi.how_to_take_urdu,
                mi.dosage_per_time,
                mi.dosage_per_time_urdu,
                mi.when_to_take,
                mi.when_to_take_urdu
            FROM medicine_instructions mi
            JOIN medicines m ON mi.medicine_id = m.id
        `);

        const instructions = result.rows.map(instruction => ({
            id: instruction.id,
            medicine_id: instruction.medicine_id,
            medicine_name: instruction.medicine_name,
            how_to_take: instruction.how_to_take,
            how_to_take_urdu: instruction.how_to_take_urdu,
            dosage_per_time: instruction.dosage_per_time,
            dosage_per_time_urdu: instruction.dosage_per_time_urdu,
            when_to_take: instruction.when_to_take,
            when_to_take_urdu: instruction.when_to_take_urdu
        }));

        return res.status(200).json({
            success: true,
            message: "Medicine instructions retrieved successfully",
            data: instructions
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get a single medicine instruction by ID
export const getMedicineInstructionById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                mi.id,
                mi.medicine_id,
                m.name AS medicine_name,
                mi.how_to_take,
                mi.how_to_take_urdu,
                mi.dosage_per_time,
                mi.dosage_per_time_urdu,
                mi.when_to_take,
                mi.when_to_take_urdu
            FROM medicine_instructions mi
            JOIN medicines m ON mi.medicine_id = m.id
            WHERE mi.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medicine instruction not found"
            });
        }

        const instruction = result.rows[0];
        return res.status(200).json({
            success: true,
            message: "Medicine instruction retrieved successfully",
            data: instruction
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Add a new medicine instruction
export const addMedicineInstruction = async (req, res) => {
    const { medicine_id, how_to_take, how_to_take_urdu, dosage_per_time, dosage_per_time_urdu, when_to_take, when_to_take_urdu } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO medicine_instructions (medicine_id, how_to_take, how_to_take_urdu, dosage_per_time, dosage_per_time_urdu, when_to_take, when_to_take_urdu)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [medicine_id, how_to_take, how_to_take_urdu, dosage_per_time, dosage_per_time_urdu, when_to_take, when_to_take_urdu]);

        const instruction = result.rows[0];
        return res.status(201).json({
            success: true,
            message: "Medicine instruction added successfully",
            data: instruction
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Update an existing medicine instruction by ID
export const updateMedicineInstruction = async (req, res) => {
    const { id } = req.params;
    const { medicine_id, how_to_take, how_to_take_urdu, dosage_per_time, dosage_per_time_urdu, when_to_take, when_to_take_urdu } = req.body;
    try {
        const result = await pool.query(`
            UPDATE medicine_instructions
            SET medicine_id=$1, how_to_take=$2, how_to_take_urdu=$3, dosage_per_time=$4, dosage_per_time_urdu=$5, when_to_take=$6, when_to_take_urdu=$7
            WHERE id=$8 RETURNING *
        `, [medicine_id, how_to_take, how_to_take_urdu, dosage_per_time, dosage_per_time_urdu, when_to_take, when_to_take_urdu, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medicine instruction not found"
            });
        }

        const instruction = result.rows[0];
        return res.status(200).json({
            success: true,
            message: "Medicine instruction updated successfully",
            data: instruction
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Delete a medicine instruction by ID
export const deleteMedicineInstruction = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM medicine_instructions WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medicine instruction not found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Medicine instruction deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
