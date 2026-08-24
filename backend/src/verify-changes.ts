import { TerraformCompiler } from "./services/terraform-generation.service";

async function verify() {
  console.log("=== RUNNING COMPILER VERIFICATION ===");

  // 1. Verify Security Group Suppression
  const reqWithCustomSg = {
    nodes: [
      { id: "node_ec2", serviceId: "ec2" as const, config: { instanceName: "test-vm", instanceType: "t3.micro", region: "us-east-1" } },
      { id: "node_sg", serviceId: "sg" as const, config: { name: "custom-sg" } }
    ],
    edges: [
      { source: "node_sg", target: "node_ec2" }
    ],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler1 = new TerraformCompiler(reqWithCustomSg);
  const result1 = compiler1.compile();
  const hcl1 = result1.terraformHcl;

  const hasCustomSgAttached = hcl1.includes("aws_security_group.sim_node_sg.id");
  const hasDefaultSgAttached = hcl1.includes("aws_security_group.simulation.id") || hcl1.includes("aws_security_group.us_east_1.id");

  console.log("TEST 1 (Custom SG attached):");
  console.log("  - Has custom SG attached:", hasCustomSgAttached);
  console.log("  - Has default SG attached:", hasDefaultSgAttached);
  if (hasCustomSgAttached && !hasDefaultSgAttached) {
    console.log("  => SUCCESS (Default SG successfully suppressed!)");
  } else {
    console.error("  => FAILURE");
  }

  // 2. Verify fallback to default SG
  const reqWithoutCustomSg = {
    nodes: [
      { id: "node_ec2", serviceId: "ec2" as const, config: { instanceName: "test-vm", instanceType: "t3.micro", region: "us-east-1" } }
    ],
    edges: [],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler2 = new TerraformCompiler(reqWithoutCustomSg);
  const result2 = compiler2.compile();
  const hcl2 = result2.terraformHcl;

  const fallbackHasDefaultSg = hcl2.includes("aws_security_group.simulation.id") || hcl2.includes("aws_security_group.us_east_1.id");
  console.log("\nTEST 2 (No custom SG attached):");
  console.log("  - Has default SG attached:", fallbackHasDefaultSg);
  if (fallbackHasDefaultSg) {
    console.log("  => SUCCESS (Fallback to default SG working!)");
  } else {
    console.error("  => FAILURE");
  }

  // 3. Verify Docker Hub Port 80 Mapping & Host Nginx stop
  const reqDockerHub80 = {
    nodes: [
      { id: "node_ec2", serviceId: "ec2" as const, config: { instanceName: "test-vm", instanceType: "t3.micro", region: "us-east-1" } },
      { id: "node_dh", serviceId: "dockerhub" as const, config: { repository: "arpanmehta05/demo", tag: "latest", appPort: "80" } }
    ],
    edges: [
      { source: "node_dh", target: "node_ec2" }
    ],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler3 = new TerraformCompiler(reqDockerHub80);
  const result3 = compiler3.compile();
  const hcl3 = result3.terraformHcl;

  const hasNginxStop = hcl3.includes("systemctl stop nginx");
  const hasDockerRun80 = hcl3.includes("docker run -d -p 80:80");

  console.log("\nTEST 3 (Docker Hub Port 80):");
  console.log("  - Has Nginx stop commands:", hasNginxStop);
  console.log("  - Has docker run -p 80:80:", hasDockerRun80);
  if (hasNginxStop && hasDockerRun80) {
    console.log("  => SUCCESS (Docker Hub Port 80 config working!)");
  } else {
    console.error("  => FAILURE");
  }

  // 4. Verify Docker Hub Port 8080 uses Nginx Reverse Proxy
  const reqDockerHub8080 = {
    nodes: [
      { id: "node_ec2", serviceId: "ec2" as const, config: { instanceName: "test-vm", instanceType: "t3.micro", region: "us-east-1" } },
      { id: "node_dh", serviceId: "dockerhub" as const, config: { repository: "arpanmehta05/demo", tag: "latest", appPort: "8080" } }
    ],
    edges: [
      { source: "node_dh", target: "node_ec2" }
    ],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler4 = new TerraformCompiler(reqDockerHub8080);
  const result4 = compiler4.compile();
  const hcl4 = result4.terraformHcl;

  const hasProxyPass = hcl4.includes("proxy_pass http://127.0.0.1:8080");
  const hasDockerRun8080 = hcl4.includes("docker run -d -p 127.0.0.1:8080:8080");

  console.log("\nTEST 4 (Docker Hub Port 8080):");
  console.log("  - Has Nginx proxy_pass to 8080:", hasProxyPass);
  console.log("  - Has docker run -p 127.0.0.1:8080:8080:", hasDockerRun8080);
  if (hasProxyPass && hasDockerRun8080) {
    console.log("  => SUCCESS (Docker Hub Port 8080 reverse proxy working!)");
  } else {
    console.error("  => FAILURE");
  }

  // 5. Verify ECR-to-EC2 integration
  const reqEcrEc2 = {
    nodes: [
      { id: "node_ec2", serviceId: "ec2" as const, config: { instanceName: "test-vm", instanceType: "t3.micro", region: "us-east-1" } },
      { id: "node_ecr", serviceId: "ecr" as const, config: { repositoryName: "my-sim-repo" } }
    ],
    edges: [
      { source: "node_ecr", target: "node_ec2" }
    ],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler5 = new TerraformCompiler(reqEcrEc2);
  const result5 = compiler5.compile();
  const hcl5 = result5.terraformHcl;

  const hasEcrPolicyAttachment = hcl5.includes("arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly");
  const hasEcrLoginCmd = hcl5.includes("aws ecr get-login-password") && hcl5.includes("docker login --username AWS");
  const hasEcrPullCmd = hcl5.includes("docker pull ${aws_ecr_repository.sim_node_ecr.repository_url}:latest");
  const hasEcrDependency = hcl5.includes("depends_on") && hcl5.includes("aws_ecr_repository.sim_node_ecr");

  console.log("\nTEST 5 (ECR to EC2 Integration):");
  console.log("  - Has ECR ReadOnly Policy Attachment:", hasEcrPolicyAttachment);
  console.log("  - Has ECR Login Command in Bootstrap:", hasEcrLoginCmd);
  console.log("  - Has ECR Pull Command in Bootstrap:", hasEcrPullCmd);
  console.log("  - Has explicit dependency on ECR repository:", hasEcrDependency);

  if (hasEcrPolicyAttachment && hasEcrLoginCmd && hasEcrPullCmd && hasEcrDependency) {
    console.log("  => SUCCESS (ECR-to-EC2 integration verified!)");
  } else {
    console.error("  => FAILURE");
  }

  // 6. Verify ECR-to-ASG integration
  const reqEcrAsg = {
    nodes: [
      { id: "node_asg", serviceId: "asg" as const, config: { instanceName: "test-asg", instanceType: "t3.micro", region: "us-east-1" } },
      { id: "node_ecr", serviceId: "ecr" as const, config: { repositoryName: "my-sim-repo" } }
    ],
    edges: [
      { source: "node_ecr", target: "node_asg" }
    ],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler6 = new TerraformCompiler(reqEcrAsg);
  const result6 = compiler6.compile();
  const hcl6 = result6.terraformHcl;

  const hasAsgEcrPolicyAttachment = hcl6.includes("arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly");
  const hasAsgEcrLoginCmd = hcl6.includes("aws ecr get-login-password") && hcl6.includes("docker login --username AWS");
  const hasAsgEcrPullCmd = hcl6.includes("docker pull ${aws_ecr_repository.sim_node_ecr.repository_url}:latest");
  const hasAsgEcrDependency = hcl6.includes("depends_on") && hcl6.includes("aws_ecr_repository.sim_node_ecr");

  console.log("\nTEST 6 (ECR to ASG Integration):");
  console.log("  - Has ECR ReadOnly Policy Attachment (ASG):", hasAsgEcrPolicyAttachment);
  console.log("  - Has ECR Login Command in Bootstrap (ASG):", hasAsgEcrLoginCmd);
  console.log("  - Has ECR Pull Command in Bootstrap (ASG):", hasAsgEcrPullCmd);
  console.log("  - Has explicit dependency on ECR repository (ASG):", hasAsgEcrDependency);

  if (hasAsgEcrPolicyAttachment && hasAsgEcrLoginCmd && hasAsgEcrPullCmd && hasAsgEcrDependency) {
    console.log("  => SUCCESS (ECR-to-ASG integration verified!)");
  } else {
    console.error("  => FAILURE");
  }

  // 7. Verify API Gateway to Lambda Integration
  const reqApiGwLambda = {
    nodes: [
      { id: "node_apigw", serviceId: "apigateway" as const, config: { name: "test-api", protocolType: "HTTP" } },
      { id: "node_lambda", serviceId: "lambda" as const, config: { functionName: "test-func", runtime: "nodejs18.x", code: "console.log('hello lambda');" } }
    ],
    edges: [
      { source: "node_apigw", target: "node_lambda" }
    ],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler7 = new TerraformCompiler(reqApiGwLambda);
  const result7 = compiler7.compile();
  const hcl7 = result7.terraformHcl;

  const hasApiGateway = hcl7.includes("aws_apigatewayv2_api");
  const hasApiGatewayStage = hcl7.includes("aws_apigatewayv2_stage");
  const hasApiGatewayIntegration = hcl7.includes("aws_apigatewayv2_integration") && hcl7.includes("aws_lambda_function.sim_node_lambda.invoke_arn");
  const hasApiGatewayRoute = hcl7.includes("aws_apigatewayv2_route") && hcl7.includes("ANY /{proxy+}");
  const hasLambdaPermission = hcl7.includes("aws_lambda_permission") && hcl7.includes("apigateway.amazonaws.com");
  const hasApiGatewayOutput = hcl7.includes("output \"apigateway_url_sim_node_apigw\"");
  const hasArchiveFile = hcl7.includes("data \"archive_file\" \"zip_sim_node_lambda\"");
  const hasCodeContent = hcl7.includes("console.log('hello lambda');");

  console.log("\nTEST 7 (API Gateway to Lambda Integration):");
  console.log("  - Has API Gateway V2 HTTP API:", hasApiGateway);
  console.log("  - Has API Gateway V2 Default Stage:", hasApiGatewayStage);
  console.log("  - Has API Gateway V2 Integration with Lambda:", hasApiGatewayIntegration);
  console.log("  - Has API Gateway V2 ANY Route:", hasApiGatewayRoute);
  console.log("  - Has Lambda Permission for API Gateway:", hasLambdaPermission);
  console.log("  - Has API Gateway Endpoint Output block:", hasApiGatewayOutput);
  console.log("  - Has archive_file data source for lambda code:", hasArchiveFile);
  console.log("  - Generated zip package contains inline code:", hasCodeContent);

  if (hasApiGateway && hasApiGatewayStage && hasApiGatewayIntegration && hasApiGatewayRoute && hasLambdaPermission && hasApiGatewayOutput && hasArchiveFile && hasCodeContent) {
    console.log("  => SUCCESS (API Gateway to Lambda integration verified!)");
  } else {
    console.error("  => FAILURE");
  }

  // 8. Verify S3 Bucket Policy compilation
  const s3PolicyJson = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadGetObject",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: "arn:aws:s3:::*/*"
      }
    ]
  });

  const reqS3Policy = {
    nodes: [
      {
        id: "node_s3",
        serviceId: "s3" as const,
        config: {
          bucketName: "my-policy-bucket",
          policy: s3PolicyJson
        }
      }
    ],
    edges: [],
    region: "us-east-1",
    name: "test-simulation",
    deploymentId: "dep-123",
    provider: "aws" as const
  };

  const compiler8 = new TerraformCompiler(reqS3Policy);
  const result8 = compiler8.compile();
  const hcl8 = result8.terraformHcl;

  const hasS3Bucket = hcl8.includes("aws_s3_bucket");
  const hasS3BucketPolicy = hcl8.includes("aws_s3_bucket_policy");
  const hasEmbeddedPolicy = hcl8.includes("PublicReadGetObject");
  const hasPublicAccessBlock = hcl8.includes("aws_s3_bucket_public_access_block");
  const hasPabDependency = hcl8.includes("aws_s3_bucket_public_access_block.sim_node_s3_pab");

  console.log("\nTEST 8 (S3 Bucket Policy compilation):");
  console.log("  - Has S3 Bucket:", hasS3Bucket);
  console.log("  - Has S3 Bucket Policy resource:", hasS3BucketPolicy);
  console.log("  - Policy HCL contains policy JSON values:", hasEmbeddedPolicy);
  console.log("  - Has S3 Public Access Block resource:", hasPublicAccessBlock);
  console.log("  - Policy depends on Public Access Block:", hasPabDependency);

  if (hasS3Bucket && hasS3BucketPolicy && hasEmbeddedPolicy && hasPublicAccessBlock && hasPabDependency) {
    console.log("  => SUCCESS (S3 Bucket Policy compilation verified!)");
  } else {
    console.error("  => FAILURE");
  }
}

verify().catch(console.error);
