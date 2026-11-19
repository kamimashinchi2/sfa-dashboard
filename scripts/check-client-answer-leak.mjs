/**
 * After `npm run build`, fail if the client static bundle contains the private
 * answer key or a server-only provenance marker.
 * API payload leaks (reversible item hashes, fixed option slots, identity
 * order) are covered by app/lib/academy/quizLeak.test.ts and the content route test.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../.next/static", import.meta.url);
const markers = ["QUIZ_ANSWER_KEY", "QUIZ_PROVENANCE", "Market_Maker_Scout_v3.0_and_Decision_Engine"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(js|css|json|txt)$/.test(name)) out.push(path);
  }
  return out;
}

const hits = [];
for (const file of walk(root.pathname)) {
  const text = readFileSync(file, "utf8");
  for (const marker of markers) {
    if (text.includes(marker)) hits.push(`${marker} in ${file}`);
  }
}
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log(`client static bundle has none of: ${markers.join(", ")}`);
