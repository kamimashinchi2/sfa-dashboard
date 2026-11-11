import type { Metadata } from "next";
import { LoginForm } from "../components/academy/AuthForm";

export const metadata: Metadata = {
  title: "Log in — Smart Financial Academy",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
