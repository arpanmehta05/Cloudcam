import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureNsgCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps, providerData } = args;
    const activeRgNameVal = args.rgNameVal || resolveInterpolation("azurerm_resource_group", suffix, "name");
    const activeRgDep = args.rgDep || [`azurerm_resource_group.${suffix}`];

    const rawRules = Array.isArray(config.rules) ? config.rules : [];
    const securityRules: any[] = [];
    let priority = 1000;

    for (const rule of rawRules) {
      const direction = rule.type === "egress" ? "Outbound" : "Inbound";
      const protocol = rule.protocol === "all" || rule.protocol === "-1" ? "*" : (rule.protocol ? (rule.protocol.substring(0, 1).toUpperCase() + rule.protocol.substring(1).toLowerCase()) : "Tcp");
      const cidr = typeof rule.cidrBlocks === "string" ? rule.cidrBlocks : (Array.isArray(rule.cidrBlocks) && rule.cidrBlocks.length > 0 ? rule.cidrBlocks[0] : "*");

      securityRules.push({
        name: `Rule_${direction}_${rule.fromPort}_${rule.toPort || rule.fromPort}_${priority}`,
        priority,
        direction,
        access: "Allow",
        protocol,
        source_port_range: "*",
        destination_port_range: rule.fromPort === rule.toPort ? String(rule.fromPort) : `${rule.fromPort}-${rule.toPort}`,
        source_address_prefix: cidr,
        destination_address_prefix: "*",
      });
      priority++;
    }

    compiler.addResource(
      "azurerm_network_security_group",
      name,
      {
        ...providerData,
        name: config.name || `nsg-${name}`,
        location: r,
        resource_group_name: activeRgNameVal,
        security_rule: securityRules,
      },
      "azure_nsg",
      false,
      [...activeRgDep, ...deps],
      ["security_rule"]
    );
  }
}
