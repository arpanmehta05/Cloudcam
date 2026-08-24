import { NavItem, SearchResult } from "../types";

/**
 * Command-palette search engine.
 *
 * Unlike a plain `includes()` filter, this:
 *  - tokenizes the query and requires EVERY token to match (AND semantics),
 *    so "ingest key" matches an item that has "ingest" and "key" in different
 *    fields rather than needing the literal phrase "ingest key";
 *  - weights fields (a hit on the name beats a hit on a keyword);
 *  - is typo tolerant (fuzzy subsequence + 1-edit distance for longer tokens);
 *  - RANKS results by score instead of returning the first substring match.
 */

// Field weights — higher means a match there is more meaningful.
const WEIGHTS = {
  label: 12,
  alias: 10,
  keyword: 7,
  description: 5,
  category: 4,
  group: 3,
  href: 2,
} as const;

type SearchableItem = NavItem & {
  group: string;
  category: string;
};

export type SearchField = {
  text: string;
  weight: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_/-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean);
}

/** Levenshtein distance, capped early — we only care about small edits. */
function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return false;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length] <= max;
}

/** True if every char of `token` appears in order inside `word` (fuzzy). */
function isSubsequence(token: string, word: string): boolean {
  let i = 0;
  for (let j = 0; j < word.length && i < token.length; j++) {
    if (word[j] === token[i]) i++;
  }
  return i === token.length;
}

/**
 * Score how well a single query token matches a single field word.
 * Returns a multiplier in [0, 1] of the field weight.
 */
function tokenWordScore(token: string, word: string): number {
  if (!word) return 0;
  if (word === token) return 1; // exact word
  if (word.startsWith(token)) return 0.85; // prefix ("ingest" ~ "ingestion")
  if (word.includes(token)) return 0.55; // substring
  // Typo tolerance for meaningful tokens only.
  // ponytail: hand-rolled fuzzy (edit-distance + subsequence) -> swap for
  // Fuse.js only if fuzzy quality/config ever needs to grow.
  if (token.length >= 4) {
    const maxEdits = token.length >= 7 ? 2 : 1;
    if (editDistanceWithin(token, word, maxEdits)) return 0.45;
    if (word.length >= token.length && isSubsequence(token, word)) return 0.3;
  }
  return 0;
}

function buildFields(item: SearchableItem): SearchField[] {
  const fields: SearchField[] = [
    { text: item.label, weight: WEIGHTS.label },
    { text: item.category, weight: WEIGHTS.category },
    { text: item.group, weight: WEIGHTS.group },
    { text: item.href, weight: WEIGHTS.href },
  ];
  if (item.description)
    fields.push({ text: item.description, weight: WEIGHTS.description });
  // Provider names (e.g. "Blob Storage") are folded into aliases by the config.
  for (const alias of item.aliases || [])
    fields.push({ text: alias, weight: WEIGHTS.alias });
  for (const kw of item.keywords || [])
    fields.push({ text: kw, weight: WEIGHTS.keyword });
  return fields;
}

/** Best score for one token across all of an item's fields. */
function scoreToken(token: string, fields: SearchField[]): number {
  let best = 0;
  for (const field of fields) {
    const words = tokenize(field.text);
    for (const word of words) {
      const s = tokenWordScore(token, word) * field.weight;
      if (s > best) best = s;
    }
  }
  return best;
}

export function scoreItem(
  item: SearchableItem,
  query: string,
): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;

  const fields = buildFields(item);
  let total = 0;
  for (const token of tokens) {
    const tokenScore = scoreToken(token, fields);
    if (tokenScore === 0) return 0; // AND: every token must land somewhere
    total += tokenScore;
  }

  // Bonuses that sharpen ranking.
  const normQuery = normalize(query);
  const normLabel = normalize(item.label);
  if (normLabel === normQuery) total += 40; // exact name
  else if (normLabel.startsWith(normQuery)) total += 15; // name prefix
  else if (normLabel.includes(normQuery)) total += 8; // name contains phrase

  // Whole-phrase hit anywhere (keeps multi-word intent tight).
  if (
    tokens.length > 1 &&
    fields.some((f) => normalize(f.text).includes(normQuery))
  ) {
    total += 6;
  }

  return total;
}

/**
 * Rank searchable nav items against a query.
 * Returns scored results sorted best-first.
 */
export function searchNavItems(
  items: SearchableItem[],
  query: string,
  limit = 8,
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const scored: SearchResult[] = [];
  for (const item of items) {
    const score = scoreItem(item, trimmed);
    if (score > 0) {
      scored.push({
        ...item,
        category: item.category || item.group,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return scored.slice(0, limit);
}
