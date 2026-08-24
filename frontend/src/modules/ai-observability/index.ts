// ─── AI Observability Module — Public Interface ─────────────────────────────
// External callers must import from this barrel only — never from internal
// paths (enforced by import/no-restricted-paths in eslint.config.mjs).

export { setupApi, createIngestKey, listIngestKeys, revokeIngestKey } from "./setup/api";
export type { AiIngestKey } from "./api/types";
