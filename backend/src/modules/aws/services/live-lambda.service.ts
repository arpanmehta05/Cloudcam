import { LambdaClient, GetFunctionCommand } from "@aws-sdk/client-lambda";
import axios from "axios";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getCredentials } from "../../../store/workspace-credentials";
import { getClientConfig } from "../providers/client-factory";

const execAsync = promisify(exec);

export async function extractFileFromZip(zipBuffer: Buffer, handlerBase: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lambda-code-"));
  const zipPath = path.join(tempDir, "package.zip");
  try {
    await fs.writeFile(zipPath, zipBuffer);

    const pythonCode = `
import zipfile
import sys
import os

zip_path = sys.argv[1]
handler_base = sys.argv[2]

try:
    with zipfile.ZipFile(zip_path, 'r') as z:
        names = z.namelist()
        match = None
        for name in names:
            base = os.path.basename(name)
            name_no_ext, ext = os.path.splitext(base)
            if name_no_ext == handler_base and ext in ['.js', '.mjs', '.py']:
                match = name
                break
        
        if not match:
            for name in names:
                base = os.path.basename(name)
                name_no_ext, _ = os.path.splitext(base)
                if name_no_ext == handler_base:
                    match = name
                    break
        
        if not match:
            for name in names:
                if name.endswith('.js') or name.endswith('.mjs') or name.endswith('.py'):
                    match = name
                    break

        if match:
            content = z.read(match)
            print(content.decode('utf-8', errors='ignore'))
        else:
            print(f"ERROR: No matching code file found for handler base '{handler_base}'", file=sys.stderr)
            sys.exit(1)
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(2)
`;
    const scriptPath = path.join(tempDir, "extract.py");
    await fs.writeFile(scriptPath, pythonCode);

    const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${zipPath}" "${handlerBase}"`);
    if (stderr && stderr.trim().length > 0) {
      console.warn("[extractFileFromZip] stderr:", stderr);
    }
    return stdout;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn("Failed to clean up temp dir:", err);
    }
  }
}

export async function getLiveLambdaCode(userId: string, resourceId: string, region: string) {
  const creds = await getCredentials(userId, "aws");
  if (!creds?.roleArn || !creds?.externalId) {
    throw new Error("AWS credentials not connected");
  }

  const clientConfig = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
  const client = new LambdaClient(clientConfig);

  const functionName = (Array.isArray(resourceId) ? resourceId[0] : resourceId) as string;

  let code = "";
  let handler = "index.handler";
  let runtime = "nodejs20.x";

  try {
    const funcData = await client.send(new GetFunctionCommand({ FunctionName: functionName }));
    const codeUrl = funcData.Code?.Location;
    handler = funcData.Configuration?.Handler || "index.handler";
    runtime = funcData.Configuration?.Runtime || "nodejs20.x";

    if (codeUrl) {
      const response = await axios.get(codeUrl, { responseType: "arraybuffer" });
      const zipBuffer = Buffer.from(response.data);
      const handlerParts = handler.split(".");
      const handlerBase = handlerParts[0] || "index";
      code = await extractFileFromZip(zipBuffer, handlerBase);
    } else {
      code = "// Lambda function code location not found";
    }
  } catch (awsError: any) {
    console.warn("[getLiveLambdaCode] AWS GetFunction failed:", awsError.message || awsError);

    const isAccessDenied = awsError.name === "AccessDeniedException" ||
                           /not authorized|AccessDenied/i.test(awsError.message || "");

    if (isAccessDenied) {
      const accountId = creds.roleArn ? creds.roleArn.split(":")[4] : "unknown";
      code = `// Permission Denied: Could not fetch function code.
// Your AWS IAM role is missing the 'lambda:GetFunction' permission on this resource.
// 
// Resource: arn:aws:lambda:${region}:${accountId}:function:${functionName}
// Error Message: ${awsError.message}`;
    } else {
      code = `// Error loading code: ${awsError.message || awsError}`;
    }
  }

  const handlerParts = handler.split(".");
  const handlerBase = handlerParts[0] || "index";
  let resolvedFilename = `${handlerBase}.js`;
  if (runtime.startsWith("python")) {
    resolvedFilename = `${handlerBase}.py`;
  }

  return {
    code,
    filename: resolvedFilename,
    handler,
    runtime,
  };
}
