import "./globals.css";
import type { ReactNode } from "react";
import { Fredoka, Nunito } from "next/font/google";
import Nav from "./Nav";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body" });

export const metadata = {
  title: "Eventify",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="bg-cream font-body text-ink">
        <Nav />
        {children}
      </body>
    </html>
  );
}
