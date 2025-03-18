/**
 * Utility for handling game timers
 */

/**
 * Create a countdown timer
 * @param {number} seconds - Total seconds for the countdown
 * @param {function} onTick - Callback function called every second with remaining time
 * @param {function} onComplete - Callback function called when timer completes
 * @returns {Object} Timer control object with start, pause, resume, and stop methods
 */
const createCountdown = (seconds, onTick, onComplete) => {
  let remainingTime = seconds;
  let intervalId = null;
  let isPaused = false;
  
  // Start the timer
  const start = () => {
    if (intervalId) {
      return; // Timer already running
    }
    
    isPaused = false;
    
    // Call onTick immediately with initial time
    if (onTick && typeof onTick === 'function') {
      onTick(remainingTime);
    }
    
    intervalId = setInterval(() => {
      if (!isPaused) {
        remainingTime -= 1;
        
        // Call onTick with updated time
        if (onTick && typeof onTick === 'function') {
          onTick(remainingTime);
        }
        
        // Check if timer is complete
        if (remainingTime <= 0) {
          stop();
          if (onComplete && typeof onComplete === 'function') {
            onComplete();
          }
        }
      }
    }, 1000);
  };
  
  // Pause the timer
  const pause = () => {
    isPaused = true;
  };
  
  // Resume the timer
  const resume = () => {
    isPaused = false;
  };
  
  // Stop the timer
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  
  // Add extra time to the timer
  const addTime = (extraSeconds) => {
    remainingTime += extraSeconds;
    if (onTick && typeof onTick === 'function') {
      onTick(remainingTime);
    }
  };
  
  // Get remaining time
  const getTimeRemaining = () => {
    return remainingTime;
  };
  
  return {
    start,
    pause,
    resume,
    stop,
    addTime,
    getTimeRemaining
  };
};

/**
 * Calculate time elapsed between two dates in seconds
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time (defaults to current time if not provided)
 * @returns {number} Time elapsed in seconds
 */
const calculateTimeElapsed = (startTime, endTime = new Date()) => {
  return Math.floor((endTime - startTime) / 1000);
};

module.exports = {
  createCountdown,
  calculateTimeElapsed
}; 