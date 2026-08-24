import { SavingsRecord } from "../../../../models/action.model";
import { clamp } from "./scoring";

export interface FeedbackCalibration {
    multiplier: number;
    sampleSize: number;
    confidenceAdjustment: number;
}

export async function getFeedbackCalibrations(userId: string): Promise<Map<string, FeedbackCalibration>> {
    const rows = await SavingsRecord.aggregate<{
        _id: string;
        avgRatio: number;
        sampleSize: number;
    }>([
        {
            $match: {
                userId,
                estimatedMonthlySavings: { $gt: 0 },
                actualMonthlySavings: { $ne: null },
            },
        },
        {
            $project: {
                actionId: 1,
                ratio: {
                    $divide: ["$actualMonthlySavings", "$estimatedMonthlySavings"],
                },
            },
        },
        {
            $group: {
                _id: "$actionId",
                avgRatio: { $avg: "$ratio" },
                sampleSize: { $sum: 1 },
            },
        },
    ]);

    const map = new Map<string, FeedbackCalibration>();
    for (const row of rows) {
        const boundedRatio = clamp(Number.isFinite(row.avgRatio) ? row.avgRatio : 1, 0.6, 1.25);
        const sampleWeight = clamp(row.sampleSize / 8, 0, 1);
        const confidenceAdjustment = clamp((boundedRatio - 1) * 0.25 * sampleWeight, -0.18, 0.12);
        map.set(row._id, {
            multiplier: boundedRatio,
            sampleSize: row.sampleSize,
            confidenceAdjustment,
        });
    }

    return map;
}
