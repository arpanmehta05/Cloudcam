import { Request, Response } from "express";
import {
  getResizeMigrationJob,
  listResizeMigrationJobs,
  getAllowedResizeMigrationTransitions,
} from "../services/job.service";
import { getResizeMigrationScopeLock } from "../services/scope.service";
import {
  listAwsSourceServers,
  getAwsTargetInstanceTypes,
} from "../services/aws";
import {
  listAzureSourceServers,
  getAzureTargetInstanceTypes,
} from "../services/azure/azure-resize-migration.service";
import {
  listGcpSourceServers,
  getGcpTargetInstanceTypes,
} from "../services/gcp/gcp-resize-migration.service";

function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

export function resizeMigrationScopeGet(_req: Request, res: Response): void {
  res.json({
    success: true,
    scope: getResizeMigrationScopeLock(),
  });
}

export async function resizeMigrationJobsListGet(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const jobs = await listResizeMigrationJobs(userId);
    return res.json({ success: true, jobs });
  } catch (error: any) {
    console.error("[resizeMigrationJobsListGet] Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to list resize migration jobs",
      });
  }
}

export async function resizeMigrationJobGet(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const result = await getResizeMigrationJob(userId, String(req.params.id));
    if (!result)
      return res
        .status(404)
        .json({ success: false, error: "Resize migration job not found" });

    return res.json({
      success: true,
      job: result.job,
      tasks: result.tasks,
      allowedTransitions: getAllowedResizeMigrationTransitions(
        result.job.status,
      ),
    });
  } catch (error: any) {
    console.error("[resizeMigrationJobGet] Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load resize migration job",
      });
  }
}

export async function resizeMigrationSourcesGet(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const provider = req.query.provider as string | undefined;
    if (!provider) {
      return res
        .status(400)
        .json({ success: false, error: "provider is required" });
    }

    if (provider !== "aws" && provider !== "azure" && provider !== "gcp") {
      return res.status(400).json({
        success: false,
        error: `Provider '${provider}' is not supported. Only 'aws', 'azure' and 'gcp' are currently supported.`,
      });
    }

    const region = req.query.region as string | undefined;
    let sources: any[] = [];
    if (provider === "azure") {
      sources = await listAzureSourceServers(userId, region);
    } else if (provider === "gcp") {
      sources = await listGcpSourceServers(userId, region);
    } else {
      sources = await listAwsSourceServers(userId, region);
    }

    return res.json({
      success: true,
      sources,
    });
  } catch (error: any) {
    console.error("[resizeMigrationSourcesGet] Error:", error);
    const isNotConnected =
      error.message === "AWS_NOT_CONNECTED" ||
      error.message === "AZURE_NOT_CONNECTED" ||
      error.message === "GCP_NOT_CONNECTED";
    const status = isNotConnected ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: isNotConnected
        ? `${String(req.query.provider).toUpperCase()} integration is not connected.`
        : error.message || "Failed to list source servers",
    });
  }
}

export async function resizeMigrationTargetSizesGet(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const provider = req.query.provider as string | undefined;
    const sourceId = req.query.sourceId as string | undefined;
    const region = req.query.region as string | undefined;

    if (!provider) {
      return res
        .status(400)
        .json({ success: false, error: "provider is required" });
    }
    if (!sourceId) {
      return res
        .status(400)
        .json({ success: false, error: "sourceId is required" });
    }
    if (!region) {
      return res
        .status(400)
        .json({ success: false, error: "region is required" });
    }

    if (provider !== "aws" && provider !== "azure" && provider !== "gcp") {
      return res.status(400).json({
        success: false,
        error: `Provider '${provider}' is not supported. Only 'aws', 'azure' and 'gcp' are currently supported.`,
      });
    }

    let targetSizes: any[] = [];
    if (provider === "azure") {
      targetSizes = await getAzureTargetInstanceTypes(userId, region, sourceId);
    } else if (provider === "gcp") {
      targetSizes = await getGcpTargetInstanceTypes(userId, region, sourceId);
    } else {
      targetSizes = await getAwsTargetInstanceTypes(userId, region, sourceId);
    }

    return res.json({
      success: true,
      targetSizes,
    });
  } catch (error: any) {
    console.error("[resizeMigrationTargetSizesGet] Error:", error);
    const isNotConnected =
      error.message === "AWS_NOT_CONNECTED" ||
      error.message === "AZURE_NOT_CONNECTED" ||
      error.message === "GCP_NOT_CONNECTED";
    const status = isNotConnected ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: isNotConnected
        ? `${String(req.query.provider).toUpperCase()} integration is not connected.`
        : error.message || "Failed to retrieve target size options",
    });
  }
}

export async function resizeMigrationJobReportGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const result = await getResizeMigrationJob(userId, String(req.params.id));
    if (!result) {
      res
        .status(404)
        .json({ success: false, error: "Resize migration job not found" });
      return;
    }

    const { generateMigrationReport } =
      await import("../services/report.service");
    const pdfBuffer = await generateMigrationReport(result.job, result.tasks);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="migration-report-${result.job._id}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[resizeMigrationJobReportGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to generate report PDF",
      });
  }
}

export async function resizeMigrationJobExplainGet(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const result = await getResizeMigrationJob(userId, String(req.params.id));
    if (!result)
      return res
        .status(404)
        .json({ success: false, error: "Resize migration job not found" });

    const taskKey = String(req.params.taskKey);
    const task = result.tasks.find((t) => t.key === taskKey);
    if (!task)
      return res
        .status(404)
        .json({ success: false, error: "Task not found in job details" });

    // Check if there is already a cached explanation
    if (task.aiExplanation) {
      return res.json({
        success: true,
        explanation: task.aiExplanation,
      });
    }

    const { explainTaskFailure } =
      await import("../services/ai-explain.service");
    const explanation = await explainTaskFailure(result.job, task);

    // Cache the explanation to MongoDB
    task.aiExplanation = explanation;
    task.markModified("aiExplanation");
    await task.save();

    return res.json({
      success: true,
      explanation,
    });
  } catch (error: any) {
    console.error("[resizeMigrationJobExplainGet] Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to analyze error via Gemini",
      });
  }
}
