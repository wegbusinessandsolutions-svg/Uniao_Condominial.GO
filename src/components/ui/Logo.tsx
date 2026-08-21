import React from "react";
import { Sparkles } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative w-32 h-32 mb-2">
        {/* Background Circle */}
        <div className="absolute inset-0 rounded-full border-[3px] border-[#6E9FD1] opacity-50" />
        
        {/* Sparkles */}
        <Sparkles className="absolute top-2 left-6 text-[#6E9FD1] w-4 h-4 opacity-70" />
        <Sparkles className="absolute top-6 right-8 text-[#6E9FD1] w-3 h-3 opacity-60" />
        <Sparkles className="absolute bottom-12 left-2 text-[#6E9FD1] w-3 h-3 opacity-60" />
        <Sparkles className="absolute top-1/2 right-2 text-[#6E9FD1] w-4 h-4 opacity-70" />

        <svg viewBox="0 0 200 200" className="w-full h-full text-[#1B4B6E] absolute inset-0 z-10" fill="currentColor">
          {/* Main Buildings */}
          <rect x="70" y="60" width="30" height="90" rx="2" fill="#1B4B6E" />
          <path d="M75 70 h20 M75 80 h20 M75 90 h20 M75 100 h20 M75 110 h20 M75 120 h20 M75 130 h20 M75 140 h20" stroke="white" strokeWidth="2" />
          
          <rect x="105" y="80" width="25" height="70" rx="1" fill="#6E9FD1" />
          <path d="M110 90 h15 M110 100 h15 M110 110 h15 M110 120 h15 M110 130 h15 M110 140 h15" stroke="white" strokeWidth="2" />

          {/* Small houses */}
          <path d="M30 150 l15 -15 l15 15 v20 h-30 z" fill="#1B4B6E" />
          <rect x="40" y="155" width="10" height="15" fill="white" />
          
          <path d="M55 140 l15 -15 l15 15 v30 h-30 z" fill="#1B4B6E" />
          <rect x="65" y="150" width="10" height="20" fill="white" />

          {/* Mop & Water swoosh */}
          <path d="M150 50 l-30 60" stroke="#6E9FD1" strokeWidth="4" strokeLinecap="round" />
          <path d="M120 110 Q 140 160 160 140 Q 140 120 120 110" fill="#6E9FD1" />

          {/* Water Swoosh Bottom */}
          <path d="M 20 170 Q 100 190 180 160 Q 100 200 20 170" fill="#1B4B6E" />
          <path d="M 30 180 Q 90 195 160 170" stroke="#6E9FD1" strokeWidth="3" fill="none" />
        </svg>
      </div>

      <h1 className="text-2xl sm:text-[28px] font-bold text-[#1B4B6E] tracking-wider mt-4 leading-none text-center">
        UNIÃO CONDOMINIAL
      </h1>
      <h2 className="text-[12px] font-semibold text-[#6E9FD1] tracking-[0.15em] mt-2 text-center uppercase leading-tight">
        Gestão Condominial
      </h2>
    </div>
  );
}
