/*
  Service worker for WizzTech push notifications.

  Lives at the root so its scope covers the whole app — a worker served from a
  subdirectory could not control pages above it.

  Deliberately not a caching/offline worker. Everything here is behind a login
  and changes often, so serving stale pages would do more harm than good.
*/

self.addEventListener("install", () => {
  // Take over straight away instead of waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A push with no or unreadable payload still deserves something visible —
    // some platforms drop the notification entirely if we show nothing.
    data = {};
  }

  const title = data.title || "WizzTech";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: data.tag || "wizztech",
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Prefer focusing a tab that's already open over spawning another.
        for (const client of clientList) {
          if (new URL(client.url).origin === target.origin && "focus" in client) {
            client.focus();
            if ("navigate" in client) return client.navigate(target.href);
            return undefined;
          }
        }
        return self.clients.openWindow(target.href);
      })
  );
});
