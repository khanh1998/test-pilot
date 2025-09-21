/**
 * Centralized template functions for Test-Pilot
 * These are utility functions available in template expressions
 */

import type { TemplateContext } from './types';

/**
 * Default template functions available in all contexts
 */
export const defaultTemplateFunctions: Record<string, (...args: unknown[]) => unknown> = {
  /**
   * Extract value from JSON using JSONPath-like syntax
   */
  jsonPath: (data: unknown, path: unknown): unknown => {
    try {
      return extractJsonPath(data, String(path));
    } catch (error) {
      console.warn(`JSONPath extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  },

  /**
   * Generate a UUID v4
   */
  uuid: (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * Get current timestamp in milliseconds
   */
  timestamp: (): number => {
    return Date.now();
  },

  /**
   * Get current date in ISO format
   */
  isoDate: (): string => {
    return new Date().toISOString();
  },

  /**
   * Format date with optional day offset and custom format
   * @param dayOffset Optional number of days to add/subtract (default: 0)
   * @param format Format string (default: 'YYYY-MM-DD')
   */
  dateFormat: (...args: unknown[]): string => {
    const dayOffset = args.length > 0 && typeof args[0] === 'number' ? args[0] : 0;
    const format = args.length > 1 && typeof args[1] === 'string' ? args[1] : 'YYYY-MM-DD';
    
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    
    return formatDate(date, format);
  },

  /**
   * Get date in ISO format with optional day offset
   * @param dayOffset Optional number of days to add/subtract (default: 0)
   */
  dateISO: (...args: unknown[]): string => {
    const dayOffset = args.length > 0 && typeof args[0] === 'number' ? args[0] : 0;
    
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    
    return date.toISOString().split('T')[0]; // Return only the date part (YYYY-MM-DD)
  },

  /**
   * Get date in RFC3339 format with optional day offset
   * @param dayOffset Optional number of days to add/subtract (default: 0)
   */
  dateRFC3339: (...args: unknown[]): string => {
    const dayOffset = args.length > 0 && typeof args[0] === 'number' ? args[0] : 0;
    
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    
    return date.toISOString(); // ISO string is RFC3339 compliant
  },

  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt: (...args: unknown[]): number => {
    const min = args.length > 0 && typeof args[0] === 'number' ? args[0] : 0;
    const max = args.length > 1 && typeof args[1] === 'number' ? args[1] : 100;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate random string of specified length
   */
  randomString: (...args: unknown[]): string => {
    const length = args.length > 0 && typeof args[0] === 'number' ? args[0] : 10;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Base64 encode a string
   */
  base64Encode: (...args: unknown[]): string => {
    const input = args.length > 0 ? String(args[0]) : '';
    try {
      return btoa(input);
    } catch (error) {
      console.error('Base64 encoding failed:', error);
      return '';
    }
  },

  /**
   * Base64 decode a string
   */
  base64Decode: (...args: unknown[]): string => {
    const input = args.length > 0 ? String(args[0]) : '';
    try {
      return atob(input);
    } catch (error) {
      console.error('Base64 decoding failed:', error);
      return '';
    }
  },

  /**
   * URL encode a string
   */
  urlEncode: (...args: unknown[]): string => {
    const input = args.length > 0 ? String(args[0]) : '';
    return encodeURIComponent(input);
  },

  /**
   * URL decode a string
   */
  urlDecode: (...args: unknown[]): string => {
    const input = args.length > 0 ? String(args[0]) : '';
    try {
      return decodeURIComponent(input);
    } catch (error) {
      console.error('URL decoding failed:', error);
      return '';
    }
  }
};

/**
 * Simplified JSONPath implementation
 * Supports basic property access and array indexing
 */
function extractJsonPath(data: unknown, path: string): unknown {
  if (!path || path === '$') {
    return data;
  }

  // Remove leading $ if present
  const cleanPath = path.startsWith('$.') ? path.substring(2) : path.startsWith('$') ? path.substring(1) : path;
  
  if (!cleanPath) {
    return data;
  }

  try {
    // Split by dots, handling array indices
    const parts = cleanPath.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array index access like [0] or array[0]
      const arrayMatch = part.match(/^(.*)?\[(\d+)\]$/);
      if (arrayMatch) {
        const [, propertyName, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);

        // If there's a property name before the bracket, access it first
        if (propertyName) {
          if (typeof current === 'object' && current !== null) {
            current = (current as Record<string, unknown>)[propertyName];
          } else {
            return undefined;
          }
        }

        // Access array index
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        // Regular property access
        if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
    }

    return current;
  } catch (error) {
    console.warn(`JSONPath evaluation failed for path "${path}":`, error);
    return undefined;
  }
}

/**
 * Format date according to specified format string
 * Supports basic format tokens: YYYY, MM, DD, HH, mm, ss
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Create template functions with additional context-specific functions
 */
export function createTemplateFunctions(
  context: TemplateContext
): Record<string, (...args: unknown[]) => unknown> {
  return {
    ...defaultTemplateFunctions,
    ...(context.functions || {})
  };
}
