import { differenceInSeconds, startOfDay, endOfDay } from 'date-fns';

export const calculateDurationSeconds = (start: Date, end: Date): number => {
  return differenceInSeconds(end, start);
};

export const getTodayRange = (date: Date = new Date()) => {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  };
};

// Returns the minutes of the day (0..1439) in Indian Standard Time (Asia/Kolkata)
export const getISTMinutes = (date: Date): number => {
  try {
    const istString = date.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const [h, m] = istString.split(':').map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  } catch (e) {
    return date.getHours() * 60 + date.getMinutes();
  }
};

// Returns current today date string in YYYY-MM-DD format in Asia/Kolkata
export const getISTTodayString = (date: Date = new Date()): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return parts; // e.g. "2026-09-17"
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
};

// Combines a date string (YYYY-MM-DD) and time string (HH:mm) into a JavaScript Date object in Asia/Kolkata
export const combineDateAndTimeToISTDate = (dateStr: string, timeStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  // IST is UTC+5:30 -> offset -330 minutes from UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, (hour || 0) - 5, (minute || 0) - 30));
  return utcDate;
};
