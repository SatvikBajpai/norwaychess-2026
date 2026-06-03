import type { Metadata } from "next";
import { Archivo, Bodoni_Moda, Spectral } from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-bodoni",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Gambit Forecast — Norway Chess 2026",
  description:
    "A Monte Carlo tournament almanac: live and pre-tournament championship odds for Norway Chess 2026 (Open and Women's), modelling the Armageddon scoring system. Calibrated against 258 real games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${spectral.variable} ${archivo.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
