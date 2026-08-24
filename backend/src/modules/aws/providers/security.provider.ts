// AWS Security Provider — GuardDuty, SecurityHub, IAM
import { GuardDutyClient, ListFindingsCommand, GetFindingsCommand, ListDetectorsCommand } from "@aws-sdk/client-guardduty";
import { SecurityHubClient, GetFindingsCommand as GetHubFindingsCommand } from "@aws-sdk/client-securityhub";
import { IAMClient, GenerateCredentialReportCommand } from "@aws-sdk/client-iam";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";

export async function getSecuritySummary(workspaceId: string, region: string = DEFAULT_REGION, roleArn?: string, externalId?: string) {
    // "all" is a UI token — GuardDuty, SecurityHub, and IAM are regional services
    // that require a concrete region string. Fall back to DEFAULT_REGION when "all"
    // or an empty value is passed so the SDK never receives an invalid region.
    const resolvedRegion = (!region || region === "all") ? DEFAULT_REGION : region;
    const clientConfig = await getClientConfig(workspaceId, resolvedRegion, roleArn, externalId);
    const gdClient = new GuardDutyClient(clientConfig);
    const hubClient = new SecurityHubClient(clientConfig);
    const iamClient = new IAMClient(clientConfig);

    let threats: any[] = [];
    let gdStatus = "active";
    try {
        const detectors: any = await gdClient.send(new ListDetectorsCommand({}));
        if (detectors.DetectorIds?.length) {
            const listFindings: any = await gdClient.send(new ListFindingsCommand({ DetectorId: detectors.DetectorIds[0] }));
            if (listFindings.FindingIds?.length) {
                const getFindings: any = await gdClient.send(new GetFindingsCommand({ DetectorId: detectors.DetectorIds[0], FindingIds: listFindings.FindingIds.slice(0, 10) }));
                threats = getFindings.Findings?.map((f: any) => ({ id: f.Id, type: f.Type, severity: f.Severity, title: f.Title, updated: f.UpdatedAt })) || [];
            }
        }
    } catch (e: any) {
        if (e.name === "AccessDeniedException" || e.name === "AccessDenied") {
            gdStatus = "Access Denied (Missing Permissions)";
        } else {
            console.error("GuardDuty Error:", e.name || e.message);
            gdStatus = "Error: " + (e.name || "Unknown");
        }
    }

    let highRiskFindings = 0;
    let hubStatus = "active";
    try {
        const hubResults = await hubClient.send(new GetHubFindingsCommand({
            Filters: { SeverityLabel: [{ Value: "HIGH", Comparison: "EQUALS" }, { Value: "CRITICAL", Comparison: "EQUALS" }] },
            MaxResults: 50
        }));
        highRiskFindings = hubResults.Findings?.length || 0;
    } catch (e: any) {
        if (e.name === "AccessDeniedException" || e.name === "AccessDenied") {
            hubStatus = "Access Denied (Missing Permissions)";
        } else {
            console.error("SecurityHub Error:", e.name || e.message);
            hubStatus = "Error: " + (e.name || "Unknown");
        }
    }

    let mfaStatus = "Unknown";
    try {
        await iamClient.send(new GenerateCredentialReportCommand({}));
        mfaStatus = "Active Audit";
    } catch (e: any) {
        if (e.name === "AccessDeniedException" || e.name === "AccessDenied") {
            mfaStatus = "Access Denied (Missing Permissions)";
        } else {
            console.error("IAM Error:", e.name || e.message);
        }
    }

    return {
        threats: { count: threats.length, list: threats, maxSeverity: Math.max(...threats.map(t => t.severity || 0), 0), status: gdStatus },
        compliance: { highRiskFindings, status: highRiskFindings > 0 ? "Action Required" : "Secure", providerStatus: hubStatus },
        iam: { mfaStatus }
    };
}
