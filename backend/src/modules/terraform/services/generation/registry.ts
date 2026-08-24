import type { TerraformCompiler } from "./compiler";
import { ResourceCompiler, CompilerArgs } from "./compilers/base.compiler";
import {
  AwsEc2Compiler,
  AwsAsgCompiler,
  AwsS3Compiler,
  AwsRdsCompiler,
  AwsLambdaCompiler,
  AwsDynamoDbCompiler,
  AwsElbCompiler,
  AwsApiGatewayCompiler,
  AwsEcrCompiler,
  AwsEipCompiler,
  AwsSgCompiler,
  AwsTgCompiler,
  AwsEbsCompiler,
  AwsEcsCompiler,
  AwsEksCompiler,
  AwsCloudfrontCompiler,
} from "./compilers/aws.compilers";
import {
  AzureVmCompiler,
  AzureVmssCompiler,
  AzureLbCompiler,
  AzureStorageCompiler,
  AzureSqlCompiler,
  AzureFunctionCompiler,
  AzureVnetCompiler,
  AzureAcrCompiler,
  AzurePipCompiler,
  AzureNsgCompiler,
  AzureTgCompiler,
  AzureDiskCompiler,
  AzureApiGatewayCompiler,
  AzureCosmosDbCompiler,
  AzureAksCompiler,
} from "./compilers/azure.compilers";
import {
  GcpComputeCompiler,
  GcpMigCompiler,
  GcpStorageCompiler,
  GcpSqlCompiler,
  GcpFunctionCompiler,
  GcpGkeCompiler,
  GcpLbCompiler,
  GcpArtifactRegistryCompiler,
  GcpIpCompiler,
  GcpFirewallCompiler,
  GcpTgCompiler,
  GcpDiskCompiler,
  GcpApiGatewayCompiler,
  GcpFirestoreCompiler,
  GcpCloudRunCompiler,
} from "./compilers/gcp.compilers";

export class AwsVpcCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {}
}

export class GcpVpcCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {}
}

export class AzureCdnCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {}
}

export class GcpCdnCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {}
}

export class AzureRgCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;
    const cleanRgName = name
      .replace("sim_azurerm_resource_group_", "")
      .replace("sim_azure_rg_", "")
      .replace("sim_rg_", "");
    compiler.addResource(
      "azurerm_resource_group",
      cleanRgName,
      {
        name: config.name || "custom-rg",
        location: config.location || r || "eastus",
      },
      "azure_rg",
      false,
      deps,
    );
  }
}

export const awsRegistry: Record<string, ResourceCompiler> = {
  ec2: new AwsEc2Compiler(),
  asg: new AwsAsgCompiler(),
  s3: new AwsS3Compiler(),
  rds: new AwsRdsCompiler(),
  lambda: new AwsLambdaCompiler(),
  dynamodb: new AwsDynamoDbCompiler(),
  elb: new AwsElbCompiler(),
  apigateway: new AwsApiGatewayCompiler(),
  ecr: new AwsEcrCompiler(),
  eip: new AwsEipCompiler(),
  sg: new AwsSgCompiler(),
  tg: new AwsTgCompiler(),
  ebs: new AwsEbsCompiler(),
  ecs: new AwsEcsCompiler(),
  eks: new AwsEksCompiler(),
  aws_vpc: new AwsVpcCompiler(),
  vpc: new AwsVpcCompiler(),
  cloudfront: new AwsCloudfrontCompiler(),
};

export const azureRegistry: Record<string, ResourceCompiler> = {
  azure_rg: new AzureRgCompiler(),
  azure_vm: new AzureVmCompiler(),
  azure_vmss: new AzureVmssCompiler(),
  azure_lb: new AzureLbCompiler(),
  azure_storage: new AzureStorageCompiler(),
  azure_sql: new AzureSqlCompiler(),
  azure_function: new AzureFunctionCompiler(),
  azure_vnet: new AzureVnetCompiler(),
  azure_acr: new AzureAcrCompiler(),
  azure_pip: new AzurePipCompiler(),
  azure_nsg: new AzureNsgCompiler(),
  azure_tg: new AzureTgCompiler(),
  azure_disk: new AzureDiskCompiler(),
  apigateway: new AzureApiGatewayCompiler(),
  dynamodb: new AzureCosmosDbCompiler(),
  ecr: new AzureAcrCompiler(),
  azure_aks: new AzureAksCompiler(),
  ecs: new AzureAksCompiler(),
  eks: new AzureAksCompiler(),
  vpc: new AzureVnetCompiler(),
  azure_cdn: new AzureCdnCompiler(),
};

export const gcpRegistry: Record<string, ResourceCompiler> = {
  gcp_compute: new GcpComputeCompiler(),
  gcp_mig: new GcpMigCompiler(),
  gcp_storage: new GcpStorageCompiler(),
  gcp_sql: new GcpSqlCompiler(),
  gcp_function: new GcpFunctionCompiler(),
  gcp_gke: new GcpGkeCompiler(),
  gcp_lb: new GcpLbCompiler(),
  gcp_artifact_registry: new GcpArtifactRegistryCompiler(),
  gcp_ip: new GcpIpCompiler(),
  gcp_firewall: new GcpFirewallCompiler(),
  gcp_tg: new GcpTgCompiler(),
  gcp_disk: new GcpDiskCompiler(),
  apigateway: new GcpApiGatewayCompiler(),
  dynamodb: new GcpFirestoreCompiler(),
  ecr: new GcpArtifactRegistryCompiler(),
  gcp_cloud_run: new GcpCloudRunCompiler(),
  ecs: new GcpCloudRunCompiler(),
  eks: new GcpGkeCompiler(),
  gcp_vpc: new GcpVpcCompiler(),
  vpc: new GcpVpcCompiler(),
  gcp_cdn: new GcpCdnCompiler(),
};
