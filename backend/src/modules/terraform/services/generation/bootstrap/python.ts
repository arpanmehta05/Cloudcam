export function generatePythonBootstrap(
  runStart: string,
  appPort: number
): string {
  let script = "";

  script += `python3 -m venv venv\nsource venv/bin/activate\nif [ -f requirements.txt ]; then pip install -r requirements.txt; fi\n`;

  script += `cat << 'EOF' > /etc/systemd/system/app.service
[Unit]
Description=Rabbittize PaaS Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/app
EnvironmentFile=/opt/app/.env
ExecStart=${runStart}
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable app
systemctl start app
source /opt/app/configure-nginx.sh
write_proxy_nginx ${appPort}
reload_nginx
`;

  return script;
}
