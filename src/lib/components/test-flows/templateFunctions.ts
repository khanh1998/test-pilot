/**
 * Utility functions for template resolution in Test Flow
 * These functions can be called from templates using the func: prefix
 */

/**
 * Generate a random integer between min and max (inclusive)
 * @param min Minimum value
 * @param max Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get current timestamp in milliseconds
 * @returns Current timestamp
 */
export function timestamp(): number {
  return Date.now();
}

/**
 * Format a date using the Intl.DateTimeFormat API
 * @param date Date to format (defaults to now)
 * @param locale Locale to use (defaults to en-US)
 * @param options Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | number | null | undefined = new Date(),
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
): string {
  // If date is null or undefined, use current date
  const dateObj = date == null ? new Date() : typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Format a date using a pattern string (e.g., "yyyy-MM-dd HH:mm:ss")
 * Supports the following patterns:
 * - yyyy: Full year (e.g., 2025)
 * - yy: Short year (e.g., 25)
 * - MM: Month number with leading zero (01-12)
 * - M: Month number without leading zero (1-12)
 * - dd: Day of month with leading zero (01-31)
 * - d: Day of month without leading zero (1-31)
 * - HH: Hours in 24h format with leading zero (00-23)
 * - H: Hours in 24h format without leading zero (0-23)
 * - hh: Hours in 12h format with leading zero (01-12)
 * - h: Hours in 12h format without leading zero (1-12)
 * - mm: Minutes with leading zero (00-59)
 * - m: Minutes without leading zero (0-59)
 * - ss: Seconds with leading zero (00-59)
 * - s: Seconds without leading zero (0-59)
 * - SSS: Milliseconds (000-999)
 * - a: AM/PM marker
 *
 * @param pattern Format pattern like "yyyy-MM-dd HH:mm:ss"
 * @param date Date to format (defaults to now)
 * @returns Formatted date string
 */
export function formatDatePattern(
  pattern: string,
  date: Date | number | null | undefined = new Date()
): string {
  // If date is null or undefined, use current date
  const dateObj = date == null ? new Date() : typeof date === 'number' ? new Date(date) : date;

  const tokens: Record<string, () => string> = {
    yyyy: () => dateObj.getFullYear().toString(),
    yy: () => dateObj.getFullYear().toString().slice(2),
    MM: () => (dateObj.getMonth() + 1).toString().padStart(2, '0'),
    M: () => (dateObj.getMonth() + 1).toString(),
    dd: () => dateObj.getDate().toString().padStart(2, '0'),
    d: () => dateObj.getDate().toString(),
    HH: () => dateObj.getHours().toString().padStart(2, '0'),
    H: () => dateObj.getHours().toString(),
    hh: () => (dateObj.getHours() % 12 || 12).toString().padStart(2, '0'),
    h: () => (dateObj.getHours() % 12 || 12).toString(),
    mm: () => dateObj.getMinutes().toString().padStart(2, '0'),
    m: () => dateObj.getMinutes().toString(),
    ss: () => dateObj.getSeconds().toString().padStart(2, '0'),
    s: () => dateObj.getSeconds().toString(),
    SSS: () => dateObj.getMilliseconds().toString().padStart(3, '0'),
    a: () => (dateObj.getHours() < 12 ? 'AM' : 'PM')
  };

  // Sort tokens by length (longest first) to avoid partial matches
  // e.g., 'MM' should be replaced before 'M'
  const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);

  // Replace each token with its value
  let result = pattern;
  for (const token of sortedTokens) {
    result = result.replace(new RegExp(token, 'g'), tokens[token]());
  }

  return result;
}

/**
 * Generate a random UUID
 * @returns UUID string
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Generate a random string of specified length
 * @param length Length of the string (default 10)
 * @param charset Characters to use (default alphanumeric)
 * @returns Random string
 */
export function randomString(
  length: number = 10,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  let result = '';
  const charsetLength = charset.length;
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charsetLength));
  }
  return result;
}

/**
 * Get the current date in ISO format
 * @returns ISO date string
 */
export function isoDate(): string {
  return new Date().toISOString();
}

/**
 * Calculate a date relative to a base date (or now)
 * @param amount Amount to add or subtract
 * @param unit Unit (days, hours, minutes, seconds)
 * @param baseDate Base date to calculate from (defaults to now)
 * @returns ISO date string
 */
export function relativeDate(
  amount: number,
  unit: 'days' | 'hours' | 'minutes' | 'seconds',
  baseDate: Date | number | null | undefined = new Date()
): string {
  // If baseDate is null or undefined, use current date
  const date =
    baseDate == null ? new Date() : typeof baseDate === 'number' ? new Date(baseDate) : baseDate;

  switch (unit) {
    case 'days':
      date.setDate(date.getDate() + amount);
      break;
    case 'hours':
      date.setHours(date.getHours() + amount);
      break;
    case 'minutes':
      date.setMinutes(date.getMinutes() + amount);
      break;
    case 'seconds':
      date.setSeconds(date.getSeconds() + amount);
      break;
  }

  return date.toISOString();
}

/**
 * Evaluate a JSONPath expression on an object
 * Simple implementation for basic use cases
 * @param obj Object to query
 * @param path JSONPath expression
 * @returns Result of the JSONPath expression
 */
export function jsonPath(obj: any, path: string): any {
  // Handle empty or root path
  if (!path || path === '$') {
    return obj;
  }

  // Basic handling for $.prop.subprop notation
  if (path.startsWith('$.')) {
    const segments = path.substring(2).split('.');
    let result = obj;

    for (const segment of segments) {
      // Handle array indices in the form [0]
      if (segment.match(/^\[\d+\]$/)) {
        const index = parseInt(segment.substring(1, segment.length - 1));
        if (Array.isArray(result)) {
          result = result[index];
        } else {
          return undefined;
        }
      } else {
        result = result?.[segment];
      }

      if (result === undefined) {
        return undefined;
      }
    }

    return result;
  }

  // Simplified handling for direct property access
  return obj?.[path];
}
