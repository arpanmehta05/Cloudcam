import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsEcsCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps, providerData } = args;
    const launchType = config.launchType || "FARGATE";
    const useFargateSpot =
      launchType === "FARGATE" && config.useFargateSpot === true;

    // 1. Create ECS Cluster
    compiler.addResource(
      "aws_ecs_cluster",
      name,
      {
        ...providerData,
        name: config.clusterName || `sim-cluster-${node.id}`,
        tags: {
          Name: config.clusterName || `sim-cluster-${node.id}`,
        },
      },
      "ecs",
      false,
      deps,
    );

    // If Fargate Spot is enabled, compile the capacity provider association
    if (useFargateSpot) {
      compiler.addResource(
        "aws_ecs_cluster_capacity_providers",
        `cp_${name}`,
        {
          ...providerData,
          cluster_name: resolveInterpolation("aws_ecs_cluster", name, "name"),
          capacity_providers: ["FARGATE", "FARGATE_SPOT"],
        },
        "ecs",
        false,
        [`aws_ecs_cluster.${name}`],
      );
    }

    // If Service Connect is enabled, compile private DNS namespace
    if (config.enableServiceConnect === true) {
      compiler.addResource(
        "aws_service_discovery_private_dns_namespace",
        `ns_${name}`,
        {
          ...providerData,
          name: config.serviceConnectName || "sim-app",
          vpc: resolveInterpolation("aws_vpc", suffix, "id"),
          description: "Service Connect Cloud Map namespace",
        },
        "ecs",
        false,
        [`aws_vpc.${suffix}`],
      );
    }

    // 2. Create CloudWatch Log Group for ECS Task logs
    const logGroupName = `logs_${name}`;
    compiler.addResource(
      "aws_cloudwatch_log_group",
      logGroupName,
      {
        ...providerData,
        name: `/ecs/sim-${name}${compiler.shortId}-${node.id.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`,
        retention_in_days: 7,
      },
      "ecs",
      true,
      deps,
    );

    // 3. Create ECS Task Execution Role
    const roleName = `role_ecs_${name}`;
    compiler.addResource(
      "aws_iam_role",
      roleName,
      {
        ...providerData,
        name: compiler
          .getRunNameEx(
            `ecs-exec-role-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
          )
          .substring(0, 64),
        assume_role_policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: { Service: "ecs-tasks.amazonaws.com" },
            },
          ],
        }),
      },
      "iam",
      true,
      deps,
    );

    // Attach AmazonECSTaskExecutionRolePolicy to Execution Role
    const attachName = `attach_ecs_${name}`;
    compiler.addResource(
      "aws_iam_role_policy_attachment",
      attachName,
      {
        ...providerData,
        role: resolveInterpolation("aws_iam_role", roleName, "name"),
        policy_arn:
          "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
      },
      "iam",
      true,
      [`aws_iam_role.${roleName}`],
    );

    // If launchType is EC2, we also need an EC2 host instance registered with the ECS Cluster
    let ecsInstanceProfileName = "";
    const ecsHostDeps: string[] = [];
    if (launchType === "EC2") {
      const ecsInstanceRoleName = `role_ecs_host_${name}`;
      compiler.addResource(
        "aws_iam_role",
        ecsInstanceRoleName,
        {
          ...providerData,
          name: compiler
            .getRunNameEx(
              `ecs-host-role-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
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

      const ecsInstanceAttachName = `attach_ecs_host_${name}`;
      compiler.addResource(
        "aws_iam_role_policy_attachment",
        ecsInstanceAttachName,
        {
          ...providerData,
          role: resolveInterpolation(
            "aws_iam_role",
            ecsInstanceRoleName,
            "name",
          ),
          policy_arn:
            "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
        },
        "iam",
        true,
        [`aws_iam_role.${ecsInstanceRoleName}`],
      );

      ecsInstanceProfileName = `profile_ecs_host_${name}`;
      compiler.addResource(
        "aws_iam_instance_profile",
        ecsInstanceProfileName,
        {
          ...providerData,
          name: compiler
            .getRunNameEx(
              `ecs-profile-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
            )
            .substring(0, 64),
          role: resolveInterpolation(
            "aws_iam_role",
            ecsInstanceRoleName,
            "name",
          ),
        },
        "iam",
        true,
        [`aws_iam_role.${ecsInstanceRoleName}`],
      );

      ecsHostDeps.push(`aws_iam_instance_profile.${ecsInstanceProfileName}`);
    }

    // If connected to ECR, check registry name and mode
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

    const connectedDockerHubNodes = compiler.req.nodes.filter(
      (n) =>
        (n.serviceId as string) === "dockerhub" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let imageUrl = "nginx:latest";
    const ecrDeps: string[] = [];
    if (connectedEcrNodes.length > 0) {
      const ecrNode = connectedEcrNodes[0];
      const ecrName = `sim_${ecrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const schema = ServiceSchemas["ecr"];
      const ecrConfig = schema
        ? schema.parse(ecrNode.config || {})
        : ecrNode.config || {};

      if (ecrConfig.repositoryMode === "existing") {
        imageUrl = `${ecrConfig.existingRepositoryUrl || ""}:${ecrConfig.imageTag || "latest"}`;
      } else {
        imageUrl = `\${aws_ecr_repository.${ecrName}.repository_url}:${ecrConfig.imageTag || "latest"}`;
        ecrDeps.push(`aws_ecr_repository.${ecrName}`);
      }
    } else if (connectedDockerHubNodes.length > 0) {
      const dhNode = connectedDockerHubNodes[0];
      const schema = ServiceSchemas["dockerhub"];
      const dhConfig = schema
        ? schema.parse(dhNode.config || {})
        : dhNode.config || {};
      imageUrl = `${dhConfig.repository || "library/nginx"}:${dhConfig.tag || "latest"}`;
    }

    // 4. Create ECS Task Definition
    const taskDefName = `td_${name}`;
    const appPort = Number(config.appPort || 80);
    const networkMode = launchType === "EC2" ? "bridge" : "awsvpc";
    const hostPortValue = launchType === "EC2" ? 0 : appPort;

    compiler.addResource(
      "aws_ecs_task_definition",
      taskDefName,
      {
        ...providerData,
        family: `family_${name}`,
        network_mode: networkMode,
        requires_compatibilities: [launchType],
        cpu: config.cpu || "256",
        memory: config.memory || "512",
        execution_role_arn: resolveInterpolation(
          "aws_iam_role",
          roleName,
          "arn",
        ),
        container_definitions: (() => {
          const containerDefs: any[] = [
            {
              name: "app",
              image: imageUrl,
              essential: true,
              portMappings: [
                {
                  containerPort: appPort,
                  hostPort: hostPortValue,
                  ...(config.enableServiceConnect === true
                    ? { name: "app-port" }
                    : {}),
                },
              ],
              logConfiguration:
                config.enableSidecar === true &&
                config.sidecarType === "fluentbit"
                  ? {
                      logDriver: "awsfirelens",
                      options: {
                        Name: "cloudwatch",
                        region: r,
                        log_group_name: `\${aws_cloudwatch_log_group.${logGroupName}.name}`,
                        log_stream_prefix: "ecs",
                      },
                    }
                  : {
                      logDriver: "awslogs",
                      options: {
                        "awslogs-group": `\${aws_cloudwatch_log_group.${logGroupName}.name}`,
                        "awslogs-region": r,
                        "awslogs-stream-prefix": "ecs",
                      },
                    },
            },
          ];

          if (config.enableSidecar === true) {
            const sidecarType = config.sidecarType || "awslogs";
            if (sidecarType === "fluentbit") {
              containerDefs.push({
                name: "fluentbit",
                image: "amazon/aws-for-fluent-bit:latest",
                essential: false,
                memoryReservation: 50,
                firelensConfiguration: {
                  type: "fluentbit",
                },
              });
            } else if (sidecarType === "proxy") {
              containerDefs.push({
                name: "proxy",
                image: "envoyproxy/envoy:latest",
                essential: false,
                memoryReservation: 128,
                portMappings: [
                  {
                    containerPort: 15001,
                    hostPort: 15001,
                  },
                ],
              });
            } else {
              // "awslogs"
              containerDefs.push({
                name: "awslogs",
                image: "amazon/aws-for-fluent-bit:latest",
                essential: false,
                memoryReservation: 50,
              });
            }
          }

          return JSON.stringify(containerDefs);
        })(),
      },
      "ecs",
      false,
      [
        `aws_iam_role.${roleName}`,
        `aws_cloudwatch_log_group.${logGroupName}`,
        ...ecrDeps,
      ],
      ["container_definitions"],
    );

    // 5. Create ECS Service
    const serviceName = `service_${name}`;
    const subnetIdVal = resolveInterpolation(
      "aws_subnet",
      `${suffix}_public`,
      "id",
    );
    const sgIdVal = resolveInterpolation("aws_security_group", suffix, "id");

    const serviceParams: any = {
      ...providerData,
      name: config.serviceName || `sim-service-${node.id}`,
      cluster: resolveInterpolation("aws_ecs_cluster", name, "id"),
      task_definition: resolveInterpolation(
        "aws_ecs_task_definition",
        taskDefName,
        "arn",
      ),
      desired_count: Number(config.desiredCount || 1),
    };

    if (!useFargateSpot) {
      serviceParams.launch_type = launchType;
    } else {
      serviceParams.capacity_provider_strategy = [
        {
          capacity_provider: "FARGATE",
          weight: 1,
          base: 0,
        },
        {
          capacity_provider: "FARGATE_SPOT",
          weight: Number(config.fargateSpotWeight || 1),
          base: 0,
        },
      ];
    }

    if (launchType === "FARGATE") {
      serviceParams.network_configuration = {
        subnets: [subnetIdVal],
        security_groups: [sgIdVal],
        assign_public_ip: true,
      };
    }

    if (config.enableServiceConnect === true) {
      serviceParams.service_connect_configuration = {
        enabled: true,
        namespace: resolveInterpolation(
          "aws_service_discovery_private_dns_namespace",
          `ns_${name}`,
          "arn",
        ),
        service: {
          port_name: "app-port",
          discovery_name: config.serviceConnectName || "sim-app",
          client_alias: {
            port: appPort,
            dns_name: config.serviceConnectName || "sim-app",
          },
        },
      };
    }

    // Check if connected to ALB Target Group (tg)
    const connectedTgNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "tg" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    const serviceDeps = [
      `aws_ecs_cluster.${name}`,
      `aws_ecs_task_definition.${taskDefName}`,
      `aws_subnet.${suffix}_public`,
      `aws_security_group.${suffix}`,
    ];

    if (useFargateSpot) {
      serviceDeps.push(`aws_ecs_cluster_capacity_providers.cp_${name}`);
    }

    if (config.enableServiceConnect === true) {
      serviceDeps.push(
        `aws_service_discovery_private_dns_namespace.ns_${name}`,
      );
    }

    if (connectedTgNodes.length > 0) {
      const tgNode = connectedTgNodes[0];
      const tgName = `sim_${tgNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      serviceParams.load_balancer = {
        target_group_arn: resolveInterpolation(
          "aws_lb_target_group",
          tgName,
          "arn",
        ),
        container_name: "app",
        container_port: appPort,
      };
      serviceDeps.push(`aws_lb_target_group.${tgName}`);

      // Find the ELB node connected to this target group
      const connectedElbNode = compiler.req.nodes.find(
        (n) =>
          n.serviceId === "elb" &&
          (compiler.req.edges?.some(
            (e) =>
              (e.source === tgNode.id && e.target === n.id) ||
              (e.source === n.id && e.target === tgNode.id),
          ) ??
            false),
      );
      if (connectedElbNode) {
        const elbName = `sim_${connectedElbNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        serviceDeps.push(`aws_lb_listener.${elbName}`);
      }
    }

    // If launchType is EC2, compile the EC2 instance host to register in the cluster
    if (launchType === "EC2") {
      const ec2HostInstanceName = `host_${name}`;
      const ecsClusterNameVal = config.clusterName || `sim-cluster-${node.id}`;

      const hostParams = {
        ...providerData,
        ami: compiler.resolveEc2Ami(r, undefined, "ecs"),
        instance_type: "t3.micro",
        subnet_id: subnetIdVal,
        vpc_security_group_ids: [sgIdVal],
        iam_instance_profile: resolveInterpolation(
          "aws_iam_instance_profile",
          ecsInstanceProfileName,
          "name",
        ),
        user_data: `#!/bin/bash
echo ECS_CLUSTER=${ecsClusterNameVal} >> /etc/ecs/ecs.config`,
        tags: {
          Name: `ecs-host-${ecsClusterNameVal}`,
        },
      };

      compiler.addResource(
        "aws_instance",
        ec2HostInstanceName,
        hostParams,
        "ec2",
        false,
        [
          `aws_ecs_cluster.${name}`,
          `aws_iam_instance_profile.${ecsInstanceProfileName}`,
        ],
      );

      serviceDeps.push(`aws_instance.${ec2HostInstanceName}`);
    }

    const serviceNestedBlocks = ["load_balancer"];
    if (launchType === "FARGATE") {
      serviceNestedBlocks.push("network_configuration");
      if (useFargateSpot) {
        serviceNestedBlocks.push("capacity_provider_strategy");
      }
    }
    if (config.enableServiceConnect === true) {
      serviceNestedBlocks.push(
        "service_connect_configuration",
        "service",
        "client_alias",
      );
    }

    compiler.addResource(
      "aws_ecs_service",
      serviceName,
      serviceParams,
      "ecs",
      false,
      serviceDeps,
      serviceNestedBlocks,
    );

    // 6. Create Autoscaling if enabled
    if (config.enableAutoscaling === true) {
      const targetName = `target_${name}`;
      const policyName = `policy_${name}`;

      compiler.addResource(
        "aws_appautoscaling_target",
        targetName,
        {
          ...providerData,
          max_capacity: Number(config.maxCapacity || 5),
          min_capacity: Number(config.minCapacity || 1),
          resource_id: `service/\${aws_ecs_cluster.${name}.name}/\${aws_ecs_service.${serviceName}.name}`,
          scalable_dimension: "ecs:service:DesiredCount",
          service_namespace: "ecs",
        },
        "ecs",
        false,
        [`aws_ecs_cluster.${name}`, `aws_ecs_service.${serviceName}`],
      );

      compiler.addResource(
        "aws_appautoscaling_policy",
        policyName,
        {
          ...providerData,
          name: "cpu-autoscaling",
          policy_type: "TargetTrackingScaling",
          resource_id: resolveInterpolation(
            "aws_appautoscaling_target",
            targetName,
            "resource_id",
          ),
          scalable_dimension: resolveInterpolation(
            "aws_appautoscaling_target",
            targetName,
            "scalable_dimension",
          ),
          service_namespace: resolveInterpolation(
            "aws_appautoscaling_target",
            targetName,
            "service_namespace",
          ),
          target_tracking_scaling_policy_configuration: {
            predefined_metric_specification: {
              predefined_metric_type: "ECSServiceAverageCPUUtilization",
            },
            target_value: Number(config.cpuTarget || 70),
          },
        },
        "ecs",
        false,
        [`aws_appautoscaling_target.${targetName}`],
        [
          "target_tracking_scaling_policy_configuration",
          "predefined_metric_specification",
        ],
      );
    }
  }
}
