import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import {
  CloudFrontClient,
  ListDistributionsCommand,
} from "@aws-sdk/client-cloudfront";
import {
  EC2Client,
  DescribeAddressesCommand,
  DescribeSecurityGroupsCommand,
} from "@aws-sdk/client-ec2";
import { WAFV2Client, ListWebACLsCommand } from "@aws-sdk/client-wafv2";
import {
  APIGatewayClient,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";
import {
  ApiGatewayV2Client,
  GetApisCommand,
} from "@aws-sdk/client-apigatewayv2";
import { shouldLogResourceDiscoveryError } from "./resources.provider";

export async function discoverALB(cfg: any, region: string): Promise<any[]> {
  const client = new ElasticLoadBalancingV2Client(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeLoadBalancersCommand({ Marker: marker }),
      );
      res.LoadBalancers?.forEach((alb) => {
        const id = alb.LoadBalancerArn?.split("loadbalancer/")[1];
        items.push({
          arn: alb.LoadBalancerArn,
          name: alb.LoadBalancerName,
          id,
          region,
        });
      });
      marker = res.NextMarker;
    } while (marker);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverCloudFront(cfg: any): Promise<any[]> {
  const client = new CloudFrontClient(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new ListDistributionsCommand({ Marker: marker, MaxItems: 100 }),
      );
      res.DistributionList?.Items?.forEach((d) => {
        items.push({
          id: d.Id,
          domain: d.DomainName,
          status: d.Status,
          enabled: d.Enabled,
          region: "us-east-1",
        });
      });
      marker = res.DistributionList?.NextMarker;
    } while (marker);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] global Cloudfront error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverElasticIps(cfg: any, region: string): Promise<any[]> {
  const client = new EC2Client(cfg);
  const items: any[] = [];
  try {
    const res = await client.send(new DescribeAddressesCommand({}));
    res.Addresses?.forEach((addr) => {
      items.push({
        id: addr.AllocationId || addr.PublicIp,
        publicIp: addr.PublicIp,
        associationId: addr.AssociationId || null,
        instanceId: addr.InstanceId || null,
        domain: addr.Domain || null,
        region,
      });
    });
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} EIP error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverSecurityGroups(cfg: any, region: string): Promise<any[]> {
  const client = new EC2Client(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeSecurityGroupsCommand({ NextToken: nextToken }),
      );
      res.SecurityGroups?.forEach((sg) => {
        items.push({
          id: sg.GroupId,
          name: sg.GroupName,
          description: sg.Description,
          vpcId: sg.VpcId,
          region,
        });
      });
      nextToken = res.NextToken;
    } while (nextToken);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} SG error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverTargetGroups(cfg: any, region: string): Promise<any[]> {
  const client = new ElasticLoadBalancingV2Client(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeTargetGroupsCommand({ Marker: marker }),
      );
      res.TargetGroups?.forEach((tg) => {
        const id = tg.TargetGroupArn?.split("targetgroup/")[1];
        const lbArn = tg.LoadBalancerArns?.[0];
        const loadBalancer = lbArn ? lbArn.split("loadbalancer/")[1] : null;
        items.push({
          arn: tg.TargetGroupArn,
          name: tg.TargetGroupName,
          id: `targetgroup/${id}`,
          loadBalancer,
          region,
        });
      });
      marker = res.NextMarker;
    } while (marker);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} TG error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverWAF(cfg: any, region: string): Promise<any[]> {
  const client = new WAFV2Client(cfg);
  const items: any[] = [];
  try {
    const res = await client.send(
      new ListWebACLsCommand({ Scope: "REGIONAL", Limit: 100 }),
    );
    res.WebACLs?.forEach((acl) => {
      items.push({
        id: acl.Id,
        name: acl.Name,
        arn: acl.ARN,
        region,
      });
    });
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverAPIGateway(cfg: any, region: string): Promise<any[]> {
  const client = new APIGatewayClient(cfg);
  const clientV2 = new ApiGatewayV2Client(cfg);
  const items: any[] = [];

  // 1. Discover API Gateway v1 (REST APIs)
  try {
    const res = await client.send(new GetRestApisCommand({ limit: 100 }));
    res.items?.forEach((api) => {
      items.push({
        id: api.id,
        name: api.name,
        description: api.description,
        region,
        apiType: "REST",
      });
    });
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} API Gateway v1 error:`,
        e?.message || e,
      );
    }
  }

  // 2. Discover API Gateway v2 (HTTP / WebSocket APIs)
  try {
    const resV2 = await clientV2.send(new GetApisCommand({ MaxResults: "100" }));
    resV2.Items?.forEach((api) => {
      items.push({
        id: api.ApiId,
        name: api.Name,
        description:
          api.Description || `API Gateway v2 ${api.ProtocolType} API`,
        region,
        apiType: api.ProtocolType || "HTTP",
      });
    });
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} API Gateway v2 error:`,
        e?.message || e,
      );
    }
  }

  return items;
}
