import { Request, Response } from "express";
import { verifyAndMatchSlackUser, handleSlackEvent } from "../services";
import { logger } from "../../../core/logger";
import { fail } from "../../../shared/responses";

export async function slackEventsPost(req: Request, res: Response): Promise<void> {
  try {
    const { type, challenge, event } = req.body || {};

    // 1. Handle Slack URL Verification Handshake
    if (type === "url_verification") {
      res.status(200).send({ challenge });
      return;
    }

    // 2. Validate request parameters
    const timestamp = req.headers["x-slack-request-timestamp"] as string;
    const signature = req.headers["x-slack-signature"] as string;
    const rawBodyBuf = (req as any).rawBody as Buffer;

    if (!timestamp || !signature || !rawBodyBuf) {
      res.status(401).json(fail("Missing authentication headers"));
      return;
    }

    const rawBodyText = rawBodyBuf.toString("utf8");

    // 3. Match and verify signing secret
    let matchedUser;
    try {
      matchedUser = await verifyAndMatchSlackUser({
        signature,
        timestamp,
        rawBodyText,
      });
    } catch (err: any) {
      logger.warn(`[Slack-Events] Signature verification failed: ${err.message}`);
      res.status(401).json(fail("Signature verification failed"));
      return;
    }

    // Ignore bot self-messages to prevent loops
    if (event && (event.bot_id || event.subtype === "bot_message")) {
      res.status(200).send("ok");
      return;
    }

    // 4. Respond 200 OK immediately (within Slack 3s limit) and process asynchronously
    res.status(200).send("ok");

    setTimeout(async () => {
      try {
        await handleSlackEvent(event, rawBodyText, matchedUser._id.toString());
      } catch (err: any) {
        logger.error(`[Slack-Events] Asynchronous event processing failed: ${err.message}`);
      }
    }, 0);
  } catch (error: any) {
    logger.error(`[Slack-Events] Controller crashed: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json(fail(error));
    }
  }
}
