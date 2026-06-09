import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 인스타 트렌드 분석기",
  description: "인스타 트렌드 분석기 개인정보처리방침",
};

const SERVICE = "인스타 트렌드 분석기";
const CONTACT = "marketing0yun@gmail.com";
const EFFECTIVE = "2026년 6월 9일";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> 홈으로
      </Link>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        개인정보처리방침
      </h1>
      <p className="text-muted-foreground mb-8 text-sm">시행일: {EFFECTIVE}</p>

      <div className="space-y-7">
        <Section title="1. 총칙">
          <p>
            {SERVICE}(이하 “서비스”)는 이용자의 개인정보를 중요하게 생각하며,
            「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가
            어떤 정보를 수집·이용·보관하는지 설명합니다.
          </p>
        </Section>

        <Section title="2. 수집하는 개인정보 항목">
          <p>서비스는 다음 정보를 수집합니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>구글 계정 정보</strong>: 로그인 시 구글로부터 이메일 주소,
              이름, 프로필 사진을 제공받습니다.
            </li>
            <li>
              <strong>Meta(인스타그램) API 액세스 토큰</strong>: 이용자가 직접
              입력한 경우에 한해, 암호화하여 저장합니다(평문 저장하지 않음).
            </li>
            <li>
              <strong>분석 대상 계정의 공개 정보</strong>: 이용자가 등록한
              인스타그램 계정·해시태그의 공개지표(팔로워 수, 좋아요·댓글 수,
              캡션, 게시 시각 등). 본인 계정의 경우 노출·도달 등 비공개 인사이트.
            </li>
            <li>
              <strong>서비스 이용 기록</strong>: 사용량(수집·분석 횟수), 접속
              기록 등.
            </li>
          </ul>
        </Section>

        <Section title="3. 개인정보의 수집·이용 목적">
          <ul className="list-disc space-y-1 pl-5">
            <li>이용자 식별 및 로그인, 데이터 격리(본인 데이터만 접근)</li>
            <li>인스타그램 트렌드·경쟁 분석 및 리포트 제공</li>
            <li>서비스 사용량 관리 및 안정적 운영(과도한 사용 방지)</li>
          </ul>
        </Section>

        <Section title="4. 제3자 처리위탁">
          <p>
            서비스 제공을 위해 아래 사업자에 일부 처리를 위탁합니다. 이용자의
            개인정보를 마케팅 목적으로 제3자에게 판매하지 않습니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase</strong>: 데이터베이스·인증·저장(로그인 세션,
              암호화된 토큰, 분석 데이터 보관).
            </li>
            <li>
              <strong>Google Cloud / Vertex AI</strong>: 콘텐츠(캡션·이미지) AI
              분석 처리.
            </li>
            <li>
              <strong>Meta(Instagram Graph API)</strong>: 공개지표·인사이트
              데이터 수집.
            </li>
            <li>
              <strong>Vercel</strong>: 웹 애플리케이션 호스팅.
            </li>
          </ul>
        </Section>

        <Section title="5. Meta(인스타그램) 토큰 처리">
          <p>
            이용자가 입력한 Meta API 토큰은 <strong>AES-256 암호화</strong>되어
            저장되며, 토큰의 복호화 및 사용(데이터 수집 호출)은{" "}
            <strong>서버에서만</strong> 이루어집니다. 토큰은 화면이나 브라우저에
            평문으로 노출되지 않으며, 데이터 수집 외 용도로 사용되지 않습니다.
            이용자는 언제든 토큰을 교체하거나 삭제를 요청할 수 있습니다.
          </p>
        </Section>

        <Section title="6. 보유 및 파기">
          <p>
            개인정보는 서비스 이용 기간 동안 보유하며, 이용자가 계정·데이터 삭제를
            요청하거나 회원 탈퇴 시 지체 없이 파기합니다. 법령에서 별도 보관을
            요구하는 경우 해당 기간 동안 보관합니다.
          </p>
        </Section>

        <Section title="7. 이용자의 권리">
          <p>
            이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요청할 수
            있습니다. 로그아웃으로 세션을 종료할 수 있으며, 데이터 삭제는 아래
            연락처로 요청해 주세요.
          </p>
        </Section>

        <Section title="8. 쿠키 및 세션">
          <p>
            서비스는 로그인 상태 유지를 위해 세션 쿠키를 사용합니다. 브라우저
            설정에서 쿠키를 차단할 수 있으나, 이 경우 로그인 등 일부 기능이
            제한될 수 있습니다.
          </p>
        </Section>

        <Section title="9. 문의처">
          <p>
            개인정보 관련 문의:{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="text-foreground underline"
            >
              {CONTACT}
            </a>
          </p>
        </Section>

        <Section title="10. 고지의 의무">
          <p>
            본 방침은 {EFFECTIVE}부터 적용되며, 내용 변경 시 서비스 내 공지를 통해
            안내합니다.
          </p>
        </Section>
      </div>
    </main>
  );
}
