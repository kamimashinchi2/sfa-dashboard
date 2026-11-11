import { expect, test, type Page } from "@playwright/test";

async function useEnglish(page: Page) {
  const html = page.locator("html");
  await expect(async () => {
    if ((await html.getAttribute("dir")) === "rtl") {
      await page.getByRole("button", { name: "English" }).click();
    }
    await expect(html).toHaveAttribute("dir", "ltr");
  }).toPass();
}

function onlyDesktopOr375() {
  const name = test.info().project.name;
  test.skip(name !== "desktop" && name !== "mobile-375", "persona journeys run on desktop and 375px");
}

async function signedOut(page: Page) {
  await page.route("**/api/mentor/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "UNAUTHORIZED" }) }),
  );
  await page.route("**/api/mentor/content?**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: "UNAUTHORIZED",
        fa: "برای ادامه وارد شوید.",
        en: "Please sign in to continue.",
      }),
    }),
  );
}

test.describe("persona journeys", () => {
  test.beforeEach(() => {
    onlyDesktopOr375();
  });

  test("diligent student sees the next action through week 8", async ({ page }) => {
    let phase = 0;
    await page.route("**/api/mentor/me", (route) => {
      const status = phase === 0 ? "LESSON_OPEN" : phase === 1 ? "ASSIGNMENT_ISSUED" : "AWAITING_SENIOR_MENTOR";
      const stage = phase === 2 ? 8 : phase === 1 ? 3 : 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          studentId: "S10001",
          displayName: "Diligent",
          email: "diligent@example.test",
          role: "STUDENT",
          unlockedStage: stage,
          currentWeek: stage,
          status,
          telegramEnabled: false,
          telegramLinked: false,
        }),
      });
    });
    await page.route("**/api/mentor/assignment", (route) => {
      if (phase === 0) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ week: 1, stage: 1, status: "LESSON_OPEN", assignment: null }),
        });
      }
      if (phase === 2) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ week: 8, stage: 8, status: "AWAITING_SENIOR_MENTOR", assignment: null }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          week: 3,
          stage: 3,
          status: "ASSIGNMENT_ISSUED",
          assignment: {
            week: 3,
            stage: 3,
            title: { fa: "تمرین ساختار", en: "Structure drill" },
            coreTasks: [{ fa: "یک استاپ سخت بنویسید.", en: "Write one hard stop." }],
            weaknessDrills: [],
            spiralReview: [
              { stage: 1, skill: "spread", task: { fa: "اسپرد را مرور کنید.", en: "Review the spread." } },
              { stage: 2, skill: "stop", task: { fa: "استاپ را مرور کنید.", en: "Review the stop." } },
            ],
            riskRules: { maxRiskPct: "1", hardStructuralStop: true, minNetRR: "2", noSignals: true },
            deliverables: [{ fa: "یک سند.", en: "One document." }],
            dueAtISO: "2026-11-18T18:00:00+01:00",
          },
        }),
      });
    });
    await page.route("**/api/mentor/report", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ markdown: "", decisions: [] }) }),
    );
    await page.route("**/api/mentor/notifications", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [] }) }),
    );
    await page.route("**/api/mentor/practicals", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ submissions: [] }) }),
    );
    await page.route("**/api/mentor/legacy-import", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ imported: true, verified: false, unlocksChanged: false }),
      }),
    );

    await page.goto("/progress");
    await useEnglish(page);
    await expect(page.getByTestId("next-step")).toContainText(/Read M1/i);
    await expect(page.getByTestId("next-step")).toContainText(/does not open the next lesson/i);

    phase = 1;
    await page.reload();
    await expect(page.getByTestId("next-step")).toContainText(/upload a document/i);
    await expect(page.getByTestId("assignment-due")).toContainText("Europe/Amsterdam");
    await expect(page.getByTestId("assignment-due")).toContainText("local");
    await expect(page.getByTestId("assignment-panel")).toContainText(/spiral/i);
    await expect(page.getByTestId("practical-upload")).toContainText(/HEIC/i);

    phase = 2;
    await page.reload();
    await expect(page.getByTestId("senior-mentor")).toContainText(/no stage 9/i);
    await expect(page.getByTestId("next-step")).toContainText(/eight weeks are complete/i);
  });

  test("careless student gets specific upload and invite errors", async ({ page }) => {
    await page.route("**/api/mentor/data-notice", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ version: 1, text: "Learning work is stored on the academy server." }),
      }),
    );
    await page.route("**/api/mentor/signup", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "VALIDATION_FAILED",
          message: "INVITE_EXPIRED_OR_INVALID",
          fa: "دعوت‌نامه منقضی یا نامعتبر است.",
          en: "This invite is expired or invalid.",
        }),
      }),
    );
    await page.route("**/api/mentor/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "UNAUTHORIZED",
          message: "LOGIN_FAILED",
          fa: "ایمیل یا رمز عبور نادرست است.",
          en: "Email or password is incorrect.",
        }),
      }),
    );
    await page.goto("/login");
    await useEnglish(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Log in");
    await expect(page.getByTestId("support-path")).toContainText(/No recovery email/i);
    await page.getByTestId("login-email").fill("careless@example.test");
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-form").getByRole("alert")).toContainText(/incorrect/i);

    await page.goto("/join/used-invite");
    await useEnglish(page);
    await page.getByTestId("display-name").fill("Careless");
    await page.getByTestId("email").fill("careless@example.test");
    await page.getByTestId("password").fill("correct-horse-1");
    await page.getByTestId("accept-notice").check();
    await page.getByTestId("signup-submit").click();
    await expect(page.getByTestId("join-form").getByRole("alert")).toContainText(/expired or invalid/i);

    await page.route("**/api/mentor/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          studentId: "S10002",
          displayName: "Careless",
          email: "careless@example.test",
          role: "STUDENT",
          unlockedStage: 1,
          currentWeek: 1,
          status: "ASSIGNMENT_ISSUED",
          telegramEnabled: false,
          telegramLinked: false,
        }),
      }),
    );
    await page.route("**/api/mentor/assignment", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ week: 1, stage: 1, status: "ASSIGNMENT_ISSUED", assignment: null }),
      }),
    );
    await page.route("**/api/mentor/report", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ markdown: "", decisions: [] }) }),
    );
    await page.route("**/api/mentor/notifications", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [] }) }),
    );
    await page.route("**/api/mentor/practicals", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ submissions: [] }) }),
    );
    await page.route("**/api/mentor/practicals/draft", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ submissionId: "draft-1", files: [] }),
      }),
    );
    await page.goto("/progress");
    await useEnglish(page);
    const input = page.getByTestId("upload-file-input");
    await input.setInputFiles({ name: "عکس-هفته.heic", mimeType: "image/heic", buffer: Buffer.from("heic") });
    await expect(page.getByTestId("uploaded-files")).toContainText(/HEIC/);
    await expect(page.getByTestId("uploaded-files")).toContainText("عکس-هفته.heic");
    await input.setInputFiles({ name: "empty.txt", mimeType: "text/plain", buffer: Buffer.from("") });
    await expect(page.getByTestId("uploaded-files")).toContainText(/empty/i);
    const big = Buffer.alloc(20 * 1024 * 1024 + 1, 1);
    await input.setInputFiles({ name: "huge.txt", mimeType: "text/plain", buffer: big });
    await expect(page.getByTestId("uploaded-files")).toContainText(/20 MiB/);
    await expect(page.getByTestId("upload-submit")).toBeDisabled();
    if (test.info().project.name === "mobile-375") {
      await page.locator("html").evaluate((el) => el.setAttribute("dir", "rtl"));
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(scroll).toBeLessThanOrEqual(1);
    }
  });

  test("failing student is told a negative result does not unlock", async ({ page }) => {
    await page.route("**/api/mentor/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (path.endsWith("/me")) {
        return json({
          studentId: "S10003",
          displayName: "Failing",
          email: "failing@example.test",
          role: "STUDENT",
          unlockedStage: 1,
          currentWeek: 2,
          status: "REMEDIAL_ISSUED",
          telegramEnabled: false,
          telegramLinked: false,
        });
      }
      if (path.endsWith("/assignment")) {
        return json({ week: 2, stage: 1, status: "REMEDIAL_ISSUED", assignment: null });
      }
      if (path.endsWith("/report")) {
        return json({
          markdown: "",
          decisions: [
            {
              id: "d-quiz",
              state: "DELIVERED",
              body: {
                verdict: "NOT_APPROVED",
                format: "sfa-quiz-decision",
                feedback: { fa: "چهار پاسخ غلط بود.", en: "Four answers were wrong. Restudy and retake." },
              },
            },
            {
              id: "d-prac",
              state: "DELIVERED",
              body: {
                verdict: "NOT_APPROVED",
                format: "sfa-practical-decision",
                feedback: {
                  fa: "استاپ ذهنی است و ریسک بالای ۱٪ است.",
                  en: "The stop is mental and risk is above 1% of equity. Net reward is below 1:2.",
                },
              },
            },
          ],
        });
      }
      if (path.endsWith("/notifications") || path.endsWith("/practicals")) return json({ notifications: [], submissions: [] });
      if (path.endsWith("/legacy-import")) return json({ imported: true, verified: false, unlocksChanged: false });
      return json({ error: "UNAUTHORIZED" }, 401);
    });
    await page.goto("/progress");
    await useEnglish(page);
    await expect(page.getByTestId("echo-verdict")).toContainText("NOT_APPROVED");
    await expect(page.getByTestId("echo-verdict")).toContainText(/does not unlock the next lesson/i);
    await expect(page.getByTestId("echo-verdict")).toContainText(/mental/i);
    await expect(page.getByTestId("week-status")).toContainText(/Remedial week/i);
  });

  test("confused student cannot skip ahead or see another student's keys", async ({ page }) => {
    await signedOut(page);
    await page.goto("/login");
    await useEnglish(page);
    await expect(page.getByTestId("open-support-chat")).toBeVisible();
    await page.getByTestId("open-support-chat").click();
    await expect(page.getByTestId("support-chat-pending")).toBeVisible();

    await page.goto("/academy/missions/M5");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/correctAnswer|answer-key|S10001/);
    await page.goto("/academy/advanced/A8");
    await expect(page.getByTestId("content-auth")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("quiz-gate")).toHaveCount(0);
  });
});
