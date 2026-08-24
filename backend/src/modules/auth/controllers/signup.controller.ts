import { Request, Response } from "express";
import { signup, verifySignup } from "../services";
import { errorStatus, authErrorMessage, normalizeOtp } from "./utils";

export async function signupHandler(req: Request, res: Response) {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: "Email, name, and password are required",
      });
    }

    const result = await signup(email, name, password);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    if (errorStatus(error, 400) === 429) {
      const email = String(req.body?.email || "")
        .toLowerCase()
        .trim();
      res.status(200).json({
        success: true,
        email,
        message:
          error.message ||
          "A verification code was already sent. Please check your inbox.",
        resendAfterSecs: error.resendAfterSecs,
      });
      return;
    }

    res.status(errorStatus(error, 400)).json({
      success: false,
      error: authErrorMessage(
        error,
        "Failed to start signup verification. Try again later.",
      ),
      resendAfterSecs: error.resendAfterSecs,
    });
  }
}

export async function verifySignupHandler(req: Request, res: Response) {
  try {
    const { email } = req.body;
    const code = normalizeOtp(req.body?.code);
    if (!email || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: "Email and a 6 digit OTP are required",
      });
    }

    const result = await verifySignup(email, code);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res
      .status(errorStatus(error, 400))
      .json({ success: false, error: error.message });
  }
}
