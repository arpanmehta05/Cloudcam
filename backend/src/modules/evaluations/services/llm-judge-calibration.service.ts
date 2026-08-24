export interface JudgeCalibrationSample {
  judgeScore: number;
  humanScore: number;
}

export interface JudgeCalibrationConfig {
  passThreshold?: number;
  minSampleSize?: number;
  maxMeanAbsoluteError?: number;
  maxBias?: number;
  minAgreementRate?: number;
}

export interface JudgeCalibrationResult {
  sampleCount: number;
  calibrated: boolean;
  agreementRate: number;
  meanAbsoluteError: number;
  bias: number;
  pearsonCorrelation: number | null;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  recommendations: string[];
}

function finiteScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number) {
  return Number(value.toFixed(4));
}

function correlation(samples: JudgeCalibrationSample[]) {
  if (samples.length < 2) return null;
  const judgeMean = samples.reduce((sum, item) => sum + item.judgeScore, 0) / samples.length;
  const humanMean = samples.reduce((sum, item) => sum + item.humanScore, 0) / samples.length;
  const numerator = samples.reduce((sum, item) => sum + (item.judgeScore - judgeMean) * (item.humanScore - humanMean), 0);
  const judgeVariance = samples.reduce((sum, item) => sum + (item.judgeScore - judgeMean) ** 2, 0);
  const humanVariance = samples.reduce((sum, item) => sum + (item.humanScore - humanMean) ** 2, 0);
  const denominator = Math.sqrt(judgeVariance * humanVariance);
  return denominator === 0 ? null : round(numerator / denominator);
}

export function analyzeJudgeCalibration(
  rawSamples: JudgeCalibrationSample[],
  config: JudgeCalibrationConfig = {},
): JudgeCalibrationResult {
  const passThreshold = config.passThreshold ?? 70;
  const minSampleSize = config.minSampleSize ?? 5;
  const maxMeanAbsoluteError = config.maxMeanAbsoluteError ?? 10;
  const maxBias = config.maxBias ?? 5;
  const minAgreementRate = config.minAgreementRate ?? 0.8;
  const samples = rawSamples.filter((sample) => finiteScore(sample.judgeScore) && finiteScore(sample.humanScore));

  const diffs = samples.map((sample) => sample.judgeScore - sample.humanScore);
  const agreementCount = samples.filter((sample) => (sample.judgeScore >= passThreshold) === (sample.humanScore >= passThreshold)).length;
  const meanAbsoluteError = samples.length ? diffs.reduce((sum, diff) => sum + Math.abs(diff), 0) / samples.length : 0;
  const bias = samples.length ? diffs.reduce((sum, diff) => sum + diff, 0) / samples.length : 0;
  const agreementRate = samples.length ? agreementCount / samples.length : 0;
  const checks = [
    { name: "min_sample_size", passed: samples.length >= minSampleSize, detail: `${samples.length}/${minSampleSize} labelled samples` },
    { name: "max_mean_absolute_error", passed: meanAbsoluteError <= maxMeanAbsoluteError, detail: `MAE ${round(meanAbsoluteError)} <= ${maxMeanAbsoluteError}` },
    { name: "max_bias", passed: Math.abs(bias) <= maxBias, detail: `bias ${round(bias)} within +/-${maxBias}` },
    { name: "min_agreement_rate", passed: agreementRate >= minAgreementRate, detail: `agreement ${(agreementRate * 100).toFixed(1)}% >= ${(minAgreementRate * 100).toFixed(1)}%` },
  ];
  const recommendations: string[] = [];
  if (!checks[0].passed) recommendations.push("Collect more human-labelled calibration samples before enabling this judge broadly.");
  if (!checks[1].passed) recommendations.push("Tighten the rubric or examples; judge scores diverge too far from human labels.");
  if (!checks[2].passed) recommendations.push(bias > 0 ? "Judge is over-scoring relative to humans; lower thresholds or revise rubric strictness." : "Judge is under-scoring relative to humans; add positive examples or adjust rubric wording.");
  if (!checks[3].passed) recommendations.push("Review pass/fail threshold alignment against human decisions.");
  if (recommendations.length === 0) recommendations.push("Judge calibration is within guardrails for controlled rollout.");

  return {
    sampleCount: samples.length,
    calibrated: checks.every((check) => check.passed),
    agreementRate: round(agreementRate),
    meanAbsoluteError: round(meanAbsoluteError),
    bias: round(bias),
    pearsonCorrelation: correlation(samples),
    checks,
    recommendations,
  };
}
