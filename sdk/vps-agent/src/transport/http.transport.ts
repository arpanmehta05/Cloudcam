import axios from 'axios';
import { AgentConfig, LogPayload } from '../core/types';
import { LogBuffer } from '../core/buffer';

export class IngestService {
    private config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
    }

    async ingest(payload: LogPayload): Promise<boolean> {
        try {
            const url = `${this.config.apiBaseUrl}/api/vps-logs/ingest`;
            await axios.post(url, payload, {
                headers: {
                    'x-agent-id': this.config.agentId,
                    'x-ingest-key': this.config.ingestKey,
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'true',
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            return true;
        } catch (error: any) {
            console.error('[IngestService] Failed to send logs, buffering locally...', error?.message);
            if (error?.response) {
                console.error('[IngestService] Response config/data:', error.response.status, error.response.data);
            }
            LogBuffer.bufferLocally(payload);
            return false;
        }
    }

    async flushBuffer() {
        if (!LogBuffer.exists()) return;
        
        console.log('[IngestService] Attempting to flush local buffer...');
        try {
            const buffer = LogBuffer.getBuffered();
            if (buffer.length === 0) return;

            const remaining: LogPayload[] = [];
            for (const payload of buffer) {
                try {
                    const url = `${this.config.apiBaseUrl}/api/vps-logs/ingest`;
                    await axios.post(url, payload, {
                        headers: {
                            'x-agent-id': this.config.agentId,
                            'x-ingest-key': this.config.ingestKey,
                            'Content-Type': 'application/json',
                            'Bypass-Tunnel-Reminder': 'true',
                            'ngrok-skip-browser-warning': 'true'
                        }
                    });
                } catch (error: any) {
                    console.error('[IngestService] Flush error:', error?.message);
                    remaining.push(payload);
                }
            }

            LogBuffer.writeBuffer(remaining);
            console.log(`[IngestService] Flushed buffer. ${buffer.length - remaining.length} sent, ${remaining.length} remaining.`);
        } catch (err) {
            console.error('[IngestService] Failed to flush buffer', err);
        }
    }
}
