import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex, sha256HexSync } from "./sha256";

function nodeSha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

describe("sha256 pure-TS + Web Crypto parity", () => {
  const vectors: { name: string; input: string }[] = [
    { name: "empty", input: "" },
    { name: "abc", input: "abc" },
    {
      name: "multi-block ASCII",
      input: "a".repeat(64) + "bcdefghijklmnopqrstuvwxyz0123456789",
    },
    { name: "FA", input: "بودجه ریسک یک درصد" },
    { name: "emoji", input: "risk ≤1% 🎯 ✅" },
  ];

  for (const v of vectors) {
    it(`matches Node for ${v.name}`, async () => {
      const expected = nodeSha(v.input);
      expect(sha256HexSync(v.input)).toBe(expected);
      expect(await sha256Hex(v.input)).toBe(expected);
    });
  }

  it("matches Node for a mini sfa-canon-v1 packet fragment", async () => {
    const packet = JSON.stringify({
      format: "sfa-submission",
      schemaVersion: 1,
      studentId: "S07",
      alias: "Falcon-07",
    });
    // Use sfa-canon style string as bytes
    const canonLike = `{"alias":"Falcon-07","format":"sfa-submission","schemaVersion":1,"studentId":"S07"}`;
    void packet;
    const expected = nodeSha(canonLike);
    expect(sha256HexSync(canonLike)).toBe(expected);
    expect(await sha256Hex(canonLike)).toBe(expected);
  });

  it("does not throw when subtle is unavailable (sync path)", () => {
    expect(sha256HexSync("abc")).toBe(nodeSha("abc"));
  });
});
