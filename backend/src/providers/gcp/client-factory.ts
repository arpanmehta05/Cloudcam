export interface GcpServiceAccountAuthInput {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    scopes?: string[];
}

export const DEFAULT_GCP_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

export function normalizeGcpPrivateKey(privateKey: string): string {
    return privateKey.replace(/\\n/g, "\n");
}

export function createGcpAuthClient(input: GcpServiceAccountAuthInput) {
    if (!input.projectId || !input.clientEmail || !input.privateKey) {
        throw new Error("Missing GCP service account credentials");
    }

    const { google } = require("googleapis") as any;
    return new google.auth.JWT({
        email: input.clientEmail,
        key: normalizeGcpPrivateKey(input.privateKey),
        scopes: input.scopes || DEFAULT_GCP_SCOPES,
        subject: undefined,
    });
}

export function createGcpGoogleApisClient(input: GcpServiceAccountAuthInput) {
    const { google } = require("googleapis") as any;
    const auth = createGcpAuthClient(input);
    return {
        auth,
        projectId: input.projectId,
        cloudasset: google.cloudasset({ version: "v1", auth }),
        compute: google.compute({ version: "v1", auth }),
        storage: google.storage({ version: "v1", auth }),
        sqladmin: google.sqladmin({ version: "v1beta4", auth }),
        cloudfunctions: google.cloudfunctions({ version: "v1", auth }),
        run: google.run({ version: "v2", auth }),
        container: google.container({ version: "v1", auth }),
        pubsub: google.pubsub({ version: "v1", auth }),
        cloudbilling: google.cloudbilling({ version: "v1", auth }),
        recommender: google.recommender({ version: "v1", auth }),
        monitoring: google.monitoring({ version: "v3", auth }),
        logging: google.logging({ version: "v2", auth }),
        securitycenter: google.securitycenter({ version: "v1", auth }),
        cloudresourcemanager: google.cloudresourcemanager({ version: "v1", auth }),
        artifactregistry: google.artifactregistry({ version: "v1", auth }),
        appengine: google.appengine({ version: "v1", auth }),
    };
}
