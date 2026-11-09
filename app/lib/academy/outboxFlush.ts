"use client";

import {
  consentStore,
  markAcked,
  markRetryOrFail,
  markSending,
  outboxStore,
  recoverStrandedSending,
  type OutboxEntry,
} from "./persist/outbox";

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let pausedForLogin = false;

export function pauseOutboxForLogin(pause: boolean) {
  pausedForLogin = pause;
}

async function withLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const locks = nav && "locks" in nav ? nav.locks : null;
  if (locks?.request) {
    return locks.request("sfa.v2.outbox.flush", { ifAvailable: true }, async (lock) => {
      if (!lock) return undefined;
      return fn();
    });
  }
  // Bounded lease fallback
  if (flushing) return undefined;
  flushing = true;
  try {
    return await fn();
  } finally {
    flushing = false;
  }
}

async function sendOne(entry: OutboxEntry): Promise<void> {
  outboxStore.set(markSending(outboxStore.getSnapshot(), entry.attemptId));
  try {
    const res = await fetch("/api/mentor/quiz-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: entry.payloadJson, // exact frozen bytes
      credentials: "same-origin",
    });
    if (res.status === 200 || res.status === 202) {
      const data = (await res.json().catch(() => ({}))) as {
        accepted?: boolean;
      };
      if (data.accepted !== false) {
        outboxStore.set(
          markAcked(outboxStore.getSnapshot(), entry.attemptId, res.status),
        );
        return;
      }
    }
    if (res.status === 401) {
      pauseOutboxForLogin(true);
      outboxStore.set(
        markRetryOrFail(
          outboxStore.getSnapshot(),
          entry.attemptId,
          401,
          "UNAUTHORIZED",
        ),
      );
      return;
    }
    if (res.status === 409) {
      // Fresh nonce retry — keep payload identical; proxy signs new nonce
      outboxStore.set(
        markRetryOrFail(
          outboxStore.getSnapshot(),
          entry.attemptId,
          409,
          "REPLAY",
        ),
      );
      return;
    }
    outboxStore.set(
      markRetryOrFail(
        outboxStore.getSnapshot(),
        entry.attemptId,
        res.status,
        `HTTP_${res.status}`,
      ),
    );
  } catch {
    outboxStore.set(
      markRetryOrFail(
        outboxStore.getSnapshot(),
        entry.attemptId,
        null,
        "NETWORK",
      ),
    );
  }
}

export async function flushOutbox(): Promise<void> {
  if (pausedForLogin) return;
  if (!consentStore.getSnapshot().quizTransportConsent) return;

  await withLock(async () => {
    const store = recoverStrandedSending(outboxStore.getSnapshot());
    outboxStore.set(store);
    const now = Date.now();
    const due = store.entries.filter(
      (e) =>
        (e.status === "QUEUED" || e.status === "RETRY") &&
        (!e.nextAttemptAtISO || Date.parse(e.nextAttemptAtISO) <= now),
    );
    for (const entry of due.slice(0, 5)) {
      if (pausedForLogin) break;
      await sendOne(entry);
    }
  });

  scheduleOutboxFlush();
}

export function scheduleOutboxFlush(delayMs = 0) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushOutbox();
  }, delayMs);
}

export function startOutboxListeners() {
  if (typeof window === "undefined") return;
  const kick = () => scheduleOutboxFlush(100);
  window.addEventListener("online", kick);
  window.addEventListener("focus", kick);
  scheduleOutboxFlush(500);
  return () => {
    window.removeEventListener("online", kick);
    window.removeEventListener("focus", kick);
    if (flushTimer) clearTimeout(flushTimer);
  };
}
