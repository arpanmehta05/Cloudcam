import { logger } from "../core/logger";
import { archiveVpsLogsToS3 } from "../services/vps-logs.service";

export async function runVpsLogArchiveJob(): Promise<void> {
  const result = await archiveVpsLogsToS3();
  if (result.skippedReason) {
    logger.info(`[VPS-Logs] archive skipped: ${result.skippedReason}`);
    return;
  }

  logger.info(
    `[VPS-Logs] archived ${result.archived} logs into ${result.objectsUploaded} S3 object(s)`,
  );
}
