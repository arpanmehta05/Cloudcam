#!/usr/bin/env node
import { IngestService } from './transport';
import { AgentConfig } from './core/types';
import { getSystemMetrics, collectDockerLogs, collectPm2Logs, collectNginxLogs, collectApacheLogs } from './collectors';
import { ConfigPoller } from './core/config';
import cron, { ScheduledTask } from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

export class RabbittAgent {
    private config: AgentConfig;
    private ingestService: IngestService;
    private configPoller: ConfigPoller;
    private task: ScheduledTask | null = null;

    constructor(config: AgentConfig) {
        this.config = config;
        this.ingestService = new IngestService(config);
        this.configPoller = new ConfigPoller(config);
    }

    async start() {
        console.log(`[RabbittAgent] Starting for agent: ${this.config.agentId}`);
        console.log(`[RabbittAgent] Interval: ${this.config.collectionInterval}s`);
        
        // Start config poller
        this.configPoller.start((newConfig) => {
            console.log('[RabbittAgent] Configuration update received:', newConfig);
            this.updateConfig(newConfig);
        });

        // Initial run
        await this.runCollection();
        
        // Schedule periodic collection
        this.setupSchedule();
    }

    private setupSchedule() {
        if (this.task) this.task.stop();
        
        const cronExpr = `*/${Math.max(1, Math.floor(this.config.collectionInterval / 60))} * * * *`;
        this.task = cron.schedule(cronExpr, () => this.runCollection());
    }

    private updateConfig(updates: Partial<AgentConfig>) {
        const oldInterval = this.config.collectionInterval;
        this.config = { ...this.config, ...updates };

        if (updates.collectionInterval && updates.collectionInterval !== oldInterval) {
            console.log(`[RabbittAgent] Updating collection interval to ${this.config.collectionInterval}s`);
            this.setupSchedule();
        }
    }

    private async runCollection() {
        console.log(`[RabbittAgent] ${new Date().toISOString()} - Running collection cycle...`);
        
        // 1. Flush Buffer
        await this.ingestService.flushBuffer();

        // 2. Collect & Ingest System Metrics
        if (this.config.enabledSources.includes('system')) {
            const metrics = await getSystemMetrics();
            await this.ingestService.ingest({
                source: 'system',
                service: 'host-metrics',
                logsBase64: Buffer.from(JSON.stringify(metrics)).toString('base64'),
                timestamp: metrics.timestamp
            });
        }

        // 3. Collect & Ingest Docker Logs
        if (this.config.enabledSources.includes('docker')) {
            const dockerLogs = await collectDockerLogs('5m');
            for (const item of dockerLogs) {
                await this.ingestService.ingest({
                    source: 'docker',
                    service: item.container,
                    logsBase64: Buffer.from(item.logs).toString('base64'),
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 4. Collect & Ingest PM2 Logs
        if (this.config.enabledSources.includes('pm2')) {
            const pm2Logs = await collectPm2Logs();
            if (pm2Logs) {
                await this.ingestService.ingest({
                    source: 'pm2',
                    service: 'pm2',
                    logsBase64: Buffer.from(pm2Logs).toString('base64'),
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 5. Collect & Ingest Web Server Logs
        if (this.config.enabledSources.includes('nginx')) {
            const { access, error } = await collectNginxLogs();
            if (access) {
                await this.ingestService.ingest({
                    source: 'nginx',
                    service: 'nginx-access',
                    logsBase64: Buffer.from(access).toString('base64'),
                    timestamp: new Date().toISOString()
                });
            }
            if (error) {
                await this.ingestService.ingest({
                    source: 'nginx',
                    service: 'nginx-error',
                    logsBase64: Buffer.from(error).toString('base64'),
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (this.config.enabledSources.includes('apache')) {
            const apacheLogs = await collectApacheLogs();
            for (const item of apacheLogs) {
                await this.ingestService.ingest({
                    source: 'apache',
                    service: item.service,
                    logsBase64: Buffer.from(item.logs).toString('base64'),
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    stop() {
        if (this.task) {
            this.task.stop();
            console.log('[RabbittAgent] Stopped.');
        }
    }
}

function runCli() {
    if (process.argv.includes('logs')) {
        const { spawn } = require('child_process');
        console.log('[RabbittAgent] Streaming service logs from journalctl...');
        const child = spawn('sudo', ['journalctl', '-u', 'rabbitt-agent', '-n', '50', '-f'], {
            stdio: 'inherit'
        });
        child.on('error', (err: any) => {
            console.error('Failed to start journalctl logs stream:', err.message || err);
            process.exit(1);
        });
        child.on('exit', (code: number) => {
            process.exit(code || 0);
        });
        return;
    }

    if (process.argv.includes('--version') || process.argv.includes('-v') || process.argv.includes('version')) {
        try {
            const pkg = require('../package.json');
            console.log(pkg.version);
        } catch {
            console.log('1.0.6');
        }
        process.exit(0);
    }
    if (process.argv.includes('--which') || process.argv.includes('which')) {
        try {
            const fs = require('fs');
            const execPath = fs.realpathSync(process.argv[1] || __filename);
            console.log(execPath);
        } catch {
            console.log(__filename);
        }
        process.exit(0);
    }
    if (process.argv.includes('--help') || process.argv.includes('-h') || process.argv.includes('help')) {
        console.log('Rabbittize VPS Monitoring Agent');
        console.log('Usage: rabbitt-agent [options/commands]');
        console.log('Options/Commands:');
        console.log('  logs                    Stream the agent systemd logs (aliases journalctl)');
        console.log('  -v, --version, version  Output the version number');
        console.log('  -h, --help, help        Output usage information');
        console.log('  --which, which          Output the absolute path of the executing script');
        console.log('Environment variables:');
        console.log('  AGENT_ID        The unique agent ID');
        console.log('  INGEST_KEY      The ingestion API key');
        console.log('  API_BASE_URL    Base URL of the API server (default: http://localhost:4000)');
        console.log('  COLLECTION_INTERVAL The collection interval in seconds (default: 300)');
        console.log('  ENABLED_SOURCES Comma-separated sources to collect (default: system,docker,pm2,nginx)');
        process.exit(0);
    }

    const config: AgentConfig = {
        agentId: process.env.AGENT_ID || '',
        ingestKey: process.env.INGEST_KEY || '',
        apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
        collectionInterval: parseInt(process.env.COLLECTION_INTERVAL || '300', 10),
        enabledSources: (process.env.ENABLED_SOURCES || 'system,docker,pm2,nginx').split(',')
    };

    if (!config.agentId || !config.ingestKey) {
        console.error('AGENT_ID and INGEST_KEY environment variables are required.');
        process.exit(1);
    }

    const agent = new RabbittAgent(config);
    agent.start();
}

if (require.main === module) {
    runCli();
}
