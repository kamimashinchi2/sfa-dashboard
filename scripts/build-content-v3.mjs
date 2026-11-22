#!/usr/bin/env node
/**
 * Validate content/v3 and regenerate client-safe modules and the server-only key.
 * Usage: node scripts/build-content-v3.mjs
 * Answer values are never printed.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./content-v3-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = generate(root);
for (const warning of result.warnings ?? []) console.warn(warning);
if (!result.ok) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}
console.log(
  JSON.stringify({
    ok: true,
    levels: result.levels,
    chapters: result.chapters,
    quizzes: result.quizzes,
  }),
);
