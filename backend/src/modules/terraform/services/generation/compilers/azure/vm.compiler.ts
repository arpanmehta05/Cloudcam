import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureVmCompiler implements ResourceCompiler {
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

    const connectedPip = compiler.req.nodes.find(
      (n) =>
        n.serviceId === "azure_pip" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    const isPrivate = compiler.isRegionPrivate(r, "azure");
    const pipName = connectedPip
      ? `sim_${connectedPip.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`
      : `pip_${name}`;

    const pipId = !isPrivate ? resolveInterpolation("azurerm_public_ip", pipName, "id") : undefined;

    if (!isPrivate && !connectedPip) {
      compiler.addResource(
        "azurerm_public_ip",
        pipName,
        {
          name: `sim-pip-${name}`,
          location: r,
          resource_group_name: activeRgNameVal,
          allocation_method: "Static",
          sku: "Standard",
        },
        "pip",
        true,
        activeRgDep,
      );
    }

    const ipConfig: any = {
      name: "internal",
      subnet_id: resolveInterpolation(
        compiler.req.isVmContributor ? "data.azurerm_subnet" : "azurerm_subnet",
        `${suffix}_public`,
        "id",
      ),
      private_ip_address_allocation: "Dynamic",
    };
    if (pipId) {
      ipConfig.public_ip_address_id = pipId;
    }

    const nicDeps = [...activeRgDep];
    if (!compiler.req.isVmContributor) {
      nicDeps.push(`azurerm_subnet.${suffix}_public`);
    }
    if (!isPrivate) {
      nicDeps.push(`azurerm_public_ip.${pipName}`);
    }

    compiler.addResource(
      "azurerm_network_interface",
      `nic_${name}`,
      {
        name: `sim-nic-${name}`,
        location: r,
        resource_group_name: activeRgNameVal,
        ip_configuration: [ipConfig],
      },
      "nic",
      true,
      nicDeps,
      ["ip_configuration"],
    );

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

    const hasPassword = !!(config.adminPassword || config.admin_password);
    const azureVmParams: any = {
      name: compiler.shortId
        ? `${config.instanceName}${compiler.shortId}`
        : config.instanceName,
      location: r,
      resource_group_name: activeRgNameVal,
      size: config.vmSize,
      admin_username: config.adminUsername,
      network_interface_ids: [
        resolveInterpolation("azurerm_network_interface", `nic_${name}`, "id"),
      ],
      os_disk: {
        caching: "ReadWrite",
        storage_account_type: config.osDiskType,
      },
      source_image_reference: {
        publisher: config.imagePublisher,
        offer: config.imageOffer,
        sku: config.imageSku,
        version: "latest",
      },
    };

    if (hasPassword) {
      azureVmParams.admin_password = config.adminPassword || config.admin_password;
      azureVmParams.disable_password_authentication = false;
    } else {
      azureVmParams.admin_ssh_key = [
        {
          username: config.adminUsername,
          public_key: resolveInterpolation(
            "tls_private_key",
            "simulation",
            "public_key_openssh",
          ),
        },
      ];
    }

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

    const azureVmNestedBlocks = [
      "os_disk",
      "source_image_reference",
    ];
    if (!hasPassword) {
      azureVmNestedBlocks.push("admin_ssh_key");
    }

    if (connectedAzureStorageNodes.length > 0) {
      azureVmParams.identity = {
        type: "SystemAssigned",
      };
      azureVmNestedBlocks.push("identity");
    }

    if (bootstrapScript) {
      const localKey = `vm_custom_data_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      compiler.addLocal(localKey, bootstrapScript);
      azureVmParams.custom_data = `\${base64encode(local.${localKey})}`;
    }

    compiler.addResource(
      "azurerm_linux_virtual_machine",
      name,
      azureVmParams,
      "azure_vm",
      false,
      [
        ...activeRgDep,
        `azurerm_network_interface.nic_${name}`,
        ...(!hasPassword ? [`tls_private_key.simulation`] : []),
        ...deps,
      ],
      azureVmNestedBlocks,
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
              "azurerm_linux_virtual_machine",
              name,
              "identity[0].principal_id",
            ),
          },
          "role_assignment",
          true,
          [
            `azurerm_linux_virtual_machine.${name}`,
            `azurerm_storage_account.${storageName}`,
          ],
        );
      }
    }

    // Create firewall rules for connected SQL servers
    const connectedAzureSqlNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "azure_sql" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    for (const sqlNode of connectedAzureSqlNodes) {
      const sqlName = `sim_${sqlNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      compiler.addResource(
        "azurerm_mssql_firewall_rule",
        `fw_${name}_${sqlName}`,
        {
          name: `allow-vm-${name}`.substring(0, 15),
          server_id: resolveInterpolation(
            "azurerm_mssql_server",
            `server_${sqlName}`,
            "id",
          ),
          start_ip_address: resolveInterpolation(
            "azurerm_public_ip",
            `pip_${name}`,
            "ip_address",
          ),
          end_ip_address: resolveInterpolation(
            "azurerm_public_ip",
            `pip_${name}`,
            "ip_address",
          ),
        },
        "firewall",
        true,
        [
          `azurerm_mssql_server.server_${sqlName}`,
          `azurerm_public_ip.pip_${name}`,
        ],
      );
    }

    // Scan for connected Network Security Group
    const connectedNsgNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "azure_nsg" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let nsgId = resolveInterpolation("azurerm_network_security_group", suffix, "id");
    let nsgDep = `azurerm_network_security_group.${suffix}`;

    if (connectedNsgNodes.length > 0) {
      const customNsgNode = connectedNsgNodes[0];
      const customNsgName = `sim_${customNsgNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      nsgId = resolveInterpolation("azurerm_network_security_group", customNsgName, "id");
      nsgDep = `azurerm_network_security_group.${customNsgName}`;
    }

    // Associate the target VM's network interface with the NSG to enable port 22 (SSH) and web traffic
    compiler.addResource(
      "azurerm_network_interface_security_group_association",
      `nic_assoc_${name}`,
      {
        network_interface_id: resolveInterpolation(
          "azurerm_network_interface",
          `nic_${name}`,
          "id",
        ),
        network_security_group_id: nsgId,
      },
      "nsg_assoc",
      true,
      [
        `azurerm_network_interface.nic_${name}`,
        nsgDep,
      ],
    );
  }
}
