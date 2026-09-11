import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReiCard — Seu mundo de cartas em um só lugar",
  description: "Organize seus álbuns, acompanhe suas coleções e descubra as cartas que faltam.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/reicard-icon.png",
    shortcut: "/reicard-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
