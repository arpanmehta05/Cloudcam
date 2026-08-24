type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;

export function checkCloudWatcherReportRateLimit(tokenKey: string, now = Date.now()) {
  const bucket = buckets.get(tokenKey) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    const oldest = bucket.timestamps[0] || now;
    buckets.set(tokenKey, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(tokenKey, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}
