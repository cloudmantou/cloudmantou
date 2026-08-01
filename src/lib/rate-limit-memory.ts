export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const MAX_ENTRIES = 10000;
const store = new Map<string, RateLimitEntry>();

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function evictOldestEntriesUntilBelowCapacity(): void {
  while (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (typeof oldestKey !== "string") return;
    store.delete(oldestKey);
  }
}

export function memoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    if (store.size >= MAX_ENTRIES) {
      cleanupExpired();
      evictOldestEntriesUntilBelowCapacity();
    }
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { success: false, limit, remaining: 0, resetAt: entry.resetAt };
  }

  const nextEntry = { ...entry, count: entry.count + 1 };
  store.set(key, nextEntry);
  return {
    success: true,
    limit,
    remaining: limit - nextEntry.count,
    resetAt: nextEntry.resetAt,
  };
}
