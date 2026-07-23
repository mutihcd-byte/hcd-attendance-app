/* =========================================================
   ATTENDANCE KIOSK SERVICE WORKER
   ========================================================= */

/*
  IMPORTANT:
  Change APP_VERSION every time you publish an update.

  Examples:
  2026-07-23-01
  2026-07-23-02
  2026-07-24-01
*/

const APP_VERSION = "2026-07-23-01";

const CACHE_PREFIX = "attendance-kiosk-";
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;

/*
  This automatically points to index.html in the same folder
  as service-worker.js.

  This works properly for GitHub Pages project repositories.
*/
const INDEX_URL = new URL(
  "./index.html",
  self.location.href
).href;


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", event => {
  console.log(
    `[Service Worker] Installing ${APP_VERSION}`
  );

  event.waitUntil(
    (async () => {
      /*
        Download a fresh copy of index.html.

        cache: "no-store" prevents the browser's ordinary
        HTTP cache from returning an old index.html.
      */
      const response = await fetch(INDEX_URL, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `Could not download index.html. Status: ${response.status}`
        );
      }

      const cache = await caches.open(CACHE_NAME);

      /*
        Store the newest index.html for offline fallback.
      */
      await cache.put(
        INDEX_URL,
        response.clone()
      );

      /*
        Activate the new service worker immediately instead
        of leaving it in the waiting state.
      */
      await self.skipWaiting();
    })()
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
    (async () => {
      const cacheNames = await caches.keys();

      /*
        Delete old attendance kiosk caches only.

        This does not delete unrelated caches belonging to
        another project on the same GitHub Pages domain.
      */
      await Promise.all(
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

      /*
        Immediately control all open attendance kiosk pages.
      */
      await self.clients.claim();

      console.log(
        `[Service Worker] ${APP_VERSION} is now active`
      );
    })()
  );
});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", event => {
  const request = event.request;

  /*
    Do not intercept POST requests or other non-GET requests.
    This prevents interference with attendance submissions.
  */
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  /*
    Only cache files from your own GitHub Pages website.

    Google Apps Script requests and other external requests
    will go directly to the internet.
  */
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  /*
    Use network-first behavior.

    This means:
    1. Try downloading the newest file.
    2. Save the newest file in Cache Storage.
    3. Use the cached copy only when the internet is unavailable.
  */
  event.respondWith(
    networkFirst(request)
  );
});


/* =========================================================
   NETWORK-FIRST FUNCTION
   ========================================================= */

async function networkFirst(request) {
  const isPageNavigation =
    request.mode === "navigate";

  try {
    /*
      Bypass the browser's ordinary HTTP cache.
    */
    const networkResponse = await fetch(request, {
      cache: "no-store"
    });

    if (
      !networkResponse ||
      !networkResponse.ok
    ) {
      throw new Error(
        `Network request failed with status ${
          networkResponse?.status || "unknown"
        }`
      );
    }

    const cache = await caches.open(CACHE_NAME);

    /*
      All page-navigation responses are stored using
      index.html as the cache key.
    */
    const cacheKey = isPageNavigation
      ? INDEX_URL
      : request;

    await cache.put(
      cacheKey,
      networkResponse.clone()
    );

    return networkResponse;

  } catch (error) {
    console.warn(
      "[Service Worker] Network unavailable. Checking cache.",
      error
    );

    const cacheKey = isPageNavigation
      ? INDEX_URL
      : request;

    const cachedResponse =
      await caches.match(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    /*
      Display a basic offline page when index.html is not
      available in the cache.
    */
    if (isPageNavigation) {
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
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                text-align: center;
                background: #f4f4f4;
              }

              .offline-message {
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 420px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
              }
            </style>
          </head>

          <body>
            <div class="offline-message">
              <h1>Attendance Kiosk Offline</h1>
              <p>
                Please check your internet connection and reload the page.
              </p>
            </div>
          </body>
        </html>`,
        {
          status: 503,
          headers: {
            "Content-Type": "text/html; charset=UTF-8"
          }
        }
      );
    }

    return Response.error();
  }
}
