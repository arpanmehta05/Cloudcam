import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpFirewallCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps, providerData } = args;

    const rules = Array.isArray(config.rules) ? config.rules : [];
    const allowMap = new Map<string, string[]>();
    const sourceRangesSet = new Set<string>();

    for (const rule of rules) {
      const proto = (rule.protocol || "tcp").toLowerCase();
      if (!allowMap.has(proto)) {
        allowMap.set(proto, []);
      }
      const fromPort = Number(rule.fromPort || 80);
      const toPort = Number(rule.toPort || 80);
      if (fromPort === toPort) {
        allowMap.get(proto)!.push(String(fromPort));
      } else {
        allowMap.get(proto)!.push(`${fromPort}-${toPort}`);
      }

      if (rule.cidrBlocks) {
        sourceRangesSet.add(rule.cidrBlocks);
      }
    }

    const allowList = Array.from(allowMap.entries()).map(([protocol, ports]) => ({
      protocol,
      ports: ports.length > 0 ? ports : undefined,
    }));

    if (allowList.length === 0) {
      allowList.push({ protocol: "tcp", ports: ["80"] });
    }

    const finalSourceRanges = sourceRangesSet.size > 0 ? Array.from(sourceRangesSet) : ["0.0.0.0/0"];

    compiler.addResource(
      "google_compute_firewall",
      name,
      {
        ...providerData,
        name: compiler.sanitizeGcpResourceName(config.name || `fw-${name}`).substring(0, 63),
        network: resolveInterpolation("google_compute_network", suffix, "name"),
        allow: allowList,
        source_ranges: finalSourceRanges,
        target_tags: [`tag-${name}`],
      },
      "gcp_firewall",
      false,
      [`google_compute_network.${suffix}`, ...deps],
      ["allow"]
    );
  }
}
