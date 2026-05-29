// Service Worker — Web Push pro CRM Sakura (Movimento A)
// Handler push: mostra notificação com som/vibração
// Handler notificationclick: foca/abre o CRM na conversa do lead

const CACHE_NAME = "sakura-crm-v1";

self.addEventListener("install", () => {
  // Ativa o novo SW imediatamente (sem esperar tabs antigas fecharem)
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Sakura", body: event.data.text() };
  }

  const {
    title = "Sakura CRM",
    body = "",
    url = "/crm",
    tag = "sakura-alert",
    requireInteraction = true,
    silent = false,
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      requireInteraction,
      silent,
      vibrate: [400, 200, 400, 200, 400],
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/crm";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Se já tem aba do CRM aberta, foca e navega
      for (const client of allClients) {
        if (client.url.includes("/crm") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // navigate pode falhar em alguns browsers — ignora
            }
          }
          return;
        }
      }

      // Senão abre nova janela
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
