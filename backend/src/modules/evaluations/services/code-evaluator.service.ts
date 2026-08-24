export type CodeEvaluatorType =
  | "exact_match"
  | "contains"
  | "regex"
  | "json_valid"
  | "json_equals"
  | "numeric_range"
  | "levenshtein_similarity";

export interface CodeEvaluatorConfig {
  caseSensitive?: boolean;
  trim?: boolean;
  pattern?: string;
  flags?: string;
  min?: number;
  max?: number;
  /** Similarity threshold 0-1 above which the result passes. */
  threshold?: number;
  /** Dot path into a JSON output to extract before comparing. */
  path?: string;
}

export interface CodeEvaluatorResult {
  score: number; // 0-100
  passed: boolean;
  reasoning: string;
}

function normalize(value: string, config: CodeEvaluatorConfig): string {
  let result = value;
  if (config.trim !== false) result = result.trim();
  if (!config.caseSensitive) result = result.toLowerCase();
  return result;
}

/** Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + cost,
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

/** Stable stringification with sorted object keys for order-independent equality. */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function valueAtPath(source: unknown, path?: string): unknown {
  if (!path) return source;
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function pass(reasoning: string, score = 100): CodeEvaluatorResult {
  return { score, passed: true, reasoning };
}

function fail(reasoning: string, score = 0): CodeEvaluatorResult {
  return { score, passed: false, reasoning };
}

/**
 * Deterministic, side-effect-free evaluators. No user code is executed — each
 * type is a fixed comparison strategy configured by `config`.
 */
export function runCodeEvaluator(
  type: CodeEvaluatorType,
  output: string,
  expectedOutput: string,
  config: CodeEvaluatorConfig = {},
): CodeEvaluatorResult {
  const actual = output ?? "";
  const expected = expectedOutput ?? "";

  switch (type) {
    case "exact_match": {
      const isMatch = normalize(actual, config) === normalize(expected, config);
      return isMatch ? pass("Output exactly matches expected") : fail("Output does not match expected");
    }

    case "contains": {
      const needle = normalize(config.pattern ?? expected, config);
      const haystack = normalize(actual, config);
      return haystack.includes(needle)
        ? pass(`Output contains "${config.pattern ?? expected}"`)
        : fail(`Output does not contain "${config.pattern ?? expected}"`);
    }

    case "regex": {
      if (!config.pattern) return fail("No regex pattern configured");
      let regex: RegExp;
      try {
        regex = new RegExp(config.pattern, config.flags ?? (config.caseSensitive ? "" : "i"));
      } catch (error) {
        return fail(`Invalid regex: ${error instanceof Error ? error.message : String(error)}`);
      }
      return regex.test(actual)
        ? pass(`Output matches /${config.pattern}/`)
        : fail(`Output does not match /${config.pattern}/`);
    }

    case "json_valid": {
      try {
        JSON.parse(actual);
        return pass("Output is valid JSON");
      } catch {
        return fail("Output is not valid JSON");
      }
    }

    case "json_equals": {
      let actualJson: unknown;
      let expectedJson: unknown;
      try {
        actualJson = valueAtPath(JSON.parse(actual), config.path);
      } catch {
        return fail("Output is not valid JSON");
      }
      try {
        expectedJson = valueAtPath(JSON.parse(expected), config.path);
      } catch {
        return fail("Expected output is not valid JSON");
      }
      const equal = canonicalize(actualJson) === canonicalize(expectedJson);
      return equal ? pass("JSON structures are equal") : fail("JSON structures differ");
    }

    case "numeric_range": {
      const parsed = Number.parseFloat(actual.trim());
      if (Number.isNaN(parsed)) return fail("Output is not a number");
      const min = config.min ?? Number.NEGATIVE_INFINITY;
      const max = config.max ?? Number.POSITIVE_INFINITY;
      return parsed >= min && parsed <= max
        ? pass(`Value ${parsed} within [${config.min ?? "-∞"}, ${config.max ?? "∞"}]`)
        : fail(`Value ${parsed} outside [${config.min ?? "-∞"}, ${config.max ?? "∞"}]`);
    }

    case "levenshtein_similarity": {
      const a = normalize(actual, config);
      const b = normalize(expected, config);
      const maxLen = Math.max(a.length, b.length);
      const similarity = maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
      const threshold = config.threshold ?? 0.8;
      const score = Math.round(similarity * 100);
      return similarity >= threshold
        ? pass(`Similarity ${score}% ≥ ${Math.round(threshold * 100)}%`, score)
        : fail(`Similarity ${score}% < ${Math.round(threshold * 100)}%`, score);
    }

    default:
      return fail(`Unknown evaluator type: ${type}`);
  }
}
