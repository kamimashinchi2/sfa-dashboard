#!/usr/bin/env node
// Read-only: builds an answer key JSON from a local checkout of sfa-dashboard.
// Usage: node extract_answer_key.mjs <repoDir> [commitLabel] > answer-key.json
// Requires Node >= 22.6 (native TypeScript type stripping). Never writes into the repo.
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
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
const hydrate=(items)=>items.map(i=>{ const answer=QUIZ_ANSWER_KEY[i.id]; if(answer===undefined) throw new Error("Missing private answer: "+i.id); return {...i,answer}; });

// Item hash = SHA-256 over canonical JSON of the scorable item content (same rule as the packet).
function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const itemHash = (i) => createHash("sha256").update(canon({ id: i.id, kind: i.kind, prompt: i.prompt, options: i.options ?? null, answer: i.answer }), "utf8").digest("hex");

const out = { format: "sfa-answer-key", commit, assessmentCriteriaVersion: quizzes.ASSESSMENT_CRITERIA_VERSION, quizzes: {} };
const add = (quizId, items) => {
  out.quizzes[quizId] = items.map((i) => ({ itemId: i.id, kind: i.kind, answer: i.answer, remediationTopic: i.remediationTopic, optionCount: i.options?.length ?? null, itemHash: itemHash(i) }));
};
for (const m of cur.missions) add(m.id, hydrate(m.quiz));
for (const a of adv.advancedModules) add(a.id, hydrate(a.quiz));
process.stdout.write(JSON.stringify(out, null, 2) + "\n");

rmSync(tmp,{recursive:true,force:true});
