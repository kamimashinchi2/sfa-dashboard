import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

describe("retired enrollment session", () => {
  beforeEach(() => {
    delete process.env.SFA_ALLOW_INSECURE_PILOT;
    delete process.env.SFA_ALLOW_CONTENT_BYPASS;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 410 and does not call the bridge", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("GONE");
    expect(body.en).toMatch(/retired/i);
    expect(JSON.stringify(body)).not.toMatch(/sessionToken|enrollmentToken/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
