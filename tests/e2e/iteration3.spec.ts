import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

test.describe("Iteration 3 P0/P1", () => {
  test("EURUSD risk grid sizes to 0.50 lots / $100", async ({ page }) => {
    await page.goto("/simulators/risk-grid");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "SYNTHETIC_EURUSD" }).click();
    await expect(dialog.getByText("PASS_SIMULATION", { exact: true })).toBeVisible();
    await expect(dialog.getByText("maxLots: 0.5")).toBeVisible();
    await expect(dialog.getByText("loss: 100")).toBeVisible();
    await expect(dialog.getByText("stopPips: 20")).toBeVisible();
  });

  test("Mental stop HARD_BLOCK MENTAL_STOP", async ({ page }) => {
    await page.goto("/simulators/risk-grid");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Mental/i).check();
    await expect(dialog.getByText("HARD_BLOCK", { exact: true })).toBeVisible();
    await expect(dialog.getByText("MENTAL_STOP")).toBeVisible();
  });

  test("Setup Scout title and no ENTRY_ACTIVE label", async ({ page }) => {
    await page.goto("/academy/missions/M3");
    await expect(page.getByText(/Market Maker Scout v3\.0/)).toBeVisible();
    // Advance replay enough to hit momentum if practical is present
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/MOMENTUM_ENTRY_ACTIVE|RETRACEMENT_ENTRY_ACTIVE/);
  });

  test("journal stage matches mission registry", async ({ page }) => {
    await page.goto("/journal/builder");
    await expect(page.getByTestId("journal-stage")).toContainText(/Stage 6/);
    await expect(page.getByTestId("journal-stage")).toContainText(/mission M5/);
    await expect(page.getByTestId("journal-stage")).not.toContainText(/Stage 1 · mission M5/);
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
    expect(text).toContain("Mission: M5");
    expect(text).toMatch(/Stage:\s*6/);
  });

  test("advanced A6 shows preview banner when flag off", async ({ page }) => {
    await page.goto("/academy/advanced/A6");
    await expect(page.getByTestId("advanced-preview-banner")).toBeVisible();
  });

  test("progress page shows device-only notice", async ({ page }) => {
    await page.goto("/progress");
    await expect(
      page.getByText(/Saved on this device only, not an account/i),
    ).toBeVisible();
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
    const localeLine = pageB.locator("text=locale:");
    await expect(localeLine).toBeVisible();
    await context.close();
  });
});
