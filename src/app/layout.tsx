import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/components/auth/auth-provider";
import { CredentialsProvider } from "@/components/credentials/credentials-provider";
import { AppHeader } from "@/components/layout/app-header";
import { Background } from "@/components/layout/background";
import { PWARegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meta SNS 트렌드 분석기",
  description:
    "인스타그램 중심 SNS 트렌드·경쟁 분석기. 공개지표 수집·분석·리포트.",
  applicationName: "트렌드분석기",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "트렌드분석기",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1426" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

/**
 * 테마 깜빡임(FOUC) 방지 — React 하이드레이션 전에 .dark 를 미리 적용한다.
 * 저장값이 없으면 OS 설정(prefers-color-scheme)을 따른다.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;if(d){e.classList.add('dark');e.style.colorScheme='dark';}else{e.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          <AuthProvider>
            <CredentialsProvider>
              <Background />
              <AppHeader />
              {children}
              <PWARegister />
            </CredentialsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
