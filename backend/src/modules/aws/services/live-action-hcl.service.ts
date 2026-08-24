import { LambdaClient, GetFunctionCommand } from "@aws-sdk/client-lambda";
import { getCredentials } from "../../../store/workspace-credentials";
import { getClientConfig } from "../providers/client-factory";
import * as templates from "./live-action-templates";

export async function generateLiveActionHcl(
  userId: string,
  resourceId: string,
  action: string,
  service: string,
  region: string,
  body: any
): Promise<string> {
  const targetRegion = region === "all" ? "us-east-1" : region;

  if (service === "ec2") {
    return templates.getEc2Hcl(action, targetRegion, resourceId);
  }

  if (service === "rds") {
    const isSnap = body.isSnapshot === true;
    return templates.getRdsHcl(action, targetRegion, resourceId, isSnap);
  }

  if (service === "s3") {
    return templates.getS3Hcl(action, targetRegion, resourceId);
  }

  if (service === "dynamodb") {
    return templates.getDynamoDbHcl(action, targetRegion, resourceId);
  }

  if (service === "lambda") {
    if (action === "delete") {
      return templates.getLambdaDeleteHcl(targetRegion, resourceId);
    }
    if (action === "update-code") {
      if (!body.code) {
        throw new Error("Missing code for update-code action");
      }

      const creds = await getCredentials(userId, "aws");
      if (!creds?.roleArn || !creds?.externalId) {
        throw new Error("AWS credentials not connected");
      }
      const clientConfig = await getClientConfig(userId, targetRegion, creds.roleArn, creds.externalId);
      const client = new LambdaClient(clientConfig);

      let runtime = "nodejs20.x";
      let handler = "index.handler";
      try {
        const functionName = (Array.isArray(resourceId) ? resourceId[0] : resourceId) as string;
        const funcData = await client.send(new GetFunctionCommand({ FunctionName: functionName }));
        runtime = funcData.Configuration?.Runtime || "nodejs20.x";
        handler = funcData.Configuration?.Handler || "index.handler";
      } catch (err: any) {
        console.warn("[generateLiveActionHcl] Failed to fetch lambda configuration, using defaults:", err.message);
      }

      const handlerParts = handler.split(".");
      const handlerBase = handlerParts[0] || "index";
      const fileName = handlerBase + (runtime.startsWith("python") ? ".py" : ".js");
      const escapedCode = JSON.stringify(body.code);

      return templates.getLambdaUpdateHcl(targetRegion, resourceId, escapedCode, fileName);
    }
  }

  if (service === "eip") {
    return templates.getEipHcl(action, targetRegion, resourceId, body);
  }

  if (service === "sg") {
    return templates.getSgHcl(action, targetRegion, resourceId);
  }

  if (service === "tg") {
    return templates.getTgHcl(action, targetRegion, resourceId);
  }

  if (service === "ecr") {
    return templates.getEcrHcl(action, targetRegion, resourceId);
  }

  if (service === "ecr_image") {
    return templates.getEcrImageHcl(action, targetRegion, resourceId, body);
  }

  if (service === "apigateway") {
    return templates.getApiGatewayHcl(action, targetRegion, resourceId, body);
  }

  if (service === "cloudfront") {
    return templates.getCloudFrontHcl(action, targetRegion, resourceId);
  }

  throw new Error("Action/Service combination not supported via Terraform yet.");
}
