import { useState } from "react";
import SearchPatient from "../components/SearchPatient";
import PatientHistory from "../components/paitientHistory";


export default function PatientPage() {
    const [selectedPatient, setSelectedPatient] = useState(null);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Patient Management</h1>
            
            <SearchPatient onSelectPatient={setSelectedPatient} />
            
            {selectedPatient && <PatientHistory patient={selectedPatient} />}
        </div>
    );
}
