/** @vitest-environment jsdom */
import { act } from "react";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import DailyLogCard from "./DailyLogCard";

const tasks = [{ taskId: "C1", kind: "CORE", task: { fa: "کار اصلی", en: "Core task" } }];

const view = {
  active: true,
  countedDays: 1,
  requiredDays: 3,
  dueFriday: "2026-11-27",
  nextLockAtISO: "2026-11-25T00:00:00+01:00",
  windowOpen: false,
  opensAtISO: null,
  closesAtISO: null,
  warning: null,
  entries: [],
  state: "ASSIGNMENT_ISSUED",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setSelect(element: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("daily log card", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.unstubAllGlobals();
  });

  it("sends a paper plan on Trade today, and grounding plus an optional conditional plan on No trade", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse({ entryId: "de_1" });
        }
        return jsonResponse(view);
      }),
    );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<DailyLogCard locale="en" tasks={tasks} />);
    });
    await flush();

    expect(container.querySelector("[data-testid=test-date]")).toBeNull();
    expect(container.textContent).not.toContain("Test date (test account only)");
    expect(container.querySelector("[data-testid=grounding-refs]")).toBeTruthy();
    expect(container.querySelector("[data-testid=conditional-plan]")).toBeTruthy();
    expect(container.querySelector("[data-testid=paper-plan]")).toBeNull();

    await act(async () => {
      container?.querySelectorAll("[data-testid=day-call] button")[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector("[data-testid=paper-plan]")).toBeTruthy();
    expect(container.querySelector("[data-testid=grounding-refs]")).toBeNull();

    const values: Record<string, string> = {
      equity: "10000",
      riskPct: "1",
      entry: "1.0850",
      stopLevel: "1.0820",
      stopType: "hard",
      pointValue: "10",
      pointValueSource: "illustrative",
      lot: "0.1",
      spreadCosts: "1",
      target: "1.0920",
      netRR: "2",
    };
    await act(async () => {
      for (const [key, value] of Object.entries(values)) {
        const input = container?.querySelector(`[data-testid=paper-${key}]`) as HTMLInputElement;
        setValue(input, value);
      }
      container?.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();
    const traded = posts.at(-1) as { dayCall: string; paperPlan: Record<string, string> | null };
    expect(traded).not.toHaveProperty("testLocalDate");
    expect(traded.dayCall).toBe("TRADE");
    expect(traded.paperPlan).not.toBeNull();
    expect(traded.paperPlan).toMatchObject({ entry: "1.0850", stopLevel: "1.0820", target: "1.0920", riskPct: "1" });

    await act(async () => {
      container?.querySelectorAll("[data-testid=day-call] button")[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector("[data-testid=paper-plan]")).toBeNull();
    const grounding = container?.querySelector("[data-testid=grounding-refs]") as HTMLTextAreaElement;
    expect(grounding).toBeTruthy();
    await act(async () => {
      setValue(grounding, "EURUSD bid 1.0850 at 10:15 Amsterdam");
      const summary = container?.querySelector("[data-testid=conditional-plan] summary") as HTMLElement;
      summary.click();
      setValue(container?.querySelector("[data-testid=conditional-condition]") as HTMLInputElement, "WAIT for the sweep");
      setValue(container?.querySelector("[data-testid=conditional-entry]") as HTMLInputElement, "1.0840");
      setValue(container?.querySelector("[data-testid=conditional-stop]") as HTMLInputElement, "1.0820");
      setValue(container?.querySelector("[data-testid=conditional-target]") as HTMLInputElement, "1.0900");
      setValue(container?.querySelector("[data-testid=conditional-sizeRisk]") as HTMLInputElement, "1% rounded down");
      container?.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();
    const quiet = posts.at(-1) as {
      dayCall: string;
      paperPlan: unknown;
      groundingRefs: string[];
      conditionalPlan: { condition: string } | null;
    };
    expect(quiet.dayCall).toBe("NO_TRADE");
    expect(quiet.paperPlan).toBeNull();
    expect(quiet.groundingRefs).toEqual(["EURUSD bid 1.0850 at 10:15 Amsterdam"]);
    expect(quiet.conditionalPlan?.condition).toBe("WAIT for the sweep");
    expect(quiet).not.toHaveProperty("testLocalDate");
  });

  it("shows the test date only in test mode and sends the chosen date", async () => {
    const posts: unknown[] = [];
    const dates = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse({ entryId: "de_test" });
        }
        return jsonResponse({ ...view, testMode: true, allowedDates: dates });
      }),
    );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<DailyLogCard locale="en" tasks={tasks} />);
    });
    await flush();

    const select = container.querySelector("[data-testid=test-date]") as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(container.textContent).toContain("Test date (test account only)");
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", ...dates]);

    await act(async () => {
      setSelect(select, "2026-11-24");
      container?.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();
    const saved = posts.at(-1) as { testLocalDate?: string };
    expect(saved.testLocalDate).toBe("2026-11-24");
  });
});
