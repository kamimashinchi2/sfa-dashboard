/** Deterministic mulberry32 PRNG for educational simulations. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate synthetic return fractions for a loss-streak illustration.
 * Win → +R * riskPct/100; Loss → −riskPct/100. Seeded, pure given inputs.
 */
export function syntheticTradeReturns(input: {
  seed: number;
  n: number;
  winRate: number;
  rMultiple: number;
  riskPct: number;
}): string[] {
  const rnd = mulberry32(input.seed);
  const out: string[] = [];
  const riskFrac = input.riskPct / 100;
  for (let i = 0; i < input.n; i++) {
    const win = rnd() < input.winRate;
    if (win) {
      out.push(String(riskFrac * input.rMultiple));
    } else {
      out.push(String(-riskFrac));
    }
  }
  return out;
}
