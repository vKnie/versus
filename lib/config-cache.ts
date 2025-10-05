// ============================================================================
// CONFIGURATION FILE CACHE
// ============================================================================
// In-memory cache for game configuration files to avoid disk I/O
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';

interface CachedConfig {
  data: any;
  filePath: string;
  loadedAt: number;
  expiresAt: number;
}

class ConfigCache {
  private cache: Map<number, CachedConfig>;
  private readonly ttlMs: number;

  constructor(ttlMinutes = 30) {
    this.cache = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get cached configuration
   * Returns null if not found or expired
   */
  get(configId: number): any | null {
    const cached = this.cache.get(configId);

    if (!cached) {
      return null;
    }

    const now = Date.now();

    // Check if cache entry expired
    if (now > cached.expiresAt) {
      this.cache.delete(configId);
      return null;
    }

    return cached.data;
  }

  /**
   * Load configuration from file and cache it
   */
  async load(configId: number, filePath: string): Promise<any> {
    // Check cache first
    const cached = this.get(configId);
    if (cached) {
      return cached;
    }

    // Cache miss - load from disk
    const publicDir = path.join(process.cwd(), 'public');
    const normalizedPath = filePath.replace(/^\//, '');
    const configPath = path.join(publicDir, normalizedPath);

    // Security validation
    const resolvedPath = path.resolve(configPath);
    if (!resolvedPath.startsWith(publicDir)) {
      throw new Error('Invalid file path');
    }

    // Read and parse config file
    const configContent = await fs.readFile(configPath, 'utf-8');
    const configData = JSON.parse(configContent);

    // Store in cache
    const now = Date.now();
    this.cache.set(configId, {
      data: configData,
      filePath: normalizedPath,
      loadedAt: now,
      expiresAt: now + this.ttlMs
    });

    return configData;
  }

  /**
   * Invalidate a specific configuration
   */
  invalidate(configId: number): void {
    this.cache.delete(configId);
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
    for (const [id, config] of this.cache.entries()) {
      if (now > config.expiresAt) {
        this.cache.delete(id);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      ttlMs: this.ttlMs,
      entries: Array.from(this.cache.entries()).map(([id, config]) => ({
        id,
        filePath: config.filePath,
        loadedAt: new Date(config.loadedAt).toISOString(),
        expiresAt: new Date(config.expiresAt).toISOString()
      }))
    };
  }
}

// ✅ Singleton instance
export const configCache = new ConfigCache();
