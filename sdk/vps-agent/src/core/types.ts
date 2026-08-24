export interface AgentConfig {
    agentId: string;
    ingestKey: string;
    apiBaseUrl: string;
    collectionInterval: number; // seconds
    enabledSources: string[];
}

export interface LogPayload {
    source: string;
    service: string;
    logsBase64: string;
    timestamp: string;
}

export interface SystemMetrics {
    cpuPercent: number;
    ramUsedMb: number;
    ramTotalMb: number;
    diskUsedPercent: number;
    timestamp: string;
}
