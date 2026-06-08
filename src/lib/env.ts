/**
 * 환경변수 접근 헬퍼.
 * - `NEXT_PUBLIC_*` 만 클라이언트 번들에 포함된다.
 * - service-role / Meta 시크릿은 절대 여기(클라이언트 경로)에서 읽지 않는다.
 *   서버 전용 값은 `serverEnv()`로만 접근하고, 서버 모듈에서만 호출한다.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[env] 필수 환경변수 누락: ${name}. .env.local 을 확인하세요 (docs/08_SETUP.md §5).`
    );
  }
  return value;
}

/** 클라이언트/서버 공용 (공개 가능, RLS 전제) */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export function getPublicEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl),
    supabaseAnonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      publicEnv.supabaseAnonKey
    ),
  };
}

/**
 * 서버 전용 시크릿 getter. **서버 컴포넌트/route/Edge 에서만** 호출할 것.
 * 기능별로 분리해 일부 시크릿이 비어 있어도 나머지 경로는 동작하게 한다
 * (예: Meta 앱 미생성 단계에서도 토큰 입력·암호화·저장 흐름은 검증 가능).
 */

/** service-role 키 — RLS 우회 서버 클라이언트 전용. */
export function getServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** 토큰 암호화 키 (Vault 미사용 시). 32바이트 base64. */
export function getTokenEncryptionKey(): string {
  return required("TOKEN_ENCRYPTION_KEY", process.env.TOKEN_ENCRYPTION_KEY);
}

/**
 * Meta 앱 자격증명. **선택적** — 미설정이면 null.
 * 있으면 appsecret_proof 서명 + 장기 토큰 교환에 사용한다.
 */
export function getMetaAppCreds(): { appId: string; appSecret: string } | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/** Graph API 버전. 미설정 시 기본값. */
export function getMetaGraphVersion(): string {
  return process.env.META_GRAPH_VERSION || "v21.0";
}

// =====================================================================
// AI 분석 (Phase 2) — 프로바이더 추상화. 1차 구현체: Gemini(Vertex AI).
// 모델 교체/사용자 선택을 위해 env 로 프로바이더·모델을 결정한다(D-016).
// =====================================================================

/**
 * 이미지 비전 분석 사용 여부(D-022). 기본 ON.
 * 비용(이미지 토큰)·페이로드를 줄이려면 AI_VISION=off|false|0 으로 끈다.
 * (프로바이더가 비전 미지원이면 이 값과 무관하게 캡션만 분석됨)
 */
export function getVisionEnabled(): boolean {
  const v = (process.env.AI_VISION ?? "").toLowerCase();
  return !(v === "off" || v === "false" || v === "0");
}

/** 활성 AI 프로바이더. 미설정 시 gemini. (향후 'claude' 추가) */
export function getAIProviderName(): "gemini" {
  const p = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (p !== "gemini") {
    throw new Error(
      `[env] 지원하지 않는 AI_PROVIDER='${p}'. 현재 'gemini'만 구현됨 (D-016).`
    );
  }
  return p;
}

export type VertexConfig = {
  project: string;
  location: string;
  model: string;
  /** 호출별 maxOutputTokens 미지정 시 적용할 기본 상한. (gemini-2.5-flash 최대 65536) */
  maxOutputTokens: number;
  /** 인라인 서비스계정(JSON). 없으면 ADC(GOOGLE_APPLICATION_CREDENTIALS 파일)로 인증. */
  credentials: Record<string, unknown> | null;
};

/**
 * Vertex AI(Gemini) 설정. **서버 전용.**
 * 인증 우선순위:
 *  1) GOOGLE_VERTEX_CREDENTIALS_JSON (인라인 JSON 문자열) — Vercel 등 파일 없는 환경용.
 *  2) GOOGLE_APPLICATION_CREDENTIALS (키 파일 경로) — 로컬 개발용(ADC).
 * project 는 명시값(GOOGLE_VERTEX_PROJECT) > 인라인 자격증명의 project_id 순.
 */
export function getVertexConfig(): VertexConfig {
  const location = process.env.GOOGLE_VERTEX_LOCATION || "global";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // gemini-2.5-flash 출력 토큰 최대 = 65536. 미설정/비정상값이면 최대치로.
  const parsedMax = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS);
  const maxOutputTokens =
    Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 65536;

  let credentials: Record<string, unknown> | null = null;
  const inline = process.env.GOOGLE_VERTEX_CREDENTIALS_JSON;
  if (inline) {
    try {
      credentials = JSON.parse(inline) as Record<string, unknown>;
    } catch {
      throw new Error(
        "[env] GOOGLE_VERTEX_CREDENTIALS_JSON 파싱 실패 — 유효한 JSON 인지 확인하세요."
      );
    }
  }

  const project =
    process.env.GOOGLE_VERTEX_PROJECT ||
    (credentials?.project_id as string | undefined);

  if (!project) {
    throw new Error(
      "[env] Vertex project 미설정 — GOOGLE_VERTEX_PROJECT 또는 인라인 자격증명의 project_id 가 필요합니다."
    );
  }
  if (!credentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "[env] Vertex 자격증명 미설정 — GOOGLE_APPLICATION_CREDENTIALS(키 파일 경로) 또는 " +
        "GOOGLE_VERTEX_CREDENTIALS_JSON(인라인) 중 하나가 필요합니다 (docs/08_SETUP.md §5)."
    );
  }

  return { project, location, model, maxOutputTokens, credentials };
}
