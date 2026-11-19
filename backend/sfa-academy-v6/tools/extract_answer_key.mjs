#!/usr/bin/env node
// Read-only: builds an answer key JSON from a local checkout of sfa-dashboard.
// Usage: node extract_answer_key.mjs <repoDir> [commitLabel] > answer-key.json
// Requires Node >= 22.6 (native TypeScript type stripping). Never writes into the repo.
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const repo = process.argv[2];
const commit = process.argv[3] ?? null;
if (!repo) { console.error("usage: extract_answer_key.mjs <repoDir> [commit]"); process.exit(2); }
function stripServerOnly(code) {
  return code.replace(/^\s*import\s+["']server-only["'];?\s*\r?\n/gm, "");
}
const src = join(repo, "app/lib/academy");
const tmp = mkdtempSync(join(tmpdir(), "sfa-key-"));
for (const f of readdirSync(src)) {
  if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
  const code = stripServerOnly(readFileSync(join(src, f), "utf8")).replace(/from "(\.\/[^"]+)"/g, (m, p) => `from "${p}.ts"`);
  writeFileSync(join(tmp, f), code);
}
const cur = await import(pathToFileURL(join(tmp, "curriculum.ts")).href);
const adv = await import(pathToFileURL(join(tmp, "advancedCurriculum.ts")).href);
const quizzes = await import(pathToFileURL(join(tmp, "assessmentVersion.ts")).href);
const answerSource=stripServerOnly(readFileSync(join(src,"server/answerKeyData.ts"),"utf8"));
writeFileSync(join(tmp,"answerKeyData.ts"),answerSource);
const {QUIZ_ANSWER_KEY}=await import(pathToFileURL(join(tmp,"answerKeyData.ts")).href);
const {itemHash, legacyItemHash, ITEM_HASH_VERSION}=await import(pathToFileURL(join(tmp,"quizHash.ts")).href);
const hydrate=(items)=>items.map(i=>{ const answer=QUIZ_ANSWER_KEY[i.id]; if(answer===undefined) throw new Error("Missing private answer: "+i.id); return {...i,answer}; });

function readHmacSecret() {
  const file = process.env.SFA_QUIZ_ITEM_HMAC_FILE;
  const raw = file ? readFileSync(file, "utf8") : (process.env.SFA_QUIZ_ITEM_HMAC_KEY || "");
  const secret = String(raw).trim();
  if (secret.length < 32) {
    console.error("SFA_QUIZ_ITEM_HMAC_KEY or SFA_QUIZ_ITEM_HMAC_FILE is required (32+ characters). The value is not printed.");
    process.exit(2);
  }
  return secret;
}
const secret = readHmacSecret();

const out = { format: "sfa-answer-key", hashVersion: ITEM_HASH_VERSION, commit, assessmentCriteriaVersion: quizzes.ASSESSMENT_CRITERIA_VERSION, quizzes: {} };
const add = (quizId, items) => {
  out.quizzes[quizId] = items.map((i) => {
    const mac = itemHash(i, secret);
    if (mac === legacyItemHash(i)) {
      console.error("item hash collided with the legacy unsalted digest");
      process.exit(1);
    }
    return { itemId: i.id, kind: i.kind, answer: i.answer, remediationTopic: i.remediationTopic, optionCount: i.options?.length ?? null, itemHash: mac, hashVersion: ITEM_HASH_VERSION };
  });
};
for (const m of cur.missions) add(m.id, hydrate(m.quiz));
for (const a of adv.advancedModules) add(a.id, hydrate(a.quiz));
process.stdout.write(JSON.stringify(out, null, 2) + "\n");

rmSync(tmp,{recursive:true,force:true});
