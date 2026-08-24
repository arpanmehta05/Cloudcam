import { generateDockerBootstrap } from "./docker";
import { generateNodeJsBootstrap } from "./nodejs";
import { generatePythonBootstrap } from "./python";

export function generateBootstrapScript(
  compiler: any,
  config: any,
  dbEnvVars: Array<{ name: string; value: string }>,
  osType: "al2023" | "ubuntu" | "debian"
): string {
  const gitUrl = config.gitUrl;
  if (!gitUrl && !config.repository && dbEnvVars.length === 0) return "";

  const regionVal = config.region || compiler.region;
  let script = `#!/bin/bash\nexec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1\necho "Starting Rabbittize Bootstrap Setup..."\n`;

  if (dbEnvVars.length > 0) {
    script += `echo "Writing environment variables to /etc/environment..."\n`;
    for (const env of dbEnvVars) {
      script += `echo '${env.name}="${env.value}"' >> /etc/environment\n`;
      script += `export ${env.name}="${env.value}"\n`;
    }
  }

  script += `echo 'AWS_REGION="${regionVal}"' >> /etc/environment\n`;
  script += `export AWS_REGION="${regionVal}"\n`;

  if (!gitUrl && !config.repository) {
    return script;
  }

  script += `cat << 'EOF' > /opt/rabbittize-health-check.sh
#!/bin/bash
set +e

public_port="$1"
container_name="$2"
health_json="/opt/app/rabbittize-health.json"
health_log="/opt/app/rabbittize-health.log"
probe_url="http://127.0.0.1:$public_port/"

mkdir -p /opt/app
{
  echo "Rabbittize application readiness check"
  echo "time=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "probe_url=$probe_url"
  echo
  echo "== docker ps -a =="
  docker ps -a || true
  echo
  if [ -n "$container_name" ]; then
    echo "== docker inspect $container_name =="
    docker inspect "$container_name" --format 'status={{.State.Status}} running={{.State.Running}} restarting={{.State.Restarting}} exit_code={{.State.ExitCode}} error={{.State.Error}} started={{.State.StartedAt}} finished={{.State.FinishedAt}}' || true
    echo
    echo "== docker logs $container_name =="
    docker logs "$container_name" --tail 200 || true
    echo
  fi
  echo "== listening ports =="
  ss -lntp || true
  echo
  echo "== local HTTP probe =="
  curl -fsS --max-time 10 "$probe_url" >/tmp/rabbittize-http-body 2>/tmp/rabbittize-http-error
  curl_exit=$?
  if [ "$curl_exit" -eq 0 ]; then
    echo "HTTP probe succeeded"
  else
    echo "HTTP probe failed with exit $curl_exit"
    cat /tmp/rabbittize-http-error || true
  fi
} > "$health_log" 2>&1

status="degraded"
reason="http_probe_failed"
if grep -q "HTTP probe succeeded" "$health_log"; then
  status="ready"
  reason="http_probe_ok"
elif [ -n "$container_name" ] && docker inspect "$container_name" >/dev/null 2>&1; then
  container_status=$(docker inspect "$container_name" --format '{{.State.Status}}' 2>/dev/null || true)
  container_exit=$(docker inspect "$container_name" --format '{{.State.ExitCode}}' 2>/dev/null || true)
  if [ -z "$container_status" ]; then container_status="unknown"; fi
  if [ -z "$container_exit" ]; then container_exit="unknown"; fi
  if [ "$container_status" != "running" ]; then
    reason="container_"$container_status"_exit_"$container_exit
  fi
fi

cat > "$health_json" << JSON
{
  "status": "$status",
  "reason": "$reason",
  "probeUrl": "$probe_url",
  "containerName": "$container_name",
  "logPath": "$health_log",
  "checkedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
JSON

if [ "$status" = "ready" ]; then
  echo "[rabbittize] APP_READY $probe_url"
else
  echo "[rabbittize] APP_DEGRADED reason=$reason; inspect $health_log and $health_json"
fi
EOF
chmod +x /opt/rabbittize-health-check.sh
`;

  if (config.repository) {
    script += generateDockerBootstrap(config, dbEnvVars, osType, regionVal, config.repository);
    return script;
  }

  let authenticatedGitUrl = gitUrl;
  const token = config.gitToken || compiler.req.githubToken;
  if (token) {
    authenticatedGitUrl = gitUrl.replace(
      "https://",
      `https://x-access-token:${encodeURIComponent(token)}@`
    );
  }

  const cleanRelativePath = (value: unknown) =>
    String(value || "")
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter((part) => part && part !== "." && part !== "..")
      .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, ""))
      .filter(Boolean)
      .join("/");
  const normalizeApiPath = (value: unknown) => {
    const raw = String(value || "/api").trim();
    const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return (
      withSlash
        .replace(/[^a-zA-Z0-9/_-]/g, "")
        .replace(/\/+/g, "/")
        .replace(/\/$/, "") || "/api"
    );
  };

  const buildCommand = config.buildCommand || "";
  const startCommand = config.startCommand || "";
  const appPort = Number(config.appPort || 8080);
  const projectType = config.projectType || "generic_node";
  const isNodeProjectType = [
    "node_api",
    "vite_spa",
    "mern",
    "nextjs",
  ].includes(projectType);
  const runtime =
    config.appRuntime === "docker" || projectType === "docker"
      ? "docker"
      : isNodeProjectType
        ? "nodejs20"
        : config.appRuntime || "nodejs20";
  const frontendDir = cleanRelativePath(config.frontendDir);
  const backendDir = cleanRelativePath(config.backendDir);
  const apiPath = normalizeApiPath(config.apiPath);
  const backendPort = Number(config.backendPort || appPort || 5000);

  if (osType === "al2023") {
    script += `dnf update -y\ndnf install -y git nginx\n`;
    if (runtime === "nodejs20") {
      script += `curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -\ndnf install -y nodejs\nnpm install -g pm2\n`;
    } else if (runtime === "python3") {
      script += `dnf install -y python3 python3-pip\n`;
    } else if (runtime === "docker") {
      script += `dnf install -y docker\nsystemctl enable docker\nsystemctl start docker\n`;
      script += `mkdir -p /usr/libexec/docker/cli-plugins\nARCH=\$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/')\ncurl -SL https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-\$ARCH -o /usr/libexec/docker/cli-plugins/docker-buildx\nchmod +x /usr/libexec/docker/cli-plugins/docker-buildx\n`;
      script += `curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose\nchmod +x /usr/local/bin/docker-compose\nln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose\n`;
    }
  } else {
    script += `apt-get update -y\napt-get install -y git curl sudo nginx\n`;
    if (runtime === "nodejs20") {
      script += `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\napt-get install -y nodejs\nnpm install -g pm2\n`;
    } else if (runtime === "python3") {
      script += `apt-get install -y python3 python3-pip python3-venv\n`;
    } else if (runtime === "docker") {
      script += `apt-get install -y docker.io docker-compose\nsystemctl enable docker\nsystemctl start docker\n`;
      script += `mkdir -p /usr/libexec/docker/cli-plugins\nARCH=\$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/')\ncurl -SL https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-\$ARCH -o /usr/libexec/docker/cli-plugins/docker-buildx\nchmod +x /usr/libexec/docker/cli-plugins/docker-buildx\n`;
    }
  }

  // Configure Nginx Reverse Proxy base functions
  if (osType === "al2023") {
    script += `cat << 'EOF' > /etc/nginx/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    log_format  main  '\\$remote_addr - \\$remote_user [\\$time_local] "\\$request" '
                      '\\$status \\$body_bytes_sent "\\$http_referer" '
                      '"\\$http_user_agent" "\\$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    include /etc/nginx/conf.d/*.conf;
}
EOF

cat << 'EOF' > /etc/nginx/conf.d/app.conf
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
systemctl enable nginx
systemctl restart nginx
`;
  } else {
    script += `cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
systemctl enable nginx
systemctl restart nginx
`;
  }

  script += `mkdir -p /opt/app\ncd /opt/app\ngit clone -b ${config.gitBranch || "main"} ${authenticatedGitUrl} .\n`;

  // Create symlink
  if (osType === "al2023") {
    const ec2User = config.adminUsername || "ec2-user";
    script += `ln -s /opt/app /home/${ec2User}/app\nchown -h ${ec2User}:${ec2User} /home/${ec2User}/app\n`;
  } else if (osType === "ubuntu") {
    const azUser = config.adminUsername || "azureuser";
    script += `ln -s /opt/app /home/${azUser}/app\nchown -h ${azUser}:${azUser} /home/${azUser}/app\n`;
  } else if (osType === "debian") {
    script += `ln -s /opt/app /home/cloudwatcher/app\nchown -h cloudwatcher:cloudwatcher /home/cloudwatcher/app\n`;
  }

  script += `cat << 'EOF' > .env\n`;
  if (!(runtime === "docker" && appPort === 80)) {
    script += `PORT=${appPort}\n`;
  }
  script += `HOST=0.0.0.0\nVITE_HOST=0.0.0.0\nAWS_REGION="${regionVal}"\n`;
  for (const env of dbEnvVars) {
    script += `${env.name}="${env.value}"\n`;
  }
  script += `EOF\n`;

  script += `cat << 'EOF' > /opt/app/configure-nginx.sh
#!/bin/bash
set -e

write_proxy_nginx() {
  local upstream_port="$1"
  local target="${osType === "al2023" ? "/etc/nginx/conf.d/app.conf" : "/etc/nginx/sites-available/default"}"
  cat << NGINX > "$target"
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:$upstream_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
NGINX
}

write_static_nginx() {
  local static_root="$1"
  local target="${osType === "al2023" ? "/etc/nginx/conf.d/app.conf" : "/etc/nginx/sites-available/default"}"
  cat << NGINX > "$target"
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;
    root $static_root;
    index index.html;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }
}
NGINX
}

write_mern_nginx() {
  local static_root="$1"
  local upstream_port="$2"
  local target="${osType === "al2023" ? "/etc/nginx/conf.d/app.conf" : "/etc/nginx/sites-available/default"}"
  cat << NGINX > "$target"
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;
    root $static_root;
    index index.html;

    location ${apiPath}/ {
        proxy_pass http://127.0.0.1:$upstream_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }
}
NGINX
}

reload_nginx() {
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}
EOF
chmod +x /opt/app/configure-nginx.sh
`;

  if (runtime === "docker") {
    script += `# Stop and disable nginx on host to prevent port 80 conflict with containers
systemctl stop nginx || true
systemctl disable nginx || true

`;
    if (startCommand) {
      if (startCommand.includes("-f demo/docker-compose.yml")) {
        script += `if [ -f demo/docker-compose.yml ]; then
  ${startCommand}
elif [ -f docker-compose.yml ]; then
  ${startCommand.replace("-f demo/docker-compose.yml", "")}
else
  ${startCommand}
fi
sleep 8
/opt/rabbittize-health-check.sh 80 "" || true
`;
      } else {
        script += `${startCommand}\nsleep 8\n/opt/rabbittize-health-check.sh 80 "" || true\n`;
      }
    } else {
      script += `if [ -f demo/docker-compose.yml ]; then
  cd /opt/app/demo
  cp /opt/app/.env .env
  if command -v docker-compose >/dev/null 2>&1; then docker-compose up -d; else docker compose up -d; fi
  sleep 8
  /opt/rabbittize-health-check.sh 80 "" || true
elif [ -f docker-compose.yml ]; then
  if command -v docker-compose >/dev/null 2>&1; then docker-compose up -d; else docker compose up -d; fi
  sleep 8
  /opt/rabbittize-health-check.sh 80 "" || true
elif [ -f demo/Dockerfile ]; then
  docker build -t app ./demo
  if [ "\${appPort}" = "80" ]; then
    docker run -d -p 80:80 --name app-container --restart always --env-file .env app
  else
    docker run -d -p 127.0.0.1:\${appPort}:\${appPort} --name app-container --restart always --env-file .env app
    systemctl enable nginx || true
    systemctl start nginx || true
    source /opt/app/configure-nginx.sh
    write_proxy_nginx \${appPort}
    reload_nginx
  fi
  sleep 8
  /opt/rabbittize-health-check.sh 80 app-container || true
elif [ -f Dockerfile ]; then
  docker build -t app .
  if [ "\${appPort}" = "80" ]; then
    docker run -d -p 80:80 --name app-container --restart always --env-file .env app
  else
    docker run -d -p 127.0.0.1:\${appPort}:\${appPort} --name app-container --restart always --env-file .env app
    systemctl enable nginx || true
    systemctl start nginx || true
    source /opt/app/configure-nginx.sh
    write_proxy_nginx \${appPort}
    reload_nginx
  fi
  sleep 8
  /opt/rabbittize-health-check.sh 80 app-container || true
else
  echo "No docker-compose.yml or Dockerfile found at repository root or demo/." >&2
  exit 1
fi
`;
    }
  } else if (runtime === "python3") {
    script += generatePythonBootstrap(startCommand || "/opt/app/venv/bin/python main.py", appPort);
  } else {
    // Node.js project types
    const execPath = "/usr/bin/npm run start";
    let runStart = startCommand || execPath;
    if (
      runtime === "nodejs20" &&
      /\bnpm\s+run\s+dev\b/.test(runStart) &&
      !/\s--\s/.test(runStart) &&
      !/\s--host\b/.test(runStart)
    ) {
      runStart = `${runStart} -- --host 0.0.0.0`;
    }
    script += generateNodeJsBootstrap(
      config,
      projectType,
      frontendDir,
      backendDir,
      apiPath,
      backendPort,
      startCommand,
      buildCommand,
      appPort,
      runStart
    );
  }

  return script;
}
