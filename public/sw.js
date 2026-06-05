/* 최소 서비스 워커 — PWA 설치(홈화면 추가) 요건 충족용.
 * Phase 0 단계에서는 적극적 캐싱을 하지 않는다. 데이터(공개지표)는 항상 최신을
 * 받아야 하므로, 정적 셸 캐싱 전략은 추후 도입한다.
 */
const CACHE = "mta-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", () => {
  // 네트워크 우선(파이프라인 단순화). 오프라인 셸은 추후.
});
