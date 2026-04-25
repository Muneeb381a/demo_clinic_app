import React, { useState, useEffect } from "react";
import axios from "../utils/axiosClient";

const PrescriptionForm = ({ patientData }) => {
    const [medicines, setMedicines] = useState([]);
    const [dosages, setDosages] = useState([]);
    const [instructions, setInstructions] = useState([]);
    const [selectedMedicine, setSelectedMedicine] = useState("");
    const [selectedDosage, setSelectedDosage] = useState("");
    const [selectedInstruction, setSelectedInstruction] = useState("");
    const [duration, setDuration] = useState("");
    const [durationUrdu, setDurationUrdu] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            const medicineRes = await axios.get("/api/medicines");
            const dosageRes = await axios.get("/api/medicine-dosages");
            const instructionRes = await axios.get("/api/medicine_instructions");
            setMedicines(medicineRes.data.data);
            setDosages(dosageRes.data.data);
            setInstructions(instructionRes.data.data);
        };
        fetchData();
    }, []);

    const handleSubmit = async () => {
        const prescription = {
            patient_id: patientData.id,
            medicine_id: selectedMedicine,
            dosage_id: selectedDosage,
            instruction_id: selectedInstruction,
            duration,
            duration_urdu: durationUrdu,
        };
        try {
            await axios.post("/api/prescriptions", prescription);
            alert("Prescription added successfully!");
        } catch (error) {
        }
    };

    return (
        <div>
            <h3>Create Prescription for {patientData.name}</h3>
            <select onChange={(e) => setSelectedMedicine(e.target.value)}>
                <option value="">Select Medicine</option>
                {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                        {medicine.name}
                    </option>
                ))}
            </select>

            <select onChange={(e) => setSelectedDosage(e.target.value)}>
                <option value="">Select Dosage</option>
                {dosages.map((dosage) => (
                    <option key={dosage.id} value={dosage.id}>
                        {dosage.name}
                    </option>
                ))}
            </select>

            <select onChange={(e) => setSelectedInstruction(e.target.value)}>
                <option value="">Select Instruction</option>
                {instructions.map((instruction) => (
                    <option key={instruction.id} value={instruction.id}>
                        {instruction.instruction}
                    </option>
                ))}
            </select>

            <input
                type="text"
                placeholder="Duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
            />
            <input
                type="text"
                placeholder="Duration in Urdu"
                value={durationUrdu}
                onChange={(e) => setDurationUrdu(e.target.value)}
            />

            <button onClick={handleSubmit}>Submit Prescription</button>
        </div>
    );
};


export default PrescriptionForm;