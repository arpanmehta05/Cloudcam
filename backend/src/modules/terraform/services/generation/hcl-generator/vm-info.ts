import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import { resolveInterpolation } from "../graph-resolver";
import { HclBuilder } from "../hcl-builder";
import type { TerraformCompiler } from "../compiler";

export function generateVmInfoOutputs(
  compiler: TerraformCompiler,
  blocks: string[],
  baseName: string,
  shortId: string,
  suffix: string
) {
  const hasVm = compiler.req.nodes.some(
    (n) =>
      n.serviceId === "ec2" ||
      n.serviceId === "azure_vm" ||
      n.serviceId === "gcp_compute" ||
      n.serviceId === "asg" ||
      n.serviceId === "azure_vmss" ||
      n.serviceId === "gcp_mig"
  );

  const hasTlsKey = (compiler as any).implicitResources.some(
    (r: any) => r.type === "tls_private_key" && r.name === "simulation"
  );

  if (hasVm && hasTlsKey) {
    blocks.push(
      HclBuilder.generateBlock("output", ["private_key"], {
        value: resolveInterpolation(
          "tls_private_key",
          "simulation",
          "private_key_pem"
        ),
        sensitive: true,
      })
    );

    if ((compiler as any).provider === "aws") {
      const firstKeyPair = (compiler as any).resources.find(
        (r: any) => r.type === "aws_key_pair"
      );
      if (firstKeyPair) {
        blocks.push(
          HclBuilder.generateBlock("output", ["key_name"], {
            value: resolveInterpolation(
              "aws_key_pair",
              firstKeyPair.name,
              "key_name"
            ),
          })
        );
      }
    } else {
      blocks.push(
        HclBuilder.generateBlock("output", ["key_name"], {
          value: compiler.getGeneratedPemKeyName(),
        })
      );
    }

    // Add vm_info outputs for SSH commands
    for (const node of compiler.req.nodes) {
      if (
        node.serviceId === "ec2" ||
        node.serviceId === "azure_vm" ||
        node.serviceId === "gcp_compute"
      ) {
        const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        const r = (node.config?.region as string) || (compiler as any).region;
        const nodeSuffix = compiler.getInfraSuffix(r);
        const githubConfig = compiler.resolveGithubDependency(node.id);
        const dockerHubConfig = compiler.resolveDockerHubDependency(node.id);
        const ecrConfig = compiler.resolveEcrDependency(node.id);
        const appConfig = dockerHubConfig || githubConfig || ecrConfig;
        const appPort = appConfig
          ? Number(
              appConfig.appPort || (dockerHubConfig || ecrConfig ? 8080 : 80)
            )
          : 0;

        if (node.serviceId === "ec2") {
          const isPrivateVal = compiler.isRegionPrivate(r, "aws");
          const instanceCount = Number(node.config?.count || 1);
          if (instanceCount > 1) {
            for (let i = 0; i < instanceCount; i++) {
              const ipValue = isPrivateVal
                ? `\${aws_instance.${name}[${i}].private_ip}`
                : `\${aws_instance.${name}[${i}].public_ip}`;
              const userValue =
                (node.config?.adminUsername as string) || "ec2-user";
              const keyName = `\${aws_key_pair.${nodeSuffix}.key_name}`;

              blocks.push(
                HclBuilder.generateBlock("output", [`vm_info_${name}_${i}`], {
                  value: {
                    public_ip: ipValue,
                    username: userValue,
                    key_name: keyName,
                    application_url: appConfig ? `http://${ipValue}` : "",
                    application_port: appPort,
                    container_port:
                      dockerHubConfig || ecrConfig
                        ? Number(
                            (dockerHubConfig || ecrConfig).containerPort ||
                              appPort
                          )
                        : appPort,
                    reverse_proxy: appConfig ? "nginx" : "",
                    health_check_path: appConfig
                      ? "/opt/app/rabbittize-health.json"
                      : "",
                    health_log_path: appConfig
                      ? "/opt/app/rabbittize-health.log"
                      : "",
                    health_probe_command: appConfig
                      ? "sudo cat /opt/app/rabbittize-health.json && sudo tail -n 200 /opt/app/rabbittize-health.log"
                      : "",
                  },
                })
              );
            }
          } else {
            const connectedEipNode = compiler.req.nodes.find(
              (n) =>
                n.serviceId === "eip" &&
                (compiler.req.edges?.some(
                  (e) =>
                    (e.source === node.id && e.target === n.id) ||
                    (e.source === n.id && e.target === node.id)
                ) ??
                  false)
            );

            let ipValue = isPrivateVal
              ? `\${aws_instance.${name}.private_ip}`
              : `\${aws_instance.${name}.public_ip}`;
            if (connectedEipNode) {
              const eipName = `sim_${connectedEipNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
              ipValue = `\${aws_eip.${eipName}.public_ip}`;
            }

            const userValue =
              (node.config?.adminUsername as string) || "ec2-user";
            const keyName = `\${aws_key_pair.${nodeSuffix}.key_name}`;

            blocks.push(
              HclBuilder.generateBlock("output", [`vm_info_${name}`], {
                value: {
                  public_ip: ipValue,
                  username: userValue,
                  key_name: keyName,
                  application_url: appConfig ? `http://${ipValue}` : "",
                  application_port: appPort,
                  container_port:
                    dockerHubConfig || ecrConfig
                      ? Number(
                          (dockerHubConfig || ecrConfig).containerPort ||
                            appPort
                        )
                      : appPort,
                  reverse_proxy: appConfig ? "nginx" : "",
                  health_check_path: appConfig
                    ? "/opt/app/rabbittize-health.json"
                    : "",
                  health_log_path: appConfig
                    ? "/opt/app/rabbittize-health.log"
                    : "",
                  health_probe_command: appConfig
                    ? "sudo cat /opt/app/rabbittize-health.json && sudo tail -n 200 /opt/app/rabbittize-health.log"
                    : "",
                },
              })
            );
          }
        } else {
          let ipValue = "";
          let userValue = "";
          let keyName = "";
          const isPrivateVal = compiler.isRegionPrivate(
            r,
            node.serviceId === "azure_vm" ? "azure" : "gcp"
          );
          if (node.serviceId === "azure_vm") {
            ipValue = isPrivateVal
              ? `\${azurerm_linux_virtual_machine.${name}.private_ip_address}`
              : `\${azurerm_linux_virtual_machine.${name}.public_ip_address}`;
            userValue = (node.config?.adminUsername as string) || "azureuser";
            keyName = compiler.getGeneratedPemKeyName();
          } else if (node.serviceId === "gcp_compute") {
            ipValue = isPrivateVal
              ? `\${google_compute_instance.${name}.network_interface[0].network_ip}`
              : `\${google_compute_instance.${name}.network_interface[0].access_config[0].nat_ip}`;
            userValue = "cloudwatcher";
            keyName = compiler.getGeneratedPemKeyName();
          }

          blocks.push(
            HclBuilder.generateBlock("output", [`vm_info_${name}`], {
              value: {
                public_ip: ipValue,
                username: userValue,
                key_name: keyName,
                application_url: appConfig ? `http://${ipValue}` : "",
                application_port: appPort,
                container_port:
                  dockerHubConfig || ecrConfig
                    ? Number(
                        (dockerHubConfig || ecrConfig).containerPort ||
                          appPort
                      )
                    : appPort,
                reverse_proxy: appConfig ? "nginx" : "",
                health_check_path: appConfig
                  ? "/opt/app/rabbittize-health.json"
                  : "",
                health_log_path: appConfig
                  ? "/opt/app/rabbittize-health.log"
                  : "",
                health_probe_command: appConfig
                  ? "sudo cat /opt/app/rabbittize-health.json && sudo tail -n 200 /opt/app/rabbittize-health.log"
                  : "",
              },
            })
          );
        }
      }
    }
  }
}
