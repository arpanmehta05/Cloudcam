import { generateTerraformJson } from "../src/services/terraform-generation.service";

const req = {
  region: "us-east-1",
  nodes: [
    { id: "s3_1", serviceId: "s3", config: { bucketName: "sim-s3-bucket", region: "ap-south-1", versioning: false, publicAccess: false } },
    { id: "ec2_1", serviceId: "ec2", config: { instanceName: "sim-ec2", region: "eu-west-1", instanceType: "t2.micro" } }
  ],
  edges: []
};

const result = generateTerraformJson(req as any);
console.log(result.terraformHcl);
