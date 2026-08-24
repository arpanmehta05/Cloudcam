# @rabbittwatch/vps-agent

The official, lightweight, and robust log and metrics collector agent for RabbittWatch. 

This package is designed to be installed globally on a Virtual Private Server (VPS). It automatically collects system health metrics (CPU, memory, disk, network), Docker container logs, PM2 process logs, and web server logs (Nginx/Apache), streaming them securely to your RabbittWatch observability dashboard.

## Features

- **System Metrics**: Automatically gathers CPU usage, Memory utilization, Disk space, and Network traffic.
- **Docker Container Logs**: Auto-discovers active Docker containers and streams their console logs.
- **PM2 logs**: Intercepts and logs output from applications managed by PM2.
- **Web Server Logs**: Automatically tails Nginx (error/access) and Apache web server log files.
- **Local Buffer Resilience**: Buffers metrics/logs locally in a `.rabbitt-buffer.json` file if the network is disconnected, flushing it once connection is restored.
- **Dynamic Settings Sync**: Polls your RabbittWatch dashboard settings every 10 minutes to auto-sync configurations (e.g., active log sources, intervals).
- **Built-in CLI Diagnostics**: Fast diagnostic commands like `rabbitt-agent logs` to inspect agent streaming health instantly.

## Installation

Install the package globally via npm:

```bash
sudo npm install -g @rabbittwatch/vps-agent
```

## Setup & Configuration

Configure the agent by defining system environment variables or creating a `.env` file in your agent's working directory.

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AGENT_ID` | Your unique Agent ID from the RabbittWatch dashboard. | - | **Yes** |
| `INGEST_KEY` | Your project's secure Ingest Key. | - | **Yes** |
| `API_BASE_URL` | The API endpoint of the RabbittWatch dashboard service. | `http://localhost:4000` | No |
| `COLLECTION_INTERVAL` | Interval in seconds between metrics collection cycles. | `300` | No |
| `ENABLED_SOURCES` | Comma-separated log sources to tail (`system`, `docker`, `pm2`, `nginx`, `apache`). | `system,docker,pm2,nginx,apache` | No |

### Running the Agent

You can start the agent directly:

```bash
rabbitt-agent
```

## Production Deployment (Recommended)

To ensure the agent starts on system boot, restarts automatically on failures, and runs cleanly in the background, deploy it as a **Systemd Service**.

### 1. Create Systemd Service File
Create a new configuration file at `/etc/systemd/system/rabbitt-agent.service`:

```ini
[Unit]
Description=RabbittWatch VPS Agent
After=network.target

[Service]
Type=simple
User=root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=AGENT_ID=your-agent-id
Environment=INGEST_KEY=your-ingest-key
Environment=API_BASE_URL=https://your-rabbittwatch-domain.com
Environment=ENABLED_SOURCES=system,docker,pm2,nginx,apache
ExecStart=/usr/bin/node /usr/lib/node_modules/@rabbittwatch/vps-agent/dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```
> [!NOTE]
> Ensure the paths to `node` and the agent script match your system's global paths (check using `which node` and `readlink -f $(which rabbitt-agent)`).

### 2. Enable & Start Service
Reload systemd, enable the service, and start the agent:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rabbitt-agent
sudo systemctl start rabbitt-agent
```

### 3. Check Live Logs
Run the easy-to-remember log CLI command to monitor live agent activity:

```bash
rabbitt-agent logs
```

## Troubleshooting

- **Check Service Status**: Use standard system tools (`systemctl status rabbitt-agent`).
- **Web Server Permissions**: Ensure the user running the agent (e.g. `root`) has appropriate read permissions to access files in `/var/log/nginx/` and `/var/log/apache2/`.
- **Docker Access**: Ensure the user is in the `docker` group or the process runs as root to access container stdout/stderr.
- **Local Buffer Diagnostics**: Check if `.rabbitt-buffer.json` exists in the agent's running path. If present, it indicates network connectivity issues prevent logs from uploading.

## License

MIT
