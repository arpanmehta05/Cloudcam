// GCP Setup Service — canonical location: modules/gcp/services/setup.service.ts
import { config } from "../../../config/env";
import { Request } from "express";

function safeWorkspaceId(userId: string) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(userId)) {
        throw new Error("Invalid workspace id for GCP onboarding.");
    }
    return userId;
}

function isConfiguredSecret(secret?: string) {
    if (!secret) return false;
    const normalized = secret.trim().toLowerCase();
    return normalized !== "generate-a-secure-random-string"
        && normalized !== "change-me"
        && normalized !== "changeme"
        && normalized !== "your-secret-here";
}

export async function generateGcpSetup(userId: string, req?: Request) {
    const workspaceId = safeWorkspaceId(userId);
    const forwardedProto = req?.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || req?.protocol || "http";
    const baseUrl = req ? `${protocol}://${req.get("host")}` : config.publicApiBaseUrl;
    const webhookUrl = config.gcp.webhookUrl || `${baseUrl.replace(/\/+$/, "")}/api/gcp/save-connection`;
    const apiSecret = config.rabbittize.apiSecret || config.rabbittize.webhookSecret;

    if (!isConfiguredSecret(apiSecret)) {
        throw new Error("Set RABBITTIZE_API_SECRET or RABBITTIZE_WEBHOOK_SECRET to a real secret before generating GCP onboarding.");
    }

    const cloudShellScript = `# GCP Cloud Shell script
project_id=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$project_id" ] || [ "$project_id" = "(unset)" ]; then
  echo "No active GCP project is selected."
  echo "Available projects:"
  gcloud projects list --format="table(projectId,name)"
  read -r -p "Enter the GCP project ID to connect: " project_id
  if [ -z "$project_id" ]; then
    echo "Project ID is required. Re-run this script after selecting a project."
    return 1 2>/dev/null || true
  fi
  gcloud config set project "$project_id"
fi

sa_name="cw-gcp-${workspaceId.substring(0, 8)}"
sa_email="\${sa_name}@\${project_id}.iam.gserviceaccount.com"

echo "Enabling GCP required APIs..."
gcloud services enable cloudasset.googleapis.com monitoring.googleapis.com logging.googleapis.com bigquery.googleapis.com cloudbilling.googleapis.com recommender.googleapis.com cloudresourcemanager.googleapis.com securitycenter.googleapis.com storage.googleapis.com pubsub.googleapis.com --project="\$project_id" || true

echo "Enabling paid service APIs (requires billing enabled)..."
gcloud services enable compute.googleapis.com sqladmin.googleapis.com cloudfunctions.googleapis.com container.googleapis.com run.googleapis.com cloudbuild.googleapis.com --project="\$project_id" 2>/dev/null || echo "Warning: Some paid APIs could not be enabled. If you plan to monitor/simulate Compute, GKE, SQL, or Serverless, please link a billing account to your GCP project."

echo "Creating GCP Service Account..."
if gcloud iam service-accounts describe "\$sa_email" --project="\$project_id" >/dev/null 2>&1; then
  echo "Service account already exists: \$sa_email"
else
  gcloud iam service-accounts create "\$sa_name" --display-name="CloudWatcher Integration" --project="\$project_id"
fi

echo "Assigning required IAM roles to Service Account..."
for role in roles/viewer roles/cloudasset.viewer roles/monitoring.viewer roles/logging.viewer roles/securitycenter.viewer roles/bigquery.jobUser roles/bigquery.dataViewer roles/recommender.viewer roles/compute.admin roles/storage.admin roles/cloudsql.admin roles/cloudfunctions.admin roles/container.admin roles/iam.serviceAccountUser; do
  echo "Adding \$role..."
  gcloud projects add-iam-policy-binding "\$project_id" --member="serviceAccount:\$sa_email" --role="\$role" --quiet --format="none" >/dev/null || true
done

echo "Generating Service Account Key..."
rm -f credentials.json cloudwatcher-payload.json
gcloud iam service-accounts keys create credentials.json --iam-account="\$sa_email"
if [ ! -s credentials.json ]; then
  echo "Failed to create service account key. Make sure your account has iam.serviceAccountKeys.create permission."
  return 1 2>/dev/null || true
fi

echo "Registering with CloudWatcher..."
privateKey=$(jq -r .private_key credentials.json)
clientEmail=$(jq -r .client_email credentials.json)
projectId=$(jq -r .project_id credentials.json)

jq -n --arg workspaceId "${workspaceId}" --arg projectId "\$projectId" --arg clientEmail "\$clientEmail" --arg privateKey "\$privateKey" '{workspaceId: $workspaceId, projectId: $projectId, clientEmail: $clientEmail, privateKey: $privateKey}' > cloudwatcher-payload.json

callback_response=$(curl -sS -X POST -H "Content-Type: application/json" -H "x-rabbittize-secret: ${apiSecret}" -H "X-Tunnel-Skip-AntiPhishing-Page: True" --data-binary @cloudwatcher-payload.json "${webhookUrl}")
echo "\$callback_response"
if echo "\$callback_response" | jq -e '.success == true' >/dev/null 2>&1; then
  echo "CloudWatcher GCP connection saved successfully."
else
  echo "CloudWatcher registration did not return success. You can still paste credentials.json in Manual Connect."
  echo "Keeping Cloud Shell open so you can read the callback response above."
fi`;

    const cloudShellUrl = `https://shell.cloud.google.com/?show=terminal`;

    const terraformTemplate = `# CloudWatcher GCP Integration Terraform Template
variable "project_id" {
  type        = string
  description = "The GCP Project ID to integrate"
}

provider "google" {
  project = var.project_id
}

resource "google_service_account" "rabbittize" {
  account_id   = "cw-gcp-${workspaceId.substring(0, 8)}"
  display_name = "CloudWatcher Integration"
}

resource "google_project_iam_member" "viewer" {
  project = var.project_id
  role    = "roles/viewer"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "bigquery_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "bigquery_data_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "cloudasset_viewer" {
  project = var.project_id
  role    = "roles/cloudasset.viewer"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "securitycenter_viewer" {
  project = var.project_id
  role    = "roles/securitycenter.viewer"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "recommender_viewer" {
  project = var.project_id
  role    = "roles/recommender.viewer"
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_project_iam_member" "deploy_roles" {
  for_each = toset([
    "roles/compute.admin",
    "roles/storage.admin",
    "roles/cloudsql.admin",
    "roles/cloudfunctions.admin",
    "roles/container.admin",
    "roles/iam.serviceAccountUser"
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:\${google_service_account.rabbittize.email}"
}

resource "google_service_account_key" "rabbittize" {
  service_account_id = google_service_account.rabbittize.name
}

provider "http" {}

data "http" "pingback" {
  url    = "${webhookUrl}"
  method = "POST"
  request_headers = {
    "Content-Type"                  = "application/json"
    "x-rabbittize-secret"           = "${apiSecret}"
    "X-Tunnel-Skip-AntiPhishing-Page" = "True"
  }
  request_body = jsonencode({
    workspaceId = "${workspaceId}"
    projectId   = var.project_id
    clientEmail = google_service_account.rabbittize.email
    privateKey  = base64decode(google_service_account_key.rabbittize.private_key)
  })

  depends_on = [
    google_project_iam_member.viewer,
    google_project_iam_member.cloudasset_viewer,
    google_project_iam_member.monitoring_viewer,
    google_project_iam_member.logging_viewer,
    google_project_iam_member.securitycenter_viewer,
    google_project_iam_member.bigquery_job_user,
    google_project_iam_member.bigquery_data_viewer,
    google_project_iam_member.recommender_viewer,
    google_project_iam_member.deploy_roles
  ]
}
`;

    return {
        cloudShellScript,
        terraformTemplate,
        webhookUrl,
        cloudShellUrl,
        workspaceId,
    };
}
