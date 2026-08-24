import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureVmssCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const {
      node,
      config,
      name,
      r,
      suffix,
      deps,
      providerData,
      rgNameVal,
      rgDep,
    } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    const dbEnvVars = compiler.resolveDatabaseDependencies(node.id);
    const githubConfig = compiler.resolveGithubDependency(node.id);
    const dockerHubConfig = compiler.resolveDockerHubDependency(node.id);
    const mergedConfig = {
      ...config,
      ...(githubConfig || {}),
      ...(dockerHubConfig || {}),
    };
    const bootstrapScript = compiler.generateBootstrapScript(
      mergedConfig,
      dbEnvVars,
      "ubuntu",
    );

    const subnetIdVal = compiler.req.isVmContributor
      ? resolveInterpolation("data.azurerm_subnet", `${suffix}_public`, "id")
      : resolveInterpolation("azurerm_subnet", `${suffix}_public`, "id");

    const connectedAzureLbs = compiler.req.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "azure_lb");

    const connectedAzureTgs = compiler.req.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "azure_tg");

    const backendPoolIds = [
      ...connectedAzureLbs.map((lb) => {
        const lbName = `sim_${lb.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        return resolveInterpolation(
          "azurerm_lb_backend_address_pool",
          lbName,
          "id",
        );
      }),
      ...connectedAzureTgs.map((tg) => {
        const tgName = `sim_${tg.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        return resolveInterpolation(
          "azurerm_lb_backend_address_pool",
          tgName,
          "id",
        );
      })
    ];

    const lbDeps = [
      ...connectedAzureLbs.map((lb) => {
        const lbName = `sim_${lb.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        return `azurerm_lb_backend_address_pool.${lbName}`;
      }),
      ...connectedAzureTgs.map((tg) => {
        const tgName = `sim_${tg.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        return `azurerm_lb_backend_address_pool.${tgName}`;
      })
    ];

    const hasPasswordAuth = !!(config.adminPassword || config.admin_password);

    const vmssParams: any = {
      name: compiler.shortId
        ? `${config.instanceName}${compiler.shortId}`
            .toLowerCase()
            .substring(0, 9)
        : config.instanceName.toLowerCase().substring(0, 9),
      location: r,
      resource_group_name: activeRgNameVal,
      sku: config.vmSize,
      instances: Number(config.desiredCapacity ?? config.minSize ?? 1),
      admin_username: config.adminUsername,
      ...(hasPasswordAuth
        ? {
            admin_password: config.adminPassword || config.admin_password,
            disable_password_authentication: false,
          }
        : {
            admin_ssh_key: [
              {
                username: config.adminUsername,
                public_key: resolveInterpolation(
                  "tls_private_key",
                  "simulation",
                  "public_key_openssh",
                ),
              },
            ],
          }),
      source_image_reference: {
        publisher: config.imagePublisher,
        offer: config.imageOffer,
        sku: config.imageSku,
        version: "latest",
      },
      os_disk: {
        caching: "ReadWrite",
        storage_account_type: config.osDiskType,
      },
      network_interface: [
        {
          name: `nic-${name}`,
          primary: true,
          ip_configuration: [
            {
              name: "internal",
              primary: true,
              subnet_id: subnetIdVal,
              load_balancer_backend_address_pool_ids:
                backendPoolIds.length > 0 ? backendPoolIds : undefined,
            },
          ],
        },
      ],
    };

    const connectedAzureStorageNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "azure_storage" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    const vmssNestedBlocks = [
      "admin_ssh_key",
      "source_image_reference",
      "os_disk",
      "network_interface",
      "ip_configuration",
    ];

    if (connectedAzureStorageNodes.length > 0) {
      vmssParams.identity = {
        type: "SystemAssigned",
      };
      vmssNestedBlocks.push("identity");
    }

    if (bootstrapScript) {
      const localKey = `vmss_custom_data_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      compiler.addLocal(localKey, bootstrapScript);
      vmssParams.custom_data = `\${base64encode(local.${localKey})}`;
    }

    const vmssDeps = [
      ...activeRgDep,
      `tls_private_key.simulation`,
      ...deps,
      ...lbDeps,
    ];
    if (!compiler.req.isVmContributor) {
      vmssDeps.push(`azurerm_subnet.${suffix}_public`);
    }

    compiler.addResource(
      "azurerm_linux_virtual_machine_scale_set",
      name,
      vmssParams,
      "azure_vmss",
      false,
      vmssDeps,
      vmssNestedBlocks,
    );

    // Create role assignments for connected storage accounts
    if (connectedAzureStorageNodes.length > 0) {
      for (const storageNode of connectedAzureStorageNodes) {
        const storageName = `sim_${storageNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        compiler.addResource(
          "azurerm_role_assignment",
          `role_assign_${name}_${storageName}`,
          {
            scope: resolveInterpolation(
              "azurerm_storage_account",
              storageName,
              "id",
            ),
            role_definition_name: "Storage Blob Data Contributor",
            principal_id: resolveInterpolation(
              "azurerm_linux_virtual_machine_scale_set",
              name,
              "identity[0].principal_id",
            ),
          },
          "role_assignment",
          true,
          [
            `azurerm_linux_virtual_machine_scale_set.${name}`,
            `azurerm_storage_account.${storageName}`,
          ],
        );
      }
    }

    // Create monitor autoscale setting for VMSS
    const cpuTargetVal = Number(config.cpuTarget || 60);
    const scaleOutThreshold = cpuTargetVal;
    const scaleInThreshold = Math.max(10, cpuTargetVal - 25);
    const autoscaleParams: any = {
      name: `autoscale-${name}`,
      resource_group_name: activeRgNameVal,
      location: r,
      target_resource_id: resolveInterpolation(
        "azurerm_linux_virtual_machine_scale_set",
        name,
        "id",
      ),
      profile: [
        {
          name: "defaultProfile",
          capacity: {
            default: Number(config.desiredCapacity ?? config.minSize ?? 1),
            minimum: Number(config.minSize ?? 1),
            maximum: Number(config.maxSize ?? 3),
          },
          rule: [
            {
              metric_trigger: {
                metric_name: "Percentage CPU",
                metric_resource_id: resolveInterpolation(
                  "azurerm_linux_virtual_machine_scale_set",
                  name,
                  "id",
                ),
                time_grain: "PT1M",
                statistic: "Average",
                time_window: "PT5M",
                time_aggregation: "Average",
                operator: "GreaterThan",
                threshold: scaleOutThreshold,
                metric_namespace: "microsoft.compute/virtualmachinescalesets",
              },
              scale_action: {
                direction: "Increase",
                type: "ChangeCount",
                value: "1",
                cooldown: "PT1M",
              },
            },
            {
              metric_trigger: {
                metric_name: "Percentage CPU",
                metric_resource_id: resolveInterpolation(
                  "azurerm_linux_virtual_machine_scale_set",
                  name,
                  "id",
                ),
                time_grain: "PT1M",
                statistic: "Average",
                time_window: "PT5M",
                time_aggregation: "Average",
                operator: "LessThan",
                threshold: scaleInThreshold,
                metric_namespace: "microsoft.compute/virtualmachinescalesets",
              },
              scale_action: {
                direction: "Decrease",
                type: "ChangeCount",
                value: "1",
                cooldown: "PT1M",
              },
            },
          ],
        },
      ],
    };

    compiler.addResource(
      "azurerm_monitor_autoscale_setting",
      `autoscale_${name}`,
      autoscaleParams,
      "azure_vmss",
      false,
      [...activeRgDep, `azurerm_linux_virtual_machine_scale_set.${name}`],
      ["profile", "capacity", "rule", "metric_trigger", "scale_action"],
    );
  }
}
