// Azure Setup Service
import { config } from "../../config/env";

function safeWorkspaceId(userId: string) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(userId)) {
        throw new Error("Invalid workspace id for Azure onboarding.");
    }
    return userId;
}

function isConfiguredSecret(secret?: string) {
    if (!secret) return false;
    const normalized = secret.trim().toLowerCase();
    return normalized !== "generate-a-secure-random-string"
        && normalized !== "change-me"
        && normalized !== "changeme"
        && normalized !== "your-secret-here";
}

export async function generateAzureSetup(
    userId: string,
    params?: {
        tenantId?: string;
        subscriptionId?: string;
        principalId?: string;
        enableLogAnalytics?: boolean;
    }
) {
    const workspaceId = safeWorkspaceId(userId);
    const webhookUrl = config.azure.webhookUrl || `${config.publicApiBaseUrl}/api/azure/save-connection`;
    const apiSecret = config.rabbittize.apiSecret || config.azure.webhookSecret;
    const webhookSecret = config.azure.webhookSecret || apiSecret;

    if (!isConfiguredSecret(apiSecret)) {
        throw new Error("Set RABBITTIZE_API_SECRET or AZURE_WEBHOOK_SECRET to a real secret before generating Azure onboarding.");
    }

    // Dynamic shell script to run in Azure Cloud Shell
    const cloudShellScript = `subscriptionId=$(az account show --query id -o tsv)
tenantId=$(az account show --query tenantId -o tsv)
spName="CloudWatcher-Integration-${workspaceId.substring(0, 8)}"
echo "Creating Azure Service Principal with Contributor role for inventory and simulation deployments..."
sp=$(az ad sp create-for-rbac --name "$spName" --role "Contributor" --scopes "/subscriptions/$subscriptionId" -o json 2>/dev/null)
if [ -z "$sp" ]; then
  echo "Error: Failed to create Service Principal. Make sure you have AD Admin permissions."
  exit 1
fi
clientId=$(echo $sp | jq -r .appId)
clientSecret=$(echo $sp | jq -r .password)
principalId=$(az ad sp show --id "$clientId" --query id -o tsv 2>/dev/null)

echo "Assigning optional monitoring, security, and cost read roles..."
for role in "Monitoring Reader" "Security Reader" "Cost Management Reader"; do
  az role assignment create --assignee "$principalId" --role "$role" --scope "/subscriptions/$subscriptionId" >/dev/null 2>&1 || echo "Warning: Could not assign $role. Your subscription may not expose this role, or your account may not have permission to assign it."
done

echo "Registering with CloudWatcher..."
curl -f -X POST \\
  -H "Content-Type: application/json" \\
  -H "x-rabbittize-secret: ${apiSecret}" \\
  -H "X-Tunnel-Skip-AntiPhishing-Page: True" \\
  -d "{\\"workspaceId\\":\\"${workspaceId}\\",\\"tenantId\\":\\"$tenantId\\",\\"subscriptionId\\":\\"$subscriptionId\\",\\"clientId\\":\\"$clientId\\",\\"clientSecret\\":\\"$clientSecret\\",\\"principalId\\":\\"$principalId\\"}" \\
  "${webhookUrl}"`;

    // Dynamic Terraform configuration
    const terraformTemplate = `# CloudWatcher Azure Integration Terraform Template
provider "azurerm" {
  features {}
  skip_provider_registration = true
}

provider "azuread" {}

data "azurerm_subscription" "current" {}

resource "azuread_application" "rabbittize" {
  display_name = "CloudWatcher-Integration-${workspaceId.substring(0, 8)}"
}

resource "azuread_service_principal" "rabbittize" {
  client_id = azuread_application.rabbittize.client_id
}

resource "azuread_service_principal_password" "rabbittize" {
  service_principal_id = azuread_service_principal.rabbittize.id
}

resource "azurerm_role_assignment" "rabbittize" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.rabbittize.object_id
}

resource "azurerm_role_assignment" "rabbittize_monitoring_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Monitoring Reader"
  principal_id         = azuread_service_principal.rabbittize.object_id
}

resource "azurerm_role_assignment" "rabbittize_security_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Security Reader"
  principal_id         = azuread_service_principal.rabbittize.object_id
}

resource "azurerm_role_assignment" "rabbittize_cost_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Cost Management Reader"
  principal_id         = azuread_service_principal.rabbittize.object_id
}

provider "http" {}

data "http" "pingback" {
  url    = "${webhookUrl}"
  method = "POST"
  request_headers = {
    "Content-Type"                  = "application/json"
    "x-rabbittize-secret"           = "${apiSecret}"
    "X-Tunnel-Skip-AntiPhishing-Page" = "True"
  }
  request_body = jsonencode({
    workspaceId      = "${workspaceId}"
    tenantId         = data.azurerm_subscription.current.tenant_id
    subscriptionId   = data.azurerm_subscription.current.subscription_id
    clientId         = azuread_application.rabbittize.client_id
    clientSecret     = azuread_service_principal_password.rabbittize.value
    principalId      = azuread_service_principal.rabbittize.object_id
  })

  depends_on = [
    azurerm_role_assignment.rabbittize,
    azurerm_role_assignment.rabbittize_monitoring_reader,
    azurerm_role_assignment.rabbittize_security_reader,
    azurerm_role_assignment.rabbittize_cost_reader
  ]
}
`;

    // Generate Deploy to Azure URL if parameters are provided
    let deployUrl = "";
    if (params?.tenantId && params?.subscriptionId && params?.principalId) {
        const templateUrl = config.azure.templateUrl || `${config.publicApiBaseUrl}/api/azure/template`;
        const baseUrl = "https://portal.azure.com/#create/Microsoft.Template/uri/";
        const encodedTemplateUrl = encodeURIComponent(templateUrl);
        const location = config.azure.defaultRegion || "centralindia";

        const urlParams = new URLSearchParams({
            workspaceId,
            tenantId: params.tenantId.trim(),
            subscriptionId: params.subscriptionId.trim(),
            principalId: params.principalId.trim(),
            webhookUrl,
            webhookSecret,
            location,
            enableLogAnalytics: params.enableLogAnalytics ? "true" : "false",
        });
        deployUrl = `${baseUrl}${encodedTemplateUrl}?${urlParams.toString()}`;
    }

    return {
        cloudShellScript,
        terraformTemplate,
        webhookUrl,
        webhookSecret,
        deployUrl,
        workspaceId,
    };
}
