"use client";

import { useEffect, useRef } from "react";

const TAWK_SRC = "https://embed.tawk.to/6af0cd0c45a9073c4053cbcc/1k6ua1u2r";

/**
 * Lazy tawk.to loader — after first user interaction or idle callback.
 * Avoids "unload is not allowed" console violations from eager afterInteractive injection.
 */
export default function TawkLoader() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;

    const inject = () => {
      if (loaded.current) return;
      loaded.current = true;
      const w = window as Window & {
        Tawk_API?: Record<string, unknown>;
        Tawk_LoadStart?: Date;
      };
      w.Tawk_API = w.Tawk_API || {};
      w.Tawk_LoadStart = new Date();
      const s1 = document.createElement("script");
      const s0 = document.getElementsByTagName("script")[0];
      s1.async = true;
      s1.src = TAWK_SRC;
      s1.charset = "UTF-8";
      s1.setAttribute("crossorigin", "*");
      s0?.parentNode?.insertBefore(s1, s0);
    };

    const onInteract = () => {
      inject();
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("scroll", onInteract);
    };

    window.addEventListener("pointerdown", onInteract, { once: true, passive: true });
    window.addEventListener("keydown", onInteract, { once: true });
    window.addEventListener("scroll", onInteract, { once: true, passive: true });

    let idleId: number | undefined;
    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof ric === "function") {
      idleId = ric(() => inject(), { timeout: 8_000 });
    } else {
      idleId = window.setTimeout(inject, 6_000) as unknown as number;
    }

    return () => {
      cleanup();
      const cic = (
        window as Window & { cancelIdleCallback?: (id: number) => void }
      ).cancelIdleCallback;
      if (typeof cic === "function" && idleId !== undefined) cic(idleId);
      else if (idleId !== undefined) window.clearTimeout(idleId);
    };
  }, []);

  return null;
}
