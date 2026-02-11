
import React from 'react';
import { PixelButton } from './UIComponents';
import { Play } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-mono">
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
        <div className="relative group cursor-default">
            <div className="absolute -inset-4 bg-[#ff004d] opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500 animate-pulse"></div>
            <h1 className="text-8xl md:text-9xl font-['Rubik_Glitch'] text-white relative z-10 tracking-tighter text-shadow-neon">
                ASTRIT
            </h1>
            <div className="absolute top-0 left-0 w-full h-full animate-glitch opacity-50 pointer-events-none"></div>
        </div>

        {/* Subtitle */}
        <div className="flex flex-col items-center gap-2 text-[#29adff] tracking-[0.5em] text-xs font-bold uppercase">
            <span>The ASCII Research Engine</span>
            <span className="text-[#5f574f]">v3.0.1 // PICO-8 // SYSTEM READY</span>
        </div>

        {/* Start Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center">
            <PixelButton 
                label="INITIALIZE SYSTEM" 
                onClick={onStart} 
                variant="primary" 
                className="text-xl px-8 py-4 border-2 border-white hover:scale-105 active:scale-95 transition-transform"
                icon={<Play className="mr-2" />}
            />
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-[#5f574f] text-[10px] text-center flex flex-col gap-1">
        <p className="tracking-widest font-bold text-[#29adff]">CODED BY NEUE EPISTEME STUDIO © 2025</p>
        <p className="opacity-50">OPTIMIZED FOR CHROME // WEBGPU OPTIONAL</p>
      </div>

      {/* CRT Effects */}
      <div className="absolute inset-0 pointer-events-none scanline opacity-20"></div>
      <div className="absolute inset-0 pointer-events-none crt-flicker opacity-5"></div>
      <div className="absolute inset-0 pointer-events-none vignette"></div>
    </div>
  );
};
