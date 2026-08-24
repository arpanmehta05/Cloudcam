import { useEffect } from "react";
import type { Node as FlowNode } from "reactflow";
import { authFetch } from "@/lib/auth-fetch";
import { deriveLiveInfraKeyName } from "./liveCanvasHelpers";

type SafetyCheck = {
  loading: boolean;
  isDeletable: boolean;
  reason: string | null;
  helperAction: string | null;
  helperLabel: string | null;
  warning: string | null;
} | null;

type UseLiveCanvasSelectedNodeEffectsParams = {
  selectedNode: FlowNode | null;
  selectedProvider: string;
  region: string;
  setSshUsername: (value: string) => void;
  setSshKeyName: (value: string) => void;
  setLambdaCode: (value: string | null) => void;
  setLambdaFilename: (value: string) => void;
  setIsLambdaCodeLoading: (value: boolean) => void;
  setIsCodeDirty: (value: boolean) => void;
  setSafetyCheck: (value: SafetyCheck) => void;
};

export function useLiveCanvasSelectedNodeEffects({
  selectedNode,
  selectedProvider,
  region,
  setSshUsername,
  setSshKeyName,
  setLambdaCode,
  setLambdaFilename,
  setIsLambdaCodeLoading,
  setIsCodeDirty,
  setSafetyCheck,
}: UseLiveCanvasSelectedNodeEffectsParams) {
  useEffect(() => {
    if (selectedNode) {
      const defaultUser =
        selectedNode.data.serviceId === "ec2"
          ? "ec2-user"
          : selectedNode.data.serviceId === "azure_vm"
          ? "azureuser"
          : "cloudwatcher";
      const defaultKey =
        selectedNode.data.serviceId === "ec2"
          ? selectedNode.data.item?.keyName || "sim-key"
          : deriveLiveInfraKeyName(selectedNode.data.item, selectedNode.data.serviceId, selectedProvider);
      setSshUsername(defaultUser);
      setSshKeyName(defaultKey);
    }
  }, [selectedNode, selectedProvider, setSshUsername, setSshKeyName]);

  useEffect(() => {
    if (selectedNode && selectedNode.data.serviceId === "lambda" && selectedProvider === "aws") {
      const resourceId = selectedNode.data.item ? (selectedNode.data.item.arn || selectedNode.data.item.id || selectedNode.data.item.name) : selectedNode.id;
      const resourceRegion = selectedNode.data.item?.region || region;
      
      setIsLambdaCodeLoading(true);
      setLambdaCode(null);
      setIsCodeDirty(false);
      
      authFetch(`/api/aws/resources/${encodeURIComponent(resourceId)}/code?region=${resourceRegion}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLambdaCode(data.code);
            setLambdaFilename(data.filename || "index.js");
          } else {
            console.error("Failed to fetch lambda code:", data.error);
            setLambdaCode("// Error loading code: " + (data.error || "Unknown error"));
          }
        })
        .catch(err => {
          console.error("Error fetching lambda code:", err);
          setLambdaCode("// Error loading code: " + err.message);
        })
        .finally(() => {
          setIsLambdaCodeLoading(false);
        });
    } else {
      setLambdaCode(null);
      setIsCodeDirty(false);
    }
  }, [selectedNode, region, selectedProvider, setLambdaCode, setLambdaFilename, setIsLambdaCodeLoading, setIsCodeDirty]);

  useEffect(() => {
    if (selectedNode && selectedProvider === "aws") {
      const resourceId = selectedNode.data.item ? (selectedNode.data.item.arn || selectedNode.data.item.id || selectedNode.data.item.name) : selectedNode.id;
      const resourceRegion = selectedNode.data.item?.region || region;
      const service = selectedNode.data.serviceId;
      
      if (["s3", "cloudfront", "rds", "dynamodb", "ec2"].includes(service)) {
        setSafetyCheck({
          loading: true,
          isDeletable: true,
          reason: null,
          helperAction: null,
          helperLabel: null,
          warning: null
        });

        authFetch(`/api/aws/resources/${encodeURIComponent(resourceId)}/safety-check?service=${service}&region=${resourceRegion}`)
          .then((res) => {
            if (!res.ok) {
              return null;
            }
            return res.json();
          })
          .then(data => {
            if (!data) {
              setSafetyCheck(null);
              return;
            }
            if (data.success) {
              setSafetyCheck({
                loading: false,
                isDeletable: data.isDeletable,
                reason: data.reason,
                helperAction: data.helperAction,
                helperLabel: data.helperLabel,
                warning: data.warning
              });
            } else {
              setSafetyCheck(null);
            }
          })
          .catch(() => {
            setSafetyCheck(null);
          });
      } else {
        setSafetyCheck(null);
      }
    } else {
      setSafetyCheck(null);
    }
  }, [selectedNode, region, selectedProvider, setSafetyCheck]);
}
