import { Router } from "express";
import {
  signupHandler,
  verifySignupHandler,
  loginHandler,
  verifyLogin2faHandler,
  resendLogin2faHandler,
  forgotPasswordHandler,
  verifyForgotPasswordHandler,
  resetPasswordHandler,
  resetPasswordFirstLoginHandler,
  restoreAccountHandler,
  meHandler,
  updateProfileHandler,
  updateTwoFactorHandler,
  beginTotpSetupHandler,
  confirmTotpSetupHandler,
  removeTotpSetupHandler,
  setPasswordHandler,
  scheduleAccountDeletionHandler,
  getSecurityEventsHandler,
} from "./controllers";
import { authMiddleware, requireRole } from "./middleware";

const authRouter = Router();

// Public routes
authRouter.post("/signup", signupHandler);
authRouter.post("/signup/verify", verifySignupHandler);
authRouter.post("/login", loginHandler);
authRouter.post("/login/2fa", verifyLogin2faHandler);
authRouter.post("/login/2fa/resend", resendLogin2faHandler);
authRouter.post("/forgot-password", forgotPasswordHandler);
authRouter.post("/forgot-password/verify", verifyForgotPasswordHandler);
authRouter.post("/reset-password", resetPasswordHandler);
authRouter.post("/reset-password-first-login", resetPasswordFirstLoginHandler);
authRouter.post("/restore-account", restoreAccountHandler);

// Protected routes (require authMiddleware)
authRouter.get("/me", authMiddleware, meHandler);
authRouter.patch("/profile", authMiddleware, updateProfileHandler);
authRouter.patch("/2fa", authMiddleware, updateTwoFactorHandler);
authRouter.post("/2fa/totp/setup", authMiddleware, beginTotpSetupHandler);
authRouter.post("/2fa/totp/confirm", authMiddleware, confirmTotpSetupHandler);
authRouter.delete("/2fa/totp", authMiddleware, removeTotpSetupHandler);
authRouter.post("/set-password", authMiddleware, setPasswordHandler);
authRouter.post(
  "/delete-account",
  authMiddleware,
  requireRole(["admin"]),
  scheduleAccountDeletionHandler,
);
authRouter.get("/security-events", authMiddleware, getSecurityEventsHandler);

export { authRouter };
