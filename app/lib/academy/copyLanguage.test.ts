import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN =
  /\b(buy now|sell now|entry active)\b/i;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|md)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("no signal language in rendered copy sources", () => {
  it("scans app/ for buy now / sell now / entry active", () => {
    const files = walk(join(process.cwd(), "app"));
    const hits: string[] = [];
    for (const f of files) {
      // Allow this test file and MACRO_AS_ENTRY detector patterns
      if (f.includes("copyLanguage.test")) continue;
      if (f.includes("macro.ts") || f.includes("macro.test")) continue;
      const text = readFileSync(f, "utf8");
      if (FORBIDDEN.test(text)) hits.push(f);
    }
    expect(hits).toEqual([]);
  });

  it("setup states never render legacy ENTRY_ACTIVE labels", () => {
    const setup = readFileSync(
      join(process.cwd(), "app/lib/academy/setup.ts"),
      "utf8",
    );
    expect(setup).not.toMatch(/MOMENTUM_ENTRY_ACTIVE/);
    expect(setup).not.toMatch(/RETRACEMENT_ENTRY_ACTIVE/);
    expect(setup).toMatch(/SETUP_CONFIRMED_MOMENTUM_STATE/);
  });
});
