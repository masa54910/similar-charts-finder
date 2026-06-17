import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Similar Charts Finder",
  description: "USD/JPY EMA similarity search mock app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
