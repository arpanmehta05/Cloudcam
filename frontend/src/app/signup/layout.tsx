import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your Account | CloudWatcher",
  description:
    "Sign up for CloudWatcher to optimize your AWS costs, monitor multicloud infrastructure, analyze AI model spend, and automate FinOps workflows.",
};

export default function SignupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
