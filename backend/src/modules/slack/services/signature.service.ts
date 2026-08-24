import crypto from "crypto";
import { User, decryptKey } from "../../../models/user.model";
import { logger } from "../../../core/logger";

export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  if (!signingSecret || !timestamp || !rawBody || !signature) return false;
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;
  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const calculatedSignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBaseString, "utf8")
      .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export async function verifyAndMatchSlackUser(params: {
  signature: string;
  timestamp: string;
  rawBodyText: string;
}): Promise<any> {
  const { signature, timestamp, rawBodyText } = params;
  if (!signature || !timestamp || !rawBodyText) {
    throw new Error("Missing verification headers or body");
  }

  const users = await User.find({
    "notificationSettings.slack.signingSecret": { $ne: null },
  });

  for (const user of users) {
    try {
      const secret = decryptKey(
        user.notificationSettings!.slack!.signingSecret!
      );
      if (verifySlackSignature(secret, timestamp, rawBodyText, signature)) {
        return user;
      }
    } catch (err: any) {
      logger.warn(
        `[Slack-Signature] Failed to decrypt signingSecret for user ${
          user.email || user._id
        }: ${err.message}`
      );
    }
  }

  throw new Error("Signature verification failed");
}
