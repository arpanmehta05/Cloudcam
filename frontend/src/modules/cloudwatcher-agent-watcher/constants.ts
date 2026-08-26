// CloudWatcher Agent Watcher — static configuration.
//
// The "check prompt" is generated entirely on the client from these constants
// (a per-system_type skill URL + the user's own ingest key). There is NO
// backend /prompt endpoint — see PART 1 of the build spec.

import type { LucideIcon } from "@/icons";
import { Bot, Boxes, MessageSquare, Zap } from "@/icons";

export type SystemType = "raw-llm-api" | "rag-pipeline" | "agent-tools" | "chatbot";

// Where the CloudWatcher self-audit skills live (public skills repo:
// github.com/cloud-watcher24/Cloudwatcher-skills). Each per-system_type check
// skill ships a SKILL.md + test_cases.json under skills/<type>/.
//
// NOTE: this is the single place to correct the hosting path if the skills
// repo/branch moves. The executing agent fetches the raw files from here.
export const SKILL_RAW_BASE =
  "https://raw.githubusercontent.com/cloud-watcher24/Cloudwatcher-skills/main/skills";

// The orchestrator skill drives the whole self-audit procedure. The generated
// prompt points the executing agent here instead of inlining every step.
export const ORCHESTRATOR_SKILL_URL = `${SKILL_RAW_BASE}/_orchestrator/SKILL.md`;

// Absolute endpoint the executing agent POSTs its report to. In a deployed
// build NEXT_PUBLIC_API_BASE_URL points at the backend; when unset we fall
// back to the public CloudWatcher host.
export const REPORTS_SUBMIT_URL = `${
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://cloudcam.server.fonder.tech"
}/api/v1/reports`;

export interface SystemTypeMeta {
  type: SystemType;
  label: string;
  tagline: string;
  /** Plain-language description of the system, embedded in the prompt. */
  selfDescription: string;
  /** Signals the agent should look for to confirm it matches this type. */
  signals: string[];
  icon: LucideIcon;
  accent: string;
  skillUrl: string;
  testCasesUrl: string;
}

function skillUrls(type: SystemType) {
  return {
    skillUrl: `${SKILL_RAW_BASE}/${type}/SKILL.md`,
    testCasesUrl: `${SKILL_RAW_BASE}/${type}/test_cases.json`,
  };
}

export const SYSTEM_TYPES: SystemTypeMeta[] = [
  {
    type: "raw-llm-api",
    label: "Raw LLM API",
    tagline: "Direct model calls, prompt contracts, validation, evals, and ops controls.",
    selfDescription:
      "a direct integration against a model provider's chat/completions API, with prompts assembled in code and no retrieval layer or tool-calling loop",
    signals: [
      "direct SDK/HTTP calls to OpenAI / Anthropic / Gemini / Bedrock etc.",
      "prompts built from string templates in code",
      "no vector store, retriever, or tool/function-calling loop",
    ],
    icon: Zap,
    accent: "#1A56DB",
    ...skillUrls("raw-llm-api"),
  },
  {
    type: "rag-pipeline",
    label: "RAG Pipeline",
    tagline: "Retrieval, grounding, citation integrity, RAG evals, and source safety.",
    selfDescription:
      "a retrieval-augmented generation pipeline that fetches documents/chunks from a vector store or search index and grounds model answers in that retrieved context",
    signals: [
      "an embeddings model + vector store / search index (pgvector, Pinecone, Qdrant, etc.)",
      "a retriever that runs before the model call",
      "answers expected to cite or ground on retrieved chunks",
    ],
    icon: Boxes,
    accent: "#0891B2",
    ...skillUrls("rag-pipeline"),
  },
  {
    type: "agent-tools",
    label: "Agentic / Tool-Using",
    tagline: "Tool schemas, permissions, approvals, traces, and side-effect safety.",
    selfDescription:
      "an agentic, tool-using system where the model selects and invokes tools/functions across one or more steps to accomplish a task",
    signals: [
      "tool / function definitions passed to the model",
      "a loop that executes tool calls and feeds results back",
      "multi-step planning or task decomposition",
    ],
    icon: Bot,
    accent: "#7C3AED",
    ...skillUrls("agent-tools"),
  },
  {
    type: "chatbot",
    label: "Chatbot / Conversational",
    tagline: "Session state, privacy isolation, escalation, memory, and consistency.",
    selfDescription:
      "a multi-turn conversational assistant that maintains dialogue state/history and responds to users in a chat surface",
    signals: [
      "conversation history threaded into each request",
      "a chat UI / messaging surface",
      "persona or system-prompt shaping tone and behaviour",
    ],
    icon: MessageSquare,
    accent: "#EA580C",
    ...skillUrls("chatbot"),
  },
];

export const SYSTEM_TYPE_MAP: Record<SystemType, SystemTypeMeta> = SYSTEM_TYPES.reduce(
  (acc, meta) => {
    acc[meta.type] = meta;
    return acc;
  },
  {} as Record<SystemType, SystemTypeMeta>,
);

export function isSystemType(value: string | null | undefined): value is SystemType {
  return !!value && value in SYSTEM_TYPE_MAP;
}

// ── Score bands ──────────────────────────────────────────────────────────
// Backend score is a 0..1 float. We surface it as 0..100 with a letter grade
// and a band colour drawn from the landing palette.
export interface ScoreBand {
  min: number; // inclusive lower bound on the 0..1 score
  grade: string;
  label: string;
  color: string; // solid accent
  soft: string; // tint background
  ring: string; // gradient stop for the gauge
}

// Monochrome blue → ink scale: strong scores read brand-blue, weak scores read
// high-contrast ink. Keeps the gauge on the blue / white / black palette while
// still separating grades by tone.
export const SCORE_BANDS: ScoreBand[] = [
  { min: 0.9, grade: "A", label: "Excellent", color: "#1A56DB", soft: "#EFF6FF", ring: "#3B82F6" },
  { min: 0.75, grade: "B", label: "Strong", color: "#2563EB", soft: "#EFF6FF", ring: "#60A5FA" },
  { min: 0.6, grade: "C", label: "Fair", color: "#475569", soft: "#F1F5F9", ring: "#94A3B8" },
  { min: 0.45, grade: "D", label: "Needs work", color: "#334155", soft: "#EEF2F6", ring: "#64748B" },
  { min: 0, grade: "E", label: "At risk", color: "#0F172A", soft: "#EEF2F6", ring: "#334155" },
];

export function scoreBand(score01: number): ScoreBand {
  return SCORE_BANDS.find((band) => score01 >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

export const CLOUDWATCHER_KEY_NAME = "cloudwatcher agent-watcher";
export const POST_AUTH_REDIRECT_KEY = "post_auth_redirect";
