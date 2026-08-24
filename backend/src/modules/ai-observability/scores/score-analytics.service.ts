import { HumanFeedback } from "../../../models/human-feedback.model";
import type { FeedbackScope } from "../services/feedback.service";

export async function getScoreAnalytics(scope: FeedbackScope) {
  const match = { userId: scope.userId, scoreConfigId: { $nin: [null, ""] } };
  const [distributions, trends] = await Promise.all([
    HumanFeedback.aggregate([
      { $match: match },
      {
        $group: {
          _id: { scoreConfigId: "$scoreConfigId", value: "$stringValue" },
          count: { $sum: 1 },
          avgScore: { $avg: "$score" },
        },
      },
      { $sort: { "_id.scoreConfigId": 1, count: -1 } },
    ]),
    HumanFeedback.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            scoreConfigId: "$scoreConfigId",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          count: { $sum: 1 },
          avgScore: { $avg: "$score" },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]),
  ]);
  return { distributions, trends };
}

export async function getScoreComparison(scope: FeedbackScope) {
  const rows = await HumanFeedback.aggregate([
    { $match: { userId: scope.userId, scoreConfigId: { $nin: [null, ""] }, traceId: { $nin: [null, ""] } } },
    {
      $group: {
        _id: "$traceId",
        scores: { $push: { scoreConfigId: "$scoreConfigId", score: "$score", value: "$stringValue" } },
      },
    },
    { $limit: 500 },
  ]);
  return { traces: rows };
}
