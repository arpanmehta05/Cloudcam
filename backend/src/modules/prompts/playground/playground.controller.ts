import crypto from "crypto";
import { Request, Response } from "express";

import {
  buildPlaygroundErrorResponse,
  logPlaygroundError,
} from "./playground-error-response";
import { runPlaygroundRequest } from "../services/playground/prompt-playground.service";
import { PLAYGROUND_REQUEST_TIMEOUT_MS } from "../services/playground/playground-utils";

export async function runPlayground(req: Request, res: Response) {
  const startTime = Date.now();
  const playgroundRequestId = crypto.randomUUID();
  req.setTimeout(PLAYGROUND_REQUEST_TIMEOUT_MS);
  res.setTimeout(PLAYGROUND_REQUEST_TIMEOUT_MS);

  try {
    const userId = (req as any).user.userId;
    const result = await runPlaygroundRequest({
      userId,
      body: req.body,
      requestId: playgroundRequestId,
      startTime,
    });

    return result.status
      ? res.status(result.status).json(result.body)
      : res.json(result.body);
  } catch (error: any) {
    logPlaygroundError(playgroundRequestId, req.body, error);
    const response = buildPlaygroundErrorResponse(
      playgroundRequestId,
      req.body,
      error,
    );
    return res.status(response.status).json(response.body);
  }
}
