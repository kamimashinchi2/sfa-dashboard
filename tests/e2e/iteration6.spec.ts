import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const ARTIFACTS = "/opt/cursor/artifacts";

const assignment = {
  week: 3,
  stage: 1,
  title: { fa: "تمرین هفته ساختار", en: "Structure week drill" },
  coreTasks: [
    {
      fa: "یک استاپ ساختاری سخت برای EURUSD بنویسید.",
      en: "Write one structural hard stop for EURUSD.",
    },
  ],
  weaknessDrills: [
    {
      weaknessId: "risk-size",
      task: { fa: "ریسک را دوباره با گرد کردن به پایین حساب کنید.", en: "Recompute risk and round down." },
    },
  ],
  spiralReview: [
    {
      stage: 1,
      skill: "spread",
      task: { fa: "اسپرد لندن را مرور کنید.", en: "Review the London spread." },
    },
  ],
  riskRules: {
    maxRiskPct: "1",
    hardStructuralStop: true,
    minNetRR: "2",
    noSignals: true,
  },
  deliverables: [{ fa: "یک سند و در صورت نیاز تصویر.", en: "One document, plus screenshots if needed." }],
  dueAtISO: "2026-11-18T18:00:00+01:00",
};

async function installMocks(page: Page) {
  await page.route("**/api/mentor/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/data-notice")) {
      return json({
        version: 1,
        text: "Learning work is stored on the academy server. / تمرین‌ها روی سرور آکادمی ذخیره می‌شوند.",
      });
    }
    if (path.endsWith("/me")) {
      return json({
        studentId: "S10001",
        displayName: "Pilot Learner",
        email: "pilot@example.com",
        role: "STUDENT",
        unlockedStage: 1,
        currentWeek: 3,
        status: "ASSIGNMENT_ISSUED",
        telegramEnabled: true,
        telegramLinked: false,
      });
    }
    if (path.endsWith("/assignment")) {
      return json({ week: 3, stage: 1, status: "ASSIGNMENT_ISSUED", assignment });
    }
    if (path.endsWith("/report")) {
      return json({
        markdown: "## Week 3\n\nEcho review is pending until the practical is graded.",
        decisions: [
          {
            id: "d1",
            state: "DELIVERED",
            body: {
              verdict: "PARTIALLY_APPROVED",
              format: "sfa-quiz-decision",
              feedback: {
                fa: "دو مورد را دوباره بخوانید. این تأیید درس بعدی را باز نمی‌کند.",
                en: "Reread two items. This approval does not unlock the next lesson.",
              },
            },
          },
        ],
      });
    }
    if (path.endsWith("/notifications")) return json({ notifications: [] });
    if (path.endsWith("/practicals")) return json({ submissions: [] });
    if (path.endsWith("/legacy-import")) {
      return json({ imported: true, verified: false, unlocksChanged: false });
    }
    if (path.endsWith("/content") && url.searchParams.get("missionId") === "M5") {
      return json(
        {
          error: "STAGE_LOCKED",
          locked: true,
          requestedStage: 5,
          unlockedStage: 1,
          reason: { fa: "درس مرحله 5 قفل است.", en: "Stage 5 is locked." },
        },
        403,
      );
    }
    return json({ error: "UNAUTHORIZED" }, 401);
  });
}

async function setLocale(page: Page, locale: "fa" | "en") {
  const dir = await page.locator("html").getAttribute("dir");
  const current = dir === "rtl" ? "fa" : "en";
  if (current === locale) return;
  await page.getByRole("button", { name: locale === "fa" ? "فارسی" : "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "fa" ? "rtl" : "ltr");
}

function shot(page: Page, name: string) {
  if (test.info().project.name !== "mobile-390") return Promise.resolve();
  mkdirSync(ARTIFACTS, { recursive: true });
  return page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true });
}

test.describe("Iteration 6 mobile", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page);
  });

  test("signup, dashboard assignment, upload, and locked lesson", async ({ page }) => {
    await page.goto("/join/synthetic-invite");
    await expect(page.getByTestId("join-form")).toBeVisible();
    await expect(page.getByTestId("data-notice")).toContainText(/server|سرور/);
    await setLocale(page, "en");
    await page.getByTestId("display-name").fill("Pilot Learner");
    await page.getByTestId("email").fill("pilot@example.com");
    await page.getByTestId("password").fill("correct-horse");
    await page.getByTestId("accept-notice").check();
    await expect(page.getByTestId("signup-submit")).toBeEnabled();
    await shot(page, "iteration6-signup-en");
    const enScroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(enScroll).toBeLessThanOrEqual(1);

    await setLocale(page, "fa");
    await expect(page.getByTestId("signup-submit")).toContainText("ساخت حساب");
    await shot(page, "iteration6-signup-fa");

    await page.goto("/progress");
    await setLocale(page, "en");
    await expect(page.getByTestId("assignment-panel")).toContainText("Structure week drill");
    await expect(page.getByTestId("echo-verdict")).toContainText("PARTIALLY_APPROVED");
    await expect(page.getByTestId("echo-verdict")).toContainText("does not unlock");
    await expect(page.getByTestId("telegram-connect")).toBeVisible();
    await expect(page.getByTestId("practical-upload")).toBeVisible();
    await expect(page.getByTestId("enrollment-token")).toHaveCount(0);
    await expect(page.getByTestId("link-code-panel")).toHaveCount(0);
    await shot(page, "iteration6-dashboard-en");
    await setLocale(page, "fa");
    await expect(page.getByTestId("assignment-panel")).toContainText("تمرین هفته ساختار");
    await shot(page, "iteration6-dashboard-fa");
    const dashScroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(dashScroll).toBeLessThanOrEqual(1);

    await page.goto("/submit");
    await expect(page).toHaveURL(/\/progress$/);
    await setLocale(page, "en");
    await expect(page.getByTestId("upload-dropzone")).toBeVisible();
    await expect(page.getByTestId("upload-submit")).toBeVisible();
    await expect(page.getByTestId("progress-page")).toContainText(/saved securely/i);
    await expect(page.getByTestId("progress-page")).not.toContainText("Google Drive");
    await shot(page, "iteration6-upload-en");
    await setLocale(page, "fa");
    await shot(page, "iteration6-upload-fa");
    const uploadScroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(uploadScroll).toBeLessThanOrEqual(1);

    await page.goto("/academy/missions/M5");
    await setLocale(page, "en");
    await expect(page.getByTestId("content-locked")).toBeVisible();
    await expect(page.getByTestId("content-locked")).toContainText(/locked/i);
    await expect(page.getByTestId("quiz-gate")).toHaveCount(0);
    await shot(page, "iteration6-locked-en");
    await setLocale(page, "fa");
    await expect(page.getByTestId("content-locked")).toContainText("قفل");
    await shot(page, "iteration6-locked-fa");
    const lockedScroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(lockedScroll).toBeLessThanOrEqual(1);
  });
});
