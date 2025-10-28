// =====================================
// WINDOW STATUS INDICATOR COMPONENT
// Displays 24-hour messaging window status
// Critical for Meta Platform Policy compliance
// =====================================

import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface WindowStatusIndicatorProps {
  windowExpiresAt: string;
  withinWindow: boolean;
  lastUserMessageAt: string;
  className?: string;
}

export const WindowStatusIndicator: React.FC<WindowStatusIndicatorProps> = ({
  windowExpiresAt,
  withinWindow,
  lastUserMessageAt,
  className = ''
}) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0 });

  const calculateTimeRemaining = () => {
    const now = new Date().getTime();
    const expires = new Date(windowExpiresAt).getTime();
    const diff = expires - now;

    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0 };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds };
  };

  useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    return () => clearInterval(interval);
  }, [windowExpiresAt]);

  const isExpiringSoon = timeRemaining.hours < 2 && withinWindow;
  const isExpired = !withinWindow || (timeRemaining.hours === 0 && timeRemaining.minutes === 0);

  const lastMessageDate = new Date(lastUserMessageAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        glass-morphism-card p-4 rounded-xl border
        ${isExpired ? 'border-red-500/50 bg-red-500/5' : isExpiringSoon ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-green-500/50 bg-green-500/5'}
        ${className}
      `}
    >
      {/* Status Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isExpired ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-400" />
          )}
          <span className={`font-semibold ${isExpired ? 'text-red-300' : 'text-green-300'}`}>
            {isExpired ? 'Window Closed' : 'Window Open'}
          </span>
        </div>

        {!isExpired && (
          <div className="flex items-center space-x-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Expires in</span>
          </div>
        )}
      </div>

      {/* Time Remaining Display */}
      {!isExpired ? (
        <div className="mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              <div
                className={`
                  text-center py-2 px-3 rounded-lg
                  ${isExpiringSoon ? 'bg-yellow-500/20' : 'bg-green-500/20'}
                `}
              >
                <p
                  className={`
                    text-2xl font-bold font-mono
                    ${isExpiringSoon ? 'text-yellow-300' : 'text-green-300'}
                  `}
                >
                  {String(timeRemaining.hours).padStart(2, '0')}:
                  {String(timeRemaining.minutes).padStart(2, '0')}:
                  {String(timeRemaining.seconds).padStart(2, '0')}
                </p>
                <p className="text-xs text-gray-400 mt-1">Hours:Minutes:Seconds</p>
              </div>
            </div>
          </div>

          {isExpiringSoon && (
            <div className="mt-2 flex items-center space-x-2 text-yellow-400 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>Window expiring soon! Respond quickly.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3 text-center py-3">
          <p className="text-red-300 font-semibold mb-1">Cannot send messages</p>
          <p className="text-xs text-gray-400">The 24-hour window has expired</p>
        </div>
      )}

      {/* Last User Message Time */}
      <div className="pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-1">Last user message:</p>
        <p className="text-xs text-gray-300">{lastMessageDate}</p>
      </div>

      {/* Policy Info Tooltip */}
      <div className="mt-3 p-2 bg-blue-500/10 rounded border border-blue-500/30 flex items-start space-x-2">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          <strong>Meta Policy:</strong> Businesses can send messages within 24 hours of the user's
          last message. Outside this window, message templates are required.
        </p>
      </div>
    </motion.div>
  );
};

export default WindowStatusIndicator;
