import { format, isValid, addDays } from "date-fns";

/**
 * Parse a date string in various formats.
 * Handles: YYYY-MM-DD (ISO), MM/DD/YY, MM/DD/YYYY
 */
export function parseDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "") {
    return undefined;
  }

  const trimmed = dateStr.trim();

  // ISO format: YYYY-MM-DD (primary storage format)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isValid(date) ? date : undefined;
  }

  // Legacy: MM/DD/YYYY format
  const longMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (longMatch) {
    const [, month, day, year] = longMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isValid(date) ? date : undefined;
  }

  // Legacy: MM/DD/YY format
  const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortMatch) {
    const [, month, day, year] = shortMatch;
    const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year);
    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    return isValid(date) ? date : undefined;
  }

  return undefined;
}

/**
 * Format a Date object to ISO string (YYYY-MM-DD) for database storage.
 */
export function formatDateForDB(date: Date | null | undefined): string {
  if (!date || !isValid(date)) {
    return "";
  }
  return format(date, "yyyy-MM-dd");
}

/**
 * Format a Date object for display (MM/DD/YY).
 */
export function formatDateForDisplay(date: Date | null | undefined): string {
  if (!date || !isValid(date)) {
    return "";
  }
  return format(date, "MM/dd/yy");
}

// Aliases for backward compatibility during transition
export const parseMMDDYY = parseDate;
export const formatMMDDYY = formatDateForDB;

/**
 * Check if a value is a valid Date object.
 */
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Delivery-week definition (org-wide):
 *   A week runs Tuesday 00:00:00.000 → the following Monday 23:59:59.999.
 *
 * Rationale: a load delivered on Monday belongs to the *previous* week
 * (the week that started the prior Tuesday). A load delivered Tuesday or
 * later starts a new week.
 *
 * getDay(): Sun=0, Mon=1, Tue=2, ..., Sat=6
 *   - If date is Monday (1): week start = date - 6 days (previous Tuesday)
 *   - Otherwise: week start = most recent Tuesday
 *       Sun(0): -5, Tue(2): 0, Wed(3): -1, Thu(4): -2, Fri(5): -3, Sat(6): -4
 */
export function getDeliveryWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const offset = dow === 1 ? -6 : dow === 0 ? -5 : 2 - dow; // days to add
  const start = addDays(d, offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getDeliveryWeekEnd(date: Date): Date {
  const start = getDeliveryWeekStart(date);
  const end = addDays(start, 6); // Tue + 6 = Mon
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Returns the delivery week (Tue→Mon) that contains `date`, optionally
 * shifted by `weekOffset` whole weeks (negative = past, positive = future).
 */
export function getDeliveryWeekRange(
  date: Date,
  weekOffset = 0
): { start: Date; end: Date } {
  const baseStart = getDeliveryWeekStart(date);
  const start = addDays(baseStart, weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
