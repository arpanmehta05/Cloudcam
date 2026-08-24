import { Request, Response } from "express";
import {
  createResizeMigrationJob,
  deleteResizeMigrationJob,
  getAllowedResizeMigrationTransitions,
  transitionResizeMigrationJob,
  resumeResizeMigrationJob,
} from "../services/job.service";
import { ResizeMigrationJobStatus } from "../../../types/resize-migration.types";
import { ResizeMigrationJobModel } from "../models/resize-migration.model";

function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

export async function resizeMigrationJobDelete(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const deleted = await deleteResizeMigrationJob(
      userId,
      String(req.params.id),
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Resize migration job not found" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[resizeMigrationJobDelete] Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to delete resize migration job",
      });
  }
}

export async function resizeMigrationJobCreatePost(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const result = await createResizeMigrationJob(userId, req.body || {});
    return res.status(201).json({
      success: true,
      job: result.job,
      tasks: result.tasks,
      allowedTransitions: getAllowedResizeMigrationTransitions(
        result.job.status,
      ),
    });
  } catch (error: any) {
    console.error("[resizeMigrationJobCreatePost] Error:", error);
    return res
      .status(400)
      .json({
        success: false,
        error: error.message || "Failed to create resize migration job",
      });
  }
}

export async function resizeMigrationJobTransitionPost(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const nextStatus = req.body?.status as ResizeMigrationJobStatus | undefined;
    if (!nextStatus) {
      return res
        .status(400)
        .json({ success: false, error: "status is required" });
    }

    // Support merging metadata on status transition
    if (req.body?.metadata) {
      const jobDoc = await ResizeMigrationJobModel.findOne({
        _id: req.params.id,
        userId,
      });
      if (jobDoc) {
        jobDoc.metadata = {
          ...jobDoc.metadata,
          ...req.body.metadata,
        };
        jobDoc.markModified("metadata");
        await jobDoc.save();
      }
    }

    const job = await transitionResizeMigrationJob(
      userId,
      String(req.params.id),
      nextStatus,
    );
    if (!job)
      return res
        .status(404)
        .json({ success: false, error: "Resize migration job not found" });

    return res.json({
      success: true,
      job,
      allowedTransitions: getAllowedResizeMigrationTransitions(job.status),
    });
  } catch (error: any) {
    console.error("[resizeMigrationJobTransitionPost] Error:", error);
    return res
      .status(400)
      .json({
        success: false,
        error: error.message || "Failed to transition resize migration job",
      });
  }
}

export async function resizeMigrationJobConfirmClassificationPost(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const jobId = String(req.params.id);
    const { classification, signals, confidence } = req.body || {};

    if (!classification) {
      return res
        .status(400)
        .json({ success: false, error: "classification is required" });
    }

    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
      return res
        .status(404)
        .json({ success: false, error: "Resize migration job not found" });
    }

    // Initialize metadata if not present
    if (!job.metadata) {
      job.metadata = {};
    }

    job.metadata.classification = {
      classification,
      signals: signals || [],
      confidence: confidence || "Medium",
      confirmedAt: new Date(),
      confirmedBy: userId,
      confirmed: true,
    };

    job.markModified("metadata");
    await job.save();

    job.logs.push({
      level: "info",
      message: `User confirmed workload classification: ${classification}.`,
      timestamp: new Date(),
    });
    await job.save();

    return res.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("[confirmClassification] Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to confirm workload classification",
      });
  }
}

export async function resizeMigrationJobConfigureAccessPost(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const jobId = String(req.params.id);
    const { accessMode, accessConfig } = req.body || {};

    if (!accessMode) {
      return res
        .status(400)
        .json({ success: false, error: "accessMode is required" });
    }

    if (accessMode !== "cloud_only" && accessMode !== "deep_inspection") {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid accessMode. Must be 'cloud_only' or 'deep_inspection'.",
        });
    }

    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
      return res
        .status(404)
        .json({ success: false, error: "Resize migration job not found" });
    }

    if (
      job.status !== "draft" &&
      job.status !== "preflight" &&
      job.status !== "failed"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Access mode can only be configured in draft, preflight, or failed status.",
        });
    }

    job.accessMode = accessMode;
    if (accessMode === "deep_inspection") {
      if (!accessConfig || !accessConfig.method) {
        return res
          .status(400)
          .json({
            success: false,
            error: "accessConfig.method is required for deep_inspection",
          });
      }
      job.accessConfig = {
        method: accessConfig.method,
        username: accessConfig.username || "ubuntu",
        privateKey: accessConfig.privateKey || "",
        port: accessConfig.port || 22,
      };
    } else {
      job.accessConfig = undefined;
    }

    job.markModified("accessConfig");
    await job.save();

    const methodStr =
      accessMode === "deep_inspection" ? ` via ${accessConfig.method}` : "";
    job.logs.push({
      level: "info",
      message: `User configured access mode to: ${accessMode}${methodStr}.`,
      timestamp: new Date(),
    });
    await job.save();

    return res.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("[configureAccess] Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to configure access mode",
      });
  }
}

export async function resizeMigrationJobResumePost(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const { job, tasks } = await resumeResizeMigrationJob(
      userId,
      String(req.params.id),
    );
    return res.json({
      success: true,
      job,
      tasks,
      allowedTransitions: getAllowedResizeMigrationTransitions(job.status),
    });
  } catch (error: any) {
    console.error("[resizeMigrationJobResumePost] Error:", error);
    return res
      .status(400)
      .json({
        success: false,
        error: error.message || "Failed to resume resize migration job",
      });
  }
}
