export function generateNodeJsBootstrap(
  config: any,
  projectType: string,
  frontendDir: string,
  backendDir: string,
  apiPath: string,
  backendPort: number,
  startCommand: string,
  buildCommand: string,
  appPort: number,
  runStart: string
): string {
  let script = "";

  if (projectType === "vite_spa") {
    const frontendPath = frontendDir ? `/opt/app/${frontendDir}` : "/opt/app";
    script += `cd ${frontendPath}
npm install
npm run build
source /opt/app/configure-nginx.sh
write_static_nginx ${frontendPath}/dist
reload_nginx
`;
  } else if (projectType === "mern") {
    const frontendPath = frontendDir
      ? `/opt/app/${frontendDir}`
      : "/opt/app/client";
    const backendPath = backendDir
      ? `/opt/app/${backendDir}`
      : "/opt/app/server";
    script += `FRONTEND_DIR="${frontendPath}"
BACKEND_DIR="${backendPath}"
if [ ! -d "$FRONTEND_DIR" ]; then FRONTEND_DIR="/opt/app"; fi
if [ ! -d "$BACKEND_DIR" ]; then BACKEND_DIR="/opt/app"; fi
cd "$FRONTEND_DIR"
npm install
npm run build
cd "$BACKEND_DIR"
npm install
cat << EOF > /opt/app/start-api.sh
#!/bin/bash
set -a
source /opt/app/.env
set +a
export PORT=${backendPort}
cd "$BACKEND_DIR"
exec ${startCommand || "npm run start"}
EOF
chmod +x /opt/app/start-api.sh
pm2 start /opt/app/start-api.sh --name rabbittize-api --interpreter bash
pm2 startup systemd -u root --hp /root || true
pm2 save
source /opt/app/configure-nginx.sh
STATIC_ROOT="$FRONTEND_DIR/dist"
if [ ! -d "$STATIC_ROOT" ]; then STATIC_ROOT="$FRONTEND_DIR/build"; fi
write_mern_nginx "$STATIC_ROOT" ${backendPort}
reload_nginx
`;
  } else if (projectType === "nextjs") {
    script += `npm install
npm run build
cat << 'EOF' > /opt/app/start-app.sh
#!/bin/bash
set -a
source /opt/app/.env
set +a
export PORT=${appPort}
export HOSTNAME=0.0.0.0
cd /opt/app
exec npm run start
EOF
chmod +x /opt/app/start-app.sh
pm2 start /opt/app/start-app.sh --name rabbittize-app --interpreter bash
pm2 startup systemd -u root --hp /root || true
pm2 save
source /opt/app/configure-nginx.sh
write_proxy_nginx ${appPort}
reload_nginx
`;
  } else {
    if (buildCommand) {
      script += `${buildCommand}\n`;
    }

    script += `cat << 'EOF' > /opt/app/start-app.sh
#!/bin/bash
set -a
source /opt/app/.env
set +a
cd /opt/app
exec ${runStart}
EOF
chmod +x /opt/app/start-app.sh
pm2 start /opt/app/start-app.sh --name rabbittize-app --interpreter bash
pm2 startup systemd -u root --hp /root || true
pm2 save
source /opt/app/configure-nginx.sh
write_proxy_nginx ${appPort}
reload_nginx
`;
  }

  return script;
}
