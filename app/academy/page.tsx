import AcademyShell from "../components/academy/AcademyShell";
import StageMap from "../components/academy/StageMap";
import Link from "next/link";
import {
  publicAdvanced,
  publicMissions,
} from "../lib/academy/publicCatalog";
import { resolveBuildStamp } from "../lib/academy/buildStamp";

export default function AcademyPage() {
  const stamp = resolveBuildStamp();
  return (
    <AcademyShell>
      <div className="mx-auto w-full max-w-6xl space-y-12 px-6 py-10 sm:px-8">
        <section className="space-y-3 border border-gold/50 bg-ink/60 p-4" data-testid="next-step">
          <p className="text-[10px] tracking-[0.18em] text-gold-soft uppercase">What to do next</p>
          <h1 className="font-display text-3xl text-paper">Open your academy dashboard</h1>
          <p className="max-w-2xl text-fog">
            The dashboard names the one step for this week: read the lesson, submit the quiz, or upload the assignment. A quiz does not open the next lesson.
          </p>
          <Link href="/progress" className="inline-flex min-h-11 items-center border border-gold/50 px-3 text-sm text-gold-soft">
            Go to the dashboard
          </Link>
          <p className="text-[10px] text-fog">{stamp.label}</p>
        </section>

        <StageMap />

        <section>
          <h2 className="font-display text-3xl text-paper">Pilot missions</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {publicMissions.map((m) => (
              <li key={m.id} className="border border-line bg-ink/40 p-4">
                <Link
                  href={m.href}
                  className="font-display text-xl text-gold-soft hover:underline"
                >
                  {m.title.en}
                </Link>
                <p className="mt-2 text-sm text-fog" lang="fa" dir="rtl">
                  {m.title.fa}
                </p>
              </li>
            ))}
          </ul>
          <h2 className="mt-10 font-display text-3xl text-paper">
            Advanced labs (Stages 6–8)
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {publicAdvanced.map((m) => (
              <li key={m.id} className="border border-line bg-ink/40 p-4">
                <Link
                  href={m.href}
                  className="font-display text-xl text-gold-soft hover:underline"
                >
                  {m.title.en}
                </Link>
                <p className="mt-2 text-sm text-fog" lang="fa" dir="rtl">
                  {m.title.fa}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link href="/simulators/setup-validator" className="text-gold-soft hover:underline">
              Setup validator
            </Link>
            <Link href="/simulators/macro-chain" className="text-gold-soft hover:underline">
              Macro chain
            </Link>
            <Link href="/simulators/risk-grid" className="text-gold-soft hover:underline">
              Risk grid
            </Link>
            <Link href="/journal/builder" className="text-gold-soft hover:underline">
              Journal builder
            </Link>
            <Link href="/progress" className="text-gold-soft hover:underline">
              Progress
            </Link>
          </div>
        </section>
      </div>
    </AcademyShell>
  );
}
