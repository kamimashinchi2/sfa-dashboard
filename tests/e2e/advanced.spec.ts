import { expect, test } from "@playwright/test";

test.describe("Iteration 2 advanced + gates", () => {
  test("M2 direct URL asks for a session instead of a preview quiz", async ({ page }) => {
    await page.goto("/academy/missions/M2");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("quiz-gate")).toHaveCount(0);
    await expect(page.getByText(/READ_ONLY_PREVIEW/i)).toHaveCount(0);
  });

  test("M2 outline does not reveal answer keys", async ({ page }) => {
    await page.goto("/academy/missions/M2");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Correct option|Incorrect A|correctAnswer/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/M2/i);
  });

  test("setup validator exposes FVG/OB evidence", async ({ page }) => {
    await page.goto("/simulators/setup-validator");
    // Advance to displacement bar
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: /^Next$/i }).click();
    }
    await expect(
      page.getByText(/SETUP_CONFIRMED_MOMENTUM_STATE|ARMED_LONG/i),
    ).toBeVisible();
    await expect(page.getByText(/FVG|ZONE:/i).first()).toBeVisible();
    await expect(page.getByText(/Evidence & boundaries|شواهد و مرزها/i).first()).toBeVisible();
  });

  test("macro preset earns no assessed credit; GOLD→DATA explained", async ({
    page,
  }) => {
    await page.goto("/simulators/macro-chain");
    await page.getByRole("button", { name: /Load answer-key preset/i }).click();
    await expect(page.getByText(/DEMO_ONLY|assessedCredit=false/i).first()).toBeVisible();
    await page.getByRole("button", { name: /Clear edges/i }).click();
    await page.locator("select").nth(0).selectOption("GOLD");
    await page.locator("select").nth(1).selectOption("DATA");
    await page.getByRole("button", { name: /Add edge/i }).click();
    await expect(page.getByText(/GOLD→DATA|UNSUPPORTED_EDGE/i).first()).toBeVisible();
  });

  test("A6 direct URL stays locked without a session", async ({ page }) => {
    await page.goto("/academy/advanced/A6");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/A6|Research/i);
    await expect(page.getByText(/READ_ONLY_PREVIEW/i)).toHaveCount(0);
  });

  test("journal markdown download reports completion", async ({ page }) => {
    await page.goto("/journal/builder");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-markdown").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("sfa-journal.md");
    const path = await download.path();
    expect(path).toBeTruthy();
    await expect(page.getByTestId("download-status")).toContainText(/Notes downloaded/);
  });
});
