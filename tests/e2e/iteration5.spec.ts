import { expect, test } from "@playwright/test";

async function scoreM1(page: import("@playwright/test").Page) {
  await page.goto("/academy/missions/M1");
  await expect(page.getByTestId("quiz-gate")).toBeVisible({ timeout: 30_000 });
  const quiz = page.getByTestId("quiz-gate");
  const radios = quiz.locator('input[type="radio"]');
  const count = await radios.count();
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const name = await radios.nth(i).getAttribute("name");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    await radios.nth(i).check();
  }
  const numInputs = quiz.locator("input.font-mono");
  const n = await numInputs.count();
  for (let i = 0; i < n; i++) {
    await numInputs.nth(i).fill("999");
  }
  await quiz.getByTestId("score-quiz").click();
  await expect(quiz.getByTestId("quiz-results")).toBeVisible({ timeout: 20_000 });
}

test.describe("Iteration 5", () => {
  test("persisted quiz table includes Your answer + attempt meta", async ({
    page,
  }) => {
    await scoreM1(page);
    const table = page.getByTestId("per-item-table");
    await expect(table).toContainText(/Your answer|پاسخ شما/);
    await expect(page.getByTestId("attempt-meta")).toContainText("Europe/Amsterdam");
    await page.reload();
    await expect(page.getByTestId("quiz-gate")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("per-item-table")).toBeVisible({ timeout: 15_000 });
  });

  test("future stage locked without entitlement beyond unlock", async ({
    page,
  }) => {
    // With E2E bypass at stage 8 everything unlocks; assert locked UI path via API mock
    await page.route("**/api/mentor/content?**", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: "STAGE_LOCKED",
          locked: true,
          requestedStage: 5,
          unlockedStage: 1,
          reason: {
            fa: "درس مرحله 5 قفل است.",
            en: "Stage 5 is locked.",
          },
        }),
      });
    });
    await page.goto("/academy/missions/M5");
    await expect(page.getByTestId("content-locked")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("content-locked")).toContainText(/locked|قفل/i);
  });

  test("/progress shows consent, entitlements, outbox panels", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.getByTestId("progress-page")).toBeVisible();
    await expect(page.getByTestId("consent-panel")).toBeVisible();
    await expect(page.getByTestId("entitlements-panel")).toBeVisible();
    await expect(page.getByTestId("outbox-panel")).toBeVisible();
    await expect(page.getByTestId("link-code-panel")).toBeVisible();
  });

  test("FA 390 progress no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/progress");
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(scroll).toBeLessThanOrEqual(1);
  });

  test("consent off does not enqueue network quiz-results", async ({ page }) => {
    const hits: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/mentor/quiz-results")) hits.push(req.url());
    });
    await page.goto("/progress");
    // ensure consent off
    const toggle = page.getByTestId("consent-toggle");
    if (await toggle.isChecked()) await toggle.uncheck();
    await scoreM1(page);
    await page.waitForTimeout(800);
    expect(hits).toEqual([]);
  });
});
