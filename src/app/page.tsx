"use client";
import dynamic from "next/dynamic";

export default function Page() {
  const Map = dynamic(() => import("@/components/FloodMap"), { ssr: false });
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
          DryPath — Kerrville, TX
        </h1>
        <p className="text-xs md:text-sm opacity-70">
          NASA Space Apps: Flood Evacuation
        </p>
      </header>
      <Map />
    </main>
  );
}
