import { getClientConfig, DEFAULT_REGION } from "./client-factory";
import { ResourceInventory } from "../models/aws.model";
import { getEnabledDiscoveryRegions } from "./resources.provider";

import {
  discoverEc2,
  discoverLambda,
  discoverEcs,
  discoverEKS,
  discoverAutoScaling,
  discoverAmplify,
} from "./compute.provider";
import {
  discoverRds,
  discoverDynamoDB,
  discoverElastiCache,
  discoverRedshift,
} from "./database.provider";
import {
  discoverS3,
  discoverEBS,
  discoverEFS,
} from "./storage.provider";
import {
  discoverALB,
  discoverCloudFront,
  discoverElasticIps,
  discoverSecurityGroups,
  discoverTargetGroups,
  discoverWAF,
  discoverAPIGateway,
} from "./network.provider";
import {
  discoverSQS,
  discoverSNS,
  discoverKinesis,
  discoverStepFunctions,
  discoverEventBridge,
  discoverEcr,
} from "./integration.provider";

export interface RegionDiscovery {
  region: string;
  ec2: any[];
  lambda: any[];
  rds: any[];
  ecs: any[];
  amplify: any[];
  dynamodb: any[];
  sqs: any[];
  alb: any[];
  ebs: any[];
  eks: any[];
  autoscaling: any[];
  elasticache: any[];
  redshift: any[];
  efs: any[];
  kinesis: any[];
  sns: any[];
  eventbridge: any[];
  stepfunctions: any[];
  waf: any[];
  apigateway: any[];
  eip: any[];
  sg: any[];
  tg: any[];
  ecr: any[];
}

export async function discoverRegion(
  workspaceId: string,
  region: string,
  roleArn?: string,
  externalId?: string,
  fullScan: boolean = false,
): Promise<RegionDiscovery> {
  const cfg = await getClientConfig(workspaceId, region, roleArn, externalId);
  const data: RegionDiscovery = {
    region,
    ec2: [],
    lambda: [],
    rds: [],
    ecs: [],
    amplify: [],
    dynamodb: [],
    sqs: [],
    alb: [],
    ebs: [],
    eks: [],
    autoscaling: [],
    elasticache: [],
    redshift: [],
    efs: [],
    kinesis: [],
    sns: [],
    eventbridge: [],
    stepfunctions: [],
    waf: [],
    apigateway: [],
    eip: [],
    sg: [],
    tg: [],
    ecr: [],
  };

  const core = await Promise.allSettled([
    discoverEc2(cfg, region),
    discoverLambda(cfg, region),
    discoverRds(cfg, region),
    discoverEcs(cfg, region),
    discoverAmplify(cfg, region),
    discoverDynamoDB(cfg, region),
    discoverSQS(cfg, region),
    discoverALB(cfg, region),
    discoverElasticIps(cfg, region),
    discoverSecurityGroups(cfg, region),
    discoverTargetGroups(cfg, region),
    discoverEcr(cfg, region),
    discoverAPIGateway(cfg, region),
  ]);
  if (core[0].status === "fulfilled") data.ec2 = (core[0] as any).value;
  if (core[1].status === "fulfilled") data.lambda = (core[1] as any).value;
  if (core[2].status === "fulfilled") data.rds = (core[2] as any).value;
  if (core[3].status === "fulfilled") data.ecs = (core[3] as any).value;
  if (core[4].status === "fulfilled") data.amplify = (core[4] as any).value;
  if (core[5].status === "fulfilled") data.dynamodb = (core[5] as any).value;
  if (core[6].status === "fulfilled") data.sqs = (core[6] as any).value;
  if (core[7].status === "fulfilled") data.alb = (core[7] as any).value;
  if (core[8].status === "fulfilled") data.eip = (core[8] as any).value;
  if (core[9].status === "fulfilled") data.sg = (core[9] as any).value;
  if (core[10].status === "fulfilled") data.tg = (core[10] as any).value;
  if (core[11].status === "fulfilled") data.ecr = (core[11] as any).value;
  if (core[12].status === "fulfilled") {
    data.apigateway = (core[12] as any).value;
  }

  if (fullScan) {
    const ext = await Promise.allSettled([
      discoverEBS(cfg, region),
      discoverEKS(cfg, region),
      discoverAutoScaling(cfg, region),
      discoverElastiCache(cfg, region),
      discoverRedshift(cfg, region),
      discoverEFS(cfg, region),
      discoverKinesis(cfg, region),
      discoverSNS(cfg, region),
      discoverEventBridge(cfg, region),
      discoverStepFunctions(cfg, region),
      discoverWAF(cfg, region),
    ]);
    if (ext[0].status === "fulfilled") data.ebs = (ext[0] as any).value;
    if (ext[1].status === "fulfilled") data.eks = (ext[1] as any).value;
    if (ext[2].status === "fulfilled") data.autoscaling = (ext[2] as any).value;
    if (ext[3].status === "fulfilled") data.elasticache = (ext[3] as any).value;
    if (ext[4].status === "fulfilled") data.redshift = (ext[4] as any).value;
    if (ext[5].status === "fulfilled") data.efs = (ext[5] as any).value;
    if (ext[6].status === "fulfilled") data.kinesis = (ext[6] as any).value;
    if (ext[7].status === "fulfilled") data.sns = (ext[7] as any).value;
    if (ext[8].status === "fulfilled") data.eventbridge = (ext[8] as any).value;
    if (ext[9].status === "fulfilled") data.stepfunctions = (ext[9] as any).value;
    if (ext[10].status === "fulfilled") data.waf = (ext[10] as any).value;
  }

  return data;
}

export async function executeResourceInventory(
  workspaceId: string,
  region: string = DEFAULT_REGION,
  roleArn?: string,
  externalId?: string,
): Promise<ResourceInventory> {
  const enabledRegions = await getEnabledDiscoveryRegions(
    workspaceId,
    roleArn,
    externalId,
  );

  const inventory: ResourceInventory = {
    ec2: [],
    lambda: [],
    rds: [],
    s3: [],
    ecs: [],
    amplify: [],
    dynamodb: [],
    sqs: [],
    alb: [],
    alerts: [],
    ebs: [],
    eks: [],
    autoscaling: [],
    elasticache: [],
    redshift: [],
    cloudfront: [],
    efs: [],
    kinesis: [],
    sns: [],
    eventbridge: [],
    stepfunctions: [],
    waf: [],
    apigateway: [],
    eip: [],
    sg: [],
    tg: [],
    ecr: [],
    counts: { total: 0 },
  };

  try {
    const s3Config = await getClientConfig(
      workspaceId,
      DEFAULT_REGION,
      roleArn,
      externalId,
    );
    const s3Buckets = await discoverS3(s3Config);
    const filterByRegion = !!(region && region !== "all");
    if (filterByRegion) {
      inventory.s3 = s3Buckets.filter((b) => b.region === region);
    } else {
      inventory.s3 = s3Buckets;
    }
  } catch (e: any) {
    console.warn("[Resources] S3 error:", e.message);
  }

  try {
    const cfConfig = await getClientConfig(
      workspaceId,
      "us-east-1",
      roleArn,
      externalId,
    );
    const cfItems = await discoverCloudFront(cfConfig);
    inventory.cloudfront.push(...cfItems);
  } catch (e: any) {
    console.warn("[Resources] CloudFront error:", e.message);
  }

  const singleRegion = !!(region && region !== "all");
  const regionsToScan = singleRegion
    ? enabledRegions.includes(region)
      ? [region]
      : []
    : enabledRegions;

  if (singleRegion && regionsToScan.length === 0) {
    console.warn(
      `[Resources] Requested region ${region} is not enabled for this account. Skipping regional discovery.`,
    );
  }

  const regionResults = await Promise.allSettled(
    regionsToScan.map((r) =>
      discoverRegion(workspaceId, r, roleArn, externalId, singleRegion),
    ),
  );

  const seenIds = new Set<string>();

  const servicesToDedup: { key: string; field: keyof ResourceInventory; getId: (item: any, r: string) => string | undefined }[] = [
    { key: "ec2", field: "ec2", getId: (inst) => inst.id || inst.name },
    { key: "lambda", field: "lambda", getId: (fn, r) => `${fn.name}:${r}` },
    { key: "rds", field: "rds", getId: (db) => db.id },
    { key: "ecs", field: "ecs", getId: (svc) => svc.id || `${svc.cluster}:${svc.name}` },
    { key: "amplify", field: "amplify", getId: (app) => app.id },
    { key: "dynamodb", field: "dynamodb", getId: (table, r) => `${table.name}:${r}` },
    { key: "sqs", field: "sqs", getId: (queue) => queue.url },
    { key: "alb", field: "alb", getId: (alb) => alb.arn },
    { key: "ebs", field: "ebs", getId: (vol) => vol.id },
    { key: "eks", field: "eks", getId: (cluster, r) => `${cluster.name}:${r}` },
    { key: "autoscaling", field: "autoscaling", getId: (asg, r) => `${asg.name}:${r}` },
    { key: "elasticache", field: "elasticache", getId: (cache) => cache.id },
    { key: "redshift", field: "redshift", getId: (cluster) => cluster.id },
    { key: "efs", field: "efs", getId: (fs) => fs.id },
    { key: "kinesis", field: "kinesis", getId: (stream, r) => `${stream.name}:${r}` },
    { key: "sns", field: "sns", getId: (topic) => topic.arn },
    { key: "eventbridge", field: "eventbridge", getId: (rule, r) => `${rule.name}:${r}` },
    { key: "stepfunctions", field: "stepfunctions", getId: (sm) => sm.arn },
    { key: "waf", field: "waf", getId: (acl) => acl.id },
    { key: "apigateway", field: "apigateway", getId: (api, r) => `${api.id}:${r}` },
    { key: "eip", field: "eip", getId: (eipItem) => eipItem.id },
    { key: "sg", field: "sg", getId: (sgItem) => sgItem.id },
    { key: "tg", field: "tg", getId: (tgItem) => tgItem.arn },
    { key: "ecr", field: "ecr", getId: (ecrItem) => ecrItem.id || ecrItem.name },
  ];

  for (const result of regionResults) {
    if (result.status !== "fulfilled") continue;
    const regionData = result.value;

    for (const service of servicesToDedup) {
      const items = (regionData as any)[service.key] || [];
      for (const item of items) {
        const id = service.getId(item, regionData.region);
        const dupKey = `${service.key}:${id}`;
        if (id && !seenIds.has(dupKey)) {
          seenIds.add(dupKey);
          (inventory[service.field] as any[]).push(item);
        }
      }
    }
  }

  const countKeys = ["s3", "cloudfront", ...servicesToDedup.map((s) => s.field)];
  let total = 0;
  for (const key of countKeys) {
    const arr = (inventory as any)[key];
    if (Array.isArray(arr)) {
      inventory.counts[key] = arr.length;
      total += arr.length;
    }
  }
  inventory.counts.total = total;

  return inventory;
}
