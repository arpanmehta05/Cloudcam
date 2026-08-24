import { randomBytes, createHash } from "crypto";
import { VpsLogAgent } from "../models/vps-log-agent.model";
import { VpsLogEntry } from "../models/vps-log-entry.model";
import { VpsAlarmRule } from "../models/vps-alarm-rule.model";
import { config } from "../../../config/env";
import { deleteAgentLogsFromS3 } from "./s3-archive.service";

interface CreateAgentInput {
  name: string;
  vpcId?: string;
  environment?: string;
}

export type VpsLogSource = "docker" | "pm2" | "system" | "nginx" | "apache";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildCollectorScript(params: {
  apiBaseUrl: string;
  agentId: string;
  ingestKey: string;
}): string {
  const { apiBaseUrl, agentId, ingestKey } = params;
  const ingestUrl = `${apiBaseUrl.replace(/\/$/, "")}/api/vps-logs/ingest`;

  return `#!/usr/bin/env bash
set -euo pipefail

AGENT_ID="${agentId}"
INGEST_KEY="${ingestKey}"
INGEST_URL="${ingestUrl}"
INTERVAL_SECONDS="\${INTERVAL_SECONDS:-300}"
SINCE_ARG="\${SINCE_ARG:-5m}"
MAX_LINES="\${MAX_LINES:-120}"
MAX_BYTES="\${MAX_BYTES:-120000}"
ENABLE_DOCKER="\${ENABLE_DOCKER:-1}"
ENABLE_PM2="\${ENABLE_PM2:-1}"
ENABLE_WEB_LOGS="\${ENABLE_WEB_LOGS:-1}"
ENABLE_HOST_METRICS="\${ENABLE_HOST_METRICS:-1}"
SPOOL_DIR="\${SPOOL_DIR:-/tmp/Rabbittize-spool}"

mkdir -p "$SPOOL_DIR"

is_enabled() {
    local value="\${1:-1}"
    case "$value" in
        0|false|FALSE|no|NO)
            return 1
            ;;
        *)
            return 0
            ;;
    esac
}

cleanup_spool() {
    # Remove stale files older than 5 minutes.
    find "$SPOOL_DIR" -type f -name '*.log' -mmin +5 -delete 2>/dev/null || true
}

send_log_file() {
  local source="$1"
  local service="$2"
  local file_path="$3"

  if [ ! -s "$file_path" ]; then
    return
  fi

  local encoded
  encoded=$(base64 < "$file_path" | tr -d '\\n')

  # Stream payload via stdin to avoid OS argv length limits.
  printf '{"agentId":"%s","source":"%s","service":"%s","logsBase64":"%s"}' \\
      "$AGENT_ID" "$source" "$service" "$encoded" \\
      | curl -sS -X POST "$INGEST_URL" \\
          -H "Content-Type: application/json" \\
          -H "x-agent-id: $AGENT_ID" \\
          -H "x-ingest-key: $INGEST_KEY" \\
          --data-binary @- >/dev/null || true
}

collect_docker() {
    if ! is_enabled "$ENABLE_DOCKER"; then
        return
    fi

  if ! command -v docker >/dev/null 2>&1; then
    return
  fi

  local now
  local safe_container
  local file_path
  now=\$(date +%s)

  while IFS= read -r container; do
    [ -z "\$container" ] && continue

    safe_container=\$(echo "\$container" | tr -c '[:alnum:]_.-' '_')
    file_path="\$SPOOL_DIR/docker_\${safe_container}_\${now}.log"

    docker logs --since "\$SINCE_ARG" "\$container" 2>&1 | tail -n "\$MAX_LINES" | tail -c "\$MAX_BYTES" > "\$file_path" || true
    send_log_file "docker" "\$container" "\$file_path"
  done < <(docker ps --format '{{.Names}}')
}

collect_pm2() {
    if ! is_enabled "$ENABLE_PM2"; then
        return
    fi

  if ! command -v pm2 >/dev/null 2>&1; then
    return
  fi

  local now
  local file_path
  now=\$(date +%s)
  file_path="\$SPOOL_DIR/pm2_\${now}.log"

  pm2 logs --nostream --lines "\$MAX_LINES" 2>/dev/null | tail -c "\$MAX_BYTES" > "\$file_path" || true
  send_log_file "pm2" "pm2" "\$file_path"
}

collect_host_metrics() {
    if ! is_enabled "$ENABLE_HOST_METRICS"; then
        return
    fi

  local now
  local file_path
  local ts
  local cpu_pct
  local ram_used
  local ram_total
  local disk_used

  now=\$(date +%s)
  file_path="\$SPOOL_DIR/system_metrics_\${now}.log"
  ts=\$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cpu_pct=\$(top -bn1 2>/dev/null | awk '
      /Cpu\\(s\\)|%Cpu/ {
          for (i = 1; i <= NF; i++) {
              if (\$i ~ /id,?\$/) {
                  idle = \$(i - 1)
              }
          }
      }
      END {
          if (idle == "") idle = 100;
          gsub(/,/, "", idle);
          printf "%.2f", 100 - idle
      }
  ')

  ram_used=\$(free -m 2>/dev/null | awk '/^Mem:/ {print \$3; exit}')
  ram_total=\$(free -m 2>/dev/null | awk '/^Mem:/ {print \$2; exit}')
  disk_used=\$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/, "", \$5); print \$5; exit}')

  : "\${cpu_pct:=0}"
  : "\${ram_used:=0}"
  : "\${ram_total:=0}"
  : "\${disk_used:=0}"

  printf '{"timestamp":"%s","cpuPercent":%s,"ramUsedMb":%s,"ramTotalMb":%s,"diskUsedPercent":%s}' \\
      "\$ts" "\$cpu_pct" "\$ram_used" "\$ram_total" "\$disk_used" > "\$file_path"

  send_log_file "system" "host-metrics" "\$file_path"
}

collect_file_tail() {
    local source="$1"
    local service="$2"
    local file_to_read="$3"

    if [ ! -r "$file_to_read" ]; then
        return
    fi

    local now
    local safe_service
    local file_path
    now=\$(date +%s)
    safe_service=\$(echo "\$service" | tr -c '[:alnum:]_.-' '_')
    file_path="\$SPOOL_DIR/\${safe_service}_\${now}.log"

    tail -n "\$MAX_LINES" "$file_to_read" 2>/dev/null | tail -c "\$MAX_BYTES" > "\$file_path" || true
    send_log_file "$source" "$service" "$file_path"
}

collect_web_logs() {
    if ! is_enabled "$ENABLE_WEB_LOGS"; then
        return
    fi

    # Nginx (common path)
    collect_file_tail "nginx" "nginx-access" "/var/log/nginx/access.log"
    collect_file_tail "nginx" "nginx-error" "/var/log/nginx/error.log"

    # Apache on Debian/Ubuntu
    collect_file_tail "apache" "apache-access" "/var/log/apache2/access.log"
    collect_file_tail "apache" "apache-error" "/var/log/apache2/error.log"

    # Apache on RHEL/CentOS/Amazon Linux
    collect_file_tail "apache" "apache-access" "/var/log/httpd/access_log"
    collect_file_tail "apache" "apache-error" "/var/log/httpd/error_log"
}

echo "[Rabbittize] Starting VPS collector for agent $AGENT_ID"
while true; do
    cleanup_spool
    collect_docker
    collect_pm2
    collect_web_logs
    collect_host_metrics
    cleanup_spool
    sleep "$INTERVAL_SECONDS"
done
`;
}

export async function createVpsLogAgent(userId: string, input: CreateAgentInput) {
  const agentId = `agt_${randomBytes(8).toString("hex")}`;
  const ingestKey = `rbt_${randomBytes(20).toString("hex")}`;
  const ingestKeyHash = sha256(ingestKey);

  const agent = await VpsLogAgent.create({
    userId,
    name: input.name,
    vpcId: input.vpcId || "",
    environment: config.appEnv,
    agentId,
    ingestKeyHash,
    status: "pending",
    collectionInterval: 300,
    enabledSources: ["docker", "pm2", "system", "nginx", "apache"],
  });

  const apiBaseUrl = config.publicApiBaseUrl;
  const script = buildCollectorScript({ apiBaseUrl, agentId, ingestKey });

  return {
    agent: {
      id: agent._id,
      agentId: agent.agentId,
      name: agent.name,
      vpcId: agent.vpcId,
      environment: agent.environment,
      status: agent.status,
      collectionInterval: agent.collectionInterval,
      enabledSources: agent.enabledSources,
      lastSeenAt: agent.lastSeenAt,
      createdAt: agent.createdAt,
    },
    ingestKey,
    script,
    apiBaseUrl,
  };
}

export async function updateVpsLogAgentConfig(
  userId: string,
  agentId: string,
  updates: {
    name?: string;
    collectionInterval?: number;
    enabledSources?: VpsLogSource[];
    status?: "active" | "inactive";
  }
) {
  const agent = await VpsLogAgent.findOneAndUpdate(
    { userId, agentId },
    { $set: updates },
    { returnDocument: "after" }
  ).lean();

  if (!agent) {
    throw new Error("Agent not found");
  }

  return {
    id: String(agent._id),
    agentId: agent.agentId,
    name: agent.name,
    collectionInterval: agent.collectionInterval,
    enabledSources: agent.enabledSources,
    status: agent.status,
  };
}

export async function listVpsLogAgents(userId: string) {
  const agents = await VpsLogAgent.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  return agents.map((agent) => ({
    id: String(agent._id),
    agentId: agent.agentId,
    name: agent.name,
    vpcId: agent.vpcId || "",
    environment: agent.environment || "",
    lastSeenAt: agent.lastSeenAt || null,
    createdAt: agent.createdAt,
  }));
}

export async function deleteVpsLogAgent(userId: string, agentId: string) {
  const deleted = await VpsLogAgent.findOneAndDelete({ userId, agentId });
  if (!deleted) {
    return { deleted: false, logsDeleted: 0 };
  }

  const logsDeleted = await deleteAgentLogsFromS3(userId, agentId);
  await VpsLogEntry.deleteMany({ userId, agentId });
  await VpsAlarmRule.updateMany(
    { userId, agentId },
    { $set: { enabled: false } }
  );
  return {
    deleted: true,
    logsDeleted,
  };
}
