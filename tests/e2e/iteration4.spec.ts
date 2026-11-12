import { expect, test } from "@playwright/test";

test.describe("Iteration 4", () => {
  test("M1 does not score a quiz without a session", async ({ page }) => {
    await page.goto("/academy/missions/M1");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("quiz-gate")).toHaveCount(0);
    await expect(page.getByTestId("quiz-results")).toHaveCount(0);
  });

  test("locked lesson has no mentor-submit or answer key", async ({ page }) => {
    await page.goto("/academy/missions/M1");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Submit for mentor review/);
    expect(body).not.toMatch(/ثبت برای مرور منتور/);
    expect(body).not.toMatch(/correctAnswer/);
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
    await dialog.getByRole("button", { name: "EURUSD" }).click();
    await dialog.locator('input[name="preEntry"][value="YES"]').check();
    await dialog.getByRole("button", { name: /Evaluate|ارزیابی/ }).click();
    await expect(dialog.getByText("PASS", { exact: true }).first()).toBeVisible();

    await dialog.getByLabel(/Mental/i).check();
    await dialog.getByRole("button", { name: /Evaluate|ارزیابی/ }).click();
    await expect(dialog.getByText("BLOCKED", { exact: true }).first()).toBeVisible();
    await dialog.getByRole("button", { name: /Close|بستن|×/ }).first().click({ force: true }).catch(() => {});
    // Escape close
    await page.keyboard.press("Escape");

    await page.goto("/submit");
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByTestId("progress-page")).toBeVisible();
    await expect(page.getByTestId("download-packet")).toHaveCount(0);
    expect(requests.filter((u) => u.includes("tawk.to"))).toEqual([]);
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
    await page.goto("/progress");
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(scroll).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("progress-page")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Submit for mentor review/);
  });
});
