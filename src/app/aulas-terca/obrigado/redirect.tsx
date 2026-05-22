"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (
      command: "track" | "trackCustom",
      event: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

export function ObrigadoRedirect({
  url,
  delayMs,
}: {
  url: string;
  delayMs: number;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "Lead", { content_name: "aula-terca" });
    }
    const t = setTimeout(() => {
      window.location.href = url;
    }, delayMs);
    return () => clearTimeout(t);
  }, [url, delayMs]);

  return null;
}
