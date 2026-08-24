import { AiOnboardingProfile } from "../models/ai-onboarding-profile.model";
import {
    AI_BILLING_CURRENCIES,
    AI_CLOUD_PROVIDERS,
    AI_ENVIRONMENTS,
    AI_PII_POLICIES,
    AI_REQUIRED_EVENT_FIELDS,
    AI_SELF_HOSTED_TARGETS,
    AI_SOURCE_TYPES,
    AI_VENDOR_PROVIDERS,
} from "../constants/ai-onboarding-options";

const DEFAULT_REQUIRED_FIELDS = [...AI_REQUIRED_EVENT_FIELDS];

function pickStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function pickEnumArray(value: unknown, allowed: readonly string[]): string[] {
    return pickStringArray(value).filter((item) => allowed.includes(item));
}

function pickEnum(value: unknown, allowed: readonly string[], fallback: string): string {
    return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function sanitizeProfilePayload(payload: Record<string, any>) {
    const sourceTypes = pickEnumArray(payload.sourceTypes, AI_SOURCE_TYPES);
    const requiredEventFields = pickEnumArray(payload.requiredEventFields, AI_REQUIRED_EVENT_FIELDS);

    return {
        ...payload,
        sourceTypes: sourceTypes.length ? sourceTypes : ["instrumented_app"],
        vendorProviders: pickEnumArray(payload.vendorProviders, AI_VENDOR_PROVIDERS),
        cloudProviders: pickEnumArray(payload.cloudProviders, AI_CLOUD_PROVIDERS),
        selfHostedTargets: pickEnumArray(payload.selfHostedTargets, AI_SELF_HOSTED_TARGETS),
        workspaces: pickStringArray(payload.workspaces),
        environments: pickEnumArray(payload.environments, AI_ENVIRONMENTS),
        alertChannels: pickStringArray(payload.alertChannels),
        requiredEventFields: requiredEventFields.length
            ? requiredEventFields
            : DEFAULT_REQUIRED_FIELDS,
        billingCurrency: pickEnum(payload.billingCurrency, AI_BILLING_CURRENCIES, "USD"),
        piiPolicy: pickEnum(payload.piiPolicy, AI_PII_POLICIES, "redact"),
    };
}

export async function getOnboardingProfile(userId: string) {
    const profile = await AiOnboardingProfile.findOne({ userId }, { __v: 0 }).lean();
    if (profile) return profile;
    return {
        userId,
        sourceTypes: ["instrumented_app"],
        vendorProviders: [],
        cloudProviders: [],
        selfHostedTargets: [],
        timezone: "UTC",
        billingCurrency: "USD",
        environments: ["prod"],
        workspaces: [],
        alertChannels: [],
        requiredEventFields: DEFAULT_REQUIRED_FIELDS,
    };
}

export async function upsertOnboardingProfile(userId: string, payload: Record<string, any>) {
    const sanitized = sanitizeProfilePayload(payload);
    return AiOnboardingProfile.findOneAndUpdate(
        { userId },
        { $set: { ...sanitized, userId } },
        { upsert: true, returnDocument: "after", projection: { __v: 0 } }
    ).lean();
}

export function validateEventContract(event: Record<string, any>, requiredFields: string[] = DEFAULT_REQUIRED_FIELDS) {
    const missing = requiredFields.filter((field) => {
        const val = event[field];
        if (typeof val === "string") return val.trim().length === 0;
        return val === undefined || val === null;
    });
    return {
        valid: missing.length === 0,
        missing,
        requiredFields,
    };
}
