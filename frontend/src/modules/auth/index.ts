// ─── Auth Module — Public Interface ─────────────────────────────────────────
// External callers must import from this barrel only — never from internal paths.
export { LoginForm } from "./components/LoginForm";
export { SignupForm } from "./components/SignupForm";
export { ForgotPasswordForm } from "./components/ForgotPasswordForm";
export { TotpSetup } from "./components/TotpSetup";
export { useLogin } from "./hooks/useLogin";
export { useSignup } from "./hooks/useSignup";
export { useTwoFactor } from "./hooks/useTwoFactor";
export type { User, AuthSession, LoginResult } from "./api/auth.api";
export { default as VerifySignupPage } from "./components/pages/VerifySignupPage";
export { default as ResetPasswordPage } from "./components/pages/ResetPasswordPage";
export { default as TwoFactorPage } from "./components/pages/TwoFactorPage";
export { default as OAuthCallbackPage } from "./components/pages/OAuthCallbackPage";
