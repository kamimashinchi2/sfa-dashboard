import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const outDir = "/cursor/stores/self/media/sfa-dashboard";
fs.mkdirSync(outDir, { recursive: true });

async function scoreM1(page) {
  await page.goto("http://127.0.0.1:3000/academy/missions/M1");
  await page.getByTestId("quiz-gate").waitFor({ timeout: 30000 });
  const quiz = page.getByTestId("quiz-gate");
  const radios = quiz.locator('input[type="radio"]');
  const count = await radios.count();
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const name = await radios.nth(i).getAttribute("name");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    await radios.nth(i).check();
  }
  const nums = quiz.locator("input.font-mono");
  const n = await nums.count();
  for (let i = 0; i < n; i++) await nums.nth(i).fill("999");
  await quiz.getByTestId("score-quiz").click();
  await quiz.getByTestId("quiz-results").waitFor({ timeout: 20000 });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();

// EN quiz table
await page.goto("http://127.0.0.1:3000/academy");
// try switch to EN if available
const toggle = page.getByRole("button", { name: /EN|English/i });
if (await toggle.count()) await toggle.first().click().catch(() => {});
await scoreM1(page);
await page.getByTestId("per-item-table").screenshot({
  path: path.join(outDir, "iter5_quiz_table_en_390.png"),
});

// FA quiz table
await page.goto("http://127.0.0.1:3000/academy");
const faBtn = page.getByRole("button", { name: /FA|فارسی/i });
if (await faBtn.count()) await faBtn.first().click().catch(() => {});
await scoreM1(page);
await page.getByTestId("per-item-table").screenshot({
  path: path.join(outDir, "iter5_quiz_table_fa_390.png"),
});

// Locked future lesson
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
        fa: "درس مرحله 5 قفل است. تأیید آزمون درس بعدی را باز نمی‌کند.",
        en: "Stage 5 is locked. Quiz approval never unlocks the next lesson.",
      },
    }),
  });
});
await page.goto("http://127.0.0.1:3000/academy/missions/M5");
await page.getByTestId("content-locked").waitFor({ timeout: 15000 });
await page.screenshot({
  path: path.join(outDir, "iter5_locked_lesson_en_390.png"),
  fullPage: true,
});
await page.unroute("**/api/mentor/content?**");

// Progress panels
await page.goto("http://127.0.0.1:3000/progress");
await page.getByTestId("progress-page").waitFor();
await page.screenshot({
  path: path.join(outDir, "iter5_progress_en_390.png"),
  fullPage: true,
});

// Packet download
await page.goto("http://127.0.0.1:3000/submit");
await page.getByTestId("student-id").fill("S07");
await page.getByTestId("alias").fill("Falcon-07");
await page.getByTestId("weekly-reflection").fill(
  "This week I practiced risk sizing and learned that mental stops are HARD_BLOCK. Next week I will place structural stops first.",
);
const refl = page.locator('[data-testid^="reflection-"]');
const rc = await refl.count();
for (let i = 0; i < rc; i++) {
  await refl
    .nth(i)
    .fill(
      "I assumed the first option; next time I will check the rationale carefully.",
    );
}
await page.getByTestId("emotion-before").fill("4");
await page.getByTestId("emotion-after").fill("6");
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByTestId("download-packet").click(),
]);
await download.saveAs("/tmp/iter5-packet.md");
await page.getByTestId("result-code").waitFor({ timeout: 15000 });
await page.screenshot({
  path: path.join(outDir, "iter5_packet_download_en_390.png"),
  fullPage: true,
});

// FA progress
await page.goto("http://127.0.0.1:3000/academy");
if (await faBtn.count()) await faBtn.first().click().catch(() => {});
await page.goto("http://127.0.0.1:3000/progress");
await page.screenshot({
  path: path.join(outDir, "iter5_progress_fa_390.png"),
  fullPage: true,
});

await browser.close();
console.log("screenshots written to", outDir);
console.log(fs.readdirSync(outDir).filter((f) => f.startsWith("iter5_")));
