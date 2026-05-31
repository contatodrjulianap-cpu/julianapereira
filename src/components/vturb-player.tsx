"use client";

import { useEffect, useRef } from "react";
import type { VturbVideo } from "@/lib/video-config";

/**
 * Player VTurb (ConverteAI v4). Injeta o custom element <vturb-smartplayer>
 * + o script do player via DOM no client — funciona em qualquer versão do Next
 * por não depender de SSR. Idempotente: não duplica element nem script.
 *
 * Se `video` for null (embed ainda não plugado em video-config.ts), mostra um
 * placeholder visível pra não quebrar o fluxo em produção.
 */
export function VturbPlayer({
  video,
  className,
}: {
  video: VturbVideo | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!video) return;
    const container = containerRef.current;
    if (!container) return;

    const elId = `vid-${video.videoId}`;
    if (container.querySelector(`#${CSS.escape(elId)}`)) return;

    const el = document.createElement("vturb-smartplayer");
    el.id = elId;
    el.style.display = "block";
    el.style.margin = "0 auto";
    el.style.width = "100%";
    container.appendChild(el);

    const scriptId = `vturb-scr-${video.videoId}`;
    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = `https://scripts.converteai.net/${video.accountId}/players/${video.videoId}/v4/player.js`;
      s.async = true;
      document.head.appendChild(s);
    }

    return () => {
      el.remove();
    };
  }, [video]);

  if (!video) {
    return (
      <div
        className={className}
        style={{
          aspectRatio: "9 / 16",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          border: "1px dashed var(--sakura-hairline, #ccc)",
          color: "var(--sakura-cocoa-3, #888)",
          fontSize: "13px",
          lineHeight: 1.5,
        }}
      >
        🎥 Vídeo antes/depois entra aqui
        <br />
        (plugar embed VTurb em <code>video-config.ts</code>)
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
