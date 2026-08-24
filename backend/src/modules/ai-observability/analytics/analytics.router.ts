import { Router } from "express";
import { anomaliesGet, forecastGet, summaryDailyGet, summaryWeeklyGet } from "./analytics.controller";

export const analyticsRouter = Router();

analyticsRouter.get("/forecast", forecastGet);
analyticsRouter.get("/summary/daily", summaryDailyGet);
analyticsRouter.get("/summary/weekly", summaryWeeklyGet);
analyticsRouter.get("/anomalies", anomaliesGet);
