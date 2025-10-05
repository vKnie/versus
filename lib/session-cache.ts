// ============================================================================
// SESSION CACHE
// ============================================================================
// In-memory cache for session validation to reduce database load
// Uses LRU eviction with TTL expiration
// ============================================================================

interface CachedSession {
  userId: number;
  username: string;
  expiresAt: number; // Timestamp when cache entry expires
  sessionExpiresAt: number; // Timestamp when actual session expires
}

class SessionCache {
  private cache: Map<string, CachedSession>;
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 1000, ttlMinutes = 5) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get cached session data
   * Returns null if not found or expired
   */
  get(sessionToken: string): CachedSession | null {
    const cached = this.cache.get(sessionToken);

    if (!cached) {
      return null;
    }

    const now = Date.now();

    // Check if cache entry expired (TTL)
    if (now > cached.expiresAt) {
      this.cache.delete(sessionToken);
      return null;
    }

    // Check if actual session expired
    if (now > cached.sessionExpiresAt) {
      this.cache.delete(sessionToken);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(sessionToken);
    this.cache.set(sessionToken, cached);

    return cached;
  }

  /**
   * Store session in cache
   */
  set(sessionToken: string, userId: number, username: string, sessionExpires: Date): void {
    const now = Date.now();

    // Evict oldest entry if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(sessionToken, {
      userId,
      username,
      expiresAt: now + this.ttlMs,
      sessionExpiresAt: sessionExpires.getTime()
    });
  }

  /**
   * Invalidate a session (on logout, etc.)
   */
  invalidate(sessionToken: string): void {
    this.cache.delete(sessionToken);
  }

  /**
   * Invalidate all sessions for a user
   */
  invalidateUser(userId: number): void {
    for (const [token, session] of this.cache.entries()) {
      if (session.userId === userId) {
        this.cache.delete(token);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [token, session] of this.cache.entries()) {
      if (now > session.expiresAt || now > session.sessionExpiresAt) {
        this.cache.delete(token);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    };
  }
}

// ✅ Singleton instance
export const sessionCache = new SessionCache();

/**
 * Get user ID and username from session token
 * Uses cache to avoid database queries
 */
export async function getCachedSession(
  sessionToken: string,
  fetchFromDb: () => Promise<{ userId: number; username: string; expires: Date } | null>
): Promise<{ userId: number; username: string } | null> {
  // Check cache first
  const cached = sessionCache.get(sessionToken);
  if (cached) {
    return {
      userId: cached.userId,
      username: cached.username
    };
  }

  // Cache miss - fetch from database
  const dbSession = await fetchFromDb();
  if (!dbSession) {
    return null;
  }

  // Store in cache
  sessionCache.set(sessionToken, dbSession.userId, dbSession.username, dbSession.expires);

  return {
    userId: dbSession.userId,
    username: dbSession.username
  };
}
