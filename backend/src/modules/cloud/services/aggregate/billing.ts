import { CloudProvider, CloudAggregateBillingSummary, CloudAggregateResponse, CloudProviderConnectionSummary } from "../../../../providers/cloud/types";
import { getCredentials } from "../../../../store/workspace-credentials";
import { sanitizeProviderError, withProviderSync } from "../sync-guard.service";
import { getAllProviderConnectionSummaries } from "../capabilities.service";
import { selectedProviders } from "./helpers";
import { getBillingData as getAwsBillingData } from "../../../../services/aws/billing.service";
import { getBillingData as getAzureBillingData } from "../../../../services/azure/billing.service";
import { getGcpBillingData } from "../../../../services/gcp/billing.service";

export async function getAggregateCloudBilling(
    userId: string,
    provider: CloudProvider | "all",
    range: string,
    forceRefresh: boolean = false
): Promise<CloudAggregateResponse<CloudAggregateBillingSummary>> {
    const providerSummaries = await getAllProviderConnectionSummaries(userId);
    const targetProviders = selectedProviders(provider, providerSummaries);

    const results = await Promise.allSettled(
        targetProviders.map((prov) => withProviderSync(userId, prov, "billing", async () => {
            const creds = await getCredentials(userId, prov);
            if (!creds) {
                return { provider: prov, data: null, warnings: [`${prov} is not connected.`] };
            }

            if (prov === "aws") {
                try {
                    const result = await getAwsBillingData(userId, range, creds.roleArn, creds.externalId);
                    const billingSummary: CloudAggregateBillingSummary = {
                        provider: prov,
                        currentSpend: result.summary.currentSpend,
                        mtdSpend: result.summary.mtdSpend,
                        unit: result.summary.unit,
                        projectedTotal: result.summary.projectedTotal,
                        breakdown: result.mtdBreakdown,
                        history: result.history,
                    };
                    return { provider: prov, data: billingSummary, warnings: [] };
                } catch (err: any) {
                    return { provider: prov, data: null, warnings: [`AWS billing failed: ${err.message || err}`] };
                }
            }

            if (prov === "azure") {
                try {
                    const result = await getAzureBillingData(
                        userId,
                        range,
                        creds.tenantId,
                        creds.subscriptionId,
                        creds.clientId,
                        creds.clientSecret,
                        creds.billingAccountId,
                        forceRefresh
                    );
                    const billingSummary: CloudAggregateBillingSummary = {
                        provider: prov,
                        currentSpend: result.summary.currentSpend,
                        mtdSpend: result.summary.mtdSpend,
                        unit: result.summary.unit,
                        projectedTotal: result.summary.projectedTotal,
                        breakdown: result.mtdBreakdown,
                        history: result.history,
                    };
                    return { provider: prov, data: billingSummary, warnings: result.warnings || (result.warning ? [result.warning] : []) };
                } catch (err: any) {
                    return { provider: prov, data: null, warnings: [`Azure billing failed: ${err.message || err}`] };
                }
            }

            // GCP provider
            try {
                const result = await getGcpBillingData(
                    userId,
                    range,
                    creds.projectId,
                    creds.clientEmail,
                    creds.privateKey,
                    creds.billingDatasetId,
                    creds.billingTableId
                );
                const billingSummary: CloudAggregateBillingSummary = {
                    provider: prov,
                    currentSpend: result.summary.currentSpend,
                    mtdSpend: result.summary.mtdSpend,
                    unit: result.summary.unit,
                    projectedTotal: result.summary.projectedTotal,
                    breakdown: result.mtdBreakdown,
                    history: result.history,
                };
                return { provider: prov, data: billingSummary, warnings: result.warning ? [result.warning] : [] };
            } catch (err: any) {
                return { provider: prov, data: null, warnings: [`GCP billing failed: ${err.message || err}`] };
            }
        }))
    );

    const data: CloudAggregateBillingSummary[] = [];
    const warnings: string[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            if (result.value.data) {
                data.push(result.value.data);
            }
            if (result.value.warnings) {
                warnings.push(...result.value.warnings);
            }
        } else {
            warnings.push(sanitizeProviderError(result.reason) || "Failed to load provider billing.");
        }
    }

    return {
        success: true,
        providers: providerSummaries as Record<CloudProvider, CloudProviderConnectionSummary>,
        data,
        warnings,
    };
}
