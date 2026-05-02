import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rizzbot",
  description: "Swipe into a Botpress-powered flirting practice chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
