// GCP Client Factory — canonical location: modules/gcp/providers/client-factory.ts
// All GCP providers and services within this module import from here.
export {
    GcpServiceAccountAuthInput,
    DEFAULT_GCP_SCOPES,
    normalizeGcpPrivateKey,
    createGcpAuthClient,
    createGcpGoogleApisClient,
} from "../../../providers/gcp/client-factory";
