import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DryPath — Kerrville, TX",
  description:
    "Prototype evacuation dashboard with SAR-based flood overlays, FEMA hazards, and nearby shelters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
