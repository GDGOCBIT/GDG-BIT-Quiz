import React from "react";
import { cn } from "@/lib/utils";

export function GdgLogoBrackets({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1 select-none", className)}>
      {/* Left bracket < Red */}
      <span className="font-mono text-2xl font-black text-[#EA4335] leading-none">&lt;</span>
      {/* Middle slash / Yellow */}
      <span className="font-mono text-2xl font-black text-[#F9AB00] leading-none">/</span>
      {/* Right bracket > Blue */}
      <span className="font-mono text-2xl font-black text-[#4285F4] leading-none">&gt;</span>
    </div>
  );
}

export function BauhausGeometricCluster({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-48 h-48 select-none pointer-events-none", className)}>
      {/* Blue Circle */}
      <div className="absolute top-0 left-4 w-28 h-28 rounded-full bg-[#4285F4] border-4 border-black shadow-[6px_6px_0px_0px_black]" />
      {/* Yellow Rotated Square */}
      <div className="absolute top-8 right-2 w-24 h-24 bg-[#F9AB00] border-4 border-black shadow-[6px_6px_0px_0px_black] rotate-12" />
      {/* Red Triangle */}
      <div
        className="absolute bottom-2 left-10 w-28 h-28 bg-[#EA4335] border-4 border-black shadow-[6px_6px_0px_0px_black] triangle-up"
        style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
      />
      {/* Green Square */}
      <div className="absolute bottom-6 right-8 w-16 h-16 bg-[#34A853] border-4 border-black shadow-[4px_4px_0px_0px_black]" />
    </div>
  );
}

export function GdgHeaderLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <GdgLogoBrackets />
      <div className="flex flex-col">
        <span className="font-heading text-sm font-black uppercase tracking-tight text-black leading-none">
          GDG ON CAMPUS
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 leading-tight">
          BIT CHAPTER
        </span>
      </div>
    </div>
  );
}
