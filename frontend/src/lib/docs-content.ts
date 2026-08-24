export type DocsCodeBlock = {
  title?: string;
  code: string;
};

export type DocsSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  codeBlocks?: DocsCodeBlock[];
  bullets?: string[];
  faqs?: {
    question: string;
    answer: string;
  }[];
  note?: {
    title: string;
    body: string;
    tone: "info" | "warning" | "tip";
  };
  table?: {
    headers: string[];
    rows: string[][];
  };
};

export type DocsPage = {
  slug: string[];
  path: string;
  group: string;
  label: string;
  eyebrow?: string;
  title: string;
  description: string;
  intro?: string;
  sections: DocsSection[];
};

const AWS_SIMULATION_SERVICES = [
  "EC2 Instance: configure instance type, count, region, AMI, key pair, instance name, admin username, VPC, subnet, and security group.",
  "S3 Bucket: configure bucket name, region, versioning, public access, lifecycle rule, and bucket policy.",
  "RDS Database: configure engine, engine version, instance class, Multi-AZ, storage size, storage type, database name, username, port, and public access.",
  "Lambda Function: configure runtime, handler, memory, timeout, function name, environment, and inline starter code.",
  "DynamoDB Table: configure table name, billing mode, hash key, hash key type, and region.",
  "API Gateway: configure API name, protocol type, endpoint type, and region.",
  "ECS Cluster: configure launch type, desired count, CPU, memory, app port, Fargate Spot, Service Connect, autoscaling, and sidecar options.",
  "EKS Cluster: configure cluster name, Kubernetes version, node count, instance type, app port, and region.",
  "ECR Registry: configure container registry settings for Docker image workflows.",
  "Elastic IP: reserve or attach static public IPv4 addressing for AWS resources.",
  "Security Group: configure inbound ports, private mode, and network access rules.",
  "Target Group: configure load-balancer target routing.",
  "EBS Volume: configure persistent block storage attached to compute workloads.",
  "VPC: configure VPC name, CIDR block, subnet CIDR, SSH, HTTP, HTTPS, private mode, and region.",
  "Elastic Load Balancer: configure load balancer name, port, protocol, and region.",
  "Auto Scaling Group: configure min size, max size, desired capacity, instance type, AMI, key name, instance name, admin username, and CPU target.",
  "CloudFront Distribution: configure CDN distribution settings for global delivery.",
  "GitHub Repository and Docker Hub: connect code or container sources for application bootstrap workflows.",
];

const AZURE_SIMULATION_SERVICES = [
  "Virtual Machine: configure VM size, count, admin username, instance name, OS disk type, image publisher, image offer, image SKU, and region.",
  "Storage Account: configure storage account name, tier, replication type, account kind, region, and policy.",
  "Azure SQL Database: configure database name, SKU, max size, collation, and region.",
  "Function App: configure function name, SKU or consumption plan, and region.",
  "Virtual Network: configure VNet name, address space, subnet CIDR, SSH, HTTP, HTTPS, private mode, and region.",
  "Azure Container Registry: configure registry settings for Docker image storage.",
  "Public IP: configure static public IP resources for Azure workloads.",
  "Network Security Group: configure traffic rules for Azure virtual networks and virtual machines.",
  "Backend Address Pool: configure Azure Load Balancer backend routing.",
  "Managed Disk: configure persistent disk storage for virtual machines.",
  "AKS Cluster: configure cluster name, node count, node VM size, DNS prefix, and region.",
  "Load Balancer: configure frontend port, backend port, load balancer name, and region.",
  "VM Scale Set: configure horizontal autoscaling for Azure virtual machines.",
  "CDN or Front Door: configure global content delivery and edge routing.",
  "GitHub Repository and Docker Hub: connect source code or container images for deployment workflows.",
];

const GCP_SIMULATION_SERVICES = [
  "Compute Engine VM: configure instance name, machine type, zone, image, boot disk size, HTTP access, and region.",
  "Cloud Storage Bucket: configure bucket name, storage class, location, versioning, region, and policy.",
  "Cloud SQL Database: configure instance name, database name, database version, tier, and region.",
  "Cloud Run Function: configure function name, runtime, entry point, and region.",
  "VPC Network: configure network name, CIDR block, subnet CIDR, SSH, HTTP, HTTPS, private mode, and region.",
  "GKE Cluster: configure cluster name, node count, machine type, location, and region.",
  "Artifact Registry: configure Google Cloud container image registry settings.",
  "External Address: configure static external IP addressing.",
  "Firewall Rule: configure firewall rules for VM and network traffic.",
  "Backend Service: configure load-balancing backend service settings.",
  "Persistent Disk: configure block storage for GCP compute workloads.",
  "Cloud Load Balancer: configure load balancer name, port, and region.",
  "Managed Instance Group: configure scalable compute groups and autoscaling settings.",
  "Cloud CDN: configure edge caching and global delivery.",
  "GitHub Repository and Docker Hub: connect source code or container images for deployment workflows.",
];

const PRODUCT_FEATURES = [
  "Authentication, signup verification, login, password reset, account recovery, profile, two-factor authentication, team management, roles, and security event history.",
  "Cloud setup for AWS IAM role, Azure service principal, GCP service account, GitHub OAuth, AI provider keys, Slack, reports, and notification channels.",
  "Dashboard, Watchdog, service dashboards, cloud inventory, metrics, logs, billing, alerts, security findings, recommendations, and provider switching.",
  "FinOps features including billing summaries, spend trends, cost forecasting, rightsizing, orphaned resource detection, commitment guidance, savings workflows, and actual-savings tracking.",
  "AI Observability with ingest keys, traces, request detail, spans, token analytics, cost analytics, model analytics, errors, alerts, anomaly detection, prompt insights, routing recommendations, playground, and evaluations.",
  "AI quality workflows including feedback capture, score review, session review, user review, and trace-focused investigation.",
  "Security and compliance-support features including IAM key audit, retention settings, personal-data search, erasure or redaction support, data residency reporting, action audit trail, and authentication audit trail.",
  "Simulation and deployment features including visual canvas, service nodes, Terraform generation, cost estimation, credential validation, live logs, deployment history, destroy workflow, and GitHub application bootstrap.",
  "Live Infrastructure features including inventory sync, resource detail, service-group canvases, metrics, status, and supported live actions.",
  "Resize Migration features including source discovery, target-size selection, access configuration, workload classification, task timeline, validation, cutover, source preservation, and migration reports.",
  "Operations features including actions history, VPS log agents, log summaries, error patterns, VPS alarms, email reports, Slack alerts, and troubleshooting guides.",
];

const APP_SURFACES = [
  "Landing page: explains CloudWatcher, cloud cost optimization, multicloud monitoring, AI observability, infrastructure simulations, integrations, savings, and product entry points.",
  "Signup and verification: account creation, signup verification, login handoff, and protected access after verification.",
  "Login and 2FA: email/password login, two-factor verification, resend flow, recovery, forgot password, reset password, and first-login password reset.",
  "Dashboard: consolidated provider overview for spend, health, resources, alerts, and operational status.",
  "Service dashboards: provider-aware detail views for compute, storage, database, network, security, cost, AI insights, health, and alerts.",
  "Watchdog: fleet-level operational status, active resources, security findings, optimization signals, and investigation starting points.",
  "Recommendations: cost, reliability, security, performance, cloud, and AI recommendations with action or simulation follow-up where supported.",
  "Cost Savings: optimization opportunities, estimated savings, validation, completed savings records, and realized savings tracking.",
  "Actions: action planning, previews, approvals, execution status, rollback attempts, audit trail, savings verification, and registry information.",
  "AI Observability Overview: request volume, tokens, cost, latency, errors, providers, models, environments, and recent activity.",
  "AI Traces: trace list, trace grouping, request detail, spans, metadata, tokens, latency, cost, and failure inspection.",
  "AI Cost: daily cost trends, provider split, model split, token cost, and cost-drivers.",
  "AI Models: model usage, token volume, latency, errors, cost, and provider grouping.",
  "AI Errors: grouped rate limits, timeouts, client errors, server errors, failed requests, and root-cause signals.",
  "AI Alerts: cost, token, latency, error, anomaly, and budget alert review.",
  "AI Recommendations: routing recommendations, prompt optimization, model choice, cost reduction, and reliability suggestions.",
  "AI Prompts: repeated prompt patterns, oversized prompts, prompt efficiency, and prompt-level optimization signals.",
  "AI Playground: prompt testing with provider, model, temperature, output, latency, token, cost, and error comparison.",
  "AI Evaluations: model evaluation, custom judge settings, score review, pass/fail analysis, and failed-example inspection.",
  "Settings > AI Keys: provider key status, OpenAI usage, OpenAI logs, Anthropic usage, Gemini usage, pricing lookup, key save, and key delete.",
  "Settings > AI Observability: ingest keys, trace/event scopes, SDK setup, telemetry endpoint, and privacy defaults.",
  "Settings > AWS: IAM role setup, external ID, credential status, disconnect, and AWS validation.",
  "Settings > Azure: tenant, subscription, service-principal connection, onboarding template, validation, and disconnect.",
  "Settings > GCP: project, service-account connection, billing export setup, validation, callback behavior, and disconnect.",
  "Settings > GitHub: OAuth status, connect, disconnect, repository list, branch list, and deployment source selection.",
  "Settings > Reports: report preferences, cadence, recipients, sections, and test delivery.",
  "Simulation Builder: visual canvas, service nodes, config panel, cost box, Terraform preview, deployment status, autosave, manual save, and provider selection.",
  "Simulation History: saved simulation list, detail, update, delete, destroy, PEM download, deployment records, and cleanup status.",
  "Live Infrastructure: provider inventory sync, service-group canvases, resource detail, status, metrics, code view for Lambda where supported, and live action safety checks.",
  "Resize Migration: scope, source discovery, target sizes, job creation, task transition, classification confirmation, access configuration, resume, explanation, report, and delete.",
  "VPS Logs: agent registration, agent config, secure ingest, recent log review, summary, clear recent logs, alarm rules, alert policy, and mail test.",
  "Profile: user profile, preferences, integration awareness, security controls, and account settings.",
  "SaaS Admin: system stats, tenant list, compliance alerts, support visibility, and administrator-only management.",
  "Global AI Agent: product help, docs help, and grounded operational assistant entry point.",
];

const API_REFERENCE = [
  "Auth API: signup, verify signup, login, login 2FA, resend 2FA, forgot password, verify forgot password, reset password, OTP send, OTP verify, restore account, profile update, 2FA setup, 2FA confirm, 2FA remove, security events, team users, and integrations.",
  "Cloud API: providers, connections, resources, metrics, billing, security, insights, recommendations, and logs across AWS, Azure, and GCP.",
  "AWS API: setup, credentials, billing, resources, metrics, logs, insights, security, alarms, default alarms, alarm metadata, credential vault, live resource actions, Lambda code view, live action safety check, optimization, and role save.",
  "Azure API: setup, save connection, credentials, billing, resources, metrics, logs, insights, security, alarms, default alarms, alarm metadata, and live resource actions.",
  "GCP API: setup, save connection, update billing, credentials, billing, resources, metrics, logs, insights, security, alarms, default alarms, alarm metadata, and live resource actions.",
  "Actions API: plan, plan from recommendation, preview, create, simulation log, approve, execute, rollback, history, status, savings, savings verification, audit, and registry.",
  "AI Keys API: save key, delete key, key status, OpenAI usage, OpenAI logs, OpenAI per-key usage, Anthropic usage, Gemini usage, and pricing.",
  "AI Observability API: overview, tokens, costs, models, errors, alerts, alert evaluation, budget, forecast, daily summary, weekly summary, anomalies, budget enforcement, Bedrock console, Bedrock sync, routing recommendations, prompt insights, and notification history.",
  "AI Ingest API: event ingest, batch event ingest, trace ingest, batch trace ingest, scoped ingest keys, and direct client SDK trace uploads.",
  "AI Traces API: trace list, trace detail, request detail, trace post, and batch trace post.",
  "Prompt and Evaluation API: prompt list, prompt create or update, prompt delete, playground run, evaluation list, and evaluation run.",
  "AI Quality API: feedback, comments, score views, sessions, users, and request detail workflows.",
  "Simulation API: create session, session status, stream session logs, terminate session, estimate cost, cached cost status, generate Terraform, start deployment, run deployment, resume deployment, cancel deployment, validate credentials, deployment status, deployment stream, PEM download, saved simulations, simulation detail, update, destroy, delete, and simulation PEM download.",
  "GitHub API: status, connect, disconnect, repositories, and branches.",
  "Resize Migration API: scope, sources, target sizes, jobs list, job create, plan create, job detail, transition, confirm classification, configure access, resume, report, explain task, and delete.",
  "Usage Reports and Notifications API: report preferences get, report preferences update, test report, notification settings get, notification settings update, and Slack notification test.",
  "VPS Logs API: agent list, create agent, patch agent config, delete agent, ingest logs, summary, clear recent logs, alarm rules, alarm create, alarm update, alarm delete, alert policy, and alert mail test.",
  "SaaS Admin API: system stats, tenant list, and compliance alert list for system administrators.",
];

const AI_PROVIDER_FEATURES = [
  "OpenAI: usage ingestion, provider key status, logs, per-key usage, playground execution, traces, model analytics, cost analytics, errors, and pricing lookup.",
  "Anthropic: usage ingestion, provider key status, playground execution, traces, model analytics, cost analytics, and error tracking.",
  "Gemini: usage ingestion, provider key status, playground execution, traces, model analytics, cost analytics, and error tracking.",
  "Amazon Bedrock: AWS-first metrics, Bedrock console panel, Bedrock sync, traces, cost, model usage, errors, and provider metadata.",
  "Custom endpoints: trace and event ingestion for self-hosted or gateway-based models when telemetry is instrumented.",
  "Direct SDK Ingestion: lightweight client SDKs that record provider, model, request, usage, latency, cost, and error metadata directly from the source.",
];

const AI_QUALITY_SURFACES = [
  "Scores: review score trends, failed checks, evaluator output, and quality drift across models, prompts, or applications.",
  "Sessions and Users: investigate AI behavior by session or end user when debugging journeys rather than isolated requests.",
  "Evaluations: run repeatable checks and review pass/fail patterns before changing production flows.",
];

const SERVICE_CONFIGURATION_REFERENCE = [
  "GitHub Repository: used for application bootstrap. Configure Git URL, branch, optional token, project type, runtime, build command, start command, app port, frontend directory, backend directory, API path, and backend port. CloudWatcher uses it to pull code and prepare a deployment plan.",
  "Docker Hub: used for container-based bootstrap. Configure repository, tag, username, password, app port, and container port. CloudWatcher uses it to pull or reference an image for a cloud deployment flow.",
  "AWS EC2 Instance: used for virtual machines. Configure instance type, count, region, AMI, key name, instance name, admin username, VPC ID, subnet ID, and security group. CloudWatcher turns this into compute infrastructure and can estimate, deploy, inspect, and clean it up in simulations.",
  "AWS S3 Bucket: used for object storage. Configure bucket name, region, versioning, public access, lifecycle rule, and policy. CloudWatcher uses it for storage architecture, cost estimation, Terraform generation, and live inventory where connected.",
  "AWS RDS Database: used for managed relational databases. Configure engine, engine version, instance class, Multi-AZ, storage GB, storage type, database name, username, port, and public access. CloudWatcher uses these fields to build database Terraform and evaluate database cost/risk.",
  "AWS Lambda Function: used for serverless compute. Configure runtime, handler, memory MB, timeout seconds, function name, environment, and code. CloudWatcher uses it for serverless simulations, live inspection, and Lambda code viewing where supported.",
  "AWS DynamoDB Table: used for NoSQL data. Configure table name, billing mode, hash key, hash key type, and region. CloudWatcher uses it for architecture planning and billing-aware simulation.",
  "AWS API Gateway: used for managed APIs. Configure name, protocol type, endpoint type, and region. CloudWatcher uses it to model API entry points and connect serverless or backend workloads.",
  "AWS ECS Cluster: used for container services. Configure cluster name, service name, launch type, Fargate Spot, Service Connect, autoscaling, capacity limits, CPU target, sidecar, desired count, CPU, memory, app port, and region.",
  "AWS EKS Cluster: used for managed Kubernetes. Configure cluster name, Kubernetes version, node count, instance type, app port, and region. CloudWatcher uses it for Kubernetes architecture simulation and cost-aware planning.",
  "AWS ECR Registry: used for Docker image storage. Configure repository settings and image workflow details. CloudWatcher uses it with container deployments and image verification paths.",
  "AWS Elastic IP: used for static public IPv4 addresses. Configure address attachment intent and region. CloudWatcher models public connectivity and deployment outputs around it.",
  "AWS Security Group: used as a virtual firewall. Configure inbound rules, SSH, HTTP, HTTPS, private mode, and region. CloudWatcher uses it to model network exposure and deployment security.",
  "AWS Target Group: used for load-balancer routing. Configure target group name, port, protocol, health path, and target settings where supported. CloudWatcher connects compute nodes to load balancers through it.",
  "AWS EBS Volume: used for block storage. Configure volume name, size, type, region, and attachment intent. CloudWatcher models persistent disk cost and VM attachment relationships.",
  "AWS VPC: used for private networking. Configure VPC name, CIDR block, subnet CIDR block, SSH port, HTTP port, HTTPS port, private mode, and region. CloudWatcher uses it as the network base for compute, load balancing, and database nodes.",
  "AWS Elastic Load Balancer: used for traffic distribution. Configure load balancer name, port, protocol, and region. CloudWatcher uses it to model public traffic entry and backend routing.",
  "AWS Auto Scaling Group: used for elastic compute capacity. Configure min size, max size, desired capacity, instance type, region, AMI, key name, instance name, admin username, and CPU target.",
  "AWS CloudFront Distribution: used for CDN delivery. Configure distribution name, origin, cache behavior, and region/global delivery fields where supported. CloudWatcher uses it to model global edge delivery.",
  "Azure Virtual Machine: used for Azure compute. Configure VM size, count, admin username, instance name, OS disk type, image publisher, image offer, image SKU, and region.",
  "Azure Storage Account: used for Blob/object storage. Configure storage account name, account tier, replication type, account kind, region, and policy.",
  "Azure SQL Database: used for managed SQL. Configure database name, SKU name, max size bytes, collation, and region.",
  "Azure Function App: used for serverless compute. Configure function name, SKU name or consumption plan, and region.",
  "Azure Virtual Network: used for private networking. Configure VNet name, address space, subnet CIDR block, SSH port, HTTP port, HTTPS port, private mode, and region.",
  "Azure Container Registry: used for Docker images. Configure registry name, SKU, region, and image workflow settings where supported.",
  "Azure Public IP: used for public addressing. Configure public IP name, allocation mode, SKU, region, and attachment intent where supported.",
  "Azure Network Security Group: used for firewall rules. Configure security rules, ports, private mode, and region. CloudWatcher uses it to model access boundaries around Azure workloads.",
  "Azure Backend Address Pool: used for load-balancer backend routing. Configure backend pool name, port/routing relationships, and region where supported.",
  "Azure Managed Disk: used for VM disk storage. Configure disk name, size, type, region, and attachment intent.",
  "Azure AKS Cluster: used for managed Kubernetes. Configure cluster name, node count, node VM size, DNS prefix, and region.",
  "Azure Load Balancer: used for traffic distribution. Configure load balancer name, frontend port, backend port, and region.",
  "Azure VM Scale Set: used for autoscaling VM groups. Configure min size, max size, desired capacity, VM size, region, and autoscaling settings where supported.",
  "Azure CDN or Front Door: used for global delivery and edge routing. Configure CDN name, origin, SKU, and routing behavior where supported.",
  "GCP Compute Engine VM: used for Google Cloud compute. Configure instance name, machine type, zone, image, boot disk GB, allow HTTP, and region.",
  "GCP Cloud Storage Bucket: used for object storage. Configure bucket name, storage class, location, versioning, region, and policy.",
  "GCP Cloud SQL Database: used for managed relational data. Configure instance name, database name, database version, tier, and region.",
  "GCP Cloud Run Function: used for serverless functions. Configure function name, runtime, entry point, and region.",
  "GCP VPC Network: used for private networking. Configure network name, CIDR block, subnet CIDR block, SSH port, HTTP port, HTTPS port, private mode, and region.",
  "GCP GKE Cluster: used for managed Kubernetes. Configure cluster name, node count, machine type, location, and region.",
  "GCP Artifact Registry: used for container images. Configure repository, format, region, and image workflow settings where supported.",
  "GCP External Address: used for static public IP addressing. Configure address name, region, and attachment intent where supported.",
  "GCP Firewall Rule: used for traffic control. Configure allowed ports, source ranges, target tags, private mode, and region/network settings.",
  "GCP Backend Service: used for load-balancer backends. Configure backend name, protocol, port, health check, and balancing settings where supported.",
  "GCP Persistent Disk: used for block storage. Configure disk name, size, type, zone, and attachment intent.",
  "GCP Cloud Load Balancer: used for traffic distribution. Configure load balancer name, port, protocol, backend service, and region/global routing.",
  "GCP Managed Instance Group: used for scalable compute. Configure group name, machine type, min size, max size, desired capacity, region or zone, and autoscaling policy.",
  "GCP Cloud CDN: used for edge caching. Configure CDN name, backend bucket or service, cache behavior, and global delivery settings where supported.",
];

export const docsPages: DocsPage[] = [
  {
    slug: [],
    path: "/docs",
    group: "Getting Started",
    label: "Home",
    title: "CloudWatcher docs",
    description:
      "Simple guides for setting up CloudWatcher, reading cloud and AI data, running simulations, and using operational workflows safely.",
    intro:
      "Use these docs like a product handbook. Start with setup, then move into the feature guide that matches the job you are doing.",
    sections: [
      {
        id: "what-it-is",
        title: "What CloudWatcher helps with",
        bullets: [
          "Connect AWS, Azure, or GCP accounts and view cloud inventory, health, cost, alerts, and recommendations.",
          "Track AI usage across providers, models, traces, tokens, latency, errors, and estimated cost.",
          "Build infrastructure simulations, preview Terraform, deploy test stacks, and destroy deployed simulation resources.",
          "Review live infrastructure, action history, cost savings, reports, VPS logs, compliance tools, and resize migrations.",
        ],
      },
      {
        id: "fast-path",
        title: "Fast path",
        bullets: [
          "New user: read Getting Started, then connect one cloud provider.",
          "SEO and service discovery: read Supported Cloud Services and Cloud Provider Configurations.",
          "Cloud engineer: read Multicloud Setup, then the guide for AWS, Azure, or GCP.",
          "FinOps user: read Billing Metrics, Recommendations, and Cost Savings.",
          "AI team: read AI Observability, Setup and SDK, Traces, Cost and Models, AI Quality Workflows, and Playground and Evals.",
          "Infra tester: read Simulation Overview, New Simulation, Deployments, and Live Infrastructure.",
          "Operator: read Actions, VPS Logs, Resize Migration, and Troubleshooting.",
        ],
      },
      {
        id: "full-feature-map",
        title: "Full feature map",
        bullets: PRODUCT_FEATURES,
      },
      {
        id: "feature-status",
        title: "Feature status words",
        bullets: [
          "Available means the page has an active product workflow.",
          "Provider-dependent means it depends on your cloud provider, region, permissions, and data source.",
          "AWS-first means AWS has the deepest coverage today.",
          "Setup required means you need an integration, billing export, ingest key, agent, or notification channel first.",
          "Roadmap means it should not be treated as fully delivered yet.",
        ],
      },
      {
        id: "safety",
        title: "Safety rule",
        paragraphs: [
          "Dashboards and reports are read-only. Deployments, live infrastructure actions, resize migration, alarm changes, and destroy flows can affect real cloud resources.",
        ],
        note: {
          tone: "warning",
          title: "Check the target before acting",
          body: "Before running a write action, confirm the provider, account or subscription, project, region, resource name, and generated plan.",
        },
      },
    ],
  },
  {
    slug: ["getting-started"],
    path: "/docs/getting-started",
    group: "Getting Started",
    label: "Getting Started",
    title: "Get started",
    description:
      "Create your account, connect a provider, check the first data, and choose the next feature to use.",
    intro:
      "You do not need to configure everything on day one. Connect one provider, verify the data, and then add the workflows your team needs.",
    sections: [
      {
        id: "step-1",
        title: "1. Sign in and open the app",
        bullets: [
          "Create an account or sign in with your existing login.",
          "Open the main dashboard after authentication.",
          "If your organization uses roles, make sure your account has access to setup pages before adding credentials.",
        ],
      },
      {
        id: "step-2",
        title: "2. Connect one provider",
        bullets: [
          "For AWS, open Settings > AWS and create the role requested by CloudWatcher.",
          "For Azure, open Settings > Azure and add the tenant, subscription, and service-principal details.",
          "For GCP, open Settings > GCP and connect a service account or use the assisted setup flow.",
          "Wait for the page to show connected status before judging dashboard data.",
        ],
      },
      {
        id: "step-3",
        title: "3. Check the first data",
        bullets: [
          "Open Dashboard and confirm the selected provider is correct.",
          "Pick a region where you know resources exist.",
          "Open a service dashboard such as compute, storage, database, or networking.",
          "Open Billing Metrics only after billing access or export is configured.",
          "Open Alerts to see current findings and alarm state.",
        ],
      },
      {
        id: "step-4",
        title: "4. Choose the next workflow",
        bullets: [
          "Daily operations: Dashboard, Watchdog, service dashboards, Alerts, and Actions.",
          "Cost work: Billing Metrics, Recommendations, Cost Savings, and Email Reports.",
          "AI work: AI Observability Setup, Trace Explorer, Cost, Models, Errors, Alerts, Prompts, Playground, Evaluations, Sessions, Users, and Scores.",
          "Infrastructure changes: Simulation Builder, Terraform Preview, Deployments, Live Infrastructure, and Resize Migration.",
        ],
      },
    ],
  },
  {
    slug: ["local-development-setup"],
    path: "/docs/local-development-setup",
    group: "Getting Started",
    label: "Local Setup Guide",
    title: "Run CloudWatcher locally",
    description:
      "Install dependencies, configure environment files, run the backend and frontend, and verify the local app.",
    intro:
      "This guide is for developers running the product on their own machine.",
    sections: [
      {
        id: "requirements",
        title: "Before you start",
        bullets: [
          "Install Node.js 18 or newer.",
          "Install Docker if you use the local monitoring stack.",
          "Have a MongoDB connection string ready.",
          "Have provider keys or test credentials only for the features you want to verify.",
        ],
      },
      {
        id: "install",
        title: "1. Install dependencies",
        codeBlocks: [
          {
            title: "Backend",
            code: "cd backend\nnpm install",
          },
          {
            title: "Frontend",
            code: "cd ../frontend\nnpm install",
          },
        ],
      },
      {
        id: "backend",
        title: "2. Configure and start the backend",
        paragraphs: [
          "Create backend/.env from the example file and fill only the values you need for local testing.",
        ],
        codeBlocks: [
          {
            title: "Common backend values",
            code: "PORT=4000\nMONGODB_URI=your_mongodb_uri\nJWT_SECRET=your_local_secret\nGEMINI_API_KEY=optional_for_ai_features",
          },
          {
            title: "Start backend",
            code: "cd backend\nnpm run dev",
          },
        ],
      },
      {
        id: "frontend",
        title: "3. Configure and start the frontend",
        codeBlocks: [
          {
            title: "Common frontend values",
            code: "NEXT_PUBLIC_API_BASE_URL=http://localhost:4000",
          },
          {
            title: "Start frontend",
            code: "cd frontend\nnpm run dev",
          },
        ],
        bullets: ["Open http://localhost:3000 after the Next.js server starts."],
      },
      {
        id: "verify",
        title: "4. Verify the stack",
        bullets: [
          "Create or sign in to a local account.",
          "Open Dashboard and confirm the frontend can call the backend.",
          "Open Settings and connect only the providers you need for testing.",
          "For AI telemetry, create an ingest key and send a small test trace before debugging larger apps.",
        ],
      },
    ],
  },
  {
    slug: ["feature-catalog"],
    path: "/docs/feature-catalog",
    group: "Getting Started",
    label: "Feature Catalog",
    title: "CloudWatcher feature catalog",
    description:
      "Every major CloudWatcher product area, feature, workflow, and developer-facing surface in one technical catalog.",
    intro:
      "Use this as the master map before jumping into a setup guide. It covers cloud operations, FinOps, AI observability, simulations, live infrastructure, resize migration, logs, reports, admin surfaces, and integrations.",
    sections: [
      {
        id: "product-features",
        title: "Product feature groups",
        bullets: PRODUCT_FEATURES,
      },
      {
        id: "website-pages",
        title: "Website and app pages",
        bullets: APP_SURFACES,
      },
      {
        id: "who-uses-what",
        title: "Who should use what",
        bullets: [
          "Beginner developer: Getting Started, Local Setup Guide, Provider Configs, Supported Services, Simulation Builder, AI Setup and SDK, and Troubleshooting.",
          "Cloud engineer: Multicloud Setup, AWS, Azure, GCP, Live Infrastructure, Actions, Resize Migration, Simulation Deployments, and API Reference.",
          "FinOps user: Billing Metrics, Recommendations, Cost Savings, Email Reports, and AI Cost and Models.",
          "AI engineer: AI Observability, Setup and SDK, Traces, Cost and Models, AI Quality Workflows, Playground and Evals, and Alerts and Recommendations.",
          "Security or compliance user: Alerts, Actions, Security dashboards, logs, and reports.",
          "Platform admin: Profile, Team Management, Settings pages, SaaS Admin, Integrations, Notification Settings, and Security Events.",
        ],
      },
    ],
  },
  {
    slug: ["app-pages"],
    path: "/docs/app-pages",
    group: "Getting Started",
    label: "App Pages",
    title: "All CloudWatcher app pages",
    description:
      "A route-by-route guide to what each CloudWatcher page does and how it fits into the product.",
    intro:
      "This page is useful when you are new to the app or auditing coverage. It explains the purpose of every major page in plain language.",
    sections: [
      {
        id: "pages",
        title: "Pages and responsibilities",
        bullets: APP_SURFACES,
      },
      {
        id: "daily-flow",
        title: "Suggested daily workflow",
        bullets: [
          "Start on Dashboard to check the selected provider, spend, resource health, and active alerts.",
          "Open Watchdog to see broad operational risk and fleet status.",
          "Open service dashboards for the resource area that needs investigation.",
          "Open Billing Metrics, Recommendations, and Cost Savings for cost changes.",
          "Open AI Observability pages if AI spend, model latency, or errors changed.",
          "Use Actions, Simulation, Live Infrastructure, or Resize Migration only after reading the relevant detail page.",
        ],
      },
    ],
  },
  {
    slug: ["api-reference"],
    path: "/docs/api-reference",
    group: "Getting Started",
    label: "API Reference",
    title: "Developer API reference",
    description:
      "A practical map of the backend API groups that power CloudWatcher features.",
    intro:
      "This is not a formal OpenAPI document yet. It is a developer-readable API map based on the backend route groups, useful for integration work and debugging.",
    sections: [
      {
        id: "api-groups",
        title: "API groups",
        bullets: API_REFERENCE,
      },
      {
        id: "auth-boundary",
        title: "Authentication and roles",
        bullets: [
          "Most product APIs require authentication.",
          "Write-heavy APIs usually require admin or operator roles.",
          "Some public ingest paths use webhook secret or ingest-key authentication instead of normal app login.",
          "Sensitive APIs such as team management, provider key management, credential vault, reports, and SaaS admin are role-gated.",
        ],
      },
      {
        id: "debugging",
        title: "Debugging pattern",
        bullets: [
          "For frontend issues, identify the page, the API group it calls, and the selected provider or workspace state.",
          "For cloud issues, separate credential validation, provider permissions, region, quota, billing export, and unsupported capability state.",
          "For AI issues, check ingest key, event or trace payload, provider key, model pricing, time range, and filters.",
          "For simulation issues, read Terraform preview, credential validation, deployment logs, and destroy logs before retrying.",
        ],
      },
    ],
  },
  {
    slug: ["multicloud-setup"],
    path: "/docs/multicloud-setup",
    group: "Cloud Setup",
    label: "Multicloud Setup",
    title: "Connect and switch cloud providers",
    description:
      "Understand AWS, Azure, GCP, provider switching, capability states, and reconnect behavior.",
    intro:
      "CloudWatcher uses one workspace for several providers. AWS has the broadest coverage. Azure and GCP are active integrations with feature coverage that depends on permissions and setup.",
    sections: [
      {
        id: "steps",
        title: "Basic steps",
        bullets: [
          "Open the setup page for your provider.",
          "Add the required identity details.",
          "Save and wait for validation.",
          "Return to Dashboard and choose the provider and region.",
          "Open Billing, Alerts, and service pages after the provider has loaded.",
        ],
      },
      {
        id: "providers",
        title: "Provider notes",
        bullets: [
          "AWS is best for the widest monitoring, optimization, action, simulation, and migration coverage.",
          "Azure supports onboarding, inventory, billing and metrics where permissions allow, plus selected simulation and live-resource flows.",
          "GCP supports service-account onboarding, billing export setup, metrics, resources, alerts, and simulation groundwork where configured.",
        ],
      },
      {
        id: "selectors",
        title: "Provider and region selectors",
        bullets: [
          "Always check the selected provider before reading dashboard numbers.",
          "Always check the selected region before assuming resources are missing.",
          "Billing can be global or delayed even when resource inventory is visible.",
          "A connected provider can still show limited data if a permission or export is missing.",
        ],
      },
    ],
  },
  {
    slug: ["supported-cloud-services"],
    path: "/docs/supported-cloud-services",
    group: "Cloud Setup",
    label: "Supported Services",
    title: "Supported cloud services",
    description:
      "A technical list of AWS, Azure, and GCP services CloudWatcher can monitor, simulate, configure, deploy, or inspect.",
    intro:
      "This page is written for search and for engineers. It names the actual cloud services and configuration areas that appear across dashboards, simulations, live infrastructure, recommendations, and deployment workflows.",
    sections: [
      {
        id: "aws-services",
        title: "AWS services",
        bullets: AWS_SIMULATION_SERVICES,
      },
      {
        id: "azure-services",
        title: "Azure services",
        bullets: AZURE_SIMULATION_SERVICES,
      },
      {
        id: "gcp-services",
        title: "GCP services",
        bullets: GCP_SIMULATION_SERVICES,
      },
      {
        id: "monitoring-coverage",
        title: "Monitoring and operations coverage",
        bullets: [
          "Cloud inventory: compute, storage, database, networking, serverless, container, CDN, load-balancing, and security resources where provider APIs and permissions allow.",
          "Cloud metrics: provider-native performance and health metrics for supported services.",
          "Cloud logs: available when logging permissions, forwarding, or provider log sources are configured.",
          "Cloud billing: AWS Cost Explorer, Azure Cost Management, and GCP billing export paths where configured.",
          "Cloud alerts: provider alarms, default alarm provisioning, cost alerts, AI alerts, VPS log alerts, and compliance-support alerts.",
          "Cloud recommendations: cost, security, reliability, performance, rightsizing, orphaned resources, AI routing, prompt optimization, and savings opportunities.",
        ],
      },
    ],
  },
  {
    slug: ["cloud-provider-configurations"],
    path: "/docs/cloud-provider-configurations",
    group: "Cloud Setup",
    label: "Provider Configs",
    title: "Cloud provider configurations",
    description:
      "The provider credentials, regions, permissions, billing exports, service fields, and deployment settings CloudWatcher uses.",
    intro:
      "Use this page when you need to understand exactly what CloudWatcher asks for and why.",
    sections: [
      {
        id: "aws-config",
        title: "AWS configuration",
        bullets: [
          "Identity: IAM role ARN with external ID, or credentials used only where the workflow explicitly supports manual credential validation.",
          "Regions: common regions include us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-central-1, ap-south-1, ap-southeast-1, and ap-northeast-1.",
          "Billing: Cost Explorer or billing permissions are required for billing metrics, spend trends, cost savings, and recommendations.",
          "Monitoring: CloudWatch, CloudWatch Logs, service read permissions, and resource inventory permissions are required for dashboards and alerts.",
          "Simulation deployment: Terraform workflows need create, update, read, and destroy permissions for the selected services.",
          "Common compute fields: instance type, AMI, key pair, admin username, count, VPC, subnet, security group, and region.",
          "Common network fields: VPC CIDR, subnet CIDR, SSH port, HTTP port, HTTPS port, private mode, load balancer port, target group routing, and public IP settings.",
        ],
      },
      {
        id: "azure-config",
        title: "Azure configuration",
        bullets: [
          "Identity: tenant ID, subscription ID, client ID, and client secret for a service principal.",
          "Regions: common regions include centralindia, eastus, eastus2, westus2, northeurope, westeurope, and southeastasia.",
          "Billing: Azure Cost Management access is required for cost data.",
          "Monitoring: subscription read access, resource inventory access, metrics access, and selected provider permissions are required for dashboards.",
          "Simulation deployment: Contributor-style write permissions may be required for VM, storage, SQL, function, VNet, AKS, load balancer, disk, and public IP creation.",
          "Common compute fields: VM size, VM count, admin username, OS disk type, Ubuntu image publisher, image offer, image SKU, and region.",
          "Common storage fields: storage account name, account tier, replication type, account kind, region, and policy.",
          "Common network fields: VNet name, address space, subnet CIDR, NSG rules, SSH port, HTTP port, HTTPS port, private mode, public IP, backend pool, and load balancer ports.",
        ],
      },
      {
        id: "gcp-config",
        title: "GCP configuration",
        bullets: [
          "Identity: project ID, service account client email, private key, and enabled APIs for the services you want to use.",
          "Regions and zones: common regions include us-central1, us-east1, us-west1, europe-west1, europe-west3, asia-south1, and asia-southeast1; zones include values such as us-central1-a and asia-south1-a.",
          "Billing: GCP billing export is required for reliable cost reporting.",
          "Monitoring: service account roles must allow reading resources, metrics, and project data.",
          "Simulation deployment: create and delete permissions are required for Compute Engine, Cloud Storage, Cloud SQL, Cloud Run Functions, GKE, VPC, firewall, load balancing, disks, and Artifact Registry.",
          "Common compute fields: instance name, machine type, zone, image, boot disk size, HTTP access, and region.",
          "Common storage fields: bucket name, storage class, location, versioning, region, and policy.",
          "Common network fields: VPC network name, CIDR block, subnet CIDR, firewall ports, private mode, external IP, backend service, load balancer port, and Cloud CDN settings.",
        ],
      },
      {
        id: "application-config",
        title: "Application deployment configuration",
        bullets: [
          "GitHub repository: Git URL, branch, optional token, project type, runtime, build command, start command, app port, frontend directory, backend directory, API path, and backend port.",
          "Supported project types: generic Node or Python, Node API, Vite frontend, MERN app, Next.js app, and Docker app.",
          "Docker Hub: repository, tag, username, password, app port, and container port.",
          "Container registries: AWS ECR, Azure Container Registry, and GCP Artifact Registry are used for image-based workflows where configured.",
        ],
      },
    ],
  },
  {
    slug: ["service-configuration-reference"],
    path: "/docs/service-configuration-reference",
    group: "Cloud Setup",
    label: "Service Configs",
    title: "Service configuration reference",
    description:
      "Every supported simulation and deployment service with the configuration fields CloudWatcher uses.",
    intro:
      "Use this page when you want the exact service-level configuration map. It is useful for developers building a simulation, reviewing Terraform output, debugging deployment validation, or comparing AWS, Azure, and GCP service support.",
    sections: [
      {
        id: "all-service-configs",
        title: "All service configuration fields",
        bullets: SERVICE_CONFIGURATION_REFERENCE,
      },
      {
        id: "how-to-read-configs",
        title: "How to read these configs",
        bullets: [
          "Required identity and billing setup still happens in AWS, Azure, GCP, GitHub, AI keys, or reports settings before a workflow can use these services.",
          "Simulation fields describe planned infrastructure. They become real only when a deployment is started with valid credentials.",
          "Live Infrastructure fields come from discovered provider resources and may not include every field used during simulation.",
          "Cost estimates depend on pricing data, selected region, resource size, runtime, and provider availability.",
          "Provider errors such as quota, SKU unavailable, permission denied, invalid region, missing API, or naming conflict must be fixed in the provider account before retrying.",
        ],
      },
    ],
  },
  {
    slug: ["aws-account-setup"],
    path: "/docs/aws-account-setup",
    group: "Cloud Setup",
    label: "AWS Account Setup",
    title: "Connect AWS",
    description:
      "Set up AWS access for dashboards, inventory, billing, alerts, recommendations, simulations, and actions.",
    intro:
      "AWS is the deepest CloudWatcher integration today.",
    sections: [
      {
        id: "permissions",
        title: "What you need",
        bullets: [
          "Permission to create or update an IAM role or deploy the provided CloudFormation stack.",
          "Cost Explorer or billing access if you want cost pages.",
          "CloudWatch and service read permissions for metrics and inventory.",
          "Extra write permissions only for alarms, simulations, live actions, or migration workflows.",
        ],
      },
      {
        id: "steps",
        title: "Setup steps",
        bullets: [
          "Open Settings > AWS.",
          "Copy the generated external ID and role instructions.",
          "Create the IAM role or deploy the provided stack in AWS.",
          "Paste the role details back into CloudWatcher.",
          "Save and wait for connected status.",
          "Open Dashboard and a known service page to confirm data.",
        ],
      },
      {
        id: "unlocks",
        title: "What AWS unlocks",
        bullets: [
          "Service dashboards, metrics, alerts, billing, recommendations, and cost savings.",
          "Live Infrastructure views and supported AWS actions.",
          "Simulation deployment, Terraform preview, and destroy workflows.",
          "AI Observability data from Bedrock where configured.",
          "Resize Migration for EC2-focused workflows.",
        ],
      },
      {
        id: "aws-supported-services",
        title: "AWS services and config fields",
        bullets: AWS_SIMULATION_SERVICES,
      },
      {
        id: "aws-verify",
        title: "AWS verification checklist",
        bullets: [
          "Open Dashboard and verify account-level cards load.",
          "Open EC2 or another service dashboard in a region with known resources.",
          "Open Billing Metrics and confirm Cost Explorer data is available.",
          "Open Alerts and check whether CloudWatch alarms or default alarms appear.",
          "Open Recommendations and Cost Savings to confirm optimization data is available.",
          "Open Simulation, add an EC2 Instance or S3 Bucket, preview Terraform, and deploy only in a safe test account.",
        ],
      },
    ],
  },
  {
    slug: ["azure-setup"],
    path: "/docs/azure-setup",
    group: "Cloud Setup",
    label: "Azure Setup",
    title: "Connect Azure",
    description:
      "Connect an Azure subscription and understand current Azure support.",
    intro:
      "Azure support is provider-aware and growing. Treat write-heavy actions as permission-sensitive until you verify the exact workflow.",
    sections: [
      {
        id: "before",
        title: "Before setup",
        bullets: [
          "Have the tenant ID and subscription ID ready.",
          "Create or use a service principal with the right read permissions.",
          "Add write permissions only if you plan to deploy simulations or run live actions.",
          "Confirm the target region supports the resources you want to create.",
        ],
      },
      {
        id: "steps",
        title: "Setup steps",
        bullets: [
          "Open Settings > Azure.",
          "Enter tenant, subscription, client ID, and client secret details.",
          "Save the connection.",
          "Open Dashboard and switch provider to Azure.",
          "Check inventory or metrics in a region where Azure resources already exist.",
        ],
      },
      {
        id: "coverage",
        title: "Current Azure coverage",
        bullets: [
          "Setup, dashboard switching, inventory, metrics, billing, alerts, and insights are available where permissions and Azure APIs support them.",
          "Simulation and live infrastructure flows exist for selected Azure resources.",
          "Deployment can fail even when discovery works if the service principal lacks create or write permission.",
        ],
        note: {
          tone: "tip",
          title: "Read access is not deployment access",
          body: "If Azure discovery works but deployment fails, check role assignment, subscription scope, resource group, region, SKU, and quotas.",
        },
      },
      {
        id: "azure-supported-services",
        title: "Azure services and config fields",
        bullets: AZURE_SIMULATION_SERVICES,
      },
      {
        id: "azure-verify",
        title: "Azure verification checklist",
        bullets: [
          "Open Dashboard and switch provider to Azure.",
          "Confirm the selected subscription and region are correct.",
          "Open inventory, metrics, billing, alerts, or insights for resources that already exist.",
          "For simulation, start with a small Virtual Machine, Storage Account, Virtual Network, or Function App.",
          "If Terraform fails, read the logs for role assignment, region, SKU, quota, resource group, or policy errors.",
        ],
      },
    ],
  },
  {
    slug: ["gcp-setup"],
    path: "/docs/gcp-setup",
    group: "Cloud Setup",
    label: "GCP Setup",
    title: "Connect GCP",
    description:
      "Connect a GCP project using service-account credentials and configure billing visibility where needed.",
    intro:
      "GCP support depends strongly on service-account permissions and billing export setup.",
    sections: [
      {
        id: "before",
        title: "Before setup",
        bullets: [
          "Choose the GCP project you want CloudWatcher to read.",
          "Create a service account with the permissions needed for inventory, metrics, and billing.",
          "Enable required APIs for the resources you want to view.",
          "Set up billing export if you need reliable cost data.",
        ],
      },
      {
        id: "steps",
        title: "Setup steps",
        bullets: [
          "Open Settings > GCP.",
          "Use assisted setup or paste service-account JSON manually.",
          "Save and validate the connection.",
          "Switch Dashboard to GCP.",
          "Check a region or project where resources already exist.",
        ],
      },
      {
        id: "callback",
        title: "Cloud Shell callback note",
        paragraphs: [
          "GCP Cloud Shell cannot call a backend running on your laptop through localhost. Use a hosted backend URL for callbacks, or use manual service-account JSON paste during local development.",
        ],
      },
      {
        id: "gcp-supported-services",
        title: "GCP services and config fields",
        bullets: GCP_SIMULATION_SERVICES,
      },
      {
        id: "gcp-verify",
        title: "GCP verification checklist",
        bullets: [
          "Open Dashboard and switch provider to GCP.",
          "Confirm the selected project, region, and zone match your resources.",
          "Open inventory, metrics, billing, alerts, or insights after the service account is saved.",
          "For cost data, confirm billing export is configured and has published records.",
          "For simulation, start with a small Compute Engine VM, Cloud Storage Bucket, VPC Network, or Cloud Run Function.",
          "If deployment fails, check enabled APIs, IAM roles, quota, region, zone, naming, and organization policy.",
        ],
      },
    ],
  },
  {
    slug: ["github-setup"],
    path: "/docs/github-setup",
    group: "Cloud Setup",
    label: "GitHub Setup",
    title: "Connect GitHub",
    description:
      "Connect GitHub for repository-aware deployment and simulation workflows.",
    sections: [
      {
        id: "steps",
        title: "Setup steps",
        bullets: [
          "Open Settings > GitHub.",
          "Start the GitHub OAuth connection.",
          "Approve access for the repositories your team wants to use.",
          "Return to CloudWatcher and confirm connected status.",
          "Select repositories and branches only inside workflows that need source access.",
        ],
      },
      {
        id: "disconnect",
        title: "Disconnect",
        bullets: [
          "Use Settings > GitHub to remove the app connection from CloudWatcher.",
          "Also review GitHub account or organization app permissions if you want to revoke access completely.",
        ],
      },
    ],
  },
  {
    slug: ["billing-metrics"],
    path: "/docs/billing-metrics",
    group: "Operations",
    label: "Billing Metrics",
    title: "Read billing and cost data",
    description:
      "Use billing pages without confusing missing setup, provider delays, and real zero spend.",
    sections: [
      {
        id: "how-to-use",
        title: "How to use it",
        bullets: [
          "Open Billing Metrics or the cost section for your provider.",
          "Confirm the selected provider and date range.",
          "Check month-to-date spend, service breakdown, trend, and high-cost areas.",
          "Use Recommendations and Cost Savings for follow-up actions.",
        ],
      },
      {
        id: "zero",
        title: "Why numbers may show zero",
        bullets: [
          "The provider account has no recent billable activity.",
          "Billing permissions are missing.",
          "AWS Cost Explorer, Azure Cost Management, or GCP billing export is not ready.",
          "Provider billing data has not published yet.",
          "The selected account, subscription, project, or date range is wrong.",
        ],
      },
    ],
  },
  {
    slug: ["dashboards-watchdog"],
    path: "/docs/dashboards-watchdog",
    group: "Operations",
    label: "Dashboards & Watchdog",
    title: "Use dashboards and Watchdog",
    description:
      "Check operational health, service data, security signals, resource counts, and investigation starting points.",
    sections: [
      {
        id: "dashboard",
        title: "Dashboard workflow",
        bullets: [
          "Choose the provider and region.",
          "Check spend, resources, alerts, and health cards.",
          "Open the service page for the area that looks unusual.",
          "Compare dashboard signals with billing, logs, alerts, and recommendations.",
        ],
      },
      {
        id: "watchdog",
        title: "Watchdog workflow",
        bullets: [
          "Open Watchdog for fleet-level status.",
          "Review active resources, findings, cost signals, and service health.",
          "Use Watchdog as a triage page, then open the exact resource or service page for detail.",
        ],
      },
    ],
  },
  {
    slug: ["alerts-notifications"],
    path: "/docs/alerts-notifications",
    group: "Operations",
    label: "Alerts & Notifications",
    title: "Configure alerts and notifications",
    description:
      "Review alerts, default alarms, AI alerting, and notification channels.",
    sections: [
      {
        id: "alert-types",
        title: "Alert types",
        bullets: [
          "Cloud resource and health alerts.",
          "Billing, budget, and cost-change alerts.",
          "AI token, cost, latency, error, and budget alerts.",
          "VPS log pattern and error alerts.",
          "Security and compliance-support alerts where configured.",
        ],
      },
      {
        id: "steps",
        title: "Basic workflow",
        bullets: [
          "Open Alerts.",
          "Filter by provider, severity, source, or status.",
          "Open the related dashboard, trace, log, or resource.",
          "Acknowledge or resolve only after the cause is understood.",
          "Configure email or Slack delivery if your team needs notifications outside the app.",
        ],
      },
      {
        id: "default-alarms",
        title: "Default alarms",
        paragraphs: [
          "Default alarms can create baseline cloud alarms for discovered resources where the provider and permissions support it.",
        ],
        note: {
          tone: "warning",
          title: "Alarm changes can be real provider changes",
          body: "Review account, provider, resource, threshold, and notification routing before creating or editing alarms.",
        },
      },
    ],
  },
  {
    slug: ["recommendations"],
    path: "/docs/recommendations",
    group: "Operations",
    label: "Recommendations",
    title: "Use recommendations",
    description:
      "Review cost, reliability, security, performance, and AI recommendations before taking action.",
    sections: [
      {
        id: "what-you-see",
        title: "What recommendations can show",
        bullets: [
          "Rightsizing and waste opportunities.",
          "Provider-native findings and CloudWatcher-generated insights.",
          "Security or reliability warnings.",
          "AI routing, prompt, model, cost, and error recommendations.",
          "Suggested next steps that may lead to a plan, simulation, or manual review.",
        ],
      },
      {
        id: "steps",
        title: "Review steps",
        bullets: [
          "Open Recommendations.",
          "Filter by provider, category, risk, or priority.",
          "Read the affected resource, estimated impact, and reason.",
          "Check whether the recommendation is advisory or actionable.",
          "Use simulation or approval flows for infrastructure changes instead of acting blindly.",
        ],
      },
    ],
  },
  {
    slug: ["cost-savings"],
    path: "/docs/cost-savings",
    group: "Operations",
    label: "Cost Savings",
    title: "Track cost savings",
    description:
      "Use cost savings workflows to review opportunities, validate findings, and track realized savings.",
    sections: [
      {
        id: "steps",
        title: "How to use it",
        bullets: [
          "Open Cost Savings.",
          "Refresh optimization data when the page supports it.",
          "Review estimated monthly savings, affected resources, and confidence.",
          "Validate business impact before stopping, resizing, deleting, or changing a resource.",
          "Record completed actions so estimated and actual savings can be compared later.",
        ],
      },
      {
        id: "good-practice",
        title: "Good practice",
        bullets: [
          "Do not delete resources only because they look idle.",
          "Check owners, tags, production status, backups, and recent usage.",
          "Use Actions History after a change so the team can audit what happened.",
        ],
      },
    ],
  },
  {
    slug: ["actions-history"],
    path: "/docs/actions-history",
    group: "Operations",
    label: "Actions",
    title: "Review actions and changes",
    description:
      "Use action history to audit planned, approved, completed, failed, and rolled-back operational work.",
    sections: [
      {
        id: "what-it-covers",
        title: "What it covers",
        bullets: [
          "Infrastructure action plans.",
          "Approved and executed changes.",
          "Failed actions and error output.",
          "Rollback attempts where supported.",
          "Savings or impact records connected to completed work.",
        ],
      },
      {
        id: "review",
        title: "Review steps",
        bullets: [
          "Open Actions.",
          "Filter by status, provider, resource, or time range.",
          "Open the action detail and read target, requested change, result, and logs.",
          "Use the history during incident review, cost review, or change approval follow-up.",
        ],
      },
    ],
  },
  {
    slug: ["vps-logs"],
    path: "/docs/vps-logs",
    group: "Operations",
    label: "VPS Logs",
    title: "Monitor VPS and server logs",
    description:
      "Register log agents, send server logs, review summaries, and create alarms for error patterns.",
    sections: [
      {
        id: "steps",
        title: "Setup steps",
        bullets: [
          "Open VPS Logs.",
          "Create or register an agent for the server.",
          "Install the agent on the VPS with its token and endpoint.",
          "Start the service and confirm the agent heartbeat.",
          "Open logs, summaries, error patterns, and alarms after events arrive.",
        ],
      },
      {
        id: "systemd",
        title: "Example systemd service",
        codeBlocks: [
          {
            title: "/etc/systemd/system/rabbitt-agent.service",
            code: "[Unit]\nDescription=CloudWatcher VPS log agent\nAfter=network.target\n\n[Service]\nEnvironment=RABBITT_AGENT_TOKEN=replace_with_token\nExecStart=/usr/local/bin/rabbitt-agent\nRestart=always\n\n[Install]\nWantedBy=multi-user.target",
          },
          {
            title: "Enable and check",
            code: "sudo systemctl enable rabbitt-agent\nsudo systemctl start rabbitt-agent\nsudo systemctl status rabbitt-agent",
          },
        ],
      },
    ],
  },
  {
    slug: ["email-reports"],
    path: "/docs/email-reports",
    group: "Operations",
    label: "Email Reports",
    title: "Configure email reports",
    description:
      "Set report cadence, recipients, sections, and test delivery.",
    sections: [
      {
        id: "steps",
        title: "Setup steps",
        bullets: [
          "Open Settings > Reports.",
          "Choose recipients.",
          "Select cadence and time zone.",
          "Choose sections such as cost, alerts, resources, recommendations, AI usage, and savings.",
          "Send a test report before relying on scheduled delivery.",
        ],
      },
      {
        id: "troubleshoot",
        title: "If delivery fails",
        bullets: [
          "Check recipient spelling.",
          "Check mail provider configuration on the backend.",
          "Check whether the report has enough data for the selected sections.",
          "Use the test-send result before changing schedule settings.",
        ],
      },
    ],
  },
  {
    slug: ["ai-observability"],
    path: "/docs/ai-observability",
    group: "AI Observability",
    label: "Overview",
    title: "AI Observability overview",
    description:
      "Track AI requests, traces, providers, models, tokens, latency, errors, alerts, and estimated cost.",
    intro:
      "AI Observability is for teams that need to understand how their AI systems behave in production.",
    sections: [
      {
        id: "what-it-tracks",
        title: "What it tracks",
        bullets: [
          "Provider, model, environment, service, endpoint, and status.",
          "Input tokens, output tokens, total tokens, latency, and estimated cost.",
          "Trace groups, request detail, spans, metadata, and errors.",
          "Model performance, usage trends, prompt patterns, routing options, alerts, and evaluations.",
        ],
      },
      {
        id: "tabs",
        title: "Main tabs",
        bullets: [
          "Overview for the high-level picture.",
          "Traces and Request Detail for debugging one flow.",
          "Cost and Models for spend and performance.",
          "Errors and Alerts for reliability problems.",
          "Playground and Evaluations for prompt and model testing.",
          "Scores, Sessions, and Users for quality operations.",
          "Recommendations and Prompts for optimization.",
        ],
      },
      {
        id: "providers",
        title: "AI providers and gateways",
        bullets: AI_PROVIDER_FEATURES,
      },
    ],
  },
  {
    slug: ["ai-observability-setup"],
    path: "/docs/ai-observability-setup",
    group: "AI Observability",
    label: "Setup & SDK",
    title: "Set up AI telemetry",
    description:
      "Create ingest keys, send telemetry, and understand provider keys.",
    sections: [
      {
        id: "keys",
        title: "Ingest keys and provider keys",
        bullets: [
          "Ingest keys let your application send traces and events to CloudWatcher.",
          "Provider keys let CloudWatcher test or use a provider integration where that feature requires direct provider access.",
          "Keep prompt and response capture optional if your team has privacy restrictions.",
        ],
      },
      {
        id: "steps",
        title: "Setup steps",
        bullets: [
          "Open Settings > AI Observability.",
          "Create an ingest key with only the scopes your app needs.",
          "Add the ingest endpoint and key to your application environment.",
          "Send one test event or trace.",
          "Open AI Observability > Traces and clear filters if the event does not appear.",
        ],
      },
      {
        id: "env",
        title: "Example app environment",
        codeBlocks: [
          {
            title: "Environment values",
            code: "CLOUDWATCHER_INGEST_URL=https://your-backend.example.com/api/ai-observability\nCLOUDWATCHER_INGEST_KEY=your_ingest_key\nCLOUDWATCHER_SERVICE_NAME=checkout-api\nCLOUDWATCHER_ENVIRONMENT=production",
          },
        ],
      },
    ],
  },
  {
    slug: ["ai-traces"],
    path: "/docs/ai-traces",
    group: "AI Observability",
    label: "Traces",
    title: "Use Trace Explorer",
    description:
      "Find AI requests, inspect trace groups, and debug errors or slow responses.",
    sections: [
      {
        id: "steps",
        title: "Trace workflow",
        bullets: [
          "Open AI Observability > Traces.",
          "Filter by time range, provider, model, service, environment, or status.",
          "Open a trace group to see related requests.",
          "Open request detail to inspect spans, timing, token usage, metadata, and error text.",
          "Use Errors, Cost, or Models when one trace points to a larger pattern.",
        ],
      },
      {
        id: "empty",
        title: "If traces are empty",
        bullets: [
          "Confirm the ingest key is active.",
          "Confirm the app is sending to the correct backend URL.",
          "Clear filters and widen the time range.",
          "Check whether the app sends telemetry only on successful requests.",
        ],
      },
    ],
  },
  {
    slug: ["ai-cost-models"],
    path: "/docs/ai-cost-models",
    group: "AI Observability",
    label: "Cost & Models",
    title: "Analyze AI cost and models",
    description:
      "Compare model usage, token volume, latency, errors, and estimated cost.",
    sections: [
      {
        id: "cost",
        title: "Cost workflow",
        bullets: [
          "Open AI Observability > Cost.",
          "Choose the time range.",
          "Review total estimated cost, daily trend, provider split, and model split.",
          "Open Bill Shock if spend changed suddenly.",
          "Open Recommendations for routing or prompt optimization ideas.",
        ],
      },
      {
        id: "models",
        title: "Models workflow",
        bullets: [
          "Open AI Observability > Models.",
          "Compare request count, tokens, latency, errors, and cost by model.",
          "Look for expensive models used on low-value workloads.",
          "Look for models with high error rate or slow response time.",
        ],
      },
      {
        id: "pricing",
        title: "Unpriced usage",
        paragraphs: [
          "If a model is not in the pricing table, tokens can still be recorded while cost shows as zero or unavailable. Treat those cost numbers as incomplete until pricing is configured.",
        ],
      },
    ],
  },
  {
    slug: ["ai-playground-evaluations"],
    path: "/docs/ai-playground-evaluations",
    group: "AI Observability",
    label: "Playground & Evals",
    title: "Use Playground and Evaluations",
    description:
      "Test prompts, compare providers, run evaluations, and inspect model output before changing production flows.",
    sections: [
      {
        id: "playground",
        title: "Playground steps",
        bullets: [
          "Open AI Observability > Playground.",
          "Choose provider, model, temperature, and other settings.",
          "Enter a prompt and run it.",
          "Compare output, latency, tokens, cost, and errors.",
          "Save useful findings before changing application code.",
        ],
      },
      {
        id: "evals",
        title: "Evaluation steps",
        bullets: [
          "Open Evaluations and choose the model and judge settings.",
          "Run the evaluation.",
          "Review pass rate, scores, error output, and examples that failed.",
          "Use the result to update prompts, routing, or model choice.",
        ],
      },
    ],
  },
  {
    slug: ["ai-quality-workflows"],
    path: "/docs/ai-quality-workflows",
    group: "AI Observability",
    label: "AI Quality",
    title: "Run AI quality workflows",
    description:
      "Use evaluations, scores, sessions, and users to improve AI behavior.",
    intro:
      "Quality work starts from production traces, then moves through repeatable checks and controlled model changes.",
    sections: [
      {
        id: "surfaces",
        title: "Quality surfaces",
        bullets: AI_QUALITY_SURFACES,
      },
      {
        id: "review-loop",
        title: "Review loop",
        bullets: [
          "Open Trace Explorer when a request is slow, failed, expensive, or user-visible.",
          "Capture feedback and comments on the request instead of keeping notes outside the product.",
          "Turn repeated failures into evaluation cases or score checks so future prompt or model changes can be tested.",
          "Use Scores and Evaluations to confirm the fix improved quality without creating a new regression.",
        ],
      },
      {
        id: "when-to-use",
        title: "When to use each tool",
        table: {
          headers: ["Need", "Use"],
          rows: [
            ["Debug one bad answer", "Trace detail, spans, comments, and scores"],
            ["Compare model behavior", "Playground and Evaluations"],
            ["Create repeatable checks", "Scores and Evaluations"],
            ["Tune prompt behavior", "Prompt Insights and Playground"],
            ["Investigate by customer journey", "Sessions and Users"],
            ["Prepare review evidence", "Trace metadata, comments, scores, and action history"],
          ],
        },
      },
    ],
  },
  {
    slug: ["ai-alerts-recommendations"],
    path: "/docs/ai-alerts-recommendations",
    group: "AI Observability",
    label: "Alerts & Recs",
    title: "Use AI alerts and recommendations",
    description:
      "Review AI reliability, cost, routing, prompt, and alert signals.",
    sections: [
      {
        id: "alerts",
        title: "Errors and alerts",
        bullets: [
          "Open AI Observability > Errors to group failures.",
          "Open AI Observability > Alerts to review active alert history.",
          "Check rate limits, timeouts, client errors, provider errors, and sudden cost changes.",
          "Use the request detail page to confirm the exact error before changing provider or model settings.",
        ],
      },
      {
        id: "recommendations",
        title: "Recommendations and prompts",
        bullets: [
          "Open Recommendations for routing, model, prompt, and cost suggestions.",
          "Open Prompts for repeated or oversized prompt patterns.",
          "Open trace detail when a recommendation points to output quality or user-impact risk.",
        ],
      },
    ],
  },
  {
    slug: ["simulation-features"],
    path: "/docs/simulation-features",
    group: "Simulation",
    label: "Simulation Overview",
    title: "Simulation overview",
    description:
      "Understand the difference between canvas planning, Terraform preview, deployment, history, and live infrastructure.",
    sections: [
      {
        id: "areas",
        title: "Simulation areas",
        bullets: [
          "New Simulation is where you design infrastructure on a visual canvas.",
          "Terraform Preview shows generated infrastructure code before deployment.",
          "Deployment Status shows live progress and logs.",
          "Simulation History stores drafts and deployment records.",
          "Live Infrastructure shows resources that already exist in your cloud account.",
        ],
      },
      {
        id: "service-catalog",
        title: "Simulation service catalog",
        table: {
          headers: ["Category", "AWS Service", "Azure Equivalent", "GCP Equivalent"],
          rows: [
            ["Compute (VMs)", "EC2", "Virtual Machine", "Compute Engine"],
            ["Object Storage", "S3", "Storage Account", "Cloud Storage"],
            ["Block Storage", "EBS", "Managed Disk", "Persistent Disk"],
            ["Relational DB", "RDS", "Azure SQL Database", "Cloud SQL"],
            ["NoSQL DB", "DynamoDB", "N/A", "N/A"],
            ["Serverless Functions", "Lambda", "Function App", "Cloud Run Function"],
            ["Container Orchestrator", "ECS / EKS", "AKS", "GKE"],
            ["Container Registry", "ECR", "Azure Container Registry", "Artifact Registry"],
            ["API Gateway", "API Gateway", "N/A", "N/A"],
            ["Virtual Network", "VPC", "Virtual Network", "VPC Network"],
            ["Access Control / Firewall", "Security Group", "Network Security Group", "Firewall Rule"],
            ["Load Balancing", "Elastic Load Balancer / Target Group", "Load Balancer / Backend Address Pool", "Cloud Load Balancer / Backend Service"],
            ["Auto Scaling", "Auto Scaling Group", "VM Scale Set", "Managed Instance Group"],
            ["Static IP Address", "Elastic IP", "Public IP", "External Address"],
            ["Content Delivery (CDN)", "CloudFront", "CDN or Front Door", "Cloud CDN"],
            ["Third-party Registries", "Docker Hub", "Docker Hub", "Docker Hub"],
            ["Version Control", "GitHub", "GitHub", "GitHub"],
          ],
        },
      },
      {
        id: "safety",
        title: "Canvas vs real resources",
        paragraphs: [
          "Adding nodes to a canvas is planning. Deploying a simulation can create real cloud resources. Deleting a saved canvas does not destroy deployed infrastructure.",
        ],
        note: {
          tone: "warning",
          title: "Destroy is separate from delete",
          body: "Use the destroy workflow for deployed simulation resources. Delete only removes the saved design from CloudWatcher.",
        },
      },
    ],
  },
  {
    slug: ["simulation-builder"],
    path: "/docs/simulation-builder",
    group: "Simulation",
    label: "New Simulation",
    title: "Build a simulation",
    description:
      "Create a provider-specific canvas, configure nodes, review cost, and preview Terraform.",
    sections: [
      {
        id: "steps",
        title: "Build steps",
        bullets: [
          "Open Simulation.",
          "Choose AWS, Azure, or GCP.",
          "Drag services onto the canvas.",
          "Connect services where the architecture needs relationships.",
          "Select each node and fill required configuration.",
          "Review the floating cost estimate and warnings.",
          "Open Terraform Preview before deploying.",
        ],
      },
      {
        id: "save",
        title: "Save behavior",
        bullets: [
          "Use manual save when you want a stable draft.",
          "Check saved history before assuming a design was preserved.",
          "Keep test designs clearly named so they are not confused with production work.",
        ],
      },
      {
        id: "node-configs",
        title: "Node configuration examples",
        bullets: [
          "Compute nodes usually ask for size, image, count, admin username, disk, region, and network settings.",
          "Storage nodes usually ask for bucket or account name, region or location, replication, storage class, versioning, lifecycle, and access policy.",
          "Database nodes usually ask for engine, version, class or tier, storage, database name, username, port, SKU, max size, and public access.",
          "Serverless nodes usually ask for runtime, handler or entry point, memory, timeout, function name, environment, and region.",
          "Network nodes usually ask for VPC or VNet name, CIDR blocks, subnet ranges, security rules, HTTP, HTTPS, SSH, public IP, load balancer, and backend routing.",
          "Application nodes usually ask for Git URL, branch, project type, runtime, build command, start command, app port, Docker image, tag, and optional credentials.",
        ],
      },
    ],
  },
  {
    slug: ["simulation-deployments"],
    path: "/docs/simulation-deployments",
    group: "Simulation",
    label: "Deployments",
    title: "Deploy and destroy simulation infrastructure",
    description:
      "Validate credentials, run deployment, read logs, and clean up active deployments.",
    sections: [
      {
        id: "deploy",
        title: "Deployment steps",
        bullets: [
          "Review the canvas and Terraform preview.",
          "Validate the selected provider credentials.",
          "Confirm account, subscription, project, region, and resource names.",
          "Start deployment only when validation passes.",
          "Watch live logs until the deployment finishes or fails.",
          "Open Simulation History to review status and outputs.",
        ],
      },
      {
        id: "destroy",
        title: "Destroy steps",
        bullets: [
          "Open Simulation History.",
          "Find the active deployment.",
          "Choose Destroy for that deployment.",
          "Read the destroy logs until cleanup finishes.",
          "Verify in the cloud provider console if the resources were important or expensive.",
        ],
      },
      {
        id: "deployment-configs",
        title: "Deployment configuration checks",
        bullets: [
          "AWS: verify IAM role, external ID, target region, service permissions, VPC/subnet/security group, quotas, and Cost Explorer if cost validation matters.",
          "Azure: verify tenant, subscription, client ID, client secret, role assignment, resource group permissions, region, SKU availability, and quota.",
          "GCP: verify project ID, service-account email, private key, enabled APIs, IAM roles, billing export, region, zone, and quota.",
          "Terraform: inspect the generated Terraform before apply, then read live logs during apply and destroy.",
          "State and cleanup: destroy active simulation deployments before deleting the saved design when real resources were created.",
        ],
      },
    ],
  },
  {
    slug: ["live-infrastructure"],
    path: "/docs/live-infrastructure",
    group: "Simulation",
    label: "Live Infrastructure",
    title: "Use Live Infrastructure",
    description:
      "Sync existing cloud resources, inspect live canvases, and run supported actions carefully.",
    sections: [
      {
        id: "steps",
        title: "Basic workflow",
        bullets: [
          "Open Simulation > Live Infrastructure.",
          "Choose provider and region.",
          "Sync inventory.",
          "Open a service group canvas.",
          "Select a resource to view details and supported actions.",
          "Use View All to return to the normal service dashboard when needed.",
        ],
      },
      {
        id: "actions",
        title: "Live actions",
        bullets: [
          "AWS has the broadest live action coverage.",
          "Azure and GCP actions depend on the resource type and current capability gate.",
          "Unsupported services remain read-only.",
          "Stop, start, terminate, delete, or resize actions should be treated as real provider changes.",
        ],
        note: {
          tone: "warning",
          title: "Live means live",
          body: "Live Infrastructure actions operate on discovered cloud resources, not on draft simulation nodes.",
        },
      },
    ],
  },
  {
    slug: ["resize-migration"],
    path: "/docs/resize-migration",
    group: "Operations",
    label: "Resize Migration",
    title: "Plan a resize migration",
    description:
      "Create a migration job, choose source and target, track tasks, validate access, and handle cutover safely.",
    sections: [
      {
        id: "scope",
        title: "Current scope",
        bullets: [
          "AWS EC2 is the most mature path.",
          "Azure appears in provider-aware flows where current support allows it.",
          "Jobs are task-based so operators can see preflight, image, launch, validation, cutover, and source-preservation work.",
        ],
      },
      {
        id: "steps",
        title: "Job steps",
        bullets: [
          "Open Resize Migration.",
          "Choose provider and region.",
          "Select the source server.",
          "Pick the target size.",
          "Choose access mode and cutover plan.",
          "Create the job.",
          "Track each task and fix blockers before moving to cutover.",
        ],
      },
      {
        id: "cutover",
        title: "Cutover safety",
        paragraphs: [
          "Cutover can affect real users. Confirm target health, traffic routing, backups, DNS, IP assignment, and rollback options before stopping or archiving the source.",
        ],
      },
    ],
  },
  {
    slug: ["chatbots-ai-services"],
    path: "/docs/chatbots-ai-services",
    group: "AI Observability",
    label: "Chatbots & AI Services",
    title: "Use chatbots and AI services",
    description:
      "Understand where the in-app assistant and AI service workflows fit.",
    sections: [
      {
        id: "assistant",
        title: "In-app assistant",
        paragraphs: [
          "The assistant is useful for product help, documentation questions, and operational questions when CloudWatcher has enough grounded workspace data.",
        ],
      },
      {
        id: "good-questions",
        title: "Good questions to ask",
        bullets: [
          "Why did cloud spend change this week?",
          "Which services have the most alerts?",
          "Which AI model is most expensive?",
          "Where are AI errors increasing?",
          "Which simulation deployments are active?",
          "How do I connect Azure or GCP?",
        ],
      },
    ],
  },
  {
    slug: ["troubleshooting"],
    path: "/docs/troubleshooting",
    group: "Support",
    label: "Troubleshooting",
    title: "Troubleshoot common issues",
    description:
      "Work through empty dashboards, zero billing, missing traces, failed simulations, callback issues, and live-action problems.",
    sections: [
      {
        id: "empty-dashboard",
        title: "Dashboard is empty",
        bullets: [
          "Check provider connection status.",
          "Check provider and region selectors.",
          "Open a region where resources exist.",
          "Verify read permissions for the service.",
          "Refresh or sync inventory where the page supports it.",
        ],
      },
      {
        id: "zero-billing",
        title: "Billing shows zero",
        bullets: [
          "Check billing permissions or export setup.",
          "Check the selected account, subscription, project, and date range.",
          "Wait for provider billing data to publish.",
          "Confirm there was real spend in the selected period.",
        ],
      },
      {
        id: "missing-traces",
        title: "AI traces are missing",
        bullets: [
          "Check the ingest key.",
          "Check the ingest URL.",
          "Send a test trace.",
          "Clear filters and widen the time range.",
          "Check whether your app only sends telemetry on successful requests.",
        ],
      },
      {
        id: "deployment-fails",
        title: "Simulation deployment fails",
        bullets: [
          "Read the Terraform logs first.",
          "Check provider credentials and write permissions.",
          "Check region, quota, SKU, names, and unsupported services.",
          "Fix the underlying permission or config issue before retrying.",
        ],
      },
      {
        id: "delete-vs-destroy",
        title: "Deleted design but resources still exist",
        paragraphs: [
          "Deleting a simulation design removes the saved canvas. It does not destroy resources that were deployed. Use Destroy from Simulation History for cleanup.",
        ],
      },
    ],
  },
  {
    slug: ["faq"],
    path: "/docs/faq",
    group: "Support",
    label: "FAQ",
    title: "FAQ",
    description:
      "Short answers for common CloudWatcher setup and feature questions.",
    sections: [
      {
        id: "faq-list",
        title: "Frequently asked questions",
        faqs: [
          {
            question: "Is CloudWatcher only for AWS?",
            answer:
              "No. AWS has the deepest coverage, but Azure and GCP are supported in provider-aware setup, dashboards, billing, alerts, simulations, and live infrastructure where the capability is ready.",
          },
          {
            question: "Why does discovery work but deployment fail?",
            answer:
              "Read permissions and write permissions are different. A provider can allow inventory discovery while blocking resource creation, update, or deletion.",
          },
          {
            question: "Why does GCP Cloud Shell fail with localhost?",
            answer:
              "Cloud Shell cannot reach your laptop through localhost. Use a hosted backend callback URL or paste service-account JSON manually.",
          },
          {
            question: "Does AI Observability need prompt text?",
            answer:
              "No. Core telemetry can work with metadata such as provider, model, tokens, latency, cost, status, service, endpoint, and spans. Prompt capture can stay optional.",
          },
          {
            question: "Why is AI cost zero for a model?",
            answer:
              "The model may not have pricing configured yet. Tokens can be recorded while cost remains unavailable or zero.",
          },
          {
            question: "Is a simulation safe?",
            answer:
              "Editing a canvas and previewing Terraform are planning steps. Deploying a simulation can create real resources.",
          },
          {
            question: "Does deleting a simulation destroy resources?",
            answer:
              "No. Delete removes the saved design. Use Destroy in Simulation History to clean up deployed resources.",
          },
          {
            question: "What is Live Infrastructure?",
            answer:
              "It syncs existing cloud resources into visual service canvases. Supported actions affect real resources.",
          },
          {
            question: "What is Resize Migration?",
            answer:
              "It is a guided job workflow for moving a server to a better size with preflight, launch, validation, cutover, and source-preservation steps.",
          },
          {
            question: "Can I use only AI Observability?",
            answer:
              "Yes. It works as a focused AI telemetry tool, though it is most useful when cloud cost and reliability data are also connected.",
          },
        ],
      },
    ],
  },
];

export const docsGroups = Array.from(
  new Map(
    docsPages.map((page) => [
      page.group,
      {
        title: page.group,
        pages: docsPages
          .filter((candidate) => candidate.group === page.group)
          .map((candidate) => ({
            path: candidate.path,
            label: candidate.label,
            title: candidate.title,
          })),
      },
    ])
  ).values()
);

export function normalizeDocsPath(slug?: string[]) {
  return !slug || slug.length === 0 ? "/docs" : `/docs/${slug.join("/")}`;
}

export function getDocsPageBySlug(slug?: string[]) {
  const path = normalizeDocsPath(slug);
  return docsPages.find((page) => page.path === path);
}

export function getDocsNeighbors(path: string) {
  const index = docsPages.findIndex((page) => page.path === path);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? docsPages[index - 1] : null,
    next: index < docsPages.length - 1 ? docsPages[index + 1] : null,
  };
}
