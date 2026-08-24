// Service Registry v2 — CloudWatch-based
// Single source of truth for all AWS services and their CloudWatch metrics.
// Replaces the Prometheus-based registry.

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CloudWatchMetricDefinition {
    /** Human-readable metric name (e.g., "cpu") */
    name: string;
    /** CloudWatch namespace (e.g., "AWS/EC2") */
    namespace: string;
    /** CloudWatch metric name (e.g., "CPUUtilization") */
    metricName: string;
    /** Statistic: Average, Sum, Maximum, Minimum, SampleCount */
    stat: string;
    /** Display unit (e.g., "%", "bytes", "ms", "count", "USD") */
    unit: string;
    /** CloudWatch dimension names used to identify resources (e.g., ["InstanceId"]) */
    dimensionNames: string[];
    /** Default period in seconds */
    period: number;
}

export type ServiceCategory =
    | "compute"
    | "serverless"
    | "database"
    | "storage"
    | "networking"
    | "security"
    | "cost"
    | "streaming"
    | "cicd"
    | "iot"
    | "messaging";

export interface ServiceConfig {
    displayName: string;
    azureDisplayName?: string;
    gcpDisplayName?: string;
    category: ServiceCategory;
    /** CloudWatch metrics to fetch for dashboards and chatbot */
    metrics: CloudWatchMetricDefinition[];
    /** CloudWatch Logs log group pattern (null if not applicable) */
    logGroup: string | null;
    /** Icon identifier for the frontend sidebar */
    icon: string;
}

// ─────────────────────────────────────────────────────────────
// SERVICE REGISTRY
// ─────────────────────────────────────────────────────────────

export const SERVICE_REGISTRY: Record<string, ServiceConfig> = {
    // ═══════════════════════════════════════════════════════════════════
    // COMPUTE
    // ═══════════════════════════════════════════════════════════════════
    ec2: {
        displayName: "EC2 Instances",
        azureDisplayName: "Virtual Machines",
        gcpDisplayName: "Compute Engine VMs",
        category: "compute",
        icon: "Server",
        metrics: [
            { name: "cpu", namespace: "AWS/EC2", metricName: "CPUUtilization", stat: "Average", unit: "%", dimensionNames: ["InstanceId"], period: 300 },
            { name: "network_in", namespace: "AWS/EC2", metricName: "NetworkIn", stat: "Average", unit: "bytes", dimensionNames: ["InstanceId"], period: 300 },
            { name: "network_out", namespace: "AWS/EC2", metricName: "NetworkOut", stat: "Average", unit: "bytes", dimensionNames: ["InstanceId"], period: 300 },
            { name: "status_check", namespace: "AWS/EC2", metricName: "StatusCheckFailed", stat: "Maximum", unit: "count", dimensionNames: ["InstanceId"], period: 300 },
            { name: "disk_read_ops", namespace: "AWS/EC2", metricName: "DiskReadOps", stat: "Average", unit: "count", dimensionNames: ["InstanceId"], period: 300 },
            { name: "disk_write_ops", namespace: "AWS/EC2", metricName: "DiskWriteOps", stat: "Average", unit: "count", dimensionNames: ["InstanceId"], period: 300 },
        ],
        logGroup: "/aws/ec2/messages",
    },

    ebs: {
        displayName: "EBS Volumes",
        azureDisplayName: "Managed Disks",
        gcpDisplayName: "Persistent Disks",
        category: "compute",
        icon: "HardDrive",
        metrics: [
            { name: "read_ops", namespace: "AWS/EBS", metricName: "VolumeReadOps", stat: "Average", unit: "count", dimensionNames: ["VolumeId"], period: 300 },
            { name: "write_ops", namespace: "AWS/EBS", metricName: "VolumeWriteOps", stat: "Average", unit: "count", dimensionNames: ["VolumeId"], period: 300 },
            { name: "read_bytes", namespace: "AWS/EBS", metricName: "VolumeReadBytes", stat: "Average", unit: "bytes", dimensionNames: ["VolumeId"], period: 300 },
            { name: "write_bytes", namespace: "AWS/EBS", metricName: "VolumeWriteBytes", stat: "Average", unit: "bytes", dimensionNames: ["VolumeId"], period: 300 },
            { name: "queue_length", namespace: "AWS/EBS", metricName: "VolumeQueueLength", stat: "Average", unit: "count", dimensionNames: ["VolumeId"], period: 300 },
        ],
        logGroup: null,
    },

    eks: {
        displayName: "EKS Clusters",
        azureDisplayName: "AKS Clusters",
        gcpDisplayName: "GKE Clusters",
        category: "compute",
        icon: "Container",
        metrics: [
            { name: "pod_cpu", namespace: "ContainerInsights", metricName: "pod_cpu_utilization", stat: "Average", unit: "%", dimensionNames: ["ClusterName", "Namespace"], period: 300 },
            { name: "pod_memory", namespace: "ContainerInsights", metricName: "pod_memory_utilization", stat: "Average", unit: "%", dimensionNames: ["ClusterName", "Namespace"], period: 300 },
            { name: "node_count", namespace: "ContainerInsights", metricName: "node_number_of_running_pods", stat: "Average", unit: "count", dimensionNames: ["ClusterName"], period: 300 },
            { name: "pod_network_rx", namespace: "ContainerInsights", metricName: "pod_network_rx_bytes", stat: "Average", unit: "bytes", dimensionNames: ["ClusterName", "Namespace"], period: 300 },
            { name: "pod_network_tx", namespace: "ContainerInsights", metricName: "pod_network_tx_bytes", stat: "Average", unit: "bytes", dimensionNames: ["ClusterName", "Namespace"], period: 300 },
        ],
        logGroup: "/aws/containerinsights/{cluster_name}/application",
    },

    ecs: {
        displayName: "ECS Services",
        azureDisplayName: "Container Instances",
        gcpDisplayName: "Cloud Run Services",
        category: "compute",
        icon: "Container",
        metrics: [
            { name: "cpu", namespace: "AWS/ECS", metricName: "CPUUtilization", stat: "Average", unit: "%", dimensionNames: ["ClusterName", "ServiceName"], period: 300 },
            { name: "memory", namespace: "AWS/ECS", metricName: "MemoryUtilization", stat: "Average", unit: "%", dimensionNames: ["ClusterName", "ServiceName"], period: 300 },
            { name: "running_tasks", namespace: "ECS/ContainerInsights", metricName: "RunningTaskCount", stat: "Average", unit: "count", dimensionNames: ["ClusterName", "ServiceName"], period: 300 },
            { name: "desired_tasks", namespace: "ECS/ContainerInsights", metricName: "DesiredTaskCount", stat: "Average", unit: "count", dimensionNames: ["ClusterName", "ServiceName"], period: 300 },
            { name: "network_tx", namespace: "ECS/ContainerInsights", metricName: "NetworkTxBytes", stat: "Sum", unit: "bytes", dimensionNames: ["ClusterName", "ServiceName"], period: 300 },
            { name: "network_rx", namespace: "ECS/ContainerInsights", metricName: "NetworkRxBytes", stat: "Sum", unit: "bytes", dimensionNames: ["ClusterName", "ServiceName"], period: 300 },
        ],
        logGroup: "/ecs/{cluster_name}",
    },

    autoscaling: {
        displayName: "Auto Scaling Groups",
        azureDisplayName: "Virtual Machine Scale Sets",
        gcpDisplayName: "MIGs (Instance Groups)",
        category: "compute",
        icon: "Scaling",
        metrics: [
            { name: "group_in_service", namespace: "AWS/AutoScaling", metricName: "GroupInServiceInstances", stat: "Average", unit: "count", dimensionNames: ["AutoScalingGroupName"], period: 300 },
            { name: "group_desired", namespace: "AWS/AutoScaling", metricName: "GroupDesiredCapacity", stat: "Average", unit: "count", dimensionNames: ["AutoScalingGroupName"], period: 300 },
            { name: "group_pending", namespace: "AWS/AutoScaling", metricName: "GroupPendingInstances", stat: "Average", unit: "count", dimensionNames: ["AutoScalingGroupName"], period: 300 },
            { name: "group_terminating", namespace: "AWS/AutoScaling", metricName: "GroupTerminatingInstances", stat: "Average", unit: "count", dimensionNames: ["AutoScalingGroupName"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // SERVERLESS
    // ═══════════════════════════════════════════════════════════════════
    lambda: {
        displayName: "Lambda Functions",
        azureDisplayName: "Function Apps",
        gcpDisplayName: "Cloud Functions",
        category: "serverless",
        icon: "Zap",
        metrics: [
            { name: "invocations", namespace: "AWS/Lambda", metricName: "Invocations", stat: "Sum", unit: "count", dimensionNames: ["FunctionName"], period: 300 },
            { name: "errors", namespace: "AWS/Lambda", metricName: "Errors", stat: "Sum", unit: "count", dimensionNames: ["FunctionName"], period: 300 },
            { name: "duration", namespace: "AWS/Lambda", metricName: "Duration", stat: "Average", unit: "ms", dimensionNames: ["FunctionName"], period: 300 },
            { name: "concurrent", namespace: "AWS/Lambda", metricName: "ConcurrentExecutions", stat: "Maximum", unit: "count", dimensionNames: ["FunctionName"], period: 300 },
            { name: "throttles", namespace: "AWS/Lambda", metricName: "Throttles", stat: "Sum", unit: "count", dimensionNames: ["FunctionName"], period: 300 },
        ],
        logGroup: "/aws/lambda/{function_name}",
    },

    amplify: {
        displayName: "Amplify Hosting",
        azureDisplayName: "App Services",
        gcpDisplayName: "App Engine",
        category: "serverless",
        icon: "Globe",
        metrics: [
            { name: "requests", namespace: "AWS/AmplifyHosting", metricName: "Requests", stat: "Sum", unit: "count", dimensionNames: ["App"], period: 300 },
            { name: "bytes_downloaded", namespace: "AWS/AmplifyHosting", metricName: "BytesDownloaded", stat: "Sum", unit: "bytes", dimensionNames: ["App"], period: 300 },
            { name: "bytes_uploaded", namespace: "AWS/AmplifyHosting", metricName: "BytesUploaded", stat: "Sum", unit: "bytes", dimensionNames: ["App"], period: 300 },
            { name: "4xx_errors", namespace: "AWS/AmplifyHosting", metricName: "4xxErrors", stat: "Sum", unit: "count", dimensionNames: ["App"], period: 300 },
            { name: "5xx_errors", namespace: "AWS/AmplifyHosting", metricName: "5xxErrors", stat: "Sum", unit: "count", dimensionNames: ["App"], period: 300 },
            { name: "latency", namespace: "AWS/AmplifyHosting", metricName: "Latency", stat: "Average", unit: "ms", dimensionNames: ["App"], period: 300 },
        ],
        logGroup: "/aws/amplify/{app_id}",
    },

    apigateway: {
        displayName: "API Gateway",
        azureDisplayName: "API Management",
        gcpDisplayName: "API Gateway",
        category: "serverless",
        icon: "Route",
        metrics: [
            { name: "requests", namespace: "AWS/ApiGateway", metricName: "Count", stat: "Sum", unit: "count", dimensionNames: ["ApiName", "Stage"], period: 300 },
            { name: "latency", namespace: "AWS/ApiGateway", metricName: "Latency", stat: "Average", unit: "ms", dimensionNames: ["ApiName", "Stage"], period: 300 },
            { name: "4xx_errors", namespace: "AWS/ApiGateway", metricName: "4XXError", stat: "Sum", unit: "count", dimensionNames: ["ApiName", "Stage"], period: 300 },
            { name: "5xx_errors", namespace: "AWS/ApiGateway", metricName: "5XXError", stat: "Sum", unit: "count", dimensionNames: ["ApiName", "Stage"], period: 300 },
            { name: "integration_latency", namespace: "AWS/ApiGateway", metricName: "IntegrationLatency", stat: "Average", unit: "ms", dimensionNames: ["ApiName", "Stage"], period: 300 },
        ],
        logGroup: "/aws/apigateway/{api_id}/{stage}",
    },

    stepfunctions: {
        displayName: "Step Functions",
        azureDisplayName: "Logic Apps",
        gcpDisplayName: "Workflows",
        category: "serverless",
        icon: "Workflow",
        metrics: [
            { name: "executions_started", namespace: "AWS/States", metricName: "ExecutionsStarted", stat: "Sum", unit: "count", dimensionNames: ["StateMachineArn"], period: 300 },
            { name: "executions_succeeded", namespace: "AWS/States", metricName: "ExecutionsSucceeded", stat: "Sum", unit: "count", dimensionNames: ["StateMachineArn"], period: 300 },
            { name: "executions_failed", namespace: "AWS/States", metricName: "ExecutionsFailed", stat: "Sum", unit: "count", dimensionNames: ["StateMachineArn"], period: 300 },
            { name: "execution_time", namespace: "AWS/States", metricName: "ExecutionTime", stat: "Average", unit: "ms", dimensionNames: ["StateMachineArn"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // DATABASE
    // ═══════════════════════════════════════════════════════════════════
    rds: {
        displayName: "RDS Databases",
        azureDisplayName: "SQL Databases",
        gcpDisplayName: "Cloud SQL Instances",
        category: "database",
        icon: "Database",
        metrics: [
            { name: "cpu", namespace: "AWS/RDS", metricName: "CPUUtilization", stat: "Average", unit: "%", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
            { name: "connections", namespace: "AWS/RDS", metricName: "DatabaseConnections", stat: "Average", unit: "count", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
            { name: "free_storage", namespace: "AWS/RDS", metricName: "FreeStorageSpace", stat: "Average", unit: "bytes", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
            { name: "read_iops", namespace: "AWS/RDS", metricName: "ReadIOPS", stat: "Average", unit: "count/s", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
            { name: "write_iops", namespace: "AWS/RDS", metricName: "WriteIOPS", stat: "Average", unit: "count/s", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
            { name: "read_latency", namespace: "AWS/RDS", metricName: "ReadLatency", stat: "Average", unit: "s", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
            { name: "write_latency", namespace: "AWS/RDS", metricName: "WriteLatency", stat: "Average", unit: "s", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
            { name: "freeable_memory", namespace: "AWS/RDS", metricName: "FreeableMemory", stat: "Average", unit: "bytes", dimensionNames: ["DBInstanceIdentifier"], period: 300 },
        ],
        logGroup: "/aws/rds/instance/{db_identifier}",
    },

    dynamodb: {
        displayName: "DynamoDB Tables",
        azureDisplayName: "Cosmos DB Tables",
        gcpDisplayName: "Firestore Tables",
        category: "database",
        icon: "TableProperties",
        metrics: [
            { name: "consumed_read", namespace: "AWS/DynamoDB", metricName: "ConsumedReadCapacityUnits", stat: "Sum", unit: "count", dimensionNames: ["TableName"], period: 300 },
            { name: "consumed_write", namespace: "AWS/DynamoDB", metricName: "ConsumedWriteCapacityUnits", stat: "Sum", unit: "count", dimensionNames: ["TableName"], period: 300 },
            { name: "throttled_requests", namespace: "AWS/DynamoDB", metricName: "ThrottledRequests", stat: "Sum", unit: "count", dimensionNames: ["TableName"], period: 300 },
            { name: "read_throttle_events", namespace: "AWS/DynamoDB", metricName: "ReadThrottleEvents", stat: "Sum", unit: "count", dimensionNames: ["TableName"], period: 300 },
            { name: "write_throttle_events", namespace: "AWS/DynamoDB", metricName: "WriteThrottleEvents", stat: "Sum", unit: "count", dimensionNames: ["TableName"], period: 300 },
            { name: "latency", namespace: "AWS/DynamoDB", metricName: "SuccessfulRequestLatency", stat: "Average", unit: "ms", dimensionNames: ["TableName", "Operation"], period: 300 },
        ],
        logGroup: null,
    },

    elasticache: {
        displayName: "ElastiCache",
        azureDisplayName: "Cache for Redis",
        gcpDisplayName: "Memorystore Instances",
        category: "database",
        icon: "Flame",
        metrics: [
            { name: "cpu", namespace: "AWS/ElastiCache", metricName: "CPUUtilization", stat: "Average", unit: "%", dimensionNames: ["CacheClusterId"], period: 300 },
            { name: "memory", namespace: "AWS/ElastiCache", metricName: "DatabaseMemoryUsagePercentage", stat: "Average", unit: "%", dimensionNames: ["CacheClusterId"], period: 300 },
            { name: "cache_hits", namespace: "AWS/ElastiCache", metricName: "CacheHits", stat: "Sum", unit: "count", dimensionNames: ["CacheClusterId"], period: 300 },
            { name: "cache_misses", namespace: "AWS/ElastiCache", metricName: "CacheMisses", stat: "Sum", unit: "count", dimensionNames: ["CacheClusterId"], period: 300 },
            { name: "connections", namespace: "AWS/ElastiCache", metricName: "CurrConnections", stat: "Average", unit: "count", dimensionNames: ["CacheClusterId"], period: 300 },
            { name: "evictions", namespace: "AWS/ElastiCache", metricName: "Evictions", stat: "Sum", unit: "count", dimensionNames: ["CacheClusterId"], period: 300 },
        ],
        logGroup: null,
    },

    redshift: {
        displayName: "Redshift Clusters",
        azureDisplayName: "Synapse Analytics",
        gcpDisplayName: "BigQuery Datasets",
        category: "database",
        icon: "BarChart3",
        metrics: [
            { name: "cpu", namespace: "AWS/Redshift", metricName: "CPUUtilization", stat: "Average", unit: "%", dimensionNames: ["ClusterIdentifier"], period: 300 },
            { name: "disk_usage", namespace: "AWS/Redshift", metricName: "PercentageDiskSpaceUsed", stat: "Average", unit: "%", dimensionNames: ["ClusterIdentifier"], period: 300 },
            { name: "connections", namespace: "AWS/Redshift", metricName: "DatabaseConnections", stat: "Average", unit: "count", dimensionNames: ["ClusterIdentifier"], period: 300 },
            { name: "read_iops", namespace: "AWS/Redshift", metricName: "ReadIOPS", stat: "Average", unit: "count/s", dimensionNames: ["ClusterIdentifier"], period: 300 },
            { name: "write_iops", namespace: "AWS/Redshift", metricName: "WriteIOPS", stat: "Average", unit: "count/s", dimensionNames: ["ClusterIdentifier"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════════════
    s3: {
        displayName: "S3 Buckets",
        azureDisplayName: "Storage Accounts",
        gcpDisplayName: "Cloud Storage Buckets",
        category: "storage",
        icon: "FolderOpen",
        metrics: [
            { name: "size", namespace: "AWS/S3", metricName: "BucketSizeBytes", stat: "Average", unit: "bytes", dimensionNames: ["BucketName", "StorageType"], period: 86400 },
            { name: "objects", namespace: "AWS/S3", metricName: "NumberOfObjects", stat: "Average", unit: "count", dimensionNames: ["BucketName", "StorageType"], period: 86400 },
        ],
        logGroup: null,
    },
    ecr: {
        displayName: "ECR Repositories",
        azureDisplayName: "Container Registry",
        gcpDisplayName: "Artifact Registry",
        category: "storage",
        icon: "FolderGit",
        metrics: [],
        logGroup: null,
    },

    efs: {
        displayName: "Elastic File System",
        azureDisplayName: "Azure Files",
        gcpDisplayName: "Filestore Shares",
        category: "storage",
        icon: "FileVolume",
        metrics: [
            { name: "total_io_bytes", namespace: "AWS/EFS", metricName: "TotalIOBytes", stat: "Sum", unit: "bytes", dimensionNames: ["FileSystemId"], period: 300 },
            { name: "client_connections", namespace: "AWS/EFS", metricName: "ClientConnections", stat: "Sum", unit: "count", dimensionNames: ["FileSystemId"], period: 300 },
            { name: "permitted_throughput", namespace: "AWS/EFS", metricName: "PermittedThroughput", stat: "Average", unit: "bytes/s", dimensionNames: ["FileSystemId"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // NETWORKING & CDN
    // ═══════════════════════════════════════════════════════════════════
    alb: {
        displayName: "Application Load Balancer",
        azureDisplayName: "Application Gateways",
        gcpDisplayName: "Load Balancers",
        category: "networking",
        icon: "Network",
        metrics: [
            { name: "requests", namespace: "AWS/ApplicationELB", metricName: "RequestCount", stat: "Sum", unit: "count", dimensionNames: ["LoadBalancer"], period: 300 },
            { name: "target_response_time", namespace: "AWS/ApplicationELB", metricName: "TargetResponseTime", stat: "Average", unit: "s", dimensionNames: ["LoadBalancer"], period: 300 },
            { name: "healthy_hosts", namespace: "AWS/ApplicationELB", metricName: "HealthyHostCount", stat: "Average", unit: "count", dimensionNames: ["LoadBalancer", "TargetGroup"], period: 300 },
            { name: "unhealthy_hosts", namespace: "AWS/ApplicationELB", metricName: "UnHealthyHostCount", stat: "Average", unit: "count", dimensionNames: ["LoadBalancer", "TargetGroup"], period: 300 },
            { name: "5xx_errors", namespace: "AWS/ApplicationELB", metricName: "HTTPCode_ELB_5XX_Count", stat: "Sum", unit: "count", dimensionNames: ["LoadBalancer"], period: 300 },
            { name: "active_connections", namespace: "AWS/ApplicationELB", metricName: "ActiveConnectionCount", stat: "Sum", unit: "count", dimensionNames: ["LoadBalancer"], period: 300 },
        ],
        logGroup: null,
    },

    cloudfront: {
        displayName: "CloudFront CDN",
        azureDisplayName: "Front Door & CDN",
        gcpDisplayName: "Cloud CDN",
        category: "networking",
        icon: "Wifi",
        metrics: [
            { name: "requests", namespace: "AWS/CloudFront", metricName: "Requests", stat: "Sum", unit: "count", dimensionNames: ["DistributionId", "Region"], period: 300 },
            { name: "error_rate", namespace: "AWS/CloudFront", metricName: "TotalErrorRate", stat: "Average", unit: "%", dimensionNames: ["DistributionId", "Region"], period: 300 },
            { name: "bytes_downloaded", namespace: "AWS/CloudFront", metricName: "BytesDownloaded", stat: "Sum", unit: "bytes", dimensionNames: ["DistributionId", "Region"], period: 300 },
            { name: "bytes_uploaded", namespace: "AWS/CloudFront", metricName: "BytesUploaded", stat: "Sum", unit: "bytes", dimensionNames: ["DistributionId", "Region"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // SECURITY
    // ═══════════════════════════════════════════════════════════════════
    waf: {
        displayName: "WAF (Web Application Firewall)",
        azureDisplayName: "Web Application Firewall",
        gcpDisplayName: "Cloud Armor",
        category: "security",
        icon: "Shield",
        metrics: [
            { name: "blocked", namespace: "AWS/WAFV2", metricName: "BlockedRequests", stat: "Sum", unit: "count", dimensionNames: ["WebACL", "Rule", "Region"], period: 300 },
            { name: "allowed", namespace: "AWS/WAFV2", metricName: "AllowedRequests", stat: "Sum", unit: "count", dimensionNames: ["WebACL", "Rule", "Region"], period: 300 },
        ],
        logGroup: "aws-waf-logs-{web_acl}",
    },

    // ═══════════════════════════════════════════════════════════════════
    // STREAMING
    // ═══════════════════════════════════════════════════════════════════
    kinesis: {
        displayName: "Kinesis Data Streams",
        azureDisplayName: "Event Hubs",
        gcpDisplayName: "Pub/Sub Lite Streams",
        category: "streaming",
        icon: "Activity",
        metrics: [
            { name: "incoming_records", namespace: "AWS/Kinesis", metricName: "IncomingRecords", stat: "Sum", unit: "count", dimensionNames: ["StreamName"], period: 300 },
            { name: "incoming_bytes", namespace: "AWS/Kinesis", metricName: "IncomingBytes", stat: "Sum", unit: "bytes", dimensionNames: ["StreamName"], period: 300 },
            { name: "get_records_latency", namespace: "AWS/Kinesis", metricName: "GetRecords.IteratorAgeMilliseconds", stat: "Average", unit: "ms", dimensionNames: ["StreamName"], period: 300 },
            { name: "read_throughput_exceeded", namespace: "AWS/Kinesis", metricName: "ReadProvisionedThroughputExceeded", stat: "Sum", unit: "count", dimensionNames: ["StreamName"], period: 300 },
        ],
        logGroup: null,
    },

    sqs: {
        displayName: "SQS Queues",
        azureDisplayName: "Queue Storage",
        gcpDisplayName: "Pub/Sub Queues",
        category: "messaging",
        icon: "Inbox",
        metrics: [
            { name: "messages_visible", namespace: "AWS/SQS", metricName: "ApproximateNumberOfMessagesVisible", stat: "Average", unit: "count", dimensionNames: ["QueueName"], period: 300 },
            { name: "messages_sent", namespace: "AWS/SQS", metricName: "NumberOfMessagesSent", stat: "Sum", unit: "count", dimensionNames: ["QueueName"], period: 300 },
            { name: "messages_received", namespace: "AWS/SQS", metricName: "NumberOfMessagesReceived", stat: "Sum", unit: "count", dimensionNames: ["QueueName"], period: 300 },
            { name: "messages_deleted", namespace: "AWS/SQS", metricName: "NumberOfMessagesDeleted", stat: "Sum", unit: "count", dimensionNames: ["QueueName"], period: 300 },
            { name: "age_of_oldest", namespace: "AWS/SQS", metricName: "ApproximateAgeOfOldestMessage", stat: "Maximum", unit: "s", dimensionNames: ["QueueName"], period: 300 },
        ],
        logGroup: null,
    },

    sns: {
        displayName: "SNS Topics",
        azureDisplayName: "Event Grid Topics",
        gcpDisplayName: "Pub/Sub Topics",
        category: "messaging",
        icon: "Bell",
        metrics: [
            { name: "messages_published", namespace: "AWS/SNS", metricName: "NumberOfMessagesPublished", stat: "Sum", unit: "count", dimensionNames: ["TopicName"], period: 300 },
            { name: "notifications_delivered", namespace: "AWS/SNS", metricName: "NumberOfNotificationsDelivered", stat: "Sum", unit: "count", dimensionNames: ["TopicName"], period: 300 },
            { name: "notifications_failed", namespace: "AWS/SNS", metricName: "NumberOfNotificationsFailed", stat: "Sum", unit: "count", dimensionNames: ["TopicName"], period: 300 },
        ],
        logGroup: null,
    },

    eventbridge: {
        displayName: "EventBridge",
        azureDisplayName: "Event Grid",
        gcpDisplayName: "Eventarc",
        category: "serverless",
        icon: "Plug",
        metrics: [
            { name: "invocations", namespace: "AWS/Events", metricName: "Invocations", stat: "Sum", unit: "count", dimensionNames: ["RuleName"], period: 300 },
            { name: "matched_events", namespace: "AWS/Events", metricName: "MatchedEvents", stat: "Sum", unit: "count", dimensionNames: ["RuleName"], period: 300 },
            { name: "failed_invocations", namespace: "AWS/Events", metricName: "FailedInvocations", stat: "Sum", unit: "count", dimensionNames: ["RuleName"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // BILLING (uses Cost Explorer, not CloudWatch)
    // ═══════════════════════════════════════════════════════════════════
    billing: {
        displayName: "AWS Billing",
        azureDisplayName: "Azure Billing",
        gcpDisplayName: "GCP Billing",
        category: "cost",
        icon: "DollarSign",
        metrics: [], // Billing data comes from Cost Explorer API, not CloudWatch
        logGroup: null,
    },

    // Alias: sidebar uses /dashboards/cost
    cost: {
        displayName: "Billing & Cost",
        azureDisplayName: "Cost Management",
        gcpDisplayName: "Cost Billing",
        category: "cost",
        icon: "DollarSign",
        metrics: [], // Cost Explorer API — no CloudWatch metrics
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // NETWORKING (aggregated view — ALB + CloudFront)
    // ═══════════════════════════════════════════════════════════════════
    networking: {
        displayName: "Networking",
        azureDisplayName: "Virtual Networks",
        gcpDisplayName: "VPC Networks",
        category: "networking",
        icon: "Network",
        metrics: [
            { name: "alb_requests", namespace: "AWS/ApplicationELB", metricName: "RequestCount", stat: "Sum", unit: "count", dimensionNames: ["LoadBalancer"], period: 300 },
            { name: "alb_response_time", namespace: "AWS/ApplicationELB", metricName: "TargetResponseTime", stat: "Average", unit: "s", dimensionNames: ["LoadBalancer"], period: 300 },
            { name: "alb_5xx", namespace: "AWS/ApplicationELB", metricName: "HTTPCode_ELB_5XX_Count", stat: "Sum", unit: "count", dimensionNames: ["LoadBalancer"], period: 300 },
            { name: "cf_requests", namespace: "AWS/CloudFront", metricName: "Requests", stat: "Sum", unit: "count", dimensionNames: ["DistributionId", "Region"], period: 300 },
            { name: "cf_error_rate", namespace: "AWS/CloudFront", metricName: "TotalErrorRate", stat: "Average", unit: "%", dimensionNames: ["DistributionId", "Region"], period: 300 },
            { name: "cf_bytes_downloaded", namespace: "AWS/CloudFront", metricName: "BytesDownloaded", stat: "Sum", unit: "bytes", dimensionNames: ["DistributionId", "Region"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // SECURITY (aggregated view — GuardDuty + WAF + SecurityHub)
    // ═══════════════════════════════════════════════════════════════════
    security: {
        displayName: "Security",
        azureDisplayName: "Microsoft Defender",
        gcpDisplayName: "Security Command Center",
        category: "security",
        icon: "Shield",
        metrics: [
            { name: "waf_blocked", namespace: "AWS/WAFV2", metricName: "BlockedRequests", stat: "Sum", unit: "count", dimensionNames: ["WebACL", "Rule", "Region"], period: 300 },
            { name: "waf_allowed", namespace: "AWS/WAFV2", metricName: "AllowedRequests", stat: "Sum", unit: "count", dimensionNames: ["WebACL", "Rule", "Region"], period: 300 },
        ],
        logGroup: null,
    },

    // ═══════════════════════════════════════════════════════════════════
    // ALERTS (CloudWatch Alarms)
    // ═══════════════════════════════════════════════════════════════════
    alerts: {
        displayName: "Alerts & Alarms",
        azureDisplayName: "Alert Rules",
        gcpDisplayName: "Alert Policies",
        category: "compute",
        icon: "Bell",
        metrics: [],
        logGroup: null,
    },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** All registered service keys */
export const ALL_SERVICES = Object.keys(SERVICE_REGISTRY);

/** Get services by category */
export function getServicesByCategory(category: ServiceCategory): string[] {
    return Object.entries(SERVICE_REGISTRY)
        .filter(([, config]) => config.category === category)
        .map(([name]) => name);
}

/** Get all unique CloudWatch namespaces across all services */
export function getAllNamespaces(): string[] {
    const namespaces = new Set<string>();
    for (const service of Object.values(SERVICE_REGISTRY)) {
        for (const metric of service.metrics) {
            namespaces.add(metric.namespace);
        }
    }
    return Array.from(namespaces);
}

/** Find the service key for a given CloudWatch namespace */
export function getServiceByNamespace(namespace: string): string | null {
    for (const [key, config] of Object.entries(SERVICE_REGISTRY)) {
        if (config.metrics.some(m => m.namespace === namespace)) {
            return key;
        }
    }
    return null;
}

/** Get all metrics for a service as CloudWatch query objects */
export function getMetricQueries(serviceKey: string): CloudWatchMetricDefinition[] {
    return SERVICE_REGISTRY[serviceKey]?.metrics || [];
}
