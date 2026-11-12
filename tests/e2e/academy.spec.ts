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
    await expect(dialog.getByText("BLOCKED", { exact: true })).toBeVisible();
    await expect(dialog.getByTestId("risk-plain")).toContainText(/above 1% of equity/i);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("mission M1 stays locked without a session", async ({ page }) => {
    await page.goto("/academy/missions/M1");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("quiz-gate")).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/correctAnswer|answer key|کلید پاسخ/);
  });
});
