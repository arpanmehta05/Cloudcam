import { Router } from "express";
import {
  ingestKeyDelete,
  ingestKeyRotate,
  ingestKeysGet,
  ingestKeysPost,
} from "./setup.controller";

export const setupRouter = Router();

setupRouter.get("/ingest-keys", ingestKeysGet);
setupRouter.post("/ingest-keys", ingestKeysPost);
setupRouter.post("/ingest-keys/:id/rotate", ingestKeyRotate);
setupRouter.delete("/ingest-keys/:id", ingestKeyDelete);
