import "./globals.css";
import type { ReactNode } from "react";
import { Fraunces, Public_Sans } from "next/font/google";
import Nav from "./Nav";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });

export const metadata = {
  title: "Eventify",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body className="bg-background font-body text-on-background">
        <Nav />
        {children}
      </body>
    </html>
  );
}
