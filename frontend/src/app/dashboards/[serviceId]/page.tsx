"use client";

import { use, useEffect, useState } from "react";
import { ServiceDashboard } from "@/modules/cloud-dashboard";
import { SERVICE_REGISTRY } from "@/lib/services/registry";
import { AlertCircle, ArrowLeft, CloudIcon, Sparkles } from "@/icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { useRegion } from "@/context/RegionContext";
import { getProviderCopy } from "@/lib/cloud/provider-status";

function inventoryKeyForService(serviceId: string): string {
    const map: Record<string, string> = {
        azure_vm: "ec2",
        azure_storage: "s3",
        azure_sql: "rds",
        azure_function: "lambda",
        azure_vnet: "efs",
        gcp_compute: "ec2",
        gcp_storage: "s3",
        gcp_sql: "rds",
        gcp_function: "lambda",
        gcp_gke: "eks",
    };
    return map[serviceId] || serviceId;
}

export default function ServiceDashboardPage({ params }: { params: Promise<{ serviceId: string }> }) {
    const resolvedParams = use(params);
    const serviceId = inventoryKeyForService(resolvedParams.serviceId);
    const [connected, setConnected] = useState<boolean | null>(null);
    const { selectedProvider } = useRegion();
    const providerCopy = getProviderCopy(selectedProvider);

    const service = SERVICE_REGISTRY[serviceId];

    // Check if user has active provider connected (JWT provides identity)
    useEffect(() => {
        setConnected(null);
        authFetch(`/api/${selectedProvider}/credentials`)
            .then(r => r.json())
            .then(data => {
                if (selectedProvider === "aws") {
                    setConnected(data.connected && !!data.roleArn);
                } else if (selectedProvider === "azure") {
                    setConnected(data.connected && !!data.subscriptionId);
                } else if (selectedProvider === "gcp") {
                    setConnected(data.connected && !!data.projectId);
                } else {
                    setConnected(data.connected);
                }
            })
            .catch(() => setConnected(false));
    }, [selectedProvider]);

    if (connected === null) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center rounded-lg border border-[#E2E8F0] bg-white/80 dark:border-[#1E293B] dark:bg-[#07111F]/80">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1A56DB] border-t-transparent" />
            </div>
        );
    }

    if (connected === false) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-lg border border-[#E2E8F0] bg-white/88 p-8 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#07111F]/88">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                    <CloudIcon className="h-8 w-8" />
                </div>
                <div>
                    <h2 className="mb-2 text-xl font-extrabold text-[#020617] dark:text-white">{providerCopy.connectTitle}</h2>
                    <p className="max-w-sm text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
                        Connect your {providerCopy.accountName} with the {providerCopy.setupObject} flow to start monitoring.
                    </p>
                </div>
                <Button asChild>
                    <Link href={providerCopy.setupHref}>Connect {providerCopy.accountName}</Link>
                </Button>
            </div>
        );
    }

    if (!service) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-lg border border-[#E2E8F0] bg-white/88 p-8 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#07111F]/88">
                <AlertCircle className="mb-4 h-12 w-12 text-[#EF4444]" />
                <h1 className="mb-2 text-2xl font-extrabold text-[#020617] dark:text-white">Service Not Found</h1>
                <p className="mb-6 max-w-md text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
                    The requested service dashboard &quot;{serviceId}&quot; is not currently supported or does not exist in our registry.
                </p>
                <Button asChild variant="outline">
                    <Link href="/dashboard">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Overview
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-white/88 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/88">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-sm font-bold text-[#64748B] transition-colors hover:text-[#1A56DB] dark:text-[#94A3B8] dark:hover:text-[#6BA3F8]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Overview
                </Link>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-xs font-extrabold text-[#1A56DB] shadow-sm dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Service workspace
                </div>
            </div>

            <ServiceDashboard serviceId={serviceId} />
        </div>
    );
}
