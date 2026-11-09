import AcademyShell from "../components/academy/AcademyShell";
import StageMap from "../components/academy/StageMap";
import Link from "next/link";
import { missions } from "../lib/academy/curriculum";
import { advancedModules } from "../lib/academy/advancedCurriculum";
import { resolveBuildStamp } from "../lib/academy/buildStamp";

export default function AcademyPage() {
  const stamp = resolveBuildStamp();
  return (
    <AcademyShell>
      <div className="mx-auto w-full max-w-6xl space-y-12 px-6 py-10 sm:px-8">
        <section>
          <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
            Student Learning Portal · Pilot · {stamp.label}
          </p>
          <h1 className="mt-3 font-display text-4xl text-paper sm:text-5xl">
            Bilingual academy · M1–M5 + A6–A8 labs
          </h1>
          <p className="mt-4 max-w-2xl text-fog">
            Browse all eight stages as PREVIEW. Unlock assessed practice with
            objective score ≥80, completed tasks, and no unresolved risk hold.
            Advanced labs are feature-flagged. Data are SYNTHETIC.
          </p>
        </section>

        <StageMap />

        <section>
          <h2 className="font-display text-3xl text-paper">Pilot missions</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {missions.map((m) => (
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
            {advancedModules.map((m) => (
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
