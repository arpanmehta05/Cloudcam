export type PromptLifecycleState = "draft" | "production" | "archived";

export interface NormalizedPromptMetadata {
  promptTemplateId?: string;
  promptVersionId?: string;
  promptName?: string;
  promptSlug?: string;
  promptVersion?: string;
  promptLabel?: string;
  promptEnvironment?: string;
  promptState?: PromptLifecycleState;
  promptContentHash?: string;
  promptHash?: string;
}

interface PromptMetadataSource extends NormalizedPromptMetadata {
  templateId?: string;
  versionId?: string;
  name?: string;
  slug?: string;
  version?: string;
  label?: string;
  environment?: string;
  state?: string;
  contentHash?: string;
  hash?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function asState(value: unknown): PromptLifecycleState | undefined {
  return value === "draft" || value === "production" || value === "archived"
    ? value
    : undefined;
}

function compact(metadata: NormalizedPromptMetadata): NormalizedPromptMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as NormalizedPromptMetadata;
}

function normalizeOne(source: unknown): NormalizedPromptMetadata {
  const record = asRecord(source);
  if (!record) return {};

  const nested = asRecord(record.prompt);
  const metadata = asRecord(record.metadata);
  const metadataPrompt = asRecord(metadata?.prompt);
  const prompt = {
    ...record,
    ...metadataPrompt,
    ...nested,
  } as PromptMetadataSource;

  return compact({
    promptTemplateId: asString(prompt.promptTemplateId ?? prompt.templateId, 160),
    promptVersionId: asString(prompt.promptVersionId ?? prompt.versionId, 160),
    promptName: asString(prompt.promptName ?? prompt.name ?? prompt.promptSlug ?? prompt.slug, 180),
    promptSlug: asString(prompt.promptSlug ?? prompt.slug ?? prompt.promptName ?? prompt.name, 180),
    promptVersion: asString(prompt.promptVersion ?? prompt.version, 80),
    promptLabel: asString(prompt.promptLabel ?? prompt.label, 80),
    promptEnvironment: asString(prompt.promptEnvironment ?? prompt.environment, 80),
    promptState: asState(prompt.promptState ?? prompt.state),
    promptContentHash: asString(prompt.promptContentHash ?? prompt.contentHash, 256),
    promptHash: asString(prompt.promptHash ?? prompt.hash, 256),
  });
}

export function normalizePromptMetadata(
  primary: unknown,
  fallback?: unknown,
): NormalizedPromptMetadata {
  return compact({
    ...normalizeOne(fallback),
    ...normalizeOne(primary),
  });
}
