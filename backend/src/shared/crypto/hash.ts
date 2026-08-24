import crypto from "crypto";

/**
 * Creates a unique short MD5 hash of a cloud resource ID.
 * This is necessary because Slack static select option values are limited to 75 characters,
 * whereas Azure and GCP resource paths can easily exceed 100+ characters.
 */
export function hashResourceId(id: string): string {
  return crypto.createHash("md5").update(id).digest("hex").substring(0, 16);
}
