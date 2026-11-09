import { guardUnknown } from "../persist/guards";
import {
  ALIAS_RE,
  RESULT_CODE_RE,
  STUDENT_ID_RE,
  type SubmissionPacket,
} from "./schema";

export type ValidateResult =
  | { ok: true; value: SubmissionPacket }
  | { ok: false; errors: string[] };

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && Number.isFinite(n);
}

function rejectFloats(value: unknown, path: string, errors: string[]): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`NON_FINITE:${path}`);
    else if (!Number.isInteger(value)) errors.push(`FLOAT_FORBIDDEN:${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => rejectFloats(v, `${path}[${i}]`, errors));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        errors.push(`DANGEROUS_KEY:${path}.${k}`);
      }
      rejectFloats(v, path ? `${path}.${k}` : k, errors);
    }
  }
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

export function looksLikeEmailOrPhone(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text);
}

/** Hand-rolled guards mirroring sfa-submission.v1 JSON Schema. */
export function validatePacket(raw: unknown): ValidateResult {
  const errors: string[] = [];
  const g = guardUnknown(raw);
  if (!g.ok) return { ok: false, errors: [g.reason] };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["NOT_OBJECT"] };
  }

  const p = raw as Record<string, unknown>;
  rejectFloats(p, "", errors);

  if (p.format !== "sfa-submission") errors.push("BAD_FORMAT");
  if (p.schemaVersion !== 1) errors.push("BAD_SCHEMA_VERSION");
  if (typeof p.packetId !== "string" || !p.packetId) errors.push("BAD_PACKET_ID");
  if (!isInt(p.packetSeq) || p.packetSeq < 1) errors.push("BAD_PACKET_SEQ");
  if (p.supersedesDigest !== null && typeof p.supersedesDigest !== "string") {
    errors.push("BAD_SUPERSEDES");
  }

  const student = p.student as Record<string, unknown> | undefined;
  if (!student || typeof student !== "object") {
    errors.push("MISSING_STUDENT");
  } else {
    const extra = Object.keys(student).filter(
      (k) => k !== "studentId" && k !== "alias",
    );
    if (extra.length) errors.push(`EXTRA_STUDENT_FIELD:${extra.join(",")}`);
    if (typeof student.studentId !== "string" || !STUDENT_ID_RE.test(student.studentId)) {
      errors.push("BAD_STUDENT_ID");
    }
    if (typeof student.alias !== "string" || !ALIAS_RE.test(student.alias)) {
      errors.push("BAD_ALIAS");
    }
  }

  if (typeof p.isoWeek !== "string" || !/^\d{4}-W\d{2}$/.test(p.isoWeek)) {
    errors.push("BAD_ISO_WEEK");
  }
  if (p.timezone !== "Europe/Amsterdam") errors.push("BAD_TIMEZONE");
  if (p.locale !== "fa" && p.locale !== "en") errors.push("BAD_LOCALE");

  const wr = p.weeklyReflection as Record<string, unknown> | undefined;
  if (!wr || typeof wr.text !== "string" || wr.text.trim().length < 50) {
    errors.push("MISSING_REFLECTION");
  } else {
    if (looksLikeEmailOrPhone(wr.text)) errors.push("PII_IN_REFLECTION");
    if (!isInt(wr.emotionBefore) || wr.emotionBefore < 0 || wr.emotionBefore > 10) {
      errors.push("BAD_EMOTION_BEFORE");
    }
    if (!isInt(wr.emotionAfter) || wr.emotionAfter < 0 || wr.emotionAfter > 10) {
      errors.push("BAD_EMOTION_AFTER");
    }
  }

  if (!Array.isArray(p.quizAttempts)) errors.push("BAD_QUIZ_ATTEMPTS");
  else {
    for (const a of p.quizAttempts as Record<string, unknown>[]) {
      if (!Array.isArray(a.items)) continue;
      for (const it of a.items as Record<string, unknown>[]) {
        if (
          a.mode === "ASSESSED" &&
          it.clientCorrect === false &&
          (typeof it.reflection !== "string" ||
            (it.reflection as string).trim().length < 20)
        ) {
          // Soft warn path — packet builder should enforce; validator flags
          errors.push(`MISSING_ITEM_REFLECTION:${String(it.itemId)}`);
        }
        if (
          typeof it.reflection === "string" &&
          looksLikeEmailOrPhone(it.reflection)
        ) {
          errors.push(`PII_IN_ITEM:${String(it.itemId)}`);
        }
      }
    }
  }

  if (!Array.isArray(p.simulatorRuns)) errors.push("BAD_SIM_RUNS");
  if (!Array.isArray(p.hardBlockEvents)) errors.push("BAD_HARD_BLOCKS");
  if (!Array.isArray(p.journalEntries)) errors.push("BAD_JOURNAL");
  if (!Array.isArray(p.lessonResponses)) errors.push("BAD_LESSON_RESPONSES");
  if (!Array.isArray(p.selfReports)) errors.push("BAD_SELF_REPORTS");

  const decls = p.declarations as Record<string, unknown> | undefined;
  if (!decls || decls.syntheticDataOnly !== true || decls.aliasOnly !== true) {
    errors.push("BAD_DECLARATIONS");
  }

  const integ = p.integrity as Record<string, unknown> | undefined;
  if (!integ) errors.push("MISSING_INTEGRITY");
  else {
    if (integ.algorithm !== "SHA-256") errors.push("BAD_ALGORITHM");
    if (integ.canonicalization !== "sfa-canon-v1") {
      errors.push("BAD_CANONICALIZATION");
    }
    if (typeof integ.digest !== "string" || !/^[0-9a-f]{64}$/.test(integ.digest)) {
      errors.push("BAD_DIGEST");
    }
    if (typeof integ.resultCode !== "string" || !RESULT_CODE_RE.test(integ.resultCode)) {
      errors.push("BAD_RESULT_CODE");
    }
  }

  // Derive hard-block consistency soft-check
  if (Array.isArray(p.simulatorRuns) && Array.isArray(p.hardBlockEvents)) {
    const derived = (p.simulatorRuns as Record<string, unknown>[])
      .filter((r) => r.status === "HARD_BLOCK")
      .map((r) => r.runId);
    const listed = (p.hardBlockEvents as Record<string, unknown>[]).map(
      (e) => e.runId,
    );
    if (derived.length !== listed.length || derived.some((id, i) => id !== listed[i])) {
      // Allow set equality regardless of order for validation message
      const ds = new Set(derived.map(String));
      const ls = new Set(listed.map(String));
      if (ds.size !== ls.size || [...ds].some((x) => !ls.has(x))) {
        errors.push("HARD_BLOCK_MISMATCH");
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: raw as SubmissionPacket };
}
