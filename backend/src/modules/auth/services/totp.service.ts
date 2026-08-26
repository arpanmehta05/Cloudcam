import crypto from "crypto";
import QRCode from "qrcode";
import { User, decryptKey, encryptKey } from "../models/user.model";
import { formatUser } from "./format";

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateBase32Secret(length = 32): string {
  const bytes = crypto.randomBytes(length);
  let secret = "";
  for (const byte of bytes) {
    secret += BASE32_ALPHABET[byte % BASE32_ALPHABET.length];
  }
  return secret;
}

function decodeBase32(secret: string): Buffer {
  const clean = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error("Invalid authenticator secret");
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret: string, counter: number): string {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

export function verifyTotp(secret: string, code: string): boolean {
  const sanitized = code.replace(/\D/g, "");
  if (sanitized.length !== TOTP_DIGITS) return false;
  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  for (let drift = -1; drift <= 1; drift += 1) {
    if (generateTotp(secret, currentCounter + drift) === sanitized) return true;
  }
  return false;
}

export async function beginTotpSetup(userId: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const secret = generateBase32Secret();
  user.tempTwoFactorTotpSecret = encryptKey(secret);
  user.twoFactorTotpSecret = null;
  await user.save();

  const issuer = "Cloudcam";
  const label = `${issuer}:${user.email || user.username || "TeamUser"}`;
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(
    label,
  )}?secret=${secret}&issuer=${encodeURIComponent(
    issuer,
  )}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

export async function confirmTotpSetup(
  userId: string,
  code: string,
): Promise<ReturnType<typeof formatUser>> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.tempTwoFactorTotpSecret) {
    throw new Error("Authenticator setup has not been started");
  }

  const valid = verifyTotp(decryptKey(user.tempTwoFactorTotpSecret), code);
  if (!valid) throw new Error("Invalid authenticator code");

  user.twoFactorTotpSecret = user.tempTwoFactorTotpSecret;
  user.tempTwoFactorTotpSecret = null;
  user.twoFactorEnabled = true;
  user.twoFactorMethod = "totp";
  await user.save();
  return formatUser(user);
}

export async function removeTotpSetup(
  userId: string,
): Promise<ReturnType<typeof formatUser>> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.twoFactorTotpSecret = null;
  user.tempTwoFactorTotpSecret = null;
  if (user.username) {
    // For team members, disable 2FA completely when TOTP is removed
    user.twoFactorEnabled = false;
    user.twoFactorMethod = "totp";
  } else {
    // Root users fall back to email 2FA
    user.twoFactorMethod = "email";
    user.twoFactorEnabled = true;
  }
  await user.save();
  return formatUser(user);
}
