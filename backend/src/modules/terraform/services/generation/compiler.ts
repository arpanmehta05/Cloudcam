import { ServiceSchemas } from "../../../../config/terraform-schemas";
import { HclBuilder, type HclValue } from "./hcl-builder";
import {
  topologicalSort,
  type ResourceNode,
  resolveInterpolation,
} from "./graph-resolver";
import { AL2023_SSM_PARAMETER, shouldUseProvidedAmi } from "./ami-registry";
import { awsRegistry, azureRegistry, gcpRegistry } from "./registry";
import { TfRequest, TfResult, TfResource } from "./types";
import { parseConfigSafely } from "./helpers";

// Delegate imports
import { injectImplicitInfrastructure } from "./implicit-infra";
import { processNodes } from "./compiler-process-nodes";
import { generateHclBlocks } from "./hcl-generator";
import { buildJson } from "./compiler-json-generator";
import { generateBootstrapScript } from "./bootstrap";
import {
  resolveDatabaseDependencies,
  resolveGithubDependency,
  resolveDockerHubDependency,
  resolveEcrDependency,
} from "./compiler-dependencies";

export class TerraformCompiler {
  public resources: ResourceNode[] = [];
  public dataSources: ResourceNode[] = [];
  private implicitResources: TfResource[] = [];
  private explicitResources: TfResource[] = [];
  public locals: Record<string, HclValue> = {};
  public region: string;
  public provider: "aws" | "azure" | "gcp";
  public uniqueRegions: Set<string> = new Set();
  public managedVpcRegions: Set<string> = new Set();
  public shortId: string = "";

  constructor(public req: TfRequest) {
    const hasAzure = req.nodes?.some((n) => n.serviceId?.startsWith("azure_"));
    const hasGcp = req.nodes?.some((n) => n.serviceId?.startsWith("gcp_"));
    this.provider =
      req.provider || (hasGcp ? "gcp" : hasAzure ? "azure" : "aws");
    this.region = req.region;
    this.uniqueRegions.add(this.region);
    this.shortId = req.deploymentId
      ? `-${req.deploymentId.substring(0, 8)}`
      : "";

    for (const node of req.nodes) {
      const schema = ServiceSchemas[node.serviceId];
      if (schema) {
        const config = schema.parse(node.config);
        let r = config.region as string;
        if (r && r.includes("azurerm_resource_group")) {
          const explicitRgNode = req.nodes.find(
            (n) => n.serviceId === "azure_rg"
          );
          if (explicitRgNode && explicitRgNode.config?.location) {
            r = explicitRgNode.config.location as string;
          }
        }
        if (r) {
          this.uniqueRegions.add(r);
        }
      }
    }
  }

  public getRunNameEx(kind: string, r?: string): string {
    const baseName = (this.req.name || "simulation")
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();
    const shortId = this.req.deploymentId
      ? `-${this.req.deploymentId.substring(0, 8)}`
      : "";
    return this.getRunName(baseName, shortId, kind, r);
  }

  public compile(): TfResult {
    // 1. Inject Implicit Infrastructure (VPC, IAM, Resource Group, Networking)
    injectImplicitInfrastructure(this);

    // 2. Process User Nodes
    processNodes(this);

    // 3. Resolve Graph & Sort
    const sortedNodes = topologicalSort(this.resources);

    // 4. Generate HCL
    const hclBlocks = generateHclBlocks(this, sortedNodes);
    const terraformHcl = HclBuilder.generateFile(hclBlocks);
    // HCL generation complete (console logging removed)

    // 5. Build JSON (for compatibility/preview)
    const terraformJson = buildJson(this, sortedNodes);

    return {
      terraformJson,
      terraformHcl,
      resources: this.explicitResources,
      implicitResources: this.implicitResources,
    };
  }

  public addResource(
    type: string,
    name: string,
    data: any,
    serviceId: string,
    isImplicit = false,
    deps: string[] = [],
    nestedBlocks: string[] = []
  ) {
    const address = `${type}.${name}`;
    const node: ResourceNode = {
      id: address,
      type,
      name,
      data,
      dependencies: deps,
      nestedBlocks,
    };

    const existingIndex = this.resources.findIndex((r) => r.id === address);
    if (existingIndex !== -1) {
      const wasImplicit = this.implicitResources.some(
        (r) => r.address === address
      );
      if (wasImplicit && !isImplicit) {
        this.resources[existingIndex] = node;
        this.implicitResources = this.implicitResources.filter(
          (r) => r.address !== address
        );
        if (!this.explicitResources.some((r) => r.address === address)) {
          this.explicitResources.push({ address, type, name, serviceId });
        }
      }
      return;
    }

    this.resources.push(node);

    const resInfo = { address, type, name, serviceId };
    if (isImplicit) {
      this.implicitResources.push(resInfo);
    } else {
      this.explicitResources.push(resInfo);
    }
  }

  public addLocal(key: string, value: HclValue) {
    this.locals[key] = value;
  }

  public addDataSource(
    type: string,
    name: string,
    data: any,
    deps: string[] = [],
    nestedBlocks: string[] = []
  ) {
    if (
      this.dataSources.some(
        (source) => source.type === type && source.name === name
      )
    )
      return;
    this.dataSources.push({
      id: `data.${type}.${name}`,
      type,
      name,
      data,
      dependencies: deps,
      nestedBlocks,
    });
  }

  public getProviderStr(r: string): string | undefined {
    if (this.provider === "azure" || this.provider === "gcp") return undefined;
    if (r === this.region) return undefined;
    return `\${aws.aws_${r.replace(/-/g, "_")}}`;
  }

  public getProviderData(r: string): any {
    const p = this.getProviderStr(r);
    return p ? { provider: p } : {};
  }

  public getInfraSuffix(r: string): string {
    const cleanRegion = r.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const cleanDefaultRegion = this.region.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    return cleanRegion === cleanDefaultRegion
      ? "simulation"
      : `simulation_${cleanRegion}`;
  }

  public isRegionPrivate(
    r: string,
    provider: "aws" | "azure" | "gcp"
  ): boolean {
    const targetServiceIds =
      provider === "aws"
        ? ["aws_vpc", "vpc"]
        : provider === "azure"
          ? ["azure_vnet", "vpc"]
          : ["gcp_vpc", "vpc"];

    const explicitVpcNode = this.req.nodes.find(
      (n) =>
        targetServiceIds.includes(n.serviceId) &&
        ((ServiceSchemas[n.serviceId]?.parse(n.config)?.region as string) ||
          this.region) === r
    );

    if (explicitVpcNode) {
      const schema = ServiceSchemas[explicitVpcNode.serviceId];
      const parsedConfig = schema
        ? schema.parse(explicitVpcNode.config || {})
        : explicitVpcNode.config;
      return (
        parsedConfig?.isPrivate === true ||
        parsedConfig?.isPrivate === "true"
      );
    }

    return false;
  }

  public getGeneratedPemKeyName(): string {
    const baseName = (this.req.name || "simulation")
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();
    const shortId = this.req.deploymentId
      ? `-${this.req.deploymentId.substring(0, 8)}`
      : "";
    return `\${azurerm_resource_group.simulation.name}-ssh-key-${baseName}${shortId}`;
  }

  public getAl2023AmiDataSourceName(r: string): string {
    const suffix = this.getInfraSuffix(r);
    const amiParamName = AL2023_SSM_PARAMETER;

    this.addDataSource(
      "aws_ssm_parameter",
      `al2023_ami_${suffix}`,
      {
        ...this.getProviderData(r),
        name: amiParamName,
      },
      []
    );
    return `\${data.aws_ssm_parameter.al2023_ami_${suffix}.value}`;
  }

  public resolveEc2Ami(
    r: string,
    providedAmi?: unknown,
    osType: "al2023" | "ubuntu" | "debian" | "ecs" = "al2023"
  ): string {
    if (shouldUseProvidedAmi(providedAmi)) return providedAmi.trim();

    if (osType === "ubuntu") {
      const name = `ubuntu_22_04_${r.replace(/-/g, "_")}`;
      this.addDataSource("aws_ssm_parameter", name, {
        ...this.getProviderData(r),
        name: "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id",
      });
      return `\${data.aws_ssm_parameter.${name}.value}`;
    }

    if (osType === "debian") {
      const name = `debian_12_${r.replace(/-/g, "_")}`;
      this.addDataSource("aws_ssm_parameter", name, {
        ...this.getProviderData(r),
        name: "/aws/service/debian/release/12/latest/amd64",
      });
      return `\${data.aws_ssm_parameter.${name}.value}`;
    }

    if (osType === "ecs") {
      const name = `ecs_opt_ami_${r.replace(/-/g, "_")}`;
      this.addDataSource("aws_ssm_parameter", name, {
        ...this.getProviderData(r),
        name: "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id",
      });
      return `\${data.aws_ssm_parameter.${name}.value}`;
    }

    return this.getAl2023AmiDataSourceName(r);
  }

  public sanitizeGcpResourceName(value: unknown, maxLength = 63): string {
    const cleaned = String(value || "resource")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const prefixed = /^[a-z]/.test(cleaned) ? cleaned : `rw-${cleaned}`;
    return prefixed.substring(0, maxLength).replace(/-$/g, "") || "rw-resource";
  }

  private redactSensitiveHcl(hcl: string): string {
    return hcl.replace(/(password\s*=\s*")[^"]+(")/g, '$1[REDACTED]$2');
  }

  public getRunName(
    baseName: string,
    shortId: string,
    kind: string,
    r?: string
  ): string {
    const regionSuffix = r
      ? `-${r.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`
      : "";
    const name = `rw-${kind}-${baseName}${shortId}${regionSuffix}`;
    return name.substring(0, 63);
  }

  // Delegated Dependency Methods
  public resolveDatabaseDependencies(nodeId: string) {
    return resolveDatabaseDependencies(this, nodeId);
  }

  public resolveGithubDependency(nodeId: string) {
    return resolveGithubDependency(this, nodeId);
  }

  public resolveDockerHubDependency(nodeId: string) {
    return resolveDockerHubDependency(this, nodeId);
  }

  public resolveEcrDependency(nodeId: string) {
    return resolveEcrDependency(this, nodeId);
  }

  public generateBootstrapScript(
    config: any,
    dbEnvVars: Array<{ name: string; value: string }>,
    osType: "al2023" | "ubuntu" | "debian"
  ) {
    return generateBootstrapScript(this, config, dbEnvVars, osType);
  }
}
