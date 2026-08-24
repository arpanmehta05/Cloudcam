import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import { resolveInterpolation } from "../graph-resolver";
import type { TerraformCompiler } from "../compiler";

export function injectImplicitInfrastructureAzure(
  compiler: TerraformCompiler,
  baseName: string,
  shortId: string
) {
  const azureVmRegions = new Set<string>();
  const azureNetRegions = new Set<string>();

  for (const node of compiler.req.nodes) {
    const schema = ServiceSchemas[node.serviceId];
    if (!schema) continue;
    const config = schema.parse(node.config);
    let r = (config.region as string) || compiler.req.region;
    if (r && r.includes("azurerm_resource_group")) {
      const explicitRgNode = compiler.req.nodes.find(
        (n) => n.serviceId === "azure_rg"
      );
      if (explicitRgNode && explicitRgNode.config?.location) {
        r = explicitRgNode.config.location as string;
      }
    }

    if (node.serviceId === "azure_vm" || node.serviceId === "azure_vmss")
      azureVmRegions.add(r);
    if (
      node.serviceId === "azure_vm" ||
      node.serviceId === "azure_vmss" ||
      node.serviceId === "azure_sql" ||
      node.serviceId === "azure_function" ||
      node.serviceId === "azure_vnet"
    ) {
      azureNetRegions.add(r);
    }
  }

  // Private Key for VM SSH
  const hasSshVm = compiler.req.nodes.some(
    (n) =>
      (n.serviceId === "azure_vm" || n.serviceId === "azure_vmss") &&
      !(n.config?.adminPassword || n.config?.admin_password)
  );
  if (hasSshVm && azureVmRegions.size > 0) {
    compiler.addResource(
      "tls_private_key",
      "simulation",
      {
        algorithm: "RSA",
        rsa_bits: 4096,
      },
      "tls",
      true
    );
  }

  // Implicit Resource Groups and Networking per unique active region
  for (const r of compiler.uniqueRegions) {
    const suffix = compiler.getInfraSuffix(r);
    const existingRg = process.env.AZURE_RESOURCE_GROUP;
    const explicitRgNode = compiler.req.nodes.find(
      (n) => n.serviceId === "azure_rg"
    );

    if (explicitRgNode) {
      // Explicit resource group defined, skip implicit resource group/data source
    } else {
      if (existingRg) {
        compiler.addDataSource("azurerm_resource_group", suffix, {
          name: existingRg,
        });
      } else {
        compiler.addResource(
          "azurerm_resource_group",
          suffix,
          {
            name: compiler.getRunName(baseName, shortId, "rg", r),
            location: r,
          },
          "rg",
          true
        );
      }
    }

    if (azureNetRegions.has(r)) {
      let rgNameVal = "";
      let rgDeps: string[] = [];

      if (explicitRgNode) {
        const rawRgName = explicitRgNode.id
          .replace("azurerm_resource_group_", "")
          .replace("azure_rg_", "")
          .replace("rg_", "");
        rgNameVal = resolveInterpolation(
          "azurerm_resource_group",
          rawRgName,
          "name"
        );
        rgDeps = [`azurerm_resource_group.${rawRgName}`];
      } else {
        rgNameVal = existingRg
          ? `\${data.azurerm_resource_group.${suffix}.name}`
          : resolveInterpolation("azurerm_resource_group", suffix, "name");
        rgDeps = existingRg ? [] : [`azurerm_resource_group.${suffix}`];
      }

      // Check if there is an explicit azure_vnet or vpc node in this region
      const explicitVpcNode = compiler.req.nodes.find(
        (n) =>
          (n.serviceId === "azure_vnet" || n.serviceId === "vpc") &&
          ((ServiceSchemas[n.serviceId]?.parse(n.config)
            ?.region as string) || compiler.req.region) === r
      );
      let explicitVpcConfig: any = null;
      if (explicitVpcNode) {
        const schema = ServiceSchemas[explicitVpcNode.serviceId];
        explicitVpcConfig = schema
          ? schema.parse(explicitVpcNode.config || {})
          : explicitVpcNode.config;
      }

      if (compiler.req.isVmContributor) {
        const vnetName = compiler.req.existingVnetName || "Arpan-vnet";
        const subnetName = compiler.req.existingSubnetName || "default";
        compiler.addDataSource("azurerm_virtual_network", suffix, {
          name: vnetName,
          resource_group_name: rgNameVal,
        });
        compiler.addDataSource("azurerm_subnet", `${suffix}_public`, {
          name: subnetName,
          virtual_network_name: vnetName,
          resource_group_name: rgNameVal,
        });
      } else {
        const vnetNameVal =
          explicitVpcConfig?.vnetName ||
          explicitVpcConfig?.vpcName ||
          compiler.getRunName(baseName, shortId, "vnet", r);
        const addressSpaceVal =
          explicitVpcConfig?.addressSpace ||
          explicitVpcConfig?.cidrBlock ||
          "10.0.0.0/16";
        const subnetPrefixVal =
          explicitVpcConfig?.subnetCidrBlock || "10.0.1.0/24";

        compiler.addResource(
          "azurerm_virtual_network",
          suffix,
          {
            name: compiler.shortId
              ? `${vnetNameVal}${compiler.shortId}`
              : vnetNameVal,
            address_space: [addressSpaceVal],
            location: r,
            resource_group_name: rgNameVal,
          },
          "vnet",
          true,
          rgDeps
        );

        compiler.addResource(
          "azurerm_subnet",
          `${suffix}_public`,
          {
            name: compiler.getRunName(baseName, shortId, "subnet", r),
            resource_group_name: rgNameVal,
            virtual_network_name: resolveInterpolation(
              "azurerm_virtual_network",
              suffix,
              "name"
            ),
            address_prefixes: [subnetPrefixVal],
          },
          "subnet",
          true,
          [...rgDeps, `azurerm_virtual_network.${suffix}`]
        );
      }

      const sshPortVal =
        explicitVpcConfig && explicitVpcConfig.sshPort !== undefined
          ? String(explicitVpcConfig.sshPort)
          : "22";
      const httpPortVal =
        explicitVpcConfig && explicitVpcConfig.httpPort !== undefined
          ? String(explicitVpcConfig.httpPort)
          : "80";
      const httpsPortVal =
        explicitVpcConfig && explicitVpcConfig.httpsPort !== undefined
          ? String(explicitVpcConfig.httpsPort)
          : "443";

      const securityRules = [
        {
          name: "SSH",
          priority: 1001,
          direction: "Inbound",
          access: "Allow",
          protocol: "Tcp",
          source_port_range: "*",
          destination_port_range: sshPortVal,
          source_address_prefix: "*",
          destination_address_prefix: "*",
        },
        {
          name: "HTTP",
          priority: 1002,
          direction: "Inbound",
          access: "Allow",
          protocol: "Tcp",
          source_port_range: "*",
          destination_port_range: httpPortVal,
          source_address_prefix: "*",
          destination_address_prefix: "*",
        },
        {
          name: "HTTPS",
          priority: 1003,
          direction: "Inbound",
          access: "Allow",
          protocol: "Tcp",
          source_port_range: "*",
          destination_port_range: httpsPortVal,
          source_address_prefix: "*",
          destination_address_prefix: "*",
        },
      ];

      let priority = 1004;
      for (const n of compiler.req.nodes) {
        if (n.serviceId === "azure_vm") {
          const schema = ServiceSchemas["azure_vm"];
          const nConfig = schema ? schema.parse(n.config) : n.config;
          const nodeRegion = nConfig.region || compiler.req.region;
          if (nodeRegion === r) {
            const githubConfig = compiler.resolveGithubDependency(n.id);
            const appPort =
              nConfig.appPort || (githubConfig && githubConfig.appPort);
            if (
              appPort &&
              String(appPort) !== httpPortVal &&
              String(appPort) !== httpsPortVal &&
              String(appPort) !== sshPortVal
            ) {
              securityRules.push({
                name: `AppPort_${appPort}`,
                priority,
                direction: "Inbound",
                access: "Allow",
                protocol: "Tcp",
                source_port_range: "*",
                destination_port_range: String(appPort),
                source_address_prefix: "*",
                destination_address_prefix: "*",
              });
              priority++;
            }
          }
        }
      }

      // Create the NSG in BOTH cases so that simulated VMs are reachable over SSH and Web ports
      compiler.addResource(
        "azurerm_network_security_group",
        suffix,
        {
          name: compiler.getRunName(baseName, shortId, "nsg", r),
          location: r,
          resource_group_name: rgNameVal,
          security_rule: securityRules,
        },
        "nsg",
        true,
        rgDeps,
        ["security_rule"]
      );
    }
  }
}
