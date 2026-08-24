import { z } from "zod";
import { ServiceDefinition, commonServices } from "./common.registry";
import { awsServices } from "./aws.registry";
import { azureServices } from "./azure.registry";
import { gcpServices } from "./gcp.registry";

export * from "./common.registry";
export * from "./aws.registry";
export * from "./azure.registry";
export * from "./gcp.registry";

export const serviceRegistry: ServiceDefinition[] = [
  ...commonServices,
  ...awsServices,
  ...azureServices,
  ...gcpServices,
];

export const ServiceSchemas: Record<string, z.ZodObject<any>> = {};
serviceRegistry.forEach((s) => {
  if (s.schema) {
    ServiceSchemas[s.id] = s.schema as z.ZodObject<any>;
  }
});

export function findService(id: string): ServiceDefinition | undefined {
  return serviceRegistry.find((s) => s.id === id);
}

export function filterServices(query: string, provider?: ServiceDefinition["provider"]): ServiceDefinition[] {
  const q = query.trim().toLowerCase();
  const services = provider ? serviceRegistry.filter((service) => service.provider === provider) : serviceRegistry;
  if (!q) return [...services];
  return services.filter(
    (s) =>
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.provider.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q),
  );
}
