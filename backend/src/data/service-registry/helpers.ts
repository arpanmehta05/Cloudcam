import { SERVICE_REGISTRY } from "./registry";
import type { CloudWatchMetricDefinition, ServiceCategory } from "./types";

export function getServicesByCategory(category: ServiceCategory): string[] {
  return Object.entries(SERVICE_REGISTRY)
    .filter(([, config]) => config.category === category)
    .map(([name]) => name);
}

export function getAllNamespaces(): string[] {
  const namespaces = new Set<string>();
  for (const service of Object.values(SERVICE_REGISTRY)) {
    for (const metric of service.metrics) {
      namespaces.add(metric.namespace);
    }
  }
  return Array.from(namespaces);
}

export function getServiceByNamespace(namespace: string): string | null {
  for (const [key, config] of Object.entries(SERVICE_REGISTRY)) {
    if (config.metrics.some((metric) => metric.namespace === namespace)) {
      return key;
    }
  }
  return null;
}

export function getMetricQueries(
  serviceKey: string,
): CloudWatchMetricDefinition[] {
  return SERVICE_REGISTRY[serviceKey]?.metrics || [];
}
