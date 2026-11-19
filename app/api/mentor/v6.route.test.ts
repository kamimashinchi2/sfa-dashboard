import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const jar = {
  store: new Map<string, { value: string; opts?: Record<string, unknown> }>(),
  get(name: string) {
    const v = this.store.get(name);
    return v ? { name, value: v.value } : undefined;
  },
  set(name: string, value: string, opts?: Record<string, unknown>) {
    this.store.set(name, { value, opts });
  },
};

vi.mock("next/headers", () => ({
  cookies: async () => jar,
}));

import { GET as contentGET } from "./content/route";
import { getPrivateQuizBank } from "@/app/lib/academy/server/privateQuizBanks";
import { optionPermutation, serveQuizAttempt } from "@/app/lib/academy/server/quizAttempt";
import { POST as linkPOST } from "./link-code/route";
import { POST as quizScorePOST } from "./quiz-score/route";
import { GET, POST } from "./[...slug]/route";
import { POST as logoutPOST } from "./logout/route";
import { signBridgeRequest } from "@/app/lib/academy/hmacSign";
import { resetRateLimitForTests } from "@/app/lib/academy/server/bridgeProxy";

const SECRET = "r".repeat(32);
const ORIGIN = "https://92-5-230-55.sslip.io";

function clearEnv() {
  delete process.env.SFA_BRIDGE_URL;
  delete process.env.SFA_BRIDGE_SECRET;
  delete process.env.SFA_SITE_ORIGIN;
  delete process.env.SFA_ALLOW_INSECURE_PILOT;
  delete process.env.SFA_ALLOW_CONTENT_BYPASS;
  delete process.env.SFA_CONTENT_BYPASS_STAGE;
  delete process.env.SFA_QUIZ_ITEM_HMAC_KEY;
}

function setEnv(origin = ORIGIN) {
  process.env.SFA_BRIDGE_URL = "http://127.0.0.1:8081";
  process.env.SFA_BRIDGE_SECRET = SECRET;
  process.env.SFA_SITE_ORIGIN = origin;
}

function jsonReq(path: string, body: unknown, origin = ORIGIN) {
  return new Request(`https://92-5-230-55.sslip.io${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "x-forwarded-for": "198.51.100.9",
      "x-sfa-client-ip": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("account API proxy", () => {
  beforeEach(() => {
    clearEnv();
    jar.store.clear();
    resetRateLimitForTests();
    setEnv();
  });
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("signup strips the session token into a host cookie and ignores X-Forwarded-For", async () => {
    const seen: { ip?: string | null; nonce?: string | null; auth?: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        seen.push({
          ip: headers.get("x-sfa-client-ip"),
          nonce: headers.get("x-sfa-nonce"),
          auth: headers.get("authorization"),
        });
        return new Response(
          JSON.stringify({
            sessionToken: "super-secret-token",
            expiresIn: 604800,
            me: { studentId: "S10000", displayName: "Ada", role: "STUDENT" },
          }),
          { status: 201 },
        );
      }),
    );
    const res = await POST(jsonReq("/api/mentor/signup", {
      inviteToken: "invite",
      displayName: "Ada",
      email: "ada@example.com",
      password: "correct-horse",
      acceptDataNotice: true,
    }), { params: Promise.resolve({ slug: ["signup"] }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionToken).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("super-secret-token");
    expect(body.me.studentId).toBe("S10000");
    expect(jar.store.get("__Host-sfa_session")?.value).toBe("super-secret-token");
    expect(jar.store.get("__Host-sfa_session")?.opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
    expect(seen[0]?.ip).toBe("203.0.113.10");
    expect(seen[0]?.auth).toBeNull();
    expect(seen[0]?.nonce?.length ?? 0).toBeGreaterThanOrEqual(16);
  });

  it("uses a fresh nonce when the same login is retried", async () => {
    const nonces: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        nonces.push(new Headers(init?.headers).get("x-sfa-nonce") ?? "");
        return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "LOGIN_FAILED" }), {
          status: 401,
        });
      }),
    );
    const call = () =>
      POST(jsonReq("/api/mentor/login", { email: "a@b.co", password: "wrong-password" }), {
        params: Promise.resolve({ slug: ["login"] }),
      });
    const first = await call();
    const second = await call();
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(nonces[0]).not.toBe(nonces[1]);
    const body = await first.json();
    expect(body.en).toMatch(/incorrect/i);
    expect(jar.store.size).toBe(0);
  });

  it("rejects a mismatched Origin before calling Python", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      jsonReq("/api/mentor/login", { email: "a@b.co", password: "correct-horse" }, "https://evil.example"),
      { params: Promise.resolve({ slug: ["login"] }) },
    );
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses public HTTP login even if an insecure flag is set", async () => {
    setEnv("http://92.5.230.55:3000");
    process.env.SFA_ALLOW_INSECURE_PILOT = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      new Request("http://92.5.230.55:3000/api/mentor/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://92.5.230.55:3000",
        },
        body: JSON.stringify({ email: "a@b.co", password: "correct-horse" }),
      }),
      { params: Promise.resolve({ slug: ["login"] }) },
    );
    expect(res.status).toBe(426);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logout clears the cookie and invalidates the server session", async () => {
    jar.set("__Host-sfa_session", "tok", {});
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await logoutPOST(
      new Request(`${ORIGIN}/api/mentor/logout`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    expect(jar.store.get("__Host-sfa_session")?.value).toBe("");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok");
  });

  it("forwards reset and data notice without a browser bearer", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (String(url).endsWith("/data-notice")) {
        return new Response(JSON.stringify({ version: 1, text: "notice" }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const notice = await GET(new Request(`${ORIGIN}/api/mentor/data-notice`), {
      params: Promise.resolve({ slug: ["data-notice"] }),
    });
    expect(notice.status).toBe(200);
    expect(await notice.json()).toEqual({ version: 1, text: "notice" });
    const reset = await POST(jsonReq("/api/mentor/reset-password", { token: "once", password: "correct-horse" }), {
      params: Promise.resolve({ slug: ["reset-password"] }),
    });
    expect(reset.status).toBe(200);
    const resetInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(new Headers(resetInit?.headers).get("authorization")).toBeNull();
  });

  it("does not serve a future lesson when authorize is denied, even with the old bypass flag", async () => {
    process.env.SFA_ALLOW_CONTENT_BYPASS = "1";
    process.env.SFA_CONTENT_BYPASS_STAGE = "8";
    jar.set("__Host-sfa_session", "student-a", {});
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/api/v1/authorize/5")) {
        return new Response(JSON.stringify({ error: "STAGE_LOCKED", message: "STAGE_LOCKED" }), {
          status: 403,
        });
      }
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await contentGET(
      new Request(`${ORIGIN}/api/mentor/content?missionId=M5`),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.locked).toBe(true);
    expect(body.lessons).toBeUndefined();
    expect(body.quiz).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/9702\.99|2500\.49|correctAnswer/);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/authorize/5");
  });

  it("admin routes require the session cookie and do not accept a caller bearer", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(
      new Request(`${ORIGIN}/api/mentor/admin/students`, {
        headers: { authorization: "Bearer attacker" },
      }),
      { params: Promise.resolve({ slug: ["admin", "students"] }) },
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("legacy import forwards records only and reports that unlocks do not change", async () => {
    jar.set("__Host-sfa_session", "student-a", {});
    let sent = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        sent = String(init?.body ?? "");
        return new Response(
          JSON.stringify({ imported: true, verified: false, unlocksChanged: false }),
          { status: 200 },
        );
      }),
    );
    const res = await POST(
      jsonReq("/api/mentor/legacy-import", {
        records: { quizAttempts: [{ quizId: "M1" }], lessonResponses: [] },
      }),
      { params: Promise.resolve({ slug: ["legacy-import"] }) },
    );
    expect(res.status).toBe(200);
    expect(sent).toContain("quizAttempts");
    expect(sent).not.toContain("unlockedStage");
    expect(await res.json()).toMatchObject({ unlocksChanged: false, verified: false });
  });

  it("signs multipart bytes exactly and does not rebuild the form", async () => {
    jar.set("__Host-sfa_session", "student-a", {});
    const boundary = "----sfaBoundary";
    const raw = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="note.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary}--\r\n`;
    const bytes = new TextEncoder().encode(raw);
    let observed: {
      signature?: string | null;
      type?: string | null;
      length?: string | null;
      stamp?: string | null;
      nonce?: string | null;
      body?: string;
    } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        const stream = init?.body as ReadableStream<Uint8Array>;
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const step = await reader.read();
          if (step.done) break;
          if (step.value) chunks.push(step.value);
        }
        const merged = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        observed = {
          signature: headers.get("x-sfa-signature"),
          type: headers.get("content-type"),
          length: headers.get("content-length"),
          stamp: headers.get("x-sfa-timestamp"),
          nonce: headers.get("x-sfa-nonce"),
          body: new TextDecoder().decode(merged),
        };
        return new Response(
          JSON.stringify({ fileId: "f1", name: "note.txt", size: 5, digest: "ab", mime: "text/plain" }),
          { status: 201 },
        );
      }),
    );
    const res = await POST(
      new Request(`${ORIGIN}/api/mentor/practicals/abc123/files`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "x-sfa-client-ip": "203.0.113.10",
        },
        body: bytes,
        duplex: "half",
      } as RequestInit),
      { params: Promise.resolve({ slug: ["practicals", "abc123", "files"] }) },
    );
    expect(res.status).toBe(201);
    expect(observed.body).toBe(raw);
    expect(observed.type).toContain("multipart/form-data");
    expect(observed.length).toBe(String(bytes.byteLength));
    expect(observed.signature).toBe(
      signBridgeRequest({
        secret: SECRET,
        timestamp: Number(observed.stamp),
        nonce: observed.nonce ?? "",
        method: "POST",
        flaskPath: "/api/v1/practicals/abc123/files",
        bodyBytes: bytes,
      }),
    );
    expect(observed.nonce).not.toBe("");
  });

  it("retired link-code and quiz-score routes stay gone", async () => {
    expect((await linkPOST()).status).toBe(410);
    expect((await quizScorePOST()).status).toBe(410);
  });

  it("serves a shuffled quiz whose hashes are not unsalted answer digests", async () => {
    process.env.SFA_QUIZ_ITEM_HMAC_KEY = "h".repeat(48);
    jar.set("__Host-sfa_session", "student-a", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const target = String(url);
        if (target.includes("/api/v1/authorize/1")) {
          return new Response(JSON.stringify({ allowed: true, stage: 1 }), { status: 200 });
        }
        if (target.includes("/api/v1/entitlements")) {
          return new Response(
            JSON.stringify({ unlockedStage: 1, currentWeek: 1, status: "LESSON_OPEN" }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: "UNEXPECTED" }), { status: 500 });
      }),
    );
    const first = await contentGET(new Request(`${ORIGIN}/api/mentor/content?missionId=M1`));
    const second = await contentGET(new Request(`${ORIGIN}/api/mentor/content?missionId=M1`));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const body = await first.json();
    const again = await second.json();
    const bank = getPrivateQuizBank("M1");
    expect(bank).toBeTruthy();
    const expected = serveQuizAttempt(bank!, process.env.SFA_QUIZ_ITEM_HMAC_KEY, body.shuffleNonce);
    expect(body.quiz).toEqual(expected.quiz);
    expect(body.shuffleNonce).toMatch(/^[0-9a-f]{32}$/);
    expect(again.shuffleNonce).not.toBe(body.shuffleNonce);
    expect(JSON.stringify(body.quiz)).not.toMatch(/"answer"|"rationale"|correctAnswer|QUIZ_ANSWER_KEY/);
    expect(body.quiz.some((item: { kind: string }) => item.kind === "order")).toBe(true);
    expect(body.quiz.some((item: { kind: string }) => item.kind === "mc")).toBe(true);
  });

  it("maps served quiz indexes back to the author key before the bridge sees them", async () => {
    const hmac = "h".repeat(48);
    process.env.SFA_QUIZ_ITEM_HMAC_KEY = hmac;
    jar.set("__Host-sfa_session", "student-a", {});
    const bank = getPrivateQuizBank("M1")!;
    let nonce = "0".repeat(32);
    let served = serveQuizAttempt(bank, hmac, nonce);
    for (let i = 0; i < 30; i++) {
      nonce = i.toString(16).padStart(32, "0");
      served = serveQuizAttempt(bank, hmac, nonce);
      const moved = served.quiz.some((item) => {
        if (item.kind !== "mc" || !item.options) return false;
        const author = bank.find((row) => row.id === item.id)!;
        const correct = JSON.stringify(author.options![author.answer as number]);
        return item.options.findIndex((option) => JSON.stringify(option) === correct) !== 1;
      });
      if (moved) break;
    }
    const items = served.quiz.map((item) => {
      const author = bank.find((row) => row.id === item.id)!;
      let studentAnswer: number | string | number[] | null = null;
      if (item.kind === "mc") {
        const correct = JSON.stringify(author.options![author.answer as number]);
        studentAnswer = item.options!.findIndex((option) => JSON.stringify(option) === correct);
      } else if (item.kind === "order") {
        const perm = optionPermutation(item.id, item.options!.length, hmac, nonce);
        studentAnswer = (author.answer as number[]).map((authorIndex) => perm.indexOf(authorIndex));
      } else {
        studentAnswer = String(author.answer);
      }
      return {
        itemId: item.id,
        itemHash: item.itemHash,
        kind: item.kind,
        studentAnswer,
        touched: true,
        reflection: null,
      };
    });
    let forwarded = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        forwarded = String(init?.body ?? "");
        return new Response(JSON.stringify({ attemptId: "a", assessment: { status: "RECOMPUTED" }, decision: null }), {
          status: 200,
        });
      }),
    );
    const res = await POST(
      jsonReq("/api/mentor/quizzes", {
        attemptId: "11111111-1111-1111-1111-111111111111",
        quizId: "M1",
        buildCommit: "ca0dd51",
        shuffleNonce: nonce,
        items,
      }),
      { params: Promise.resolve({ slug: ["quizzes"] }) },
    );
    expect(res.status).toBe(200);
    const upstream = JSON.parse(forwarded) as {
      shuffleNonce?: string;
      items: { kind: string; itemId: string; studentAnswer: number | number[] | string }[];
    };
    expect(upstream.shuffleNonce).toBeUndefined();
    for (const item of upstream.items) {
      if (item.kind === "mc") expect(item.studentAnswer).toBe(1);
      if (item.kind === "order") expect(item.studentAnswer).toEqual([0, 1, 2, 3]);
    }
    const mc = items.find((item) => item.kind === "mc" && item.studentAnswer !== 1);
    expect(mc).toBeTruthy();
    expect(forwarded).not.toContain(hmac);
  });
});
