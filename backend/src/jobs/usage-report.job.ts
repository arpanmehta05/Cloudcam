import { logger } from "../core/logger";
import { sendDueReports } from "../services/usage-report.service";

export async function runUsageReportJob() {
  const result = await sendDueReports();
  logger.info(`[Usage-Report] scanned=${result.scanned} sent=${result.sent}`);
}
