/* eslint-disable import/no-restricted-paths */
import mongoose from "mongoose";
import { getCredentials } from "../../../store/workspace-credentials";
import { hashResourceId } from "../../../shared/crypto/hash";
import { getAlarmResources } from "../../aws/services/alarm/alarm-metadata.service";
import { getEnabledDiscoveryRegions } from "../../aws/providers/resources.provider";
import { getResources as getAzureResources } from "../../../services/azure/resources.service";
import { getResources as getGcpResources } from "../../../services/gcp/resources.service";
import { logger } from "../../../core/logger";

import { AvailableResource } from "./nlp-parser.service";

export async function getUserAvailableResources(userId: string): Promise<AvailableResource[]> {
  const list: AvailableResource[] = [];

  // 1. VPS Agents
  try {
    const agents = await mongoose.connection.collection("vpsagents").find({ userId }).toArray();
    agents.forEach((a) => {
      list.push({
        label: a.name || a.hostname || a.agentId,
        value: `vps_${a.agentId}`,
        type: "vps",
        instanceId: a.agentId,
      });
    });
  } catch (err: any) {
    logger.warn(`[Slack-Bot] Failed to fetch VPS agents for resources list: ${err.message}`);
  }

  // 2. AWS EC2
  try {
    const creds = await getCredentials(userId, "aws");
    if (creds && creds.roleArn) {
      const regions = await getEnabledDiscoveryRegions(userId, creds.roleArn, creds.externalId);
      const resourcesPromises = regions.map(async (region) => {
        try {
          const res = await getAlarmResources(userId, "ec2", region, creds.roleArn, creds.externalId);
          return (res.resources || []).map((r) => ({
            label: `${r.label} (${region})`,
            value: `aws_${region}_${r.value}`,
            type: "aws" as const,
            region,
            instanceId: r.value,
          }));
        } catch (err) {
          return [];
        }
      });
      const results = await Promise.allSettled(resourcesPromises);
      results.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          list.push(...res.value);
        }
      });
    }
  } catch (err: any) {
    logger.warn(`[Slack-Bot] Failed to fetch AWS resources for resources list: ${err.message}`);
  }

  // 3. Azure VMs
  try {
    const creds = await getCredentials(userId, "azure");
    if (creds && creds.tenantId && creds.subscriptionId) {
      const inventory = await getAzureResources(
        userId,
        "all",
        creds.tenantId,
        creds.subscriptionId,
        creds.clientId,
        creds.clientSecret
      );
      const vms = inventory.ec2 || [];
      vms.forEach((vm) => {
        const vmRegion = vm.region || "global";
        const label = vm.name || vm.id?.split("/").pop() || "Unnamed Resource";
        list.push({
          label: `${label} (${vmRegion})`,
          value: `azure_${vmRegion}_${hashResourceId(vm.id)}`,
          type: "azure",
          region: vmRegion,
          instanceId: vm.id,
        });
      });
    }
  } catch (err: any) {
    logger.warn(`[Slack-Bot] Failed to fetch Azure resources for resources list: ${err.message}`);
  }

  // 4. GCP VMs
  try {
    const creds = await getCredentials(userId, "gcp");
    if (creds && creds.projectId && creds.clientEmail) {
      const inventory = await getGcpResources(
        userId,
        "all",
        creds.projectId,
        creds.clientEmail,
        creds.privateKey
      );
      const instances = inventory.ec2 || [];
      instances.forEach((inst) => {
        const instRegion = inst.region || "global";
        list.push({
          label: `${inst.name} (${instRegion})`,
          value: `gcp_${instRegion}_${hashResourceId(inst.id)}`,
          type: "gcp",
          region: instRegion,
          instanceId: inst.id,
        });
      });
    }
  } catch (err: any) {
    logger.warn(`[Slack-Bot] Failed to fetch GCP resources for resources list: ${err.message}`);
  }

  return list;
}

export async function resolveCloudServer(
  userId: string,
  provider: "aws" | "azure" | "gcp",
  region: string,
  hashOrId: string,
  creds: any
): Promise<{ id: string; label: string } | null> {
  if (provider === "aws") {
    return { id: hashOrId, label: hashOrId };
  }
  const hash = hashOrId;
  if (provider === "azure") {
    const inventory = await getAzureResources(
      userId,
      "all",
      creds.tenantId,
      creds.subscriptionId,
      creds.clientId,
      creds.clientSecret
    );
    const vms = inventory.ec2 || [];
    const matched = vms.find((vm) => hashResourceId(vm.id) === hash);
    if (matched) {
      return {
        id: matched.id,
        label: matched.name || matched.id?.split("/").pop() || matched.id,
      };
    }
  } else if (provider === "gcp") {
    const inventory = await getGcpResources(
      userId,
      "all",
      creds.projectId,
      creds.clientEmail,
      creds.privateKey
    );
    const instances = inventory.ec2 || [];
    const matched = instances.find((inst) => hashResourceId(inst.id) === hash);
    if (matched) {
      return { id: matched.id, label: matched.name || matched.id };
    }
  }
  return null;
}
