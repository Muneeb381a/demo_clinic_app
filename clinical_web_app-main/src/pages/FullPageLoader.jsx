import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const loadingMessages = [
  "Preparing consultation...",
  "Analyzing requirements...",
  "Optimizing experience...",
  "Finalizing setup...",
  "Almost ready..."
];

const FullPageLoader = ({ isLoading }) => {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(loadingMessages[0]);
  const [activeDots, setActiveDots] = useState(0);

  useEffect(() => {
    if (!isLoading) return;

    setProgress(0);
    
    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Slow down as we approach 100%
        const remaining = 100 - prev;
        const increment = remaining > 10 ? 2 + Math.random() * 3 : 0.5 + Math.random();
        return prev + increment;
      });
    }, 80);

    // Loading message rotation
    const messageInterval = setInterval(() => {
      setCurrentMessage(prev => {
        const nextMessages = loadingMessages.filter(msg => msg !== prev);
        return nextMessages[Math.floor(Math.random() * nextMessages.length)];
      });
    }, 2200);

    // Animated dots effect
    const dotsInterval = setInterval(() => {
      setActiveDots(prev => (prev + 1) % 4);
    }, 400);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
      clearInterval(dotsInterval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
      {/* Your custom loader at the top */}
      <div className="relative mb-8">
        <div className="loader w-16 h-16"></div>
        <motion.div 
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="w-5 h-5 rounded-full bg-[#1cda97]"></div>
        </motion.div>
      </div>

      {/* Percentage display */}
      <motion.div 
        className="text-4xl font-bold mb-6 text-[#554236]"
        key={progress}
        initial={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        {Math.min(Math.floor(progress), 100)}%
      </motion.div>

      {/* Progress bar */}
      <div className="relative h-2 w-64 rounded-full bg-gray-200 overflow-hidden mb-6">
        <motion.div 
          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-[#F77825] to-[#60B99A]"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', damping: 25, stiffness: 100 }}
        />
      </div>

      {/* Loading message with animated dots */}
      <div className="text-[#554236] text-lg font-medium">
        <motion.span
          key={currentMessage}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {currentMessage}
        </motion.span>
        <span className="inline-block w-8 text-left">
          {'.'.repeat(activeDots)}
        </span>
      </div>

      {/* CSS for your loader */}
      <style jsx>{`
        .loader {
          width: 60px;
          aspect-ratio: 1;
          display: flex;
          --c1: linear-gradient(#2694d4 0 0);
          --c2: linear-gradient(#0716b8 0 0);
          --s: calc(100%/3) calc(100%/3);
          background:
            var(--c1) 0   0 ,var(--c2) 50% 0   ,var(--c1) 100% 0,
            var(--c2) 0  50%,                   var(--c2) 100% 50%,
            var(--c1) 0 100%,var(--c2) 50% 100%,var(--c1) 100% 100%;
          background-repeat: no-repeat;
          animation: l8-0 1.5s infinite alternate;
        }
        @keyframes l8-0 {
            0%,12.49%   {background-size: var(--s),0 0     ,0 0     ,0 0     ,0 0     ,0 0     ,0 0     ,0 0     }
            12.5%,24.9% {background-size: var(--s),var(--s),0 0     ,0 0     ,0 0     ,0 0     ,0 0     ,0 0     }
            25%,37.4%   {background-size: var(--s),var(--s),var(--s),0 0     ,0 0     ,0 0     ,0 0     ,0 0     }
            37.5%,49.9% {background-size: var(--s),var(--s),var(--s),0 0     ,var(--s),0 0     ,0 0     ,0 0     }
            50%,61.4%   {background-size: var(--s),var(--s),var(--s),0 0     ,var(--s),0 0     ,0 0     ,var(--s)}
            62.5%,74.9% {background-size: var(--s),var(--s),var(--s),0 0     ,var(--s),0 0     ,var(--s),var(--s)}
            75%,86.4%   {background-size: var(--s),var(--s),var(--s),0 0     ,var(--s),var(--s),var(--s),var(--s)}
            87.5%,100%  {background-size: var(--s),var(--s),var(--s),var(--s),var(--s),var(--s),var(--s),var(--s)}
        }
        @keyframes l8-1 {
          0%,
          5%    {transform: translate(0   ,0   )}
          12.5% {transform: translate(100%,0   )}
          25%   {transform: translate(200%,0   )}
          37.5% {transform: translate(200%,100%)}
          50%   {transform: translate(200%,200%)}
          62.5% {transform: translate(100%,200%)}
          75%   {transform: translate(0   ,200%)}
          87.5% {transform: translate(0   ,100%)}
          95%,
          100%  {transform: translate(100%,100%)}
        }
      `}</style>
    </div>
  );
};

export default FullPageLoader;