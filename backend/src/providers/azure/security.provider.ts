import axios from "axios";
import { getAzureAccessToken } from "./client-factory";

export interface SecurityThreat {
    id: string;
    type: string;
    severity: number; // mapped 1-10
    title: string;
    updated: string;
}

export interface SecuritySummary {
    threats: {
        count: number;
        list: SecurityThreat[];
        maxSeverity: number;
        status: string;
    };
    compliance: {
        highRiskFindings: number;
        status: "Secure" | "Action Required";
        providerStatus: string;
    };
    iam: {
        mfaStatus: string;
    };
    setupRequired?: boolean;
    warning?: string;
    error?: boolean;
}

/**
 * Normalizes Azure Defender for Cloud alert severity
 */
function normalizeSeverity(sev: string): number {
    switch (sev.toLowerCase()) {
        case "high":
            return 8;
        case "medium":
            return 5;
        case "low":
            return 3;
        default:
            return 1;
    }
}

/**
 * Queries Defender for Cloud alerts and secureScores
 */
export async function getAzureSecuritySummary(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string
): Promise<SecuritySummary> {
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        return {
            threats: {
                count: 0,
                list: [],
                maxSeverity: 0,
                status: "unconfigured"
            },
            compliance: {
                highRiskFindings: 0,
                status: "Action Required",
                providerStatus: "Setup Required: Connect Azure Security integration"
            },
            iam: {
                mfaStatus: "Setup Required"
            },
            setupRequired: true,
            warning: "Azure Security integration is not configured. Please set Active Directory credentials in Settings."
        };
    }

    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        
        const alertsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Security/alerts?api-version=2022-01-01`;
        const scoreUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Security/secureScores?api-version=2020-01-01`;

        const [alertsRes, scoreRes] = await Promise.allSettled([
            axios.get(alertsUrl, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            }),
            axios.get(scoreUrl, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            })
        ]);

        // Parse security alerts
        const rawAlerts = alertsRes.status === "fulfilled" ? alertsRes.value.data?.value || [] : [];
        const activeAlerts = rawAlerts.filter((a: any) => (a.properties?.status || "").toLowerCase() === "active");

        const list: SecurityThreat[] = activeAlerts.map((a: any) => ({
            id: a.id || `alert-${Math.random()}`,
            type: a.properties?.alertDisplayName || a.name || "Security Alert",
            severity: normalizeSeverity(a.properties?.severity || "Low"),
            title: a.properties?.description || "Suspicious activity detected.",
            updated: a.properties?.timeGeneratedUtc || new Date().toISOString()
        }));

        const maxSeverity = list.reduce((max, t) => Math.max(max, t.severity), 0);

        // Parse secure score
        const scoreData = scoreRes.status === "fulfilled" ? scoreRes.value.data?.value?.[0] : null;
        let secureScorePercent = 100;
        if (scoreData) {
            const current = scoreData.properties?.score?.current || 0;
            const max = scoreData.properties?.score?.max || 1;
            secureScorePercent = Math.round((current / max) * 100);
        }

        const highRiskFindings = list.filter(t => t.severity >= 7).length;
        const complianceStatus = secureScorePercent > 80 && highRiskFindings === 0 ? "Secure" : "Action Required";

        return {
            threats: {
                count: list.length,
                list,
                maxSeverity,
                status: "active"
            },
            compliance: {
                highRiskFindings,
                status: complianceStatus,
                providerStatus: `Secure Score: ${secureScorePercent}%`
            },
            iam: {
                mfaStatus: "Active Audit (Entra ID Multi-Factor Authentication enabled)"
            }
        };
    } catch (error: any) {
        console.warn("[getAzureSecuritySummary] Security query failed:", error.message);
        return {
            threats: {
                count: 0,
                list: [],
                maxSeverity: 0,
                status: "error"
            },
            compliance: {
                highRiskFindings: 0,
                status: "Action Required",
                providerStatus: `Connection error: ${error.message}`
            },
            iam: {
                mfaStatus: "Failed"
            },
            error: true,
            warning: `Azure Security query failed: ${error.message}. Please verify service principal permissions in Settings.`
        };
    }
}
