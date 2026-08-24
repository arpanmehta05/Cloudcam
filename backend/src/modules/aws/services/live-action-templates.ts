export function getEc2Hcl(action: string, region: string, resourceId: string): string {
  if (action === "start" || action === "stop") {
    return `
provider "aws" { region = "${region}" }
resource "aws_ec2_instance_state" "target" {
  instance_id = "${resourceId}"
  state       = "${action === "start" ? "running" : "stopped"}"
}
`;
  }
  if (action === "terminate") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "terminate" {
  provisioner "local-exec" {
    command = "aws ec2 terminate-instances --instance-ids ${resourceId} --region ${region}"
  }
}
`;
  }
  if (action === "disable-protection") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "ec2_disable_protection" {
  provisioner "local-exec" {
    command = "aws ec2 modify-instance-attribute --instance-id ${resourceId} --no-disable-api-termination --region ${region}"
  }
}
`;
  }
  return "";
}

export function getRdsHcl(action: string, region: string, resourceId: string, isSnap: boolean): string {
  if (action === "start" || action === "stop") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "rds_state" {
  provisioner "local-exec" {
    command = "aws rds ${action}-db-instance --db-instance-identifier ${resourceId} --region ${region}"
  }
}
`;
  }
  if (action === "delete") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "rds_delete" {
  provisioner "local-exec" {
    command = "aws rds ${isSnap ? "delete-db-snapshot --db-snapshot-identifier" : "delete-db-instance --db-instance-identifier"} ${resourceId} ${isSnap ? "" : "--skip-final-snapshot"} --region ${region}"
  }
}
`;
  }
  if (action === "disable-protection") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "rds_disable_protection" {
  provisioner "local-exec" {
    command = "aws rds modify-db-instance --db-instance-identifier ${resourceId} --no-deletion-protection --apply-immediately --region ${region}"
  }
}
`;
  }
  return "";
}

export function getS3Hcl(action: string, region: string, resourceId: string): string {
  if (action === "delete") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "s3_delete" {
  provisioner "local-exec" {
    command = "aws s3 rb s3://${resourceId} --force --region ${region}"
  }
}
`;
  }
  if (action === "empty-bucket") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "s3_empty" {
  provisioner "local-exec" {
    command = "aws s3 rm s3://${resourceId} --recursive --region ${region}"
  }
}
`;
  }
  return "";
}

export function getDynamoDbHcl(action: string, region: string, resourceId: string): string {
  if (action === "delete") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "ddb_delete" {
  provisioner "local-exec" {
    command = "aws dynamodb delete-table --table-name ${resourceId} --region ${region}"
  }
}
`;
  }
  if (action === "disable-protection") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "ddb_disable_protection" {
  provisioner "local-exec" {
    command = "aws dynamodb update-table --table-name ${resourceId} --no-deletion-protection-enabled --region ${region}"
  }
}
`;
  }
  return "";
}

export function getLambdaDeleteHcl(region: string, resourceId: string): string {
  return `
provider "aws" { region = "${region}" }
resource "null_resource" "lambda_delete" {
  provisioner "local-exec" {
    command = "aws lambda delete-function --function-name ${resourceId} --region ${region}"
  }
}
`;
}

export function getLambdaUpdateHcl(region: string, resourceId: string, escapedCode: string, fileName: string): string {
  return `
provider "aws" { region = "${region}" }

data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "\${path.module}/lambda.zip"
  source {
    content  = ${escapedCode}
    filename = "${fileName}"
  }
}

resource "null_resource" "update_lambda_code" {
  triggers = {
    code_hash = data.archive_file.lambda_zip.output_base64sha256
  }

  provisioner "local-exec" {
    command = "aws lambda update-function-code --function-name ${resourceId} --zip-file fileb://\${data.archive_file.lambda_zip.output_path} --region ${region}"
  }
}
`;
}

export function getEipHcl(action: string, region: string, resourceId: string, options: any): string {
  if (action === "disassociate") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "eip_disassociate" {
  provisioner "local-exec" {
    command = "aws ec2 disassociate-address --association-id ${options.associationId} --region ${region}"
  }
}
`;
  }
  if (action === "release") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "eip_release" {
  provisioner "local-exec" {
    command = "aws ec2 release-address --allocation-id ${resourceId} --region ${region}"
  }
}
`;
  }
  if (action === "associate") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "eip_associate" {
  provisioner "local-exec" {
    command = "aws ec2 associate-address --allocation-id ${resourceId} --instance-id ${options.instanceId} --region ${region}"
  }
}
`;
  }
  return "";
}

export function getSgHcl(action: string, region: string, resourceId: string): string {
  if (action === "delete") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "sg_delete" {
  provisioner "local-exec" {
    command = "aws ec2 delete-security-group --group-id ${resourceId} --region ${region}"
  }
}
`;
  }
  return "";
}

export function getTgHcl(action: string, region: string, resourceId: string): string {
  if (action === "delete") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "tg_delete" {
  provisioner "local-exec" {
    command = "aws elbv2 delete-target-group --target-group-arn ${resourceId} --region ${region}"
  }
}
`;
  }
  return "";
}

export function getEcrHcl(action: string, region: string, resourceId: string): string {
  if (action === "delete") {
    let repoName = Array.isArray(resourceId) ? resourceId[0] : resourceId;
    if (repoName && repoName.includes(":repository/")) {
      repoName = repoName.split(":repository/")[1];
    }
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "ecr_delete" {
  provisioner "local-exec" {
    command = "aws ecr delete-repository --repository-name ${repoName} --force --region ${region}"
  }
}
`;
  }
  return "";
}

export function getEcrImageHcl(action: string, region: string, resourceId: string, options: any): string {
  if (action === "delete") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "ecr_image_delete" {
  provisioner "local-exec" {
    command = <<EOF
OUT=$(aws ecr batch-delete-image --repository-name ${options.repositoryName} --image-ids imageDigest=${resourceId} --region ${region})
echo "$OUT"
if echo "$OUT" | grep -q "failures" && ! echo "$OUT" | grep -q '"failures": \\[\\]'; then
  echo "Error: ECR failed to delete image. It might be referenced by a manifest list (multi-arch index)." >&2
  exit 1
fi
EOF
  }
}
`;
  }
  if (action === "archive") {
    let tagDeleteCmds = "";
    let tagCopyCmds = "";
    if (options.tags && typeof options.tags === "string" && options.tags !== "untagged") {
      const tagList = options.tags.split(",").map((t: string) => t.trim());
      for (const t of tagList) {
        if (t && t !== "untagged") {
          tagCopyCmds += `aws ecr put-image --repository-name ${options.repositoryName} --image-tag archived-${t} --image-manifest "$MANIFEST" --region ${region}\n`;
          tagDeleteCmds += `aws ecr batch-delete-image --repository-name ${options.repositoryName} --image-ids imageTag=${t} --region ${region}\n`;
        }
      }
    }
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "ecr_image_archive" {
  provisioner "local-exec" {
    command = <<EOF
MANIFEST=$(aws ecr batch-get-image --repository-name ${options.repositoryName} --image-ids imageDigest=${resourceId} --query "images[].imageManifest" --output text --region ${region})
if [ -n "$MANIFEST" ]; then
  aws ecr put-image --repository-name ${options.repositoryName} --image-tag archived --image-manifest "$MANIFEST" --region ${region}
  ${tagCopyCmds}
  ${tagDeleteCmds}
else
  echo "Error: Could not retrieve manifest for image digest ${resourceId}"
  exit 1
fi
EOF
  }
}
`;
  }
  if (action === "unarchive") {
    let tagDeleteCmds = "";
    let tagCopyCmds = "";
    if (options.tags && typeof options.tags === "string" && options.tags !== "untagged") {
      const tagList = options.tags.split(",").map((t: string) => t.trim());
      for (const t of tagList) {
        if (t && t.startsWith("archived-")) {
          const originalTag = t.substring("archived-".length);
          tagCopyCmds += `aws ecr put-image --repository-name ${options.repositoryName} --image-tag ${originalTag} --image-manifest "$MANIFEST" --region ${region}\n`;
          tagDeleteCmds += `aws ecr batch-delete-image --repository-name ${options.repositoryName} --image-ids imageTag=${t} --region ${region}\n`;
        }
      }
    }
    let deleteArchivedCmd = `aws ecr batch-delete-image --repository-name ${options.repositoryName} --image-ids imageTag=archived --region ${region}`;
    if (options.manifestListDigest) {
      deleteArchivedCmd = `
PARENT_MANIFEST=$(aws ecr batch-get-image --repository-name ${options.repositoryName} --image-ids imageDigest=${options.manifestListDigest} --query "images[].imageManifest" --output text --region ${region})
if [ -n "$PARENT_MANIFEST" ]; then
  aws ecr put-image --repository-name ${options.repositoryName} --image-tag archived --image-manifest "$PARENT_MANIFEST" --region ${region}
  aws ecr batch-delete-image --repository-name ${options.repositoryName} --image-ids imageTag=archived --region ${region}
fi
`;
    }
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "ecr_image_unarchive" {
  provisioner "local-exec" {
    command = <<EOF
MANIFEST=$(aws ecr batch-get-image --repository-name ${options.repositoryName} --image-ids imageDigest=${resourceId} --query "images[].imageManifest" --output text --region ${region})
if [ -n "$MANIFEST" ]; then
  ${tagCopyCmds}
  ${tagDeleteCmds}
  ${deleteArchivedCmd}
else
  echo "Error: Could not retrieve manifest for image digest ${resourceId}"
  exit 1
fi
EOF
  }
}
`;
  }
  return "";
}

export function getApiGatewayHcl(action: string, region: string, resourceId: string, options: any): string {
  if (action === "delete") {
    const isRest = options.apiType === "REST";
    const deleteCommand = isRest
      ? `aws apigateway delete-rest-api --rest-api-id ${resourceId} --region ${region}`
      : `aws apigatewayv2 delete-api --api-id ${resourceId} --region ${region}`;
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "apigw_delete" {
  provisioner "local-exec" {
    command = "${deleteCommand}"
  }
}
`;
  }
  return "";
}

export function getCloudFrontHcl(action: string, region: string, resourceId: string): string {
  if (action === "disable") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "cf_disable" {
  provisioner "local-exec" {
    command = <<EOF
CONFIG=$(aws cloudfront get-distribution-config --id ${resourceId} --region ${region})
ETAG=$(echo "$CONFIG" | jq -r '.ETag')
echo "$CONFIG" | jq '.DistributionConfig | .Enabled = false' > config.json
aws cloudfront update-distribution --id ${resourceId} --if-match "$ETAG" --distribution-config file://config.json --region ${region}
rm -f config.json
EOF
  }
}
`;
  }
  if (action === "enable") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "cf_enable" {
  provisioner "local-exec" {
    command = <<EOF
CONFIG=$(aws cloudfront get-distribution-config --id ${resourceId} --region ${region})
ETAG=$(echo "$CONFIG" | jq -r '.ETag')
echo "$CONFIG" | jq '.DistributionConfig | .Enabled = true' > config.json
aws cloudfront update-distribution --id ${resourceId} --if-match "$ETAG" --distribution-config file://config.json --region ${region}
rm -f config.json
EOF
  }
}
`;
  }
  if (action === "invalidate") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "cf_invalidate" {
  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --distribution-id ${resourceId} --paths \"/*\" --region ${region}"
  }
}
`;
  }
  if (action === "delete") {
    return `
provider "aws" { region = "${region}" }
resource "null_resource" "cf_delete" {
  provisioner "local-exec" {
    command = <<EOF
CONFIG=$(aws cloudfront get-distribution-config --id ${resourceId} --region ${region})
ETAG=$(echo "$CONFIG" | jq -r '.ETag')
aws cloudfront delete-distribution --id ${resourceId} --if-match "$ETAG" --region ${region}
EOF
  }
}
`;
  }
  return "";
}
