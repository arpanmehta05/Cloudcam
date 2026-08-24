// OTP Model — stores 6-digit OTPs with auto-expiry via MongoDB TTL index
import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  email: string;
  otpHash: string; // bcrypt hash of the OTP
  purpose: string; // e.g. "email-verify", "password-reset", "login-2fa"
  attempts: number; // failed attempt counter
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      required: true,
      default: "email-verify",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL — document deleted when expiresAt is reached
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Compound index to quickly find the latest OTP for email+purpose
otpSchema.index({ email: 1, purpose: 1 });

export const Otp = mongoose.model<IOtp>("Otp", otpSchema);
