const CACHE_NAME = "hcd-attendance-v6";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

});

self.addEventListener("fetch", event => {

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );

});
