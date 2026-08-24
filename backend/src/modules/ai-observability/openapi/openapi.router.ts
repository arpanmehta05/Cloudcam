import { Router } from "express";
import { openapiGet } from "./openapi.controller";

export const openapiRouter = Router();

openapiRouter.get("/openapi.json", openapiGet);
