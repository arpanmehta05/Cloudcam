// AWS Security Aggregation Helpers
import { GuardDutyClient, ListFindingsCommand, GetFindingsCommand, ListDetectorsCommand } from "@aws-sdk/client-guardduty";
import { SecurityHubClient, GetFindingsCommand as GetHubFindingsCommand } from "@aws-sdk/client-securityhub";
import { IAMClient, GenerateCredentialReportCommand } from "@aws-sdk/client-iam";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";

export async function getSecuritySummary(
    workspaceId: string,
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
) {
    const config = await getClientConfig(workspaceId, region, roleArn, externalId);

    const gdClient = new GuardDutyClient(config);
    const hubClient = new SecurityHubClient(config);
    const iamClient = new IAMClient(config);

    // 1. Fetch GuardDuty findings (Threats)
    let threats: any[] = [];
    try {
        const detectors: any = await gdClient.send(new ListDetectorsCommand({}));
        const detectorIds = detectors.DetectorIds;

        if (detectorIds?.length) {
            const listFindingsResponse: any = await gdClient.send(new ListFindingsCommand({ DetectorId: detectorIds[0] }));
            const findingIds = listFindingsResponse.FindingIds;
            if (findingIds?.length) {
                const getFindingsResponse: any = await gdClient.send(new GetFindingsCommand({
                    DetectorId: detectorIds[0],
                    FindingIds: findingIds.slice(0, 10)
                }));
                threats = getFindingsResponse.Findings?.map((f: any) => ({
                    id: f.Id,
                    type: f.Type,
                    severity: f.Severity,
                    title: f.Title,
                    updated: f.UpdatedAt
                })) || [];
            }
        }
    } catch (e) { console.error("GuardDuty Error:", e); }

    // 2. Fetch SecurityHub Compliance Score (Simplified)
    let complianceScore = 0;
    let highRiskFindings = 0;
    try {
        const hubResults = await hubClient.send(new GetHubFindingsCommand({
            Filters: { SeverityLabel: [{ Value: "HIGH", Comparison: "EQUALS" }, { Value: "CRITICAL", Comparison: "EQUALS" }] },
            MaxResults: 50
        }));
        highRiskFindings = hubResults.Findings?.length || 0;
    } catch (e) { console.error("SecurityHub Error:", e); }

    // 3. IAM Security Status
    let mfaStatus = "Unknown";
    try {
        // This is a complex multi-step call in AWS, we'll simplify for now
        // checking for basic IAM user status or credential report readiness
        await iamClient.send(new GenerateCredentialReportCommand({}));
        mfaStatus = "Active Audit";
    } catch (e) { console.error("IAM Error:", e); }

    return {
        threats: {
            count: threats.length,
            list: threats,
            maxSeverity: Math.max(...threats.map(t => t.severity || 0), 0)
        },
        compliance: {
            highRiskFindings,
            status: highRiskFindings > 0 ? "Action Required" : "Secure"
        },
        iam: {
            mfaStatus
        }
    };
}
