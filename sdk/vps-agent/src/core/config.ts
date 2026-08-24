import axios from 'axios';
import { AgentConfig } from './types';

export class ConfigPoller {
    private config: AgentConfig;
    private interval: NodeJS.Timeout | null = null;

    constructor(currentConfig: AgentConfig) {
        this.config = currentConfig;
    }

    start(onUpdate: (newConfig: Partial<AgentConfig>) => void) {
        // Poll every 10 minutes for configuration changes
        this.interval = setInterval(async () => {
            try {
                const url = `${this.config.apiBaseUrl}/api/vps-logs/agents`;
                const response = await axios.get(url, {
                    headers: {
                        'x-agent-id': this.config.agentId,
                        'x-ingest-key': this.config.ingestKey
                    }
                });

                if (response.data.success && response.data.agents) {
                    const myAgent = response.data.agents.find((a: any) => a.agentId === this.config.agentId);
                    if (myAgent) {
                        onUpdate({
                            collectionInterval: myAgent.collectionInterval,
                            enabledSources: myAgent.enabledSources
                        });
                    }
                }
            } catch (error) {
                console.error('[ConfigPoller] Failed to poll for updates:', error);
            }
        }, 10 * 60 * 1000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}
