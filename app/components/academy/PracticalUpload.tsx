"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_FILES = 12;
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg";

type RemoteFile = {
  fileId: string;
  name: string;
  size: number;
  digest: string;
  mime?: string;
};

type Submission = {
  id: string;
  state: string;
  files: RemoteFile[];
  week?: number;
  stage?: number;
};

type LocalFile = {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  file?: File;
};

function bilingualError(body: { fa?: string; en?: string; error?: string }, locale: "fa" | "en", status: number) {
  if (locale === "fa" && body.fa) return body.fa;
  if (locale !== "fa" && body.en) return body.en;
  return body.error ?? `HTTP_${status}`;
}

function uploadOne(
  submissionId: string,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<{ ok: true; file: RemoteFile } | { ok: false; status: number; message: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/mentor/practicals/${encodeURIComponent(submissionId)}/files`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: { fa?: string; en?: string; error?: string; fileId?: string; name?: string; size?: number; digest?: string; mime?: string } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.fileId && body.name && body.digest) {
        resolve({
          ok: true,
          file: {
            fileId: body.fileId,
            name: body.name,
            size: typeof body.size === "number" ? body.size : file.size,
            digest: body.digest,
            mime: body.mime,
          },
        });
        return;
      }
      resolve({
        ok: false,
        status: xhr.status,
        message: body.error ?? `HTTP_${xhr.status}`,
      });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, message: "NETWORK" });
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

export default function PracticalUpload({ locale }: { locale: "fa" | "en" }) {
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteFile[]>([]);
  const [local, setLocal] = useState<LocalFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileSeq = useRef(0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/mentor/practicals", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { submissions?: Submission[] };
    const rows = body.submissions ?? [];
    const draft = rows.find((row) => row.state === "DRAFT");
    const current = draft ?? rows[0];
    if (!current) {
      setSubmissionId(null);
      setState(null);
      setRemote([]);
      return;
    }
    setSubmissionId(current.id);
    setState(current.state);
    setRemote(current.files ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const ensureDraft = async (): Promise<string | null> => {
    if (submissionId && state === "DRAFT") return submissionId;
    const res = await fetch("/api/mentor/practicals/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
    const body = (await res.json().catch(() => ({}))) as {
      submissionId?: string;
      files?: RemoteFile[];
      fa?: string;
      en?: string;
      error?: string;
    };
    if (!res.ok || !body.submissionId) {
      setMessage(bilingualError(body, locale, res.status));
      return null;
    }
    setSubmissionId(body.submissionId);
    setState("DRAFT");
    setRemote(body.files ?? []);
    return body.submissionId;
  };

  const enqueue = async (files: File[]) => {
    setMessage(null);
    const room = MAX_FILES - remote.length - local.filter((f) => f.status !== "error").length;
    if (room <= 0) {
      setMessage(locale === "fa" ? "حداکثر ۱۲ فایل." : "At most 12 files.");
      return;
    }
    const accepted = files.slice(0, room);
    const next: LocalFile[] = [];
    for (const file of accepted) {
      if (file.size > MAX_BYTES) {
        next.push({
          key: `${file.name}-${file.size}-${fileSeq.current++}`,
          name: file.name,
          size: file.size,
          progress: 0,
          status: "error",
          error: locale === "fa" ? "هر فایل حداکثر ۲۰ مگابایت." : "Each file must be 20 MiB or smaller.",
        });
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${fileSeq.current++}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "queued",
        file,
      });
    }
    setLocal((cur) => [...cur, ...next]);
    const id = await ensureDraft();
    if (!id) return;
    setBusy(true);
    for (const item of next) {
      if (!item.file || item.status === "error") continue;
      setLocal((cur) => cur.map((row) => (row.key === item.key ? { ...row, status: "uploading" } : row)));
      const result = await uploadOne(id, item.file, (ratio) => {
        setLocal((cur) =>
          cur.map((row) => (row.key === item.key ? { ...row, progress: ratio } : row)),
        );
      });
      if (!result.ok) {
        setLocal((cur) =>
          cur.map((row) =>
            row.key === item.key ? { ...row, status: "error", error: result.message, progress: 0 } : row,
          ),
        );
        continue;
      }
      setRemote((cur) => [...cur, result.file]);
      setLocal((cur) => cur.filter((row) => row.key !== item.key));
    }
    setBusy(false);
    await refresh();
  };

  const retry = async (key: string) => {
    const item = local.find((row) => row.key === key);
    if (!item?.file) return;
    setLocal((cur) => cur.filter((row) => row.key !== key));
    await enqueue([item.file]);
  };

  const submit = async () => {
    if (!submissionId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/mentor/practicals/${encodeURIComponent(submissionId)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { fa?: string; en?: string; error?: string; status?: string };
      if (!res.ok) {
        setMessage(bilingualError(body, locale, res.status));
        return;
      }
      setState(body.status ?? "QUEUED");
      setMessage(
        locale === "fa"
          ? "ارسال شد و در صف بررسی است. زمان نمره‌دهی تضمین نشده."
          : "Submitted and queued. Grading time is not guaranteed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const locked = state === "QUEUED" || state === "DELIVERED";

  return (
    <section className="space-y-3 border border-line bg-ink/40 p-4" data-testid="practical-upload" id="upload">
      <h2 className="font-display text-xl text-paper">
        {locale === "fa" ? "تمرین عملی این هفته" : "This week's practical"}
      </h2>
      <p className="text-xs text-fog">
        {locale === "fa"
          ? "تا ۱۲ فایل، هر کدام حداکثر ۲۰ مگابایت: DOCX، PDF، TXT، MD، PNG، JPG. فقط تصویر کافی نیست؛ یک سند لازم است. آپلود و ثبت نهایی جدا هستند."
          : "Up to 12 files, 20 MiB each: DOCX, PDF, TXT, MD, PNG, JPG. Screenshots alone are not enough; include a document. Upload and final submit are separate."}
      </p>
      <div
        className={`border border-dashed px-3 py-6 text-center text-sm ${dragOver ? "border-gold text-gold-soft" : "border-line text-fog"}`}
        data-testid="upload-dropzone"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (locked) return;
          void enqueue([...event.dataTransfer.files]);
        }}
      >
        <label className="inline-flex min-h-11 cursor-pointer items-center px-3">
          {locale === "fa" ? "انتخاب یا رها کردن فایل" : "Choose or drop files"}
          <input
            type="file"
            className="sr-only"
            multiple
            accept={ACCEPT}
            data-testid="upload-file-input"
            disabled={locked || busy}
            onChange={(event) => {
              const list = event.target.files ? [...event.target.files] : [];
              event.target.value = "";
              void enqueue(list);
            }}
          />
        </label>
      </div>
      <ul className="space-y-2 text-xs text-fog" data-testid="uploaded-files">
        {remote.map((file) => (
          <li key={file.fileId} className="border border-line/50 px-2 py-2">
            <bdi dir="ltr">{file.name}</bdi> · {file.size} B
          </li>
        ))}
        {local.map((file) => (
          <li key={file.key} className="border border-line/50 px-2 py-2" data-testid="upload-progress">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <bdi dir="ltr">{file.name}</bdi> · {file.status}
                {file.error ? ` · ${file.error}` : ""}
              </span>
              {file.status === "error" && file.file ? (
                <button type="button" className="min-h-11 border border-line px-3" onClick={() => void retry(file.key)}>
                  {locale === "fa" ? "تلاش دوباره" : "Retry"}
                </button>
              ) : null}
            </div>
            <div className="mt-2 h-2 bg-ink">
              <div className="h-2 bg-teal-bright" style={{ width: `${Math.round(file.progress * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink disabled:opacity-40"
        data-testid="upload-submit"
        disabled={locked || busy || remote.length === 0}
        onClick={() => void submit()}
      >
        {locked
          ? locale === "fa"
            ? `وضعیت: ${state}`
            : `Status: ${state}`
          : locale === "fa"
            ? "ثبت نهایی تمرین"
            : "Submit practical"}
      </button>
      {message ? (
        <p className="text-xs text-gold-soft" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
