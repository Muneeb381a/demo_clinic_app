import React from 'react';

const FollowUpSection = ({
  selectedDuration,
  followUpDate,
  followUpNotes,
  onDurationChange,
  onDateChange,
  onNotesChange,
}) => {
  const handleDurationChange = (e) => {
    const days = parseInt(e.target.value);
    const date = new Date();
    if (days > 0) {
      date.setDate(date.getDate() + days);
    } else {
      date.setDate(null); // Reset date if "No follow-up" is selected
    }
    onDurationChange(days);
    onDateChange(days > 0 ? date : null); // Set null for "No follow-up"
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl text-xl">📅</div>
        <div>
          <h3 className="text-lg font-bold text-white">Follow Up Appointment</h3>
          <p className="text-purple-100 text-sm">Schedule the patient's next visit</p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Duration selector */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
              <span className="text-purple-500">⏱</span> Next Appointment
            </label>
            <select
              value={selectedDuration || ""}
              onChange={handleDurationChange}
              className="w-full rounded-xl border-2 border-purple-200 bg-purple-50 p-3 urdu-font text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all hover:border-purple-300 cursor-pointer"
            >
              <option value="">مدت منتخب کریں</option>
              <option value="7">ایک ہفتہ بعد</option>
              <option value="10">10 دن بعد</option>
              <option value="15">15 دن بعد</option>
              <option value="21">3 ہفتے بعد</option>
              <option value="30">ایک مہینہ بعد</option>
              <option value="45">ڈیڑھ مہینہ بعد</option>
              <option value="60">دو مہینے بعد</option>
              <option value="90">تین مہینے بعد</option>
              <option value="120">چار مہینے بعد</option>
              <option value="180">چھ مہینے بعد</option>
              <option value="365">ایک سال بعد</option>
              <option value="0">فالو اپ نہیں</option>
            </select>

            {/* Calculated date preview */}
            {selectedDuration && selectedDuration > 0 && followUpDate && (
              <div className="mt-2 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                <span className="text-purple-500 text-lg">📌</span>
                <div>
                  <p className="text-xs text-purple-500 font-medium uppercase tracking-wide">Appointment Date</p>
                  <p className="text-sm font-bold text-purple-800 urdu-font text-right">
                    {new Date(followUpDate).toLocaleDateString("ur-PK", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(followUpDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
              <span className="text-indigo-500">📝</span> Additional Instructions
              <span className="text-xs font-normal text-gray-400">(Optional)</span>
            </label>
            <textarea
              value={followUpNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3 h-32 urdu-font text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all resize-none"
              placeholder="ہدایات یہاں لکھیں..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowUpSection;