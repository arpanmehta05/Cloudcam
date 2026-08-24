import jwt from "jsonwebtoken";
import { IUser } from "../models/user.model";
import { config } from "../../../core/config";

const JWT_EXPIRES_IN = "7d";

export function generateToken(user: IUser): string {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      permissionLevel: user.permissionLevel || "operator",
    },
    config.jwtSecret,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

export function verifyToken(token: string): {
  userId: string;
  email: string;
  permissionLevel?: string;
} {
  return jwt.verify(token, config.jwtSecret) as {
    userId: string;
    email: string;
    permissionLevel?: string;
  };
}
