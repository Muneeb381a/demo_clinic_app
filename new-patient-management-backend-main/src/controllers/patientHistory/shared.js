// src/controllers/patientHistory/shared.js
// Helpers shared by the patient-history print / PDF handlers.

/** Format a date as an Urdu (ur-PK, Asia/Karachi) "day month year" string. */
export const urduDate = (date) => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "تاریخ نامعلوم";

    const options = {
      timeZone: "Asia/Karachi",
      day: "numeric",
      month: "long",
      year: "numeric",
    };

    const formatter = new Intl.DateTimeFormat("ur-PK", options);
    const parts = formatter.formatToParts(d);

    // Properly extract date components by type
    const day = parts.find((p) => p.type === "day")?.value || "؟";
    const month = parts.find((p) => p.type === "month")?.value || "؟";
    const year = parts.find((p) => p.type === "year")?.value || "؟";

    return `${day} ${month} ${year}`;
  } catch (error) {
    console.error("Date conversion error:", error);
    return "تاریخ نامعلوم";
  }
};
