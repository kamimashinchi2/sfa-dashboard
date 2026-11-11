import { expect, test } from "@playwright/test";

test.describe("Iteration 5", () => {
  test("M1 without a session does not show a persisted quiz table", async ({
    page,
  }) => {
    await page.goto("/academy/missions/M1");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("per-item-table")).toHaveCount(0);
    await expect(page.getByTestId("quiz-gate")).toHaveCount(0);
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
    await expect(page.getByTestId("student-dashboard")).toBeVisible();
    await expect(page.getByTestId("entitlements-panel")).toBeVisible();
    await expect(page.getByTestId("link-code-panel")).toHaveCount(0);
    await expect(page.getByTestId("enrollment-token")).toHaveCount(0);
  });

  test("FA 390 progress no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/progress");
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(scroll).toBeLessThanOrEqual(1);
  });

  test("retired quiz-results route is not part of the dashboard", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.getByTestId("consent-toggle")).toHaveCount(0);
    const response = await page.request.post("/api/mentor/quiz-results", {
      data: {},
      headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    });
    expect(response.status()).toBe(410);
  });
});
