"use client";

import React, { useState } from "react";
import {
  X,
  Bell,
  AlertTriangle,
  Shield,
  Info,
  Trash2,
  Loader2,
} from "@/icons";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { getRegionSelectOptions } from "@/lib/regions";

interface CreateAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMetric?: {
    name: string;
    namespace: string;
    metricName: string;
  };
}

const REGIONS = getRegionSelectOptions("aws");

const COMPARISON_OPERATORS = [
  { value: "GreaterThanThreshold", label: "Greater than" },
  { value: "GreaterThanOrEqualToThreshold", label: "Greater than or equal to" },
  { value: "LessThanThreshold", label: "Less than" },
  { value: "LessThanOrEqualToThreshold", label: "Less than or equal to" },
];

const STATISTICS = [
  { value: "Average", label: "Average" },
  { value: "Sum", label: "Sum" },
  { value: "Maximum", label: "Maximum" },
  { value: "Minimum", label: "Minimum" },
  { value: "SampleCount", label: "Sample Count" },
];

export function CreateAlarmModal({
  isOpen,
  onClose,
  onSuccess,
  initialMetric,
}: CreateAlarmModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<
    { Name: string; Value: string }[]
  >([{ Name: "", Value: "" }]);

  const [form, setForm] = useState({
    name: "",
    region: "us-east-1",
    namespace: initialMetric?.namespace || "AWS/EC2",
    metricName: initialMetric?.metricName || "CPUUtilization",
    threshold: 80,
    comparison: "GreaterThanThreshold",
    period: 300,
    evaluationPeriods: 1,
    statistic: "Average",
  });

  React.useEffect(() => {
    if (initialMetric) {
      setForm((prev) => ({
        ...prev,
        namespace: initialMetric.namespace,
        metricName: initialMetric.metricName,
        name: `${initialMetric.name}-Alarm`,
      }));
      // Default dimension for EC2/Lambda if we can guess name (placeholder)
      if (initialMetric.namespace === "AWS/EC2") {
        setDimensions([{ Name: "InstanceId", Value: "" }]);
      } else if (initialMetric.namespace === "AWS/Lambda") {
        setDimensions([{ Name: "FunctionName", Value: "" }]);
      }
    }
  }, [initialMetric]);

  if (!isOpen) return null;

  const addDimension = () =>
    setDimensions([...dimensions, { Name: "", Value: "" }]);
  const removeDimension = (index: number) =>
    setDimensions(dimensions.filter((_, i) => i !== index));
  const updateDimension = (
    index: number,
    key: "Name" | "Value",
    val: string,
  ) => {
    const next = [...dimensions];
    next[index][key] = val;
    setDimensions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Filter out empty dimensions
    const finalDimensions = dimensions.filter((d) => d.Name && d.Value);

    try {
      const res = await authFetch("/api/aws/alarms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: form.region,
          alarm: {
            name: form.name,
            metric: form.metricName,
            namespace: form.namespace,
            threshold: form.threshold,
            comparison: form.comparison,
            period: form.period,
            evaluationPeriods: form.evaluationPeriods,
            statistic: form.statistic,
            dimensions: finalDimensions,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Failed to create alarm");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Create CloudWatch Alarm
              </h3>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-tight">
                Direct AWS Provisioning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Alarm Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Alarm Name
              </label>
              <input
                required
                type="text"
                placeholder="e.g. EC2-High-CPU-Alert"
                className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Region */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Region
                </label>
                <select
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white text-sm font-medium appearance-none cursor-pointer"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                >
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Statistic */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Statistic
                </label>
                <select
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white text-sm font-medium appearance-none cursor-pointer"
                  value={form.statistic}
                  onChange={(e) =>
                    setForm({ ...form, statistic: e.target.value })
                  }
                >
                  {STATISTICS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dimensions Section */}
            <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Dimensions (Required)
                </label>
                <button
                  type="button"
                  onClick={addDimension}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline uppercase tracking-tighter"
                >
                  + Add Dimension
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Specify the resource (e.g. InstanceId = i-abc123456)
              </p>

              <div className="space-y-2">
                {dimensions.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      placeholder="Name (e.g. InstanceId)"
                      className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:border-blue-500"
                      value={d.Name}
                      onChange={(e) =>
                        updateDimension(i, "Name", e.target.value)
                      }
                    />
                    <input
                      placeholder="Value"
                      className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:border-blue-500"
                      value={d.Value}
                      onChange={(e) =>
                        updateDimension(i, "Value", e.target.value)
                      }
                    />
                    {dimensions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDimension(i)}
                        className="p-2 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              {/* Namespace */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Namespace
                </label>
                <input
                  required
                  type="text"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm font-medium"
                  value={form.namespace}
                  onChange={(e) =>
                    setForm({ ...form, namespace: e.target.value })
                  }
                />
              </div>

              {/* Metric Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Metric Name
                </label>
                <input
                  required
                  type="text"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm font-medium"
                  value={form.metricName}
                  onChange={(e) =>
                    setForm({ ...form, metricName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {/* Comparison */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Condition
                </label>
                <select
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white text-sm font-medium"
                  value={form.comparison}
                  onChange={(e) =>
                    setForm({ ...form, comparison: e.target.value })
                  }
                >
                  {COMPARISON_OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Threshold Value
                </label>
                <input
                  required
                  type="number"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm font-bold"
                  value={form.threshold}
                  onChange={(e) =>
                    setForm({ ...form, threshold: parseFloat(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Period */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Period (Seconds)
                </label>
                <select
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white text-sm font-medium"
                  value={form.period}
                  onChange={(e) =>
                    setForm({ ...form, period: parseInt(e.target.value) })
                  }
                >
                  <option value={60}>1 Minute</option>
                  <option value={300}>5 Minutes</option>
                  <option value={900}>15 Minutes</option>
                  <option value={3600}>1 Hour</option>
                </select>
              </div>

              {/* Eval Periods */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Evaluation Periods
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm font-bold"
                  value={form.evaluationPeriods}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      evaluationPeriods: parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  Number of data points before firing
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold border-slate-200"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Alarm"
              )}
            </Button>
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Secured via IAM Cross-Account Role
          </span>
        </div>
      </div>
    </div>
  );
}
