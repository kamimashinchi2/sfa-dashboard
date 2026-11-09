import { describe, expect, it } from "vitest";
import {
  defaultOutbox,
  enqueueQuizResult,
  markAcked,
  markRetryOrFail,
  recoverStrandedSending,
} from "./outbox";

describe("durable outbox", () => {
  it("enqueues immutable payload and ACKs once", () => {
    let store = defaultOutbox();
    const enq = enqueueQuizResult(store, {
      attemptId: "M1-attempt-1",
      ownerStudentId: "S07",
      payloadJson: '{"format":"sfa-quiz-result","schemaVersion":2}',
    });
    expect(enq.ok).toBe(true);
    if (!enq.ok) return;
    store = enq.store;
    expect(store.entries).toHaveLength(1);
    const dup = enqueueQuizResult(store, {
      attemptId: "M1-attempt-1",
      ownerStudentId: "S07",
      payloadJson: '{"format":"sfa-quiz-result","schemaVersion":2}',
    });
    expect(dup.ok).toBe(false);
    store = markAcked(store, "M1-attempt-1", 202);
    expect(store.entries).toHaveLength(0);
    expect(store.receipts).toHaveLength(1);
    const again = enqueueQuizResult(store, {
      attemptId: "M1-attempt-1",
      ownerStudentId: "S07",
      payloadJson: '{"format":"sfa-quiz-result","schemaVersion":2}',
    });
    expect(again.ok).toBe(false);
  });

  it("recovers stranded SENDING", () => {
    let store = defaultOutbox();
    const enq = enqueueQuizResult(store, {
      attemptId: "M1-attempt-2",
      ownerStudentId: "S07",
      payloadJson: "{}",
    });
    if (!enq.ok) throw new Error("enq");
    store = {
      ...enq.store,
      entries: enq.store.entries.map((e) => ({
        ...e,
        status: "SENDING" as const,
      })),
    };
    store = recoverStrandedSending(store);
    expect(store.entries[0]!.status).toBe("RETRY");
  });

  it("400 is terminal", () => {
    let store = defaultOutbox();
    const enq = enqueueQuizResult(store, {
      attemptId: "M1-attempt-3",
      ownerStudentId: "S07",
      payloadJson: "{}",
    });
    if (!enq.ok) throw new Error("enq");
    store = markRetryOrFail(enq.store, "M1-attempt-3", 400, "BAD");
    expect(store.entries[0]!.status).toBe("FAILED");
  });
});
