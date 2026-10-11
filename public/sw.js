/* Digitorium Studio service worker. It exists so the Studio can be
   installed as an app. It caches nothing: leads and media must always be
   live, so every request goes straight to the network. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
