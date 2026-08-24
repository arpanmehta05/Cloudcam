import mongoose, { Document, Schema } from "mongoose";

export interface IAwsCredentialVault extends Document {
  userId: string;
  name: string;
  accessKeyIdLast4: string;
  defaultRegion?: string | null;
  hasSessionToken: boolean;
  encryptedAccessKeyId: string;
  encryptedSecretAccessKey: string;
  encryptedSessionToken?: string | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AwsCredentialVaultSchema = new Schema<IAwsCredentialVault>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    accessKeyIdLast4: { type: String, required: true },
    defaultRegion: { type: String, default: null },
    hasSessionToken: { type: Boolean, default: false },
    encryptedAccessKeyId: { type: String, required: true },
    encryptedSecretAccessKey: { type: String, required: true },
    encryptedSessionToken: { type: String, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

AwsCredentialVaultSchema.index({ userId: 1, name: 1 }, { unique: true });

AwsCredentialVaultSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedAccessKeyId;
  delete obj.encryptedSecretAccessKey;
  delete obj.encryptedSessionToken;
  return obj;
};

export const AwsCredentialVaultModel =
  mongoose.models.AwsCredentialVault ||
  mongoose.model<IAwsCredentialVault>(
    "AwsCredentialVault",
    AwsCredentialVaultSchema,
  );
