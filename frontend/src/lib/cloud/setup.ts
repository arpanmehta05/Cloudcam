export interface CloudModule {
    id: string;
    label: string;
    desc: string;
    checked: boolean;
    disabled: boolean;
    iconName?: string;
}

export const CLOUD_MODULES: CloudModule[] = [
    { id: "core", label: "Core Monitoring", desc: "Metrics, inventory & health monitoring", checked: true, disabled: true },
    { id: "cost", label: "Cost Analytics", desc: "Cost utilization explorer, projections & waste analysis", checked: true, disabled: true },
    { id: "security", label: "Security Insights", desc: "IAM, security hub rules & guardrails compliance", checked: true, disabled: true },
    { id: "ai", label: "AI Observability", desc: "Token tracking, model usage, errors & prompt tracing", checked: true, disabled: false, iconName: "Brain" },
    { id: "logs", label: "Log Forwarding", desc: "Ingest subscription logs for advanced log analysis", checked: false, disabled: false, iconName: "FileText" },
];
