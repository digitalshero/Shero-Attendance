export const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m`;
};

/**
 * Formats a Date object or ISO timestamp string to 12-hour AM/PM format (e.g., "09:15 AM", "04:30 PM")
 */
export const formatTime = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '--';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Formats a "HH:mm" 24-hour string (e.g. "14:30", "09:00") into 12-hour AM/PM format (e.g. "02:30 PM", "09:00 AM")
 */
export const formatTime12 = (timeStr: string | undefined | null): string => {
  if (!timeStr) return '--';
  if (timeStr.includes('T') || (timeStr.includes('-') && timeStr.includes(':'))) {
    return formatTime(timeStr);
  }
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1].slice(0, 2).padStart(2, '0');
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
};

