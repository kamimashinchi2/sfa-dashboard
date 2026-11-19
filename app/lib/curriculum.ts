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
      "London and New York are the preferred sessions",
      "Lot math with a sourced or illustrative point value before any hypothetical plan",
      "Hard stops only — mental stops are a rulebook violation",
      "Journal fields: thesis, structure, risk, outcome — every session",
    ],
    links: ESSENTIAL_LINKS,
    milestones: [
      "Convert a stop distance into dollars risked for EUR/USD and XAU/USD (point value from the contract spec, or labelled illustrative)",
      "Label pip, point, and spread cost on a live chart screenshot",
      "Submit one practice journal entry with thesis + risk fields complete",
    ],
    mission:
      "Log on at least 3 weekdays, noting spread at a London and a New York observation time, and size a hypothetical 1% plan on your own paper equity. Upload the Friday contract and cost journal.",
    audioTitle: "FX Mechanics Desk Briefing",
    audioNote:
      "No stage recording is published on this page.",
  },
  {
    id: 2,
    title: "Liquidity Pools & Order Types",
    overview:
      "Liquidity is the fuel of structural shifts. Map pools above highs and below lows, then choose the order type that expresses your plan without ambiguity.",
    principles: [
      "Liquidity pools rest beyond obvious swing highs and lows",
      "A sweep is not an entry. A wick touch does not prove a fill",
      "Market, limit, and stop orders each encode a different intent",
      "H4 and H1 for direction, M15 and M5 for execution reading",
      "Confirmation comes after a sweep, never with it",
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
      "Log on at least 3 weekdays marking PDH/PDL (PWH/PWL on Monday), classifying sweeps, and naming order types. Upload the Friday liquidity map journal.",
    audioTitle: "Liquidity & Order Intent Briefing",
    audioNote:
      "No stage recording is published on this page.",
  },
  {
    id: 3,
    title: "Chart Literacy & Price Action",
    overview:
      "Candles are narrative units. Read impulse, pullback, and rejection so entries come from price — indicators stay contextual.",
    principles: [
      "Structure words in the sources: OB, BOS, CHoCH, FVG, MSS, read on closed candles",
      "The stop is structural invalidation beyond the sweep extreme or swing",
      "Sweep-reversal path (Scout v3.0): confirmed sweep, closed-candle MSS, displacement, then an FVG/OB zone",
      "MA50 and MA200 are named; no crossover rule, applied price, or shift was recovered, so they stay descriptive. RSI, Volume Profile, ZigZag and Renko have no recovered settings",
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
      "Walk the sweep-reversal chain on a real chart and write where it stopped",
      "No signal wording in any entry",
      "Net R:R of at least 1:2 after spread on a hypothetical plan",
    ],
    mission:
      "Log on at least 3 weekdays applying H4/H1 direction, M15/M5 closed-candle structure and a paper structural-stop drill. Upload the Friday week table and one Final Paper Plan.",
    audioTitle: "Price Action Narrative Briefing",
    audioNote:
      "No stage recording is published on this page.",
  },
  {
    id: 4,
    title: "Fundamental Macro & Fed Policy",
    overview:
      "Policy path and data releases shape dollar and gold regimes. Macro bias is context, not an entry.",
    principles: [
      "Fed dual mandate and FOMC cycle are narrative — not entry signals",
      "Compare Actual, Forecast, Previous and Revisions for labor and inflation releases; if the calendar was not checked write NEWS RISK: NOT ASSESSED",
      "Do not extrapolate a macro regime from one print",
      "Real yields are especially important for gold, but Dow and gold have no fixed inverse relationship",
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
      "Fill the macro chain link by link and mark UNVERIFIED links",
      "Separate the immediate reaction from the durable one",
    ],
    mission:
      "Log on at least 3 weekdays: release log, chain walk with UNVERIFIED links, immediate vs durable. Upload the Friday macro context journal.",
    audioTitle: "Fed Path & Macro Desk Briefing",
    audioNote:
      "No stage recording is published on this page.",
  },
  {
    id: 5,
    title: "Intermarket & Yield Transmission",
    overview:
      "Yields, equities, and the dollar transmit into FX and gold. Keep bias consistent across markets before you size risk.",
    principles: [
      "Chain order from the coordinator: yields including real yields, DXY, VIX and cross-asset response",
      "Correlation is regime-dependent",
      "Risk-on / risk-off shows in equities, HY credit, and FX crosses",
      "DXY informs context — it is not an entry trigger",
      "Timestamp every observation and avoid double counting one input",
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
      "Fill a timestamped cross-asset matrix",
      "Explain one gold move with real yields and DXY, not either alone",
      "Fill a timestamped cross-asset matrix",
    ],
    mission:
      "Log on at least 3 weekdays with a cross-asset matrix; upload the Friday intermarket journal with one macro bias statement labelled not an entry.",
    audioTitle: "Yield Transmission Briefing",
    audioNote:
      "No stage recording is published on this page.",
  },
  {
    id: 6,
    title: "Quantitative Testing & Research",
    overview:
      "Edge is measured, not asserted. Define hypotheses, sample windows, and pass/fail metrics before you scale size.",
    principles: [
      "Write a falsifiable hypothesis, the allowed data and the costs before the outcome window",
      "Account for spread and fees",
      "Avoid look-ahead bias and overfitting",
      "Test out of sample and document failures",
      "Label the result IN-SAMPLE / EXPLORATORY",
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
      "Preregister one observation hypothesis",
      "Record timestamped forward rows and failures",
      "Label the result IN-SAMPLE / EXPLORATORY",
    ],
    mission:
      "Log on at least 3 weekdays. On your first logged day, lock a one-line falsifiable observation hypothesis before any outcome. On Friday upload a research note labelled IN-SAMPLE / EXPLORATORY. No live rule is promoted.",
    audioTitle: "Research Hygiene Briefing",
    audioNote:
      "No stage recording is published on this page.",
  },
  {
    id: 7,
    title: "Risk Discipline & Simulation Math",
    overview:
      "Capital protection is non-negotiable. Fixed fractional risk, mandatory stops, and exact lot math for FX and gold — then simulate before you live-size.",
    principles: [
      "1.0% maximum risk per trade — hard academy cap",
      "Mandatory hard stop-loss; no mental stops",
      "Lot Size = (Equity × Risk %) ÷ (Stop Distance × Point Value), rounded down; point value sourced or labelled illustrative",
      "Size paper plans with the source formula and show one plan rejected for net R:R below 1:2",
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
      "Size paper plans with the source formula and show one plan rejected for net R:R below 1:2",
    ],
    mission:
      "Log on at least 3 weekdays: a daily paper plan on current paper equity, a paper-ledger update, a stop-doubling drill and a three-losses scenario note. On Friday upload the risk ledger and drawdown review. Recovery percentages and gap-loss labels are not required.",
    audioTitle: "Simulation Math Briefing",
    audioNote:
      "No stage recording is published on this page.",
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
      "One release, three instruments, with the 0-5, 5-15 and 15-60 minute windows and the later session kept separate",
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
      "Write conclusions as study notes, not signals",
    ],
    mission:
      "Log on at least 3 weekdays around one scheduled release and upload the Friday capstone notebook as study notes, not signals. The Final Paper Plan is required this week. A positive result leads to senior-mentor review only.",
    audioTitle: "Capstone Synthesis Briefing",
    audioNote:
      "No stage recording is published on this page.",
  },
];
