import { Suspense } from "react";
import AcademyShell from "../../../components/academy/AcademyShell";
import MissionWorkspace from "../../../components/academy/MissionWorkspace";

export function generateStaticParams() {
  return [
    { missionId: "M1" },
    { missionId: "M2" },
    { missionId: "M3" },
    { missionId: "M4" },
    { missionId: "M5" },
  ];
}

async function MissionBody({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  const { missionId } = await params;
  return <MissionWorkspace missionId={missionId} />;
}

export default function MissionPage({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  return (
    <AcademyShell>
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl px-6 py-16 text-fog">Loading mission…</div>
        }
      >
        <MissionBody params={params} />
      </Suspense>
    </AcademyShell>
  );
}
