import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import { resolveInterpolation } from "../graph-resolver";
import { HclBuilder } from "../hcl-builder";
import type { TerraformCompiler } from "../compiler";

export function generateOtherOutputs(
  compiler: TerraformCompiler,
  blocks: string[]
) {
  // Output for container registry URL if new registry nodes exist
  const registryServiceIds = ["ecr", "azure_acr", "gcp_artifact_registry"];
  for (const node of compiler.req.nodes) {
    if (
      registryServiceIds.includes(node.serviceId) &&
      node.config?.repositoryMode !== "existing"
    ) {
      const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      let valueExpr: string;
      if (node.serviceId === "azure_acr" || (compiler as any).provider === "azure") {
        valueExpr = resolveInterpolation(
          "azurerm_container_registry",
          name,
          "login_server"
        );
      } else if (
        node.serviceId === "gcp_artifact_registry" ||
        (compiler as any).provider === "gcp"
      ) {
        valueExpr = `\${google_artifact_registry_repository.${name}.location}-docker.pkg.dev/\${google_artifact_registry_repository.${name}.project}/\${google_artifact_registry_repository.${name}.repository_id}`;
      } else {
        valueExpr = resolveInterpolation(
          "aws_ecr_repository",
          name,
          "repository_url"
        );
      }
      blocks.push(
        HclBuilder.generateBlock("output", [`ecr_url_${name}`], {
          value: valueExpr,
        })
      );
    }
  }

  // Output for API Gateway endpoint URL if API Gateway nodes exist
  for (const node of compiler.req.nodes) {
    if (node.serviceId === "apigateway") {
      const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      let valueExpr = resolveInterpolation(
        "aws_apigatewayv2_api",
        name,
        "api_endpoint"
      );
      if ((compiler as any).provider === "azure") {
        valueExpr = resolveInterpolation(
          "azurerm_api_management",
          name,
          "gateway_url"
        );
      } else if ((compiler as any).provider === "gcp") {
        valueExpr = resolveInterpolation(
          "google_api_gateway_gateway",
          `gw_${name}`,
          "default_hostname"
        );
      }
      blocks.push(
        HclBuilder.generateBlock("output", [`apigateway_url_${name}`], {
          value: valueExpr,
        })
      );
    }
  }

  // Output for CDN domain URL if CDN nodes exist
  for (const node of compiler.req.nodes) {
    if (
      node.serviceId === "cloudfront" ||
      node.serviceId === "azure_cdn" ||
      node.serviceId === "gcp_cdn"
    ) {
      const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      let valueExpr = "";
      if (node.serviceId === "cloudfront" || (compiler as any).provider === "aws") {
        valueExpr = resolveInterpolation(
          "aws_cloudfront_distribution",
          name,
          "domain_name"
        );
      } else if (
        node.serviceId === "azure_cdn" ||
        (compiler as any).provider === "azure"
      ) {
        valueExpr = resolveInterpolation(
          "azurerm_cdn_endpoint",
          name,
          "fqdn"
        );
      } else if (node.serviceId === "gcp_cdn" || (compiler as any).provider === "gcp") {
        valueExpr = resolveInterpolation(
          "google_compute_global_forwarding_rule",
          `fr_${name}`,
          "ip_address"
        );
      }
      blocks.push(
        HclBuilder.generateBlock("output", [`cdn_domain_${name}`], {
          value: valueExpr,
        })
      );
    }
  }

  // Add lb_info outputs for Load Balancers and EKS
  for (const node of compiler.req.nodes) {
    if (
      node.serviceId === "elb" ||
      node.serviceId === "azure_lb" ||
      node.serviceId === "gcp_lb"
    ) {
      const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      let dnsValue = "";
      if (node.serviceId === "elb") {
        dnsValue = `http://\${aws_lb.${name}.dns_name}`;
      } else if (node.serviceId === "azure_lb") {
        dnsValue = `http://\${azurerm_public_ip.pip_${name}.ip_address}`;
      } else if (node.serviceId === "gcp_lb") {
        dnsValue = `http://\${google_compute_global_forwarding_rule.${name}.ip_address}`;
      }
      blocks.push(
        HclBuilder.generateBlock("output", [`lb_info_${name}`], {
          value: {
            url: dnsValue,
            name: (node.config?.lbName as string) || "Load Balancer",
          },
        })
      );
    } else if (node.serviceId === "eks" && (compiler as any).provider === "aws") {
      const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const k8sServiceName = `eks_app_${name}`;
      blocks.push(
        HclBuilder.generateBlock("output", [`lb_info_${name}`], {
          value: {
            url: `\${try(format("http://%s", kubernetes_service.${k8sServiceName}.status[0].load_balancer[0].ingress[0].hostname), "")}`,
            name: (node.config?.clusterName as string) || "EKS Cluster",
          },
        })
      );
    }
  }

  // ECR / ACR / GCP Output Instructions
  for (const node of compiler.req.nodes) {
    const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
    if (
      node.serviceId === "ecr" ||
      node.serviceId === "azure_acr" ||
      node.serviceId === "gcp_artifact_registry"
    ) {
      let activeProvider: "aws" | "azure" | "gcp" = (compiler as any).provider;
      if (node.serviceId === "azure_acr") {
        activeProvider = "azure";
      } else if (node.serviceId === "gcp_artifact_registry") {
        activeProvider = "gcp";
      }

      if (activeProvider === "azure") {
        blocks.push(
          HclBuilder.generateBlock("output", [`${name}_push_instructions`], {
            description:
              "CLI commands to build and push the Docker image to Azure Container Registry (ACR)",
            value: `docker login \${azurerm_container_registry.${name}.login_server} -u \${azurerm_container_registry.${name}.admin_username} -p \${azurerm_container_registry.${name}.admin_password} && docker build -t \${azurerm_container_registry.${name}.login_server}/${name}:latest . && docker push \${azurerm_container_registry.${name}.login_server}/${name}:latest`,
          })
        );
      } else if (activeProvider === "gcp") {
        blocks.push(
          HclBuilder.generateBlock("output", [`${name}_push_instructions`], {
            description:
              "CLI commands to build and push the Docker image to GCP Artifact Registry",
            value: `gcloud auth configure-docker \${google_artifact_registry_repository.${name}.location}-docker.pkg.dev && docker build -t \${google_artifact_registry_repository.${name}.location}-docker.pkg.dev/<YOUR_GCP_PROJECT_ID>/\${google_artifact_registry_repository.${name}.repository_id}/${name}:latest . && docker push \${google_artifact_registry_repository.${name}.location}-docker.pkg.dev/<YOUR_GCP_PROJECT_ID>/\${google_artifact_registry_repository.${name}.repository_id}/${name}:latest`,
          })
        );
      } else {
        // AWS ECR
        const schema = ServiceSchemas["ecr"];
        const ecrConfig = schema
          ? schema.parse(node.config || {})
          : node.config || {};

        if (ecrConfig.repositoryMode === "existing") {
          const existingUrl = ecrConfig.existingRepositoryUrl || "";
          const registryDomain =
            existingUrl.split("/")[0] ||
            "578761488849.dkr.ecr.us-east-1.amazonaws.com";
          const repoName = ecrConfig.repositoryName || "sim-repo";
          const tag = ecrConfig.imageTag || "latest";

          blocks.push(
            HclBuilder.generateBlock(
              "output",
              [`${name}_push_instructions`],
              {
                description:
                  "CLI commands to build and push the Docker image to AWS ECR repository",
                value: `aws ecr get-login-password --region ${(compiler as any).region} | docker login --username AWS --password-stdin ${registryDomain} && docker build -t ${repoName} . && docker tag ${repoName}:${tag} ${existingUrl}:${tag} && docker push ${existingUrl}:${tag}`,
              }
            )
          );
        } else {
          blocks.push(
            HclBuilder.generateBlock(
              "output",
              [`${name}_push_instructions`],
              {
                description:
                  "CLI commands to build and push the Docker image to AWS ECR repository",
                value: `aws ecr get-login-password --region ${(compiler as any).region} | docker login --username AWS --password-stdin \${split("/", aws_ecr_repository.${name}.repository_url)[0]} && docker build -t \${aws_ecr_repository.${name}.name} . && docker tag \${aws_ecr_repository.${name}.name}:latest \${aws_ecr_repository.${name}.repository_url}:latest && docker push \${aws_ecr_repository.${name}.repository_url}:latest`,
              }
            )
          );
        }
      }
    }
  }
}
