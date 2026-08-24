import { generateJsonContent, isGeminiConfigured } from "../../../providers/gemini.provider";
import { logger } from "../../../core/logger";

export interface ParsedAlarmResult {
  name?: string;
  destination?: "cloud_native" | "vps_agent";
  type?: "metric_threshold" | "log_volume";
  metric?: "cpuPercent" | "ramPercent" | "diskUsedPercent";
  comparator?: "gt" | "gte" | "lt" | "lte";
  threshold?: number;
  severity?: "critical" | "warning" | "info";
  agentId?: string;
  windowMinutes?: number;
  cooldownMinutes?: number;
  source?: "all" | "docker" | "pm2" | "system" | "nginx" | "apache";
  service?: string;
  level?: "all" | "error" | "warn" | "info" | "debug";
  messagePattern?: string;
}

export interface AvailableResource {
  label: string;
  value: string;
  type: "vps" | "aws" | "azure" | "gcp";
  region?: string;
  instanceId?: string;
}

export async function parseAlarmQuery(
  query: string,
  availableResources: AvailableResource[]
): Promise<{ parsed: ParsedAlarmResult; missingFields: string[] }> {
  if (isGeminiConfigured()) {
    try {
      const prompt = `
      Extract parameters for an Alarm Rule from this natural language query: "${query}"

      We support two destinations:
      1. "cloud_native" (creates a native AWS CloudWatch alarm, Azure Alert, or GCP Alert Policy).
      2. "vps_agent" (creates a local dashboard log/metric alarm rule). Default is "vps_agent".

      We support monitoring of CPU, RAM, Disk, and Log volume.

      Here are the available servers/instances for the user:
      ${JSON.stringify(availableResources)}

      Valid parameters to extract:
      1. "name": A short string under 50 chars representing the alarm's purpose (e.g. "High CPU Alert"). Generate a meaningful one if not provided.
      2. "destination": Must be "cloud_native" (if the query specifically references native cloud alerts/CloudWatch/Azure/GCP monitor) or "vps_agent" (default).
      3. "type": Must be "metric_threshold" (if monitoring resource usage metrics like CPU, RAM, Disk) or "log_volume" (if monitoring volume or count of logs).
      4. "metric": Must be "cpuPercent", "ramPercent", or "diskUsedPercent" (only if type is "metric_threshold").
      5. "comparator": Must be "gt", "gte", "lt", or "lte". Default to "gte".
      6. "threshold": A positive number representing the percentage or log count threshold.
      7. "severity": Must be "critical", "warning", or "info". Default is "warning".
      8. "agentId": Choose the closest matching option "value" (e.g., "vps_agt_...", "aws_...") from the available servers/instances list. If no specific server is mentioned, or if "all" is mentioned, return "all".
      9. "windowMinutes": Number of minutes, default to 15.
      10. "cooldownMinutes": Number of minutes, default to 30.
      11. "source": The log source. Must be one of "all", "docker", "pm2", "system", "nginx", "apache" (only for log_volume). Default to "all".
      12. "service": Container/service name string (only for log_volume). Default to "".
      13. "level": Log level. Must be one of "all", "error", "warn", "info", "debug" (only for log_volume). Default to "all".
      14. "messagePattern": String pattern/keyword filter (only for log_volume). Default to "".

      Analyze what is provided, map agentId to the correct "value" from the list of available servers/instances, fill in standard defaults, and list required fields that are missing from the query. The required fields to form a valid rule are: "type", "threshold", and (if type is "metric_threshold") "metric".

      Return ONLY a JSON object of this exact shape:
      {
        "parsed": {
          "name": string or null,
          "destination": "cloud_native" or "vps_agent" or null,
          "type": "metric_threshold" or "log_volume" or null,
          "metric": "cpuPercent" or "ramPercent" or "diskUsedPercent" or null,
          "comparator": "gt" or "gte" or "lt" or "lte" or null,
          "threshold": number or null,
          "severity": "critical" or "warning" or "info" or null,
          "agentId": string or null,
          "windowMinutes": number or null,
          "cooldownMinutes": number or null,
          "source": "all" or "docker" or "pm2" or "system" or "nginx" or "apache" or null,
          "service": string or null,
          "level": "all" or "error" or "warn" or "info" or "debug" or null,
          "messagePattern": string or null
        },
        "missingFields": string[]
      }
      `;
      const result = await generateJsonContent(prompt);
      if (result && result.parsed) {
        return {
          parsed: result.parsed,
          missingFields: result.missingFields || [],
        };
      }
    } catch (err: any) {
      logger.error("[Slack-Bot] Gemini parsing failed, falling back to regex:", err);
    }
  }

  // Regex fallback
  const text = query.toLowerCase();
  const parsed: ParsedAlarmResult = {
    name: "Slack Created Alarm",
    destination: "vps_agent",
    severity: "warning",
    comparator: "gte",
    agentId: "all",
    windowMinutes: 15,
    cooldownMinutes: 30,
    source: "all",
    service: "",
    level: "all",
    messagePattern: "",
  };

  if (
    text.includes("cloudwatch") ||
    text.includes("aws alarm") ||
    text.includes("native") ||
    text.includes("azure alert") ||
    text.includes("gcp alert")
  ) {
    parsed.destination = "cloud_native";
  }

  if (text.includes("cpu")) {
    parsed.type = "metric_threshold";
    parsed.metric = "cpuPercent";
    parsed.name = "Slack CPU Alarm";
  } else if (text.includes("ram") || text.includes("memory")) {
    parsed.type = "metric_threshold";
    parsed.metric = "ramPercent";
    parsed.name = "Slack Memory Alarm";
  } else if (text.includes("disk") || text.includes("storage")) {
    parsed.type = "metric_threshold";
    parsed.metric = "diskUsedPercent";
    parsed.name = "Slack Disk Alarm";
  } else if (
    text.includes("log") ||
    text.includes("volume") ||
    text.includes("error") ||
    text.includes("warn")
  ) {
    parsed.type = "log_volume";
    parsed.name = "Slack Log Volume Alarm";
  }

  // Parse threshold
  const numMatch = text.match(/\b(\d+)\b/);
  if (numMatch) {
    parsed.threshold = Number(numMatch[1]);
  }

  // Parse comparator
  if (text.includes("below") || text.includes("less") || text.includes("<")) {
    parsed.comparator = "lte";
  }

  // Parse Agent ID
  for (const res of availableResources) {
    const labelClean = res.label.toLowerCase();
    const valueClean = res.value.toLowerCase();
    const instanceIdClean = res.instanceId ? res.instanceId.toLowerCase() : "";
    if (
      text.includes(labelClean) ||
      text.includes(valueClean) ||
      (instanceIdClean && text.includes(instanceIdClean))
    ) {
      parsed.agentId = res.value;
      break;
    }
  }

  // Parse log volume fields from text keywords if type is log_volume
  if (parsed.type === "log_volume") {
    if (text.includes("docker")) parsed.source = "docker";
    else if (text.includes("pm2")) parsed.source = "pm2";
    else if (text.includes("nginx")) parsed.source = "nginx";
    else if (text.includes("apache")) parsed.source = "apache";
    else if (text.includes("system")) parsed.source = "system";

    if (text.includes("error")) parsed.level = "error";
    else if (text.includes("warn")) parsed.level = "warn";
    else if (text.includes("info")) parsed.level = "info";
    else if (text.includes("debug")) parsed.level = "debug";

    const patternMatch =
      query.match(/(?:pattern|containing|matching|keyword)\s+['"“]([^'”"]+)['"”]/i) ||
      query.match(/(?:pattern|containing|matching|keyword)\s+(\S+)/i);
    if (patternMatch) {
      parsed.messagePattern = patternMatch[1];
    }

    const serviceMatch = query.match(/(?:service|container)\s+(\S+)/i);
    if (serviceMatch) {
      parsed.service = serviceMatch[1];
    }
  }

  const missingFields: string[] = [];
  if (!parsed.type) missingFields.push("type");
  if (parsed.threshold === undefined) missingFields.push("threshold");
  if (parsed.type === "metric_threshold" && !parsed.metric) missingFields.push("metric");

  return { parsed, missingFields };
}

export async function mergeThreadReply(params: {
  pendingAlarm: Record<string, any>;
  missingFields: string[];
  replyText: string;
  availableResources: AvailableResource[];
}): Promise<{ parsed: ParsedAlarmResult; missingFields: string[] }> {
  const { pendingAlarm, missingFields, replyText, availableResources } = params;

  if (isGeminiConfigured()) {
    try {
      const prompt = `
      We are in a conversation to configure a VPS/Cloud alarm rule.
      Here is the current state of the alarm: ${JSON.stringify(pendingAlarm)}
      The fields we were missing are: ${JSON.stringify(missingFields)}
      The user replied: "${replyText}"

      Here are the available servers/instances for the user:
      ${JSON.stringify(availableResources)}

      Extract the values for the missing fields from the user's reply, merge them with the current alarm state, and return the updated alarm object and any remaining missing fields.
      Ensure agentId is mapped to the correct option "value" from the available servers/instances list.

      Return ONLY a JSON object of this exact shape:
      {
        "parsed": {
          "name": string,
          "destination": "cloud_native" or "vps_agent",
          "type": "metric_threshold" or "log_volume",
          "metric": "cpuPercent" or "ramPercent" or "diskUsedPercent" or null,
          "comparator": "gt" or "gte" or "lt" or "lte",
          "threshold": number,
          "severity": "critical" or "warning" or "info",
          "agentId": string,
          "windowMinutes": number,
          "cooldownMinutes": number,
          "source": "all" or "docker" or "pm2" or "system" or "nginx" or "apache" or null,
          "service": string or null,
          "level": "all" or "error" or "warn" or "info" or "debug" or null,
          "messagePattern": string or null
        },
        "missingFields": string[]
      }
      `;
      const result = await generateJsonContent(prompt);
      if (result && result.parsed) {
        return {
          parsed: result.parsed,
          missingFields: result.missingFields || [],
        };
      }
    } catch (err: any) {
      logger.error("[Slack-Bot] Gemini merge failed, falling back to regex:", err);
    }
  }

  // Regex Fallback
  const nextAlarm = { ...pendingAlarm };
  const text = replyText.toLowerCase();

  for (const field of missingFields) {
    if (field === "threshold") {
      const numMatch = text.match(/\b(\d+)\b/);
      if (numMatch) {
        nextAlarm.threshold = Number(numMatch[1]);
      }
    } else if (field === "type") {
      if (
        text.includes("cpu") ||
        text.includes("ram") ||
        text.includes("memory") ||
        text.includes("disk")
      ) {
        nextAlarm.type = "metric_threshold";
      } else if (text.includes("log")) {
        nextAlarm.type = "log_volume";
      }
    } else if (field === "metric") {
      if (text.includes("cpu")) nextAlarm.metric = "cpuPercent";
      else if (text.includes("ram") || text.includes("memory")) nextAlarm.metric = "ramPercent";
      else if (text.includes("disk") || text.includes("storage")) nextAlarm.metric = "diskUsedPercent";
    } else if (field === "agentId") {
      for (const res of availableResources) {
        const labelClean = res.label.toLowerCase();
        const valueClean = res.value.toLowerCase();
        const instanceIdClean = res.instanceId ? res.instanceId.toLowerCase() : "";
        if (
          text.includes(labelClean) ||
          text.includes(valueClean) ||
          (instanceIdClean && text.includes(instanceIdClean))
        ) {
          nextAlarm.agentId = res.value;
          break;
        }
      }
    } else if (field === "destination") {
      if (
        text.includes("cloud") ||
        text.includes("native") ||
        text.includes("aws") ||
        text.includes("cloudwatch") ||
        text.includes("azure") ||
        text.includes("gcp")
      ) {
        nextAlarm.destination = "cloud_native";
      } else {
        nextAlarm.destination = "vps_agent";
      }
    }
  }

  const nextMissing = missingFields.filter((f) => {
    if (f === "threshold" && nextAlarm.threshold !== undefined) return false;
    if (f === "type" && nextAlarm.type !== undefined) return false;
    if (f === "metric" && nextAlarm.metric !== undefined) return false;
    if (f === "agentId" && nextAlarm.agentId !== undefined) return false;
    if (f === "destination" && nextAlarm.destination !== undefined) return false;
    return true;
  });

  return { parsed: nextAlarm as any, missingFields: nextMissing };
}
