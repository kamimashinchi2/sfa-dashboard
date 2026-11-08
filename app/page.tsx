const JOURNAL_URL =
  "https://drive.google.com/drive/folders/1cTzdyCZWhywRVCbv2_vPg1CWGps51FVC";

const structureLabels = [
  { code: "HH", name: "Higher High" },
  { code: "HL", name: "Higher Low" },
  { code: "LH", name: "Lower High" },
  { code: "LL", name: "Lower Low" },
];

const priceActionRules = [
  "Swing Highs / Swing Lows",
  "Break of Structure (BOS)",
  "Change of Character (CHoCH)",
  "Liquidity Sweeps",
  "Fair Value Gaps (FVG)",
];

export default function Home() {
  return (
    <div className="atmosphere relative flex min-h-full flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-sheen opacity-70"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
        <p className="font-display text-sm tracking-[0.18em] text-gold-soft uppercase">
          Student desk
        </p>
        <a
          href="#rules"
          className="text-sm text-fog transition-colors hover:text-paper"
        >
          Rule cheat sheet
        </a>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        {/* Hero — one composition: brand, mission headline, support, CTA, chart plane */}
        <section className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-16 pt-6 sm:px-8 lg:pb-24">
          <div
            aria-hidden
            className="chart-silhouette pointer-events-none absolute inset-y-8 -right-8 left-[28%] hidden opacity-80 md:block lg:left-[36%]"
          />

          <div className="relative max-w-xl lg:max-w-2xl">
            <p className="reveal font-display text-4xl leading-[0.95] tracking-tight text-paper sm:text-5xl md:text-6xl lg:text-7xl">
              Smart Financial
              <span className="block text-gold-soft">Academy</span>
            </p>

            <h1 className="reveal reveal-delay-1 mt-8 max-w-lg font-display text-2xl leading-snug text-paper sm:text-3xl">
              Mission 1: Market Structure
            </h1>

            <p className="reveal reveal-delay-2 mt-4 max-w-md text-base leading-relaxed text-fog sm:text-lg">
              Identify HH, HL, LH, LL and label structure on HTF (4H) against LTF
              (15m).
            </p>

            <div className="reveal reveal-delay-3 mt-10">
              <a
                href={JOURNAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-pulse inline-flex items-center justify-center rounded-md bg-gold px-6 py-3.5 text-sm font-semibold tracking-wide text-ink transition-[transform,background-color] duration-200 hover:bg-gold-soft hover:translate-y-[-1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Submit Weekly Trade Journal
              </a>
            </div>
          </div>
        </section>

        {/* Current mission detail */}
        <section
          id="mission"
          className="relative border-t border-line bg-ink-elevated/40"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-20">
            <div>
              <p className="text-xs font-medium tracking-[0.22em] text-teal-bright uppercase">
                Current weekly mission
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-paper sm:text-4xl">
                Market Structure
              </h2>
              <p className="mt-4 max-w-prose text-base leading-relaxed text-fog">
                Build the habit of reading trend through swing points. Mark
                structure on the higher timeframe first, then confirm how the
                lower timeframe is unfolding inside that bias.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5 self-center">
              {structureLabels.map((item) => (
                <div key={item.code} className="border-l border-gold/40 pl-4">
                  <p className="font-mono text-lg text-gold">{item.code}</p>
                  <p className="mt-1 text-sm text-fog">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trading rule cheat sheet */}
        <section id="rules" className="relative border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-[0.22em] text-teal-bright uppercase">
                Master Curriculum &amp; Rulebook v1.0
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-paper sm:text-4xl">
                Trading rule cheat sheet
              </h2>
              <p className="mt-4 text-base leading-relaxed text-fog">
                Keep these constraints visible while you journal. Entries come
                from price action; indicators stay contextual.
              </p>
            </div>

            <div className="mt-12 grid gap-10 lg:grid-cols-3">
              <article>
                <h3 className="font-display text-xl text-paper">
                  Pure price action
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-fog">
                  {priceActionRules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-bright" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article>
                <h3 className="font-display text-xl text-paper">
                  Risk &amp; execution
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-fog">
                  <li>
                    Minimum R:R{" "}
                    <span className="font-mono text-gold-soft">1:2</span> —
                    anything below is rejected.
                  </li>
                  <li>
                    Indicators (EMA / VWAP) are contextual only; entries come
                    from price action.
                  </li>
                  <li>
                    Max risk{" "}
                    <span className="font-mono text-gold-soft">1.0%</span> of
                    equity. Stop-loss is mandatory — no mental stops.
                  </li>
                </ul>
              </article>

              <article>
                <h3 className="font-display text-xl text-paper">
                  Position sizing
                </h3>
                <div className="mt-4 space-y-4 text-sm leading-relaxed text-fog">
                  <p>
                    Lot Size = (Account Capital × Risk %) ÷ (Stop Distance in
                    Points/Pips × Point Value)
                  </p>
                  <div>
                    <p className="font-medium text-paper">Forex (EUR/USD)</p>
                    <p className="mt-1">
                      1 lot = 100,000 units ($10/pip per 1.00 lot)
                    </p>
                    <p className="mt-1 font-mono text-xs text-gold-soft">
                      Lot = (Equity × 0.01) ÷ (Stop Pips × 10)
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-paper">Spot Gold (XAU/USD)</p>
                    <p className="mt-1">1 lot = 100 oz</p>
                    <p className="mt-1 font-mono text-xs text-gold-soft">
                      Lot = (Equity × 0.01) ÷ (|Entry − Stop| × 100)
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-14 border-t border-line pt-10">
              <a
                href={JOURNAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-gold/50 px-6 py-3.5 text-sm font-semibold tracking-wide text-gold-soft transition-colors hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Submit Weekly Trade Journal
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-fog sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-display text-paper">Smart Financial Academy</p>
          <p>Weekly student dashboard · Mission 1</p>
        </div>
      </footer>
    </div>
  );
}
