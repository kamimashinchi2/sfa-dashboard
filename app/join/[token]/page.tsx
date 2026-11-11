import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "../../components/academy/AuthForm";

export const metadata: Metadata = {
  title: "Join — Smart Financial Academy",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

async function JoinBody({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SignupForm token={token} />;
}

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-fog">…</div>}>
      <JoinBody params={params} />
    </Suspense>
  );
}
