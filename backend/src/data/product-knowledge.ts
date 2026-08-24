export interface ProductKnowledgeItem {
  id: string;
  topic:
    | "overview"
    | "docs"
    | "simulation"
    | "ai_observability"
    | "live_infrastructure"
    | "actions"
    | "troubleshooting";
  title: string;
  content: string;
  source: string;
  keywords: string[];
}

export const PRODUCT_KNOWLEDGE_BASE: ProductKnowledgeItem[] = [
  {
    id: "PRODUCT-OVERVIEW",
    topic: "overview",
    title: "CloudWatcher product areas",
    content:
      "CloudWatcher connects AWS inventory, CloudWatch metrics, billing signals, recommendations, actions, simulations, live infrastructure, VPS logs, and AI Observability into one operations workspace. Users can ask the chatbot about dashboards, costs, health, setup, simulations, AI telemetry, alerts, troubleshooting, and safe operational changes.",
    source: "CloudWatcher product documentation",
    keywords: [
      "cloudwatcher",
      "rabbittize",
      "rabbittwatch",
      "overview",
      "product",
      "dashboard",
      "help",
    ],
  },
  {
    id: "PRODUCT-AWS-SETUP",
    topic: "overview",
    title: "AWS setup and regions",
    content:
      "AWS setup is handled from Settings > AWS Setup. The saved role lets CloudWatcher read inventory, metrics, billing, logs, Bedrock signals, alarms, and service data depending on enabled modules. Many dashboards and Live Infrastructure views are region-aware, so users should check the selected region when resources appear missing.",
    source: "CloudWatcher docs: AWS Account Setup",
    keywords: [
      "aws setup",
      "connect aws",
      "role",
      "external id",
      "region",
      "permissions",
      "empty dashboard",
    ],
  },
  {
    id: "DOCS-HOME",
    topic: "docs",
    title: "Docs home page",
    content:
      "The /docs page is the CloudWatcher documentation home. It explains what CloudWatcher does, the main product areas, where to start, how data flows, and the safety boundary between monitoring pages, simulation deployment, and live infrastructure actions.",
    source: "CloudWatcher docs: /docs",
    keywords: [
      "docs",
      "documentation",
      "/docs",
      "docs home",
      "main areas",
      "where to start",
      "data flow",
      "safety",
    ],
  },
  {
    id: "DOCS-INDEX",
    topic: "docs",
    title: "Documentation page list",
    content:
      "The docs include Getting Started, AWS Account Setup, Billing Metrics, Dashboards & Watchdog, Alerts & Notifications, AI Observability, Simulation Builder, Simulation Deployments, Live Infrastructure, Recommendations, Actions, Chatbots & AI Services, Troubleshooting, and FAQ.",
    source: "CloudWatcher docs navigation",
    keywords: [
      "docs pages",
      "documentation list",
      "sidebar",
      "getting started",
      "faq",
      "troubleshooting",
    ],
  },
  {
    id: "DOCS-GETTING-STARTED",
    topic: "docs",
    title: "Getting Started docs",
    content:
      "The Getting Started page guides a new workspace through account creation, AWS connection, cost and billing verification, and choosing the first workflow: cloud monitoring, cost reduction, AI operations, infrastructure experiments, or live infrastructure inspection.",
    source: "CloudWatcher docs: /docs/getting-started",
    keywords: [
      "getting started",
      "workspace",
      "first workflow",
      "verify cost",
      "new customer",
    ],
  },
  {
    id: "DOCS-AWS-SETUP",
    topic: "docs",
    title: "AWS Account Setup docs",
    content:
      "The AWS Account Setup page explains permissions needed before setup, the guided role/external ID flow in Settings > AWS Setup, what CloudWatcher reads, why regions matter, and how to validate after setup by checking Overview, service dashboards, Live Infrastructure, Billing Metrics, and AI Observability.",
    source: "CloudWatcher docs: /docs/aws-account-setup",
    keywords: [
      "aws account setup",
      "external id",
      "role",
      "settings aws",
      "regions",
      "validate setup",
    ],
  },
  {
    id: "DOCS-BILLING-METRICS",
    topic: "docs",
    title: "Billing Metrics docs",
    content:
      "The Billing Metrics page explains why cost values can show zero, how Cost and Usage Reports affect deeper spend analysis, expected billing delay, and checks to run before changing the AWS role.",
    source: "CloudWatcher docs: /docs/billing-metrics",
    keywords: [
      "billing metrics",
      "cost zero",
      "cur",
      "cost and usage reports",
      "billing delay",
      "spend",
    ],
  },
  {
    id: "DOCS-DASHBOARDS-WATCHDOG",
    topic: "docs",
    title: "Dashboards and Watchdog docs",
    content:
      "The Dashboards & Watchdog page explains the Overview dashboard, service dashboards, Watchdog, and the recommended investigation pattern: start from Overview or Watchdog, open the affected service dashboard, compare cost, health, alerts, and actions, then use Recommendations, Savings, or Live Infrastructure as needed.",
    source: "CloudWatcher docs: /docs/dashboards-watchdog",
    keywords: [
      "dashboards",
      "watchdog",
      "overview",
      "investigation pattern",
      "service dashboards",
    ],
  },
  {
    id: "DOCS-ALERTS",
    topic: "docs",
    title: "Alerts and Notifications docs",
    content:
      "The Alerts & Notifications page describes alert types for cost, infrastructure reliability, AI request errors, AI budget thresholds, and AWS alarms. It recommends choosing thresholds after baseline data exists, reviewing linked evidence, acknowledging owned investigations, and resolving only after the issue is fixed or accepted.",
    source: "CloudWatcher docs: /docs/alerts-notifications",
    keywords: [
      "alerts",
      "notifications",
      "thresholds",
      "acknowledge",
      "resolve",
    ],
  },
  {
    id: "DOCS-AI-OBSERVABILITY",
    topic: "docs",
    title: "AI Observability docs",
    content:
      "The AI Observability docs explain request traces, providers, models, tokens, latency, cost, reliability, errors, alerts, budgets, routing recommendations, prompt insights, Bedrock metrics, ingest keys, event APIs, and trace APIs.",
    source: "CloudWatcher docs: /docs/ai-observability",
    keywords: [
      "ai observability",
      "traces",
      "events",
      "ingest key",
      "models",
      "tokens",
      "latency",
      "bedrock",
    ],
  },
  {
    id: "DOCS-SIMULATION-BUILDER",
    topic: "docs",
    title: "Simulation Builder docs",
    content:
      "The Simulation Builder docs explain creating a new simulation, configuring EC2, S3, RDS, and Lambda nodes, using the floating cost estimate, autosave and manual save, and opening Terraform preview to inspect explicit and implicit resources before deployment.",
    source: "CloudWatcher docs: /docs/simulation-builder",
    keywords: [
      "simulation builder",
      "new simulation",
      "terraform preview",
      "cost estimate",
      "autosave",
      "ec2",
      "s3",
      "rds",
      "lambda",
    ],
  },
  {
    id: "DOCS-SIMULATION-DEPLOYMENTS",
    topic: "docs",
    title: "Simulation Deployments docs",
    content:
      "The Simulation Deployments page explains credential validation, Terraform deployment sessions, streamed logs, generated outputs such as PEM keys, Simulation History, and the difference between deleting a saved canvas and destroying active AWS resources.",
    source: "CloudWatcher docs: /docs/simulation-deployments",
    keywords: [
      "simulation deployments",
      "deployment",
      "terraform logs",
      "pem",
      "simulation history",
      "destroy",
    ],
  },
  {
    id: "DOCS-LIVE-INFRASTRUCTURE",
    topic: "docs",
    title: "Live Infrastructure docs",
    content:
      "The Live Infrastructure page explains syncing existing AWS inventory by selected region, opening service-group canvases, selecting resource nodes for details, viewing metrics where available, and running supported live actions. Live actions affect real AWS resources.",
    source: "CloudWatcher docs: /docs/live-infrastructure",
    keywords: [
      "live infrastructure",
      "live canvas",
      "sync inventory",
      "service canvas",
      "live actions",
      "real aws",
    ],
  },
  {
    id: "DOCS-RECOMMENDATIONS",
    topic: "docs",
    title: "Recommendations docs",
    content:
      "The Recommendations page explains how to read optimization opportunities in context, compare recommendations with cost trend, inspect the relevant service dashboard, check alerts and recent actions, verify resource owner and environment, prioritize high-value low-risk waste, and measure savings after changes.",
    source: "CloudWatcher docs: /docs/recommendations",
    keywords: [
      "recommendations",
      "savings",
      "optimization",
      "prioritize",
      "owner",
      "environment",
    ],
  },
  {
    id: "DOCS-ACTIONS",
    topic: "docs",
    title: "Actions docs",
    content:
      "The Actions page explains action history for AWS resource actions, simulation deploy/destroy sessions, live infrastructure operations, and recommendation-driven work. Users should check status, read logs or failure messages, compare timestamps with dashboards, and rerun only after correcting the failed cause.",
    source: "CloudWatcher docs: /docs/actions-history",
    keywords: [
      "actions",
      "action history",
      "logs",
      "status",
      "simulation destroy",
      "live infrastructure",
    ],
  },
  {
    id: "DOCS-CHATBOTS",
    topic: "docs",
    title: "Chatbots and AI Services docs",
    content:
      "The Chatbots & AI Services page explains that chatbots help teams ask about cloud state, platform knowledge, usage summaries, and support answers without manually opening every dashboard. Good questions include spend changes, alert-heavy services, AI model costs, AI request errors, and active simulation deployments.",
    source: "CloudWatcher docs: /docs/chatbots-ai-services",
    keywords: [
      "chatbots",
      "ai services",
      "ask ai",
      "assistant",
      "support answers",
      "usage summaries",
    ],
  },
  {
    id: "DOCS-TROUBLESHOOTING",
    topic: "docs",
    title: "Troubleshooting docs",
    content:
      "The Troubleshooting page covers empty AWS dashboards, zero billing values, empty AI Observability, failed simulation deployment, empty Live Infrastructure, and the common confusion where deleting a saved simulation canvas does not destroy active AWS resources.",
    source: "CloudWatcher docs: /docs/troubleshooting",
    keywords: [
      "troubleshooting",
      "empty dashboard",
      "billing zero",
      "ai observability empty",
      "simulation fails",
      "live infrastructure empty",
    ],
  },
  {
    id: "DOCS-FAQ",
    topic: "docs",
    title: "FAQ docs",
    content:
      "The FAQ page answers common questions: CloudWatcher is mainly AWS in this version, AI Observability does not require prompt content, some model costs may be zero when pricing is unknown, editing simulations is safe but deployment can create real resources, deleting a simulation does not destroy resources, Live Infrastructure reads real AWS inventory, dashboards can be empty because of region, sync, permissions, or missing resources, billing can lag, and AI telemetry supports Bedrock, OpenAI, Anthropic, Gemini, custom endpoints, and self-hosted providers.",
    source: "CloudWatcher docs: /docs/faq",
    keywords: [
      "faq",
      "common questions",
      "prompt content",
      "model costs",
      "deleting simulation",
      "billing lag",
      "providers",
    ],
  },
  {
    id: "PRODUCT-SIMULATION-BUILDER",
    topic: "simulation",
    title: "Simulation builder",
    content:
      "New Simulation opens a visual infrastructure builder where users place service nodes, connect relationships, configure fields, estimate monthly cost, save drafts, and generate Terraform preview output before deployment. Editing the canvas and previewing Terraform are planning steps and do not modify AWS by themselves.",
    source: "CloudWatcher docs: Simulation Features",
    keywords: [
      "simulation",
      "new simulation",
      "canvas",
      "builder",
      "nodes",
      "terraform preview",
      "estimate",
      "draft",
    ],
  },
  {
    id: "PRODUCT-SIMULATION-SERVICES",
    topic: "simulation",
    title: "Simulation supported services",
    content:
      "The simulation Terraform compiler currently accepts EC2, S3, RDS, and Lambda nodes. EC2 can generate key pairs and managed VPC resources; RDS uses managed VPC and database subnet support; S3 controls bucket settings; Lambda supports runtime, memory, timeout, and handler configuration. The preview separates explicit resources from implicit resources such as VPC, subnets, security groups, IAM, key pairs, and data sources.",
    source: "Backend Terraform compiler and simulation registry",
    keywords: [
      "simulation services",
      "ec2",
      "s3",
      "rds",
      "lambda",
      "implicit resources",
      "terraform",
    ],
  },
  {
    id: "PRODUCT-SIMULATION-DEPLOY",
    topic: "simulation",
    title: "Simulation deployment flow",
    content:
      "Deploying a simulation validates AWS access key credentials, confirms the account and region, starts a Terraform deployment session, streams logs to the browser, records deployment status, and may expose outputs such as instance IPs and a downloadable PEM key. Deployment can create real AWS resources, so users should inspect the Terraform preview and region before running it.",
    source: "Simulation deployment controller and documentation",
    keywords: [
      "deploy simulation",
      "terraform deploy",
      "credentials",
      "pem",
      "logs",
      "account",
      "region",
    ],
  },
  {
    id: "PRODUCT-SIMULATION-HISTORY",
    topic: "simulation",
    title: "Simulation history and cleanup",
    content:
      "Simulation History lists saved canvases and deployment records with status, region, deployment count, created time, and updated time. Deleting a saved simulation removes the saved draft only. To clean up AWS resources created by an active deployment, users must choose the active deployment and run Destroy Selected Deployment with valid AWS credentials.",
    source: "CloudWatcher docs: Simulation Deployments",
    keywords: [
      "simulation history",
      "delete simulation",
      "destroy deployment",
      "cleanup",
      "active deployment",
    ],
  },
  {
    id: "PRODUCT-SIMULATION-SESSION-API",
    topic: "simulation",
    title: "Simulation session API",
    content:
      "The backend exposes POST /api/simulation/session to create a temporary simulation session, GET /api/simulation/session/:id for status, GET /api/simulation/session/:id/stream for server-sent progress updates, and POST /api/simulation/session/:id/terminate to stop a running session. Persistent simulations use /api/simulations for create, list, update, detail, destroy, delete, and PEM download operations.",
    source: "Backend routes: simulation APIs",
    keywords: [
      "simulation api",
      "session",
      "stream",
      "sse",
      "terminate",
      "api/simulations",
      "pem",
    ],
  },
  {
    id: "PRODUCT-LIVE-INFRASTRUCTURE",
    topic: "live_infrastructure",
    title: "Live Infrastructure canvases",
    content:
      "Live Infrastructure is for existing AWS resources rather than planned simulations. It syncs real AWS inventory for the selected region, groups resources by service, opens service-specific canvases, shows resource nodes and details, and can run supported live actions. Live actions affect real AWS resources.",
    source: "CloudWatcher docs: Live Infrastructure",
    keywords: [
      "live infrastructure",
      "live canvas",
      "sync inventory",
      "existing resources",
      "real aws",
    ],
  },
  {
    id: "PRODUCT-AI-OBSERVABILITY-OVERVIEW",
    topic: "ai_observability",
    title: "AI Observability overview",
    content:
      "AI Observability tracks AI application requests, providers, models, tokens, cost, latency, reliability, status, service names, endpoints, environments, errors, traces, and spans. It supports Bedrock, OpenAI, Anthropic, Gemini, custom endpoints, and self-hosted providers when events or traces include provider and model metadata.",
    source: "CloudWatcher docs: AI Observability",
    keywords: [
      "ai observability",
      "llm",
      "models",
      "tokens",
      "latency",
      "cost",
      "providers",
      "traces",
    ],
  },
  {
    id: "PRODUCT-AI-OBSERVABILITY-INGESTION",
    topic: "ai_observability",
    title: "AI Observability ingestion",
    content:
      "Users create ingest keys in Settings > AI Observability. Applications send telemetry to POST /api/ai-observability/events, /events/batch, /traces, or /traces/batch. Event ingestion stores request-level data, while trace ingestion stores a trace with child spans such as chain, tool, llm, embedding, reranker, or custom spans.",
    source: "AI Observability ingest controllers and trace service",
    keywords: [
      "ingest key",
      "events",
      "events batch",
      "traces",
      "spans",
      "sdk",
      "settings ai observability",
    ],
  },
  {
    id: "PRODUCT-AI-OBSERVABILITY-PAGES",
    topic: "ai_observability",
    title: "AI Observability pages",
    content:
      "The AI Observability UI includes Overview, Trace Explorer, Models, Cost, Errors, Alerts, Routing Recommendations, Prompt Insights, request detail pages, and Bedrock console metrics. Filters commonly include range, provider, environment, service, endpoint, region, and model.",
    source: "Frontend AI Observability routes and navigation",
    keywords: [
      "trace explorer",
      "models",
      "cost",
      "errors",
      "alerts",
      "routing",
      "prompt insights",
      "digest",
      "bedrock console",
    ],
  },
  {
    id: "PRODUCT-AI-OBSERVABILITY-ANALYTICS",
    topic: "ai_observability",
    title: "AI Observability analytics",
    content:
      "The backend aggregates AI daily metrics and request logs to provide overview totals, token trends, cost trends, provider breakdowns, model performance, recent errors, forecasts, anomalies, summaries, routing recommendations, and prompt insights.",
    source: "AI Observability analytics services",
    keywords: [
      "analytics",
      "token trends",
      "cost trends",
      "model performance",
      "forecast",
      "anomalies",
    ],
  },
  {
    id: "PRODUCT-AI-OBSERVABILITY-BEDROCK",
    topic: "ai_observability",
    title: "Bedrock observability",
    content:
      "When AWS credentials include AI Observability or Bedrock permissions, CloudWatcher can sync Bedrock CloudWatch metrics and show Bedrock console panels for invocation volume, latency, time to first token, errors, throttles, auth mode context, model IDs, and regions. Users can trigger sync through POST /api/ai-observability/bedrock/sync.",
    source: "Bedrock metrics service and AI Observability controller",
    keywords: [
      "bedrock",
      "cloudwatch",
      "sync",
      "time to first token",
      "ttft",
      "invocation",
      "throttles",
    ],
  },
  {
    id: "PRODUCT-AI-OBSERVABILITY-BUDGETS",
    topic: "ai_observability",
    title: "AI budgets and alerts",
    content:
      "AI Observability supports budget rules, budget enforcement, alerts, manual alert evaluation, alert acknowledgement, and alert resolution. Alerts can be evaluated through POST /api/ai-observability/alerts/evaluate, and budgets are managed through /api/ai-observability/budget.",
    source: "AI Observability alert and budget controllers",
    keywords: [
      "budget",
      "alerts",
      "acknowledge",
      "resolve",
      "evaluate",
      "threshold",
    ],
  },
  {
    id: "PRODUCT-AI-OBSERVABILITY-TROUBLESHOOTING",
    topic: "troubleshooting",
    title: "AI Observability troubleshooting",
    content:
      "If AI Observability is empty, create an ingest key, confirm the app is using the RabbittWatch ingest key rather than a provider API key, check endpoint and environment values, send a test trace, open Trace Explorer, and clear filters if the trace used a different environment or provider.",
    source: "CloudWatcher docs: Troubleshooting",
    keywords: [
      "ai observability empty",
      "missing traces",
      "ingest key",
      "filters",
      "test trace",
      "troubleshooting",
    ],
  },
  {
    id: "PRODUCT-SIMULATION-TROUBLESHOOTING",
    topic: "troubleshooting",
    title: "Simulation troubleshooting",
    content:
      "If simulation deployment fails, open Terraform preview and fix validation errors, confirm the AWS account ID after credential validation, use the correct region and session token when needed, read live Terraform logs for permission, quota, naming, or provider errors, and retry only after changing the failed configuration or credentials.",
    source: "CloudWatcher docs: Troubleshooting",
    keywords: [
      "simulation fails",
      "terraform error",
      "validation",
      "credentials",
      "quota",
      "provider error",
    ],
  },
  {
    id: "PRODUCT-ACTIONS-SAFETY",
    topic: "actions",
    title: "Action safety",
    content:
      "Monitoring pages are visibility-only. Simulation deployment and Live Infrastructure actions can create, stop, start, terminate, delete, or destroy AWS resources depending on the workflow. Users should verify account, region, resource name, status, and Terraform preview before destructive operations.",
    source: "CloudWatcher safety documentation",
    keywords: [
      "actions",
      "safety",
      "delete",
      "terminate",
      "destroy",
      "destructive",
      "real resources",
    ],
  },
];

export function selectProductKnowledge(
  message: string,
  services: string[],
  limit = 10,
): ProductKnowledgeItem[] {
  const query = `${message} ${services.join(" ")}`.toLowerCase();
  const tokens = new Set(
    query.split(/[^a-z0-9_-]+/).filter((token) => token.length > 2),
  );

  return PRODUCT_KNOWLEDGE_BASE.map((item) => {
    let score = 0;
    const haystack =
      `${item.topic} ${item.title} ${item.content} ${item.keywords.join(" ")}`.toLowerCase();

    if (query.includes(item.topic.replace("_", " "))) score += 8;
    if (services.includes(item.topic)) score += 8;
    if (services.includes("simulation") && item.topic === "simulation")
      score += 8;
    if (
      services.includes("ai_observability") &&
      item.topic === "ai_observability"
    )
      score += 8;
    if (
      services.includes("live_infrastructure") &&
      item.topic === "live_infrastructure"
    )
      score += 8;
    for (const keyword of item.keywords) {
      if (query.includes(keyword.toLowerCase())) score += 5;
    }
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }

    return { item, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
