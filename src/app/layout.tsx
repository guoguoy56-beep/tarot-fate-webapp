import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "命运之牌",
  description: "基于 React 的沉浸式塔罗占卜 WebApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
