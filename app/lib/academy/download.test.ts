import { describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./download";

describe("download lifecycle", () => {
  it("creates object URL, clicks anchor, schedules revoke", () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const clicks: string[] = [];
    const fakeUrl = "blob:test";
    const a = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      click() {
        clicks.push(this.download);
      },
    };
    const body = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    };
    const doc = {
      createElement: () => a,
      body,
    } as unknown as Document;
    const urlApi = {
      createObjectURL: () => {
        created.push(fakeUrl);
        return fakeUrl;
      },
      revokeObjectURL: (u: string) => {
        revoked.push(u);
      },
    };
    const result = downloadTextFile({
      filename: "sfa-journal.md",
      content: "# hello فارسی",
      mime: "text/markdown;charset=utf-8",
      doc,
      urlApi,
      revokeDelayMs: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.filename).toBe("sfa-journal.md");
    expect(result.bytes).toBeGreaterThan(0);
    expect(created).toEqual([fakeUrl]);
    expect(clicks).toEqual(["sfa-journal.md"]);
    expect(a.download).toBe("sfa-journal.md");
  });
});
