/* =========================================================
   HCD ATTENDANCE KIOSK SERVICE WORKER
   ========================================================= */

const APP_VERSION = "2026-07-23-06";

const CACHE_PREFIX = "hcd-attendance-";
const CACHE_NAME =
  `${CACHE_PREFIX}${APP_VERSION}`;


/*
  These are the kiosk application files needed offline.

  IMPORTANT:
  app.js contains:
  - validateTraining()
  - validateEmployee()
  - Apps Script requests
  - training caching
  - employee caching
  - attendance submission
*/
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css?v=2026-07-23-06",
  "./app.js?v=2026-07-23-06",
  "./manifest.json"
];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", event => {
  console.log(
    `[Service Worker] Installing ${APP_VERSION}`
  );

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => {
        console.log(
          "[Service Worker] Caching kiosk application files."
        );

        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        /*
          Activate the new worker without leaving it waiting.
        */
        return self.skipWaiting();
      })
  );
});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener("activate", event => {
  console.log(
    `[Service Worker] Activating ${APP_VERSION}`
  );

  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return (
                cacheName.startsWith(CACHE_PREFIX) &&
                cacheName !== CACHE_NAME
              );
            })
            .map(cacheName => {
              console.log(
                `[Service Worker] Deleting old cache: ${cacheName}`
              );

              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        /*
          Let the new worker control open kiosk pages.
        */
        return self.clients.claim();
      })
  );
});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", event => {
  const request = event.request;

  /*
    Never intercept POST attendance submissions.
  */
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  /*
    Do not intercept Google Apps Script or external requests.

    app.js will contact Apps Script while online and then
    save the training and employee data using its existing
    offline-storage system.
  */
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  /*
    Page navigation uses network-first.

    This prevents an old cached index.html from remaining
    permanently visible after an update.
  */
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirstPage(request)
    );

    return;
  }

  /*
    Local files such as app.js and style.css also use
    network-first, with cache fallback when offline.
  */
  event.respondWith(
    networkFirstFile(request)
  );
});


/* =========================================================
   NETWORK-FIRST PAGE
   ========================================================= */

async function networkFirstPage(request) {
  try {
    const networkResponse = await fetch(
      request,
      {
        cache: "no-store"
      }
    );

    if (!networkResponse.ok) {
      throw new Error(
        `Page request failed: ${networkResponse.status}`
      );
    }

    const cache = await caches.open(CACHE_NAME);

    /*
      Store the newest page using index.html as the
      offline fallback.
    */
    await cache.put(
      "./index.html",
      networkResponse.clone()
    );

    return networkResponse;

  } catch (error) {
    console.warn(
      "[Service Worker] Using cached index.html.",
      error
    );

    const cachedPage =
      await caches.match("./index.html");

    if (cachedPage) {
      return cachedPage;
    }

    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >
          <title>Attendance Kiosk Offline</title>
        </head>

        <body>
          <h1>Attendance Kiosk Offline</h1>

          <p>
            The kiosk files are not available yet.
            Connect to the internet and reload the page once.
          </p>
        </body>
      </html>`,
      {
        status: 503,
        headers: {
          "Content-Type":
            "text/html; charset=UTF-8"
        }
      }
    );
  }
}


/* =========================================================
   NETWORK-FIRST LOCAL FILE
   ========================================================= */

async function networkFirstFile(request) {
  try {
    const networkResponse = await fetch(
      request,
      {
        cache: "no-store"
      }
    );

    if (!networkResponse.ok) {
      throw new Error(
        `File request failed: ${networkResponse.status}`
      );
    }

    const cache = await caches.open(CACHE_NAME);

    await cache.put(
      request,
      networkResponse.clone()
    );

    return networkResponse;

  } catch (error) {
    console.warn(
      `[Service Worker] Using cached file: ${request.url}`
    );

    const cachedResponse =
      await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return Response.error();
  }
}
