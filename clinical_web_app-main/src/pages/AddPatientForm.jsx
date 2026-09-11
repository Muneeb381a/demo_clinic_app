import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchWithRetry } from "../utils/api";

const patientSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  age: z.coerce
    .number()
    .positive("Enter a valid age")
    .min(1, "Age must be at least 1")
    .max(120, "Age seems unrealistic"),
  gender: z.enum(["Male", "Female", "Others"]),
  mobile: z.string()
    .min(10, "Enter a valid mobile number")
    .max(15, "Mobile number is too long")
    .regex(/^[0-9]+$/, "Mobile number must contain only digits"),
});

const AddPatientForm = ({ searchedMobile, onSuccess }) => {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isDirty, isValid },
  } = useForm({
    resolver: zodResolver(patientSchema),
    mode: "onChange",
    defaultValues: {
      gender: "Male",
    },
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  useEffect(() => {
    if (searchedMobile) {
      setValue("mobile", searchedMobile, { shouldValidate: true });
    }
  }, [searchedMobile, setValue]);

  const addPatient = async (data) => {
    setLoading(true);
    setSuccess(false);
    
    try {
      const res = await fetchWithRetry(
        "post",
        "/api/patients",
        "add-patient",
        {
          name: data.name.trim(),
          age: Number(data.age),
          gender: data.gender,
          mobile: data.mobile,
        },
        (responseData) => {
          if (!responseData?.id && !responseData?._id) {
            throw new Error("Patient ID not found in response");
          }
          return responseData;
        }
      );

      const patientId = res.id || res._id;
      setSubmittedData(data);
      setSuccess(true);
      
      toast.success(
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-lg">✓</span>
          </div>
          <div>
            <p className="font-semibold text-green-800">Patient Registered!</p>
            <p className="text-green-700 text-sm">{data.name} has been added successfully.</p>
          </div>
        </div>,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        }
      );

      if (onSuccess) onSuccess(patientId);

      // Reset form after successful submission
      setTimeout(() => {
        reset({
          name: "",
          age: "",
          gender: "Male",
          mobile: searchedMobile || "",
        });
        setSuccess(false);
      }, 2000);

    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to register patient";
      
      toast.error(
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-red-600 text-lg">⚠️</span>
          </div>
          <div>
            <p className="font-semibold text-red-800">Registration Failed</p>
            <p className="text-red-700 text-sm">{errorMessage}</p>
          </div>
        </div>,
        {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        }
      );
      
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      name: "name",
      label: "Full Name",
      icon: "👤",
      placeholder: "Enter patient's full name",
      type: "text",
    },
    {
      name: "age",
      label: "Age",
      icon: "📅",
      placeholder: "Patient's age",
      type: "number",
      min: 1,
      max: 120,
    },
    {
      name: "mobile",
      label: "Mobile Number",
      icon: "📱",
      placeholder: "Mobile number",
      type: "tel",
      readOnly: !!searchedMobile,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <ToastContainer />

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-indigo-50 dark:from-gray-700/60 dark:to-gray-700/30 p-6 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-600 to-indigo-600 p-2 rounded-lg">
            <span className="text-white text-xl">👨‍⚕️</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">New Patient Registration</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Fill in the patient details below to create a new record
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && submittedData && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 mx-6 mt-6 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-full">
              <span className="text-emerald-600 dark:text-emerald-400 text-lg">✅</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-emerald-800 dark:text-emerald-300">Registration Successful!</h4>
              <p className="text-emerald-700 dark:text-emerald-400 text-sm mt-1">
                {submittedData.name} (Age: {submittedData.age}, {submittedData.gender}) has been registered successfully.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(addPatient)} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {fields.map((field) => {
            const hasError = errors[field.name];
            
            return (
              <div key={field.name} className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">{field.icon}</span>
                  {field.label}
                  {field.required && <span className="text-rose-500">*</span>}
                </label>

                <div className="relative">
                  <input
                    {...register(field.name)}
                    type={field.type}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    readOnly={field.readOnly}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
                      hasError
                        ? "border-rose-300 dark:border-rose-700 focus:border-rose-500 focus:ring-rose-100 dark:focus:ring-rose-900/40"
                        : field.readOnly
                        ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:border-gray-300 focus:ring-gray-100"
                        : "border-gray-200 dark:border-gray-600 focus:border-teal-500 focus:ring-teal-100 dark:focus:ring-teal-900/40"
                    }`}
                  />
                  <span className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-lg ${
                    hasError ? "text-rose-400" : "text-gray-400"
                  }`}>
                    {field.icon}
                  </span>

                  {hasError && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <span className="text-rose-500 text-lg">⚠️</span>
                    </div>
                  )}
                </div>

                {hasError && (
                  <p className="text-rose-600 dark:text-rose-400 text-sm flex items-center gap-1 mt-1">
                    <span className="text-rose-500">⚠️</span>
                    {errors[field.name].message}
                  </p>
                )}
              </div>
            );
          })}

          {/* Gender Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">⚤</span>
              Gender
              <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["Male", "Female", "Others"].map((gender) => {
                const isSelected = watch("gender") === gender;
                const genderIcon = gender === "Male" ? "👨" : gender === "Female" ? "👩" : "👤";

                return (
                  <label
                    key={gender}
                    className={`
                      relative flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
                      ${isSelected
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300"
                      }
                    `}
                  >
                    <input
                      type="radio"
                      value={gender}
                      {...register("gender")}
                      className="sr-only"
                    />
                    <span className="text-lg">{genderIcon}</span>
                    <span className="font-medium">{gender}</span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          <button
            type="submit"
            disabled={loading || !isValid || !isDirty}
            className={`
              w-full py-4 px-6 rounded-xl font-semibold text-white shadow-md
              transition-all duration-300 transform hover:-translate-y-0.5
              flex items-center justify-center gap-3
              ${loading || !isValid || !isDirty
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 hover:shadow-lg"
              }
            `}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Registering Patient...</span>
              </>
            ) : (
              <>
                <span className="text-lg">📝</span>
                <span>Register New Patient</span>
                <span className="text-lg">➕</span>
              </>
            )}
          </button>

          {(!isValid || !isDirty) && !loading && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-3">
              Fill in all required fields to enable registration
            </p>
          )}
        </div>

        {/* Form Summary */}
        {isDirty && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <span>📋</span> Registration Summary
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-600 dark:text-gray-400">Name:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{watch("name") || "Not provided"}</div>
              <div className="text-gray-600 dark:text-gray-400">Age:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{watch("age") || "Not provided"}</div>
              <div className="text-gray-600 dark:text-gray-400">Gender:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{watch("gender") || "Not provided"}</div>
              <div className="text-gray-600 dark:text-gray-400">Mobile:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{watch("mobile") || "Not provided"}</div>
            </div>
          </div>
        )}
      </form>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        input:read-only {
          cursor: not-allowed;
        }
        input:read-only:hover {
          border-color: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default AddPatientForm;