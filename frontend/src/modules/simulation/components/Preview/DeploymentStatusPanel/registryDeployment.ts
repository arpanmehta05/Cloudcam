import {
  generateBashScript,
  generatePowerShellScript,
} from "./scriptGenerators";

type Provider = "aws" | "azure" | "gcp";

type RegistryNode = {
  id: string;
  type?: string;
  data?: {
    serviceId?: string;
    label?: string;
    config?: {
      imageTag?: string;
    };
  };
  label?: string;
  config?: {
    imageTag?: string;
  };
};

export function buildRegistryDeploymentState({
  outputs,
  nodes,
  provider,
  name,
  formRegion,
}: {
  outputs: Record<string, any>;
  nodes: RegistryNode[];
  provider: Provider;
  name: string;
  formRegion: string;
}) {
  const registryServiceIds = ["ecr", "azure_acr", "gcp_artifact_registry"];
  const ecrOutputs = Object.entries(outputs)
    .filter(([key]) => key.startsWith("ecr_url_"))
    .map(([key, output]) => {
      const url =
        typeof output?.value === "string" ? output.value : String(output);
      const registry = url.split("/")[0];
      const repoName = url.substring(url.indexOf("/") + 1);
      const matchingNode = nodes.find((node) => {
        const cleanNodeId = node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        return key === `ecr_url_sim_${cleanNodeId}` || key.includes(cleanNodeId);
      });
      const tag =
        matchingNode?.data?.config?.imageTag ||
        matchingNode?.config?.imageTag ||
        "latest";

      return {
        key,
        url,
        registry,
        repoName,
        tag,
        nodeLabel:
          matchingNode?.data?.label || matchingNode?.label || repoName,
      };
    });

  const hasEcr =
    ecrOutputs.length > 0 ||
    nodes.some(
      (node) =>
        registryServiceIds.includes(node.type || "") ||
        registryServiceIds.includes(node.data?.serviceId || ""),
    );
  const registryLabel =
    provider === "azure"
      ? "Azure ACR"
      : provider === "gcp"
        ? "Artifact Registry"
        : "ECR";
  const scriptFilePrefix =
    provider === "azure"
      ? "push-to-acr"
      : provider === "gcp"
        ? "push-to-artifact-registry"
        : "push-to-ecr";

  const downloadScript = (content: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return {
    ecrOutputs,
    hasEcr,
    registryLabel,
    scriptFilePrefix,
    downloadBashScript: () =>
      downloadScript(
        generateBashScript(registryLabel, name, ecrOutputs, provider, formRegion),
        `${scriptFilePrefix}.sh`,
      ),
    downloadPowerShellScript: () =>
      downloadScript(
        generatePowerShellScript(
          registryLabel,
          name,
          ecrOutputs,
          provider,
          formRegion,
        ),
        `${scriptFilePrefix}.ps1`,
      ),
  };
}
