/**
 * Runnable self-check for the search engine (no test framework required).
 *
 *   npx tsx src/modules/navigation/utils/search.selfcheck.ts
 *
 * Exits non-zero and prints the failing case if any assertion breaks.
 * Uses a local fixture so it tests the RANKER, not the live nav config.
 */
import type { LucideIcon } from "@/icons";
import { searchNavItems } from "./search";

// The engine never renders the icon; a noop keeps the fixture type-safe.
const icon = (() => null) as unknown as LucideIcon;

type Fixture = Parameters<typeof searchNavItems>[0][number];

const items: Fixture[] = [
  {
    href: "/settings/ai-observability",
    label: "AI Observability Setup",
    icon,
    group: "Operations",
    category: "AI · Setup",
    description: "Create ingest keys and connect the SDK",
    aliases: ["ingest key", "api key"],
    keywords: ["ingest key", "ingest", "token", "sdk"],
  },
  {
    href: "/ai-observability/traces",
    label: "Trace Explorer",
    icon,
    group: "AI Observability",
    category: "AI · Monitoring",
    keywords: ["traces", "spans", "latency"],
  },
  {
    href: "/dashboards/cost",
    label: "Billing & Cost Explorer",
    icon,
    group: "Operations",
    category: "Cost & FinOps",
    keywords: ["cost", "spend", "billing"],
  },
];

function top(query: string): string | undefined {
  return searchNavItems(items, query, 5)[0]?.label;
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

// 1. The original bug: multi-word "ingest key" must find the setup page.
assert(top("ingest key") === "AI Observability Setup", '"ingest key" → Setup');

// 2. Word order and spacing shouldn't matter (tokenized AND).
assert(top("key ingest") === "AI Observability Setup", '"key ingest" → Setup');

// 3. Typo tolerance.
assert(top("tracs") === "Trace Explorer", '"tracs" (typo) → Trace Explorer');

// 4. Exact label wins over incidental keyword overlap.
assert(top("cost") === "Billing & Cost Explorer", '"cost" → Billing');

// 5. AND semantics: a token that matches nothing yields no result.
assert(
  searchNavItems(items, "ingest wombat", 5).length === 0,
  "unmatched token excludes the item",
);

console.log("search.selfcheck: all assertions passed ✓");
