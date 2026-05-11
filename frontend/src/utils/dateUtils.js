/**
 * Israel timezone utilities - Asia/Jerusalem
 * Handles both winter (UTC+2) and summer (UTC+3) time automatically.
 * The browser's Intl API handles DST transitions for Israel correctly.
 */

const IL_TIMEZONE = 'Asia/Jerusalem';
const IL_LOCALE = 'he-IL';

/**
 * Format a date/string as a full datetime in Israel time
 * e.g. "26/03/2026, 14:35"
 */
export function formatDateTimeIL(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleString(IL_LOCALE, {
      timeZone: IL_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch { return String(date); }
}

/**
 * Format a date/string as date only in Israel time
 * e.g. "26/03/2026"
 */
export function formatDateIL(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString(IL_LOCALE, {
      timeZone: IL_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch { return String(date); }
}

/**
 * Format a date/string as time only in Israel time
 * e.g. "14:35"
 */
export function formatTimeIL(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleTimeString(IL_LOCALE, {
      timeZone: IL_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch { return String(date); }
}

/**
 * Get current Israel time as ISO string (for storing "now" in DB)
 * Storage is always UTC (ISO), but this gives you the correct "now"
 */
export function nowISOString() {
  return new Date().toISOString();
}

/**
 * Get current Israel date as YYYY-MM-DD string
 */
export function todayIL() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat(IL_LOCALE, {
    timeZone: IL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Check if a date is in the past relative to Israel time
 */
export function isPastIL(date) {
  if (!date) return false;
  return new Date(date) < new Date();
}

/**
 * Format relative time in Hebrew (e.g. "לפני 3 שעות")
 */
export function formatRelativeIL(date) {
  if (!date) return '';
  try {
    const rtf = new Intl.RelativeTimeFormat(IL_LOCALE, { numeric: 'auto' });
    const diff = new Date(date) - new Date();
    const absDiff = Math.abs(diff);
    if (absDiff < 60000) return rtf.format(Math.round(diff / 1000), 'second');
    if (absDiff < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
    if (absDiff < 86400000) return rtf.format(Math.round(diff / 3600000), 'hour');
    return rtf.format(Math.round(diff / 86400000), 'day');
  } catch { return formatDateTimeIL(date); }
}