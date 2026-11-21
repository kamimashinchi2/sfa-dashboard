/** @vitest-environment jsdom */
import { act } from "react";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PracticalUpload, { currentPracticalSubmission } from "./PracticalUpload";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const week1 = {
  id: "week-1",
  state: "DELIVERED",
  week: 1,
  practicalModel: "DAILY_LOG_V1",
  files: [],
};

describe("current week practical upload", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.unstubAllGlobals();
  });

  it("ignores an older week and a different model", () => {
    expect(
      currentPracticalSubmission({
        currentWeek: 2,
        practicalModel: "DAILY_LOG_V1",
        submissions: [week1, { id: "legacy", state: "QUEUED", week: 2, practicalModel: "LEGACY", files: [] }],
      }),
    ).toBeNull();
    expect(
      currentPracticalSubmission({
        currentWeek: 2,
        practicalModel: "DAILY_LOG_V1",
        submissions: [week1, { id: "week-2", state: "QUEUED", week: 2, practicalModel: "DAILY_LOG_V1", files: [] }],
      })?.id,
    ).toBe("week-2");
  });

  async function renderWith(body: unknown) {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body)));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<PracticalUpload locale="en" />);
    });
    await flush();
  }

  it("leaves week 2 open when only week 1 is delivered", async () => {
    await renderWith({
      currentWeek: 2,
      practicalModel: "DAILY_LOG_V1",
      submissions: [week1],
    });
    const input = container?.querySelector("[data-testid=upload-file-input]") as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(container?.querySelector("[data-testid=upload-submit]")?.textContent).toMatch(/Submit practical/);
  });

  it("locks when the current week is queued", async () => {
    await renderWith({
      currentWeek: 2,
      practicalModel: "DAILY_LOG_V1",
      submissions: [week1, { id: "week-2", state: "QUEUED", week: 2, practicalModel: "DAILY_LOG_V1", files: [] }],
    });
    const input = container?.querySelector("[data-testid=upload-file-input]") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(container?.querySelector("[data-testid=upload-submit]")?.textContent).toMatch(/QUEUED/);
  });
});
