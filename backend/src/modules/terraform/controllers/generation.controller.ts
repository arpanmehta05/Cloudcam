// Terraform generation controller
import { Request, Response } from "express";
import {
  generateTerraformJson,
  type TfRequest,
} from "../services/generation";
import { User, decryptKey } from "../../../models/user.model";
import { ServiceSchemas } from "../../../config/terraform-schemas";

// POST /api/simulation/terraform
export async function generateTerraformHandler(req: Request, res: Response) {
  try {
    const provider = req.body?.provider || "aws";
    const { nodes, edges, region } = req.body || {};

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one node is required for Terraform generation",
      });
    }

    // Validate each node has required fields
    for (const node of nodes) {
      if (!node.id || !node.serviceId) {
        return res.status(400).json({
          success: false,
          error: "Each node must have 'id' and 'serviceId' fields",
        });
      }
      if (!ServiceSchemas[node.serviceId]) {
        return res.status(400).json({
          success: false,
          error: `Unsupported service type: ${node.serviceId}`,
        });
      }
    }

    const userId = (req as any).user?.userId;
    let githubToken: string | undefined;
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user?.githubCredentials?.accessToken) {
          githubToken = decryptKey(user.githubCredentials.accessToken);
        }
      } catch (err) {
        console.error(
          "[generateTerraformHandler] Failed to retrieve or decrypt GitHub token:",
          err,
        );
      }
    }

    const request: TfRequest = {
      nodes,
      edges: edges || [],
      region:
        region ||
        (provider === "azure"
          ? "eastus"
          : provider === "gcp"
            ? "us-central1"
            : "us-east-1"),
      provider,
      githubToken,
    };

    const result = generateTerraformJson(request);

    return res.json({
      terraformJson: result.terraformJson,
      terraformHcl: result.terraformHcl,
      resources: result.resources,
      implicitResources: result.implicitResources,
      resourceCount: result.resources.length + result.implicitResources.length,
    });
  } catch (err: any) {
    console.error("terraform generation error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to generate Terraform configuration",
    });
  }
}
