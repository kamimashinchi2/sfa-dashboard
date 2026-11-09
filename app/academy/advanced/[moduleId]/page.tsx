import { Suspense } from "react";
import AcademyShell from "../../../components/academy/AcademyShell";
import AdvancedTrack from "../../../components/academy/AdvancedTrack";

export function generateStaticParams() {
  return [{ moduleId: "A6" }, { moduleId: "A7" }, { moduleId: "A8" }];
}

async function AdvancedBody({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  return <AdvancedTrack moduleId={moduleId} />;
}

export default function AdvancedPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  return (
    <AcademyShell>
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl px-6 py-16 text-fog">
            Loading advanced module…
          </div>
        }
      >
        <AdvancedBody params={params} />
      </Suspense>
    </AcademyShell>
  );
}
