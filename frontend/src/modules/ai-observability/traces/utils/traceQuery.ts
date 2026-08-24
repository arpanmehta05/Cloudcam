// Query language for the Trace Explorer search bar.
//
// Goals: forgiving and discoverable. Users can type bare words (matched against
// the trace name), `field:value` filters, friendly aliases (`user:`, `session:`),
// and numeric comparisons (`cost>0.01`, `latency<500ms`). Anything we don't
// recognise is surfaced back to the UI as an "ignored" token rather than
// silently dropped.

export interface ParsedQuery {
  /** Params ready to pass to `listTraces`. */
  params: Record<string, string>;
  /** Human-friendly chips shown under the bar, each removable by its token. */
  chips: Array<{ token: string; label: string }>;
  /** Free-text words (matched against trace name). */
  text: string;
  /** Tokens we could not interpret. */
  ignored: string[];
}

// Canonical backend fields <- accepted aliases (all lower-cased on lookup).
const FIELD_ALIASES: Record<string, string> = {
  status: "status",
  level: "level",
  environment: "environment",
  env: "environment",
  tag: "tag",
  name: "name",
  endpoint: "endpoint",
  service: "serviceName",
  servicename: "serviceName",
  trace: "traceId",
  traceid: "traceId",
  session: "sessionId",
  sessionid: "sessionId",
  user: "endUserId",
  enduserid: "endUserId",
  mincost: "minCost",
  maxcost: "maxCost",
  minlatencyms: "minLatencyMs",
  maxlatencyms: "maxLatencyMs",
};

const KNOWN_FIELDS = Array.from(new Set(Object.values(FIELD_ALIASES)));

/** Split respecting double quotes so `name:"my chat flow"` stays one token. */
function tokenize(query: string): string[] {
  const matches = query.match(/(?:[^\s"]+|"[^"]*")+/g);
  return matches ? matches.filter(Boolean) : [];
}

/** Parse a latency value that may carry a `ms`/`s` suffix → milliseconds. */
function toMs(raw: string): number | null {
  const m = raw.trim().match(/^([\d.]+)\s*(ms|s)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  return m[2]?.toLowerCase() === "s" ? Math.round(n * 1000) : Math.round(n);
}

function toCost(raw: string): number | null {
  const n = parseFloat(raw.replace(/^\$/, ""));
  return Number.isNaN(n) ? null : n;
}

export function parseTraceQuery(query: string): ParsedQuery {
  const params: Record<string, string> = {};
  const chips: ParsedQuery["chips"] = [];
  const ignored: string[] = [];
  const words: string[] = [];

  for (const rawToken of tokenize(query)) {
    const token = rawToken.trim();
    if (!token) continue;

    // Comparison operators for latency/cost: cost>0.01, latency<500ms
    const cmp = token.match(/^([a-zA-Z]+)\s*(>=|<=|>|<)\s*(.+)$/);
    if (cmp) {
      const [, field, op, valueRaw] = cmp;
      const value = valueRaw.replace(/^"|"$/g, "");
      const f = field.toLowerCase();
      const gt = op.startsWith(">");
      if (f === "cost") {
        const c = toCost(value);
        if (c !== null) {
          const key = gt ? "minCost" : "maxCost";
          params[key] = String(c);
          chips.push({ token, label: `cost ${op} $${c}` });
          continue;
        }
      } else if (f === "latency" || f === "duration") {
        const ms = toMs(value);
        if (ms !== null) {
          const key = gt ? "minLatencyMs" : "maxLatencyMs";
          params[key] = String(ms);
          chips.push({ token, label: `latency ${op} ${ms}ms` });
          continue;
        }
      }
      ignored.push(token);
      continue;
    }

    // field:value filters
    const colon = token.indexOf(":");
    if (colon > 0) {
      const rawKey = token.slice(0, colon).toLowerCase();
      const value = token.slice(colon + 1).replace(/^"|"$/g, "");
      const field = FIELD_ALIASES[rawKey];
      if (field && value) {
        params[field] = value;
        chips.push({ token, label: `${field}: ${value}` });
        continue;
      }
      ignored.push(token);
      continue;
    }

    // bare word → free-text name search
    words.push(token.replace(/^"|"$/g, ""));
  }

  const text = words.join(" ").trim();
  if (text) {
    params.name = params.name ? `${params.name} ${text}` : text;
    chips.push({ token: text, label: `name ~ ${text}` });
  }

  return { params, chips, text, ignored };
}

/** Remove one chip's token from the raw query string. */
export function removeToken(query: string, token: string): string {
  return tokenize(query)
    .filter((t) => t.replace(/^"|"$/g, "") !== token && t !== token)
    .join(" ");
}

export const QUERY_FIELDS = KNOWN_FIELDS;

export const QUERY_EXAMPLES: Array<{ q: string; hint: string }> = [
  { q: "status:error", hint: "Only failed traces" },
  { q: "cost>0.01", hint: "Expensive calls (over $0.01)" },
  { q: "latency>2s", hint: "Slow traces (over 2 seconds)" },
  { q: "user:user_42", hint: "One end-user’s traces" },
  { q: "session:s_123", hint: "One conversation/session" },
  { q: "env:staging", hint: "Traces from an environment" },
];
