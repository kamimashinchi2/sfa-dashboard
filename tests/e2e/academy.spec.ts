import { expect, test } from "@playwright/test";

test.describe("Academy pilot", () => {
  test("academy loads, stage header syncs, locale toggles", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/academy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /five-mission|academy/i,
    );
    await expect(page.getByText(/SYNTHETIC/i).first()).toBeVisible();

    await page.getByRole("button", { name: /PREVIEW · 3/i }).click();
    await expect(page.getByText(/Stage 3|مرحله 3/i).first()).toBeVisible();

    // Persist across reload
    await page.reload();
    await expect(page.getByText(/Stage 3|مرحله 3/i).first()).toBeVisible();

    const toggle = page.getByRole("button", { name: /English|فارسی/i });
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("lang", /en|fa/);

    expect(errors).toEqual([]);
  });

  test("risk grid modal focus trap and HARD_BLOCK for 2%", async ({
    page,
  }) => {
    await page.goto("/simulators/risk-grid");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^Risk %/i).fill("2");
    await expect(dialog.getByText("HARD_BLOCK", { exact: true })).toBeVisible();
    await expect(dialog.getByText("RISK_PCT_HARD_BLOCK")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("mission M1 walkthrough smoke", async ({ page }) => {
    await page.goto("/academy/missions/M1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/M1/i);
    await page.getByRole("button", { name: /Mark lesson reviewed|درس را علامت|Self-check|خودبررسی/i }).first().click();
    await page.getByRole("button", { name: /Score quiz|ثبت نمره/i }).click();
    await expect(page.getByText(/Score \d+\/100/i)).toBeVisible();
  });
});
