export type ReadingLink = {
  label: string;
  href: string;
};

export type Stage = {
  id: number;
  title: string;
  summary: string;
  topics: string[];
  readings: ReadingLink[];
  passCriteria: string[];
};

export const JOURNAL_URL =
  "https://drive.google.com/drive/folders/1BoLFZnSEm3tbdmPOxcDNSXn8qXRDsLLj?usp=sharing";

export const stages: Stage[] = [
  {
    id: 1,
    title: "FX Foundations",
    summary:
      "Build fluency in spot FX mechanics, quote convention, session rhythm, and the instruments SFA trades with discipline.",
    topics: [
      "Base vs quote currency, pip/point, and spread cost",
      "London / New York overlap as primary liquidity window",
      "EUR/USD and XAU/USD contract math at 1.00 lot",
      "Order types: market, limit, stop; why mental stops are forbidden",
      "Journal hygiene: screenshot, thesis, risk, outcome",
    ],
    readings: [
      {
        label: "BabyPips — How to Trade Forex",
        href: "https://www.babypips.com/learn/forex",
      },
      {
        label: "CME — FX products overview",
        href: "https://www.cmegroup.com/markets/fx.html",
      },
      {
        label: "BIS — Triennial FX survey",
        href: "https://www.bis.org/statistics/rpfx23.htm",
      },
    ],
    passCriteria: [
      "Correctly convert a stop distance into dollars risked for EUR/USD and XAU/USD",
      "Label pip, point, and spread cost on a live chart screenshot",
      "Submit one practice journal entry with thesis + risk fields complete",
    ],
  },
  {
    id: 2,
    title: "Market Structure & Liquidity",
    summary:
      "Mission 1 core: read trend through swing points, map HTF bias, and locate liquidity that fuels BOS and CHoCH.",
    topics: [
      "HH / HL / LH / LL swing taxonomy",
      "HTF (4H) bias first, then LTF (15m) execution context",
      "Break of Structure (BOS) vs Change of Character (CHoCH)",
      "Liquidity pools above highs / below lows and sweep behavior",
      "Fair Value Gaps as delivery zones inside structure",
    ],
    readings: [
      {
        label: "BabyPips — Market structure & trends",
        href: "https://www.babypips.com/learn/forex/market-structure",
      },
      {
        label: "CME — Understanding FX liquidity",
        href: "https://www.cmegroup.com/education/articles-and-reports/understanding-fx-market-liquidity.html",
      },
      {
        label: "BIS — FX market structure notes",
        href: "https://www.bis.org/publ/qtrpdf/r_qt1912f.htm",
      },
    ],
    passCriteria: [
      "Mark HH/HL or LH/LL on a 4H chart and state the active bias",
      "Show one BOS and one CHoCH on 15m nested inside that HTF bias",
      "Annotate a liquidity sweep that preceded the structural shift",
    ],
  },
  {
    id: 3,
    title: "Chart Literacy & Price Action",
    summary:
      "Translate raw candles into decision-grade narrative: impulse, pullback, rejection, and continuation without indicator dependence.",
    topics: [
      "Candlestick anatomy and rejection wicks at key levels",
      "Impulse vs corrective legs; measured pullbacks",
      "Session opens, range breaks, and continuation signatures",
      "Entries from price action; EMA / VWAP as context only",
      "Screenshot standards for reviewable trade notes",
    ],
    readings: [
      {
        label: "BabyPips — Japanese candlesticks",
        href: "https://www.babypips.com/learn/forex/japanese-candlesticks",
      },
      {
        label: "BabyPips — Support & resistance",
        href: "https://www.babypips.com/learn/forex/support-and-resistance",
      },
      {
        label: "CME — Charting essentials",
        href: "https://www.cmegroup.com/education/courses/technical-analysis.html",
      },
    ],
    passCriteria: [
      "Deliver three annotated charts showing impulse → pullback → continuation",
      "Write a one-paragraph PA thesis with zero indicator-based entry language",
      "Score R:R ≥ 1:2 on a hypothetical entry from a marked level",
    ],
  },
  {
    id: 4,
    title: "Fundamental Macro & Fed Policy",
    summary:
      "Connect policy path, data releases, and dollar liquidity to FX and gold without abandoning price-action execution.",
    topics: [
      "Fed dual mandate, FOMC cycle, and dots as narrative—not signals",
      "CPI, NFP, PCE: calendar risk and when not to trade",
      "USD strength regimes and EUR/USD sensitivity",
      "Gold as a real-rate / risk-sentiment hybrid",
      "Macro note template: bias, catalysts, invalidation",
    ],
    readings: [
      {
        label: "Federal Reserve — Monetary Policy",
        href: "https://www.federalreserve.gov/monetarypolicy.htm",
      },
      {
        label: "CME FedWatch Tool",
        href: "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html",
      },
      {
        label: "BIS — Central bank policy hub",
        href: "https://www.bis.org/cbanks.htm",
      },
    ],
    passCriteria: [
      "Produce a weekly macro brief covering Fed path + two data catalysts",
      "State how the brief maps to EUR/USD and XAU/USD directional bias",
      "List three sessions you would stand down due to event risk",
    ],
  },
  {
    id: 5,
    title: "Intermarket & Yield Transmission",
    summary:
      "Trace how yields, equities, and the dollar transmit into FX and gold so your bias stays consistent across markets.",
    topics: [
      "UST yields ↔ USD ↔ EUR/USD pathways",
      "Real yields and XAU/USD inverse tendency",
      "Risk-on / risk-off: equities, HY credit, and FX crosses",
      "DXY context without treating it as an entry trigger",
      "Building a simple intermarket dashboard for Sunday prep",
    ],
    readings: [
      {
        label: "BIS — Global liquidity indicators",
        href: "https://www.bis.org/statistics/gli.htm",
      },
      {
        label: "CME — Interest rates markets",
        href: "https://www.cmegroup.com/markets/interest-rates.html",
      },
      {
        label: "BabyPips — Intermarket analysis",
        href: "https://www.babypips.com/learn/forex/intermarket-analysis",
      },
    ],
    passCriteria: [
      "Chart 10Y yield vs EUR/USD for a 3-month window and narrate the link",
      "Explain one gold move using real-yield context in ≤150 words",
      "Update an intermarket prep sheet before the next London open",
    ],
  },
  {
    id: 6,
    title: "Quantitative Research & Evaluation",
    summary:
      "Measure edge honestly: define hypotheses, sample windows, and pass/fail metrics before scaling size.",
    topics: [
      "Trade taxonomy and tagging for reviewable datasets",
      "Expectancy, win rate, average R, and drawdown bounds",
      "Sample-size humility; avoiding curve-fit narratives",
      "Before/after rule changes — controlled comparison",
      "Notebook structure for reproducible weekly research",
    ],
    readings: [
      {
        label: "BabyPips — Trading journal & review",
        href: "https://www.babypips.com/trading/learn-how-to-keep-a-trading-journal",
      },
      {
        label: "BIS — Statistical resources",
        href: "https://www.bis.org/statistics/index.htm",
      },
      {
        label: "CME — Market data education",
        href: "https://www.cmegroup.com/market-data.html",
      },
    ],
    passCriteria: [
      "Tag ≥20 historical examples of one setup with outcome in R",
      "Report expectancy and max adverse excursion for that sample",
      "Write a one-page verdict: keep, refine, or retire the setup",
    ],
  },
  {
    id: 7,
    title: "Risk Discipline & Position Sizing Math",
    summary:
      "Non-negotiable capital protection: fixed fractional risk, mandatory stops, and exact lot sizing for FX and gold.",
    topics: [
      "1.0% maximum risk per trade — no exceptions",
      "Mandatory hard stop-loss; no mental stops",
      "Forex lot formula: (Equity × 0.01) ÷ (Stop Pips × 10)",
      "Gold lot formula: (Equity × 0.01) ÷ (|Entry − Stop| × 100)",
      "Minimum R:R 1:2; size down before moving stops wider",
    ],
    readings: [
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
    ],
    passCriteria: [
      "Size three EUR/USD and three XAU/USD examples to exactly 1.0% risk",
      "Show a rejected trade that failed the 1:2 R:R screen",
      "Recite and apply the general lot-size formula without notes",
    ],
  },
  {
    id: 8,
    title: "Capstone Research Notebook",
    summary:
      "Synthesize the curriculum into a living research notebook: bias, structure, risk, and measured review in one artifact.",
    topics: [
      "Weekly bias memo from Stages 4–5",
      "Structure map (Stage 2) + PA plan (Stage 3)",
      "Sized trade plan with Stage 7 math locked",
      "Post-trade evaluation using Stage 6 metrics",
      "Presentation-ready notebook for mentor review",
    ],
    readings: [
      {
        label: "BabyPips — Building a trading plan",
        href: "https://www.babypips.com/learn/forex/building-a-trading-plan",
      },
      {
        label: "BIS — Research & publications",
        href: "https://www.bis.org/index.htm",
      },
      {
        label: "CME — Education hub",
        href: "https://www.cmegroup.com/education.html",
      },
    ],
    passCriteria: [
      "Submit a complete weekly notebook covering bias → plan → size → review",
      "Include annotated HTF/LTF charts and risk calculations",
      "Present findings in mentor office hours with clear pass/fail self-score",
    ],
  },
];
