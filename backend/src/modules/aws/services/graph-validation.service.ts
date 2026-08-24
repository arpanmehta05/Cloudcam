import { ServiceSchemas } from "../../../config/terraform-schemas";
import { topologicalSort, type ResourceNode } from "../../../services/terraform/graph-resolver";

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
  field?: string;
}

export interface GraphValidationResult {
  valid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
}

export class GraphValidator {
  private issues: ValidationIssue[] = [];

  constructor(private nodes: any[], private edges: any[], private region: string) {}

  public validate(): GraphValidationResult {
    this.issues = [];

    // 1. Basic Structure Validation
    if (!this.nodes || this.nodes.length === 0) {
      this.issues.push({ severity: "error", message: "Infrastructure graph is empty" });
    }

    // 2. Circular Dependency & Dependency Integrity
    try {
      this.validateDependencies();
    } catch (err: any) {
      this.issues.push({ severity: "error", message: err.message });
    }

    // 3. Node-specific Configuration Validation
    for (const node of this.nodes) {
      this.validateNode(node);
    }

    // 4. Cross-Resource Relationship Validation
    this.validateRelationships();

    // Calculate Score
    const errorCount = this.issues.filter(i => i.severity === "error").length;
    const warningCount = this.issues.filter(i => i.severity === "warning").length;
    
    let score = 100;
    score -= errorCount * 25;
    score -= warningCount * 5;
    score = Math.max(0, score);

    return {
      valid: errorCount === 0,
      score,
      issues: this.issues
    };
  }

  private validateDependencies() {
    const nodeIds = new Set(this.nodes.map(n => n.id));
    
    // Check for broken edges
    for (const edge of this.edges) {
      if (!nodeIds.has(edge.source)) {
        this.issues.push({ severity: "error", message: `Edge source '${edge.source}' does not exist` });
      }
      if (!nodeIds.has(edge.target)) {
        this.issues.push({ severity: "error", message: `Edge target '${edge.target}' does not exist` });
      }
    }

    // Circular dependency check using topological sort
    const resourceNodes: ResourceNode[] = this.nodes.map(n => {
      const typeMap: any = {
        ec2: "aws_instance",
        s3: "aws_s3_bucket",
        rds: "aws_db_instance",
        lambda: "aws_lambda_function",
        dynamodb: "aws_dynamodb_table",
        azure_vm: "azurerm_linux_virtual_machine",
        azure_storage: "azurerm_storage_account",
        azure_sql: "azurerm_mssql_database",
        azure_function: "azurerm_linux_function_app",
        azure_vnet: "azurerm_virtual_network",
        gcp_compute: "google_compute_instance",
        gcp_storage: "google_storage_bucket",
        gcp_sql: "google_sql_database_instance",
        gcp_function: "google_cloudfunctions2_function",
        gcp_gke: "google_container_cluster",
        elb: "aws_lb",
        azure_lb: "azurerm_lb",
        gcp_lb: "google_compute_global_forwarding_rule",
        asg: "aws_autoscaling_group",
        azure_vmss: "azurerm_linux_virtual_machine_scale_set",
        gcp_mig: "google_compute_instance_group_manager",
        apigateway: "aws_apigatewayv2_api",
        ecr: "aws_ecr_repository",
        azure_acr: "azurerm_container_registry",
        gcp_artifact_registry: "google_artifact_registry_repository",
        eip: "aws_eip",
        azure_pip: "azurerm_public_ip",
        gcp_ip: "google_compute_address",
        sg: "aws_security_group",
        azure_nsg: "azurerm_network_security_group",
        gcp_firewall: "google_compute_firewall",
        tg: "aws_lb_target_group",
        azure_tg: "azurerm_lb_backend_address_pool",
        gcp_tg: "google_compute_backend_service",
        ebs: "aws_ebs_volume",
        azure_disk: "azurerm_managed_disk",
        gcp_disk: "google_compute_disk",
        ecs: "aws_ecs_cluster",
      };

      const deps = this.edges
        .filter(e => e.target === n.id && e.source !== n.id)
        .map(e => {
          const sourceNode = this.nodes.find(sn => sn.id === e.source);
          if (!sourceNode) return null;

          const computeServices = ["ec2", "lambda", "ecs", "azure_vm", "azure_function", "gcp_compute", "gcp_function", "asg", "azure_vmss", "gcp_mig"];
          const storageServices = ["s3", "rds", "dynamodb", "ecr", "azure_storage", "azure_sql", "azure_acr", "gcp_storage", "gcp_sql", "gcp_artifact_registry"];
          if (computeServices.includes(sourceNode.serviceId) && storageServices.includes(n.serviceId)) {
            return null;
          }
          if (
            sourceNode.serviceId === "elb" ||
            sourceNode.serviceId === "azure_lb" ||
            sourceNode.serviceId === "gcp_lb" ||
            sourceNode.serviceId === "tg" ||
            sourceNode.serviceId === "azure_tg" ||
            sourceNode.serviceId === "gcp_tg" ||
            sourceNode.serviceId === "ebs" ||
            sourceNode.serviceId === "azure_disk" ||
            sourceNode.serviceId === "gcp_disk" ||
            sourceNode.serviceId === "sg" ||
            sourceNode.serviceId === "azure_nsg" ||
            sourceNode.serviceId === "gcp_firewall" ||
            sourceNode.serviceId === "eip" ||
            sourceNode.serviceId === "azure_pip" ||
            sourceNode.serviceId === "gcp_ip" ||
            n.serviceId === "elb" ||
            n.serviceId === "azure_lb" ||
            n.serviceId === "gcp_lb" ||
            n.serviceId === "tg" ||
            n.serviceId === "azure_tg" ||
            n.serviceId === "gcp_tg" ||
            n.serviceId === "ebs" ||
            n.serviceId === "azure_disk" ||
            n.serviceId === "gcp_disk" ||
            n.serviceId === "sg" ||
            n.serviceId === "azure_nsg" ||
            n.serviceId === "gcp_firewall" ||
            n.serviceId === "eip" ||
            n.serviceId === "azure_pip" ||
            n.serviceId === "gcp_ip"
          ) {
            return null;
          }

          if (!typeMap[sourceNode.serviceId]) return null;
          const name = `sim_${e.source.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
          return `${typeMap[sourceNode.serviceId]}.${name}`;
        })
        .filter((d): d is string => d !== null);

      const name = `sim_${n.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      
      return {
        id: n.id,
        type: typeMap[n.serviceId] || "unknown",
        name: name,
        dependencies: deps,
        data: n.config
      };
    });

    topologicalSort(resourceNodes);
  }

  private validateNode(node: any) {
    const schema = ServiceSchemas[node.serviceId];
    if (!schema) {
      this.issues.push({ severity: "error", message: `Unsupported service type: ${node.serviceId}`, nodeId: node.id });
      return;
    }

    const result = schema.safeParse(node.config);
    if (!result.success) {
      for (const error of result.error.errors) {
        this.issues.push({
          severity: "error",
          message: `${error.path.join(".")}: ${error.message}`,
          nodeId: node.id,
          field: error.path.join(".")
        });
      }
    }

    // Custom validations
    if (node.serviceId === "ec2") {
      if (node.config.ami && !node.config.ami.startsWith("ami-")) {
        this.issues.push({ 
          severity: "error", 
          message: "Invalid AMI ID format. Must start with 'ami-'", 
          nodeId: node.id, 
          field: "ami" 
        });
      }
    }
  }

  private validateRelationships() {
    // Example: RDS shouldn't depend on S3 in a way that doesn't make sense (just a logical check)
    // For now, focus on network isolation
    const ec2Nodes = this.nodes.filter(n => n.serviceId === "ec2");
    const rdsNodes = this.nodes.filter(n => n.serviceId === "rds");

    if (rdsNodes.length > 0 && ec2Nodes.length === 0) {
      this.issues.push({ 
        severity: "warning", 
        message: "RDS instance detected without an EC2 application node. Ensure you have a way to connect to this database." 
      });
    }
  }
}

export function validateInfrastructure(nodes: any[], edges: any[], region: string): GraphValidationResult {
  const validator = new GraphValidator(nodes, edges, region);
  return validator.validate();
}
