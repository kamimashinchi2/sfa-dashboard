#!/usr/bin/env node
/**
 * Operator-only: extract private answer key for the EXACT deployed build.
 * Writes JSON to a path OUTSIDE the repo (or a private path you choose).
 * NEVER commit the output. Never upload publicly.
 *
 * Usage:
 *   node scripts/extract_answer_key.mjs --out /secure/path/answer-key-<sha>.json
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const out = arg("--out", null);
if (!out) {
  console.error(
    "Usage: node scripts/extract_answer_key.mjs --out /secure/path/key.json",
  );
  process.exit(2);
}

let commit = "unknown";
try {
  commit = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
} catch {
  /* ignore */
}

const answerKeyPath = path.join(
  root,
  "app/lib/academy/server/answerKeyData.ts",
);

const src = fs.readFileSync(answerKeyPath, "utf8");
const key = {};
// Match full RHS until " as QuizAnswerValue"
const re = /"([^"]+)":\s*(.+?)\s+as QuizAnswerValue/g;
let m;
while ((m = re.exec(src))) {
  const id = m[1];
  const raw = m[2].trim().replace(/,$/, "");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    value = Number(raw);
  }
  key[id] = value;
}

const payload = {
  format: "sfa-answer-key",
  schemaVersion: 1,
  buildCommit: commit.toLowerCase(),
  extractedAtISO: new Date().toISOString(),
  itemCount: Object.keys(key).length,
  answers: key,
};

const json = JSON.stringify(payload, null, 2);
const digest = createHash("sha256").update(json).digest("hex");
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, json);
console.log(
  JSON.stringify(
    {
      ok: true,
      out: path.resolve(out),
      buildCommit: commit,
      itemCount: payload.itemCount,
      fileSha256: digest,
      note: "PRIVATE — do not commit or publicly upload",
    },
    null,
    2,
  ),
);
