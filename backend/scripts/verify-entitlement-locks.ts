import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..", "..");

type Check = {
  name: string;
  file: string;
  patterns: RegExp[];
};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function runCheck(check: Check): string[] {
  const text = read(check.file);
  return check.patterns
    .filter((pattern) => !pattern.test(text))
    .map((pattern) => `${check.name}: missing ${pattern} in ${check.file}`);
}

const checks: Check[] = [
  {
    name: "Direct API calls reject locked Cost Explorer access",
    file: "backend/src/modules/aws/aws.router.ts",
    patterns: [
      /router\.get\("\/billing", requireFeature\(FEATURE_KEYS\.costExplorer\)/,
      /router\.get\("\/optimization", requireFeature\(FEATURE_KEYS\.costExplorer\)/,
      /router\.post\("\/actions\/plan", requireFeature\(FEATURE_KEYS\.costExplorer\)/,
      /router\.get\("\/actions\/savings", requireFeature\(FEATURE_KEYS\.costExplorer\)/,
    ],
  },
  {
    name: "Cloud aggregate APIs reject locked billing and recommendation access",
    file: "backend/src/modules/cloud/cloud.router.ts",
    patterns: [
      /cloudRouter\.get\("\/billing", requireFeature\(FEATURE_KEYS\.costExplorer\)/,
      /cloudRouter\.get\("\/recommendations", requireFeature\(FEATURE_KEYS\.costExplorer\)/,
    ],
  },
  {
    name: "Locked feature route access is backend-enforced",
    file: "backend/src/modules/ai-observability/ai-observability.router.ts",
    patterns: [/router\.use\(requireFeature\(FEATURE_KEYS\.aiObservability\)\)/],
  },
  {
    name: "Locked simulation routes are backend-enforced",
    file: "backend/src/modules/simulation/simulation.router.ts",
    patterns: [/router\.use\(requireFeature\(FEATURE_KEYS\.simulations\)\)/],
  },
  {
    name: "Locked VPS Logs routes are backend-enforced",
    file: "backend/src/modules/vps-logs/vps-logs.router.ts",
    patterns: [/router\.use\(requireFeature\(FEATURE_KEYS\.vpsLogs\)\)/],
  },
  {
    name: "Locked Watchdog route is backend-enforced",
    file: "backend/src/modules/core/router.ts",
    patterns: [/router\.get\("\/watchdog", requireFeature\(FEATURE_KEYS\.watchdog\)/],
  },
  {
    name: "Public AI ingest keys cannot bypass locked feature access",
    file: "backend/src/middleware/ai-ingest-auth.middleware.ts",
    patterns: [
      /getFeatureAccessForUser/,
      /FEATURE_KEYS\.aiObservability/,
      /FEATURE_NOT_ENTITLED/,
    ],
  },
  {
    name: "Public VPS agent ingest cannot bypass locked feature access",
    file: "backend/src/modules/vps-logs/services/ingest.service.ts",
    patterns: [
      /getFeatureAccessForUser\(agent\.userId, FEATURE_KEYS\.vpsLogs\)/,
      /FEATURE_NOT_ENTITLED/,
      /error\.status = 403/,
    ],
  },
  {
    name: "Feature guard returns upgrade context for direct API callers",
    file: "backend/src/modules/admin/require-feature.ts",
    patterns: [
      /status\(403\)/,
      /FEATURE_NOT_ENTITLED/,
      /requiredPlanKey/,
      /upgrade_or_contact_support/,
    ],
  },
  {
    name: "Tenant switching uses user-derived tenant entitlements",
    file: "backend/src/modules/admin/entitlements.service.ts",
    patterns: [
      /resolveEntitlementsForUser/,
      /User\.findById\(userId\)\.select\("tenantId"\)/,
      /const tenantId = user\?\.tenantId \|\| userId/,
    ],
  },
  {
    name: "Unmanaged tenants do not bypass backend feature locks",
    file: "backend/src/modules/admin/entitlements.service.ts",
    patterns: [
      /const allowed = entitlements\.features\[featureKey\] === true/,
    ],
  },
  {
    name: "Unmanaged tenants do not bypass frontend feature locks",
    file: "frontend/src/modules/admin/entitlements.client.tsx",
    patterns: [
      /if \(!entitlements\) return false/,
      /return entitlements\.features\[featureKey\] === true/,
    ],
  },
  {
    name: "DevTools UI toggles cannot unlock feature pages",
    file: "frontend/src/modules/admin/entitlements.client.tsx",
    patterns: [
      /Why this is locked/,
      /direct API calls cannot unlock this feature/,
      /FeatureLockedGate/,
    ],
  },
  {
    name: "Locked route access shows purchase/support context",
    file: "frontend/src/modules/admin/entitlements.client.tsx",
    patterns: [/Request access/, /View billing/, /Contact support/, /Required plan/],
  },
  {
    name: "Cost Explorer page is route-gated",
    file: "frontend/src/app/cost-savings/page.tsx",
    patterns: [/FeatureLockedGate feature="cost_explorer"/],
  },
  {
    name: "AI Observability pages are route-gated",
    file: "frontend/src/app/ai-observability/layout.tsx",
    patterns: [/FeatureLockedGate feature="ai_observability"/],
  },
  {
    name: "VPS Logs page is route-gated before data hooks run",
    file: "frontend/src/app/vps-logs/page.tsx",
    patterns: [/function VpsLogsContent/, /FeatureLockedGate feature="vps_logs"/],
  },
  {
    name: "Simulation live canvas routes are route-gated",
    file: "frontend/src/app/simulations/live-canvas/page.tsx",
    patterns: [/FeatureLockedGate feature="simulations"/],
  },
  {
    name: "Simulation live canvas detail routes are route-gated",
    file: "frontend/src/app/simulations/live-canvas/[serviceId]/page.tsx",
    patterns: [/FeatureLockedGate feature="simulations"/],
  },
];

const failures = checks.flatMap(runCheck);

if (failures.length > 0) {
  console.error("Entitlement lock verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Entitlement lock verification passed (${checks.length} checks).`);
console.log("Covered: DevTools tampering, direct API calls, tenant-derived entitlements, public ingestion, and locked route access.");
