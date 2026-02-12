
import React from 'react';
import { LandingAsciiBackground } from './LandingAsciiBackground';

interface LandingPageProps {
  onStart: () => void;
}

const ASCII_WORDMARK = [
  '    _    ____ _____ ____ ___ ____  ',
  '   / \\  / ___|_   _|  _ \\_ _|  _ \\ ',
  '  / _ \\ \\___ \\ | | | |_) | || | | |',
  ' / ___ \\ ___) || | |  _ <| || |_| |',
  '/_/   \\_\\____/ |_| |_| \\_\\___|____/ '
].join('\n');

const ASCII_START_BUTTON = [
  '+--------------------------+',
  '| > INITIALIZE SYSTEM NOW |',
  '+--------------------------+'
].join('\n');

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-mono">
      <LandingAsciiBackground className="absolute inset-0 pointer-events-none opacity-80" />

      {/* Background Grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ 
            backgroundImage: `linear-gradient(#1d2b53 1px, transparent 1px), linear-gradient(90deg, #1d2b53 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
        }}
      ></div>

      {/* Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(29,43,83,0.4)_0%,rgba(0,0,0,1)_100%)] pointer-events-none"></div>

      {/* Content */}
      <div className="z-10 flex flex-col items-center gap-8 animate-fadeIn">
        
        {/* Logo Container */}
        <div className="relative group cursor-default flex flex-col items-center">
            <div className="absolute -inset-4 bg-[#ff004d] opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500 animate-pulse"></div>
            <pre className="text-[8px] sm:text-[10px] md:text-xs leading-[1.05] text-white relative z-10 whitespace-pre text-shadow-neon tracking-tight">
              {ASCII_WORDMARK}
            </pre>
            <div className="absolute top-0 left-0 w-full h-full animate-glitch opacity-50 pointer-events-none"></div>
        </div>

        {/* Subtitle */}
        <div className="flex flex-col items-center gap-2 text-[#29adff] tracking-[0.35em] text-[10px] sm:text-xs font-bold uppercase">
            <span>The ASCII Research Engine</span>
            <span className="text-[#5f574f]">v3.0.1 // PICO-8 // SYSTEM READY</span>
        </div>

        {/* Start Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center">
            <button
              onClick={onStart}
              className="group bg-black/65 border border-[#1d2b53] hover:border-[#29adff] px-4 sm:px-5 py-3 shadow-[0_0_0_1px_rgba(41,173,255,0.18)] hover:shadow-[0_0_16px_rgba(41,173,255,0.35)] transition-all"
              aria-label="Initialize system"
            >
              <pre className="whitespace-pre text-xs sm:text-sm md:text-base leading-[1.05] text-[#29adff] group-hover:text-[#ffec27] transition-colors">
                {ASCII_START_BUTTON}
              </pre>
            </button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-[#5f574f] text-[10px] text-center flex flex-col gap-1">
        <p className="tracking-widest font-bold text-[#29adff]">BUILD BY NEUE EPISTEME © 2026</p>
        <p className="opacity-50">OPTIMIZED FOR CHROME // WEBGPU OPTIONAL</p>
      </div>

      {/* CRT Effects */}
      <div className="absolute inset-0 pointer-events-none scanline opacity-20"></div>
      <div className="absolute inset-0 pointer-events-none crt-flicker opacity-5"></div>
      <div className="absolute inset-0 pointer-events-none vignette"></div>
    </div>
  );
};
