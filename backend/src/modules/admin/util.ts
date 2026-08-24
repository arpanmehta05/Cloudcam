/**
 * Coerce a feature map to a plain record. Mongoose stores these as `Map`, but
 * hydrated docs, `.lean()` results, and request bodies can each hand us a Map
 * or a plain object — this normalises all of them.
 */
export function mapToRecord(
  m?: Map<string, boolean> | Record<string, boolean> | null,
): Record<string, boolean> {
  if (!m) return {};
  if (m instanceof Map) return Object.fromEntries(m);
  return { ...m };
}

/** Route params are typed `string | string[]` in this repo; coerce to string. */
export function paramString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}
