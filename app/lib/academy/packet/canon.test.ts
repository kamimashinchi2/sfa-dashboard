import { describe, expect, it } from "vitest";
import { canon } from "../canon";
import { sha256Hex } from "../sha256";

describe("sfa-canon-v1 golden vector", () => {
  it("matches Echo golden canon + digest", async () => {
    const input = { b: "۱۰۰", a: [1, "0.50", null, true], c: { z: "Falcon-07", y: "x\ny" } };
    const c = canon(input);
    expect(c).toBe(
      '{"a":[1,"0.50",null,true],"b":"۱۰۰","c":{"y":"x\\ny","z":"Falcon-07"}}',
    );
    const digest = await sha256Hex(c);
    expect(digest).toBe(
      "8068827ed1520fba664d7f711bd299d7439dfe671019af4dc287a8f796356afd",
    );
  });

  it("rejects floats and dangerous keys", () => {
    expect(() => canon({ x: 1.5 })).toThrow(/FLOAT/);
    expect(() => canon(JSON.parse('{"__proto__":1}'))).toThrow(/BAD_KEY/);
  });
});
