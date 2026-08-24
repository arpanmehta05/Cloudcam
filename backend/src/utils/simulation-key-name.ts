export function slugSimulationName(name?: string | null): string {
  return (name || "simulation")
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "simulation";
}

export function extractKeyNameFromHcl(hcl?: string | null): string | null {
  if (!hcl) return null;

  const keyPairBlock = hcl.match(/resource\s+"aws_key_pair"\s+"simulation"\s+\{[\s\S]*?\n\}/);
  const keyNameMatch = keyPairBlock?.[0].match(/^\s*key_name\s*=\s*"([^"]+)"/m);
  return keyNameMatch?.[1] || null;
}

export function resolveSimulationKeyName(options: {
  outputKeyName?: string | null;
  hcl?: string | null;
  simulationName?: string | null;
  deploymentId?: string | null;
}): string {
  if (options.outputKeyName) return options.outputKeyName;

  const hclKeyName = extractKeyNameFromHcl(options.hcl);
  if (hclKeyName) return hclKeyName;

  const baseName = slugSimulationName(options.simulationName);
  const shortId = options.deploymentId ? `-${options.deploymentId.substring(0, 8)}` : "";
  return `${baseName}${shortId}-key`;
}
