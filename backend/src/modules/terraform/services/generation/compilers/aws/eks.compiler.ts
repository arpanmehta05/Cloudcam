import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsEksCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, suffix, deps, providerData } = args;

    // 1. Create EKS Cluster IAM Role
    const clusterRoleName = `role_eks_cluster_${name}`;
    compiler.addResource(
      "aws_iam_role",
      clusterRoleName,
      {
        ...providerData,
        name: compiler
          .getRunNameEx(
            `eks-cluster-role-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
          )
          .substring(0, 64),
        assume_role_policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: { Service: "eks.amazonaws.com" },
            },
          ],
        }),
      },
      "iam",
      true,
      deps,
    );

    // Attach AmazonEKSClusterPolicy
    const clusterPolicyAttachName = `attach_eks_cluster_${name}`;
    compiler.addResource(
      "aws_iam_role_policy_attachment",
      clusterPolicyAttachName,
      {
        ...providerData,
        role: resolveInterpolation("aws_iam_role", clusterRoleName, "name"),
        policy_arn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
      },
      "iam",
      true,
      [`aws_iam_role.${clusterRoleName}`],
    );

    // 2. Resolve network subnets (EKS requires at least 2 availability zones - private subnets used for worker nodes)
    const subnet1 = resolveInterpolation(
      "aws_subnet",
      `${suffix}_private`,
      "id",
    );
    const subnet2 = resolveInterpolation(
      "aws_subnet",
      `${suffix}_private_b`,
      "id",
    );

    const eksClusterName = config.clusterName || `sim-eks-${node.id}`;

    // Create KMS Key for secrets encryption
    const kmsKeyName = `eks_secrets_${name}`;
    compiler.addResource(
      "aws_kms_key",
      kmsKeyName,
      {
        ...providerData,
        description: "KMS key for EKS secrets encryption",
        deletion_window_in_days: 7,
        enable_key_rotation: true,
        tags: {
          Name: compiler.getRunNameEx(`eks-kms-${node.id.substring(0, 8)}`),
        },
      },
      "kms",
      true,
      deps,
    );

    // 3. Create EKS Cluster Control Plane
    compiler.addResource(
      "aws_eks_cluster",
      name,
      {
        ...providerData,
        name: eksClusterName,
        role_arn: resolveInterpolation("aws_iam_role", clusterRoleName, "arn"),
        vpc_config: {
          subnet_ids: [subnet1, subnet2],
        },
        version: (() => {
          if (!config.version) return "1.35";
          const v = parseFloat(config.version);
          return isNaN(v) || v < 1.35 ? "1.35" : config.version;
        })(),
        enabled_cluster_log_types: [
          "api",
          "audit",
          "authenticator",
          "controllerManager",
          "scheduler",
        ],
        encryption_config: [
          {
            resources: ["secrets"],
            provider: {
              key_arn: resolveInterpolation("aws_kms_key", kmsKeyName, "arn"),
            },
          },
        ],
        access_config: {
          authentication_mode: "API_AND_CONFIG_MAP",
          bootstrap_cluster_creator_admin_permissions: true,
        },
      },
      "eks",
      false,
      [
        `aws_iam_role_policy_attachment.${clusterPolicyAttachName}`,
        `aws_subnet.${suffix}_private`,
        `aws_subnet.${suffix}_private_b`,
        `aws_kms_key.${kmsKeyName}`,
        ...deps,
      ],
      ["vpc_config", "encryption_config", "provider", "access_config"],
    );

    // Create IAM OIDC provider for IRSA support
    const oidcName = `eks_oidc_${name}`;
    compiler.addResource(
      "aws_iam_openid_connect_provider",
      oidcName,
      {
        ...providerData,
        client_id_list: ["sts.amazonaws.com"],
        thumbprint_list: ["9e2773614cc3775f847686a247298dd04243a055"],
        url: `\${aws_eks_cluster.${name}.identity[0].oidc[0].issuer}`,
      },
      "iam",
      false,
      [`aws_eks_cluster.${name}`],
    );

    // 4. Create Node Group IAM Role
    const nodeRoleName = `role_eks_nodes_${name}`;
    compiler.addResource(
      "aws_iam_role",
      nodeRoleName,
      {
        ...providerData,
        name: compiler
          .getRunNameEx(
            `eks-node-role-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
          )
          .substring(0, 64),
        assume_role_policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: { Service: "ec2.amazonaws.com" },
            },
          ],
        }),
      },
      "iam",
      true,
      deps,
    );

    // Attach WorkerNode Policy
    const nodePolicyAttachName1 = `attach_eks_node_worker_${name}`;
    compiler.addResource(
      "aws_iam_role_policy_attachment",
      nodePolicyAttachName1,
      {
        ...providerData,
        role: resolveInterpolation("aws_iam_role", nodeRoleName, "name"),
        policy_arn: "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
      },
      "iam",
      true,
      [`aws_iam_role.${nodeRoleName}`],
    );

    // Attach CNI Policy
    const nodePolicyAttachName2 = `attach_eks_node_cni_${name}`;
    compiler.addResource(
      "aws_iam_role_policy_attachment",
      nodePolicyAttachName2,
      {
        ...providerData,
        role: resolveInterpolation("aws_iam_role", nodeRoleName, "name"),
        policy_arn: "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
      },
      "iam",
      true,
      [`aws_iam_role.${nodeRoleName}`],
    );

    // Attach ECR ReadOnly Policy
    const nodePolicyAttachName3 = `attach_eks_node_ecr_${name}`;
    compiler.addResource(
      "aws_iam_role_policy_attachment",
      nodePolicyAttachName3,
      {
        ...providerData,
        role: resolveInterpolation("aws_iam_role", nodeRoleName, "name"),
        policy_arn:
          "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
      },
      "iam",
      true,
      [`aws_iam_role.${nodeRoleName}`],
    );

    // 5. Create EKS Node Group
    const nodeGroupName = `nodes_${name}`;
    const nodeCount = config.nodeCount || 2;
    let instanceTypes = config.instanceTypes || ["t3.medium"];
    if (config.instanceType) {
      instanceTypes = [config.instanceType];
    }

    compiler.addResource(
      "aws_eks_node_group",
      nodeGroupName,
      {
        ...providerData,
        cluster_name: resolveInterpolation("aws_eks_cluster", name, "name"),
        node_group_name: `${eksClusterName}-node-group`,
        node_role_arn: resolveInterpolation(
          "aws_iam_role",
          nodeRoleName,
          "arn",
        ),
        subnet_ids: [subnet1, subnet2],
        scaling_config: {
          desired_size: nodeCount,
          max_size: nodeCount + 2,
          min_size: 1,
        },
        instance_types: instanceTypes,
      },
      "eks",
      false,
      [
        `aws_eks_cluster.${name}`,
        `aws_iam_role_policy_attachment.${nodePolicyAttachName1}`,
        `aws_iam_role_policy_attachment.${nodePolicyAttachName2}`,
        `aws_iam_role_policy_attachment.${nodePolicyAttachName3}`,
        `aws_subnet.${suffix}_private`,
        `aws_subnet.${suffix}_private_b`,
      ],
      ["scaling_config"],
    );

    // 6. Deploy standard EKS Add-ons
    const addons = ["vpc-cni", "kube-proxy", "coredns"];
    for (const addon of addons) {
      compiler.addResource(
        "aws_eks_addon",
        `eks_addon_${addon.replace("-", "_")}_${name}`,
        {
          ...providerData,
          cluster_name: resolveInterpolation("aws_eks_cluster", name, "name"),
          addon_name: addon,
        },
        "eks",
        false,
        [`aws_eks_cluster.${name}`, `aws_eks_node_group.${nodeGroupName}`],
      );
    }

    // 7. Deploy Kubernetes Deployment & Service Manifests (if wired to ECR)
    const connectedEcrNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "ecr" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    if (connectedEcrNodes.length > 0) {
      const ecrNode = connectedEcrNodes[0];
      const ecrName = `sim_${ecrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const ecrConfig = ecrNode.config || {};
      let imageUrl = `\${aws_ecr_repository.${ecrName}.repository_url}:latest`;
      const k8sDeps = [`aws_eks_node_group.${nodeGroupName}`];

      if (ecrConfig.repositoryMode === "existing") {
        imageUrl = `${ecrConfig.existingRepositoryUrl || ""}:${ecrConfig.imageTag || "latest"}`;
      } else {
        k8sDeps.push(`aws_ecr_repository.${ecrName}`);
      }

      const clusterAuthName = `cluster_${name}`;
      compiler.addDataSource(
        "aws_eks_cluster_auth",
        clusterAuthName,
        {
          name: resolveInterpolation("aws_eks_cluster", name, "name"),
        },
        [`aws_eks_cluster.${name}`],
      );

      const appPort = Number(config.appPort || 80);
      const k8sName = `eks_app_${name}`;

      compiler.addResource(
        "kubernetes_deployment",
        k8sName,
        {
          metadata: {
            name: `${eksClusterName}-app`,
            labels: {
              app: `${eksClusterName}-app`,
            },
          },
          depends_on: [`\${aws_eks_node_group.${nodeGroupName}}`],
          spec: [
            {
              replicas: nodeCount,
              selector: [
                {
                  match_labels: {
                    app: `${eksClusterName}-app`,
                  },
                },
              ],
              template: [
                {
                  metadata: [
                    {
                      labels: {
                        app: `${eksClusterName}-app`,
                      },
                    },
                  ],
                  spec: [
                    {
                      container: [
                        {
                          name: "app",
                          image: imageUrl,
                          port: [
                            {
                              container_port: appPort,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        "eks",
        false,
        k8sDeps,
        ["metadata", "spec", "selector", "template", "container", "port"],
      );

      compiler.addResource(
        "kubernetes_service",
        k8sName,
        {
          metadata: {
            name: `${eksClusterName}-app-service`,
          },
          depends_on: [`\${kubernetes_deployment.${k8sName}}`],
          spec: [
            {
              selector: {
                app: `${eksClusterName}-app`,
              },
              port: [
                {
                  port: 80,
                  target_port: appPort,
                },
              ],
              type: "LoadBalancer",
            },
          ],
        },
        "eks",
        false,
        [`kubernetes_deployment.${k8sName}`],
        ["metadata", "spec", "port"],
      );
    }
  }
}
