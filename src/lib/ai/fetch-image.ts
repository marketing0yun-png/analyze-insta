import "server-only";

import type { ImagePart } from "./types";

/**
 * 이미지 URL → 인라인 base64 파트 변환 (D-022) — **서버 전용**.
 * 인스타 CDN media_url/thumbnail_url 의 바이트를 받아 멀티모달 입력으로 만든다.
 * 비전 분석은 비용·페이로드가 크므로 방어적으로 제한한다:
 *  - 이미지가 아니거나(content-type) 너무 크면(상한 초과) null → 호출부가 그 게시물은 캡션만 분석.
 *  - 타임아웃으로 수집 잡이 멈추지 않게 한다.
 * 실패는 전부 null 로 흡수(분석 자체를 막지 않음).
 */

/** 인라인 이미지 1장 바이트 상한. 초과 시 스킵(페이로드·토큰 비용 보호). */
const MAX_BYTES = 4 * 1024 * 1024;
/** 한 장 다운로드 타임아웃. */
const FETCH_TIMEOUT_MS = 8000;
/** Vertex Gemini 가 받는 이미지 MIME. 그 외 image/* 는 jpeg 로 간주. */
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function fetchImagePart(url: string): Promise<ImagePart | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const ct = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    // 이미지가 아니면 스킵(예: 비디오 media_url 은 video/mp4 → 인라인 비전 불가).
    if (ct && !ct.startsWith("image/")) return null;
    const mimeType = ALLOWED.has(ct) ? ct : "image/jpeg";

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;

    return { mimeType, data: buf.toString("base64") };
  } catch {
    // 네트워크 오류·타임아웃·중단 등은 분석을 막지 않도록 흡수.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
