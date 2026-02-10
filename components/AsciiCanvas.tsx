
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AsciiEngine } from '../services/asciiEngine';
import { EngineConfig, BrushType } from '../engineTypes';
import { ZoomIn, ZoomOut, Move, Monitor, Image as ImageIcon, Expand } from 'lucide-react';

const hash4 = (x: number, y: number, z: number, w: number): number => {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (w * 2654435761);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

interface AsciiCanvasProps {
  config: EngineConfig;
  imageSource: HTMLImageElement | HTMLVideoElement | null;
  brushType: BrushType;
  onStatsUpdate: (stats: any) => void;
  shockTrigger: number;
  clearBrushTrigger: number;
}

export const AsciiCanvas = React.forwardRef<any, AsciiCanvasProps>(({ 
  config, imageSource, brushType, onStatsUpdate, shockTrigger, clearBrushTrigger 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushLayerRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsciiEngine | null>(null);
  const requestRef = useRef<number>(0);
  const brushResizeScratchRef = useRef<HTMLCanvasElement | null>(null);
  const brushStepRef = useRef<number>(0);
  const lastStatsFrameRef = useRef<number>(-1);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  
  const [viewMode, setViewMode] = useState<'FIT' | 'ORIGINAL'>('FIT');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const lastPos = useRef<{x: number, y: number} | null>(null);
  const dragStart = useRef<{x: number, y: number} | null>(null);
  
  const shockStartFrame = useRef<number>(-1);
  const lastShockTriggerRef = useRef<number>(0);

  React.useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    triggerStaticRender: async (width: number, height: number, customConfig?: EngineConfig) => {
       if (engineRef.current) {
           return engineRef.current.triggerStaticRender(
               imageSource, 
               customConfig || config, 
               width, 
               height,
               brushLayerRef.current || undefined
           );
       }
       return null;
    },
    generateSVG: async (width: number, height: number) => {
        if (engineRef.current) {
            return engineRef.current.generateSVG(imageSource, config, width, height);
        }
        return null;
    }
  }));

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new AsciiEngine(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    if (shockTrigger > 0 && shockTrigger > lastShockTriggerRef.current) {
        lastShockTriggerRef.current = shockTrigger;
        shockStartFrame.current = -1; // Reset to sync with next deterministic simulation frame
    }
  }, [shockTrigger]);

  useEffect(() => {
     if (brushLayerRef.current) {
         const ctx = brushLayerRef.current.getContext('2d');
         ctx?.clearRect(0, 0, brushLayerRef.current.width, brushLayerRef.current.height);
     }
  }, [clearBrushTrigger]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
      };
      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              setIsSpacePressed(false);
              setIsPanning(false);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const direction = e.deltaY > 0 ? -1 : 1;
    const step = 0.1;
    setTransform(prev => {
        const newScale = Math.max(0.1, Math.min(8, prev.scale + (direction * step)));
        return { ...prev, scale: newScale };
    });
  }, []);

  const handleDraw = useCallback((clientX: number, clientY: number) => {
    if (!brushLayerRef.current || !canvasRef.current) return;
    const ctx = brushLayerRef.current.getContext('2d');
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const drawStep = brushStepRef.current++;

    if (brushType === BrushType.NONE) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (brushType === BrushType.FLOWFIELD) {
      ctx.strokeStyle = `rgba(255, 0, 77, 0.5)`;
      ctx.lineWidth = 20;
    } else if (brushType === BrushType.NOISE) {
      ctx.fillStyle = `rgba(255, 255, 255, 0.5)`;
      for(let i=0; i<5; i++) {
        const ox = (hash4(Math.floor(x), Math.floor(y), drawStep, i + config.seed) - 0.5) * 50;
        const oy = (hash4(Math.floor(y), Math.floor(x), drawStep, i + config.seed + 17) - 0.5) * 50;
        ctx.fillRect(x + ox, y + oy, 4, 4);
      }
      return;
    } else if (brushType === BrushType.GLITCH) {
        const rw = hash4(Math.floor(x), drawStep, config.seed, 1);
        const rh = hash4(Math.floor(y), drawStep, config.seed, 2);
        const rox = hash4(Math.floor(x), Math.floor(y), drawStep, 3);
        const roy = hash4(Math.floor(y), Math.floor(x), drawStep, 4);
        const rc = hash4(Math.floor(x + y), drawStep, config.seed, 5);
        const w = (rw * 50) + 10;
        const h = (rh * 50) + 10;
        const ox = (rox - 0.5) * 100;
        const oy = (roy - 0.5) * 100;
        ctx.fillStyle = rc > 0.5 ? '#fff' : '#000';
        ctx.fillRect(x + ox, y + oy, w, h);
        return;
    } else if (brushType === BrushType.PULSE) {
       ctx.strokeStyle = `rgba(41, 173, 255, 0.2)`;
       ctx.lineWidth = 50 + Math.sin((drawStep + config.seed) * 0.25) * 20;
    } else if (brushType === BrushType.ERASER) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 40;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (brushType === BrushType.TEXT) {
        ctx.font = 'bold 40px monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(config.semanticWord || "ASCII", x, y);
        return; 
    } else if (brushType === BrushType.PIXELATE) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        const size = 20;
        const snapX = Math.floor(x / size) * size;
        const snapY = Math.floor(y / size) * size;
        ctx.fillRect(snapX, snapY, size, size);
        return;
    }

    if (lastPos.current) {
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; 
    lastPos.current = { x, y };
  }, [brushType, config.semanticWord, config.seed]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSpacePressed) {
        setIsPanning(true);
        dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    } else {
        setIsDrawing(true);
        if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = canvasRef.current.width / rect.width;
            const scaleY = canvasRef.current.height / rect.height;
            lastPos.current = { 
                x: (e.clientX - rect.left) * scaleX, 
                y: (e.clientY - rect.top) * scaleY 
            };
            handleDraw(e.clientX, e.clientY);
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && dragStart.current) {
        setTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.current!.x,
            y: e.clientY - dragStart.current!.y
        }));
    } else if (isDrawing) {
        handleDraw(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsPanning(false);
    lastPos.current = null;
    dragStart.current = null;
  };

  const handleZoom = (delta: number) => {
      setTransform(prev => {
          const newScale = Math.max(0.1, Math.min(5, prev.scale + delta));
          return { ...prev, scale: newScale };
      });
  };

  const handleFit = () => {
      setTransform({ x: 0, y: 0, scale: 1 });
      setViewMode('FIT');
  };

  const handleOriginalSize = () => {
      setTransform({ x: 0, y: 0, scale: 1 });
      setViewMode('ORIGINAL');
  };
  
  const handleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen();
      } else {
          if (document.exitFullscreen) document.exitFullscreen();
      }
  };

  const animate = useCallback((rafTime: number) => {
    const targetFrameRate = Math.max(1, Math.round(config.frameRate || 30));
    const simulationFrame = Math.floor(rafTime / (1000 / targetFrameRate));
    const shockDurationFrames = Math.max(1, Math.round(targetFrameRate * 1.2));
    let shockProgress = -1;

    if (shockStartFrame.current === -1 && lastShockTriggerRef.current > 0) {
        shockStartFrame.current = simulationFrame;
    }
    if (shockStartFrame.current !== -1) {
        const elapsedFrames = simulationFrame - shockStartFrame.current;
        if (elapsedFrames > shockDurationFrames) {
            shockStartFrame.current = -1;
            lastShockTriggerRef.current = 0;
            shockProgress = -1;
        } else {
            shockProgress = elapsedFrames / shockDurationFrames;
        }
    }

    if (engineRef.current && canvasRef.current && brushLayerRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      let targetWidth = containerRect.width;
      let targetHeight = containerRect.height;

      if (viewMode === 'ORIGINAL' && imageSource) {
          if (imageSource instanceof HTMLImageElement) {
              targetWidth = imageSource.naturalWidth || 800;
              targetHeight = imageSource.naturalHeight || 600;
          } else if (imageSource instanceof HTMLVideoElement) {
              targetWidth = imageSource.videoWidth || 800;
              targetHeight = imageSource.videoHeight || 600;
          }
      }
      targetWidth = Math.max(1, Math.floor(targetWidth));
      targetHeight = Math.max(1, Math.floor(targetHeight));

      if (Math.abs(brushLayerRef.current.width - targetWidth) > 1 || Math.abs(brushLayerRef.current.height - targetHeight) > 1) {
         if (!brushResizeScratchRef.current) {
             brushResizeScratchRef.current = document.createElement('canvas');
         }
         const tempCanvas = brushResizeScratchRef.current;
         tempCanvas.width = brushLayerRef.current.width;
         tempCanvas.height = brushLayerRef.current.height;
         const tempCtx = tempCanvas.getContext('2d');
         tempCtx?.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
         tempCtx?.drawImage(brushLayerRef.current, 0, 0);
         brushLayerRef.current.width = targetWidth;
         brushLayerRef.current.height = targetHeight;
         brushLayerRef.current.getContext('2d')?.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
      }

      const stats = engineRef.current.render(
          imageSource, 
          config, 
          targetWidth, 
          targetHeight, 
          simulationFrame, 
          brushLayerRef.current,
          shockProgress
      );
      if (lastStatsFrameRef.current !== simulationFrame && simulationFrame % 4 === 0) {
        lastStatsFrameRef.current = simulationFrame;
        onStatsUpdate(stats);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [config, imageSource, onStatsUpdate, viewMode]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const checkerboardStyle = config.transparentBackground ? {
      backgroundImage: `linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)`,
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      backgroundColor: '#111'
  } : { backgroundColor: '#111' };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden group"
      onWheel={handleWheel}
      id="ascii-canvas-render"
      style={checkerboardStyle}
    >
      <div 
        className="w-full h-full flex items-center justify-center origin-center will-change-transform"
        style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : (brushType === BrushType.NONE ? 'default' : 'crosshair')
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas 
            ref={canvasRef} 
            className="block shadow-2xl"
        />
      </div>

      <canvas ref={brushLayerRef} className="hidden" />
      
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-[#000]/80 border border-[#5f574f] rounded-lg backdrop-blur-sm shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50">
          <button 
            onClick={handleFit} 
            className={`p-2 hover:bg-[#1d2b53] rounded ${viewMode === 'FIT' ? 'text-[#ffec27]' : 'text-white'}`}
            title="Fit to Screen"
          >
              <Monitor size={16} />
          </button>
          <div className="w-[1px] bg-[#5f574f] mx-1"></div>
          <button 
            onClick={handleOriginalSize} 
            className={`p-2 hover:bg-[#1d2b53] rounded ${viewMode === 'ORIGINAL' ? 'text-[#00e436]' : 'text-white'}`}
            title="Original Size (1:1)"
          >
              <ImageIcon size={16} />
          </button>
          <div className="w-[1px] bg-[#5f574f] mx-1"></div>
          <button onClick={() => handleZoom(-0.25)} className="p-2 hover:bg-[#1d2b53] text-white rounded"><ZoomOut size={16}/></button>
          <span className="font-mono text-xs flex items-center text-[#c2c3c7] min-w-[3ch]">{Math.round(transform.scale * 100)}%</span>
          <button onClick={() => handleZoom(0.25)} className="p-2 hover:bg-[#1d2b53] text-white rounded"><ZoomIn size={16}/></button>
          <div className="w-[1px] bg-[#5f574f] mx-1"></div>
           <button onClick={handleFullscreen} className="p-2 hover:bg-[#1d2b53] text-white rounded" title="Fullscreen"><Expand size={16}/></button>
      </div>

      {isSpacePressed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#ff004d] text-white text-[10px] px-2 py-1 font-bold tracking-widest uppercase border border-white animate-pulse pointer-events-none z-50">
              <Move size={12} className="inline mr-1"/>
              DRAG TO PAN
          </div>
      )}
    </div>
  );
});

