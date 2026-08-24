import { User, UsageReportFrequency, IReportPreferences } from "../../../models/user.model";

export type ReportType = "usage" | "insight";

export type ReportPreferencesDto = {
    enabled: boolean;
    frequency: UsageReportFrequency;
    lastSentAt: Date | null;
    nextSendAt: Date | null;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    sections: string[];
};

const VALID_FREQUENCIES: UsageReportFrequency[] = ["weekly", "monthly"];
const DEFAULT_REPORT_SECTIONS: Record<ReportType, string[]> = {
    usage: ["summary", "topServices", "schedule"],
    insight: ["recommendations", "diagnosis", "optimizations", "alerts"],
};
const VALID_REPORT_SECTIONS: Record<ReportType, Set<string>> = {
    usage: new Set(DEFAULT_REPORT_SECTIONS.usage),
    insight: new Set(DEFAULT_REPORT_SECTIONS.insight),
};

function normalizeFrequency(value: unknown): UsageReportFrequency {
    return VALID_FREQUENCIES.includes(value as UsageReportFrequency)
        ? (value as UsageReportFrequency)
        : "weekly";
}

export function normalizeSections(type: ReportType, value: unknown, fallback?: string[]): string[] {
    const valid = VALID_REPORT_SECTIONS[type];
    const raw = Array.isArray(value) ? value : fallback;
    const sections = (raw || [])
        .filter((section): section is string => typeof section === "string" && valid.has(section));

    return sections.length ? Array.from(new Set(sections)) : DEFAULT_REPORT_SECTIONS[type];
}

/**
 * Calculates the next scheduled date based strictly on the calendar.
 */
export function calculateNextReportSendAt(
    frequency: UsageReportFrequency,
    from: Date = new Date(),
    prefs?: Partial<IReportPreferences>
): Date {
    const next = new Date(from);
    const timeStr = prefs?.timeOfDay || "09:00";
    const [h, m] = timeStr.split(":").map(Number);
    
    // Standardize to the target time in UTC on the starting day
    next.setUTCHours(h, m, 0, 0);

    if (frequency === "weekly") {
        const targetDay = typeof prefs?.dayOfWeek === "number" ? prefs.dayOfWeek : 1; // Default Monday
        const currentDay = from.getUTCDay();
        
        let daysToAdd = (targetDay - currentDay + 7) % 7;
        
        // If it's the target day but the time has already passed (or is right now), move to NEXT week
        if (daysToAdd === 0 && next <= from) {
            daysToAdd = 7;
        }
        
        next.setUTCDate(next.getUTCDate() + daysToAdd);
    } else {
        const targetDate = Math.min(Math.max(typeof prefs?.dayOfMonth === "number" ? prefs.dayOfMonth : 1, 1), 31);
        const setClampedMonthDay = (date: Date) => {
            const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
            date.setUTCDate(Math.min(targetDate, daysInMonth));
        };

        next.setUTCDate(1);
        setClampedMonthDay(next);
        // If it's already past the target date/time this month, move to next month
        if (next <= from) {
            next.setUTCMonth(next.getUTCMonth() + 1, 1);
            setClampedMonthDay(next);
        }
    }
    
    console.log(`[Report-Schedule] Calculated next delivery: ${next.toISOString()} (Params: freq=${frequency}, target=${frequency === "weekly" ? prefs?.dayOfWeek : prefs?.dayOfMonth}, time=${prefs?.timeOfDay})`);
    return next;
}

export function ensureReportPreferences(user: any, type: ReportType): { prefs: IReportPreferences; changed: boolean } {
    const key = type === "usage" ? "usageReportPreferences" : "aiInsightPreferences";
    let prefs = user[key];
    let changed = false;

    if (!prefs) {
        user[key] = {
            enabled: true,
            frequency: "weekly",
            dayOfWeek: 1,
            dayOfMonth: 1,
            timeOfDay: "09:00",
            lastSentAt: null,
            nextSendAt: null,
            sections: DEFAULT_REPORT_SECTIONS[type],
        };
        prefs = user[key];
        changed = true;
    }

    if (prefs.enabled === undefined) {
        prefs.enabled = true;
        changed = true;
    }

    if (!prefs.frequency) {
        prefs.frequency = "weekly";
        changed = true;
    }

    if (prefs.dayOfWeek === undefined) {
        prefs.dayOfWeek = 1;
        changed = true;
    }

    if (prefs.dayOfMonth === undefined) {
        prefs.dayOfMonth = 1;
        changed = true;
    }

    if (!prefs.timeOfDay) {
        prefs.timeOfDay = "09:00";
        changed = true;
    }

    const normalizedSectionsList = normalizeSections(type, prefs.sections);
    if (!Array.isArray(prefs.sections) || normalizedSectionsList.join("|") !== prefs.sections.join("|")) {
        prefs.sections = normalizedSectionsList;
        changed = true;
    }

    if (!prefs.nextSendAt) {
        prefs.nextSendAt = calculateNextReportSendAt(normalizeFrequency(prefs.frequency), new Date(), prefs);
        changed = true;
    }

    return { prefs, changed };
}

export function preferencesDto(type: ReportType, prefs: IReportPreferences | undefined | null): ReportPreferencesDto {
    const p = prefs || ({} as Partial<IReportPreferences>);
    return {
        enabled: p.enabled !== undefined ? !!p.enabled : true,
        frequency: normalizeFrequency(p.frequency),
        lastSentAt: p.lastSentAt || null,
        nextSendAt: p.nextSendAt || null,
        dayOfWeek: typeof p.dayOfWeek === "number" ? p.dayOfWeek : 1,
        dayOfMonth: typeof p.dayOfMonth === "number" ? p.dayOfMonth : 1,
        timeOfDay: p.timeOfDay || "09:00",
        sections: normalizeSections(type, p.sections),
    };
}

export async function getAllReportPreferences(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    let changed = false;
    for (const type of ["usage", "insight"] as const) {
        const res = ensureReportPreferences(user, type);
        if (res.changed) {
            changed = true;
        }
    }
    if (changed) await user.save();
    return {
        usage: preferencesDto("usage", user.usageReportPreferences),
        insight: preferencesDto("insight", user.aiInsightPreferences),
    };
}

export async function updateReportPreferences(
    userId: string,
    type: ReportType,
    input: Partial<IReportPreferences>
) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const prefKey = type === "usage" ? "usageReportPreferences" : "aiInsightPreferences";
    const current = (user as any)[prefKey] || {};

    const nextPrefs: IReportPreferences = {
        enabled: input.enabled !== undefined ? input.enabled : true,
        frequency: normalizeFrequency(input.frequency || current.frequency),
        dayOfWeek: typeof input.dayOfWeek === "number" ? input.dayOfWeek : (current.dayOfWeek ?? 1),
        dayOfMonth: typeof input.dayOfMonth === "number" ? input.dayOfMonth : (current.dayOfMonth ?? 1),
        timeOfDay: input.timeOfDay || current.timeOfDay || "09:00",
        lastSentAt: current.lastSentAt || null,
        sections: normalizeSections(type, input.sections, current.sections),
    };

    if (nextPrefs.enabled) {
        const scheduleChanged = 
            input.frequency !== undefined || 
            input.dayOfWeek !== undefined || 
            input.dayOfMonth !== undefined || 
            input.timeOfDay !== undefined;
            
        if (!current.nextSendAt || scheduleChanged) {
            nextPrefs.nextSendAt = calculateNextReportSendAt(nextPrefs.frequency, new Date(), nextPrefs);
        } else {
            nextPrefs.nextSendAt = current.nextSendAt;
        }
    } else {
        nextPrefs.nextSendAt = null;
    }

    user.set(prefKey, nextPrefs);
    await user.save();
    return preferencesDto(type, (user as any)[prefKey]);
}
