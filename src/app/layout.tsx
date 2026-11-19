import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "命运回廊 · 循星而来，向心而行",
  description: "在星空中探索塔罗，让心中的问题找到回响。",
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
