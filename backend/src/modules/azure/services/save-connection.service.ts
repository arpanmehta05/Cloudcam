// Azure Save-Connection Service — canonical location: modules/azure/services/save-connection.service.ts
import axios from "axios";
import { saveAzureConnection, getCredentials } from "../../../store/workspace-credentials";
import { getAzureAccessToken } from "../providers/client-factory";

export interface AzureCredentialsInput {
    tenantId: string;
    subscriptionId: string;
    billingAccountId?: string;
    clientId?: string;
    clientSecret?: string;
    principalId?: string;
}

export interface AzureValidationResult {
    valid: boolean;
    error?: string;
    code?: string;
    isVmContributor?: boolean;
}

function azureErrorMessage(error: any): string {
    return error?.response?.data?.error?.message
        || error?.response?.data?.error_description
        || error?.response?.data?.message
        || error?.message
        || "Unknown Azure API error";
}

export async function validateAzureCredentialsDetailed(creds: AzureCredentialsInput): Promise<AzureValidationResult> {
    try {
        const { tenantId, clientId, clientSecret, subscriptionId } = creds;

        // If client credentials are not provided, we cannot validate with Microsoft API but we allow saving.
        if (!clientId || !clientSecret) {
            return { valid: true };
        }

        // 1. Exchange credentials for an access token via Microsoft OAuth
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", clientId);
        params.append("client_secret", clientSecret);
        params.append("scope", "https://management.azure.com/.default");

        const tokenRes = await axios.post(tokenUrl, params, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 10000,
        });

        const accessToken = tokenRes.data.access_token;
        if (!accessToken) {
            console.error("[validateAzureCredentials] OAuth failed: no access token returned");
            return {
                valid: false,
                code: "azure_oauth_no_token",
                error: "Azure authentication succeeded but did not return an access token.",
            };
        }

        // 2. Validate read access on the subscription
        const subUrl = `https://management.azure.com/subscriptions/${subscriptionId}?api-version=2020-01-01`;
        const subRes = await axios.get(subUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            timeout: 10000,
        });

        return { valid: subRes.status === 200 };
    } catch (error: any) {
        const status = error?.response?.status;
        const message = azureErrorMessage(error);
        console.error(
            "[validateAzureCredentials] Validation failed:",
            error?.response?.data || error.message
        );

        if (status === 401 || error?.response?.data?.error === "invalid_client") {
            return {
                valid: false,
                code: "azure_invalid_client_credentials",
                error: `Azure authentication failed. Use the client secret Value, not the Secret ID, and verify the tenant/client IDs. Azure said: ${message}`,
            };
        }

        if (status === 403) {
            return {
                valid: false,
                code: "azure_subscription_forbidden",
                error: `Azure authenticated the app, but this service principal cannot read subscription ${creds.subscriptionId}. Assign the app at least Reader on the subscription, plus Monitoring Reader, Security Reader, and Cost Management Reader for full data. Azure said: ${message}`,
            };
        }

        if (status === 404) {
            return {
                valid: false,
                code: "azure_subscription_not_found",
                error: `Azure authenticated the app, but subscription ${creds.subscriptionId} was not found for this tenant or principal. Check the subscription ID and role assignment scope. Azure said: ${message}`,
            };
        }

        return {
            valid: false,
            code: "azure_validation_failed",
            error: `Invalid Azure credentials or insufficient subscription access permissions. Azure said: ${message}`,
        };
    }
}

export async function validateAzureCredentials(creds: AzureCredentialsInput): Promise<boolean> {
    const result = await validateAzureCredentialsDetailed(creds);
    return result.valid;
}

function actionAllowed(actions: string[], action: string): boolean {
    const normalized = action.toLowerCase();
    return actions.some((item) => {
        const allowed = item.toLowerCase();
        if (allowed === "*" || allowed === normalized) return true;
        if (allowed.endsWith("/*")) {
            return normalized.startsWith(allowed.slice(0, -1));
        }
        return false;
    });
}

export async function validateAzureDeploymentPermissions(
    creds: Required<Pick<AzureCredentialsInput, "tenantId" | "subscriptionId" | "clientId" | "clientSecret">>,
    resourceGroupName?: string
): Promise<AzureValidationResult> {
    try {
        const token = await getAzureAccessToken(creds.tenantId, creds.clientId, creds.clientSecret);
        const scope = resourceGroupName
            ? `/subscriptions/${creds.subscriptionId}/resourceGroups/${encodeURIComponent(resourceGroupName)}`
            : `/subscriptions/${creds.subscriptionId}`;
        const url = `https://management.azure.com${scope}/providers/Microsoft.Authorization/permissions?api-version=2022-04-01`;
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
        });

        const permissionRows = Array.isArray(res.data?.value) ? res.data.value : [];
        const actions = permissionRows.flatMap((row: any) => Array.isArray(row.actions) ? row.actions : []);
        const notActions = permissionRows.flatMap((row: any) => Array.isArray(row.notActions) ? row.notActions : []);
        const requiredActions = [
            "Microsoft.Network/virtualNetworks/write",
            "Microsoft.Network/networkSecurityGroups/write",
            "Microsoft.Network/publicIPAddresses/write",
            "Microsoft.Network/networkInterfaces/write",
            "Microsoft.Compute/virtualMachines/write",
        ];

        const missing = requiredActions.filter((action) => actionAllowed(notActions, action) || !actionAllowed(actions, action));
        if (missing.length > 0) {
            const hasVmWrite = !missing.includes("Microsoft.Compute/virtualMachines/write");
            const hasNicWrite = !missing.includes("Microsoft.Network/networkInterfaces/write");
            const onlyMissingNetworkResources = missing.every((action) =>
                action === "Microsoft.Network/virtualNetworks/write" ||
                action === "Microsoft.Network/networkSecurityGroups/write" ||
                action === "Microsoft.Network/publicIPAddresses/write"
            );

            if (hasVmWrite && hasNicWrite && onlyMissingNetworkResources) {
                console.log("[validateAzureDeploymentPermissions] User has Virtual Machine Contributor permissions. Proceeding with deployment.");
                return { valid: true, isVmContributor: true };
            }

            return {
                valid: false,
                code: "azure_deployment_permissions_missing",
                error: `Azure credentials are connected for inventory, but simulation deployments need Contributor or equivalent write permissions${resourceGroupName ? ` on resource group ${resourceGroupName}` : " on the subscription"}. Missing: ${missing.join(", ")}.`,
            };
        }

        return { valid: true };
    } catch (error: any) {
        const message = azureErrorMessage(error);
        return {
            valid: false,
            code: "azure_deployment_permission_check_failed",
            error: `Could not verify Azure simulation deployment permissions. Assign Contributor on ${resourceGroupName ? `resource group ${resourceGroupName}` : `subscription ${creds.subscriptionId}`} and retry. Azure said: ${message}`,
        };
    }
}

export async function saveAzureConnectionService(userId: string, creds: AzureCredentialsInput) {
    // Validate credentials against Microsoft APIs
    const validation = await validateAzureCredentialsDetailed(creds);
    if (!validation.valid) {
        throw new Error(validation.error || "Invalid Azure credentials or insufficient subscription access permissions.");
    }

    // Save configuration parameters to store
    await saveAzureConnection(userId, creds);

    const saved = await getCredentials(userId, "azure");

    console.log(`\n======================================================`);
    console.log(`SUCCESS! Azure Integration complete for user: ${userId}`);
    console.log(`TenantId: ${creds.tenantId}`);
    console.log(`SubscriptionId: ${creds.subscriptionId}`);
    if (creds.clientId) console.log(`ClientId: ${creds.clientId}`);
    if (creds.principalId) console.log(`PrincipalId: ${creds.principalId}`);
    console.log(`======================================================\n`);

    return {
        success: true,
        message: "Azure connection saved successfully",
        connection: {
            connected: true,
            provider: "azure",
            tenantId: saved?.tenantId,
            subscriptionId: saved?.subscriptionId,
            billingAccountId: saved?.billingAccountId,
            clientId: saved?.clientId,
            connectedAt: saved?.connectedAt,
        }
    };
}

export async function discoverAzureVnetAndSubnet(
    creds: Required<Pick<AzureCredentialsInput, "tenantId" | "subscriptionId" | "clientId" | "clientSecret">>,
    resourceGroupName: string
): Promise<{ vnetName?: string; subnetName?: string }> {
    try {
        const token = await getAzureAccessToken(creds.tenantId, creds.clientId, creds.clientSecret);
        const url = "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01";
        const payload = {
            subscriptions: [creds.subscriptionId],
            query: `Resources | where type =~ 'microsoft.network/virtualnetworks' and resourceGroup =~ '${resourceGroupName}' | project name, properties`,
            options: {
                resultFormat: "objectArray",
            },
        };

        const res = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            timeout: 10000,
        });

        const vnets = res.data?.data || [];
        if (vnets.length > 0) {
            const vnet = vnets[0];
            const subnets = vnet.properties?.subnets || [];
            const subnetName = subnets.length > 0 ? subnets[0].name : "default";
            return {
                vnetName: vnet.name,
                subnetName: subnetName
            };
        }
    } catch (err) {
        console.error("[azure] Failed to discover existing VNet/Subnet:", err);
    }
    return {};
}
