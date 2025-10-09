// ============================================================================
// CASE CONVERSION UTILITIES
// ============================================================================
// Utilities for converting between snake_case (database) and camelCase (frontend)
// This eliminates duplication across the codebase where we manually map
// database fields to frontend format and vice versa
// ============================================================================

/**
 * Converts a snake_case string to camelCase
 *
 * @param str - The snake_case string to convert
 * @returns The camelCase version of the string
 *
 * @example
 * snakeToCamelString('profile_picture_url') // returns 'profilePictureUrl'
 * snakeToCamelString('created_at') // returns 'createdAt'
 */
function snakeToCamelString(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts a camelCase string to snake_case
 *
 * @param str - The camelCase string to convert
 * @returns The snake_case version of the string
 *
 * @example
 * camelToSnakeString('profilePictureUrl') // returns 'profile_picture_url'
 * camelToSnakeString('createdAt') // returns 'created_at'
 */
function camelToSnakeString(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts object keys from snake_case to camelCase recursively
 * Handles nested objects and arrays
 *
 * @param obj - The object with snake_case keys
 * @returns A new object with camelCase keys
 *
 * @example
 * snakeToCamel({ profile_picture_url: 'url', created_at: '2024-01-01' })
 * // returns { profilePictureUrl: 'url', createdAt: '2024-01-01' }
 *
 * @example
 * snakeToCamel({ user_data: { first_name: 'John' } })
 * // returns { userData: { firstName: 'John' } }
 */
export function snakeToCamel<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays recursively
  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item)) as T;
  }

  // Handle Date objects (pass through)
  if (obj instanceof Date) {
    return obj as T;
  }

  // Handle plain objects
  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = snakeToCamelString(key);
        converted[camelKey] = snakeToCamel(obj[key]);
      }
    }

    return converted as T;
  }

  // Return primitive values as-is
  return obj;
}

/**
 * Converts object keys from camelCase to snake_case recursively
 * Handles nested objects and arrays
 *
 * @param obj - The object with camelCase keys
 * @returns A new object with snake_case keys
 *
 * @example
 * camelToSnake({ profilePictureUrl: 'url', createdAt: '2024-01-01' })
 * // returns { profile_picture_url: 'url', created_at: '2024-01-01' }
 *
 * @example
 * camelToSnake({ userData: { firstName: 'John' } })
 * // returns { user_data: { first_name: 'John' } }
 */
export function camelToSnake<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays recursively
  if (Array.isArray(obj)) {
    return obj.map(item => camelToSnake(item)) as T;
  }

  // Handle Date objects (pass through)
  if (obj instanceof Date) {
    return obj as T;
  }

  // Handle plain objects
  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = camelToSnakeString(key);
        converted[snakeKey] = camelToSnake(obj[key]);
      }
    }

    return converted as T;
  }

  // Return primitive values as-is
  return obj;
}

/**
 * Type-safe wrapper for converting database rows to frontend format
 * Useful for converting query results from snake_case to camelCase
 *
 * @param rows - Array of database rows with snake_case keys
 * @returns Array of objects with camelCase keys
 *
 * @example
 * const dbRows = [{ user_id: 1, profile_picture_url: 'url' }]
 * const frontendData = convertDbRows(dbRows)
 * // returns [{ userId: 1, profilePictureUrl: 'url' }]
 */
export function convertDbRows<T = any>(rows: any[]): T[] {
  return snakeToCamel<T[]>(rows);
}

/**
 * Converts a single database row to frontend format
 *
 * @param row - Single database row with snake_case keys
 * @returns Object with camelCase keys
 *
 * @example
 * const dbRow = { user_id: 1, profile_picture_url: 'url' }
 * const frontendData = convertDbRow(dbRow)
 * // returns { userId: 1, profilePictureUrl: 'url' }
 */
export function convertDbRow<T = any>(row: any): T {
  return snakeToCamel<T>(row);
}
