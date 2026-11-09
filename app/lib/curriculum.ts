export type ReadingLink = {
  label: string;
  href: string;
};

export type Stage = {
  id: number;
  title: string;
  overview: string;
  principles: string[];
  links: ReadingLink[];
  milestones: string[];
  mission: string;
  audioTitle: string;
  audioNote: string;
};

/** 02_Student_Submissions — Google Drive */
export const JOURNAL_URL =
  "https://drive.google.com/drive/folders/1cTzdyCZWhywRVCbv2_vPg1CWGps51FVC";

export const ESSENTIAL_LINKS: ReadingLink[] = [
  {
    label: "BabyPips — School of Pipsology",
    href: "https://www.babypips.com/learn/forex",
  },
  {
    label: "CME — FX Education",
    href: "https://www.cmegroup.com/education/courses/introduction-to-fx.html",
  },
  {
    label: "BIS — FX Statistics",
    href: "https://www.bis.org/statistics/about_fx_stats.htm",
  },
  {
    label: "Banque de France — Statistics & research",
    href: "https://www.banque-france.fr/en/publications-and-statistics/statistics",
  },
];

export const stages: Stage[] = [
  {
    id: 1,
    title: "FX Foundations & Mechanics",
    overview:
      "Institutional fluency starts with quote convention, session liquidity, and contract math. Trade only what you can size and journal with precision.",
    principles: [
      "Base vs quote, pip/point value, and spread as a cost of business",
      "London–New York overlap as the primary execution window",
      "EUR/USD and XAU/USD lot math before any discretionary entry",
      "Hard stops only — mental stops are a rulebook violation",
      "Journal fields: thesis, structure, risk, outcome — every session",
    ],
    links: ESSENTIAL_LINKS,
    milestones: [
      "Convert a stop distance into dollars risked for EUR/USD and XAU/USD",
      "Label pip, point, and spread cost on a live chart screenshot",
      "Submit one practice journal entry with thesis + risk fields complete",
    ],
    mission:
      "Map one London–NY overlap session: annotate quote convention, spread, and a hypothetical 1.0% risk size for EUR/USD and XAU/USD. Submit the annotated journal to Drive.",
    audioTitle: "FX Mechanics Desk Briefing",
    audioNote:
      "NotebookLM audio overview covering pip math, sessions, and order hygiene. Placeholder until the stage recording is published.",
  },
  {
    id: 2,
    title: "Liquidity Pools & Order Types",
    overview:
      "Liquidity is the fuel of structural shifts. Map pools above highs and below lows, then choose the order type that expresses your plan without ambiguity.",
    principles: [
      "Liquidity pools rest beyond obvious swing highs and lows",
      "Sweeps often precede Break of Structure or Change of Character",
      "Market, limit, and stop orders each encode a different intent",
      "HTF (4H) bias frames where liquidity is meaningful; LTF (15m) times entry",
      "Never chase a sweep — wait for displacement and retest logic",
    ],
    links: [
      ...ESSENTIAL_LINKS.slice(0, 2),
      {
        label: "CME — Understanding FX liquidity",
        href: "https://www.cmegroup.com/education/articles-and-reports/understanding-fx-market-liquidity.html",
      },
      ESSENTIAL_LINKS[2],
      ESSENTIAL_LINKS[3],
    ],
    milestones: [
      "Mark two liquidity pools and the order type you would use at each",
      "Show one sweep that preceded a structural shift on 15m inside 4H bias",
      "Journal a rejected chase vs a planned retest entry",
    ],
    mission:
      "For Mission 1 market structure week: annotate HH/HL or LH/LL on 4H, locate one liquidity pool, and define the exact order type for a 15m execution plan. Cap risk at 1.0%.",
    audioTitle: "Liquidity & Order Intent Briefing",
    audioNote:
      "NotebookLM walkthrough of pools, sweeps, and institutional order choice. Audio file placeholder.",
  },
  {
    id: 3,
    title: "Chart Literacy & Price Action",
    overview:
      "Candles are narrative units. Read impulse, pullback, and rejection so entries come from price — indicators stay contextual.",
    principles: [
      "Rejection wicks at levels beat indicator crossovers for entries",
      "Impulse vs corrective legs define where risk belongs",
      "Session opens and range breaks create continuation signatures",
      "EMA / VWAP may frame context; they never replace structure",
      "Screenshot standards make reviews mentor-grade",
    ],
    links: [
      {
        label: "BabyPips — Japanese candlesticks",
        href: "https://www.babypips.com/learn/forex/japanese-candlesticks",
      },
      {
        label: "BabyPips — Support & resistance",
        href: "https://www.babypips.com/learn/forex/support-and-resistance",
      },
      ESSENTIAL_LINKS[1],
      ESSENTIAL_LINKS[2],
      ESSENTIAL_LINKS[3],
    ],
    milestones: [
      "Deliver three annotated charts: impulse → pullback → continuation",
      "Write a PA thesis with zero indicator-based entry language",
      "Score R:R ≥ 1:2 on a hypothetical entry from a marked level",
    ],
    mission:
      "Capture three price-action examples this week. Each must include entry logic, hard stop, and a target that clears 1:2. Submit screenshots to the student Drive folder.",
    audioTitle: "Price Action Narrative Briefing",
    audioNote:
      "NotebookLM audio on impulse, rejection, and continuation literacy. Placeholder embed.",
  },
  {
    id: 4,
    title: "Fundamental Macro & Fed Policy",
    overview:
      "Policy path and data releases shape dollar and gold regimes. Macro sets bias; price action still times the trade.",
    principles: [
      "Fed dual mandate and FOMC cycle are narrative — not entry signals",
      "CPI, NFP, PCE define calendar risk and stand-down windows",
      "USD strength regimes transmit directly into EUR/USD",
      "Gold behaves as a real-rate and risk-sentiment hybrid",
      "Macro notes require bias, catalysts, and invalidation",
    ],
    links: [
      {
        label: "Federal Reserve — Monetary Policy",
        href: "https://www.federalreserve.gov/monetarypolicy.htm",
      },
      {
        label: "CME FedWatch Tool",
        href: "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html",
      },
      ESSENTIAL_LINKS[2],
      ESSENTIAL_LINKS[3],
      ESSENTIAL_LINKS[0],
    ],
    milestones: [
      "Produce a weekly macro brief: Fed path + two data catalysts",
      "Map the brief to EUR/USD and XAU/USD directional bias",
      "List three sessions you would stand down for event risk",
    ],
    mission:
      "Write this week’s macro desk note before Sunday prep. Include Fed path, two catalysts, and explicit stand-down windows. File it with your journal submission.",
    audioTitle: "Fed Path & Macro Desk Briefing",
    audioNote:
      "NotebookLM overview of FOMC narrative vs execution discipline. Placeholder audio.",
  },
  {
    id: 5,
    title: "Intermarket & Yield Transmission",
    overview:
      "Yields, equities, and the dollar transmit into FX and gold. Keep bias consistent across markets before you size risk.",
    principles: [
      "UST yields ↔ USD ↔ EUR/USD is a primary transmission path",
      "Real yields often inverse XAU/USD tendency",
      "Risk-on / risk-off shows in equities, HY credit, and FX crosses",
      "DXY informs context — it is not an entry trigger",
      "Sunday intermarket prep prevents midweek narrative drift",
    ],
    links: [
      {
        label: "BIS — Global liquidity indicators",
        href: "https://www.bis.org/statistics/gli.htm",
      },
      {
        label: "CME — Interest rates markets",
        href: "https://www.cmegroup.com/markets/interest-rates.html",
      },
      ESSENTIAL_LINKS[0],
      ESSENTIAL_LINKS[3],
    ],
    milestones: [
      "Chart 10Y yield vs EUR/USD over three months and narrate the link",
      "Explain one gold move with real-yield context in ≤150 words",
      "Update an intermarket prep sheet before the next London open",
    ],
    mission:
      "Build a one-page intermarket dashboard (yields, DXY, equities, gold). State the bias it implies for EUR/USD this week and submit with your journal.",
    audioTitle: "Yield Transmission Briefing",
    audioNote:
      "NotebookLM audio on cross-asset bias construction. Placeholder until published.",
  },
  {
    id: 6,
    title: "Quantitative Testing & Research",
    overview:
      "Edge is measured, not asserted. Define hypotheses, sample windows, and pass/fail metrics before you scale size.",
    principles: [
      "Tag every trade so datasets stay reviewable",
      "Expectancy, average R, and drawdown bound honest evaluation",
      "Small samples invite curve-fit stories — stay humble",
      "Rule changes need before/after controlled comparison",
      "Research notebooks must be reproducible week to week",
    ],
    links: [
      {
        label: "BabyPips — Trading journal & review",
        href: "https://www.babypips.com/trading/learn-how-to-keep-a-trading-journal",
      },
      ESSENTIAL_LINKS[2],
      {
        label: "CME — Market data education",
        href: "https://www.cmegroup.com/market-data.html",
      },
      ESSENTIAL_LINKS[3],
    ],
    milestones: [
      "Tag ≥20 historical examples of one setup with outcome in R",
      "Report expectancy and max adverse excursion for that sample",
      "Write a one-page verdict: keep, refine, or retire the setup",
    ],
    mission:
      "Run a mini research sprint on one setup. Deliver tags, expectancy, and a keep/refine/retire verdict. Upload the notebook page to Drive.",
    audioTitle: "Research Hygiene Briefing",
    audioNote:
      "NotebookLM briefing on expectancy math and sample humility. Audio placeholder.",
  },
  {
    id: 7,
    title: "Risk Discipline & Simulation Math",
    overview:
      "Capital protection is non-negotiable. Fixed fractional risk, mandatory stops, and exact lot math for FX and gold — then simulate before you live-size.",
    principles: [
      "1.0% maximum risk per trade — hard academy cap",
      "Mandatory hard stop-loss; no mental stops",
      "Forex: Lot = (Equity × risk%) ÷ (Stop Pips × 10)",
      "Gold: Lot = (Equity × risk%) ÷ (|Entry − Stop| × 100)",
      "Minimum R:R 1:2; size down before widening stops",
    ],
    links: [
      {
        label: "BabyPips — Position sizing & risk",
        href: "https://www.babypips.com/learn/forex/position-sizing",
      },
      {
        label: "BabyPips — Risk of ruin basics",
        href: "https://www.babypips.com/learn/forex/risk-of-ruin",
      },
      {
        label: "CME — Risk management education",
        href: "https://www.cmegroup.com/education/courses/risk-management.html",
      },
      ESSENTIAL_LINKS[3],
    ],
    milestones: [
      "Size three EUR/USD and three XAU/USD examples to ≤1.0% risk",
      "Show a rejected trade that failed the 1:2 R:R screen",
      "Complete a simulation sheet using the Institutional Position Sizer",
    ],
    mission:
      "Use the Institutional Position Sizing Calculator on six hypothetical trades (3 FX, 3 gold). Screenshot results that pass 1:2 and one that fails. Submit the pack to Drive.",
    audioTitle: "Simulation Math Briefing",
    audioNote:
      "NotebookLM audio covering academy lot formulas and R:R gates. Placeholder file.",
  },
  {
    id: 8,
    title: "Capstone Macro Notebook",
    overview:
      "Synthesize the curriculum into one living artifact: bias, structure, risk math, and measured review ready for mentor critique.",
    principles: [
      "Weekly bias memo drawn from macro and intermarket stages",
      "Structure map + price-action plan in one coherent narrative",
      "Sized trade plan locked to Stage 7 math and the 1.0% cap",
      "Post-trade evaluation uses Stage 6 research metrics",
      "Presentation-ready notebook for Echo / mentor office hours",
    ],
    links: [
      {
        label: "BabyPips — Building a trading plan",
        href: "https://www.babypips.com/learn/forex/building-a-trading-plan",
      },
      ESSENTIAL_LINKS[1],
      ESSENTIAL_LINKS[2],
      ESSENTIAL_LINKS[3],
    ],
    milestones: [
      "Submit a complete weekly notebook: bias → plan → size → review",
      "Include annotated HTF/LTF charts and risk calculations",
      "Present findings with Echo and a clear pass/fail self-score",
    ],
    mission:
      "Ship your capstone notebook this week: macro bias, structure map, sized plan (≤1.0%), and review metrics. Submit to Drive, then discuss with Echo.",
    audioTitle: "Capstone Synthesis Briefing",
    audioNote:
      "NotebookLM wrap-up for assembling the mentor-ready notebook. Placeholder audio.",
  },
];
