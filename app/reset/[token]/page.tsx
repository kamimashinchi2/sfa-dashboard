import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetForm } from "../../components/academy/AuthForm";

export const metadata: Metadata = {
  title: "Reset password — Smart Financial Academy",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

async function ResetBody({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetForm token={token} />;
}

export default function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-fog">…</div>}>
      <ResetBody params={params} />
    </Suspense>
  );
}
