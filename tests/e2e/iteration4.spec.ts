import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";

/** Minimal sfa-canon-v1 for Node digest recompute in E2E. */
function canon(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (Array.isArray(value)) return `[${value.map((v) => canon(v)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canon((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  throw new Error("bad");
}

async function scoreM1DeliberatelyWrong(page: import("@playwright/test").Page) {
  await page.goto("/academy/missions/M1");
  // Answer MC with first option when possible; leave order untouched; fill numeric wrong
  const quiz = page.getByTestId("quiz-gate");
  await expect(quiz).toBeVisible();
  const radios = quiz.locator('input[type="radio"]');
  const count = await radios.count();
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const name = await radios.nth(i).getAttribute("name");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    await radios.nth(i).check();
  }
  // numeric inputs use font-mono class in QuizGate
  const numInputs = quiz.locator("input.font-mono");
  const n = await numInputs.count();
  for (let i = 0; i < n; i++) {
    await numInputs.nth(i).fill("999");
  }
  await quiz.getByTestId("score-quiz").click();
  await expect(quiz.getByTestId("quiz-results")).toBeVisible();
  await expect(quiz.getByTestId("per-item-table")).toBeVisible();
  await expect(quiz.getByTestId("attempt-meta")).toBeVisible();
}

test.describe("Iteration 4", () => {
  test("M1 per-item results persist across reload", async ({ page }) => {
    await scoreM1DeliberatelyWrong(page);
    const attemptText = await page.getByTestId("attempt-meta").innerText();
    expect(attemptText).toMatch(/attemptId=/);
    await page.reload();
    await expect(page.getByTestId("quiz-results")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("per-item-table")).toBeVisible();
  });

  test("lesson response saves without PENDING_REVIEW / mentor submit", async ({ page }) => {
    await page.goto("/academy/missions/M1");
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Submit for mentor review/);
    expect(body).not.toMatch(/ثبت برای مرور منتور/);
    const prompt = page.getByTestId("socratic-prompt").first();
    await prompt.getByTestId("socratic-text").fill(
      "I assumed a sweep alone was enough; next time I will wait for closed MSS.",
    );
    await prompt.getByTestId("add-to-packet").click();
    await expect(prompt.getByTestId("response-saved")).toBeVisible();
    await expect(prompt.getByTestId("response-saved")).toContainText(/Not sent yet|هنوز ارسال نشده/);
    await page.reload();
    await expect(page.getByTestId("response-saved").first()).toBeVisible();
  });

  test("risk grid PASS + mental HARD_BLOCK record sim runs; submit export", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
        requests.push(url);
      }
    });

    await page.goto("/simulators/risk-grid");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "SYNTHETIC_EURUSD" }).click();
    await dialog.locator('input[name="preEntry"][value="YES"]').check();
    await dialog.getByRole("button", { name: /Evaluate|ارزیابی/ }).click();
    await expect(dialog.getByText("PASS_SIMULATION", { exact: true }).first()).toBeVisible();

    await dialog.getByLabel(/Mental/i).check();
    await dialog.getByRole("button", { name: /Evaluate|ارزیابی/ }).click();
    await expect(dialog.getByText("HARD_BLOCK", { exact: true }).first()).toBeVisible();
    await dialog.getByRole("button", { name: /Close|بستن|×/ }).first().click({ force: true }).catch(() => {});
    // Escape close
    await page.keyboard.press("Escape");

    await scoreM1DeliberatelyWrong(page);

    // Fill reflections needed on /submit
    await page.goto("/submit");
    await page.getByTestId("student-id").fill("S07");
    await page.getByTestId("alias").fill("Falcon-07");

    // Fill any required item reflections
    const refl = page.locator('[data-testid^="reflection-"]');
    const rc = await refl.count();
    for (let i = 0; i < rc; i++) {
      await refl.nth(i).fill("I assumed the first option; next time I will check the rationale carefully.");
    }
    await page.getByTestId("weekly-reflection").fill(
      "This week I practiced risk sizing and learned that mental stops are HARD_BLOCK. Next week I will place structural stops first.",
    );
    await page.getByTestId("emotion-before").fill("4");
    await page.getByTestId("emotion-after").fill("6");

    await expect(page.getByTestId("download-packet")).toBeEnabled({ timeout: 10_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("download-packet").click(),
    ]);
    const suggested = download.suggestedFilename();
    expect(suggested).toMatch(/^SFA_S07_\d{4}-W\d{2}_packet-\d{2}\.md$/);
    const target = path.join("/tmp", suggested);
    await download.saveAs(target);
    const text = fs.readFileSync(target, "utf8");
    expect(text).toContain("<!-- sfa-submission:begin -->");
    expect(text).toContain("<!-- sfa-submission:end -->");
    expect(text.match(/<!-- sfa-submission:begin -->/g)?.length).toBe(1);
    expect(text).toMatch(/[\u0600-\u06FF]|Falcon|UNVERIFIED/);

    const begin = text.indexOf("```json");
    const end = text.indexOf("```", begin + 7);
    const json = text.slice(begin + 7, end).trim();
    const packet = JSON.parse(json);
    const { integrity, ...rest } = packet;
    const digest = createHash("sha256").update(canon(rest)).digest("hex");
    expect(digest).toBe(integrity.digest);

    await expect(page.getByTestId("result-code")).toBeVisible();
    const code = await page.getByTestId("result-code").innerText();
    expect(code.trim()).toMatch(
      /^SFA1-S\d{2,4}-\d{4}W\d{2}-[0-9a-f]{10}-Q\d+-R\d+-HB\d+$/,
    );

    // No external network during scoring/saving/export
    expect(requests.filter((u) => !u.includes("tawk"))).toEqual([]);
  });

  test("FA locale /submit at 390 has no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/academy");
    // toggle to FA if needed — default is often fa
    const toggle = page.getByRole("button", { name: /EN|FA|English|فارسی|Locale/i });
    if (await toggle.count()) {
      // ensure FA
      const html = page.locator("html");
      const lang = await html.getAttribute("lang");
      if (lang !== "fa") await toggle.first().click();
    }
    await page.goto("/submit");
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(scroll).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("submit-page")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Submit for mentor review/);
  });
});
