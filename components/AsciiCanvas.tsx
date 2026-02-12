
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AsciiEngine } from '../services/asciiEngine';
import { EngineConfig, BrushType, RenderEngine, ColorMode } from '../engineTypes';
import { ASCII_RAMPS } from '../constants';
import { textmode as textmodeFactory } from 'textmode.js';
import { ZoomIn, ZoomOut, Move, Monitor, Image as ImageIcon, Expand, Play, Pause, RotateCcw, Rewind, Eye, EyeOff } from 'lucide-react';

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
  onRendererUnavailable?: (engine: RenderEngine, reason: string) => void;
}

const getSourceDimensions = (source: HTMLImageElement | HTMLVideoElement | null): { w: number; h: number } | null => {
  if (!source) return null;
  if (source instanceof HTMLImageElement) {
    const w = source.naturalWidth || source.width;
    const h = source.naturalHeight || source.height;
    if (w > 0 && h > 0) return { w, h };
    return null;
  }
  const w = source.videoWidth || source.clientWidth;
  const h = source.videoHeight || source.clientHeight;
  if (w > 0 && h > 0) return { w, h };
  return null;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.trim();
  const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!match) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  };
};

const getRampForMode = (mode: string): string => {
  const key = mode.toLowerCase() as keyof typeof ASCII_RAMPS;
  return ASCII_RAMPS[key] || ASCII_RAMPS.standard;
};

const getTextmodeSourceInput = (source: HTMLImageElement | HTMLVideoElement): string | null => {
  if (source instanceof HTMLImageElement) {
    const src = source.currentSrc || source.src;
    return src && src.trim().length > 0 ? src : null;
  }
  const src = source.currentSrc || source.src;
  return src && src.trim().length > 0 ? src : null;
};

const isTextmodeVideoSource = (
  value: any
): value is {
  time: (time: number) => any;
  play: () => Promise<void>;
  pause: () => void;
  loop: (enabled?: boolean) => any;
  volume: (value: number) => any;
  currentTime: number;
  isPlaying: boolean;
} =>
  Boolean(
    value &&
      typeof value.time === 'function' &&
      typeof value.play === 'function' &&
      typeof value.pause === 'function'
  );

export const AsciiCanvas = React.forwardRef<any, AsciiCanvasProps>(({ 
  config, imageSource, brushType, onStatsUpdate, shockTrigger, clearBrushTrigger, onRendererUnavailable
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushLayerRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsciiEngine | null>(null);
  const engineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textmodeRef = useRef<any>(null);
  const textmodeSourceRef = useRef<any>(null);
  const textmodeSourceElementRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const textmodeSourceIsVideoRef = useRef(false);
  const imageSourceRef = useRef<HTMLImageElement | HTMLVideoElement | null>(imageSource);
  const textmodeSourceTokenRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const brushResizeScratchRef = useRef<HTMLCanvasElement | null>(null);
  const brushStepRef = useRef<number>(0);
  const lastStatsFrameRef = useRef<number>(-1);
  const frameEpochTimeRef = useRef<number | null>(null);
  const lastSimulationFrameRef = useRef<number>(-1);
  const configRef = useRef(config);
  const textmodeUnavailableRef = useRef(false);
  const textmodeWarnedRef = useRef(false);
  const textmodeVideoSyncWarnedRef = useRef(false);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoSeekable, setIsVideoSeekable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  
  const [viewMode, setViewMode] = useState<'FIT' | 'ORIGINAL'>('FIT');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const lastPos = useRef<{x: number, y: number} | null>(null);
  const dragStart = useRef<{x: number, y: number} | null>(null);
  
  const shockStartFrame = useRef<number>(-1);
  const lastShockTriggerRef = useRef<number>(0);
  const isVideoSource = imageSource instanceof HTMLVideoElement;

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    imageSourceRef.current = imageSource;
  }, [imageSource]);

  useEffect(() => {
    frameEpochTimeRef.current = null;
    lastSimulationFrameRef.current = -1;
    lastStatsFrameRef.current = -1;
  }, [imageSource, config.frameRate, config.renderEngine]);

  const applyTextmodeSourceConfig = useCallback((source: any, cfg: EngineConfig) => {
    if (!source) return;
    try {
      source.characters(getRampForMode(cfg.mode));
      source.invert(Boolean(cfg.inverted));
      source.flipX(false);
      source.flipY(false);

      if (cfg.colorMode === ColorMode.MONO) {
        const fg = hexToRgb(cfg.palette[cfg.palette.length - 1] || '#ffffff');
        const bg = hexToRgb(cfg.palette[0] || '#000000');
        source.charColorMode('fixed').charColor(fg.r, fg.g, fg.b, 255);
        source.cellColorMode('fixed').cellColor(bg.r, bg.g, bg.b, 255);
      } else if (cfg.colorMode === ColorMode.QUANTIZED) {
        const bg = hexToRgb(cfg.palette[0] || '#000000');
        source.charColorMode('sampled');
        source.cellColorMode('fixed').cellColor(bg.r, bg.g, bg.b, 255);
      } else {
        source.charColorMode('sampled');
        source.cellColorMode('sampled');
      }

      const fallbackBg = hexToRgb(cfg.palette[0] || '#000000');
      source.background(fallbackBg.r, fallbackBg.g, fallbackBg.b, cfg.transparentBackground ? 0 : 255);
    } catch (error) {
      console.warn('Failed to apply textmode source config:', error);
    }
  }, []);

  const destroyTextmode = useCallback(() => {
    try {
      if (textmodeSourceRef.current?.$dispose) {
        textmodeSourceRef.current.$dispose();
      }
    } catch {
      // ignore cleanup failures
    }
    textmodeSourceRef.current = null;
    textmodeSourceElementRef.current = null;
    textmodeSourceIsVideoRef.current = false;
    textmodeVideoSyncWarnedRef.current = false;
    textmodeSourceTokenRef.current += 1;

    if (textmodeRef.current) {
      try {
        textmodeRef.current.destroy();
      } catch (error) {
        console.warn('Textmode destroy failed:', error);
      }
      textmodeRef.current = null;
    }
  }, []);

  const ensureTextmode = useCallback(() => {
    if (!canvasRef.current || textmodeRef.current || textmodeUnavailableRef.current) return;
    const probeCanvas = document.createElement('canvas');
    const webgl2 = probeCanvas.getContext('webgl2');
    if (!webgl2) {
      textmodeUnavailableRef.current = true;
      if (!textmodeWarnedRef.current) {
        textmodeWarnedRef.current = true;
        console.warn('Textmode unavailable: WebGL2 is not supported in this environment. Falling back to native renderer.');
      }
      onRendererUnavailable?.(RenderEngine.TEXTMODE, 'WebGL2 is not supported.');
      return;
    }
    try {
      const textmodeInstance = textmodeFactory.create({
        canvas: canvasRef.current,
        overlay: false,
        fontSize: Math.max(6, Math.round(configRef.current.resolution || 12)),
        frameRate: Math.max(1, Math.round(configRef.current.frameRate || 30))
      });

      textmodeInstance.draw(() => {
        const source = textmodeSourceRef.current;
        const cfg = configRef.current;
        if (!source || !textmodeInstance.grid) {
          textmodeInstance.clear();
          return;
        }

        if (textmodeSourceIsVideoRef.current) {
          const liveSource = imageSourceRef.current;
          if (liveSource instanceof HTMLVideoElement && isTextmodeVideoSource(source)) {
            try {
              const desiredTime = Number.isFinite(liveSource.currentTime) ? liveSource.currentTime : 0;
              if (Math.abs((source.currentTime ?? 0) - desiredTime) > 0.08) {
                source.time(desiredTime);
              }

              const shouldPlay = !liveSource.paused && !liveSource.ended;
              if (shouldPlay && !source.isPlaying) {
                void source.play().catch(() => {
                  // no-op
                });
              } else if (!shouldPlay && source.isPlaying) {
                source.pause();
              }
            } catch (error) {
              if (!textmodeVideoSyncWarnedRef.current) {
                textmodeVideoSyncWarnedRef.current = true;
                console.warn('Textmode video sync failed:', error);
              }
            }
          }
        }

        if (cfg.transparentBackground) {
          textmodeInstance.clear();
        } else {
          const bg = hexToRgb(cfg.palette[0] || '#000000');
          textmodeInstance.background(bg.r, bg.g, bg.b, 255);
        }

        applyTextmodeSourceConfig(source, cfg);
        textmodeInstance.image(source, textmodeInstance.grid.cols, textmodeInstance.grid.rows);
      });

      textmodeRef.current = textmodeInstance;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Textmode initialization failed.';
      textmodeUnavailableRef.current = true;
      if (!textmodeWarnedRef.current) {
        textmodeWarnedRef.current = true;
        if (reason.includes('requires WebGL2 support')) {
          console.warn('Textmode unavailable: WebGL2 is not available for this canvas. Falling back to native renderer.');
        } else {
          console.warn('Textmode initialization failed. Falling back to native renderer.', error);
        }
      }
      onRendererUnavailable?.(RenderEngine.TEXTMODE, reason);
    }
  }, [applyTextmodeSourceConfig, onRendererUnavailable]);

  React.useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    triggerStaticRender: async (width: number, height: number, customConfig?: EngineConfig) => {
       const activeConfig = customConfig || configRef.current;
       if (activeConfig.renderEngine === RenderEngine.TEXTMODE) {
           if (!canvasRef.current) return null;
           const tempCanvas = document.createElement('canvas');
           tempCanvas.width = Math.max(1, Math.floor(width));
           tempCanvas.height = Math.max(1, Math.floor(height));
           const tempCtx = tempCanvas.getContext('2d');
           if (!tempCtx) return null;
           tempCtx.drawImage(canvasRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
           return new Promise<Blob | null>((resolve) => {
             tempCanvas.toBlob(resolve, 'image/png', 1.0);
           });
       }

       if (engineRef.current) {
           return engineRef.current.triggerStaticRender(
               imageSource, 
               activeConfig, 
               width, 
               height,
               brushLayerRef.current || undefined
           );
       }
       return null;
    },
    generateSVG: async (width: number, height: number) => {
        if ((configRef.current.renderEngine || RenderEngine.NATIVE) === RenderEngine.TEXTMODE) {
            return null;
        }
        if (engineRef.current) {
            return engineRef.current.generateSVG(imageSource, config, width, height);
        }
        return null;
    },
    exportText: async (width: number, height: number, customConfig?: EngineConfig) => {
        const activeConfig = customConfig || configRef.current;
        const exportEngine =
          engineRef.current ||
          new AsciiEngine(Object.assign(document.createElement('canvas'), { width: 1, height: 1 }));
        const text = await exportEngine.generateAsciiText(
          imageSourceRef.current,
          activeConfig,
          width,
          height,
          brushLayerRef.current || undefined
        );
        return text || null;
    },
    exportAnsi: async (width: number, height: number, customConfig?: EngineConfig) => {
        const activeConfig = customConfig || configRef.current;
        const exportEngine =
          engineRef.current ||
          new AsciiEngine(Object.assign(document.createElement('canvas'), { width: 1, height: 1 }));
        const ansi = await exportEngine.generateAnsiText(
          imageSourceRef.current,
          activeConfig,
          width,
          height,
          brushLayerRef.current || undefined
        );
        return ansi || null;
    }
  }));

  useEffect(() => {
    if (config.renderEngine !== RenderEngine.NATIVE) return;
    if (!canvasRef.current) return;
    if (!engineRef.current || engineCanvasRef.current !== canvasRef.current) {
      engineRef.current = new AsciiEngine(canvasRef.current);
      engineCanvasRef.current = canvasRef.current;
    }
  }, [config.renderEngine]);

  useEffect(() => {
    if (config.renderEngine === RenderEngine.TEXTMODE) {
      ensureTextmode();
    } else {
      destroyTextmode();
    }
  }, [config.renderEngine, destroyTextmode, ensureTextmode]);

  useEffect(() => {
    if (config.renderEngine !== RenderEngine.TEXTMODE) return;
    const textmodeInstance = textmodeRef.current;
    if (!textmodeInstance) return;

    try {
      textmodeInstance.fontSize(Math.max(6, Math.round(config.resolution || 12)));
      textmodeInstance.targetFrameRate(Math.max(1, Math.round(config.frameRate || 30)));
    } catch (error) {
      console.warn('Textmode parameter update failed:', error);
    }

    if (textmodeSourceRef.current) {
      applyTextmodeSourceConfig(textmodeSourceRef.current, config);
    }
  }, [applyTextmodeSourceConfig, config]);

  useEffect(() => {
    if (config.renderEngine !== RenderEngine.TEXTMODE) return;
    const textmodeInstance = textmodeRef.current;
    if (!textmodeInstance) return;

    const token = textmodeSourceTokenRef.current + 1;
    textmodeSourceTokenRef.current = token;

    const loadSource = async () => {
      const disposeCurrentSource = () => {
        try {
          if (textmodeSourceRef.current?.$dispose) {
            textmodeSourceRef.current.$dispose();
          }
        } catch (error) {
          console.warn('Textmode source dispose failed:', error);
        } finally {
          textmodeSourceRef.current = null;
          textmodeSourceElementRef.current = null;
          textmodeSourceIsVideoRef.current = false;
        }
      };

      if (!imageSource) {
        disposeCurrentSource();
        return;
      }

      if (imageSource === textmodeSourceElementRef.current && textmodeSourceRef.current) {
        applyTextmodeSourceConfig(textmodeSourceRef.current, configRef.current);
        return;
      }

      disposeCurrentSource();

      const sourceInput = getTextmodeSourceInput(imageSource);
      if (!sourceInput) {
        const reason =
          imageSource instanceof HTMLVideoElement
            ? 'Current video source is a live stream and is not compatible with Textmode loading.'
            : 'Image source is not ready for Textmode loading.';
        console.warn(`Textmode source loading skipped: ${reason}`);
        onRendererUnavailable?.(RenderEngine.TEXTMODE, reason);
        return;
      }

      try {
        const sourceLoadable =
          imageSource instanceof HTMLVideoElement
            ? await textmodeInstance.loadVideo(sourceInput)
            : await textmodeInstance.loadImage(sourceInput);

        if (token !== textmodeSourceTokenRef.current) {
          try {
            if (sourceLoadable?.$dispose) sourceLoadable.$dispose();
          } catch {
            // no-op
          }
          return;
        }

        textmodeSourceRef.current = sourceLoadable;
        textmodeSourceElementRef.current = imageSource;
        textmodeSourceIsVideoRef.current = imageSource instanceof HTMLVideoElement;
        textmodeVideoSyncWarnedRef.current = false;

        if (imageSource instanceof HTMLVideoElement && isTextmodeVideoSource(sourceLoadable)) {
          try {
            sourceLoadable.loop(imageSource.loop);
            sourceLoadable.volume(imageSource.muted ? 0 : imageSource.volume);
            sourceLoadable.time(Number.isFinite(imageSource.currentTime) ? imageSource.currentTime : 0);
            if (!imageSource.paused && !imageSource.ended) {
              void sourceLoadable.play().catch(() => {
                // no-op
              });
            } else {
              sourceLoadable.pause();
            }
          } catch (error) {
            console.warn('Textmode video source initialization failed:', error);
          }
        }

        applyTextmodeSourceConfig(sourceLoadable, configRef.current);
      } catch (error) {
        console.warn('Textmode source loading failed:', error);
        onRendererUnavailable?.(
          RenderEngine.TEXTMODE,
          error instanceof Error ? error.message : 'Textmode source loading failed.'
        );
      }
    };

    void loadSource();
  }, [applyTextmodeSourceConfig, config.renderEngine, imageSource, onRendererUnavailable]);

  useEffect(() => {
    if (shockTrigger > 0 && shockTrigger > lastShockTriggerRef.current) {
        lastShockTriggerRef.current = shockTrigger;
        shockStartFrame.current = -1; // Reset to sync with next deterministic simulation frame
    }
  }, [shockTrigger]);

  useEffect(() => {
    return () => {
      destroyTextmode();
    };
  }, [destroyTextmode]);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenActive = document.fullscreenElement === containerRef.current;
      setIsFullscreen(fullscreenActive);
      if (!fullscreenActive) {
        setHudVisible(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleHudShortcut = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setHudVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleHudShortcut);
    return () => {
      window.removeEventListener('keydown', handleHudShortcut);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!(imageSource instanceof HTMLVideoElement)) {
      setIsVideoPlaying(false);
      setIsVideoSeekable(false);
      return;
    }

    const video = imageSource;
    const syncVideoState = () => {
      const isPlaying = !video.paused && !video.ended;
      const canSeek = !video.srcObject && Number.isFinite(video.duration) && video.duration > 0 && video.seekable.length > 0;
      setIsVideoPlaying(isPlaying);
      setIsVideoSeekable(canSeek);
    };

    syncVideoState();
    const events = ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange'];
    events.forEach((eventName) => video.addEventListener(eventName, syncVideoState));
    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, syncVideoState));
    };
  }, [imageSource]);

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

  const handleToggleVideoPlayback = async () => {
    if (!(imageSource instanceof HTMLVideoElement)) return;
    const video = imageSource;
    if (video.paused || video.ended) {
      try {
        await video.play();
      } catch (err) {
        console.warn('Video play failed:', err);
      }
    } else {
      video.pause();
    }
  };

  const handleVideoRewind = () => {
    if (!(imageSource instanceof HTMLVideoElement) || !isVideoSeekable) return;
    imageSource.currentTime = Math.max(0, imageSource.currentTime - 5);
  };

  const handleVideoRestart = async () => {
    if (!(imageSource instanceof HTMLVideoElement) || !isVideoSeekable) return;
    imageSource.currentTime = 0;
    if (imageSource.paused) {
      try {
        await imageSource.play();
      } catch (err) {
        console.warn('Video restart play failed:', err);
      }
    }
  };

  const animate = useCallback((rafTime: number) => {
    const targetFrameRate = Math.max(1, Math.round(config.frameRate || 30));
    const frameDurationMs = 1000 / targetFrameRate;
    if (frameEpochTimeRef.current === null) {
      frameEpochTimeRef.current = rafTime;
    }
    const elapsed = Math.max(0, rafTime - frameEpochTimeRef.current);
    const simulationFrame = Math.floor(elapsed / frameDurationMs);

    if (simulationFrame === lastSimulationFrameRef.current) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }
    lastSimulationFrameRef.current = simulationFrame;
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

    if (canvasRef.current && brushLayerRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      let targetWidth = containerRect.width;
      let targetHeight = containerRect.height;
      const sourceDimensions = getSourceDimensions(imageSource);

      if (sourceDimensions) {
        if (viewMode === 'ORIGINAL') {
          targetWidth = sourceDimensions.w;
          targetHeight = sourceDimensions.h;
        } else {
          const sourceAspect = sourceDimensions.w / sourceDimensions.h;
          const containerAspect = containerRect.width / Math.max(1, containerRect.height);
          if (sourceAspect > containerAspect) {
            targetWidth = containerRect.width;
            targetHeight = targetWidth / sourceAspect;
          } else {
            targetHeight = containerRect.height;
            targetWidth = targetHeight * sourceAspect;
          }
        }
      }
      targetWidth = Math.max(1, Math.floor(targetWidth));
      targetHeight = Math.max(1, Math.floor(targetHeight));

      if (config.renderEngine === RenderEngine.TEXTMODE) {
        const tm = textmodeRef.current;
        if (tm && (tm.width !== targetWidth || tm.height !== targetHeight)) {
          try {
            tm.resizeCanvas(targetWidth, targetHeight);
          } catch (error) {
            console.warn('Textmode resize failed:', error);
          }
        }
      } else if (engineRef.current) {
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
            key={`render-surface-${config.renderEngine}`}
            ref={canvasRef} 
            className="block shadow-2xl"
        />
      </div>

      <canvas ref={brushLayerRef} className="hidden" />

      {isFullscreen && (
        <button
          onClick={() => setHudVisible((prev) => !prev)}
          className="absolute top-4 right-4 p-2 bg-[#000]/80 border border-[#5f574f] rounded text-white hover:bg-[#1d2b53] z-[60]"
          title={hudVisible ? 'Hide Overlay UI (H)' : 'Show Overlay UI (H)'}
        >
          {hudVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}

      {isVideoSource && hudVisible && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-[#000]/80 border border-[#5f574f] rounded-lg backdrop-blur-sm shadow-xl z-50">
          <button
            onClick={handleVideoRewind}
            disabled={!isVideoSeekable}
            className="p-2 hover:bg-[#1d2b53] text-white rounded disabled:opacity-40 disabled:cursor-not-allowed"
            title="Rewind 5s"
          >
            <Rewind size={16} />
          </button>
          <button
            onClick={handleToggleVideoPlayback}
            className="p-2 hover:bg-[#1d2b53] text-white rounded"
            title={isVideoPlaying ? 'Pause' : 'Play'}
          >
            {isVideoPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={handleVideoRestart}
            disabled={!isVideoSeekable}
            className="p-2 hover:bg-[#1d2b53] text-white rounded disabled:opacity-40 disabled:cursor-not-allowed"
            title="Restart"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
      
      {hudVisible && (
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
      )}

      {isSpacePressed && hudVisible && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#ff004d] text-white text-[10px] px-2 py-1 font-bold tracking-widest uppercase border border-white animate-pulse pointer-events-none z-50">
              <Move size={12} className="inline mr-1"/>
              DRAG TO PAN
          </div>
      )}
    </div>
  );
});

