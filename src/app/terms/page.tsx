import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "이용약관 · 인스타 트렌드 분석기",
  description: "인스타 트렌드 분석기 이용약관",
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

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> 홈으로
      </Link>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">이용약관</h1>
      <p className="text-muted-foreground mb-8 text-sm">시행일: {EFFECTIVE}</p>

      <div className="space-y-7">
        <Section title="제1조 (목적)">
          <p>
            본 약관은 {SERVICE}(이하 “서비스”)가 제공하는 인스타그램 트렌드·경쟁
            분석 기능의 이용 조건과 절차, 이용자와 운영자의 권리·의무를 규정함을
            목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (서비스 내용)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>데모(비로그인)</strong>: 미리 정해진 예시 데이터 열람만
              가능합니다.
            </li>
            <li>
              <strong>체험(로그인)</strong>: 운영자 토큰을 통해 외부 계정의
              공개지표를 제한된 횟수 내에서 수집·분석할 수 있습니다.
            </li>
            <li>
              <strong>개인 토큰 연결</strong>: 이용자 본인의 Meta 토큰을 연결하면
              수집 제한이 완화되고 본인 계정의 노출·도달 분석이 가능합니다.
            </li>
          </ul>
        </Section>

        <Section title="제3조 (이용자의 의무)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              이용자는 <strong>본인이 정당한 권한을 가진</strong> Meta 토큰만
              입력해야 하며, 타인의 토큰을 무단 사용해서는 안 됩니다.
            </li>
            <li>
              서비스 이용 시 Meta(인스타그램)의 플랫폼 정책 및 관련 법령을
              준수해야 합니다.
            </li>
            <li>
              수집된 데이터를 불법적이거나 타인의 권리를 침해하는 용도로 사용해서는
              안 됩니다.
            </li>
          </ul>
        </Section>

        <Section title="제4조 (사용량 제한)">
          <p>
            안정적 운영과 비용 관리를 위해 일정 시간당 수집·분석 횟수가 제한될 수
            있습니다. 제한 기준은 서비스 정책에 따라 변경될 수 있습니다.
          </p>
        </Section>

        <Section title="제5조 (면책)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              본 서비스는 베타 단계로, 기능·데이터가 예고 없이 변경되거나 중단될
              수 있습니다.
            </li>
            <li>
              분석 결과는 공개지표 및 AI 추정에 기반한 참고 자료이며, 정확성·완전성을
              보장하지 않습니다. 이를 근거로 한 의사결정의 책임은 이용자에게
              있습니다.
            </li>
            <li>
              Meta·구글 등 외부 플랫폼의 정책 변경으로 일부 기능이 제한될 수
              있으며, 이에 대해 운영자는 책임을 지지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="제6조 (지식재산권)">
          <p>
            서비스의 화면·코드·디자인 등에 대한 권리는 운영자에게 있으며, 이용자가
            등록·수집한 데이터에 대한 권리는 해당 데이터의 정당한 권리자에게
            귀속됩니다.
          </p>
        </Section>

        <Section title="제7조 (약관의 변경)">
          <p>
            운영자는 필요 시 본 약관을 변경할 수 있으며, 변경 시 서비스 내 공지를
            통해 안내합니다. 변경 후 계속 이용하는 경우 변경에 동의한 것으로
            봅니다.
          </p>
        </Section>

        <Section title="제8조 (문의)">
          <p>
            문의:{" "}
            <a href={`mailto:${CONTACT}`} className="text-foreground underline">
              {CONTACT}
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}
