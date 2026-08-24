import type { CloudProvider } from "@/lib/regions";
import { getProviderCopy } from "./provider-status";
import { getCloudProviderDefinition, type ProviderServiceSignal } from "./provider-registry";

export function getProviderServiceSignals(provider: CloudProvider): ProviderServiceSignal[] {
    return getCloudProviderDefinition(provider).serviceSignals;
}

export function getProviderAlarmLabel(provider: CloudProvider): string {
    return getCloudProviderDefinition(provider).alarmLabel;
}

export function getProviderLogStreamLabel(provider: CloudProvider): string {
    return `${getProviderCopy(provider).metricsSource.toUpperCase()} STREAM`;
}

export function getProviderLogSetupLabel(provider: CloudProvider): string {
    return getCloudProviderDefinition(provider).logSetupLabel;
}
