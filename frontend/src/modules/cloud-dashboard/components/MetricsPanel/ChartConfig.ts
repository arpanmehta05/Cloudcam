import {
  getChartType,
  getMetricColor,
  formatMetricValue,
  calcMetricStats,
} from "@/lib/aws/metric-chart-config";

export { getChartType, getMetricColor, formatMetricValue, calcMetricStats };

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatMoney(value?: number, unit = "USD"): string {
  const cleanUnit = unit === "$" ? "USD" : unit;
  try {
    const locale =
      cleanUnit === "INR" || cleanUnit === "₹" || cleanUnit === "Rs."
        ? "en-IN"
        : "en-US";
    const currencyCode =
      cleanUnit === "₹" || cleanUnit === "Rs." ? "INR" : cleanUnit;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    const prefix =
      cleanUnit === "USD" || cleanUnit === "$" ? "$" : `${cleanUnit} `;
    return `${prefix}${(value || 0).toFixed(2)}`;
  }
}

export function getCurrencySymbol(unit = "USD"): string {
  const cleanUnit = unit === "$" ? "USD" : unit;
  if (cleanUnit === "USD") return "$";
  if (cleanUnit === "INR" || cleanUnit === "₹" || cleanUnit === "Rs.")
    return "₹";
  try {
    const formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: cleanUnit,
    });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === "currency");
    return symbolPart ? symbolPart.value : `${cleanUnit} `;
  } catch {
    return `${cleanUnit} `;
  }
}

export const compileAllCloudsHistory = (providersData: any[]) => {
  const dateMap: Record<
    string,
    { date: string; aws: number; azure: number; gcp: number; amount: number }
  > = {};

  (providersData || []).forEach((provData: any) => {
    const prov = provData.provider; // "aws" | "azure" | "gcp"
    const unit = provData.unit || "USD";
    const rate = unit === "INR" || unit === "₹" || unit === "Rs." ? 83 : 1;
    const history = provData.history || [];
    history.forEach((h: any) => {
      const dateStr = h.date;
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {
          date: dateStr,
          aws: 0,
          azure: 0,
          gcp: 0,
          amount: 0,
        };
      }
      const amountInUSD = h.amount / rate;
      dateMap[dateStr][prov as "aws" | "azure" | "gcp"] = amountInUSD;
      dateMap[dateStr].amount += amountInUSD;
    });
  });

  return Object.values(dateMap).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
};

export const compileAllCloudsBreakdown = (providersData: any[]) => {
  const list: Array<{
    service: string;
    amount: number;
    originalAmount: number;
    unit: string;
    provider: string;
  }> = [];
  (providersData || []).forEach((provData: any) => {
    const prov = provData.provider;
    const unit = provData.unit || "USD";
    const rate = unit === "INR" || unit === "₹" || unit === "Rs." ? 83 : 1;
    const breakdown = provData.breakdown || provData.mtdBreakdown || [];
    breakdown.forEach((b: any) => {
      const amountInUSD = b.amount / rate;
      list.push({
        service: `${b.service} (${prov.toUpperCase()})`,
        amount: amountInUSD,
        originalAmount: b.amount,
        unit: unit,
        provider: prov,
      });
    });
  });
  return list.sort((a, b) => b.amount - a.amount);
};
