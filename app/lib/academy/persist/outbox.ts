import { guardUnknown } from "./guards";
import {
  SFA_V2_PREFIX,
  type PrefsStore,
} from "./types";
import { createPersistedStore } from "./createPersistedStore";

export const OUTBOX_DOMAIN_VERSION = 1 as const;
export const OUTBOX_UNSENT_CAP = 200;
export const OUTBOX_RECEIPT_CAP = 1000;
export const OUTBOX_MAX_AUTO_ATTEMPTS = 8;

export type OutboxStatus =
  | "QUEUED"
  | "SENDING"
  | "RETRY"
  | "ACKED"
  | "FAILED";

export type OutboxEntry = {
  attemptId: string;
  ownerStudentId: string;
  /** Exact serialized sfa-quiz-result v2 JSON string — never regenerate. */
  payloadJson: string;
  status: OutboxStatus;
  retries: number;
  enqueuedAtISO: string;
  updatedAtISO: string;
  nextAttemptAtISO: string | null;
  errorCode: string | null;
  lastHttpStatus: number | null;
};

export type OutboxReceipt = {
  attemptId: string;
  atISO: string;
  httpStatus: number;
};

export type OutboxStore = {
  schemaVersion: typeof OUTBOX_DOMAIN_VERSION;
  entries: OutboxEntry[];
  receipts: OutboxReceipt[];
};

export function defaultOutbox(): OutboxStore {
  return { schemaVersion: OUTBOX_DOMAIN_VERSION, entries: [], receipts: [] };
}

export function storageKeyOutbox(): string {
  return `${SFA_V2_PREFIX}outbox`;
}

export function guardOutbox(raw: unknown): {
  ok: boolean;
  value: OutboxStore | null;
  reason?: string;
} {
  const g = guardUnknown(raw);
  if (!g.ok) return { ok: false, value: null, reason: g.reason };
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: null, reason: "NOT_OBJECT" };
  }
  const o = raw as Partial<OutboxStore>;
  if (o.schemaVersion !== OUTBOX_DOMAIN_VERSION) {
    return { ok: false, value: null, reason: "BAD_VERSION" };
  }
  if (!Array.isArray(o.entries) || !Array.isArray(o.receipts)) {
    return { ok: false, value: null, reason: "BAD_SHAPE" };
  }
  return {
    ok: true,
    value: {
      schemaVersion: OUTBOX_DOMAIN_VERSION,
      entries: o.entries as OutboxEntry[],
      receipts: o.receipts as OutboxReceipt[],
    },
  };
}

export const outboxStore = createPersistedStore<OutboxStore>({
  key: storageKeyOutbox(),
  version: OUTBOX_DOMAIN_VERSION,
  defaults: defaultOutbox,
  guard: guardOutbox,
});

export type ConsentStore = {
  schemaVersion: 1;
  /** Default OFF — disclose before enabling. */
  quizTransportConsent: boolean;
  consentedAtISO: string | null;
};

export function defaultConsent(): ConsentStore {
  return {
    schemaVersion: 1,
    quizTransportConsent: false,
    consentedAtISO: null,
  };
}

export function guardConsent(raw: unknown): {
  ok: boolean;
  value: ConsentStore | null;
  reason?: string;
} {
  const g = guardUnknown(raw);
  if (!g.ok) return { ok: false, value: null, reason: g.reason };
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: null, reason: "NOT_OBJECT" };
  }
  const o = raw as Partial<ConsentStore>;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      quizTransportConsent: o.quizTransportConsent === true,
      consentedAtISO:
        typeof o.consentedAtISO === "string" ? o.consentedAtISO : null,
    },
  };
}

export const consentStore = createPersistedStore<ConsentStore>({
  key: `${SFA_V2_PREFIX}consent`,
  version: 1,
  defaults: defaultConsent,
  guard: guardConsent,
});

export function enqueueQuizResult(
  store: OutboxStore,
  entry: {
    attemptId: string;
    ownerStudentId: string;
    payloadJson: string;
    enqueuedAtISO?: string;
  },
): { ok: true; store: OutboxStore } | { ok: false; error: string } {
  if (store.receipts.some((r) => r.attemptId === entry.attemptId)) {
    return { ok: false, error: "ALREADY_ACKED" };
  }
  if (store.entries.some((e) => e.attemptId === entry.attemptId)) {
    return { ok: false, error: "DUPLICATE_ATTEMPT" };
  }
  const unsent = store.entries.filter((e) => e.status !== "ACKED");
  if (unsent.length >= OUTBOX_UNSENT_CAP) {
    return { ok: false, error: "OUTBOX_FULL" };
  }
  const now = entry.enqueuedAtISO ?? new Date().toISOString();
  const next: OutboxEntry = {
    attemptId: entry.attemptId,
    ownerStudentId: entry.ownerStudentId,
    payloadJson: entry.payloadJson,
    status: "QUEUED",
    retries: 0,
    enqueuedAtISO: now,
    updatedAtISO: now,
    nextAttemptAtISO: now,
    errorCode: null,
    lastHttpStatus: null,
  };
  return {
    ok: true,
    store: {
      schemaVersion: OUTBOX_DOMAIN_VERSION,
      entries: [next, ...store.entries],
      receipts: store.receipts,
    },
  };
}

export function backoffMs(retries: number): number {
  const base = Math.min(15 * 60_000, 1000 * 2 ** Math.min(retries, 10));
  const jitter = Math.floor(Math.random() * base * 0.2);
  return base + jitter;
}

export function markSending(
  store: OutboxStore,
  attemptId: string,
): OutboxStore {
  return {
    ...store,
    entries: store.entries.map((e) =>
      e.attemptId === attemptId
        ? {
            ...e,
            status: "SENDING" as const,
            updatedAtISO: new Date().toISOString(),
          }
        : e,
    ),
  };
}

export function markAcked(
  store: OutboxStore,
  attemptId: string,
  httpStatus: number,
): OutboxStore {
  const now = new Date().toISOString();
  const receipts = [
    { attemptId, atISO: now, httpStatus },
    ...store.receipts.filter((r) => r.attemptId !== attemptId),
  ].slice(0, OUTBOX_RECEIPT_CAP);
  return {
    schemaVersion: OUTBOX_DOMAIN_VERSION,
    entries: store.entries.filter((e) => e.attemptId !== attemptId),
    receipts,
  };
}

export function markRetryOrFail(
  store: OutboxStore,
  attemptId: string,
  httpStatus: number | null,
  errorCode: string,
): OutboxStore {
  const now = new Date().toISOString();
  return {
    ...store,
    entries: store.entries.map((e) => {
      if (e.attemptId !== attemptId) return e;
      const retries = e.retries + 1;
      const terminal =
        httpStatus === 400 ||
        httpStatus === 413 ||
        retries >= OUTBOX_MAX_AUTO_ATTEMPTS;
      return {
        ...e,
        retries,
        lastHttpStatus: httpStatus,
        errorCode,
        updatedAtISO: now,
        status: terminal ? ("FAILED" as const) : ("RETRY" as const),
        nextAttemptAtISO: terminal
          ? null
          : new Date(Date.now() + backoffMs(retries)).toISOString(),
      };
    }),
  };
}

/** Recover stranded SENDING on restart → RETRY. */
export function recoverStrandedSending(store: OutboxStore): OutboxStore {
  const now = new Date().toISOString();
  return {
    ...store,
    entries: store.entries.map((e) =>
      e.status === "SENDING"
        ? {
            ...e,
            status: "RETRY" as const,
            updatedAtISO: now,
            nextAttemptAtISO: now,
            errorCode: e.errorCode ?? "STRANDED_SENDING",
          }
        : e,
    ),
  };
}

export function identityMatchesPrefs(
  prefs: PrefsStore,
  studentId: string,
  alias: string,
): boolean {
  return prefs.studentId === studentId && prefs.alias === alias;
}
