import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface SelfHostConfig {
  host: string;
  port: number;
  dataDir: string;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
  imageCacheMaxEntries: number;
  imageCacheTtlSeconds: number;
  trustProxy: boolean;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SelfHostConfig {
  return {
    host: env.HOST || "0.0.0.0",
    port: positiveInteger(env.PORT, 3000),
    dataDir: env.DATA_DIR || "/data",
    rateLimitMax: positiveInteger(env.RATE_LIMIT_MAX, 30),
    rateLimitWindowSeconds: positiveInteger(env.RATE_LIMIT_WINDOW_SECONDS, 60),
    imageCacheMaxEntries: positiveInteger(env.IMAGE_CACHE_MAX_ENTRIES, 10_000),
    imageCacheTtlSeconds: positiveInteger(env.IMAGE_CACHE_TTL_SECONDS, 86_400),
    trustProxy: env.TRUST_PROXY?.toLowerCase() === "true",
  };
}

export class CounterStore {
  private readonly database: DatabaseSync;
  private readonly incrementStatement;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.database = new DatabaseSync(join(dataDir, "kauntah.db"));
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS counters (
        owner TEXT PRIMARY KEY,
        count INTEGER NOT NULL
      );
    `);
    this.incrementStatement = this.database.prepare(`
      INSERT INTO counters (owner, count) VALUES (?, 1)
      ON CONFLICT(owner) DO UPDATE SET count = count + 1
      RETURNING count
    `);
  }

  increment(owner: string): number {
    const row = this.incrementStatement.get(owner) as { count: number } | undefined;
    if (!row) throw new Error("Counter increment did not return a value");
    return row.count;
  }

  close(): void {
    this.database.close();
  }
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMilliseconds: number;

  constructor(maxRequests: number, windowMilliseconds: number) {
    this.maxRequests = maxRequests;
    this.windowMilliseconds = windowMilliseconds;
  }

  consume(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMilliseconds });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class SvgCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMilliseconds: number;

  constructor(maxEntries: number, ttlMilliseconds: number) {
    this.maxEntries = maxEntries;
    this.ttlMilliseconds = ttlMilliseconds;
  }

  get(key: string, now = Date.now()): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string, now = Date.now()): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(key, { value, expiresAt: now + this.ttlMilliseconds });
  }
}

export function forwardedClientIp(
  xForwardedFor: string | undefined,
  xRealIp: string | undefined,
): string | undefined {
  return xForwardedFor?.split(",")[0]?.trim() || xRealIp?.trim() || undefined;
}
