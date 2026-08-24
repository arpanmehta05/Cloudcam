import { TerraformCompiler } from "./services/terraform-generation.service";

async function verifyVpcs() {
  console.log("=== RUNNING VPC/VNET COMPILER VERIFICATION ===");

  // ----------------------------------------------------
  // TEST 1: AWS with explicit aws_vpc and custom ports & CIDRs
  // ----------------------------------------------------
  const reqAwsExplicit = {
    nodes: [
      {
        id: "node_aws_vpc",
        serviceId: "aws_vpc" as const,
        config: {
          vpcName: "custom-aws-vpc",
          cidrBlock: "10.50.0.0/16",
          subnetCidrBlock: "10.50.10.0/24",
          sshPort: 8022,
          httpPort: 8080,
          httpsPort: 8443,
          region: "us-east-1"
        }
      },
      {
        id: "node_ec2",
        serviceId: "ec2" as const,
        config: {
          instanceName: "web-server",
          region: "us-east-1"
        }
      },
      {
        id: "node_rds",
        serviceId: "rds" as const,
        config: {
          dbName: "mydb",
          region: "us-east-1"
        }
      }
    ],
    edges: [],
    region: "us-east-1",
    name: "test-aws-explicit",
    deploymentId: "dep-aws-123",
    provider: "aws" as const
  };

  const compilerAws = new TerraformCompiler(reqAwsExplicit);
  const resultAws = compilerAws.compile();
  const hclAws = resultAws.terraformHcl;

  console.log("\n--- TEST 1: AWS VPC HCL ---\n", hclAws);

  const hasAwsVpc = hclAws.includes("resource \"aws_vpc\"");
  const hasCustomAwsVpcName = hclAws.includes("custom-aws-vpc");
  const hasCustomCidr = hclAws.includes("10.50.0.0/16");
  const hasCustomSubnetCidr = hclAws.includes("10.50.10.0/24");
  const hasCustomSubnetBCidr = hclAws.includes("10.50.11.0/24"); // Incremented third octet
  const hasCustomSshPort = hclAws.includes("from_port = 8022") || hclAws.includes("from_port   = 8022");
  const hasCustomHttpPort = hclAws.includes("from_port = 8080") || hclAws.includes("from_port   = 8080");
  const hasCustomHttpsPort = hclAws.includes("from_port = 8443") || hclAws.includes("from_port   = 8443");

  console.log("TEST 1 Results:");
  console.log("  - Has aws_vpc resource:", hasAwsVpc);
  console.log("  - Has custom VPC name:", hasCustomAwsVpcName);
  console.log("  - Has custom VPC CIDR block (10.50.0.0/16):", hasCustomCidr);
  console.log("  - Has custom public Subnet A CIDR (10.50.10.0/24):", hasCustomSubnetCidr);
  console.log("  - Has auto-calculated Subnet B CIDR (10.50.11.0/24):", hasCustomSubnetBCidr);
  console.log("  - Has custom SSH Port (8022):", hasCustomSshPort);
  console.log("  - Has custom HTTP Port (8080):", hasCustomHttpPort);
  console.log("  - Has custom HTTPS Port (8443):", hasCustomHttpsPort);

  const test1Success = hasAwsVpc && hasCustomAwsVpcName && hasCustomCidr && hasCustomSubnetCidr && hasCustomSubnetBCidr && hasCustomSshPort && hasCustomHttpPort && hasCustomHttpsPort;
  if (test1Success) {
    console.log("  => SUCCESS");
  } else {
    console.error("  => FAILURE");
  }

  // ----------------------------------------------------
  // TEST 2: GCP with explicit gcp_vpc and custom ports & CIDRs
  // ----------------------------------------------------
  const reqGcpExplicit = {
    nodes: [
      {
        id: "node_gcp_vpc",
        serviceId: "gcp_vpc" as const,
        config: {
          networkName: "custom-gcp-net",
          cidrBlock: "10.60.0.0/16",
          subnetCidrBlock: "10.60.20.0/24",
          sshPort: 2222,
          httpPort: 9000,
          httpsPort: 9443,
          region: "us-central1"
        }
      },
      {
        id: "node_gcp_compute",
        serviceId: "gcp_compute" as const,
        config: {
          instanceName: "gcp-web-server",
          region: "us-central1"
        }
      }
    ],
    edges: [],
    region: "us-central1",
    name: "test-gcp-explicit",
    deploymentId: "dep-gcp-123",
    provider: "gcp" as const
  };

  const compilerGcp = new TerraformCompiler(reqGcpExplicit);
  const resultGcp = compilerGcp.compile();
  const hclGcp = resultGcp.terraformHcl;

  console.log("\n--- TEST 2: GCP VPC HCL ---\n", hclGcp);

  const hasGcpNetwork = hclGcp.includes("resource \"google_compute_network\"");
  const hasCustomGcpNetName = hclGcp.includes("custom-gcp-net");
  const hasCustomGcpSubnetCidr = hclGcp.includes("10.60.20.0/24");
  const hasGcpSsh = hclGcp.includes("\"2222\"");
  const hasGcpHttp = hclGcp.includes("\"9000\"");
  const hasGcpHttps = hclGcp.includes("\"9443\"");

  console.log("TEST 2 Results:");
  console.log("  - Has google_compute_network:", hasGcpNetwork);
  console.log("  - Has custom Network name:", hasCustomGcpNetName);
  console.log("  - Has custom Subnet CIDR range (10.60.20.0/24):", hasCustomGcpSubnetCidr);
  console.log("  - Has custom SSH Port (2222) in firewall:", hasGcpSsh);
  console.log("  - Has custom HTTP Port (9000) in firewall:", hasGcpHttp);
  console.log("  - Has custom HTTPS Port (9443) in firewall:", hasGcpHttps);

  const test2Success = hasGcpNetwork && hasCustomGcpNetName && hasCustomGcpSubnetCidr && hasGcpSsh && hasGcpHttp && hasGcpHttps;
  if (test2Success) {
    console.log("  => SUCCESS");
  } else {
    console.error("  => FAILURE");
  }

  // ----------------------------------------------------
  // TEST 3: Azure with explicit vpc (unified) and custom ports & CIDRs
  // ----------------------------------------------------
  const reqAzureExplicit = {
    nodes: [
      {
        id: "node_vpc_azure",
        serviceId: "vpc" as const,
        config: {
          vpcName: "custom-azure-vnet",
          cidrBlock: "10.70.0.0/16",
          subnetCidrBlock: "10.70.30.0/24",
          sshPort: 5022,
          httpPort: 5080,
          httpsPort: 5443,
          region: "eastus"
        }
      },
      {
        id: "node_azure_vm",
        serviceId: "azure_vm" as const,
        config: {
          vmName: "azure-web",
          region: "eastus"
        }
      }
    ],
    edges: [],
    region: "eastus",
    name: "test-azure-explicit",
    deploymentId: "dep-azure-123",
    provider: "azure" as const
  };

  const compilerAzure = new TerraformCompiler(reqAzureExplicit);
  const resultAzure = compilerAzure.compile();
  const hclAzure = resultAzure.terraformHcl;

  console.log("\n--- TEST 3: Azure Vnet HCL ---\n", hclAzure);

  const hasAzureVnet = hclAzure.includes("resource \"azurerm_virtual_network\"");
  const hasCustomAzureVnetName = hclAzure.includes("custom-azure-vnet");
  const hasCustomAzureVnetCidr = hclAzure.includes("10.70.0.0/16");
  const hasCustomAzureSubnetCidr = hclAzure.includes("10.70.30.0/24");
  const hasAzureSsh = hclAzure.includes("destination_port_range = \"5022\"") || hclAzure.includes("destination_port_range     = \"5022\"");
  const hasAzureHttp = hclAzure.includes("destination_port_range = \"5080\"") || hclAzure.includes("destination_port_range     = \"5080\"");
  const hasAzureHttps = hclAzure.includes("destination_port_range = \"5443\"") || hclAzure.includes("destination_port_range     = \"5443\"");

  console.log("TEST 3 Results:");
  console.log("  - Has azurerm_virtual_network:", hasAzureVnet);
  console.log("  - Has custom Virtual Network name:", hasCustomAzureVnetName);
  console.log("  - Has custom VNET CIDR range (10.70.0.0/16):", hasCustomAzureVnetCidr);
  console.log("  - Has custom Subnet CIDR range (10.70.30.0/24):", hasCustomAzureSubnetCidr);
  console.log("  - Has custom SSH Port (5022) in NSG:", hasAzureSsh);
  console.log("  - Has custom HTTP Port (5080) in NSG:", hasAzureHttp);
  console.log("  - Has custom HTTPS Port (5443) in NSG:", hasAzureHttps);

  const test3Success = hasAzureVnet && hasCustomAzureVnetName && hasCustomAzureVnetCidr && hasCustomAzureSubnetCidr && hasAzureSsh && hasAzureHttp && hasAzureHttps;
  if (test3Success) {
    console.log("  => SUCCESS");
  } else {
    console.error("  => FAILURE");
  }

  // ----------------------------------------------------
  // TEST 4: AWS with no explicit VPC (Implicit Autogeneration Fallback)
  // ----------------------------------------------------
  const reqAwsImplicit = {
    nodes: [
      {
        id: "node_ec2_only",
        serviceId: "ec2" as const,
        config: {
          instanceName: "web-server",
          region: "us-east-1"
        }
      }
    ],
    edges: [],
    region: "us-east-1",
    name: "test-aws-implicit",
    deploymentId: "dep-aws-implicit",
    provider: "aws" as const
  };

  const compilerAwsImplicit = new TerraformCompiler(reqAwsImplicit);
  const resultAwsImplicit = compilerAwsImplicit.compile();
  const hclAwsImplicit = resultAwsImplicit.terraformHcl;

  const hasImplicitAwsVpc = hclAwsImplicit.includes("resource \"aws_vpc\"");
  const hasDefaultCidr = hclAwsImplicit.includes("10.0.0.0/16");
  const hasDefaultSubnetCidr = hclAwsImplicit.includes("10.0.1.0/24");
  const hasDefaultSshPort = hclAwsImplicit.includes("from_port = 22") || hclAwsImplicit.includes("from_port   = 22");

  console.log("\nTEST 4 Results (AWS Implicit Fallback):");
  console.log("  - Has auto-generated aws_vpc:", hasImplicitAwsVpc);
  console.log("  - Has default VPC CIDR (10.0.0.0/16):", hasDefaultCidr);
  console.log("  - Has default public Subnet A CIDR (10.0.1.0/24):", hasDefaultSubnetCidr);
  console.log("  - Has default SSH Port (22):", hasDefaultSshPort);

  const test4Success = hasImplicitAwsVpc && hasDefaultCidr && hasDefaultSubnetCidr && hasDefaultSshPort;
  if (test4Success) {
    console.log("  => SUCCESS");
  } else {
    console.error("  => FAILURE");
  }

  // ----------------------------------------------------
  // TEST 5: AWS with explicit VPC and isPrivate: true
  // ----------------------------------------------------
  const reqAwsPrivate = {
    nodes: [
      {
        id: "node_aws_vpc_p",
        serviceId: "aws_vpc" as const,
        config: {
          vpcName: "private-aws-vpc",
          cidrBlock: "10.90.0.0/16",
          subnetCidrBlock: "10.90.10.0/24",
          isPrivate: true,
          region: "us-east-1"
        }
      },
      {
        id: "node_ec2_p",
        serviceId: "ec2" as const,
        config: {
          instanceName: "web-server-p",
          region: "us-east-1"
        }
      }
    ],
    edges: [],
    region: "us-east-1",
    name: "test-aws-private",
    deploymentId: "dep-aws-private",
    provider: "aws" as const
  };

  const compilerAwsPrivate = new TerraformCompiler(reqAwsPrivate);
  const resultAwsPrivate = compilerAwsPrivate.compile();
  const hclAwsPrivate = resultAwsPrivate.terraformHcl;

  const hasIGW = hclAwsPrivate.includes("resource \"aws_internet_gateway\"");
  const hasPrivateSubnetMapFalse = hclAwsPrivate.includes("map_public_ip_on_launch = false");
  const hasEmptyRoute = hclAwsPrivate.includes("route = []") || !hclAwsPrivate.includes("gateway_id = aws_internet_gateway");

  console.log("\nTEST 5 Results (AWS Private VPC):");
  console.log("  - Has aws_internet_gateway (should be false):", hasIGW);
  console.log("  - Has map_public_ip_on_launch = false:", hasPrivateSubnetMapFalse);
  console.log("  - Route table is private/empty:", hasEmptyRoute);

  const test5Success = !hasIGW && hasPrivateSubnetMapFalse && hasEmptyRoute;
  if (test5Success) {
    console.log("  => SUCCESS");
  } else {
    console.error("  => FAILURE");
  }

  // ----------------------------------------------------
  // TEST 6: GCP with explicit VPC and isPrivate: true
  // ----------------------------------------------------
  const reqGcpPrivate = {
    nodes: [
      {
        id: "node_gcp_vpc_p",
        serviceId: "gcp_vpc" as const,
        config: {
          networkName: "private-gcp-net",
          isPrivate: true,
          region: "us-central1"
        }
      },
      {
        id: "node_gcp_compute_p",
        serviceId: "gcp_compute" as const,
        config: {
          instanceName: "gcp-private-server",
          region: "us-central1"
        }
      }
    ],
    edges: [],
    region: "us-central1",
    name: "test-gcp-private",
    deploymentId: "dep-gcp-private",
    provider: "gcp" as const
  };

  const compilerGcpPrivate = new TerraformCompiler(reqGcpPrivate);
  const resultGcpPrivate = compilerGcpPrivate.compile();
  const hclGcpPrivate = resultGcpPrivate.terraformHcl;

  const hasAccessConfig = hclGcpPrivate.includes("access_config");

  console.log("\nTEST 6 Results (GCP Private Network):");
  console.log("  - Has access_config in compute instance (should be false):", hasAccessConfig);

  const test6Success = !hasAccessConfig;
  if (test6Success) {
    console.log("  => SUCCESS");
  } else {
    console.error("  => FAILURE");
  }

  // ----------------------------------------------------
  // TEST 7: Azure with explicit VPC (unified) and isPrivate: true
  // ----------------------------------------------------
  const reqAzurePrivate = {
    nodes: [
      {
        id: "node_vpc_azure_p",
        serviceId: "vpc" as const,
        config: {
          vpcName: "private-azure-vnet",
          isPrivate: true,
          region: "eastus"
        }
      },
      {
        id: "node_azure_vm_p",
        serviceId: "azure_vm" as const,
        config: {
          vmName: "azure-private-vm",
          region: "eastus"
        }
      }
    ],
    edges: [],
    region: "eastus",
    name: "test-azure-private",
    deploymentId: "dep-azure-private",
    provider: "azure" as const
  };

  const compilerAzurePrivate = new TerraformCompiler(reqAzurePrivate);
  const resultAzurePrivate = compilerAzurePrivate.compile();
  const hclAzurePrivate = resultAzurePrivate.terraformHcl;

  const hasAzurePip = hclAzurePrivate.includes("resource \"azurerm_public_ip\"");
  const hasPipRef = hclAzurePrivate.includes("public_ip_address_id");

  console.log("\nTEST 7 Results (Azure Private VNET):");
  console.log("  - Has azurerm_public_ip (should be false):", hasAzurePip);
  console.log("  - Has public_ip_address_id in NIC config (should be false):", hasPipRef);

  const test7Success = !hasAzurePip && !hasPipRef;
  if (test7Success) {
    console.log("  => SUCCESS");
  } else {
    console.error("  => FAILURE");
  }

  if (test1Success && test2Success && test3Success && test4Success && test5Success && test6Success && test7Success) {
    console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
    process.exit(0);
  } else {
    console.error("\n>>> SOME TESTS FAILED! <<<");
    process.exit(1);
  }
}

verifyVpcs().catch((err) => {
  console.error("Error running verification:", err);
  process.exit(1);
});
