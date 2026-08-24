// Azure Live Action Controller — canonical location: modules/azure/controllers/live-action.controller.ts
import { Request, Response } from "express";
import { createSession } from "../../../store/deployment-store";
import { randomUUID } from "crypto";

export async function azureLiveActionPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const resourceIdRaw = req.params.id;
    const resourceId = (
      Array.isArray(resourceIdRaw) ? resourceIdRaw[0] : resourceIdRaw
    ) as string;
    if (!resourceId) {
      return res.status(400).json({ success: false, error: "Missing resource ID" });
    }
    let { action, service, region } = req.body;

    if (!action || !service || !region) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (region === "all") {
      region = "eastus";
    }

    const formattedResourceId = resourceId.startsWith("/")
      ? resourceId
      : `/${resourceId}`;

    let method = "POST";
    let url = "";

    if (service === "azure_vm") {
      if (action === "start") {
        method = "POST";
        url = `https://management.azure.com${formattedResourceId}/start?api-version=2023-09-01`;
      } else if (action === "stop") {
        method = "POST";
        url = `https://management.azure.com${formattedResourceId}/deallocate?api-version=2023-09-01`;
      } else if (action === "restart") {
        method = "POST";
        url = `https://management.azure.com${formattedResourceId}/restart?api-version=2023-09-01`;
      } else if (action === "terminate" || action === "delete") {
        method = "DELETE";
        url = `https://management.azure.com${formattedResourceId}?api-version=2023-09-01`;
      } else {
        return res.status(400).json({ success: false, error: `Action ${action} not supported for VM` });
      }
    } else if (service === "azure_storage" && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2023-01-01`;
    } else if (service === "azure_sql" && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2021-11-01`;
    } else if (service === "azure_function" && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2022-03-01`;
    } else if (service === "azure_vnet" && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2023-09-01`;
    } else if ((service === "azure_acr" || service === "ecr") && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2023-07-01`;
    } else if ((service === "azure_cosmosdb" || service === "dynamodb") && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2023-04-15`;
    } else if ((service === "azure_apimanagement" || service === "apigateway") && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2022-08-01`;
    } else if ((service === "azure_aks" || service === "eks" || service === "ecs") && action === "delete") {
      method = "DELETE";
      url = `https://management.azure.com${formattedResourceId}?api-version=2023-08-01`;
    } else {
      return res.status(400).json({ success: false, error: `Action/Service combination (${action}/${service}) not supported.` });
    }

    const hcl = `
resource "null_resource" "azure_action" {
  provisioner "local-exec" {
    command = <<EOF
TOKEN_RESP=$(curl -s -X POST -d "grant_type=client_credentials&client_id=$ARM_CLIENT_ID&client_secret=$ARM_CLIENT_SECRET&resource=https://management.azure.com/" https://login.microsoftonline.com/$ARM_TENANT_ID/oauth2/token)
TOKEN=$(echo $TOKEN_RESP | jq -r '.access_token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to retrieve Azure token"
  exit 1
fi

echo "Executing Azure API request: ${method} ${url}"
STATUS_CODE=$(curl -s -o response.json -w "%%{http_code}" -X ${method} -H "Authorization: Bearer $TOKEN" -H "Content-Length: 0" "${url}")
cat response.json
if [ "$STATUS_CODE" -lt 200 ] || [ "$STATUS_CODE" -ge 300 ]; then
  echo "Azure API request failed with status code $STATUS_CODE"
  exit 1
fi
EOF
  }
}
`;

    const deploymentId = `live-${randomUUID()}`;
    await createSession(deploymentId, userId, [], [], region, `Live Action: ${action} ${service} ${resourceId}`, undefined, hcl);

    res.json({ success: true, deploymentId });
  } catch (error: any) {
    console.error("[azureLiveActionPost]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
