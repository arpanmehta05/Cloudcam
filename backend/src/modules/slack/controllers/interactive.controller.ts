import { Request, Response } from "express";
import { handleInteractiveCallback } from "../services";
import { logger } from "../../../core/logger";
import { fail } from "../../../shared/responses";

export async function slackInteractivePost(req: Request, res: Response): Promise<void> {
  try {
    const rawBodyText = ((req as any).rawBody as Buffer)?.toString("utf8");
    const timestamp = req.headers["x-slack-request-timestamp"] as string;
    const signature = req.headers["x-slack-signature"] as string;

    if (!timestamp || !signature || !rawBodyText) {
      res.status(401).json(fail("Missing verification headers"));
      return;
    }

    const payloadStr = req.body.payload;
    if (!payloadStr) {
      res.status(400).json(fail("Missing payload parameter"));
      return;
    }

    // Immediate 200 OK response (prevent Slack 3s timeout retry)
    res.status(200).send("");

    // Process asynchronously
    setTimeout(async () => {
      try {
        await handleInteractiveCallback({
          payloadStr,
          signature,
          timestamp,
          rawBodyText,
        });
      } catch (err: any) {
        logger.error(`[Slack-Interactive] Async processing error: ${err.message}`);
      }
    }, 0);
  } catch (err: any) {
    logger.error(`[Slack-Interactive] Controller crashed: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json(fail(err));
    }
  }
}
