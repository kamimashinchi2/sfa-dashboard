import { Suspense } from "react";
import Link from "next/link";
import AcademyShell from "../../components/academy/AcademyShell";
import SetupValidator from "../../components/academy/SetupValidator";
import MacroTransmissionBuilder from "../../components/academy/MacroTransmissionBuilder";
import RiskGridSimulator from "../../components/academy/RiskGridSimulator";

const TOOLS = ["setup-validator", "macro-chain", "risk-grid"] as const;

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ tool }));
}

async function SimulatorBody({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const valid = (TOOLS as readonly string[]).includes(tool);

  if (!valid) {
    return (
      <>
        <h1 className="font-display text-3xl text-paper">Simulator not found</h1>
        <p className="text-fog">
          Try{" "}
          {TOOLS.map((t) => (
            <Link key={t} href={`/simulators/${t}`} className="mx-1 text-gold-soft">
              {t}
            </Link>
          ))}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl text-paper">{tool}</h1>
      {tool === "setup-validator" ? <SetupValidator /> : null}
      {tool === "macro-chain" ? <MacroTransmissionBuilder /> : null}
      {tool === "risk-grid" ? <RiskGridSimulator /> : null}
    </>
  );
}

export default function SimulatorPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  return (
    <AcademyShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8">
        <Suspense fallback={<p className="text-fog">Loading simulator…</p>}>
          <SimulatorBody params={params} />
        </Suspense>
      </div>
    </AcademyShell>
  );
}
