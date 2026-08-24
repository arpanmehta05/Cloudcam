import {
  EC2Client,
  StopInstancesCommand,
  StartInstancesCommand,
  TerminateInstancesCommand,
  ModifyInstanceAttributeCommand,
  DescribeInstancesCommand,
} from "@aws-sdk/client-ec2";
import { LambdaClient, UpdateFunctionConfigurationCommand, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";

export async function executeCompute(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  proposedState?: string
): Promise<any> {
  switch (actionId) {
    case "ec2-stop-idle":
    case "ec2-stop": {
      const ec2 = new EC2Client(clientConfig);
      const result = await ec2.send(new StopInstancesCommand({ InstanceIds: [resourceId] }));
      return { stopped: true, previousState: result.StoppingInstances?.[0]?.PreviousState?.Name };
    }

    case "ec2-terminate": {
      const ec2 = new EC2Client(clientConfig);
      const result = await ec2.send(new TerminateInstancesCommand({ InstanceIds: [resourceId] }));
      return { terminated: true, previousState: result.TerminatingInstances?.[0]?.PreviousState?.Name };
    }

    case "ec2-rightsize": {
      const ec2 = new EC2Client(clientConfig);
      await ec2.send(new StopInstancesCommand({ InstanceIds: [resourceId] }));
      await new Promise((r) => setTimeout(r, 15000));
      const nextInstanceType = proposedState || "t3.small";
      await ec2.send(new ModifyInstanceAttributeCommand({
        InstanceId: resourceId,
        InstanceType: { Value: nextInstanceType },
      }));
      await ec2.send(new StartInstancesCommand({ InstanceIds: [resourceId] }));
      return { rightsized: true, newType: nextInstanceType };
    }

    case "lambda-optimize": {
      const lambda = new LambdaClient(clientConfig);
      const current = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: resourceId }));
      const newMemory = Math.max(128, Math.floor((current.MemorySize || 128) * 0.75));
      await lambda.send(new UpdateFunctionConfigurationCommand({
        FunctionName: resourceId,
        MemorySize: newMemory,
      }));
      return { previousMemory: current.MemorySize, newMemory };
    }

    case "asg-spot-migration": {
      const { AutoScalingClient, DescribeAutoScalingGroupsCommand, UpdateAutoScalingGroupCommand } = await import("@aws-sdk/client-auto-scaling");
      const asgClient = new AutoScalingClient(clientConfig);

      const descResult = await asgClient.send(
        new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [resourceId] })
      );
      const asg = descResult.AutoScalingGroups?.[0];
      if (!asg) throw new Error(`ASG not found: ${resourceId}`);

      const previousPolicy = asg.MixedInstancesPolicy || null;

      await asgClient.send(
        new UpdateAutoScalingGroupCommand({
          AutoScalingGroupName: resourceId,
          MixedInstancesPolicy: {
            LaunchTemplate: asg.MixedInstancesPolicy?.LaunchTemplate || {
              LaunchTemplateSpecification: asg.LaunchTemplate
                ? {
                    LaunchTemplateId: asg.LaunchTemplate.LaunchTemplateId,
                    Version: asg.LaunchTemplate.Version || "$Default",
                  }
                : undefined,
            },
            InstancesDistribution: {
              OnDemandBaseCapacity: 1,
              OnDemandPercentageAboveBaseCapacity: 30,
              SpotAllocationStrategy: "capacity-optimized",
            },
          },
        })
      );

      return {
        migrated: true,
        asgName: resourceId,
        previousPolicy: previousPolicy ? "had_mixed_policy" : "on_demand_only",
        newPolicy: { onDemandBase: 1, onDemandPctAboveBase: 30, spotStrategy: "capacity-optimized" },
      };
    }

    case "purchase-savings-plan": {
      return {
        advisory: true,
        message: "This is an advisory action. No AWS purchase was made.",
        recommendation: {
          resourceId,
          note: "Visit the AWS Console > Cost Management > Savings Plans to purchase.",
          consoleUrl: "https://console.aws.amazon.com/cost-management/home#/savings-plans/purchase",
        },
      };
    }

    default:
      throw new Error(`No compute executor implemented for action: ${actionId}`);
  }
}

export async function rollbackCompute(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  preSnapshot: any
): Promise<void> {
  switch (actionId) {
    case "ec2-stop-idle":
    case "ec2-stop": {
      const ec2 = new EC2Client(clientConfig);
      await ec2.send(new StartInstancesCommand({ InstanceIds: [resourceId] }));
      break;
    }

    case "ec2-rightsize": {
      if (preSnapshot?.instanceType) {
        const ec2 = new EC2Client(clientConfig);
        await ec2.send(new StopInstancesCommand({ InstanceIds: [resourceId] }));
        await new Promise((r) => setTimeout(r, 15000));
        await ec2.send(new ModifyInstanceAttributeCommand({
          InstanceId: resourceId,
          InstanceType: { Value: preSnapshot.instanceType },
        }));
        await ec2.send(new StartInstancesCommand({ InstanceIds: [resourceId] }));
      }
      break;
    }

    case "lambda-optimize": {
      if (preSnapshot?.memorySize) {
        const lambda = new LambdaClient(clientConfig);
        await lambda.send(new UpdateFunctionConfigurationCommand({
          FunctionName: resourceId,
          MemorySize: preSnapshot.memorySize,
        }));
      }
      break;
    }

    default:
      throw new Error(`No compute rollback implemented for action: ${actionId}`);
  }
}

export async function captureComputeSnapshot(
  service: string,
  resourceId: string,
  clientConfig: any
): Promise<any> {
  switch (service) {
    case "ec2": {
      const ec2 = new EC2Client(clientConfig);
      const result = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [resourceId] }));
      const inst = result.Reservations?.[0]?.Instances?.[0];
      return {
        instanceId: inst?.InstanceId,
        instanceType: inst?.InstanceType,
        state: inst?.State?.Name,
        publicIp: inst?.PublicIpAddress,
        tags: inst?.Tags,
      };
    }
    case "lambda": {
      const lambda = new LambdaClient(clientConfig);
      const result = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: resourceId }));
      return {
        functionName: result.FunctionName,
        memorySize: result.MemorySize,
        timeout: result.Timeout,
        runtime: result.Runtime,
      };
    }
    default:
      return null;
  }
}
