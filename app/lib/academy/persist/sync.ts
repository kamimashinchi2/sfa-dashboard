import type { BackupPayload } from "./types";

/**
 * Server seam — Noop only for Iteration 3.
 * Behind NEXT_PUBLIC_SYNC_ENABLED=false.
 */
export type SyncAdapter = {
  pull: () => Promise<BackupPayload | null>;
  push: (backup: BackupPayload, baseRev: number) => Promise<{ ok: boolean; rev: number }>;
};

export class NoopSyncAdapter implements SyncAdapter {
  async pull(): Promise<BackupPayload | null> {
    return null;
  }
  async push(
    _backup: BackupPayload,
    baseRev: number,
  ): Promise<{ ok: boolean; rev: number }> {
    return { ok: true, rev: baseRev };
  }
}

export function isSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SYNC_ENABLED === "true";
}

export function createSyncAdapter(): SyncAdapter {
  // Always Noop for Iteration 3 — do not build server storage now
  return new NoopSyncAdapter();
}
