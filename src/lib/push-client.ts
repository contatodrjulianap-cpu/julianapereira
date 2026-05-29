// Client-side helpers pra Web Push.
// Use só em client components ("use client").

export type PushState =
  | "unsupported" // browser/device não suporta Web Push
  | "permission-default" // ainda não pediu
  | "permission-granted" // usuário aceitou
  | "permission-denied" // usuário recusou
  | "subscribed" // já tem sub ativa
  | "needs-pwa-ios"; // iOS Safari fora do PWA — não tem como subscribed

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function pushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iOS Safari só suporta Web Push em PWA instalado (Add to Home Screen).
// Detecta via display-mode standalone OU navigator.standalone (legacy iOS).
export function isIosStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (!isIos) return true; // não é iOS, não importa
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return standalone;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!isIosStandalone()) return "needs-pwa-ios";

  if (Notification.permission === "denied") return "permission-denied";

  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return Notification.permission === "granted" ? "permission-granted" : "permission-default";

  const sub = await reg.pushManager.getSubscription();
  if (sub) return "subscribed";
  return Notification.permission === "granted" ? "permission-granted" : "permission-default";
}

async function registerSW(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

function urlB64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Std);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export async function subscribePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC) return { ok: false, reason: "vapid-missing" };
  if (!isIosStandalone()) return { ok: false, reason: "needs-pwa-ios" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "permission-denied" };

  const reg = await registerSW();
  // Garante que SW tá ativo antes de subscribe
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      user_agent: navigator.userAgent,
    }),
  });
  if (!res.ok) return { ok: false, reason: `subscribe-failed-${res.status}` };

  return { ok: true };
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendTestPush(): Promise<{ ok: boolean; detail?: unknown }> {
  const res = await fetch("/api/push/test", { method: "POST" });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, detail: data };
}
