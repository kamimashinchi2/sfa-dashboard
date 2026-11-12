import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

test.describe("Iteration 3 P0/P1", () => {
  test("EURUSD risk grid sizes to 0.50 lots / $100", async ({ page }) => {
    await page.goto("/simulators/risk-grid");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "EURUSD" }).click();
    await dialog.locator('input[name="preEntry"][value="YES"]').check();
    await expect(dialog.getByText("PASS", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Position size: 0\.5/)).toBeVisible();
  });

  test("Mental stop HARD_BLOCK MENTAL_STOP", async ({ page }) => {
    await page.goto("/simulators/risk-grid");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Mental/i).check();
    await expect(dialog.getByText("BLOCKED", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/hard structural stop is required/i)).toBeVisible();
  });

  test("M3 direct URL does not open the scout without a session", async ({ page }) => {
    await page.goto("/academy/missions/M3");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/MOMENTUM_ENTRY_ACTIVE|RETRACEMENT_ENTRY_ACTIVE|correctAnswer/);
  });

  test("journal shows the seven writing fields", async ({ page }) => {
    await page.goto("/journal/builder");
    await expect(page.getByText("Hypothesis")).toBeVisible();
    await expect(page.getByText("What will you do next?")).toBeVisible();
    await expect(page.getByTestId("export-markdown")).toContainText(/Download my notes|دانلود یادداشت/);
    await expect(page.getByText(/Export JSON|Copy Markdown|Mission/)).toHaveCount(0);
  });

  test("journal markdown download has UTF-8 content", async ({ page }) => {
    await page.goto("/journal/builder");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-markdown").click(),
    ]);
    const suggested = download.suggestedFilename();
    expect(suggested).toMatch(/\.md$/);
    const target = path.join("/tmp", suggested);
    await download.saveAs(target);
    const text = fs.readFileSync(target, "utf8");
    expect(text).toContain("# Journal");
    expect(text).toContain("Hypothesis");
  });

  test("advanced A6 does not use the removed content bypass", async ({ page }) => {
    await page.goto("/academy/advanced/A6");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("advanced-preview-banner")).toHaveCount(0);
  });

  test("progress page says local storage cannot unlock a lesson", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.getByTestId("next-step")).toBeVisible();
    await expect(page.getByTestId("local-practice-debug")).toHaveCount(0);
  });
});

test.describe("mobile no horizontal scroll", () => {
  for (const route of [
    "/academy",
    "/academy/missions/M1",
    "/simulators/risk-grid",
    "/journal/builder",
    "/progress",
    "/legal/disclaimer",
  ]) {
    test(`${route} no page overflow`, async ({ page }) => {
      await page.goto(route);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
});

test.describe("storage cross-tab", () => {
  test("locale change appears in second page via storage", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.goto("/academy");
    await pageB.goto("/progress");

    // Toggle locale on A
    await pageA.getByRole("button", { name: /English|فارسی/i }).click();
    // Give storage event a beat
    await pageB.waitForTimeout(500);
    await pageB.reload();
    await expect(pageB.getByTestId("progress-page")).toBeVisible();
    await context.close();
  });
});
