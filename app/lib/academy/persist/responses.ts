import { guardUnknown } from "./guards";
import {
  defaultResponses,
  type LessonResponseRecord,
  type ResponsesStore,
  type SelfReportRecord,
} from "./types";

const RESPONSES_CAP = 200;
const SELF_REPORT_CAP = 500;

export function guardResponses(raw: unknown): {
  ok: boolean;
  value: ResponsesStore | null;
  reason?: string;
} {
  const g = guardUnknown(raw);
  if (!g.ok) return { ok: false, value: null, reason: g.reason };
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: null, reason: "NOT_OBJECT" };
  }
  const o = raw as Partial<ResponsesStore>;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      lessonResponses: Array.isArray(o.lessonResponses)
        ? o.lessonResponses.slice(0, RESPONSES_CAP)
        : [],
      selfReports: Array.isArray(o.selfReports)
        ? o.selfReports.slice(0, SELF_REPORT_CAP)
        : [],
    },
  };
}

export function upsertLessonResponse(
  store: ResponsesStore,
  record: LessonResponseRecord,
): ResponsesStore {
  const without = store.lessonResponses.filter((r) => r.id !== record.id);
  return {
    schemaVersion: 1,
    lessonResponses: [record, ...without].slice(0, RESPONSES_CAP),
    selfReports: store.selfReports,
  };
}

export function pushSelfReport(
  store: ResponsesStore,
  report: SelfReportRecord,
): ResponsesStore {
  return {
    schemaVersion: 1,
    lessonResponses: store.lessonResponses,
    selfReports: [report, ...store.selfReports].slice(0, SELF_REPORT_CAP),
  };
}

export function sanitizeImportedResponses(store: ResponsesStore): ResponsesStore {
  return guardResponses(store).value ?? defaultResponses();
}
