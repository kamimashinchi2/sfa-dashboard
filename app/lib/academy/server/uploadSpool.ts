import "server-only";
import { createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

export const MAX_UPLOAD_BYTES = 22 * 1024 * 1024;
const MAX_CONCURRENT = 2;

let active = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waiters.push(resolve);
  });
  active += 1;
}

function releaseSlot(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

export type SpooledBody = {
  dir: string;
  path: string;
  size: number;
  signature: string;
};

/**
 * Spool the original request bytes to a private temp file while updating the
 * HMAC over prefix || exact bytes. Caller must `discardSpool` in finally.
 */
export async function spoolSignedBody(input: {
  body: ReadableStream<Uint8Array> | null;
  maxBytes: number;
  secret: string;
  prefix: string;
}): Promise<{ ok: true; spool: SpooledBody } | { ok: false; code: "PAYLOAD_TOO_LARGE" }> {
  await acquireSlot();
  let dir: string;
  try {
    dir = await mkdtemp(join(tmpdir(), "sfa-up-"));
  } catch (err) {
    releaseSlot();
    throw err;
  }
  const path = join(dir, "body");
  const handle = await open(path, "w", 0o600);
  const mac = createHmac("sha256", input.secret);
  mac.update(input.prefix, "utf8");
  let size = 0;
  try {
    const reader = input.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        size += value.byteLength;
        if (size > input.maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new Error("TOO_LARGE");
        }
        mac.update(value);
        await handle.write(value);
      }
    }
    await handle.close();
    return {
      ok: true,
      spool: {
        dir,
        path,
        size,
        signature: `sha256=${mac.digest("hex")}`,
      },
    };
  } catch (err) {
    await handle.close().catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
    releaseSlot();
    if (err instanceof Error && err.message === "TOO_LARGE") {
      return { ok: false, code: "PAYLOAD_TOO_LARGE" };
    }
    throw err;
  }
}

export function openSpoolStream(path: string): {
  body: ReadableStream<Uint8Array>;
  closed: Promise<void>;
} {
  const nodeStream = createReadStream(path);
  const closed = new Promise<void>((resolve, reject) => {
    nodeStream.on("close", () => resolve());
    nodeStream.on("error", (err) => reject(err));
  });
  return {
    body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
    closed,
  };
}

export async function discardSpool(spool: SpooledBody | null): Promise<void> {
  if (!spool) return;
  await rm(spool.dir, { recursive: true, force: true });
  releaseSlot();
}
