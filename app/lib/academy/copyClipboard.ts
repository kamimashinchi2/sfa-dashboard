/** Fallback when download is blocked or incomplete in a harness. */
export async function copyTextToClipboard(text: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
    if (typeof document === "undefined") {
      return { ok: false, error: "NO_DOM" };
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok ? { ok: true } : { ok: false, error: "EXEC_COMMAND_FAIL" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "CLIPBOARD_FAIL",
    };
  }
}
