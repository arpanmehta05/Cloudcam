// Central registry of all default alarm definitions, keyed by service.

export interface AlarmTemplate {
  nameSuffix: string; // appended to "rabbittwatch-{service}-"
  namespace: string; // CloudWatch namespace
  metricName: string;
  stat: "Average" | "Sum" | "Maximum" | "Minimum" | "SampleCount";
  threshold: number;
  comparison:
    | "GreaterThanThreshold"
    | "GreaterThanOrEqualToThreshold"
    | "LessThanThreshold"
    | "LessThanOrEqualToThreshold";
  period: number; // seconds (300 = 5 min)
  evaluationPeriods: number;
  dimensionKey: string | null; // e.g. "InstanceId" | null for account-level
  unit?: string;
  description: string; // human-readable description
}

export const DEFAULT_ALARM_TEMPLATES: Record<string, AlarmTemplate[]> = {
  ec2: [
    {
      nameSuffix: "High-CPU",
      namespace: "AWS/EC2",
      metricName: "CPUUtilization",
      stat: "Average",
      threshold: 85,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 3,
      dimensionKey: "InstanceId",
      description: "CPU utilization is too high (>85%)",
    },
    {
      nameSuffix: "Status-Check-Failed",
      namespace: "AWS/EC2",
      metricName: "StatusCheckFailed",
      stat: "Maximum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 60,
      evaluationPeriods: 2,
      dimensionKey: "InstanceId",
      description: "EC2 instance status check failed",
    },
  ],
  lambda: [
    {
      nameSuffix: "Errors",
      namespace: "AWS/Lambda",
      metricName: "Errors",
      stat: "Sum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "FunctionName",
      description: "Lambda function execution errors detected",
    },
    {
      nameSuffix: "Throttles",
      namespace: "AWS/Lambda",
      metricName: "Throttles",
      stat: "Sum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "FunctionName",
      description: "Lambda function is being throttled",
    },
    {
      nameSuffix: "High-Duration",
      namespace: "AWS/Lambda",
      metricName: "Duration",
      stat: "Average",
      threshold: 0, // Dynamic: set to 80% of function timeout
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "FunctionName",
      description: "Lambda duration is near timeout (>80%)",
    },
  ],
  rds: [
    {
      nameSuffix: "High-CPU",
      namespace: "AWS/RDS",
      metricName: "CPUUtilization",
      stat: "Average",
      threshold: 80,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 3,
      dimensionKey: "DBInstanceIdentifier",
      description: "RDS CPU utilization is high (>80%)",
    },
    {
      nameSuffix: "Low-Storage",
      namespace: "AWS/RDS",
      metricName: "FreeStorageSpace",
      stat: "Average",
      threshold: 10737418240, // 10GB in bytes
      comparison: "LessThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "DBInstanceIdentifier",
      description: "RDS free storage is low (<10GB)",
    },
    {
      nameSuffix: "High-Connections",
      namespace: "AWS/RDS",
      metricName: "DatabaseConnections",
      stat: "Average",
      threshold: 100,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 3,
      dimensionKey: "DBInstanceIdentifier",
      description: "RDS database connections are high (>100)",
    },
  ],
  ecs: [
    {
      nameSuffix: "High-CPU",
      namespace: "AWS/ECS",
      metricName: "CPUUtilization",
      stat: "Average",
      threshold: 80,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 3,
      dimensionKey: "ServiceName", // Also needs ClusterName in reality
      description: "ECS service CPU usage is high (>80%)",
    },
    {
      nameSuffix: "High-Memory",
      namespace: "AWS/ECS",
      metricName: "MemoryUtilization",
      stat: "Average",
      threshold: 85,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 3,
      dimensionKey: "ServiceName",
      description: "ECS service memory usage is high (>85%)",
    },
  ],
  dynamodb: [
    {
      nameSuffix: "Read-Throttle",
      namespace: "AWS/DynamoDB",
      metricName: "ReadThrottleEvents",
      stat: "Sum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "TableName",
      description: "DynamoDB read requests are being throttled",
    },
    {
      nameSuffix: "Write-Throttle",
      namespace: "AWS/DynamoDB",
      metricName: "WriteThrottleEvents",
      stat: "Sum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "TableName",
      description: "DynamoDB write requests are being throttled",
    },
    {
      nameSuffix: "System-Errors",
      namespace: "AWS/DynamoDB",
      metricName: "SystemErrors",
      stat: "Sum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "TableName",
      description: "DynamoDB system errors detected",
    },
  ],
  amplify: [
    {
      nameSuffix: "5XX-Errors",
      namespace: "AWS/AmplifyHosting",
      metricName: "5xxErrors",
      stat: "Sum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "App",
      description: "Amplify app is returning 5XX errors",
    },
  ],
  sqs: [
    {
      nameSuffix: "Oldest-Message",
      namespace: "AWS/SQS",
      metricName: "ApproximateAgeOfOldestMessage",
      stat: "Maximum",
      threshold: 3600, // 1 hour
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "QueueName",
      description: "SQS oldest message age is too high (>1 hour)",
    },
    {
      nameSuffix: "Visible-Messages",
      namespace: "AWS/SQS",
      metricName: "ApproximateNumberOfMessagesVisible",
      stat: "Maximum",
      threshold: 1000,
      comparison: "GreaterThanThreshold",
      period: 300,
      evaluationPeriods: 1,
      dimensionKey: "QueueName",
      description: "SQS queue backlogged (>1000 messages)",
    },
  ],
  alb: [
    {
      nameSuffix: "High-5XX",
      namespace: "AWS/ApplicationELB",
      metricName: "HTTPCode_Target_5XX_Count",
      stat: "Sum",
      threshold: 0,
      comparison: "GreaterThanThreshold",
      period: 60,
      evaluationPeriods: 1,
      dimensionKey: "LoadBalancer",
      description: "ALB Target group returning 5XX errors",
    },
    {
      nameSuffix: "High-Latency",
      namespace: "AWS/ApplicationELB",
      metricName: "TargetResponseTime",
      stat: "Average",
      threshold: 1, // 1 second
      comparison: "GreaterThanThreshold",
      period: 60,
      evaluationPeriods: 3,
      dimensionKey: "LoadBalancer",
      description: "ALB target latency is high (>1s)",
    },
  ],
};
