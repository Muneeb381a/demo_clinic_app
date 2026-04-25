import { pool } from '../models/db.js';

// Get all doctors
export const getDoctors = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM doctors ORDER BY id DESC');
        const formattedDoctors = result.rows.map(doctor => ({
            id: doctor.id,
            name: doctor.name,
            specialization: doctor.specialization,
            contact: doctor.contact,
            email: doctor.email,
            address: doctor.address
        }));

        return res.status(200).json({
            success: true,
            message: "Doctors retrieved successfully",
            data: formattedDoctors
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get a single doctor by ID
export const getDoctorById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM doctors WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const doctor = result.rows[0];
        return res.status(200).json({
            success: true,
            message: "Doctor retrieved successfully",
            data: doctor
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Add new doctor
export const addDoctor = async (req, res) => {
    const { name, specialization, contact, email, address } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO doctors (name, specialization, contact, email, address) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, specialization, contact, email, address]
        );

        const doctor = result.rows[0];
        return res.status(201).json({
            success: true,
            message: "Doctor added successfully",
            data: doctor
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Update doctor
export const updateDoctor = async (req, res) => {
    const { id } = req.params;
    const { name, specialization, contact, email, address } = req.body;
    try {
        const result = await pool.query(
            `UPDATE doctors SET name=$1, specialization=$2, contact=$3, email=$4, address=$5 
             WHERE id=$6 RETURNING *`,
            [name, specialization, contact, email, address, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const doctor = result.rows[0];
        return res.status(200).json({
            success: true,
            message: "Doctor updated successfully",
            data: doctor
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Delete doctor
export const deleteDoctor = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM doctors WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Doctor deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
