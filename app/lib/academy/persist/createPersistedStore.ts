import { guardUnknown } from "./guards";

export type PersistedStoreOptions<T> = {
  key: string;
  version: number;
  guard: (raw: unknown) => { ok: boolean; value: T | null; reason?: string };
  migrate?: (raw: unknown, fromVersion: number) => T;
  defaults: () => T;
  cap?: number;
  onQuotaExceeded?: () => void;
  onQuarantine?: (raw: string, reason: string) => void;
};

/**
 * Versioned persisted store with:
 * - cached getSnapshot (same reference until change)
 * - frozen getServerSnapshot (stable defaults)
 * - lazy storage reads inside subscribe (never in render / useState init)
 * - guarded writes + QuotaExceeded handling
 */
export function createPersistedStore<T>(opts: PersistedStoreOptions<T>) {
  let memory: T = opts.defaults();
  let hydrated = false;
  let serverSnap: T | null = null;
  const listeners = new Set<() => void>();

  function getServerSnapshot(): T {
    if (!serverSnap) {
      // Freeze a single defaults reference for SSR/hydration identity
      serverSnap = Object.freeze(opts.defaults()) as T;
    }
    return serverSnap;
  }

  function emit() {
    for (const l of listeners) l();
  }

  function readLazy(): void {
    if (hydrated) return;
    hydrated = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(opts.key);
      if (!raw) {
        memory = opts.defaults();
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        opts.onQuarantine?.(raw, "PARSE_FAIL");
        memory = opts.defaults();
        return;
      }
      const proto = guardUnknown(parsed);
      if (!proto.ok) {
        opts.onQuarantine?.(raw, proto.reason);
        memory = opts.defaults();
        return;
      }
      // Newer schema → read-only, never downgrade write
      const ver =
        parsed && typeof parsed === "object" && "schemaVersion" in parsed
          ? Number((parsed as { schemaVersion?: number }).schemaVersion)
          : opts.version;
      if (ver > opts.version) {
        opts.onQuarantine?.(raw, "NEWER_SCHEMA_READONLY");
        memory = opts.defaults();
        return;
      }
      if (ver < opts.version && opts.migrate) {
        memory = opts.migrate(parsed, ver);
        return;
      }
      const g = opts.guard(parsed);
      if (!g.ok || !g.value) {
        opts.onQuarantine?.(raw, g.reason ?? "GUARD_FAIL");
        memory = opts.defaults();
        return;
      }
      memory = g.value;
    } catch {
      memory = opts.defaults();
    }
  }

  function getSnapshot(): T {
    return memory;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    readLazy();
    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === opts.key) {
        hydrated = false;
        readLazy();
        emit();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  }

  function set(next: T): { ok: boolean; error?: string } {
    memory = next;
    emit();
    if (typeof window === "undefined") return { ok: false, error: "NO_WINDOW" };
    try {
      const payload = JSON.stringify(next);
      window.localStorage.setItem(opts.key, payload);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "QUOTA_OR_DENIED";
      if (/quota/i.test(msg)) opts.onQuotaExceeded?.();
      return { ok: false, error: msg };
    }
  }

  function reset(): void {
    memory = opts.defaults();
    emit();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(opts.key);
      } catch {
        /* ignore */
      }
    }
  }

  /** Force re-read after external merge. */
  function replaceMemory(next: T, write = true): void {
    memory = next;
    emit();
    if (write) set(next);
  }

  return {
    key: opts.key,
    getSnapshot,
    getServerSnapshot,
    subscribe,
    set,
    reset,
    replaceMemory,
    /** Test helper */
    _forceHydrate: readLazy,
  };
}
