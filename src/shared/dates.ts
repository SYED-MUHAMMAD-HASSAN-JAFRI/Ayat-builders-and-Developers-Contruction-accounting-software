/**
 * Timezone-safe date utilities for AYAT Builders & Developers.
 * Underlying DB & <input type="date"> values remain YYYY-MM-DD.
 * User-facing display format is consistently DD-MM-YYYY.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Returns local calendar date as YYYY-MM-DD without UTC midnight shift.
 */
export function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * Returns local yesterday calendar date as YYYY-MM-DD.
 */
export function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Adds `days` to a YYYY-MM-DD string using local calendar arithmetic (no UTC shift).
 */
export function addDaysISO(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '');
  if (!match) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Formats YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, or ISO string as DD-MM-YYYY
 * without timezone conversion shifting the calendar day.
 */
export function formatDateDDMMYYYY(value?: string | null): string {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  // Match YYYY-MM-DD prefix directly to prevent UTC midnight day shifts
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(str);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }

  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return str;
  return `${pad2(parsed.getDate())}-${pad2(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}

/**
 * Formats a timestamp string (e.g. SQLite `YYYY-MM-DD HH:MM:SS`) as `DD-MM-YYYY HH:MM` (or `DD-MM-YYYY` if no time part).
 */
export function formatDateTimeDDMMYYYY(value?: string | null): string {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(str);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]} ${match[4]}:${match[5]}`;
  }

  return formatDateDDMMYYYY(str);
}
