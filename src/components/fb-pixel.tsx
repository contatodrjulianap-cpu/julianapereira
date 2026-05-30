"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    fbq?: (
      method: string,
      eventName: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}

const FBC_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 dias
const AID_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

// Reconstroi _fbc a partir de ?fbclid= quando o pixel ainda não escreveu o
// cookie (ex: SPA navigation, ad-blocker parcial). Formato canônico Meta:
// `fb.${subdomainIndex}.${timestamp_ms}.${fbclid}` — subdomainIndex=1 cobre
// domínio raiz com www.
function ensureFbc(): string | undefined {
  const existing = getCookie("_fbc");
  if (existing) return existing;
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid");
  if (!fbclid) return undefined;
  const value = `fb.1.${Date.now()}.${fbclid}`;
  setCookie("_fbc", value, FBC_COOKIE_MAX_AGE);
  return value;
}

// External ID anônimo, estável por navegador (90d). Liga PageViews → Lead →
// AddToCart do mesmo visitante mesmo sem login. Sobe match quality.
function ensureAnonId(): string {
  const existing = getCookie("_sak_aid");
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setCookie("_sak_aid", id, AID_COOKIE_MAX_AGE);
  return id;
}

function genEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PageViewTracker() {
  const pathname = usePathname();
  const lastFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Evita disparo duplo no mesmo path (ex: rerender por mudança de state).
    // Query muda dentro do mesmo path não redispara — comportamento aceitável
    // pra PageView (não inflacionamos contagem em filtros/UI state).
    if (lastFiredRef.current === pathname) return;
    lastFiredRef.current = pathname;

    const eventId = genEventId();
    const fbc = ensureFbc();
    const externalId = ensureAnonId();
    const url = window.location.href;
    const referrer = document.referrer || undefined;

    // Pixel client — mesmo eventID que vai pra CAPI.
    if (typeof window.fbq === "function") {
      window.fbq("track", "PageView", {}, { eventID: eventId });
    }

    // CAPI espelho — fire-and-forget. keepalive permite sobreviver navegação.
    try {
      fetch("/api/track/pageview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          url,
          referrer,
          fbc,
          external_id: externalId,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignora — pixel client já disparou
    }
  }, [pathname]);

  return null;
}

export function FbPixel({ pixelId }: { pixelId: string }) {
  if (!pixelId) return null;
  return (
    <>
      <Script id="fb-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
        `}
      </Script>
      <PageViewTracker />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
