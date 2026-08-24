"use client";

import { z } from "zod";
import { ServiceSchemas } from "../../registry";

export interface TfNodeInput {
  id: string;
  serviceId: string;
  config: Record<string, unknown>;
  label?: string;
}

export interface TfConfigError {
  nodeId: string;
  nodeLabel: string;
  field: string;
  message: string;
}

export function validateNodeConfig(node: TfNodeInput): TfConfigError[] {
  const errors: TfConfigError[] = [];
  const schema = ServiceSchemas[node.serviceId];
  if (!schema) return errors;

  try {
    schema.parse(node.config);
  } catch (err) {
    if (err instanceof z.ZodError) {
      for (const issue of err.issues) {
        const field = issue.path.join(".");
        if (issue.code === "invalid_type") {
          errors.push({
            nodeId: node.id,
            nodeLabel: node.label || node.serviceId,
            field,
            message: `Expected ${issue.expected} but got ${issue.received}`,
          });
        } else if (issue.code === "too_small") {
          errors.push({
            nodeId: node.id,
            nodeLabel: node.label || node.serviceId,
            field,
            message: `Value must be at least ${issue.minimum}`,
          });
        } else if (issue.code === "too_big") {
          errors.push({
            nodeId: node.id,
            nodeLabel: node.label || node.serviceId,
            field,
            message: `Value must be at most ${issue.maximum}`,
          });
        } else {
          errors.push({
            nodeId: node.id,
            nodeLabel: node.label || node.serviceId,
            field,
            message: issue.message,
          });
        }
      }
    }
  }

  // Check required fields for Terraform specifically
  if (node.serviceId === "ec2" && !node.config.instanceType) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label || node.serviceId,
      field: "instanceType",
      message: "Required for Terraform EC2 resource",
    });
  }

  if (node.serviceId === "rds" && !node.config.engine) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label || node.serviceId,
      field: "engine",
      message: "Required for Terraform RDS resource",
    });
  }

  if (node.serviceId === "gcp_compute" && !node.config.instanceName) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label || node.serviceId,
      field: "instanceName",
      message: "Instance Name is required",
    });
  }

  if (node.serviceId === "gcp_storage" && !node.config.bucketName) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label || node.serviceId,
      field: "bucketName",
      message: "Bucket Name is required",
    });
  }

  if (node.serviceId === "gcp_sql") {
    if (!node.config.instanceName) {
      errors.push({
        nodeId: node.id,
        nodeLabel: node.label || node.serviceId,
        field: "instanceName",
        message: "Instance Name is required",
      });
    }
    if (!node.config.databaseName) {
      errors.push({
        nodeId: node.id,
        nodeLabel: node.label || node.serviceId,
        field: "databaseName",
        message: "Database Name is required",
      });
    }
  }

  if (node.serviceId === "gcp_function" && !node.config.functionName) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label || node.serviceId,
      field: "functionName",
      message: "Function Name is required",
    });
  }

  if (node.serviceId === "gcp_gke" && !node.config.clusterName) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label || node.serviceId,
      field: "clusterName",
      message: "Cluster Name is required",
    });
  }

  return errors;
}

export function validateAllNodes(nodes: TfNodeInput[]): TfConfigError[] {
  const allErrors: TfConfigError[] = [];
  for (const node of nodes) {
    allErrors.push(...validateNodeConfig(node));
  }
  return allErrors;
}
