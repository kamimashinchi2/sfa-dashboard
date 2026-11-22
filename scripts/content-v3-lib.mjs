/**
 * Validate content/v3 and emit client-safe modules plus a server-only key.
 * Never print answer values. Warnings name the level, not the index.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const FORBIDDEN_PUBLIC_KEYS = [
  "answer",
  "answers",
  "correct",
  "correctAnswer",
  "correctIndex",
  "key",
  "solution",
];

const LEVELS = ["L00", "L01", "L02", "L03", "L04", "L05", "L06", "L07", "L08"];
const MISSION = { L01: "M1", L02: "M2", L03: "M3", L04: "M4", L05: "M5" };
const ADVANCED = { L06: "A6", L07: "A7", L08: "A8" };

function isText(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.fa === "string" &&
    typeof value.en === "string" &&
    value.fa.length > 0 &&
    value.en.length > 0 &&
    Object.keys(value).every((key) => key === "fa" || key === "en")
  );
}

function walkKeys(value, visit) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, visit);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key);
    walkKeys(child, visit);
  }
}

function readJson(file, errors) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    errors.push(`invalid JSON: ${path.basename(file)}`);
    return null;
  }
}

export function loadPack(dir) {
  const errors = [];
  const manifest = readJson(path.join(dir, "manifest.json"), errors);
  const rules = readJson(path.join(dir, "rules.json"), errors);
  const chapters = {};
  const quizzes = {};
  const keys = {};
  const homework = {};
  const chapterDir = path.join(dir, "chapters");
  const quizDir = path.join(dir, "quizzes");
  const keyDir = path.join(dir, "keys");
  const homeworkDir = path.join(dir, "homework");
  for (const name of safeList(chapterDir)) {
    if (!name.endsWith(".json")) continue;
    chapters[name.slice(0, -5)] = readJson(path.join(chapterDir, name), errors);
  }
  for (const name of safeList(quizDir)) {
    if (!name.endsWith(".quiz.json")) continue;
    quizzes[name.slice(0, -".quiz.json".length)] = readJson(path.join(quizDir, name), errors);
  }
  for (const name of safeList(keyDir)) {
    if (!name.endsWith(".key.json")) continue;
    keys[name.slice(0, -".key.json".length)] = readJson(path.join(keyDir, name), errors);
  }
  for (const name of safeList(homeworkDir)) {
    if (!name.endsWith(".json")) continue;
    homework[name.slice(0, -5)] = readJson(path.join(homeworkDir, name), errors);
  }
  return { errors, manifest, rules, chapters, quizzes, keys, homework };
}

function safeList(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function decimalString(value) {
  return typeof value === "string" && /^-?\d+\.\d{2}$/.test(value);
}

function situationRisk(value) {
  return value === "not stated" || decimalString(value);
}

export function validatePack(pack) {
  const errors = [...(pack.errors ?? [])];
  const warnings = [];
  const manifest = pack.manifest;
  if (!manifest || typeof manifest.packVersion !== "string" || typeof manifest.source !== "string") {
    errors.push("manifest.json needs packVersion and source");
  }
  const levels = Array.isArray(manifest?.levels) ? manifest.levels : [];
  if (levels.length !== 9) errors.push("manifest must list 9 levels");
  const seenCodes = new Set();
  levels.forEach((level, index) => {
    const expected = LEVELS[index];
    if (!level || level.level !== expected) {
      errors.push(`level ${index} must be ${expected ?? "unknown"}`);
      return;
    }
    if (level.stage !== index) errors.push(`${expected} stage must be ${index}`);
    if (expected === "L00") {
      if (level.public !== true || level.graded !== false) errors.push("L00 must be public and ungraded");
      if (level.missionId || level.advancedId) errors.push("L00 has no mission or advanced id");
    } else if (MISSION[expected]) {
      if (level.missionId !== MISSION[expected] || level.graded !== true) {
        errors.push(`${expected} must be graded mission ${MISSION[expected]}`);
      }
      if (level.public === true) errors.push(`${expected} is not public`);
    } else if (level.advancedId !== ADVANCED[expected] || level.graded !== true) {
      errors.push(`${expected} must be graded advanced ${ADVANCED[expected]}`);
    }
    if (!Array.isArray(level.chapters) || level.chapters.length < 1 || level.chapters.length > 12) {
      errors.push(`${expected} needs 1 to 12 chapters`);
    }
    (level.chapters ?? []).forEach((code, order) => {
      if (seenCodes.has(code)) errors.push(`duplicate chapter code ${code}`);
      seenCodes.add(code);
      const chapter = pack.chapters[code];
      if (!chapter) {
        errors.push(`missing chapter file ${code}`);
        return;
      }
      if (chapter.code !== code || chapter.level !== expected || chapter.order !== order + 1) {
        errors.push(`${code} code, level, or order does not match the manifest`);
      }
      if (typeof chapter.enReviewed !== "boolean") errors.push(`${code} enReviewed must be boolean`);
      if (!isText(chapter.title) || !isText(chapter.body) || !isText(chapter.question)) {
        errors.push(`${code} needs title, body, and question text`);
      }
      for (const field of ["objectives", "selfReviewRubric"]) {
        if (chapter[field] != null && (!Array.isArray(chapter[field]) || chapter[field].some((item) => !isText(item)))) {
          errors.push(`${code} ${field} must be Text[]`);
        }
      }
      for (const field of ["workedExample", "riskExample", "trap", "reality", "summary"]) {
        if (chapter[field] != null && !isText(chapter[field])) errors.push(`${code} ${field} must be Text`);
      }
      if (chapter.exercises != null) {
        if (!Array.isArray(chapter.exercises)) errors.push(`${code} exercises must be a list`);
        else {
          chapter.exercises.forEach((row, rowIndex) => {
            if (!isText(row?.prompt) || !(row.selfCheck === null || isText(row.selfCheck))) {
              errors.push(`${code} exercise ${rowIndex + 1} needs a prompt and a selfCheck`);
            }
          });
        }
      }
      if (!Array.isArray(chapter.sourceRefs) || !Array.isArray(chapter.gaps)) {
        errors.push(`${code} needs sourceRefs and gaps`);
      }
    });
    if (!level.graded) {
      if (pack.quizzes[expected] || pack.keys[expected] || pack.homework[expected]) {
        errors.push(`${expected} must not have a quiz, key, or homework`);
      }
      return;
    }
    const quiz = pack.quizzes[expected];
    const key = pack.keys[expected];
    const home = pack.homework[expected];
    if (!quiz || !key || !home) {
      errors.push(`${expected} needs a public quiz, a server key, and homework`);
      return;
    }
    const forbidden = [];
    walkKeys(quiz, (name) => {
      if (FORBIDDEN_PUBLIC_KEYS.includes(name)) forbidden.push(name);
    });
    if (forbidden.length) errors.push(`${expected} public quiz contains an answer-like field`);
    if (quiz.level !== expected || !Array.isArray(quiz.items) || quiz.items.length !== 10) {
      errors.push(`${expected} quiz must contain 10 items`);
    }
    const ids = [];
    const mcIndexes = [];
    (quiz.items ?? []).forEach((item) => {
      if (!item || typeof item.id !== "string" || !item.id.startsWith(`${expected}-Q`)) {
        errors.push(`${expected} quiz item id is missing`);
        return;
      }
      ids.push(item.id);
      if (!["mc", "numeric", "order"].includes(item.kind)) errors.push(`${item.id} kind is invalid`);
      if (!isText(item.prompt) || !isText(item.rationale)) errors.push(`${item.id} needs prompt and rationale text`);
      if (typeof item.remediationTopic !== "string" || typeof item.chapterRef !== "string") {
        errors.push(`${item.id} needs remediationTopic and chapterRef`);
      }
      if (item.kind === "mc") {
        if (!Array.isArray(item.options) || item.options.length !== 4 || item.options.some((option) => !isText(option))) {
          errors.push(`${item.id} multiple choice needs 4 options`);
        }
      } else if (item.kind === "order") {
        if (!Array.isArray(item.options) || item.options.length < 2 || item.options.some((option) => !isText(option))) {
          errors.push(`${item.id} order items are invalid`);
        }
      } else if (item.options != null) {
        errors.push(`${item.id} numeric item must not include options`);
      }
      const answer = key.answers ? key.answers[item.id] : undefined;
      if (item.kind === "mc") {
        if (!Number.isInteger(answer) || answer < 0 || answer >= (item.options?.length ?? 0)) {
          errors.push(`${item.id} answer shape does not match kind`);
        } else mcIndexes.push(answer);
      } else if (item.kind === "numeric") {
        if (!decimalString(answer) && !(typeof answer === "string" && /^-?\d+(\.\d+)?$/.test(answer))) {
          errors.push(`${item.id} answer shape does not match kind`);
        }
      } else if (!Array.isArray(answer) || answer.length !== (item.options?.length ?? -1) || answer.some((n) => !Number.isInteger(n))) {
        errors.push(`${item.id} answer shape does not match kind`);
      } else if (new Set(answer).size !== answer.length || answer.some((n) => n < 0 || n >= answer.length)) {
        errors.push(`${item.id} answer shape does not match kind`);
      }
    });
    if (new Set(ids).size !== ids.length) errors.push(`${expected} quiz ids are not unique`);
    const answerIds = key.answers ? Object.keys(key.answers) : [];
    const provenanceIds = key.provenance ? Object.keys(key.provenance) : [];
    if (key.level !== expected || answerIds.length !== ids.length || provenanceIds.length !== ids.length) {
      errors.push(`${expected} key ids do not match the quiz`);
    }
    if (ids.some((id) => !answerIds.includes(id) || !provenanceIds.includes(id) || typeof key.provenance?.[id] !== "string")) {
      errors.push(`${expected} key ids do not match the quiz`);
    }
    if (mcIndexes.length > 1 && new Set(mcIndexes).size === 1) {
      warnings.push(`${expected}: all multiple-choice answers share one index`);
    }
    if (home.level !== expected || !isText(home.dailyTask) || !Array.isArray(home.groundingChapters) || !Array.isArray(home.checklist) || home.checklist.some((item) => !isText(item))) {
      errors.push(`${expected} homework shape is invalid`);
    }
    if (!(home.riskDrill === null || isText(home.riskDrill)) || !Array.isArray(home.gaps)) {
      errors.push(`${expected} homework riskDrill or gaps is invalid`);
    }
    const a8 = level.advancedId === "A8";
    if (home.fridayPlanRequired !== a8) {
      errors.push(a8 ? "A8 homework must require the Friday plan" : "fridayPlanRequired is set on a non-A8 level");
    }
  });
  validateRules(pack.rules, errors);
  for (const code of Object.keys(pack.chapters)) {
    if (!seenCodes.has(code)) errors.push(`chapter ${code} is not in the manifest`);
  }
  for (const level of Object.keys(pack.quizzes)) {
    if (!levels.some((row) => row.level === level && row.graded)) errors.push(`unexpected quiz ${level}`);
  }
  return { errors, warnings };
}

function validateRules(rules, errors) {
  if (!rules || !rules.defaults || !rules.levels) {
    errors.push("rules.json needs defaults and levels");
    return;
  }
  const defaults = rules.defaults;
  if (!decimalString(defaults.maxRiskPctPerTrade) || !decimalString(defaults.minNetRR)) {
    errors.push("rules defaults need maxRiskPctPerTrade and minNetRR as x.xx");
  }
  if (defaults.stopRequirement !== "HARD_STRUCTURAL" && typeof defaults.stopRequirement !== "string") {
    errors.push("rules defaults need stopRequirement");
  }
  if (typeof defaults.mentalStopIsHardBlock !== "boolean") errors.push("rules defaults need mentalStopIsHardBlock");
  if (defaults.stopBlockMode != null && !["MENTAL_OR_NONE", "NO_STOP_ONLY"].includes(defaults.stopBlockMode)) {
    errors.push("rules stopBlockMode must be MENTAL_OR_NONE or NO_STOP_ONLY");
  }
  if (defaults.unplannedStopMoveIsHardBlock != null && typeof defaults.unplannedStopMoveIsHardBlock !== "boolean") {
    errors.push("rules unplannedStopMoveIsHardBlock must be boolean");
  }
  if (defaults.plannedStopMoveAllowed != null && typeof defaults.plannedStopMoveAllowed !== "boolean") {
    errors.push("rules plannedStopMoveAllowed must be boolean");
  }
  if (defaults.dailyLossCapPct != null && !decimalString(defaults.dailyLossCapPct)) {
    errors.push("rules dailyLossCapPct must be null or x.xx");
  }
  if (!rules.levels || typeof rules.levels !== "object" || Array.isArray(rules.levels)) {
    errors.push("rules levels must be an object");
    return;
  }
  for (const [level, row] of Object.entries(rules.levels)) {
    if (!LEVELS.includes(level)) errors.push(`rules level ${level} is unknown`);
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`rules ${level} must be an object`);
      continue;
    }
    for (const field of ["maxRiskPctPerTrade", "minRiskPctPerTrade", "minNetRR"]) {
      if (row[field] != null && !decimalString(row[field])) errors.push(`${level} ${field} must be x.xx`);
    }
    if (row.stopRequirement != null && typeof row.stopRequirement !== "string") errors.push(`${level} stopRequirement is invalid`);
    if (row.mentalStopIsHardBlock != null && typeof row.mentalStopIsHardBlock !== "boolean") {
      errors.push(`${level} mentalStopIsHardBlock must be boolean`);
    }
    if (row.stopBlockMode != null && !["MENTAL_OR_NONE", "NO_STOP_ONLY"].includes(row.stopBlockMode)) {
      errors.push(`${level} stopBlockMode must be MENTAL_OR_NONE or NO_STOP_ONLY`);
    }
    if (row.unplannedStopMoveIsHardBlock != null && typeof row.unplannedStopMoveIsHardBlock !== "boolean") {
      errors.push(`${level} unplannedStopMoveIsHardBlock must be boolean`);
    }
    if (row.plannedStopMoveAllowed != null && typeof row.plannedStopMoveAllowed !== "boolean") {
      errors.push(`${level} plannedStopMoveAllowed must be boolean`);
    }
    if (row.dailyLossCapPct != null && !decimalString(row.dailyLossCapPct)) {
      errors.push(`${level} dailyLossCapPct must be null or x.xx`);
    }
    if (row.situations != null) {
      if (!Array.isArray(row.situations)) errors.push(`${level} situations must be a list`);
      else {
        row.situations.forEach((item, index) => {
          if (!item || typeof item.id !== "string" || !isText(item.condition) || !situationRisk(item.riskPct) || !isText(item.stopRule) || !isText(item.rrRule) || typeof item.citation !== "string") {
            errors.push(`${level} situation ${index + 1} shape is invalid`);
          }
        });
      }
    }
  }
}

function tsString(value) {
  return JSON.stringify(value, null, 2);
}

function emit(file, source) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, source);
}

export function generate(repoRoot) {
  const dir = path.join(repoRoot, "content", "v3");
  const pack = loadPack(dir);
  const { errors, warnings } = validatePack(pack);
  if (errors.length) return { ok: false, errors, warnings };
  const levels = pack.manifest.levels;
  const publicLevels = levels.filter((level) => level.public === true);
  const publicChapters = {};
  for (const level of publicLevels) {
    for (const code of level.chapters) publicChapters[code] = pack.chapters[code];
  }
  const riskLevels = {};
  for (const [level, row] of Object.entries(pack.rules.levels)) {
    const copy = {};
    for (const field of ["maxRiskPctPerTrade", "minRiskPctPerTrade", "stopRequirement", "mentalStopIsHardBlock", "minNetRR", "stopBlockMode", "unplannedStopMoveIsHardBlock", "plannedStopMoveAllowed", "dailyLossCapPct"]) {
      if (row[field] != null) copy[field] = row[field];
    }
    riskLevels[level] = copy;
  }
  emit(
    path.join(repoRoot, "app/lib/academy/generated/v3Manifest.ts"),
    `/** Generated by scripts/build-content-v3.mjs. Do not edit. No answer keys. */\nexport const V3_PACK_VERSION = ${JSON.stringify(pack.manifest.packVersion)};\nexport const V3_SOURCE = ${JSON.stringify(pack.manifest.source)};\nexport const V3_LEVELS = ${tsString(levels)} as const;\n`,
  );
  emit(
    path.join(repoRoot, "app/lib/academy/generated/v3Chapters.ts"),
    `/** Generated client-safe chapters. No quiz answers. */\nexport const V3_CHAPTERS = ${tsString(pack.chapters)} as const;\n`,
  );
  emit(
    path.join(repoRoot, "app/lib/academy/generated/v3PublicL00.ts"),
    `/** Public readiness chapters only. */\nexport const L00_CHAPTERS = ${tsString(publicLevels[0]?.chapters.map((code) => pack.chapters[code]) ?? [])} as const;\n`,
  );
  emit(
    path.join(repoRoot, "app/lib/academy/generated/v3Quizzes.ts"),
    `/** Public quizzes. Answers are not in this module. */\nexport const V3_QUIZZES = ${tsString(pack.quizzes)} as const;\n`,
  );
  emit(
    path.join(repoRoot, "app/lib/academy/generated/v3Homework.ts"),
    `/** Homework copy. No quiz answers. */\nexport const V3_HOMEWORK = ${tsString(pack.homework)} as const;\n`,
  );
  emit(
    path.join(repoRoot, "app/lib/academy/generated/v3RiskRules.ts"),
    `/** Numeric risk bounds for the client grader. Situations are omitted on purpose. */\nexport const V3_RISK_RULES = ${tsString({ defaults: pack.rules.defaults, levels: riskLevels })} as const;\n`,
  );
  const answerLines = [];
  const provenanceLines = [];
  for (const level of LEVELS) {
    const key = pack.keys[level];
    if (!key) continue;
    for (const id of Object.keys(key.answers)) {
      answerLines.push(`  ${JSON.stringify(id)}: ${JSON.stringify(key.answers[id])} as QuizAnswerValue,`);
      provenanceLines.push(`  ${JSON.stringify(id)}: ${JSON.stringify(key.provenance[id])},`);
    }
  }
  emit(
    path.join(repoRoot, "app/lib/academy/server/v3AnswerKeyData.ts"),
    `import "server-only";\n\n/** Generated private v3 key. Never import from a client component. */\nexport type QuizAnswerValue = number | string | number[];\n\nexport const V3_QUIZ_ANSWER_KEY: Record<string, QuizAnswerValue> = {\n${answerLines.join("\n")}\n};\n\nexport const V3_QUIZ_PROVENANCE: Record<string, string> = {\n${provenanceLines.join("\n")}\n};\n`,
  );
  return {
    ok: true,
    errors,
    warnings,
    levels: levels.length,
    chapters: Object.keys(pack.chapters).length,
    quizzes: Object.keys(pack.quizzes).length,
  };
}
