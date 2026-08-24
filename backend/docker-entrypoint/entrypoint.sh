#!/bin/bash
set -e

# --- Seed Plugin Cache ---
CACHE_DIR="/home/tfuser/.terraform.d/plugin-cache"
mkdir -p "$CACHE_DIR"
if [ -d /plugin-cache-seed ]; then
  cp -r /plugin-cache-seed/* "$CACHE_DIR/" 2>/dev/null || true
fi

# --- Configuration ---
RAW_WORKSPACE_NAME="${TF_RUN_ID:-$(hostname)}"
SAFE_WORKSPACE_NAME="$(printf '%s' "$RAW_WORKSPACE_NAME" | tr -cd '[:alnum:]_.-')"
if [ -z "$SAFE_WORKSPACE_NAME" ]; then
  SAFE_WORKSPACE_NAME="$(hostname)"
fi
WORKSPACE_DIR="/workspace/$SAFE_WORKSPACE_NAME"
mkdir -p "$WORKSPACE_DIR"
chmod 755 "$WORKSPACE_DIR"
cd "$WORKSPACE_DIR" || { echo "[error] Cannot cd to $WORKSPACE_DIR"; exit 1; }

echo "[runtime] Initializing Terraform workspace: $SAFE_WORKSPACE_NAME"
echo "[runtime] Runner host: $(hostname)"
echo "[runtime] Terraform target AWS Region: $AWS_DEFAULT_REGION"
if [ -n "$TF_PAYLOAD_URL" ]; then
  echo "[runtime] Payload source: signed URL"
elif [ -n "$TF_CONFIG_B64" ]; then
  echo "[runtime] Payload source: TF_CONFIG_B64"
else
  echo "[runtime] Payload source: missing"
fi

# --- Load Configuration ---
if [ -n "$TF_PAYLOAD_URL" ]; then
  echo "[runtime] Downloading Terraform payload"
  curl -fsSL "$TF_PAYLOAD_URL" -o payload.json
  if ! jq -e '.hcl | type == "string" and length > 0' payload.json >/dev/null; then
    echo "[error] Terraform payload did not contain a non-empty hcl field"
    exit 1
  fi
  jq -r '.hcl' payload.json > main.tf

  if jq -e '.state != null' payload.json >/dev/null; then
    jq -c '.state' payload.json > terraform.tfstate
    chmod 600 terraform.tfstate
    echo "[runtime] Restored Terraform state"
  fi
elif [ -n "$TF_CONFIG_B64" ]; then
  echo "$TF_CONFIG_B64" | base64 -d > main.tf

  if [ -n "$TF_STATE_B64" ]; then
    echo "$TF_STATE_B64" | base64 -d > terraform.tfstate
    chmod 600 terraform.tfstate
    echo "[runtime] Restored Terraform state"
  fi
else
  echo "[error] TF_PAYLOAD_URL or TF_CONFIG_B64 is required"
  exit 1
fi

chmod 644 main.tf

echo "[debug] Generated main.tf:"
cat main.tf
# --- Helper Functions ---

# Sweep orphaned load balancers in all VPCs present in the state
sweep_vpc_elbs() {
  VPC_ADDRESSES=$(terraform state list 2>/dev/null | grep -E '^aws_vpc\.' || true)
  for vpc_addr in $VPC_ADDRESSES; do
    VPC_ID=$(terraform state show -no-color "$vpc_addr" 2>/dev/null | grep -E '^[[:space:]]*id[[:space:]]*=' | head -n1 | tr -d '[:space:]' | cut -d'=' -f2 | tr -d '"' || true)
    if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "null" ]; then
      echo "[step] Sweeping orphaned load balancers in VPC: $VPC_ID ($vpc_addr)"

      # Delete ELB v2 (ALB/NLB)
      ELBV2_ARNS=$(aws elbv2 describe-load-balancers --region "${AWS_DEFAULT_REGION:-us-east-1}" --query "LoadBalancers[?VpcId=='$VPC_ID'].LoadBalancerArn" --output text 2>/dev/null || true)
      for arn in $ELBV2_ARNS; do
        if [ -n "$arn" ] && [ "$arn" != "None" ]; then
          echo "[step] Deleting ELBv2: $arn"
          aws elbv2 delete-load-balancer --region "${AWS_DEFAULT_REGION:-us-east-1}" --load-balancer-arn "$arn" 2>/dev/null || true
        fi
      done

      # Delete ELB v1 (Classic LB)
      ELBV1_NAMES=$(aws elb describe-load-balancers --region "${AWS_DEFAULT_REGION:-us-east-1}" --query "LoadBalancerDescriptions[?VpcId=='$VPC_ID'].LoadBalancerName" --output text 2>/dev/null || true)
      for name in $ELBV1_NAMES; do
        if [ -n "$name" ] && [ "$name" != "None" ]; then
          echo "[step] Deleting Classic ELB: $name"
          aws elb delete-load-balancer --region "${AWS_DEFAULT_REGION:-us-east-1}" --load-balancer-name "$name" 2>/dev/null || true
        fi
      done

      # Give AWS a few seconds to begin teardown of ENIs
      if [ -n "$ELBV2_ARNS" ] || [ -n "$ELBV1_NAMES" ]; then
        echo "[step] Waiting 15 seconds for ELB network interfaces to detach..."
        sleep 15
      fi
    fi
  done
}

# Wait for Kubernetes LoadBalancer ingress hostnames to be populated
wait_for_k8s_load_balancers() {
  K8S_SERVICES=$(terraform state list 2>/dev/null | grep -E '^kubernetes_service\.' || true)
  if [ -n "$K8S_SERVICES" ]; then
    echo "[step] Waiting for Kubernetes LoadBalancer hostnames to populate..."
    for i in {1..18}; do
      echo "[step] Checking LoadBalancer status (attempt $i/18)..."
      terraform refresh -no-color -input=false >/dev/null 2>&1 || true
      
      all_populated=true
      for svc in $K8S_SERVICES; do
        state_output=$(terraform state show -no-color "$svc" 2>/dev/null || true)
        if echo "$state_output" | grep -q 'type[[:space:]]*=[[:space:]]*"LoadBalancer"'; then
          hostname=$(echo "$state_output" | grep -E 'hostname[[:space:]]*=' | head -n1 | tr -d '[:space:]' | cut -d'=' -f2 | tr -d '"' || true)
          if [ -z "$hostname" ] || [ "$hostname" = "null" ]; then
            echo "[step] Service $svc load balancer hostname is not yet available."
            all_populated=false
          else
            echo "[step] Service $svc load balancer hostname is live: $hostname"
          fi
        fi
      done
      
      if [ "$all_populated" = "true" ]; then
        echo "[step] All Kubernetes LoadBalancer hostnames are populated."
        break
      fi
      sleep 10
    done
  fi
}

# --- Terraform Execution ---
publish_state_if_available() {
  echo "[step] capturing state"
  if terraform state pull > state.json 2>/tmp/terraform-state-pull.err; then
    if [ -n "$TF_STATE_PUT_URL" ]; then
      curl -fsS -X PUT -H "Content-Type: application/json" --upload-file state.json "$TF_STATE_PUT_URL"
      echo "[runtime] Uploaded Terraform state"
    else
      echo "---BEGIN-STATE---"
      cat state.json
      echo "---END-STATE---"
    fi
    return 0
  fi

  echo "[warn] Terraform state was not available to capture"
  if [ -s /tmp/terraform-state-pull.err ]; then
    cat /tmp/terraform-state-pull.err
  fi
  return 1
}

# 1. Initialize
echo "[step] terraform init"
if ! terraform init -no-color -input=false; then
  echo "[error] terraform init failed"
  exit 1
fi

# Seed back any new plugins to the shared volume (no-clobber to avoid locks)
if [ -d /plugin-cache-seed ]; then
  cp -n -r /home/tfuser/.terraform.d/plugin-cache/* /plugin-cache-seed/ 2>/dev/null || true
fi

# Destroy path for persisted simulations
if [ "$TF_ACTION" = "destroy" ]; then
  # Proactively sweep ELBs in the VPC before starting destroy
  sweep_vpc_elbs

  # 1a. Proactively destroy Kubernetes resources first while EKS cluster is fully functional
  echo "[step] Proactively destroying Kubernetes resources first..."
  K8S_RESOURCES=$(terraform state list 2>/dev/null | grep -E '^kubernetes_' || true)
  if [ -n "$K8S_RESOURCES" ]; then
    TARGETS=""
    for res in $K8S_RESOURCES; do
      TARGETS="$TARGETS -target=$res"
    done
    echo "[step] Targeted Kubernetes resources for early destruction: $TARGETS"
    # Run targeted destroy with a 5-minute (300-second) timeout; if it fails or times out, remove from state
    if ! timeout 300 terraform destroy $TARGETS -no-color -input=false -auto-approve; then
      echo "[warning] Proactive targeted destroy of Kubernetes resources failed or timed out. Removing from state..."
      for res in $K8S_RESOURCES; do
        echo "[step] Removing stuck resource from state: $res"
        terraform state rm "$res" || true
      done
    fi
    # Sweep VPC ELBs immediately after trying to delete k8s resources, just in case
    sweep_vpc_elbs
    # Publish state immediately so deletion of k8s resources is persisted
    publish_state_if_available || true
  fi

  # 1b. Proactively destroy EKS cluster, node groups, and addons second
  echo "[step] Proactively destroying EKS AWS resources second..."
  EKS_AWS_RESOURCES=$(terraform state list 2>/dev/null | grep -E '^(aws_eks_cluster\.|aws_eks_node_group\.|aws_eks_addon\.)' || true)
  if [ -n "$EKS_AWS_RESOURCES" ]; then
    TARGETS=""
    for res in $EKS_AWS_RESOURCES; do
      TARGETS="$TARGETS -target=$res"
    done
    echo "[step] Targeted EKS AWS resources for early destruction: $TARGETS"
    # Run targeted destroy with a 15-minute (900-second) timeout; if it fails or times out, remove from state
    if ! timeout 900 terraform destroy $TARGETS -no-color -input=false -auto-approve; then
      echo "[warning] Proactive targeted destroy of EKS AWS resources failed or timed out. Removing from state..."
      for res in $EKS_AWS_RESOURCES; do
        echo "[step] Removing stuck resource from state: $res"
        terraform state rm "$res" || true
      done
    fi
    # Sweep VPC ELBs again after EKS cluster is gone to catch any orphaned ELBs
    sweep_vpc_elbs
    # Publish state immediately so deletion of EKS resources is persisted
    publish_state_if_available || true
  fi

  echo "[step] terraform plan destroy"
  if ! terraform plan -destroy -no-color -input=false -out=tfplan; then
    echo "[warning] terraform destroy plan failed. Attempting self-healing by removing kubernetes/EKS resources from state..."
    for res in $(terraform state list 2>/dev/null | grep -E '^(kubernetes_|aws_eks_cluster\.|aws_eks_node_group\.|aws_eks_addon\.)'); do
      echo "[step] Removing stuck resource from state: $res"
      terraform state rm "$res" || true
    done
    # Sweep any orphaned ELBs in case EKS control plane is already gone
    sweep_vpc_elbs
    echo "[step] Retrying terraform plan destroy"
    if ! terraform plan -destroy -no-color -input=false -out=tfplan; then
      echo "[error] terraform destroy plan failed after state cleanup"
      publish_state_if_available || true
      exit 1
    fi
  fi

  echo "[step] terraform destroy"
  if ! terraform apply -no-color -input=false -auto-approve tfplan; then
    echo "[warning] terraform destroy failed. Attempting state cleanup and retry..."
    for res in $(terraform state list 2>/dev/null | grep -E '^(kubernetes_|aws_eks_cluster\.|aws_eks_node_group\.|aws_eks_addon\.)'); do
      echo "[step] Removing stuck resource from state: $res"
      terraform state rm "$res" || true
    done
    
    # Sweep any orphaned ELBs that were left behind by the EKS cluster deletion
    sweep_vpc_elbs

    echo "[step] Retrying terraform plan and destroy after failure"
    if terraform plan -destroy -no-color -input=false -out=tfplan; then
      if terraform apply -no-color -input=false -auto-approve tfplan; then
        echo "[success] destroy complete after retry"
        exit 0
      fi
    fi
    # If it still fails, sweep again as a final effort before giving up
    sweep_vpc_elbs
    echo "[error] terraform destroy failed after retry"
    publish_state_if_available || true
    exit 1
  fi

  echo "[success] destroy complete"
  exit 0
fi

# 2. Plan (Optional, but good for validation)
echo "[step] terraform plan"
if ! terraform plan -no-color -input=false -out=tfplan; then
  echo "[error] terraform plan failed"
  exit 1
fi

# 3. Apply
echo "[step] terraform apply"
if ! terraform apply -no-color -input=false -auto-approve tfplan; then
  echo "[error] terraform apply failed"
  publish_state_if_available || true
  exit 1
fi

# Wait for LoadBalancer hostnames to populate
wait_for_k8s_load_balancers

# 4. Output
echo "[step] capturing outputs"
terraform output -json > outputs.json

if [ -n "$TF_OUTPUTS_PUT_URL" ]; then
  curl -fsS -X PUT -H "Content-Type: application/json" --upload-file outputs.json "$TF_OUTPUTS_PUT_URL"
  echo "[runtime] Uploaded Terraform outputs"
else
  echo "---BEGIN-OUTPUTS---"
  cat outputs.json
  echo "---END-OUTPUTS---"
fi

# 5. State
publish_state_if_available

echo "[success] deployment complete"

# --- Cleanup happens outside by the container manager ---
exit 0
