/**
 * Browser download helper with correct object-URL lifecycle.
 * Does not assume HTTP is the sole failure cause; callers should verify
 * completed download events, filenames, and UTF-8 contents in E2E.
 */
export type DownloadResult = {
  ok: boolean;
  filename: string;
  bytes: number;
  revoked: boolean;
  error?: string;
};

export function downloadTextFile(input: {
  filename: string;
  content: string;
  mime: string;
  /** Document used for anchor click — inject for tests. */
  doc?: Document;
  /** Optional URL API override for tests. */
  urlApi?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  /** Delay before revoke so the browser can start the download. */
  revokeDelayMs?: number;
}): DownloadResult {
  try {
    const doc = input.doc ?? (typeof document !== "undefined" ? document : null);
    const urlApi =
      input.urlApi ?? (typeof URL !== "undefined" ? URL : null);
    if (!doc || !urlApi) {
      return {
        ok: false,
        filename: input.filename,
        bytes: 0,
        revoked: false,
        error: "NO_DOM",
      };
    }
    const bytes = new TextEncoder().encode(input.content).length;
    const blob = new Blob([input.content], { type: input.mime });
    const url = urlApi.createObjectURL(blob);
    const a = doc.createElement("a");
    a.href = url;
    a.download = input.filename;
    a.rel = "noopener";
    a.style.display = "none";
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    const delay = input.revokeDelayMs ?? 4_000;
    // Revoke after the browser has a chance to consume the URL — not synchronously.
    const timer = setTimeout(() => {
      try {
        urlApi.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, delay);
    // Avoid keeping the timer alive in Node test environments if unref exists
    const t = timer as unknown as { unref?: () => void };
    t.unref?.();
    return { ok: true, filename: input.filename, bytes, revoked: false };
  } catch (e) {
    return {
      ok: false,
      filename: input.filename,
      bytes: 0,
      revoked: false,
      error: e instanceof Error ? e.message : "DOWNLOAD_FAIL",
    };
  }
}
