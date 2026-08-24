// Parse a Zod schema into form field descriptors for dynamic rendering
import { z } from "zod";

export type FieldType = "text" | "number" | "select" | "boolean" | "rules";

export interface FieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: string | number | boolean;
  options?: Array<{ value: string | number; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  provider?: "aws" | "azure" | "gcp";
}

// Common presets for known fields by cloud provider
const AWS_PRESETS: Record<string, Array<{ value: string | number; label: string }>> = {
  region: [
    { value: "us-east-1", label: "US East (N. Virginia)" },
    { value: "us-east-2", label: "US East (Ohio)" },
    { value: "us-west-1", label: "US West (N. California)" },
    { value: "us-west-2", label: "US West (Oregon)" },
    { value: "eu-west-1", label: "EU (Ireland)" },
    { value: "eu-central-1", label: "EU (Frankfurt)" },
    { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
    { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
    { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  ],
  instanceType: [
    { value: "t3.micro", label: "t3.micro (0.5GB, 2 vCPU)" },
    { value: "t3.small", label: "t3.small (2GB, 2 vCPU)" },
    { value: "t3.medium", label: "t3.medium (4GB, 2 vCPU)" },
    { value: "t3.large", label: "t3.large (8GB, 2 vCPU)" },
    { value: "t3.xlarge", label: "t3.xlarge (16GB, 4 vCPU)" },
    { value: "t3.2xlarge", label: "t3.2xlarge (32GB, 8 vCPU)" },
    { value: "t4g.micro", label: "t4g.micro (0.5GB, 2 vCPU, ARM)" },
    { value: "t4g.small", label: "t4g.small (2GB, 2 vCPU, ARM)" },
    { value: "t4g.medium", label: "t4g.medium (4GB, 2 vCPU, ARM)" },
    { value: "t4g.large", label: "t4g.large (8GB, 2 vCPU, ARM)" },
    { value: "m5.large", label: "m5.large (8GB, 2 vCPU)" },
    { value: "m5.xlarge", label: "m5.xlarge (16GB, 4 vCPU)" },
    { value: "m5.2xlarge", label: "m5.2xlarge (32GB, 8 vCPU)" },
    { value: "m6i.large", label: "m6i.large (8GB, 2 vCPU, Intel)" },
    { value: "m6i.xlarge", label: "m6i.xlarge (16GB, 4 vCPU, Intel)" },
    { value: "c5.large", label: "c5.large (4GB, 2 vCPU)" },
    { value: "c5.xlarge", label: "c5.xlarge (8GB, 4 vCPU)" },
    { value: "c5.2xlarge", label: "c5.2xlarge (16GB, 8 vCPU)" },
    { value: "c6i.large", label: "c6i.large (4GB, 2 vCPU, Intel)" },
    { value: "c6i.xlarge", label: "c6i.xlarge (8GB, 4 vCPU, Intel)" },
    { value: "r5.large", label: "r5.large (16GB, 2 vCPU)" },
    { value: "r5.xlarge", label: "r5.xlarge (32GB, 4 vCPU)" },
    { value: "r6i.large", label: "r6i.large (16GB, 2 vCPU, Intel)" },
  ],
  engine: [
    { value: "postgres", label: "PostgreSQL" },
    { value: "mysql", label: "MySQL" },
    { value: "mariadb", label: "MariaDB" },
    { value: "oracle", label: "Oracle" },
    { value: "sqlserver", label: "SQL Server" },
  ],
  runtime: [
    { value: "nodejs20.x", label: "Node.js 20.x" },
    { value: "nodejs18.x", label: "Node.js 18.x" },
    { value: "python3.12", label: "Python 3.12" },
    { value: "python3.11", label: "Python 3.11" },
    { value: "java21", label: "Java 21" },
    { value: "java17", label: "Java 17" },
    { value: "ruby3.3", label: "Ruby 3.3" },
    { value: "dotnet8", label: ".NET 8" },
  ],
  memoryMb: [
    { value: 128, label: "128 MB" },
    { value: 256, label: "256 MB" },
    { value: 512, label: "512 MB" },
    { value: 1024, label: "1 GB" },
    { value: 2048, label: "2 GB" },
    { value: 3008, label: "3008 MB" },
    { value: 4096, label: "4 GB" },
    { value: 5120, label: "5 GB" },
    { value: 10240, label: "10 GB" },
  ],
  appRuntime: [
    { value: "nodejs20", label: "Node.js 20 & npm" },
    { value: "python3", label: "Python 3.11 & pip" },
    { value: "docker", label: "Docker & Compose" },
  ],
  projectType: [
    { value: "generic_node", label: "Generic Node/Python" },
    { value: "node_api", label: "Node API" },
    { value: "vite_spa", label: "Vite Frontend" },
    { value: "mern", label: "MERN App" },
    { value: "nextjs", label: "Next.js App" },
    { value: "docker", label: "Docker App" },
  ],
  repositoryMode: [
    { value: "new", label: "Create New Repository" },
    { value: "existing", label: "Use Existing Repository" },
  ],
  imageMutability: [
    { value: "MUTABLE", label: "MUTABLE (Allows tag overwrites)" },
    { value: "IMMUTABLE", label: "IMMUTABLE (Prevents tag overwrites)" },
  ],
  launchType: [
    { value: "FARGATE", label: "FARGATE (Serverless)" },
    { value: "EC2", label: "EC2 (Virtual Machine Hosts)" },
  ],
  cpu: [
    { value: "256", label: "0.25 vCPU (256)" },
    { value: "512", label: "0.5 vCPU (512)" },
    { value: "1024", label: "1.0 vCPU (1024)" },
    { value: "2048", label: "2.0 vCPU (2048)" },
    { value: "4096", label: "4.0 vCPU (4096)" },
  ],
  memory: [
    { value: "512", label: "512 MB" },
    { value: "1024", label: "1 GB" },
    { value: "2048", label: "2 GB" },
    { value: "4096", label: "4 GB" },
    { value: "8192", label: "8 GB" },
    { value: "16384", label: "16 GB" },
  ],
};

const AZURE_PRESETS: Record<string, Array<{ value: string | number; label: string }>> = {
  region: [
    { value: "centralindia", label: "Central India (Pune)" },
    { value: "eastus", label: "East US (Virginia)" },
    { value: "eastus2", label: "East US 2 (Virginia)" },
    { value: "westus2", label: "West US 2 (Washington)" },
    { value: "northeurope", label: "North Europe (Ireland)" },
    { value: "westeurope", label: "West Europe (Netherlands)" },
    { value: "southeastasia", label: "Southeast Asia (Singapore)" },
  ],
  vmSize: [
    // B-Series (Burstable / Cost-effective)
    { value: "Standard_B1s", label: "Standard_B1s (1 vCPU, 1 GiB RAM)" },
    { value: "Standard_B2ats_v2", label: "Standard_B2ats_v2 (2 vCPU, 1 GiB RAM)" },
    { value: "Standard_B1ms", label: "Standard_B1ms (1 vCPU, 2 GiB RAM)" },
    { value: "Standard_B2s", label: "Standard_B2s (2 vCPU, 4 GiB RAM)" },
    { value: "Standard_B2ms", label: "Standard_B2ms (2 vCPU, 8 GiB RAM)" },
    { value: "Standard_B4ms", label: "Standard_B4ms (4 vCPU, 16 GiB RAM)" },
    { value: "Standard_B8ms", label: "Standard_B8ms (8 vCPU, 32 GiB RAM)" },
    // D-Series (General Purpose v5)
    { value: "Standard_D2s_v5", label: "Standard_D2s_v5 (2 vCPU, 8 GiB RAM)" },
    { value: "Standard_D4s_v5", label: "Standard_D4s_v5 (4 vCPU, 16 GiB RAM)" },
    { value: "Standard_D8s_v5", label: "Standard_D8s_v5 (8 vCPU, 32 GiB RAM)" },
    { value: "Standard_D16s_v5", label: "Standard_D16s_v5 (16 vCPU, 64 GiB RAM)" },
    { value: "Standard_D32s_v5", label: "Standard_D32s_v5 (32 vCPU, 128 GiB RAM)" },
    // D-Series (General Purpose v4)
    { value: "Standard_D2s_v4", label: "Standard_D2s_v4 (2 vCPU, 8 GiB RAM)" },
    { value: "Standard_D4s_v4", label: "Standard_D4s_v4 (4 vCPU, 16 GiB RAM)" },
    { value: "Standard_D8s_v4", label: "Standard_D8s_v4 (8 vCPU, 32 GiB RAM)" },
    // F-Series (Compute Optimized v2)
    { value: "Standard_F2s_v2", label: "Standard_F2s_v2 (2 vCPU, 4 GiB RAM)" },
    { value: "Standard_F4s_v2", label: "Standard_F4s_v2 (4 vCPU, 8 GiB RAM)" },
    { value: "Standard_F8s_v2", label: "Standard_F8s_v2 (8 vCPU, 16 GiB RAM)" },
    // E-Series (Memory Optimized v5)
    { value: "Standard_E2s_v5", label: "Standard_E2s_v5 (2 vCPU, 16 GiB RAM)" },
    { value: "Standard_E4s_v5", label: "Standard_E4s_v5 (4 vCPU, 32 GiB RAM)" },
    { value: "Standard_E8s_v5", label: "Standard_E8s_v5 (8 vCPU, 64 GiB RAM)" },
  ],
  accountTier: [
    { value: "Standard", label: "Standard" },
    { value: "Premium", label: "Premium" },
  ],
  replicationType: [
    { value: "LRS", label: "Locally Redundant (LRS)" },
    { value: "GRS", label: "Geo-Redundant (GRS)" },
    { value: "RA-GRS", label: "Read-Access Geo-Redundant (RA-GRS)" },
    { value: "ZRS", label: "Zone-Redundant (ZRS)" },
  ],
  accountKind: [
    { value: "StorageV2", label: "General Purpose v2 (StorageV2)" },
    { value: "Storage", label: "General Purpose v1 (Storage)" },
    { value: "BlobStorage", label: "Blob Storage" },
  ],
  skuName: [
    { value: "S0", label: "S0 (Standard 10 DTUs)" },
    { value: "S1", label: "S1 (Standard 20 DTUs)" },
    { value: "GP_Gen5_2", label: "General Purpose Gen5 (2 vCPUs)" },
    { value: "Y1", label: "Consumption Plan (Y1)" },
    { value: "EP1", label: "Premium Plan (EP1)" },
  ],
  appRuntime: [
    { value: "nodejs20", label: "Node.js 20 & npm" },
    { value: "python3", label: "Python 3.11 & pip" },
    { value: "docker", label: "Docker & Compose" },
  ],
  projectType: [
    { value: "generic_node", label: "Generic Node/Python" },
    { value: "node_api", label: "Node API" },
    { value: "vite_spa", label: "Vite Frontend" },
    { value: "mern", label: "MERN App" },
    { value: "nextjs", label: "Next.js App" },
    { value: "docker", label: "Docker App" },
  ],
};

const GCP_PRESETS: Record<string, Array<{ value: string | number; label: string }>> = {
  region: [
    { value: "us-central1", label: "us-central1 (Iowa)" },
    { value: "us-east1", label: "us-east1 (South Carolina)" },
    { value: "us-west1", label: "us-west1 (Oregon)" },
    { value: "europe-west1", label: "europe-west1 (Belgium)" },
    { value: "europe-west3", label: "europe-west3 (Frankfurt)" },
    { value: "asia-south1", label: "asia-south1 (Mumbai)" },
    { value: "asia-southeast1", label: "asia-southeast1 (Singapore)" },
  ],
  zone: [
    { value: "us-central1-a", label: "us-central1-a" },
    { value: "us-central1-b", label: "us-central1-b" },
    { value: "us-central1-c", label: "us-central1-c" },
    { value: "us-central1-f", label: "us-central1-f" },
    { value: "us-east1-b", label: "us-east1-b" },
    { value: "us-east1-c", label: "us-east1-c" },
    { value: "us-east1-d", label: "us-east1-d" },
    { value: "europe-west1-b", label: "europe-west1-b" },
    { value: "europe-west1-c", label: "europe-west1-c" },
    { value: "asia-south1-a", label: "asia-south1-a" },
    { value: "asia-south1-b", label: "asia-south1-b" },
  ],
  machineType: [
    { value: "e2-micro", label: "e2-micro (2 vCPU, 1 GB RAM)" },
    { value: "e2-small", label: "e2-small (2 vCPU, 2 GB RAM)" },
    { value: "e2-medium", label: "e2-medium (2 vCPU, 4 GB RAM)" },
    { value: "e2-standard-2", label: "e2-standard-2 (2 vCPU, 8 GB RAM)" },
    { value: "n2-standard-2", label: "n2-standard-2 (2 vCPU, 8 GB RAM)" },
  ],
  tier: [
    { value: "db-f1-micro", label: "db-f1-micro (Shared 1 vCPU, 0.6 GB RAM)" },
    { value: "db-g1-small", label: "db-g1-small (Shared 1 vCPU, 1.7 GB RAM)" },
    { value: "db-custom-1-3840", label: "db-custom-1-3840 (1 vCPU, 3.75 GB RAM)" },
    { value: "db-custom-2-7680", label: "db-custom-2-7680 (2 vCPU, 7.5 GB RAM)" },
  ],
  image: [
    { value: "projects/debian-cloud/global/images/family/debian-12", label: "Debian 12" },
    { value: "projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts", label: "Ubuntu 22.04 LTS" },
    { value: "projects/rhel-cloud/global/images/family/rhel-9", label: "Red Hat Enterprise Linux 9" },
    { value: "projects/rocky-linux-cloud/global/images/family/rocky-linux-9", label: "Rocky Linux 9" },
  ],
  storageClass: [
    { value: "STANDARD", label: "Standard (Frequent access)" },
    { value: "NEARLINE", label: "Nearline (Infrequent access < 30 days)" },
    { value: "COLDLINE", label: "Coldline (Infrequent access < 90 days)" },
    { value: "ARCHIVE", label: "Archive (Long-term preservation)" },
  ],
  location: [
    { value: "US", label: "US (Multi-region)" },
    { value: "EU", label: "EU (Multi-region)" },
    { value: "ASIA", label: "ASIA (Multi-region)" },
    { value: "us-central1", label: "us-central1 (Iowa)" },
    { value: "europe-west1", label: "europe-west1 (Belgium)" },
    { value: "asia-south1", label: "asia-south1 (Mumbai)" },
  ],
  databaseVersion: [
    { value: "POSTGRES_16", label: "PostgreSQL 16" },
    { value: "POSTGRES_15", label: "PostgreSQL 15" },
    { value: "POSTGRES_14", label: "PostgreSQL 14" },
    { value: "MYSQL_8_0", label: "MySQL 8.0" },
    { value: "MYSQL_5_7", label: "MySQL 5.7" },
  ],
  runtime: [
    { value: "nodejs20", label: "Node.js 20" },
    { value: "nodejs18", label: "Node.js 18" },
    { value: "python311", label: "Python 3.11" },
    { value: "python310", label: "Python 3.10" },
    { value: "go121", label: "Go 1.21" },
    { value: "java17", label: "Java 17" },
  ],
  appRuntime: [
    { value: "nodejs20", label: "Node.js 20 & npm" },
    { value: "python3", label: "Python 3.11 & pip" },
    { value: "docker", label: "Docker & Compose" },
  ],
  projectType: [
    { value: "generic_node", label: "Generic Node/Python" },
    { value: "node_api", label: "Node API" },
    { value: "vite_spa", label: "Vite Frontend" },
    { value: "mern", label: "MERN App" },
    { value: "nextjs", label: "Next.js App" },
    { value: "docker", label: "Docker App" },
  ],
};

function getPresetsForProvider(provider: "aws" | "azure" | "gcp"): Record<string, Array<{ value: string | number; label: string }>> {
  if (provider === "azure") return AZURE_PRESETS;
  if (provider === "gcp") return GCP_PRESETS;
  return AWS_PRESETS;
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Mb$/, " (MB)")
    .replace(/Gb$/, " (GB)")
    .replace(/Sec$/, " (s)");
}

function unwrap(zodType: z.ZodTypeAny): z.ZodTypeAny {
  if (zodType._def.typeName === "ZodDefault" || zodType._def.typeName === "ZodOptional") {
    return unwrap(zodType._def.innerType);
  }
  if (zodType._def.typeName === "ZodEffects") {
    return unwrap(zodType._def.schema);
  }
  return zodType;
}

function getDefaultValue(field: z.ZodAny): string | number | boolean {
  const def = field._def as unknown as Record<string, unknown>;
  if (def.typeName === "ZodDefault") {
    const defaultFactory = def.defaultValue;
    const value = typeof defaultFactory === "function"
      ? (defaultFactory as () => unknown)()
      : defaultFactory;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    return "";
  }
  if (def.typeName === "ZodOptional" && def.innerType) {
    // ZodDefault or ZodOptional
    const inner = def.innerType as z.ZodAny;
    return getDefaultValue(inner);
  }
  if (def.default && typeof def.default === "function") {
    return (def.default as () => string | number | boolean)();
  }
  if (def.schema) {
    return getDefaultValue(def.schema as z.ZodAny);
  }
  if (def.typeName === "ZodBoolean") return false;
  if (def.typeName === "ZodNumber") return 0;
  return "";
}

function isSelectCandidate(key: string, zodType: z.ZodAny, provider: "aws" | "azure" | "gcp" = "aws"): boolean {
  const presets = getPresetsForProvider(provider);
  // Check if the key has a known preset
  if (presets[key]) return true;

  // Check ZodEnum or ZodNativeEnum
  const base = unwrap(zodType);
  if (base._def.values && Array.isArray(base._def.values)) return true;
  if (base._def.values && typeof base._def.values === "object") return true;

  return false;
}

export function parseZodFields(schema: z.ZodObject<any>, provider: "aws" | "azure" | "gcp" = "aws"): FieldDescriptor[] {
  const shape = schema.shape;
  const fields: FieldDescriptor[] = [];
  const presets = getPresetsForProvider(provider);

  for (const [key, field] of Object.entries(shape)) {
    const rawTypeName = (field as z.ZodAny)._def.typeName as string;
    const isOptional = rawTypeName === "ZodOptional" || rawTypeName === "ZodDefault";    
    const baseType = unwrap(field as z.ZodAny);
    const typeName = baseType._def.typeName;

    let type: FieldType = "text";
    if (typeName === "ZodNumber") type = "number";
    else if (typeName === "ZodBoolean") type = "boolean";
    else if (typeName === "ZodArray" && key === "rules") type = "rules";
    else if (isSelectCandidate(key, field as z.ZodAny, provider)) type = "select";

    // For select fields backed by number presets (memoryMb), keep type as select but handle number values
    if (type === "select" && presets[key]?.[0]?.value && typeof presets[key][0].value === "number") {
      type = "select";
    }

    const base = unwrap(field as z.ZodAny) as z.ZodAny;
    let defaultValue = getDefaultValue(field as z.ZodAny);

    // Normalize default value for numeric selects
    if (type === "select" && typeof defaultValue === "number" && presets[key]) {
      defaultValue = presets[key].find((o) => o.value === defaultValue)?.value ?? defaultValue;
    }

    let options = type === "select" ? presets[key] : undefined;
    if (type === "select" && (!options || options.length === 0)) {
      const innerDef = base._def as any;
      if (innerDef.values && Array.isArray(innerDef.values)) {
        options = innerDef.values.map((v: string) => ({
          value: v,
          label: formatLabel(v),
        }));
      } else if (innerDef.values && typeof innerDef.values === "object") {
        options = Object.keys(innerDef.values).map((v: string) => ({
          value: v,
          label: formatLabel(v),
        }));
      } else {
        options = [];
      }
    }

    fields.push({
      key,
      label: formatLabel(key),
      type,
      required: !isOptional,
      defaultValue,
      options,
      min: (base._def as any).typeName === "ZodNumber" ? ((base._def as any).minvalue as number | undefined) : undefined,
      max: (base._def as any).typeName === "ZodNumber" ? ((base._def as any).maxvalue as number | undefined) : undefined,
      step: type === "number" ? 1 : undefined,
      placeholder: type === "text" ? `Enter ${key}` : undefined,
      provider,
    });
  }

  return fields;
}

export function validateField(
  field: FieldDescriptor,
  value: any,
): string | null {
  if (field.type === "rules") {
    if (!value) return field.required ? "Rules are required" : null;
    if (!Array.isArray(value)) return "Rules must be an array";
    for (const rule of value) {
      if (!rule || typeof rule !== "object") return "Invalid rule structure";
      if (!["ingress", "egress"].includes(rule.type)) return "Rule type must be ingress or egress";
      
      const fromPort = Number(rule.fromPort);
      const toPort = Number(rule.toPort);
      
      if (rule.protocol !== "all" && rule.protocol !== "icmp") {
        if (Number.isNaN(fromPort) || fromPort < 1 || fromPort > 65535) return "Port must be between 1 and 65535";
        if (Number.isNaN(toPort) || toPort < 1 || toPort > 65535) return "Port must be between 1 and 65535";
        if (fromPort > toPort) return "From Port cannot be greater than To Port";
      }
      
      if (!rule.protocol || typeof rule.protocol !== "string") return "Protocol must be a string";
      if (!rule.cidrBlocks || typeof rule.cidrBlocks !== "string") return "CIDR block is required";
    }
    return null;
  }

  if (!field.required && (value === undefined || value === "")) {
    return null;
  }

  if (field.required && (value === undefined || value === "")) {
    return "This field is required";
  }

  if (field.type === "number") {
    const num = Number(value);
    if (Number.isNaN(num)) return "Must be a valid number";
    if (field.min !== undefined && num < field.min) return `Minimum is ${field.min}`;
    if (field.max !== undefined && num > field.max) return `Maximum is ${field.max}`;
  }

  if (field.type === "text" && typeof value === "string") {
    const provider = field.provider;
    const key = field.key;
    const name = value.trim();

    if (key === "addressSpace") {
      const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:3[0-2]|[12]?[0-9])$/;
      if (!cidrRegex.test(name)) {
        return "Must be a valid CIDR block (e.g. 10.0.0.0/16)";
      }
    }

    if (provider === "gcp") {
      if (["instanceName", "databaseName", "functionName", "clusterName"].includes(key)) {
        const regex = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
        const maxLen = key === "clusterName" ? 40 : 63;
        if (name.length < 1 || name.length > maxLen) {
          return `Name must be between 1 and ${maxLen} characters long`;
        }
        if (!regex.test(name)) {
          return "Name must start with a lowercase letter, end with a lowercase letter or number, and contain only lowercase letters, numbers, and hyphens";
        }
      } else if (key === "bucketName") {
        const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
        if (name.length < 3 || name.length > 63) {
          return "Bucket name must be between 3 and 63 characters long";
        }
        if (!regex.test(name)) {
          return "Bucket name must start and end with a lowercase letter or number, and contain only lowercase letters, numbers, and hyphens";
        }
      }
    } else if (provider === "aws") {
      if (key === "bucketName") {
        const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
        if (name.length < 3 || name.length > 63) {
          return "Bucket name must be between 3 and 63 characters long";
        }
        if (!regex.test(name)) {
          return "Bucket name must start and end with a lowercase letter or number, and contain only lowercase letters, numbers, and hyphens";
        }
      } else if (key === "dbName") {
        const regex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
        if (name.length < 1 || name.length > 64) {
          return "Database name must be between 1 and 64 characters long";
        }
        if (!regex.test(name)) {
          return "Database name must start with a letter and contain only letters, numbers, and underscores";
        }
      } else if (key === "functionName" || key === "clusterName") {
        const regex = /^[a-zA-Z0-9-_]+$/;
        const maxLen = key === "clusterName" ? 100 : 64;
        if (name.length < 1 || name.length > maxLen) {
          return `Name must be between 1 and ${maxLen} characters long`;
        }
        if (!regex.test(name)) {
          return "Name must contain only letters, numbers, hyphens, and underscores";
        }
      } else if (key === "tableName") {
        const regex = /^[a-zA-Z0-9_.-]+$/;
        if (name.length < 3 || name.length > 255) {
          return "Table name must be between 3 and 255 characters long";
        }
        if (!regex.test(name)) {
          return "Table name must contain only letters, numbers, underscores, hyphens, and dots";
        }
      }
    } else if (provider === "azure") {
      if (key === "bucketName") {
        const regex = /^[a-z0-9]{3,24}$/;
        if (!regex.test(name)) {
          return "Storage account name must be between 3 and 24 characters long and contain only lowercase letters and numbers";
        }
      } else if (key === "instanceName" || key === "dbName" || key === "vnetName") {
        const regex = /^[a-zA-Z0-9-_.]+$/;
        const minLen = key === "vnetName" ? 2 : 1;
        const maxLen = key === "dbName" ? 128 : 64;
        if (name.length < minLen || name.length > maxLen) {
          return `Name must be between ${minLen} and ${maxLen} characters long`;
        }
        if (!regex.test(name)) {
          return "Name must contain only letters, numbers, hyphens, underscores, and periods";
        }
      } else if (key === "functionName") {
        const regex = /^[a-zA-Z0-9-]+$/;
        if (name.length < 1 || name.length > 60) {
          return "Function app name must be between 1 and 60 characters long";
        }
        if (!regex.test(name)) {
          return "Function app name must contain only letters, numbers, and hyphens";
        }
      }
    }
  }

  return null;
}

export function validateAllFields(
  fields: FieldDescriptor[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const val = values[field.key] as string | number | boolean | undefined;
    const error = validateField(field, val);
    if (error) errors[field.key] = error;
  }

  // Cross-field validation for GCP region/zone alignment
  const region = values.region as string | undefined;
  if (region && typeof region === "string") {
    const zoneField = fields.find(f => f.key === "zone");
    const zone = values.zone as string | undefined;
    if (zoneField && zone && typeof zone === "string") {
      if (!zone.startsWith(region)) {
        errors.zone = `Zone must belong to the selected region (${region})`;
      }
    }

    const locationField = fields.find(f => f.key === "location");
    const location = values.location as string | undefined;
    if (locationField && location && typeof location === "string") {
      if (location.includes("-") && !location.startsWith(region)) {
        errors.location = `Location zone must belong to the selected region (${region})`;
      }
    }
  }

  return errors;
}
