export type ConfirmModalType = "info" | "success" | "warning" | "danger" | "default";

export type ConfirmModalState = {
  isOpen: boolean;
  title: string;
  description: string;
  type: ConfirmModalType;
  primaryLabel: string;
  onConfirm: () => void | Promise<void>;
};

export type ErrorModalState = {
  isOpen: boolean;
  title: string;
  message: string;
};

export type ShowConfirm = (
  title: string,
  description: string,
  type: ConfirmModalType,
  primaryLabel: string,
  onConfirm: () => void | Promise<void>
) => void;
