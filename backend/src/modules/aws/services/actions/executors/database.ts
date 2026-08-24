import { RDSClient, StopDBInstanceCommand, StartDBInstanceCommand, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";

export async function executeDatabase(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  proposedState?: string
): Promise<any> {
  switch (actionId) {
    case "rds-stop": {
      const rds = new RDSClient(clientConfig);
      await rds.send(new StopDBInstanceCommand({ DBInstanceIdentifier: resourceId }));
      return { stopped: true };
    }

    case "dynamodb-autoscale": {
      const { ApplicationAutoScalingClient, RegisterScalableTargetCommand, PutScalingPolicyCommand } = await import("@aws-sdk/client-application-auto-scaling");
      const aasClient = new ApplicationAutoScalingClient(clientConfig);
      const resourceIdStr = `table/${resourceId}`;

      // 1. Register Read Capacity scalable target
      await aasClient.send(
        new RegisterScalableTargetCommand({
          ServiceNamespace: "dynamodb",
          ResourceId: resourceIdStr,
          ScalableDimension: "dynamodb:table:ReadCapacityUnits",
          MinCapacity: 5,
          MaxCapacity: 100,
        })
      );

      // 2. Apply Read Capacity target tracking scaling policy
      await aasClient.send(
        new PutScalingPolicyCommand({
          PolicyName: "DynamoDBReadCapacityUtilizationScalingPolicy",
          ServiceNamespace: "dynamodb",
          ResourceId: resourceIdStr,
          ScalableDimension: "dynamodb:table:ReadCapacityUnits",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingScalingPolicyConfiguration: {
            TargetValue: 70.0,
            PredefinedMetricSpecification: {
              PredefinedMetricType: "DynamoDBReadCapacityUtilization",
            },
            ScaleOutCooldown: 60,
            ScaleInCooldown: 60,
          },
        })
      );

      // 3. Register Write Capacity scalable target
      await aasClient.send(
        new RegisterScalableTargetCommand({
          ServiceNamespace: "dynamodb",
          ResourceId: resourceIdStr,
          ScalableDimension: "dynamodb:table:WriteCapacityUnits",
          MinCapacity: 5,
          MaxCapacity: 100,
        })
      );

      // 4. Apply Write Capacity target tracking scaling policy
      await aasClient.send(
        new PutScalingPolicyCommand({
          PolicyName: "DynamoDBWriteCapacityUtilizationScalingPolicy",
          ServiceNamespace: "dynamodb",
          ResourceId: resourceIdStr,
          ScalableDimension: "dynamodb:table:WriteCapacityUnits",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingScalingPolicyConfiguration: {
            TargetValue: 70.0,
            PredefinedMetricSpecification: {
              PredefinedMetricType: "DynamoDBWriteCapacityUtilization",
            },
            ScaleOutCooldown: 60,
            ScaleInCooldown: 60,
          },
        })
      );

      return { autoscaleEnabled: true, table: resourceId, readTargetValue: 70, writeTargetValue: 70 };
    }

    default:
      throw new Error(`No database executor implemented for action: ${actionId}`);
  }
}

export async function rollbackDatabase(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  preSnapshot: any
): Promise<void> {
  switch (actionId) {
    case "rds-stop": {
      const rds = new RDSClient(clientConfig);
      await rds.send(new StartDBInstanceCommand({ DBInstanceIdentifier: resourceId }));
      break;
    }

    default:
      throw new Error(`No database rollback implemented for action: ${actionId}`);
  }
}

export async function captureDatabaseSnapshot(
  service: string,
  resourceId: string,
  clientConfig: any
): Promise<any> {
  switch (service) {
    case "rds": {
      const rds = new RDSClient(clientConfig);
      const result = await rds.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: resourceId }));
      const db = result.DBInstances?.[0];
      return {
        dbIdentifier: db?.DBInstanceIdentifier,
        status: db?.DBInstanceStatus,
        instanceClass: db?.DBInstanceClass,
        engine: db?.Engine,
      };
    }
    default:
      return null;
  }
}
