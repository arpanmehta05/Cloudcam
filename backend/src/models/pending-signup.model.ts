import mongoose, { Document, Schema } from "mongoose";

export interface IPendingSignup extends Document {
  email: string;
  name: string;
  passwordHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pendingSignupSchema = new Schema<IPendingSignup>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

export const PendingSignup = mongoose.model<IPendingSignup>(
  "PendingSignup",
  pendingSignupSchema,
);
