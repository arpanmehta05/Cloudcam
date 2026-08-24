"use client";

import { DynamicModal } from "@/components/ui/DynamicModal";
import type { ConfirmModalState, ErrorModalState } from "./types";

type ProfileDashboardModalsProps = {
  confirmModal: ConfirmModalState;
  errorModal: ErrorModalState;
  closeConfirm: () => void;
  closeError: () => void;
};

export function ProfileDashboardModals({
  confirmModal,
  errorModal,
  closeConfirm,
  closeError,
}: ProfileDashboardModalsProps) {
  return (
    <>
      <DynamicModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        type={confirmModal.type}
        primaryAction={{
          label: confirmModal.primaryLabel,
          onClick: confirmModal.onConfirm,
          variant:
            confirmModal.type === "danger"
              ? "destructive"
              : confirmModal.type === "success"
                ? "emerald"
                : "default",
        }}
        secondaryAction={{
          label: "Cancel",
          onClick: closeConfirm,
        }}
      />

      <DynamicModal
        isOpen={errorModal.isOpen}
        onClose={closeError}
        title={errorModal.title}
        description={errorModal.message}
        type="danger"
        primaryAction={{
          label: "Dismiss",
          onClick: closeError,
        }}
      />
    </>
  );
}
