export function generateDockerBootstrap(
  config: any,
  dbEnvVars: Array<{ name: string; value: string }>,
  osType: "al2023" | "ubuntu" | "debian",
  regionVal: string,
  repository: string
): string {
  const tag = config.tag || "latest";
  const username = config.username || "";
  const password = config.password || "";
  const appPort = Number(config.appPort || 8080);
  const containerPort = Number(config.containerPort || appPort);

  let script = "";

  if (appPort === 80) {
    if (osType === "al2023") {
      script += `dnf update -y\ndnf install -y docker${config.isEcr ? " awscli" : ""}\nsystemctl enable docker\nsystemctl start docker\n`;
    } else {
      script += `apt-get update -y\napt-get install -y docker.io${config.isEcr ? " awscli" : ""}\nsystemctl enable docker\nsystemctl start docker\n`;
    }
    script += `# Stop and disable nginx on host to prevent port 80 conflict with containers\n`;
    script += `systemctl stop nginx || true\n`;
    script += `systemctl disable nginx || true\n`;
  } else {
    if (osType === "al2023") {
      script += `dnf update -y\ndnf install -y docker nginx${config.isEcr ? " awscli" : ""}\nsystemctl enable docker\nsystemctl start docker\n`;
    } else {
      script += `apt-get update -y\napt-get install -y docker.io nginx${config.isEcr ? " awscli" : ""}\nsystemctl enable docker\nsystemctl start docker\n`;
    }

    // Configure Nginx Reverse Proxy
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
  }

  script += `mkdir -p /opt/app\ncd /opt/app\n`;
  script += `cat << 'EOF' > .env\n`;
  if (appPort !== 80) {
    script += `PORT=${containerPort}\n`;
  }
  script += `HOST=0.0.0.0\nAWS_REGION="${regionVal}"\n`;
  for (const env of dbEnvVars) {
    script += `${env.name}="${env.value}"\n`;
  }
  script += `EOF\n`;

  if (config.isEcr) {
    script += `aws ecr get-login-password --region ${regionVal} | docker login --username AWS --password-stdin $(echo "${repository}" | cut -d'/' -f1)\n`;
  } else if (username && password) {
    script += `echo "${password}" | docker login --username "${username}" --password-stdin\n`;
  }
  script += `docker pull ${repository}:${tag}\n`;
  if (appPort === 80) {
    script += `docker run -d -p 80:${containerPort} --name app-container --restart always --env-file .env ${repository}:${tag}\n`;
  } else {
    script += `docker run -d -p 127.0.0.1:${appPort}:${containerPort} --name app-container --restart always --env-file .env ${repository}:${tag}\n`;
  }
  script += `sleep 8\n/opt/rabbittize-health-check.sh 80 app-container || true\n`;

  return script;
}
