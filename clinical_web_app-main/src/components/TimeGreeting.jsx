import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSun, FiMoon } from 'react-icons/fi';

const TimeGreeting = ({ locale = 'en-PK', timeZone = 'Asia/Karachi' }) => {
  const [showComponent, setShowComponent] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [time, setTime] = useState(new Date());
  const hours = time.getHours();
  const isDay = hours >= 6 && hours < 18;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down
        setShowComponent(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setShowComponent(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Enhanced star configurations
  const stars = Array.from({ length: 25 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 2,
    opacity: Math.random() * 0.5 + 0.2,
    duration: Math.random() * 2 + 1,
  }));

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: showComponent ? 1 : 0,
        y: showComponent ? 0 : -20
       }}
       transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`p-4 rounded-2xl relative overflow-hidden ${
        isDay 
          ? 'bg-gradient-to-br from-blue-50 to-purple-50'
          : 'bg-gradient-to-br from-indigo-900 to-slate-900'
      }`}
    >
      {/* Night Sky Elements */}
      {!isDay && (
        <div className="absolute inset-0">
          {/* Shooting Stars */}
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={`shooting-${i}`}
              className="absolute w-16 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                rotate: -45
              }}
              animate={{
                x: ['-100%', '200%'],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: Math.random() * 10 + 5
              }}
            />
          ))}

          {/* Enhanced Stars */}
          {stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute rounded-full"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                background: `rgba(255,255,255,${star.opacity})`
              }}
              animate={{
                opacity: [star.opacity * 0.5, star.opacity, star.opacity * 0.5],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: star.delay
              }}
            />
          ))}

          {/* Moon Glow */}
          <motion.div
            className="absolute w-32 h-32 rounded-full bg-indigo-900/20 blur-3xl"
            style={{
              left: '10%',
              top: '15%'
            }}
            animate={{
              opacity: [0.3, 0.5, 0.3],
              scale: [0.9, 1.1, 0.9]
            }}
            transition={{
              duration: 8,
              repeat: Infinity
            }}
          />
        </div>
      )}

      {/* Rest of the component remains similar but with night mode adjustments */}
      <div className="flex items-center gap-4 relative z-10">
        {/* Progress Ring - Night Mode Adjustment */}
        <motion.div 
          className="relative"
          whileHover={{ scale: 1.05 }}
        >
          <svg className="w-14 h-14 transform -rotate-90">
            <circle
              cx="27"
              cy="27"
              r="24"
              fill="none"
              stroke={isDay ? "#f3f4f6" : "rgba(255,255,255,0.1)"}
              strokeWidth="4"
            />
            <motion.circle
              cx="27"
              cy="27"
              r="24"
              fill="none"
              stroke={isDay ? "#38bdf8" : "#818cf8"}
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ strokeDasharray: '0 158' }}
              animate={{ 
                strokeDasharray: `${((hours * 60 + time.getMinutes()) / 1440) * 158} 158`,
                transition: { duration: 0.5 } 
              }}
            />
          </svg>

          {/* Time Icon - Enhanced Moon Animation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                rotate: isDay ? [0, 15, -15, 0] : [0, 5, -5, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: isDay ? 8 : 12,
                ease: "easeInOut"
              }}
              className={`p-2 rounded-full ${
                isDay 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-indigo-100/20 text-indigo-200 backdrop-blur-sm'
              }`}
            >
              {isDay ? (
                <FiSun className="w-6 h-6" />
              ) : (
                <motion.div
                  animate={{ 
                    rotate: [0, 5],
                    opacity: [0.9, 1]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    repeatType: 'mirror'
                  }}
                >
                  <FiMoon className="w-6 h-6" />
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Time Display - Night Mode Text Colors */}
        <motion.div 
          className="flex flex-col"
          initial={{ x: -10 }}
          animate={{ x: 0 }}
        >
          <div className="flex items-baseline gap-2">
            <motion.span 
              className={`text-2xl font-semibold ${
                isDay ? 'text-gray-800' : 'text-indigo-100'
              }`}
              animate={{ 
                textShadow: isDay 
                  ? ["0 0 0 rgba(0,0,0,0)", "0 0 10px rgba(99,102,241,0.3)", "0 0 0 rgba(0,0,0,0)"] 
                  : ["0 0 0 rgba(255,255,255,0)", "0 0 10px rgba(255,255,255,0.3)", "0 0 0 rgba(255,255,255,0)"]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {time.toLocaleTimeString(locale, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }).split(' ')[0]}
            </motion.span>
            <span className={`text-sm font-medium ${
              isDay ? 'text-gray-500' : 'text-indigo-300'
            }`}>
              {time.toLocaleTimeString(locale, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }).split(' ')[1]} PKT
            </span>
          </div>
          <div className={`flex items-center gap-2 text-sm ${
            isDay ? 'text-gray-500' : 'text-indigo-300'
          }`}>
            <motion.span
              animate={{ opacity: [0.8, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {time.toLocaleDateString(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
            </motion.span>
            <span>•</span>
            <motion.span
              animate={{ x: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              {hours < 12 ? 'Morning' : hours < 18 ? 'Afternoon' : 'Evening'}
            </motion.span>
          </div>
        </motion.div>
      </div>

      {/* Floating particles - Night Mode Adjustment */}
      {isDay && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-200 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5]
              }}
              transition={{
                duration: Math.random() * 4 + 4,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default TimeGreeting;