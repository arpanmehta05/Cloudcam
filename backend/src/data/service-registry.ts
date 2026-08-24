// Service Registry v2 - CloudWatch-based public facade.
// Provider/domain registries live under ./service-registry.

export type {
  CloudWatchMetricDefinition,
  CostRule,
  ServiceCategory,
  ServiceConfig,
} from "./service-registry/types";
export { ALL_SERVICES, SERVICE_REGISTRY } from "./service-registry/registry";
export {
  getAllNamespaces,
  getMetricQueries,
  getServiceByNamespace,
  getServicesByCategory,
} from "./service-registry/helpers";
