import { TerraformCompiler } from "../src/services/terraform-generation.service";

const req = {
  region: "centralindia",
  deploymentId: "11c9dd3d-bb8a-4b1b-8e1d-4566779fb618",
  provider: "azure" as const,
  nodes: [
    {
      id: "azure_vm_1780054815000_g259d",
      serviceId: "azure_vm" as const,
      config: {
        instanceName: "sim-vm",
        vmSize: "Standard_B2ats_v2",
        adminUsername: "azureuser",
        osDiskType: "Standard_LRS",
        imagePublisher: "Canonical",
        imageOffer: "0001-com-ubuntu-server-jammy",
        imageSku: "22_04-lts"
      }
    },
    {
      id: "azure_storage_1780054815000_g259d",
      serviceId: "azure_storage" as const,
      config: {
        bucketName: "simstorage",
        accountTier: "Standard",
        replicationType: "LRS",
        accountKind: "StorageV2"
      }
    },
    {
      id: "azure_function_1780054815000_g259d",
      serviceId: "azure_function" as const,
      config: {
        functionName: "sim-func",
        skuName: "Y1"
      }
    }
  ],
  edges: []
};

const compiler = new TerraformCompiler(req);
const result = compiler.compile();
console.log("GENERATED HCL:\n", result.terraformHcl);

if (result.terraformHcl.includes("sim-vm-11c9dd3d")) {
  console.log("SUCCESS: VM name contains unique suffix!");
} else {
  console.error("FAIL: VM name does not contain unique suffix!");
}

if (result.terraformHcl.includes("simstorage11c9dd3d")) {
  console.log("SUCCESS: Storage account name contains unique suffix!");
} else {
  console.error("FAIL: Storage account name does not contain unique suffix!");
}

if (result.terraformHcl.includes("saforfuncsimazu000g259d")) {
  console.log("SUCCESS: Function App storage account name is unique and correctly formatted!");
} else {
  console.error("FAIL: Function App storage account name does not match expected unique format!");
}

if (result.terraformHcl.includes("sim-func-11c9dd3d")) {
  console.log("SUCCESS: Function App name contains unique suffix!");
} else {
  console.error("FAIL: Function App name does not contain unique suffix!");
}
