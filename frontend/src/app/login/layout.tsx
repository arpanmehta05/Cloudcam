import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Cloudcam",
  description:
    "Sign in to your Cloudcam account to manage cloud costs, trace AI model spend, monitor infrastructure, and optimize FinOps workflows.",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
