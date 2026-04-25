import { useState } from "react";
import { searchPatientByMobile } from "../api/api";

export default function SearchPatient({ onSelectPatient }) {
    const [mobile, setMobile] = useState("");
    const [patient, setPatient] = useState(null);
    const [notFound, setNotFound] = useState(false);

    const searchPatient = async () => {
        try {
            const res = await searchPatientByMobile(mobile);
            if (res.data.exists) {
                setPatient(res.data.data);
                setNotFound(false);
                onSelectPatient(res.data.data);  // Pass patient data to parent
            } else {
                setPatient(null);
                setNotFound(true);
            }
        } catch (error) {
        }
    };

    return (
        <div className="p-4 border-b">
            <h2 className="text-lg font-bold">Search Patient</h2>
            <input 
                type="text" 
                className="border p-2 m-2"
                placeholder="Enter mobile number" 
                value={mobile} 
                onChange={(e) => setMobile(e.target.value)}
            />
            <button onClick={searchPatient} className="bg-blue-500 text-white p-2 cursor-pointer">Search</button>

            {notFound && <p>Patient not found. Please create a new record.</p>}
            {patient && (
                <div className="mt-4">
                    <h3 className="text-lg">Patient: {patient.name}</h3>
                    <p>Age: {patient.age}</p>
                    <p>Gender: {patient.gender}</p>
                </div>
            )}
        </div>
    );
}
