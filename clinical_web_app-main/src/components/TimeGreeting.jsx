import React, { useState, useEffect } from "react";
import { FiSun, FiMoon } from "react-icons/fi";

// A compact, single-line clock for the topbar — icon + greeting + time, sized
// to sit inline with the nav buttons beside it.
const TimeGreeting = ({ locale = "en-PK", timeZone = "Asia/Karachi" }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // The greeting/icon follow the *browser's* local hour (a receptionist
  // travelling wouldn't want "Good Evening" at their own 2pm); only the
  // displayed clock face is pinned to the clinic's timeZone.
  const hours = time.getHours();
  const isDay = hours >= 6 && hours < 18;
  const greeting = hours < 12 ? "Morning" : hours < 18 ? "Afternoon" : "Evening";
  const formattedTime = time.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });

  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 text-xs font-medium">
      {isDay ? (
        <FiSun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      ) : (
        <FiMoon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      )}
      <span>Good</span> <span>{greeting}</span>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <span className="tabular-nums">{formattedTime}</span>
    </div>
  );
};

export default TimeGreeting;
