import { Request, Response } from "express";
import { generateSetupLink } from "../services/setup/setup.service";
import { generateAzureSetup } from "../../../services/azure/setup.service";
import { resolveProvider } from "../../../middleware/credentials.middleware";
import { getUserId } from "./helpers";

export async function setupPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const provider = resolveProvider(req);

    if (provider === "azure") {
      const result = await generateAzureSetup(userId);
      return res.json({ success: true, ...result });
    }

    const { enableAiObservability, enableLogForwarding } = req.body || {};
    const result = await generateSetupLink(userId, {
      enableAiObservability,
      enableLogForwarding,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error creating setup link:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create setup link" });
  }
}
