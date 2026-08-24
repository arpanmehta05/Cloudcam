import type { CategorySummary, ReportDetail, TestResult } from "./types";

/**
 * Summarise test results grouped by category.
 *
 * @param testResults   Raw test results from the report.
 * @param backendCategoryScores  Evidence-adjusted per-category scores from the backend
 *   (0..1). When provided these are used as `ratio` directly, making category bars
 *   consistent with the overall score shown in the gauge.
 */
export function summarizeCategories(
  testResults: TestResult[],
  backendCategoryScores?: Record<string, number>,
): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const result of testResults) {
    const bucket =
      map.get(result.category) ??
      {
        category: result.category,
        passed: 0,
        failed: 0,
        manualReview: 0,
        notRun: 0,
        scored: 0,
        total: 0,
        ratio: 0,
      };
    bucket.total += 1;
    switch (result.pass_fail_status) {
      case "pass":
        bucket.passed += 1;
        break;
      case "fail":
        bucket.failed += 1;
        break;
      case "manual_review":
        bucket.manualReview += 1;
        break;
      case "not_run":
        bucket.notRun += 1;
        break;
    }
    map.set(result.category, bucket);
  }
  const list = Array.from(map.values());
  for (const bucket of list) {
    bucket.scored = bucket.passed + bucket.failed;

    // Prefer the backend evidence-adjusted score when available.
    // The backend applies evidence quality penalties (e.g. pass-without-citations → 0.7)
    // that the frontend cannot compute from raw pass_fail_status values alone.
    // Fall back to a simple weighted estimate only when the backend score is absent.
    const backendScore = backendCategoryScores?.[bucket.category];
    if (typeof backendScore === "number" && Number.isFinite(backendScore)) {
      bucket.ratio = backendScore;
    } else {
      const points = bucket.passed * 1.0 + bucket.manualReview * 0.3 + bucket.notRun * 0.0;
      bucket.ratio = bucket.total > 0 ? points / bucket.total : 0;
    }
  }
  // Weakest categories first — a report artifact leads with what needs attention.
  return list.sort((a, b) => a.ratio - b.ratio);
}

export function countByStatus(testResults: TestResult[]) {
  return testResults.reduce(
    (acc, r) => {
      acc[r.pass_fail_status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, manual_review: 0, not_run: 0 } as Record<
      TestResult["pass_fail_status"],
      number
    >,
  );
}

export function scoreOutOf100(score: number | null): number | null {
  if (score === null || Number.isNaN(score)) return null;
  return Math.round(score * 100);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(iso);
}

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function reportIsPending(report: Pick<ReportDetail, "status">): boolean {
  return report.status === "pending_score";
}
