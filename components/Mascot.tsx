import React, { useState, useEffect, useRef } from 'react';
import { MASCOT_FRAMES } from '../constants';

export const Mascot: React.FC = () => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [state, setState] = useState<'IDLE' | 'HAPPY' | 'SLEEP' | 'SURPRISED' | 'DRAGGING'>('IDLE');
  
  // Position State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  
  // Interaction State
  const [lean, setLean] = useState(0);
  
  const mascotRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastActivity = useRef(Date.now());

  // Frame Animation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (state === 'IDLE' || state === 'SLEEP') {
         setFrameIndex(prev => prev + 1);
      }
      
      // Auto Sleep if idle
      if (!isDragging && state === 'IDLE' && Date.now() - lastActivity.current > 8000) {
          setState('SLEEP');
          setLean(0); // Reset lean when sleeping
      }
    }, 600);
    return () => clearInterval(interval);
  }, [state, isDragging]);

  // Global Mouse Tracking for "Leaning" (Look at mouse)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!mascotRef.current || isDragging || state === 'SLEEP') return;
        
        const rect = mascotRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const deltaX = e.clientX - centerX;
        
        // Calculate lean angle (max 10 degrees)
        // We use a dampening factor so it's not too jittery
        const maxLean = 10;
        const screenWidth = window.innerWidth;
        const angle = Math.max(-maxLean, Math.min(maxLean, (deltaX / (screenWidth / 3)) * maxLean));
        
        setLean(angle);
        
        // Update activity timestamp on movement near mascot
        if (Math.abs(deltaX) < 200) {
            lastActivity.current = Date.now();
        }
    };
    
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isDragging, state]);

  // Drag Interaction Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
            setHasMoved(true);
            lastActivity.current = Date.now();
            setLean(0); // Straighten up when being dragged
        }
    };
    
    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            setState('IDLE');
            lastActivity.current = Date.now();
        }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent canvas interaction
      setIsDragging(true);
      setState('DRAGGING');
      lastActivity.current = Date.now();
      
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      dragOffset.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
      };
      
      if (!hasMoved) {
          setPosition({ x: rect.left, y: rect.top });
          setHasMoved(true);
      }
  };

  const getAscii = () => {
      switch(state) {
          case 'HAPPY': return MASCOT_FRAMES.HAPPY;
          case 'SURPRISED': return MASCOT_FRAMES.SURPRISED;
          case 'DRAGGING': return MASCOT_FRAMES.ANGRY;
          case 'SLEEP': 
             const sleepFrames = Array.isArray(MASCOT_FRAMES.SLEEP) ? MASCOT_FRAMES.SLEEP : [MASCOT_FRAMES.SLEEP];
             return sleepFrames[frameIndex % sleepFrames.length];
          case 'IDLE':
          default:
             const idleFrames = MASCOT_FRAMES.IDLE;
             return idleFrames[frameIndex % idleFrames.length];
      }
  };

  // Border Color based on state
  const getBorderColor = () => {
      if (state === 'DRAGGING') return '#ffec27'; // Yellow
      if (state === 'SLEEP') return '#29adff'; // Blue
      if (state === 'HAPPY') return '#00e436'; // Green
      if (state === 'SURPRISED') return '#ffa300'; // Orange
      return '#ff004d'; // Red (Default)
  };

  return (
    <div 
        ref={mascotRef}
        className="fixed z-50 cursor-move select-none"
        style={{ 
            left: hasMoved ? position.x : undefined, 
            top: hasMoved ? position.y : undefined,
            bottom: hasMoved ? undefined : '2rem',
            right: hasMoved ? undefined : '2rem',
            touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => !isDragging && state !== 'SLEEP' && setState('SURPRISED')}
        onMouseLeave={() => !isDragging && state !== 'SLEEP' && setState('IDLE')}
        onClick={() => {
            if (!isDragging) {
                setState(state === 'SLEEP' ? 'IDLE' : 'HAPPY'); 
                lastActivity.current = Date.now();
                if (state !== 'SLEEP') setTimeout(() => setState('IDLE'), 1500);
            }
        }}
    >
        {/* Bounce Wrapper (Animation) */}
        <div className={state === 'IDLE' || state === 'SLEEP' ? 'animate-bounce-slow' : ''}>
            {/* Lean Wrapper (Transform) */}
            <div 
                className="bg-[#1d2b53] border-2 p-2 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] transition-all duration-200 rounded-sm hover:border-white group"
                style={{ 
                    transform: `rotate(${lean}deg)`,
                    borderColor: getBorderColor()
                }}
            >
                <div className="bg-black p-2 font-mono text-[#ffec27] whitespace-pre text-lg leading-none shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                    {getAscii()}
                </div>
                <div className="text-[8px] text-center text-[#29adff] mt-1 uppercase tracking-widest font-bold group-hover:text-white transition-colors">
                    {state === 'SLEEP' ? 'ZZZ...' : 'ASTRIT'}
                </div>
            </div>
        </div>
    </div>
  );
};