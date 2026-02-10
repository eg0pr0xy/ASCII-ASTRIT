
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AsciiCanvas } from './components/AsciiCanvas';
import { LeftPanel, RightPanel } from './components/ControlPanels';
import { LandingPage } from './components/LandingPage';
import { Mascot } from './components/Mascot';
import { EngineConfig, AsciiMode, BrushType, AppState, AsciiCanvasHandle, FontType, ThemeMode, ColorMode, DistortionMode, PaperSize, PrintDPI, RenderMetrics, ProjectFile, PresetFile, CustomRampEntry } from './engineTypes';
import { PRESETS, THEMES, PAPER_DIMENSIONS, DEFAULT_POST_PROCESS, DPI_MULTIPLIERS, COLOR_PALETTES, ENGINE_VERSION, DEFAULT_CUSTOM_RAMP } from './constants';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const createRampEntryId = () => `ramp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeRampEntries = (entries: unknown): CustomRampEntry[] => {
  if (!Array.isArray(entries)) {
    return DEFAULT_CUSTOM_RAMP.map((entry) => ({ ...entry }));
  }

  const normalized = entries
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Partial<CustomRampEntry>;
      const char = typeof source.char === 'string' && source.char.length > 0 ? source.char.slice(0, 1) : ' ';
      const brightnessValue = typeof source.brightness === 'number' ? source.brightness : index / Math.max(1, entries.length - 1);
      const semanticValue = typeof source.semanticValue === 'string' ? source.semanticValue : '';
      const id = typeof source.id === 'string' && source.id.length > 0 ? source.id : createRampEntryId();
      return { id, char, brightness: clamp01(brightnessValue), semanticValue };
    })
    .filter((entry): entry is CustomRampEntry => Boolean(entry));

  if (normalized.length === 0) {
    return DEFAULT_CUSTOM_RAMP.map((entry) => ({ ...entry }));
  }
  return normalized;
};

const normalizeCustomRamps = (input: unknown): Record<string, CustomRampEntry[]> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const result: Record<string, CustomRampEntry[]> = {};
  Object.entries(input as Record<string, unknown>).forEach(([name, value]) => {
    if (typeof name !== 'string' || !name.trim()) return;
    result[name] = normalizeRampEntries(value);
  });
  return result;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [config, setConfig] = useState<EngineConfig>({
    ...PRESETS.DEFAULT,
    mode: AsciiMode.PICO_ASCII,
    colorMode: ColorMode.MONO,
    paletteName: 'PICO_8',
    palette: COLOR_PALETTES.PICO_8,
    distortion: DistortionMode.NONE,
    distortionStrength: 0,
    dithering: 0,
    gamma: 1.0,
    semanticRamp: false,
    postProcess: { ...DEFAULT_POST_PROCESS }
  } as EngineConfig);
  
  const [brush, setBrush] = useState<BrushType>(BrushType.NONE);
  const [theme, setTheme] = useState<ThemeMode>(ThemeMode.PICO);
  const [imageSource, setImageSource] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [charStats, setCharStats] = useState<Record<string, number>>({});
  const [customPalettes, setCustomPalettes] = useState<Record<string, string[]>>({});
  const [customRamps, setCustomRamps] = useState<Record<string, CustomRampEntry[]>>({});
  
  const renderMetricsRef = useRef<RenderMetrics | null>(null);
  const [shockTrigger, setShockTrigger] = useState<number>(0);
  const [clearBrushTrigger, setClearBrushTrigger] = useState<number>(0);
  const [dpi, setDpi] = useState<PrintDPI>(PrintDPI.SCREEN);
  const [isExporting, setIsExporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasHandleRef = useRef<AsciiCanvasHandle>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const sourceUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const currentThemeVars = THEMES[theme];
    if (currentThemeVars) {
        Object.entries(currentThemeVars).forEach(([key, value]) => {
            root.style.setProperty(key, value as string);
        });
    }
  }, [theme]);

  useEffect(() => {
      const savedPalettes = localStorage.getItem('astrit_custom_palettes');
      if (savedPalettes) {
          try {
              const data = JSON.parse(savedPalettes);
              if (data && typeof data === 'object' && !Array.isArray(data)) {
                setCustomPalettes(data);
              }
          } catch (e) {
              console.error("Failed to load palettes:", e);
          }
      }

      const savedRamps = localStorage.getItem('astrit_custom_ramps');
      if (savedRamps) {
          try {
              const data = JSON.parse(savedRamps);
              setCustomRamps(normalizeCustomRamps(data));
          } catch (e) {
              console.error("Failed to load ramps:", e);
          }
      }
  }, []);

  const revokeSourceUrl = () => {
      if (sourceUrlRef.current) {
          URL.revokeObjectURL(sourceUrlRef.current);
          sourceUrlRef.current = null;
      }
  };

  const handleRecordVideo = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      setRecordTime(0);
      return;
    }

    const canvas = canvasHandleRef.current?.getCanvas();
    if (!canvas) {
      alert("No canvas detected for recording.");
      return;
    }

    chunksRef.current = [];
    const stream = (canvas as any).captureStream(30);
    const options = { mimeType: 'video/webm;codecs=vp9', bitsPerSecond: 8000000 };
    
    try {
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `astrit-render-${config.mode}-${Date.now()}.webm`;
        link.click();
        URL.revokeObjectURL(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      const start = Date.now();
      recordIntervalRef.current = window.setInterval(() => {
        setRecordTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);

    } catch (e) {
      console.error("Recording failed:", e);
      alert("Recording failed. Your browser might not support high-quality WebM capture.");
    }
  };

  const handleSavePalette = (name: string, colors: string[]) => {
      const updated = { ...customPalettes, [name]: colors };
      setCustomPalettes(updated);
      localStorage.setItem('astrit_custom_palettes', JSON.stringify(updated));
      setConfig(p => ({ ...p, paletteName: name, palette: colors }));
  };

  const handleDeletePalette = (name: string) => {
      const updated = { ...customPalettes };
      delete updated[name];
      setCustomPalettes(updated);
      localStorage.setItem('astrit_custom_palettes', JSON.stringify(updated));
      if (config.paletteName === name) {
          setConfig(p => ({ ...p, paletteName: 'PICO_8', palette: COLOR_PALETTES.PICO_8 }));
      }
  };

  const handleSaveRamp = (name: string, entries: CustomRampEntry[]) => {
      const normalizedEntries = normalizeRampEntries(entries);
      const updated = { ...customRamps, [name]: normalizedEntries };
      setCustomRamps(updated);
      localStorage.setItem('astrit_custom_ramps', JSON.stringify(updated));
      setConfig((prev) => ({
        ...prev,
        customRampName: name,
        customRampEnabled: true,
        customRampEntries: normalizedEntries
      }));
  };

  const handleLoadRamp = (name: string) => {
      const entries = customRamps[name];
      if (!entries) return;
      setConfig((prev) => ({
        ...prev,
        customRampName: name,
        customRampEnabled: true,
        customRampEntries: normalizeRampEntries(entries)
      }));
  };

  const handleDeleteRamp = (name: string) => {
      const updated = { ...customRamps };
      delete updated[name];
      setCustomRamps(updated);
      localStorage.setItem('astrit_custom_ramps', JSON.stringify(updated));

      if (config.customRampName === name) {
          setConfig((prev) => ({
            ...prev,
            customRampName: 'DEFAULT_CUSTOM',
            customRampEnabled: false,
            customRampEntries: DEFAULT_CUSTOM_RAMP.map((entry) => ({ ...entry }))
          }));
      }
  };

  const handleEyeDropper = async () => {
    if (!('EyeDropper' in window)) {
      alert("EYEDROPPER API NOT SUPPORTED IN THIS BROWSER.");
      return;
    }
    try {
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      const color = result.sRGBHex;
      setConfig(p => ({ ...p, palette: [...p.palette, color] }));
    } catch (e) {
      console.warn("EyeDropper closed or failed", e);
    }
  };

  const handleGenerateFromImage = useCallback(() => {
      if (!imageSource) {
          alert("PLEASE PROVIDE A SOURCE INPUT TO SAMPLE DATA.");
          return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 150;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(imageSource, 0, 0, 150, 150);
      const imageData = ctx.getImageData(0, 0, 150, 150).data;
      const colorsMap: Record<string, number> = {};
      
      // Step through pixels to find the most common dominant colors
      for (let i = 0; i < imageData.length; i += 16) { 
          const r = imageData[i], g = imageData[i+1], b = imageData[i+2];
          // Round colors slightly to group similar shades
          const rr = Math.round(r / 10) * 10;
          const rg = Math.round(g / 10) * 10;
          const rb = Math.round(b / 10) * 10;
          const hex = `#${((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1)}`;
          colorsMap[hex] = (colorsMap[hex] || 0) + 1;
      }
      
      const palette = Object.entries(colorsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8) // Sample 8 dominant colors for a richer look
        .map(entry => entry[0]);

      if (palette.length > 1) {
          setConfig(p => ({ ...p, paletteName: 'SAMPLED', palette, colorMode: ColorMode.QUANTIZED }));
      }
  }, [imageSource]);

  const handleStatsUpdate = useCallback((stats: { charCounts: Record<string, number>, metrics: RenderMetrics }) => {
    if (stats) {
      setCharStats(stats.charCounts || {});
      renderMetricsRef.current = stats.metrics || null;
    }
  }, []);

  const stopMedia = () => {
      if (videoRef.current) {
          videoRef.current.pause();
          if (videoRef.current.srcObject) {
             const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
             tracks.forEach(track => track.stop());
          }
          videoRef.current.src = "";
          videoRef.current = null;
      }
      revokeSourceUrl();
  };

  useEffect(() => {
      return () => {
          if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
          stopMedia();
      };
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopMedia();
      const url = URL.createObjectURL(file);
      sourceUrlRef.current = url;
      if (file.type.startsWith('video')) {
         const vid = document.createElement('video');
         vid.src = url;
         vid.loop = true;
         vid.muted = true;
         vid.play();
         videoRef.current = vid;
         setImageSource(vid);
      } else {
         const img = new Image();
         img.src = url;
         img.onload = () => setImageSource(img);
      }
    }
  };

  const handleWebcam = async () => {
    try {
        stopMedia();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const vid = document.createElement('video');
        vid.srcObject = stream;
        vid.play();
        videoRef.current = vid;
        setImageSource(vid);
    } catch (err) {
        console.error("Webcam error:", err);
        alert("Could not access webcam.");
    }
  };

  const handleExport = () => {
    const container = document.getElementById('ascii-canvas-render');
    const canvas = container?.querySelector('canvas');
    if (canvas) {
        canvas.toBlob(blob => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `astrit-snap-${Date.now()}.png`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }, 'image/png');
    }
  };

  const handleExportHD = async (selectedSize: string = "SOURCE") => {
    if (!imageSource || !canvasHandleRef.current) return;
    setIsExporting(true);

    setTimeout(async () => {
        try {
            let srcW = 1920, srcH = 1080;
            if (imageSource instanceof HTMLImageElement) { srcW = imageSource.naturalWidth; srcH = imageSource.naturalHeight; }
            else if (imageSource instanceof HTMLVideoElement) { srcW = videoRef.current?.videoWidth || 1920; srcH = videoRef.current?.videoHeight || 1080; }

            const isPortrait = srcH > srcW;
            let targetW = srcW, targetH = srcH;

            if (selectedSize !== "SOURCE" && PAPER_DIMENSIONS[selectedSize]) {
                const dim = PAPER_DIMENSIONS[selectedSize];
                if (isPortrait) {
                    targetW = Math.min(dim.w, dim.h);
                    targetH = Math.max(dim.w, dim.h);
                } else {
                    targetW = Math.max(dim.w, dim.h);
                    targetH = Math.min(dim.w, dim.h);
                }
            }

            const scaleMultiplier = dpi === PrintDPI.SCREEN ? DPI_MULTIPLIERS.SCREEN : DPI_MULTIPLIERS.PRINT;
            const finalW = Math.round(targetW * scaleMultiplier);
            const finalH = Math.round(targetH * scaleMultiplier);

            const blob = await canvasHandleRef.current!.triggerStaticRender(finalW, finalH);
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `astrit-MASTER-${selectedSize}-${dpi}-${Date.now()}.png`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch(e) {
            console.error("Export Error:", e);
            alert("Export Error: Dimensions might exceed browser limits.");
        } finally {
            setIsExporting(false);
        }
    }, 100);
  };

  const handleContactSheet = async () => {
    if (!canvasHandleRef.current || !imageSource) return;
    setIsExporting(true);

    setTimeout(async () => {
        try {
            const dim = PAPER_DIMENSIONS.A2;
            const sheetW = dim.h;
            const sheetH = dim.w;
            
            const sheetCanvas = document.createElement('canvas');
            sheetCanvas.width = sheetW;
            sheetCanvas.height = sheetH;
            const ctx = sheetCanvas.getContext('2d');
            if (!ctx) return;
            
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, sheetW, sheetH);
            
            const margin = 100;
            const headerH = 250;
            const allModes = Object.values(AsciiMode);
            const cols = 7;
            const rows = Math.ceil(allModes.length / cols);
            const gap = 40;
            
            const cellW = (sheetW - (margin * 2) - (gap * (cols - 1))) / cols;
            const cellH = cellW * 0.75;

            ctx.fillStyle = '#ff004d';
            ctx.font = 'bold 120px "Rubik Glitch"';
            ctx.fillText("ASTRIT VARIATION INDEX", margin, 120);
            ctx.fillStyle = '#fff';
            ctx.font = '40px monospace';
            ctx.fillText(`ID: ${Date.now().toString(36).toUpperCase()} // ${allModes.length} VARIANTS // RES: ${config.resolution}px`, margin, 190);

            for (let i = 0; i < allModes.length; i++) {
                const mode = allModes[i];
                const r = Math.floor(i / cols);
                const c = i % cols;
                const x = margin + c * (cellW + gap);
                const y = headerH + r * (cellH + gap + 50);

                const blob = await canvasHandleRef.current!.triggerStaticRender(Math.round(cellW), Math.round(cellH), { ...config, mode });
                if (blob) {
                    const img = await new Promise<HTMLImageElement>((resolve) => {
                        const iObj = new Image();
                        const u = URL.createObjectURL(blob);
                        iObj.onload = () => { URL.revokeObjectURL(u); resolve(iObj); };
                        iObj.src = u;
                    });
                    ctx.drawImage(img, x, y, cellW, cellH);
                    ctx.strokeStyle = '#29adff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, cellW, cellH);
                    
                    ctx.fillStyle = '#83769c';
                    ctx.font = 'bold 16px monospace';
                    ctx.fillText(`${i+1}. ${mode}`, x, y + cellH + 25);
                }
            }
            
            sheetCanvas.toBlob(blob => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `astrit-INDEX-${Date.now()}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
                setIsExporting(false);
            }, 'image/png');
        } catch(e) {
            console.error("Contact Sheet Error:", e);
            setIsExporting(false);
        }
    }, 100);
  };

  const handleSaveProject = () => {
      let sourceB64 = undefined;
      if (imageSource instanceof HTMLImageElement) {
          const canvas = document.createElement('canvas');
          canvas.width = imageSource.naturalWidth;
          canvas.height = imageSource.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(imageSource, 0, 0);
          sourceB64 = canvas.toDataURL();
      }
      
      const project: ProjectFile = {
          version: ENGINE_VERSION,
          config,
          theme,
          sourceImage: sourceB64,
          timestamp: Date.now()
      };
      
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `project-${Date.now()}.astrit`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      stopMedia();
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const project: ProjectFile = JSON.parse(ev.target?.result as string);
              if (project.config) {
                  setConfig(prev => ({
                    ...prev,
                    ...project.config,
                    customRampEntries: normalizeRampEntries(project.config.customRampEntries ?? prev.customRampEntries),
                    customRampName: project.config.customRampName || prev.customRampName
                  }));
              }
              if (project.theme) setTheme(project.theme);
              if (project.sourceImage) {
                  const img = new Image();
                  img.onload = () => setImageSource(img);
                  img.src = project.sourceImage;
              }
          } catch(err) {
              alert("Error loading .astrit project file.");
          }
      };
      reader.readAsText(file);
  };

  const handleSavePreset = () => {
      const presetName = prompt("Enter Preset Name:", "CUSTOM_PRESET") || "UNTITLED";
      const preset: PresetFile & { theme?: ThemeMode } = {
          name: presetName,
          version: ENGINE_VERSION,
          config,
          theme 
      };
      const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `preset-${presetName.toLowerCase()}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
  };

  const handleLoadPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const preset: any = JSON.parse(ev.target?.result as string);
              if (preset.config) {
                  setConfig(prev => ({
                    ...prev,
                    ...preset.config,
                    customRampEntries: normalizeRampEntries(preset.config.customRampEntries ?? prev.customRampEntries),
                    customRampName: preset.config.customRampName || prev.customRampName
                  }));
              }
              if (preset.theme) setTheme(preset.theme);
          } catch(err) {
              alert("Error loading preset JSON.");
          }
      };
      reader.readAsText(file);
  };

  const handleExportSVG = async () => { alert("SVG Export coming soon."); };
  const handleSocialCard = async () => { alert("Social Card currently unavailable."); };
  const handleShock = () => setShockTrigger(Date.now());

  if (appState === AppState.LANDING) {
      return <LandingPage onStart={() => setAppState(AppState.STUDIO)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-mono overflow-hidden transition-colors duration-500">
        {isExporting && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn">
                <div className="w-64 h-2 bg-[var(--bg-panel)] mb-4 overflow-hidden relative">
                    <div className="absolute inset-0 bg-[var(--accent)] animate-[shimmer_2s_infinite]"></div>
                </div>
                <h3 className="text-[var(--accent)] font-['Rubik_Glitch'] text-3xl mb-2">GENERATING MASTER...</h3>
                <p className="text-[var(--text-secondary)] text-xs tracking-widest animate-pulse">DO NOT CLOSE TAB</p>
            </div>
        )}
        
        <LeftPanel 
            config={config} setConfig={setConfig} onUpload={handleUpload} onWebcam={handleWebcam}
            charStats={charStats}
            customPalettes={customPalettes} onSavePalette={handleSavePalette}
            onDeletePalette={handleDeletePalette} onGenerateFromImage={handleGenerateFromImage}
            customRamps={customRamps} onSaveRamp={handleSaveRamp}
            onLoadRamp={handleLoadRamp} onDeleteRamp={handleDeleteRamp}
            onSaveProject={handleSaveProject} onLoadProject={handleLoadProject}
            onSavePreset={handleSavePreset} onLoadPreset={handleLoadPreset}
            onEyeDropper={handleEyeDropper}
        />

        <main className="flex-1 relative bg-[#000] flex items-center justify-center p-6 border-t-8 border-b-8 border-[var(--border-panel)]">
            <div className="relative w-full h-full max-h-[90vh] aspect-video border-4 border-[var(--border-module)] bg-black rounded-lg overflow-hidden ring-4 ring-[var(--highlight)]/20 shadow-2xl">
                {!imageSource && brush === BrushType.NONE && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="text-center animate-pulse">
                            <h2 className="text-6xl text-[var(--border-module)] font-['Rubik_Glitch']">NO SIGNAL</h2>
                            <p className="text-[var(--text-secondary)] mt-4 font-bold tracking-[0.5em]">SYSTEM STANDBY</p>
                        </div>
                    </div>
                )}
                
                {isRecording && (
                  <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-black/80 px-3 py-1 border border-red-600 animate-pulse">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <span className="text-red-500 font-bold text-xs tracking-tighter">REC {recordTime}s</span>
                  </div>
                )}

                <AsciiCanvas 
                    ref={canvasHandleRef} config={config} imageSource={imageSource} 
                    brushType={brush} onStatsUpdate={handleStatsUpdate}
                    shockTrigger={shockTrigger} clearBrushTrigger={clearBrushTrigger}
                />
                <div className="absolute inset-0 scanline pointer-events-none opacity-30"></div>
                <div className="absolute inset-0 vignette pointer-events-none"></div>
                <div className="absolute inset-0 crt-flicker pointer-events-none opacity-5"></div>
            </div>

            <Mascot />
        </main>

        <RightPanel 
            config={config} setConfig={setConfig} brush={brush} setBrush={setBrush}
            onExport={handleExport} onExportHD={handleExportHD}
            onSocialCard={handleSocialCard} onContactSheet={handleContactSheet}
            onExportSVG={handleExportSVG} onShock={handleShock}
            onClearBrush={() => setClearBrushTrigger(Date.now())}
            onRecordVideo={handleRecordVideo} isRecording={isRecording}
            dpi={dpi} setDpi={setDpi} isExporting={isExporting}
        />
    </div>
  );
}

