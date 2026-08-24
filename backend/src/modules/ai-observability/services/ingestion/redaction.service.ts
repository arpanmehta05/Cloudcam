import { createHash } from "crypto";
import { getOnboardingProfile } from "../../../../services/ai-onboarding.service";

export type RedactionPolicy = "none" | "redact" | "hash" | "block";

const sensitiveKeyPattern = /(authorization|api[-_]?key|access[-_]?key|secret|token|password|credential|private[-_]?key)/i;
const patterns = [
  { name: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { name: "phone", regex: /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g },
  { name: "aws_access_key", regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "bearer_token", regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi },
  {
    name: "secret_assignment",
    regex: /\b(api[-_]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^"',\s}]+/gi,
  },
];

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function replacement(match: string, label: string, policy: RedactionPolicy): string {
  if (policy === "hash") return `[HASHED_${label.toUpperCase()}:${hashValue(match)}]`;
  return `[REDACTED_${label.toUpperCase()}]`;
}

export async function resolveRedactionPolicy(userId: string): Promise<RedactionPolicy> {
  const profile = await getOnboardingProfile(userId);
  return "piiPolicy" in profile && profile.piiPolicy ? profile.piiPolicy : "redact";
}

export function redactText(value: unknown, policy: RedactionPolicy): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (policy === "none") return trimmed;
  if (policy === "block") return undefined;
  return patterns.reduce(
    (current, pattern) => current.replace(pattern.regex, (match) => replacement(match, pattern.name, policy)),
    trimmed,
  );
}

export function redactObject<T extends Record<string, unknown> | undefined>(
  value: T,
  policy: RedactionPolicy,
): T {
  if (!value || policy === "none") return value;
  return redactUnknown(value, policy, 0) as T;
}

function redactUnknown(value: unknown, policy: RedactionPolicy, depth: number): unknown {
  if (depth > 8) return "[REDACTION_DEPTH_LIMIT]";
  if (typeof value === "string") return redactText(value, policy);
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item, policy, depth + 1));
  if (!value || typeof value !== "object") return value;

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, item]) => {
    if (sensitiveKeyPattern.test(key)) {
      if (policy === "block") return result;
      const stringValue = typeof item === "string" ? item : JSON.stringify(item);
      result[key] = policy === "hash" ? `[HASHED_SECRET:${hashValue(stringValue)}]` : "[REDACTED_SECRET]";
      return result;
    }
    const redacted = redactUnknown(item, policy, depth + 1);
    if (redacted !== undefined) result[key] = redacted;
    return result;
  }, {});
}
