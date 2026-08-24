/**
 * Parses a range string (e.g. "24h", "7d", "30d", "90d") into a Date cutoff.
 */
export function parseDateRange(range?: string): Date {
  const cutoff = new Date();
  const normalized = (range || "7d").trim().toLowerCase();
  const dayMatch = normalized.match(/^(\d+)d$/);
  const hourMatch = normalized.match(/^(\d+)h$/);

  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    cutoff.setHours(cutoff.getHours() - hours);
    return cutoff;
  }

  const days = dayMatch ? parseInt(dayMatch[1], 10) : 7;
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

/**
 * Returns the current date as YYYY-MM-DD string.
 */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}
