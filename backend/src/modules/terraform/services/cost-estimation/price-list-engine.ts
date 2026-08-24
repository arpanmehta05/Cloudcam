import { CostNodeInput, CostEstimationRequest, CostEstimationResult, CostWarning, CostBreakdown } from "./types";
import { formatServiceName } from "./helpers";

// ─── AWS Price List API Engine ───────────────────────────────────

// Note: AWS Price List API has no dedicated npm client.
// We use the fallback prices as the primary engine with a "price-list" label.
// For production, integrate Infracost or use the official AWS Pricing API.

// Rough public on-demand us-east-1 USD benchmarks — overridden when Infracost runs.
function fallbackBreakdownForNode(node: CostNodeInput): CostBreakdown | null {
  const cfg = node.config || {};

  switch (node.serviceId) {
    case "ec2": {
      const count = Math.max(1, Math.min(100, Number(cfg.count) || 1));
      const hourly = 0.0104; // t3.micro class default
      const compute = hourly * 730 * count;
      const storagePerVm = 8 * 0.1;
      const xferPerVm = 0.9;
      const components: CostBreakdown["components"] = [
        {
          name: "Compute (t3.micro-class × hrs/mo)",
          unit: "per instance-month",
          quantity: count,
          unitPrice: hourly * 730,
          monthlyCost: compute,
        },
        {
          name: "EBS gp2 (8 GB est. per instance)",
          unit: "per GB-month",
          quantity: 8 * count,
          unitPrice: 0.1,
          monthlyCost: storagePerVm * count,
        },
        {
          name: "Data transfer (rough)",
          unit: "per GB",
          quantity: 10 * count,
          unitPrice: 0.09,
          monthlyCost: xferPerVm * count,
        },
      ];
      const monthlyCost = components.reduce((s, c) => s + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost,
        components,
        supported: false,
      };
    }
    case "s3": {
      const storageGb = 50;
      const stdPerGb = 0.023;
      const storageCost = storageGb * stdPerGb;
      const reqCost = 0.05;
      const components: CostBreakdown["components"] = [
        {
          name: "S3 Standard storage",
          unit: "per GB-month",
          quantity: storageGb,
          unitPrice: stdPerGb,
          monthlyCost: storageCost,
        },
        {
          name: "Requests (PUT/GET est.)",
          unit: "blend",
          quantity: 1,
          unitPrice: reqCost,
          monthlyCost: reqCost,
        },
      ];
      const monthlyCost = components.reduce((s, c) => s + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost,
        components,
        supported: false,
      };
    }
    case "rds": {
      const storageGb = Math.max(20, Math.min(16384, Number(cfg.storageGb) || 50));
      const hourly = 0.017; // db.t3.micro-class
      const compute = hourly * 730;
      const storage = storageGb * 0.115;
      const azFactor = cfg.multiAz === true ? 2 : 1;
      const components: CostBreakdown["components"] = [
        {
          name: `Instance (db.t3.micro-class est.)${azFactor > 1 ? " · Multi-AZ ×2" : ""}`,
          unit: "per hour × 730",
          quantity: 730,
          unitPrice: hourly,
          monthlyCost: compute * azFactor,
        },
        {
          name: "Storage (gp2-class est.)",
          unit: "per GB-month",
          quantity: storageGb,
          unitPrice: 0.115,
          monthlyCost: storage,
        },
      ];
      const monthlyCost = components.reduce((s, c) => s + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost,
        components,
        supported: false,
      };
    }
    case "lambda": {
      const memMb = Math.max(128, Math.min(10240, Number(cfg.memoryMb) || 256));
      const timeoutSec = Math.max(1, Math.min(900, Number(cfg.timeoutSec) || 30));
      const requestsPerMo = 2_000_000;
      const billableRequestsMillions = Math.max(0, (requestsPerMo - 1_000_000) / 1_000_000);
      const reqCost = billableRequestsMillions * 0.2;
      const avgDurSec = 0.2; // Assume a realistic average duration of 200ms (0.2s) for generic web APIs
      const gbSec = (memMb / 1024) * avgDurSec * requestsPerMo;
      const computePricePerGbSec = 0.0000166667;
      const computeCost = gbSec * computePricePerGbSec;
      const components: CostBreakdown["components"] = [
        {
          name: "Requests (2M/mo est., 1M free tier)",
          unit: "per 1M beyond free",
          quantity: billableRequestsMillions,
          unitPrice: 0.2,
          monthlyCost: reqCost,
        },
        {
          name: `Compute (${memMb} MB × ~${avgDurSec}s avg × ${(requestsPerMo / 1e6).toFixed(1)}M inv.)`,
          unit: "GB-second",
          quantity: Math.round(gbSec),
          unitPrice: computePricePerGbSec,
          monthlyCost: computeCost,
        },
      ];
      const monthlyCost = components.reduce((s, c) => s + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost,
        components,
        supported: false,
      };
    }
    case "azure_vm": {
      const size = (cfg.vmSize as string) || "Standard_B1s";
      const hourly = size === "Standard_B1s" ? 0.0104 : 0.025; // Estimate B1s vs other Standard VMs
      const compute = hourly * 730;
      const storageCost = 1.60; // Standard SSD LRS 32GB disk estimate
      const components: CostBreakdown["components"] = [
        {
          name: `Compute (${size} VM size)`,
          unit: "hour × 730",
          quantity: 730,
          unitPrice: hourly,
          monthlyCost: compute,
        },
        {
          name: "OS Disk (Standard SSD LRS 32 GB)",
          unit: "month",
          quantity: 1,
          unitPrice: storageCost,
          monthlyCost: storageCost,
        },
      ];
      const monthlyCost = components.reduce((s, c) => s + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost,
        components,
        supported: false,
      };
    }
    case "azure_storage": {
      const storageGb = 50;
      const stdPerGb = 0.018; // Hot LRS block blob
      const storageCost = storageGb * stdPerGb;
      const transCost = 0.10;
      const components: CostBreakdown["components"] = [
        {
          name: "Storage Account (Hot LRS)",
          unit: "GB-month",
          quantity: storageGb,
          unitPrice: stdPerGb,
          monthlyCost: storageCost,
        },
        {
          name: "Write & read operations (est.)",
          unit: "blend",
          quantity: 1,
          unitPrice: transCost,
          monthlyCost: transCost,
        },
      ];
      const monthlyCost = components.reduce((s, c) => s + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost,
        components,
        supported: false,
      };
    }
    case "azure_sql": {
      const sku = (cfg.skuName as string) || "Basic";
      const dbCost = sku === "Basic" ? 4.90 : 15.00;
      const components: CostBreakdown["components"] = [
        {
          name: `Azure SQL Database (${sku} SKU)`,
          unit: "month",
          quantity: 1,
          unitPrice: dbCost,
          monthlyCost: dbCost,
        },
      ];
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: dbCost,
        components,
        supported: false,
      };
    }
    case "azure_function": {
      const memMb = 512;
      const requestsPerMo = 2_000_000;
      const billableRequestsMillions = Math.max(0, (requestsPerMo - 1_000_000) / 1_000_000);
      const reqCost = billableRequestsMillions * 0.20;
      const gbSec = (memMb / 1024) * 1.0 * requestsPerMo; // 1s avg duration
      const billableGbSec = Math.max(0, gbSec - 400_000);
      const computePricePerGbSec = 0.000016;
      const computeCost = billableGbSec * computePricePerGbSec;
      const components: CostBreakdown["components"] = [
        {
          name: "Requests (2M/mo est., 1M free)",
          unit: "per 1M beyond free",
          quantity: billableRequestsMillions,
          unitPrice: 0.20,
          monthlyCost: reqCost,
        },
        {
          name: "Execution compute (GB-seconds beyond free)",
          unit: "GB-second",
          quantity: Math.round(billableGbSec),
          unitPrice: computePricePerGbSec,
          monthlyCost: computeCost,
        },
      ];
      const monthlyCost = components.reduce((s, c) => s + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost,
        components,
        supported: false,
      };
    }
    case "azure_vnet": {
      const components: CostBreakdown["components"] = [
        {
          name: "Virtual Network",
          unit: "free",
          quantity: 1,
          unitPrice: 0,
          monthlyCost: 0,
        },
      ];
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: 0,
        components,
        supported: false,
      };
    }
    case "gcp_compute": {
      const hourly = 0.0084;
      const diskGb = Math.max(10, Math.min(65536, Number(cfg.bootDiskGb) || 20));
      const components: CostBreakdown["components"] = [
        { name: "Compute Engine (e2-micro-class)", unit: "hour x 730", quantity: 730, unitPrice: hourly, monthlyCost: hourly * 730 },
        { name: "Persistent Disk balanced", unit: "GB-month", quantity: diskGb, unitPrice: 0.10, monthlyCost: diskGb * 0.10 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: components.reduce((s, c) => s + c.monthlyCost, 0), components, supported: false };
    }
    case "gcp_storage": {
      const components: CostBreakdown["components"] = [
        { name: "Cloud Storage Standard", unit: "GB-month", quantity: 50, unitPrice: 0.020, monthlyCost: 1.0 },
        { name: "Operations estimate", unit: "blend", quantity: 1, unitPrice: 0.05, monthlyCost: 0.05 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 1.05, components, supported: false };
    }
    case "gcp_sql": {
      const components: CostBreakdown["components"] = [
        { name: "Cloud SQL shared-core instance", unit: "month", quantity: 1, unitPrice: 7.67, monthlyCost: 7.67 },
        { name: "SSD storage estimate", unit: "GB-month", quantity: 10, unitPrice: 0.17, monthlyCost: 1.7 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 9.37, components, supported: false };
    }
    case "gcp_function": {
      const components: CostBreakdown["components"] = [
        { name: "Cloud Run functions requests", unit: "2M requests estimate", quantity: 1, unitPrice: 0.40, monthlyCost: 0.40 },
        { name: "Execution compute estimate", unit: "month", quantity: 1, unitPrice: 1.25, monthlyCost: 1.25 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 1.65, components, supported: false };
    }
    case "gcp_gke": {
      const nodeCount = Math.max(1, Math.min(10, Number(cfg.nodeCount) || 1));
      const components: CostBreakdown["components"] = [
        { name: "GKE cluster management fee", unit: "hour x 730", quantity: 730, unitPrice: 0.10, monthlyCost: 73 },
        { name: "Worker nodes (e2-small-class)", unit: "node-month", quantity: nodeCount, unitPrice: 12.41, monthlyCost: nodeCount * 12.41 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: components.reduce((s, c) => s + c.monthlyCost, 0), components, supported: false };
    }
    case "elb": {
      const components: CostBreakdown["components"] = [
        { name: "ALB Hourly usage (base)", unit: "hour x 730", quantity: 730, unitPrice: 0.0225, monthlyCost: 16.425 },
        { name: "LCU consumption fee (avg)", unit: "LCU-month", quantity: 1, unitPrice: 5.00, monthlyCost: 5.00 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 21.43, components, supported: true };
    }
    case "azure_lb": {
      const components: CostBreakdown["components"] = [
        { name: "Azure Load Balancer usage", unit: "hour x 730", quantity: 730, unitPrice: 0.025, monthlyCost: 18.25 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 18.25, components, supported: true };
    }
    case "gcp_lb": {
      const components: CostBreakdown["components"] = [
        { name: "Cloud Load Balancing rule charge", unit: "forwarding-rule", quantity: 1, unitPrice: 18.25, monthlyCost: 18.25 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 18.25, components, supported: true };
    }
    case "asg": {
      const hourly = 0.0116; // t3.micro
      const capacity = Math.max(0, Number(cfg.desiredCapacity ?? cfg.minSize) || 1);
      const components: CostBreakdown["components"] = [
        { name: "EC2 instances (t3.micro-class)", unit: "hour x 730", quantity: 730 * capacity, unitPrice: hourly, monthlyCost: hourly * 730 * capacity },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: components.reduce((s, c) => s + c.monthlyCost, 0), components, supported: false };
    }
    case "azure_vmss": {
      const hourly = 0.0104; // Standard_B1s
      const capacity = Math.max(0, Number(cfg.desiredCapacity ?? cfg.minSize) || 1);
      const components: CostBreakdown["components"] = [
        { name: "VM instances (Standard_B1s-class)", unit: "hour x 730", quantity: 730 * capacity, unitPrice: hourly, monthlyCost: hourly * 730 * capacity },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: components.reduce((s, c) => s + c.monthlyCost, 0), components, supported: false };
    }
    case "gcp_mig": {
      const hourly = 0.0084; // e2-micro
      const capacity = Math.max(0, Number(cfg.desiredCapacity ?? cfg.minSize) || 1);
      const components: CostBreakdown["components"] = [
        { name: "Compute Engine instances (e2-micro-class)", unit: "hour x 730", quantity: 730 * capacity, unitPrice: hourly, monthlyCost: hourly * 730 * capacity },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: components.reduce((s, c) => s + c.monthlyCost, 0), components, supported: false };
    }
    case "dockerhub": {
      const components: CostBreakdown["components"] = [
        { name: "Docker Hub Registry usage (Public)", unit: "free", quantity: 1, unitPrice: 0, monthlyCost: 0 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 0, components, supported: true };
    }
    case "sg":
    case "azure_nsg":
    case "gcp_firewall": {
      const components: CostBreakdown["components"] = [
        { name: `${formatServiceName(node.serviceId)} rules usage`, unit: "free", quantity: 1, unitPrice: 0, monthlyCost: 0 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 0, components, supported: true };
    }
    case "eip":
    case "azure_pip":
    case "gcp_ip": {
      const components: CostBreakdown["components"] = [
        { name: "Static public IP address (attached)", unit: "free", quantity: 1, unitPrice: 0, monthlyCost: 0 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 0, components, supported: true };
    }
    case "ebs": {
      const size = Math.max(1, Number(cfg.sizeGb) || 20);
      const unitPrice = 0.08; // gp3 price per GB-month
      const cost = size * unitPrice;
      const components: CostBreakdown["components"] = [
        { name: "EBS volume storage (gp3)", unit: "GB-month", quantity: size, unitPrice, monthlyCost: cost },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: cost, components, supported: true };
    }
    case "azure_disk": {
      const size = Math.max(1, Number(cfg.sizeGb) || 32);
      const unitPrice = 0.08; // standard SSD price per GB-month
      const cost = size * unitPrice;
      const components: CostBreakdown["components"] = [
        { name: "Managed Disk storage", unit: "GB-month", quantity: size, unitPrice, monthlyCost: cost },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: cost, components, supported: true };
    }
    case "gcp_disk": {
      const size = Math.max(10, Number(cfg.sizeGb) || 30);
      const unitPrice = 0.10; // balanced PD price per GB-month
      const cost = size * unitPrice;
      const components: CostBreakdown["components"] = [
        { name: "Compute Engine persistent disk", unit: "GB-month", quantity: size, unitPrice, monthlyCost: cost },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: cost, components, supported: true };
    }
    case "tg":
    case "azure_tg":
    case "gcp_tg": {
      const components: CostBreakdown["components"] = [
        { name: "Target Group / Backend Pool routing", unit: "free", quantity: 1, unitPrice: 0, monthlyCost: 0 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 0, components, supported: true };
    }
    case "apigateway": {
      const components: CostBreakdown["components"] = [
        { name: "API Gateway HTTP API requests", unit: "1M requests", quantity: 1, unitPrice: 1.00, monthlyCost: 1.00 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 1.00, components, supported: true };
    }
    case "ecr": {
      const components: CostBreakdown["components"] = [
        { name: "ECR image storage estimate (10 GB)", unit: "month", quantity: 1, unitPrice: 1.00, monthlyCost: 1.00 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 1.00, components, supported: true };
    }
    case "azure_acr": {
      const components: CostBreakdown["components"] = [
        { name: "Azure Container Registry (Basic SKU)", unit: "month", quantity: 1, unitPrice: 5.00, monthlyCost: 5.00 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 5.00, components, supported: true };
    }
    case "gcp_artifact_registry": {
      const components: CostBreakdown["components"] = [
        { name: "Artifact Registry storage estimate (10 GB)", unit: "month", quantity: 1, unitPrice: 1.00, monthlyCost: 1.00 },
      ];
      return { service: node.serviceId, serviceName: formatServiceName(node.serviceId), monthlyCost: 1.00, components, supported: true };
    }
    case "ecs": {
      const launchType = cfg.launchType || "FARGATE";
      const desiredCount = Math.max(1, Math.min(10, Number(cfg.desiredCount) || 1));
      
      if (launchType === "EC2") {
        const components: CostBreakdown["components"] = [
          {
            name: "ECS Compute (launchType = EC2)",
            unit: "tasks",
            quantity: desiredCount,
            unitPrice: 0,
            monthlyCost: 0,
          },
        ];
        return {
          service: node.serviceId,
          serviceName: formatServiceName(node.serviceId),
          monthlyCost: 0,
          components,
          supported: true,
        };
      }

      // FARGATE
      const cpu = Number(cfg.cpu) || 256;
      const memory = Number(cfg.memory) || 512;
      const cpuVcpu = cpu / 1024;
      const memoryGb = memory / 1024;
      const useFargateSpot = cfg.useFargateSpot === true;

      const stdCpuPrice = 0.04048;
      const stdMemPrice = 0.004445;
      const spotCpuPrice = 0.012144;
      const spotMemPrice = 0.0013335;

      let components: CostBreakdown["components"] = [];

      if (useFargateSpot) {
        const spotWeight = Number(cfg.fargateSpotWeight || 1);
        const totalWeight = 1 + spotWeight;
        const stdRatio = 1 / totalWeight;
        const spotRatio = spotWeight / totalWeight;

        const stdCpuCost = (desiredCount * stdRatio) * (cpuVcpu * stdCpuPrice * 730);
        const spotCpuCost = (desiredCount * spotRatio) * (cpuVcpu * spotCpuPrice * 730);
        const stdMemCost = (desiredCount * stdRatio) * (memoryGb * stdMemPrice * 730);
        const spotMemCost = (desiredCount * spotRatio) * (memoryGb * spotMemPrice * 730);

        components = [
          {
            name: "Fargate Standard vCPU",
            unit: "vCPU-month",
            quantity: Number((desiredCount * stdRatio * cpuVcpu).toFixed(2)),
            unitPrice: stdCpuPrice * 730,
            monthlyCost: Number(stdCpuCost.toFixed(2)),
          },
          {
            name: "Fargate Spot vCPU",
            unit: "vCPU-month",
            quantity: Number((desiredCount * spotRatio * cpuVcpu).toFixed(2)),
            unitPrice: spotCpuPrice * 730,
            monthlyCost: Number(spotCpuCost.toFixed(2)),
          },
          {
            name: "Fargate Standard Memory",
            unit: "GB-month",
            quantity: Number((desiredCount * stdRatio * memoryGb).toFixed(2)),
            unitPrice: stdMemPrice * 730,
            monthlyCost: Number(stdMemCost.toFixed(2)),
          },
          {
            name: "Fargate Spot Memory",
            unit: "GB-month",
            quantity: Number((desiredCount * spotRatio * memoryGb).toFixed(2)),
            unitPrice: spotMemPrice * 730,
            monthlyCost: Number(spotMemCost.toFixed(2)),
          },
        ];
      } else {
        const cpuCost = desiredCount * (cpuVcpu * stdCpuPrice * 730);
        const memCost = desiredCount * (memoryGb * stdMemPrice * 730);

        components = [
          {
            name: "Fargate vCPU",
            unit: "vCPU-month",
            quantity: Number((desiredCount * cpuVcpu).toFixed(2)),
            unitPrice: stdCpuPrice * 730,
            monthlyCost: Number(cpuCost.toFixed(2)),
          },
          {
            name: "Fargate Memory",
            unit: "GB-month",
            quantity: Number((desiredCount * memoryGb).toFixed(2)),
            unitPrice: stdMemPrice * 730,
            monthlyCost: Number(memCost.toFixed(2)),
          },
        ];
      }

      const monthlyCost = components.reduce((sum, c) => sum + c.monthlyCost, 0);

      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: Number(monthlyCost.toFixed(2)),
        components,
        supported: true,
      };
    }
    case "cloudfront": {
      const dataEgressGb = 100;
      const egressPrice = 0.085;
      const requestPricePerTenK = 0.0075;
      const requestCount = 1_000_000;
      const requestCost = (requestCount / 10000) * requestPricePerTenK;
      const egressCost = dataEgressGb * egressPrice;
      const components: CostBreakdown["components"] = [
        {
          name: "Data Transfer Out to Internet",
          unit: "per GB-month",
          quantity: dataEgressGb,
          unitPrice: egressPrice,
          monthlyCost: egressCost,
        },
        {
          name: "HTTPS Requests",
          unit: "per 10k requests",
          quantity: requestCount / 10000,
          unitPrice: requestPricePerTenK,
          monthlyCost: requestCost,
        },
      ];
      const monthlyCost = components.reduce((sum, c) => sum + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: Number(monthlyCost.toFixed(2)),
        components,
        supported: false,
      };
    }
    case "azure_cdn": {
      const dataEgressGb = 100;
      const egressPrice = 0.081;
      const baseFee = 10.0;
      const egressCost = dataEgressGb * egressPrice;
      const components: CostBreakdown["components"] = [
        {
          name: "Base CDN Profile Fee",
          unit: "month",
          quantity: 1,
          unitPrice: baseFee,
          monthlyCost: baseFee,
        },
        {
          name: "Data Egress to Internet",
          unit: "per GB-month",
          quantity: dataEgressGb,
          unitPrice: egressPrice,
          monthlyCost: egressCost,
        },
      ];
      const monthlyCost = components.reduce((sum, c) => sum + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: Number(monthlyCost.toFixed(2)),
        components,
        supported: false,
      };
    }
    case "gcp_cdn": {
      const dataEgressGb = 100;
      const egressPrice = 0.08;
      const cacheFillGb = 10;
      const cacheFillPrice = 0.04;
      const egressCost = dataEgressGb * egressPrice;
      const cacheFillCost = cacheFillGb * cacheFillPrice;
      const components: CostBreakdown["components"] = [
        {
          name: "CDN Cache Outflow",
          unit: "per GB-month",
          quantity: dataEgressGb,
          unitPrice: egressPrice,
          monthlyCost: egressCost,
        },
        {
          name: "Cache Fill Data Transfer",
          unit: "per GB-month",
          quantity: cacheFillGb,
          unitPrice: cacheFillPrice,
          monthlyCost: cacheFillCost,
        },
      ];
      const monthlyCost = components.reduce((sum, c) => sum + c.monthlyCost, 0);
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: Number(monthlyCost.toFixed(2)),
        components,
        supported: false,
      };
    }
    default:
      return null;
  }
}

export async function estimateWithPriceList(
  request: CostEstimationRequest,
): Promise<CostEstimationResult> {
  const warnings: CostWarning[] = [];
  const breakdown: CostBreakdown[] = [];

  for (const node of request.nodes) {
    const fb = fallbackBreakdownForNode(node);
    if (fb) {
      breakdown.push(fb);
      warnings.push({
        code: "ESTIMATED_PRICE",
        message: `Ballpark ${request.region} estimate for ${formatServiceName(node.serviceId)}; add Infracost API key for live Terraform pricing.`,
        node: node.id,
        severity: "info",
      });
    } else {
      breakdown.push({
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: 0,
        components: [],
        supported: false,
      });
      warnings.push({
        code: "UNSUPPORTED_SERVICE",
        message: `No pricing data available for ${formatServiceName(node.serviceId)}`,
        node: node.id,
        severity: "error",
      });
    }
  }

  const totalMonthlyCost = breakdown.reduce((sum, b) => sum + b.monthlyCost, 0);

  return {
    totalMonthlyCost,
    currency: "USD",
    engine: "price-list",
    breakdown,
    warnings,
    cached: false,
    estimatedAt: new Date().toISOString(),
  };
}