// 아주 단순한 오프라인 캐싱: 앱 화면(HTML/CSS/JS)만 캐시하고,
// 환율 API 같은 외부 요청은 항상 네트워크로 보냅니다.
const CACHE_NAME = "vnd-money-diary-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/lib/categories.js",
  "./js/lib/currencies.js",
  "./js/lib/csvExport.js",
  "./js/lib/format.js",
  "./js/lib/storage.js",
  "./js/lib/exchangeRate.js",
  "./js/lib/numberInput.js",
  "./js/screens/inputScreen.js",
  "./js/screens/listScreen.js",
  "./js/screens/summaryScreen.js",
  "./js/components/bottomNav.js",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 다른 도메인(환율 API 등)은 캐시하지 않고 그대로 네트워크로 보냄
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
