// AWS Save Role Service
import { saveRoleArn, saveConnectionWithModules, getCredentials } from "../../../../store/workspace-credentials";

export async function saveRole(
    userId: string,
    roleArn: string,
    externalId?: string,
    enabledModules?: string[],
    logForwardingEnabled?: boolean
) {
    if (externalId) {
        await saveConnectionWithModules(userId, roleArn, externalId, enabledModules, logForwardingEnabled);
    } else {
        await saveRoleArn(userId, roleArn);
    }
    const creds = await getCredentials(userId);
    console.log(`\n======================================================`);
    console.log(`SUCCESS! AWS Integration complete for user: ${userId}`);
    console.log(`RoleArn: ${roleArn}`);
    console.log(`ExternalId: ${creds?.externalId}`);
    console.log(`EnabledModules: ${(creds?.enabledModules || []).join(",")}`);
    console.log(`======================================================\n`);
    return { success: true, message: "RoleArn saved successfully" };
}
