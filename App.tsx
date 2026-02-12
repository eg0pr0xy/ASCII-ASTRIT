
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AsciiCanvas } from './components/AsciiCanvas';
import { LeftPanel, RightPanel } from './components/ControlPanels';
import { LandingPage } from './components/LandingPage';
import { HelpPage } from './components/HelpPage';
import { Mascot } from './components/Mascot';
import { AsciiEngine } from './services/asciiEngine';
import { EngineConfig, AsciiMode, BrushType, AppState, AsciiCanvasHandle, FontType, ThemeMode, ColorMode, DistortionMode, DitheringMode, PaperSize, PrintDPI, RenderMetrics, ProjectFile, PresetFile, CustomRampEntry, TemporalDiagnosticsMode, RenderEngine } from './engineTypes';
import { PRESETS, THEMES, PAPER_DIMENSIONS, DEFAULT_POST_PROCESS, DPI_MULTIPLIERS, COLOR_PALETTES, ENGINE_VERSION, SERIALIZATION_SCHEMA_VERSION, DEFAULT_CUSTOM_RAMP } from './constants';
import GIF from 'gif.js';
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';
import { SlidersHorizontal, Image as ImageIcon, X, BookOpen } from 'lucide-react';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && Object.values(ThemeMode).includes(value as ThemeMode);

const toStringSafe = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);
const toBooleanSafe = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const toEnumSafe = <T extends string>(
  value: unknown,
  options: Record<string, T>,
  fallback: T
): T => (typeof value === 'string' && Object.values(options).includes(value as T) ? (value as T) : fallback);
const toNumberSafe = (value: unknown, fallback: number, min?: number, max?: number) => {
  let numeric = fallback;
  try {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) numeric = parsed;
  } catch {
    numeric = fallback;
  }
  if (min !== undefined) numeric = Math.max(min, numeric);
  if (max !== undefined) numeric = Math.min(max, numeric);
  return numeric;
};
const toHexColorSafe = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#([0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
const toSchemaVersionSafe = (value: unknown, fallback = 0) =>
  Math.max(0, Math.floor(toNumberSafe(value, fallback, 0, 9999)));
const normalizePaletteColors = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => /^#([0-9a-f]{6})$/i.test(entry))
    .slice(0, 32);
  return normalized.length ? normalized : [...fallback];
};
const normalizePaletteStore = (value: unknown): Record<string, string[]> => {
  if (!isObjectRecord(value)) return {};
  const normalized: Record<string, string[]> = {};
  Object.entries(value).forEach(([name, colors]) => {
    if (!name.trim()) return;
    const palette = normalizePaletteColors(colors, []);
    if (palette.length) normalized[name] = palette;
  });
  return normalized;
};
const sanitizePostProcess = (value: unknown, fallback: EngineConfig['postProcess']): EngineConfig['postProcess'] => {
  const source = isObjectRecord(value) ? value : {};
  return {
    blur: toNumberSafe(source.blur, fallback.blur, 0, 20),
    pixelate: toNumberSafe(source.pixelate, fallback.pixelate, 0, 32),
    invert: toNumberSafe(source.invert, fallback.invert, 0, 1),
    glow: toNumberSafe(source.glow, fallback.glow, 0, 1),
    saturation: toNumberSafe(source.saturation, fallback.saturation, 0, 6)
  };
};

const createRampEntryId = () => `ramp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const splitGraphemes = (value: string): string[] => {
  if (!value) return [];
  const SegmenterCtor = (Intl as any)?.Segmenter;
  if (typeof SegmenterCtor === 'function') {
    const segmenter = new SegmenterCtor(undefined, { granularity: 'grapheme' });
    const segments = segmenter.segment(value) as Iterable<{ segment: string }>;
    return Array.from(segments, (s) => s.segment);
  }
  return Array.from(value);
};

const firstGrapheme = (value: string, fallback = ' '): string => {
  const graphemes = splitGraphemes(value);
  return graphemes[0] || fallback;
};

const normalizeSemanticWord = (value: unknown, fallback: string): string => {
  const source = typeof value === 'string' ? value : fallback;
  const graphemes = splitGraphemes(source.trim());
  if (graphemes.length === 0) {
    const fallbackGraphemes = splitGraphemes((fallback || 'ASTRIT').trim());
    return fallbackGraphemes.length ? fallbackGraphemes.slice(0, 64).join('') : 'ASTRIT';
  }
  return graphemes.slice(0, 64).join('');
};

const normalizeRampEntries = (entries: unknown): CustomRampEntry[] => {
  if (!Array.isArray(entries)) {
    return DEFAULT_CUSTOM_RAMP.map((entry) => ({ ...entry }));
  }

  const normalized = entries
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Partial<CustomRampEntry>;
      const char = typeof source.char === 'string' && source.char.length > 0 ? firstGrapheme(source.char, ' ') : ' ';
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

const waitForVideoMetadata = (video: HTMLVideoElement, timeoutMs = 6000): Promise<boolean> =>
  new Promise((resolve) => {
    const immediate = getSourceDimensions(video);
    if (immediate) {
      resolve(true);
      return;
    }

    let done = false;
    let timeoutId: number | null = null;
    const events: Array<keyof HTMLVideoElementEventMap> = ['loadedmetadata', 'loadeddata', 'canplay', 'durationchange', 'resize'];
    const cleanup = () => {
      events.forEach((eventName) => video.removeEventListener(eventName, handleReady));
      video.removeEventListener('error', handleError);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(ok);
    };
    const handleReady = () => {
      finish(Boolean(getSourceDimensions(video)));
    };
    const handleError = () => {
      finish(false);
    };

    events.forEach((eventName) => video.addEventListener(eventName, handleReady));
    video.addEventListener('error', handleError, { once: true });
    timeoutId = window.setTimeout(() => finish(Boolean(getSourceDimensions(video))), timeoutMs);

    // Avoid forcing load() here because it can abort an in-flight play() call.
    // Metadata events from src/srcObject updates are enough for readiness tracking.
  });

const resolveSourceDimensions = async (
  source: HTMLImageElement | HTMLVideoElement | null,
  waitMs = 6000
): Promise<{ w: number; h: number } | null> => {
  const direct = getSourceDimensions(source);
  if (direct) return direct;
  if (source instanceof HTMLVideoElement) {
    const ready = await waitForVideoMetadata(source, waitMs);
    if (!ready) return null;
    return getSourceDimensions(source);
  }
  return null;
};

const blobToImage = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode rendered image blob.'));
    };
    img.src = url;
  });

const seekVideoTo = (video: HTMLVideoElement, time: number): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!Number.isFinite(time)) {
      resolve();
      return;
    }

    const clamped = Math.max(0, time);
    let timeoutId: number | null = null;

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Video seek failed.'));
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 4000);

    try {
      if (Math.abs(video.currentTime - clamped) < 0.0005) {
        cleanup();
        resolve();
        return;
      }
      video.currentTime = clamped;
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error('Video seek failed.'));
    }
  });

const computeExportDimensions = (
  sourceWidth: number,
  sourceHeight: number,
  selectedSize: string,
  dpi: PrintDPI,
  framingMode: ExportFramingMode
): ExportDimensions => {
  if (selectedSize === "SOURCE") {
    const exactW = Math.max(1, Math.round(sourceWidth));
    const exactH = Math.max(1, Math.round(sourceHeight));
    return { finalW: exactW, finalH: exactH, renderW: exactW, renderH: exactH };
  }

  const isPortrait = sourceHeight > sourceWidth;
  let targetW = sourceWidth;
  let targetH = sourceHeight;

  if (PAPER_DIMENSIONS[selectedSize]) {
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
  const finalW = Math.max(1, Math.round(targetW * scaleMultiplier));
  const finalH = Math.max(1, Math.round(targetH * scaleMultiplier));
  let renderW = finalW;
  let renderH = finalH;

  const sourceAspect = sourceWidth / Math.max(1, sourceHeight);
  const targetAspect = finalW / Math.max(1, finalH);
  if (framingMode === 'COVER') {
    if (sourceAspect > targetAspect) {
      renderH = finalH;
      renderW = Math.max(1, Math.round(finalH * sourceAspect));
    } else {
      renderW = finalW;
      renderH = Math.max(1, Math.round(finalW / sourceAspect));
    }
  } else {
    if (sourceAspect > targetAspect) {
      renderW = finalW;
      renderH = Math.max(1, Math.round(finalW / sourceAspect));
    } else {
      renderH = finalH;
      renderW = Math.max(1, Math.round(finalH * sourceAspect));
    }
  }

  return { finalW, finalH, renderW, renderH };
};

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const rgbToHex = (r: number, g: number, b: number): string => {
  const rr = clampColorChannel(r);
  const gg = clampColorChannel(g);
  const bb = clampColorChannel(b);
  return `#${((1 << 24) + (rr << 16) + (gg << 8) + bb).toString(16).slice(1)}`;
};

const colorDistanceSq = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
};

type ExportFramingMode = 'CONTAIN' | 'COVER';
type RecordingDurationMode = 'INFINITE' | 'ORIGINAL' | 'LOOPS';
type MobilePanel = 'LEFT' | 'RIGHT' | null;

interface ExportDimensions {
  finalW: number;
  finalH: number;
  renderW: number;
  renderH: number;
}

const sanitizeEngineConfig = (value: unknown, fallback: EngineConfig): EngineConfig => {
  const source = isObjectRecord(value) ? value : {};
  return {
    ...fallback,
    renderEngine: toEnumSafe(source.renderEngine, RenderEngine, fallback.renderEngine),
    seed: Math.round(toNumberSafe(source.seed, fallback.seed, 0, 999999999)),
    resolution: Math.round(toNumberSafe(source.resolution, fallback.resolution, 1, 128)),
    density: toNumberSafe(source.density, fallback.density, 0, 5),
    brightness: toNumberSafe(source.brightness, fallback.brightness, 0, 3),
    contrast: toNumberSafe(source.contrast, fallback.contrast, 0, 3),
    hue: toNumberSafe(source.hue, fallback.hue, -180, 180),
    saturation: toNumberSafe(source.saturation, fallback.saturation, 0, 4),
    lightness: toNumberSafe(source.lightness, fallback.lightness, 0, 4),
    gamma: toNumberSafe(source.gamma, fallback.gamma, 0.1, 4),
    dithering: toNumberSafe(source.dithering, fallback.dithering, 0, 1),
    ditheringMode: toEnumSafe(source.ditheringMode, DitheringMode, fallback.ditheringMode),
    colorizeDither: toBooleanSafe(source.colorizeDither, fallback.colorizeDither),
    outlineEnabled: toBooleanSafe(source.outlineEnabled, fallback.outlineEnabled),
    outlineSensitivity: toNumberSafe(source.outlineSensitivity, fallback.outlineSensitivity, 0, 0.99),
    outlineColor: toHexColorSafe(source.outlineColor, fallback.outlineColor),
    mode: toEnumSafe(source.mode, AsciiMode, fallback.mode),
    font: toEnumSafe(source.font, FontType, fallback.font),
    semanticWord: normalizeSemanticWord(source.semanticWord, fallback.semanticWord),
    semanticRamp: toBooleanSafe(source.semanticRamp, fallback.semanticRamp),
    customRampEnabled: toBooleanSafe(source.customRampEnabled, fallback.customRampEnabled),
    customSemanticMapping: toBooleanSafe(source.customSemanticMapping, fallback.customSemanticMapping),
    customRampName: toStringSafe(source.customRampName, fallback.customRampName),
    customRampEntries: normalizeRampEntries(source.customRampEntries ?? fallback.customRampEntries),
    temporalEnabled: toBooleanSafe(source.temporalEnabled, fallback.temporalEnabled),
    temporalBlend: toNumberSafe(source.temporalBlend, fallback.temporalBlend, 0, 0.95),
    characterInertia: toNumberSafe(source.characterInertia, fallback.characterInertia, 0, 1),
    edgeTemporalStability: toNumberSafe(source.edgeTemporalStability, fallback.edgeTemporalStability, 0, 1),
    temporalDiagnosticsEnabled: toBooleanSafe(source.temporalDiagnosticsEnabled, fallback.temporalDiagnosticsEnabled),
    temporalDiagnosticsMode: toEnumSafe(source.temporalDiagnosticsMode, TemporalDiagnosticsMode, fallback.temporalDiagnosticsMode),
    temporalDiagnosticsOpacity: toNumberSafe(source.temporalDiagnosticsOpacity, fallback.temporalDiagnosticsOpacity, 0.05, 0.95),
    adaptiveInertiaEnabled: toBooleanSafe(source.adaptiveInertiaEnabled, fallback.adaptiveInertiaEnabled),
    adaptiveInertiaStrength: toNumberSafe(source.adaptiveInertiaStrength, fallback.adaptiveInertiaStrength, 0, 1),
    temporalGhostClamp: toNumberSafe(source.temporalGhostClamp, fallback.temporalGhostClamp, 0, 1),
    colorMode: toEnumSafe(source.colorMode, ColorMode, fallback.colorMode),
    paletteName: toStringSafe(source.paletteName, fallback.paletteName),
    palette: normalizePaletteColors(source.palette, fallback.palette),
    distortion: toEnumSafe(source.distortion, DistortionMode, fallback.distortion),
    distortionStrength: toNumberSafe(source.distortionStrength, fallback.distortionStrength, 0, 10),
    postProcess: sanitizePostProcess(source.postProcess, fallback.postProcess),
    inverted: toBooleanSafe(source.inverted, fallback.inverted),
    frameRate: Math.round(toNumberSafe(source.frameRate, fallback.frameRate, 1, 120)),
    transparentBackground: toBooleanSafe(source.transparentBackground, fallback.transparentBackground)
  };
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [configState, setConfigState] = useState<EngineConfig>({
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
  const setConfig = useCallback<React.Dispatch<React.SetStateAction<EngineConfig>>>((nextValue) => {
    setConfigState((prev) => {
      const next =
        typeof nextValue === 'function'
          ? (nextValue as (prevState: EngineConfig) => EngineConfig)(prev)
          : nextValue;
      return sanitizeEngineConfig(next, prev);
    });
  }, []);
  const config = configState;
  
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
  const [exportFramingMode, setExportFramingMode] = useState<ExportFramingMode>('CONTAIN');
  const [isExporting, setIsExporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordingDurationMode, setRecordingDurationMode] = useState<RecordingDurationMode>('INFINITE');
  const [recordingLoops, setRecordingLoops] = useState(1);
  const [gifFps, setGifFps] = useState(8);
  const [gifQuality, setGifQuality] = useState(20);
  const [gifSourceLoops, setGifSourceLoops] = useState(1);
  const [gifRepeatCount, setGifRepeatCount] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [exportStatusLabel, setExportStatusLabel] = useState('GENERATING MASTER...');
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [helpAnchor, setHelpAnchor] = useState<'overview' | 'troubleshooting'>('overview');
  const rendererFallbackWarnedRef = useRef(false);
  const schemaWarningShownRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasHandleRef = useRef<AsciiCanvasHandle>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const recordStopTimeoutRef = useRef<number | null>(null);
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
              setCustomPalettes(normalizePaletteStore(data));
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

  const warnIfFutureSchema = (schemaVersion: number, kind: 'project' | 'preset') => {
    if (schemaVersion <= SERIALIZATION_SCHEMA_VERSION) return;
    if (schemaWarningShownRef.current) return;
    schemaWarningShownRef.current = true;
    alert(
      `${kind.toUpperCase()} SCHEMA v${schemaVersion} IS NEWER THAN THIS APP (v${SERIALIZATION_SCHEMA_VERSION}). LOADING IN BEST-EFFORT COMPATIBILITY MODE.`
    );
  };

  const clearRecordingTimers = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (recordStopTimeoutRef.current) {
      clearTimeout(recordStopTimeoutRef.current);
      recordStopTimeoutRef.current = null;
    }
  };

  const stopRecordingSession = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      setIsRecording(false);
      setRecordTime(0);
      clearRecordingTimers();
    }
  };

  const getRecordableVideoDuration = (): number | null => {
    const sourceVideo = imageSource instanceof HTMLVideoElement ? imageSource : null;
    if (!sourceVideo) return null;
    if (sourceVideo.srcObject) return null;
    const duration = sourceVideo.duration;
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return duration;
  };

  useEffect(() => {
    if (recordingDurationMode === 'INFINITE') return;
    if (!getRecordableVideoDuration()) {
      setRecordingDurationMode('INFINITE');
    }
  }, [recordingDurationMode, imageSource]);

  const handleRecordVideo = () => {
    if (isRecording) {
      stopRecordingSession();
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
    const sourceDuration = getRecordableVideoDuration();
    const targetDuration =
      recordingDurationMode === 'ORIGINAL'
        ? sourceDuration
        : recordingDurationMode === 'LOOPS'
          ? (sourceDuration ? sourceDuration * Math.max(1, recordingLoops) : null)
          : null;
    const sourceVideo = imageSource instanceof HTMLVideoElement ? imageSource : null;
    
    try {
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        setIsRecording(false);
        setRecordTime(0);
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `astrit-render-${config.mode}-${Date.now()}.webm`;
        link.click();
        URL.revokeObjectURL(url);
        mediaRecorderRef.current = null;
      };

      if (sourceVideo) {
        if (recordingDurationMode !== 'INFINITE' && sourceDuration) {
          try {
            sourceVideo.currentTime = 0;
          } catch (err) {
            console.warn('Could not seek source video to start before recording:', err);
          }
        }
        if (sourceVideo.paused) {
          void sourceVideo.play().catch((err) => console.warn('Source video play failed before recording:', err));
        }
      }

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      const start = Date.now();
      recordIntervalRef.current = window.setInterval(() => {
        setRecordTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);

      if (targetDuration && targetDuration > 0) {
        recordStopTimeoutRef.current = window.setTimeout(() => {
          stopRecordingSession();
        }, Math.round(targetDuration * 1000));
      }

    } catch (e) {
      console.error("Recording failed:", e);
      alert("Recording failed. Your browser might not support high-quality WebM capture.");
      clearRecordingTimers();
    }
  };

  const handleSavePalette = (name: string, colors: string[]) => {
      const normalizedColors = normalizePaletteColors(colors, config.palette);
      const updated = { ...customPalettes, [name]: normalizedColors };
      setCustomPalettes(updated);
      localStorage.setItem('astrit_custom_palettes', JSON.stringify(updated));
      setConfig(p => ({ ...p, paletteName: name, palette: normalizedColors }));
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

      if (imageSource instanceof HTMLVideoElement) {
          if (!imageSource.videoWidth || !imageSource.videoHeight || imageSource.readyState < 2) {
            alert("VIDEO FRAME NOT READY YET. PLAY OR SEEK THE VIDEO, THEN SAMPLE AGAIN.");
            return;
          }
      }

      const sourceDimensions = getSourceDimensions(imageSource);
      if (!sourceDimensions) {
          alert("SOURCE DIMENSIONS ARE NOT READY YET.");
          return;
      }

      const SAMPLE_SIZE = 192;
      const STEP = 2;
      const QUANT_STEP = 24;
      const MIN_COLOR_DISTANCE_SQ = 34 * 34;

      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imageSource, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
      const colorsMap = new Map<string, { r: number; g: number; b: number; weight: number }>();

      for (let y = 0; y < SAMPLE_SIZE; y += STEP) {
        for (let x = 0; x < SAMPLE_SIZE; x += STEP) {
          const idx = (y * SAMPLE_SIZE + x) * 4;
          const alpha = imageData[idx + 3];
          if (alpha < 32) continue;

          const r = imageData[idx];
          const g = imageData[idx + 1];
          const b = imageData[idx + 2];

          const rq = clampColorChannel(Math.round(r / QUANT_STEP) * QUANT_STEP);
          const gq = clampColorChannel(Math.round(g / QUANT_STEP) * QUANT_STEP);
          const bq = clampColorChannel(Math.round(b / QUANT_STEP) * QUANT_STEP);

          const maxChannel = Math.max(rq, gq, bq);
          const minChannel = Math.min(rq, gq, bq);
          const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
          const luminance = (rq * 0.299 + gq * 0.587 + bq * 0.114) / 255;
          const weight = 1 + saturation * 1.1 + Math.abs(luminance - 0.5) * 0.25;

          const key = `${rq},${gq},${bq}`;
          const existing = colorsMap.get(key);
          if (existing) {
            existing.weight += weight;
          } else {
            colorsMap.set(key, { r: rq, g: gq, b: bq, weight });
          }
        }
      }

      const rankedColors = Array.from(colorsMap.values()).sort((a, b) => b.weight - a.weight);
      const selected: Array<{ r: number; g: number; b: number }> = [];

      for (const color of rankedColors) {
        if (selected.length >= 8) break;
        const isDistinct = selected.every((entry) => colorDistanceSq(color, entry) >= MIN_COLOR_DISTANCE_SQ);
        if (isDistinct) selected.push({ r: color.r, g: color.g, b: color.b });
      }

      if (selected.length < 8) {
        for (const color of rankedColors) {
          if (selected.length >= 8) break;
          const exists = selected.some((entry) => entry.r === color.r && entry.g === color.g && entry.b === color.b);
          if (!exists) selected.push({ r: color.r, g: color.g, b: color.b });
        }
      }

      const palette = selected.map((entry) => rgbToHex(entry.r, entry.g, entry.b));

      if (palette.length > 1) {
          setConfig(p => ({ ...p, paletteName: 'SAMPLED', palette, colorMode: ColorMode.QUANTIZED }));
      } else {
          alert("PALETTE SAMPLING FOUND TOO FEW DISTINCT COLORS.");
      }
  }, [imageSource]);

  const handleStatsUpdate = useCallback((stats: { charCounts: Record<string, number>, metrics: RenderMetrics }) => {
    if (stats) {
      setCharStats(stats.charCounts || {});
      renderMetricsRef.current = stats.metrics || null;
    }
  }, []);

  const stopMedia = () => {
      stopRecordingSession();
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
      const handleResize = () => {
          if (window.innerWidth >= 1024) {
              setMobilePanel(null);
          }
      };
      window.addEventListener('resize', handleResize);
      return () => {
          window.removeEventListener('resize', handleResize);
      };
  }, []);

  useEffect(() => {
      return () => {
          clearRecordingTimers();
          stopMedia();
      };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
         vid.playsInline = true;
         vid.preload = 'metadata';
         const metadataPromise = waitForVideoMetadata(vid, 8000);
         void vid.play().catch((err) => {
           console.warn('Video autoplay failed after upload:', err);
         });
         videoRef.current = vid;
         setImageSource(vid);
         const metadataReady = await metadataPromise;
         if (!metadataReady) {
           alert("VIDEO METADATA NOT READY. PLEASE WAIT A MOMENT, THEN TRY EXPORT AGAIN.");
         }
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
        vid.playsInline = true;
        void vid.play().catch((err) => {
          console.warn('Webcam autoplay failed:', err);
        });
        await waitForVideoMetadata(vid, 4000);
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
    setExportStatusLabel('GENERATING MASTER...');
    setExportProgress(null);
    setIsExporting(true);

    setTimeout(async () => {
        try {
            const sourceDimensions = await resolveSourceDimensions(imageSource, 8000);
            if (!sourceDimensions) {
              alert("SOURCE DIMENSIONS ARE NOT READY. WAIT FOR VIDEO METADATA, THEN EXPORT AGAIN.");
              return;
            }
            const srcW = sourceDimensions.w;
            const srcH = sourceDimensions.h;
            const { finalW, finalH, renderW, renderH } = computeExportDimensions(
              srcW,
              srcH,
              selectedSize,
              dpi,
              exportFramingMode
            );

            const blob = await canvasHandleRef.current!.triggerStaticRender(renderW, renderH);
            if (blob) {
                let outputBlob: Blob = blob;

                if (selectedSize !== "SOURCE" && (renderW !== finalW || renderH !== finalH)) {
                  const outputCanvas = document.createElement('canvas');
                  outputCanvas.width = finalW;
                  outputCanvas.height = finalH;
                  const outCtx = outputCanvas.getContext('2d');
                  if (outCtx) {
                    if (config.transparentBackground) {
                      outCtx.clearRect(0, 0, finalW, finalH);
                    } else {
                      outCtx.fillStyle = config.palette[0] || '#000000';
                      outCtx.fillRect(0, 0, finalW, finalH);
                    }

                    const renderImg = await blobToImage(blob);
                    const drawX = Math.floor((finalW - renderW) * 0.5);
                    const drawY = Math.floor((finalH - renderH) * 0.5);
                    outCtx.drawImage(renderImg, drawX, drawY, renderW, renderH);
                    const composedBlob = await new Promise<Blob | null>((resolve) => outputCanvas.toBlob(resolve, 'image/png', 1.0));
                    if (composedBlob) outputBlob = composedBlob;
                  }
                }

                const url = URL.createObjectURL(outputBlob);
                const link = document.createElement('a');
                link.download = `astrit-MASTER-${selectedSize}-${dpi}-${selectedSize === 'SOURCE' ? 'SOURCE' : exportFramingMode}-${Date.now()}.png`;
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

  const handleExportGIF = async (selectedSize: string = "SOURCE") => {
    if (!imageSource || !canvasHandleRef.current) return;
    setExportStatusLabel('PREPARING GIF...');
    setExportProgress(0);
    setIsExporting(true);

    setTimeout(async () => {
      try {
        const sourceDimensions = await resolveSourceDimensions(imageSource, 8000);
        if (!sourceDimensions) {
          alert("SOURCE DIMENSIONS ARE NOT READY. WAIT FOR VIDEO METADATA, THEN EXPORT AGAIN.");
          return;
        }
        const srcW = sourceDimensions.w;
        const srcH = sourceDimensions.h;
        let { finalW, finalH, renderW, renderH } = computeExportDimensions(
          srcW,
          srcH,
          selectedSize,
          PrintDPI.SCREEN,
          exportFramingMode
        );

        if (config.renderEngine === RenderEngine.TEXTMODE) {
          const liveCanvas = canvasHandleRef.current?.getCanvas();
          if (!liveCanvas) throw new Error('Textmode canvas not ready for GIF export.');

          const MAX_GIF_SIDE = 640;
          const MAX_GIF_PIXELS = 640 * 640;
          let gifScale = Math.min(1, MAX_GIF_SIDE / Math.max(finalW, finalH));
          const pixelScale = Math.sqrt(MAX_GIF_PIXELS / Math.max(1, finalW * finalH));
          if (pixelScale < gifScale) gifScale = pixelScale;
          if (gifScale < 1) {
            finalW = Math.max(1, Math.round(finalW * gifScale));
            finalH = Math.max(1, Math.round(finalH * gifScale));
            renderW = Math.max(1, Math.round(renderW * gifScale));
            renderH = Math.max(1, Math.round(renderH * gifScale));
          }

          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = finalW;
          frameCanvas.height = finalH;
          const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
          if (!frameCtx) throw new Error('Could not create textmode GIF frame canvas.');

          if (config.transparentBackground) {
            frameCtx.clearRect(0, 0, finalW, finalH);
          } else {
            frameCtx.fillStyle = config.palette[0] || '#000000';
            frameCtx.fillRect(0, 0, finalW, finalH);
          }
          const drawX = Math.floor((finalW - renderW) * 0.5);
          const drawY = Math.floor((finalH - renderH) * 0.5);
          frameCtx.drawImage(liveCanvas, drawX, drawY, renderW, renderH);

          const fps = Math.max(1, Math.min(30, Math.round(gifFps)));
          const quality = Math.max(1, Math.min(30, Math.round(gifQuality)));
          const repeatSetting = gifRepeatCount <= 0 ? 0 : Math.max(0, Math.round(gifRepeatCount) - 1);
          const gif = new GIF({
            workers: 2,
            quality,
            workerScript: gifWorkerUrl,
            width: finalW,
            height: finalH,
            repeat: repeatSetting
          });
          gif.addFrame(frameCtx as unknown as CanvasRenderingContext2D, { copy: true, delay: Math.max(20, Math.round(1000 / fps)) });
          setExportStatusLabel('ENCODING GIF...');
          setExportProgress(0.5);

          const gifBlob = await new Promise<Blob>((resolve, reject) => {
            gif.on('progress', (progress: number) => setExportProgress(progress));
            gif.on('finished', (blob: Blob) => resolve(blob));
            try {
              gif.render();
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Textmode GIF render failed.'));
            }
          });

          const url = URL.createObjectURL(gifBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `astrit-GIF-textmode-${selectedSize}-${fps}fps-${Date.now()}.gif`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return;
        }

        const MAX_GIF_SIDE = 640;
        const MAX_GIF_PIXELS = 640 * 640;
        let gifScale = Math.min(1, MAX_GIF_SIDE / Math.max(finalW, finalH));
        const pixelScale = Math.sqrt(MAX_GIF_PIXELS / Math.max(1, finalW * finalH));
        if (pixelScale < gifScale) gifScale = pixelScale;
        if (gifScale < 1) {
          finalW = Math.max(1, Math.round(finalW * gifScale));
          finalH = Math.max(1, Math.round(finalH * gifScale));
          renderW = Math.max(1, Math.round(renderW * gifScale));
          renderH = Math.max(1, Math.round(renderH * gifScale));
        }

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = finalW;
        frameCanvas.height = finalH;
        const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
        if (!frameCtx) throw new Error('Could not create GIF frame canvas.');
        const renderCanvas = document.createElement('canvas');
        const gifEngine = new AsciiEngine(renderCanvas);

        const addRenderedFrame = (frameIndex: number) => {
          gifEngine.render(imageSource, config, renderW, renderH, frameIndex, undefined, undefined, false);

          if (config.transparentBackground) {
            frameCtx.clearRect(0, 0, finalW, finalH);
          } else {
            frameCtx.fillStyle = config.palette[0] || '#000000';
            frameCtx.fillRect(0, 0, finalW, finalH);
          }

          const drawX = Math.floor((finalW - renderW) * 0.5);
          const drawY = Math.floor((finalH - renderH) * 0.5);
          frameCtx.drawImage(renderCanvas, drawX, drawY, renderW, renderH);
        };

        const fps = Math.max(1, Math.min(30, Math.round(gifFps)));
        const quality = Math.max(1, Math.min(30, Math.round(gifQuality)));
        const delayMs = Math.max(20, Math.round(1000 / fps));
        const repeatSetting = gifRepeatCount <= 0 ? 0 : Math.max(0, Math.round(gifRepeatCount) - 1);

        const gif = new GIF({
          workers: 2,
          quality,
          workerScript: gifWorkerUrl,
          width: finalW,
          height: finalH,
          repeat: repeatSetting
        });

        const sourceVideo = imageSource instanceof HTMLVideoElement ? imageSource : null;
        const sourceVideoDuration =
          sourceVideo && !sourceVideo.srcObject && Number.isFinite(sourceVideo.duration) && sourceVideo.duration > 0
            ? sourceVideo.duration
            : null;

        if (sourceVideo && sourceVideoDuration) {
          const wasPaused = sourceVideo.paused;
          const originalTime = sourceVideo.currentTime;
          sourceVideo.pause();

          const captureLoops = Math.max(1, Math.round(gifSourceLoops));
          const totalDuration = sourceVideoDuration * captureLoops;
          const MAX_GIF_FRAMES = 120;
          let frameCount = Math.max(1, Math.round(totalDuration * fps));
          if (frameCount > MAX_GIF_FRAMES) {
            frameCount = MAX_GIF_FRAMES;
            alert(`GIF frame count capped to ${MAX_GIF_FRAMES} for performance. Reduce loops/FPS for longer exports.`);
          }
          setExportStatusLabel('CAPTURING GIF FRAMES...');

          for (let i = 0; i < frameCount; i++) {
            const timelinePos = (i / frameCount) * totalDuration;
            const sourceTime = Math.min(
              Math.max(0, timelinePos % sourceVideoDuration),
              Math.max(0, sourceVideoDuration - 0.001)
            );
            await seekVideoTo(sourceVideo, sourceTime);
            addRenderedFrame(i);
            gif.addFrame(frameCtx as unknown as CanvasRenderingContext2D, { copy: true, delay: delayMs });
            setExportProgress((i + 1) / Math.max(1, frameCount));
          }

          await seekVideoTo(sourceVideo, originalTime);
          if (!wasPaused) {
            void sourceVideo.play().catch((err) => console.warn('Video resume failed after GIF export:', err));
          }
        } else {
          addRenderedFrame(0);
          gif.addFrame(frameCtx as unknown as CanvasRenderingContext2D, { copy: true, delay: delayMs });
          setExportProgress(0.35);
        }

        const gifBlob = await new Promise<Blob>((resolve, reject) => {
          let settled = false;
          const timeoutId = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('GIF encoding timed out.'));
          }, 120000);

          gif.on('progress', (progress: number) => {
            setExportStatusLabel('ENCODING GIF...');
            setExportProgress(progress);
          });
          gif.on('finished', (blob: Blob) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(blob);
          });
          try {
            gif.render();
          } catch (error) {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            reject(error instanceof Error ? error : new Error('GIF render failed.'));
          }
        });

        const url = URL.createObjectURL(gifBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `astrit-GIF-${selectedSize}-${fps}fps-${Date.now()}.gif`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        console.error("GIF export failed:", e);
        alert("GIF export failed. Try lower loops/FPS or a smaller export size.");
      } finally {
        setIsExporting(false);
        setExportStatusLabel('GENERATING MASTER...');
        setExportProgress(null);
      }
    }, 100);
  };

  const handleExportText = async (selectedSize: string = "SOURCE") => {
    if (!imageSource || !canvasHandleRef.current) return;
    setExportStatusLabel('GENERATING ASCII TEXT...');
    setExportProgress(null);
    setIsExporting(true);

    setTimeout(async () => {
      try {
        const sourceDimensions = await resolveSourceDimensions(imageSource, 8000);
        if (!sourceDimensions) {
          alert("SOURCE DIMENSIONS ARE NOT READY. WAIT FOR VIDEO METADATA, THEN EXPORT AGAIN.");
          return;
        }

        const { renderW, renderH } = computeExportDimensions(
          sourceDimensions.w,
          sourceDimensions.h,
          selectedSize,
          PrintDPI.SCREEN,
          exportFramingMode
        );

        const asciiText = await canvasHandleRef.current!.exportText(renderW, renderH, config);
        if (!asciiText || asciiText.trim().length === 0) {
          alert("ASCII TEXT EXPORT FAILED: No glyph data generated.");
          return;
        }

        const blob = new Blob([asciiText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `astrit-ASCII-${config.mode}-${selectedSize}-${Date.now()}.txt`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        console.error("Text export failed:", e);
        alert("Text export failed. Try a lower resolution or different source.");
      } finally {
        setIsExporting(false);
        setExportStatusLabel('GENERATING MASTER...');
        setExportProgress(null);
      }
    }, 50);
  };

  const handleExportAnsi = async (selectedSize: string = "SOURCE") => {
    if (!imageSource || !canvasHandleRef.current) return;
    setExportStatusLabel('GENERATING ANSI TEXT...');
    setExportProgress(null);
    setIsExporting(true);

    setTimeout(async () => {
      try {
        const sourceDimensions = await resolveSourceDimensions(imageSource, 8000);
        if (!sourceDimensions) {
          alert("SOURCE DIMENSIONS ARE NOT READY. WAIT FOR VIDEO METADATA, THEN EXPORT AGAIN.");
          return;
        }

        const { renderW, renderH } = computeExportDimensions(
          sourceDimensions.w,
          sourceDimensions.h,
          selectedSize,
          PrintDPI.SCREEN,
          exportFramingMode
        );

        const ansiText = await canvasHandleRef.current!.exportAnsi(renderW, renderH, config);
        if (!ansiText || ansiText.trim().length === 0) {
          alert("ANSI EXPORT FAILED: No glyph data generated.");
          return;
        }

        const blob = new Blob([ansiText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `astrit-ANSI-${config.mode}-${selectedSize}-${Date.now()}.ans`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        console.error("ANSI export failed:", e);
        alert("ANSI export failed. Try a lower resolution or different source.");
      } finally {
        setIsExporting(false);
        setExportStatusLabel('GENERATING MASTER...');
        setExportProgress(null);
      }
    }, 50);
  };

  const handleExportTextBatch = async (selectedSize: string = "SOURCE") => {
    if (!imageSource || !canvasHandleRef.current) return;
    if (!(imageSource instanceof HTMLVideoElement)) {
      alert("TXT BATCH EXPORT REQUIRES A VIDEO SOURCE.");
      return;
    }
    if (imageSource.srcObject) {
      alert("TXT BATCH EXPORT REQUIRES AN IMPORTED VIDEO FILE (NOT LIVE WEBCAM).");
      return;
    }

    const sourceVideo = imageSource;
    if (!Number.isFinite(sourceVideo.duration) || sourceVideo.duration <= 0) {
      alert("VIDEO DURATION IS NOT READY. WAIT FOR METADATA, THEN EXPORT AGAIN.");
      return;
    }

    setExportStatusLabel('CAPTURING TXT FRAMES...');
    setExportProgress(0);
    setIsExporting(true);

    setTimeout(async () => {
      const wasPaused = sourceVideo.paused || sourceVideo.ended;
      const originalTime = Number.isFinite(sourceVideo.currentTime) ? sourceVideo.currentTime : 0;
      try {
        const sourceDimensions = await resolveSourceDimensions(sourceVideo, 8000);
        if (!sourceDimensions) {
          alert("SOURCE DIMENSIONS ARE NOT READY. WAIT FOR VIDEO METADATA, THEN EXPORT AGAIN.");
          return;
        }

        const { renderW, renderH } = computeExportDimensions(
          sourceDimensions.w,
          sourceDimensions.h,
          selectedSize,
          PrintDPI.SCREEN,
          exportFramingMode
        );

        const fps = Math.max(1, Math.min(30, Math.round(gifFps)));
        const loops = Math.max(1, Math.min(20, Math.round(gifSourceLoops)));
        const duration = sourceVideo.duration;
        let frameCount = Math.max(1, Math.ceil(duration * fps * loops));
        const MAX_TXT_BATCH_FRAMES = 240;
        if (frameCount > MAX_TXT_BATCH_FRAMES) {
          frameCount = MAX_TXT_BATCH_FRAMES;
          alert(`TXT batch frame count capped to ${MAX_TXT_BATCH_FRAMES} for performance. Reduce loops/FPS for longer exports.`);
        }

        sourceVideo.pause();
        await seekVideoTo(sourceVideo, 0);

        const chunks: string[] = [];
        chunks.push(`# ASTRIT TXT BATCH\n`);
        chunks.push(`# MODE=${config.mode}\n`);
        chunks.push(`# SIZE=${selectedSize}\n`);
        chunks.push(`# FPS=${fps}\n`);
        chunks.push(`# SOURCE_LOOPS=${loops}\n`);
        chunks.push(`# FRAMES=${frameCount}\n`);
        chunks.push(`# SOURCE_DURATION=${duration.toFixed(6)}\n\n`);

        for (let i = 0; i < frameCount; i++) {
          const sourceTime = (i / fps) % duration;
          await seekVideoTo(sourceVideo, sourceTime);
          const asciiText = await canvasHandleRef.current!.exportText(renderW, renderH, config);
          if (!asciiText) {
            throw new Error(`TXT frame export failed at frame ${i + 1}.`);
          }

          chunks.push(`----- FRAME ${String(i + 1).padStart(4, '0')} | T=${sourceTime.toFixed(3)}s -----\n`);
          chunks.push(asciiText);
          if (i < frameCount - 1) chunks.push('\n\f\n');
          setExportProgress((i + 1) / frameCount);
        }

        const blob = new Blob(chunks, { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `astrit-ASCII-BATCH-${selectedSize}-${fps}fps-${Date.now()}.txt`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        console.error("TXT batch export failed:", e);
        alert("TXT batch export failed. Try lower loops/FPS or a smaller output size.");
      } finally {
        try {
          await seekVideoTo(sourceVideo, originalTime);
          if (!wasPaused) {
            void sourceVideo.play().catch((err) => console.warn('Video resume failed after TXT batch export:', err));
          }
        } catch (restoreError) {
          console.warn('Could not restore video state after TXT batch export:', restoreError);
        }
        setIsExporting(false);
        setExportStatusLabel('GENERATING MASTER...');
        setExportProgress(null);
      }
    }, 100);
  };

  const handleContactSheet = async () => {
    if (!canvasHandleRef.current || !imageSource) return;
    setExportStatusLabel('GENERATING CONTACT SHEET...');
    setExportProgress(null);
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
          schemaVersion: SERIALIZATION_SCHEMA_VERSION,
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
              const project = JSON.parse(ev.target?.result as string) as Partial<ProjectFile> & Record<string, unknown>;
              const schemaVersion = toSchemaVersionSafe(project.schemaVersion, 0);
              warnIfFutureSchema(schemaVersion, 'project');
              if (project.config) {
                  setConfig(prev => sanitizeEngineConfig({ ...prev, ...project.config }, prev));
              }
              if (project.theme && isThemeMode(project.theme)) setTheme(project.theme);
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
          schemaVersion: SERIALIZATION_SCHEMA_VERSION,
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
              const preset = JSON.parse(ev.target?.result as string) as Partial<PresetFile> & { theme?: unknown } & Record<string, unknown>;
              const schemaVersion = toSchemaVersionSafe(preset.schemaVersion, 0);
              warnIfFutureSchema(schemaVersion, 'preset');
              if (preset.config) {
                  setConfig(prev => sanitizeEngineConfig({ ...prev, ...preset.config }, prev));
              }
              if (preset.theme && isThemeMode(preset.theme)) setTheme(preset.theme);
          } catch(err) {
              alert("Error loading preset JSON.");
          }
      };
      reader.readAsText(file);
  };

  const handleExportSVG = async () => { alert("SVG Export coming soon."); };
  const handleSocialCard = async () => { alert("Social Card currently unavailable."); };
  const handleShock = () => setShockTrigger(Date.now());
  const handleRendererUnavailable = useCallback((engine: RenderEngine, reason: string) => {
    setConfig((prev) => {
      if (engine === RenderEngine.TEXTMODE && prev.renderEngine === RenderEngine.TEXTMODE) {
        return { ...prev, renderEngine: RenderEngine.NATIVE };
      }
      return prev;
    });
    if (!rendererFallbackWarnedRef.current) {
      rendererFallbackWarnedRef.current = true;
      alert(`TEXTMODE DISABLED: ${reason} USING NATIVE RENDERER INSTEAD.`);
    }
  }, [setConfig]);
  const sourceVideoDuration = getRecordableVideoDuration();
  const canUseTimedRecording = sourceVideoDuration !== null;
  const openHelp = useCallback((anchor: 'overview' | 'troubleshooting' = 'overview') => {
    setHelpAnchor(anchor);
    setAppState(AppState.HELP);
  }, []);

  if (appState === AppState.LANDING) {
      return <LandingPage onStart={() => setAppState(AppState.STUDIO)} />;
  }

  if (appState === AppState.HELP) {
    return (
      <HelpPage
        onBackToLanding={() => setAppState(AppState.LANDING)}
        onOpenStudio={() => setAppState(AppState.STUDIO)}
        initialAnchor={helpAnchor}
      />
    );
  }

  return (
    <div className="relative flex h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-mono overflow-hidden transition-colors duration-500">
        <div className="lg:hidden absolute top-3 left-3 right-3 z-40 flex items-center justify-between gap-2">
            <button
              onClick={() => setMobilePanel((prev) => (prev === 'LEFT' ? null : 'LEFT'))}
              className="flex-1 h-10 px-3 bg-[var(--bg-panel)] border-2 border-[var(--border-panel)] text-[10px] uppercase flex items-center justify-center gap-2"
            >
              <ImageIcon size={14} />
              Source
            </button>
            <button
              onClick={() => setMobilePanel((prev) => (prev === 'RIGHT' ? null : 'RIGHT'))}
              className="flex-1 h-10 px-3 bg-[var(--bg-panel)] border-2 border-[var(--border-panel)] text-[10px] uppercase flex items-center justify-center gap-2"
            >
              <SlidersHorizontal size={14} />
              Controls
            </button>
            <button
              onClick={() => openHelp('overview')}
              className="h-9 w-9 bg-black/50 border border-[var(--border-module)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors flex items-center justify-center"
              aria-label="Open help manual"
              title="Open manual"
            >
              <BookOpen size={14} />
            </button>
            {mobilePanel && (
              <button
                onClick={() => setMobilePanel(null)}
                className="h-10 w-10 bg-[var(--bg-module)] border-2 border-[var(--border-module)] flex items-center justify-center"
                aria-label="Close panel"
              >
                <X size={14} />
              </button>
            )}
        </div>

        {mobilePanel && (
          <button
            onClick={() => setMobilePanel(null)}
            className="lg:hidden fixed inset-0 bg-black/70 z-40"
            aria-label="Close mobile panel backdrop"
          />
        )}

        <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[min(22rem,100vw)] transform transition-transform duration-200 ${mobilePanel === 'LEFT' ? 'translate-x-0' : '-translate-x-full'}`}>
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
        </div>

        <div className={`lg:hidden fixed inset-y-0 right-0 z-50 w-[min(22rem,100vw)] transform transition-transform duration-200 ${mobilePanel === 'RIGHT' ? 'translate-x-0' : 'translate-x-full'}`}>
            <RightPanel 
                config={config} setConfig={setConfig} brush={brush} setBrush={setBrush}
                onExport={handleExport} onExportHD={handleExportHD}
                onExportGIF={handleExportGIF}
                onExportText={handleExportText}
                onExportAnsi={handleExportAnsi}
                onExportTextBatch={handleExportTextBatch}
                onSocialCard={handleSocialCard} onContactSheet={handleContactSheet}
                onExportSVG={handleExportSVG} onShock={handleShock}
                onClearBrush={() => setClearBrushTrigger(Date.now())}
                onRecordVideo={handleRecordVideo} isRecording={isRecording}
                dpi={dpi} setDpi={setDpi} isExporting={isExporting}
                exportFramingMode={exportFramingMode}
                setExportFramingMode={setExportFramingMode}
                recordingDurationMode={recordingDurationMode}
                setRecordingDurationMode={setRecordingDurationMode}
                recordingLoops={recordingLoops}
                setRecordingLoops={setRecordingLoops}
                canUseTimedRecording={canUseTimedRecording}
                sourceVideoDuration={sourceVideoDuration}
                gifFps={gifFps}
                setGifFps={setGifFps}
                gifQuality={gifQuality}
                setGifQuality={setGifQuality}
                gifSourceLoops={gifSourceLoops}
                setGifSourceLoops={setGifSourceLoops}
                gifRepeatCount={gifRepeatCount}
                setGifRepeatCount={setGifRepeatCount}
            />
        </div>

        {isExporting && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn">
                <div className="w-64 h-2 bg-[var(--bg-panel)] mb-4 overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] duration-150"
                      style={{ width: exportProgress !== null ? `${Math.round(exportProgress * 100)}%` : '100%' }}
                    ></div>
                    {exportProgress === null && (
                      <div className="absolute inset-0 bg-[var(--accent)] animate-[shimmer_2s_infinite]"></div>
                    )}
                </div>
                <h3 className="text-[var(--accent)] font-['Rubik_Glitch'] text-3xl mb-2">{exportStatusLabel}</h3>
                {exportProgress !== null && (
                  <p className="text-[var(--text-secondary)] text-sm mb-1">{Math.round(exportProgress * 100)}%</p>
                )}
                <p className="text-[var(--text-secondary)] text-xs tracking-widest animate-pulse">DO NOT CLOSE TAB</p>
            </div>
        )}
        
        <div className="hidden lg:block">
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
        </div>

        <main className="flex-1 relative bg-[#000] flex items-center justify-center p-3 pt-16 lg:p-6 lg:pt-6 border-t-8 border-b-8 border-[var(--border-panel)] min-w-0">
            <button
              onClick={() => openHelp('overview')}
              className="hidden lg:flex absolute top-3 right-3 z-40 h-8 w-8 bg-black/45 border border-[var(--border-module)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] items-center justify-center transition-colors"
              aria-label="Open help manual"
              title="Open manual"
            >
              <BookOpen size={14} />
            </button>
            <div className="relative w-full h-full max-h-[90vh] border-2 sm:border-4 border-[var(--border-module)] bg-black rounded-lg overflow-hidden ring-2 sm:ring-4 ring-[var(--highlight)]/20 shadow-2xl">
                {!imageSource && brush === BrushType.NONE && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="text-center animate-pulse">
                            <h2 className="text-3xl sm:text-6xl text-[var(--border-module)] font-['Rubik_Glitch']">NO SIGNAL</h2>
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
                    onRendererUnavailable={handleRendererUnavailable}
                />
                <div className="absolute inset-0 scanline pointer-events-none opacity-30"></div>
                <div className="absolute inset-0 vignette pointer-events-none"></div>
                <div className="absolute inset-0 crt-flicker pointer-events-none opacity-5"></div>
            </div>

            <div className="hidden sm:block">
              <Mascot onOpenHelp={openHelp} />
            </div>
        </main>

        <div className="hidden lg:block">
        <RightPanel 
            config={config} setConfig={setConfig} brush={brush} setBrush={setBrush}
            onExport={handleExport} onExportHD={handleExportHD}
            onExportGIF={handleExportGIF}
            onExportText={handleExportText}
            onExportAnsi={handleExportAnsi}
            onExportTextBatch={handleExportTextBatch}
            onSocialCard={handleSocialCard} onContactSheet={handleContactSheet}
            onExportSVG={handleExportSVG} onShock={handleShock}
            onClearBrush={() => setClearBrushTrigger(Date.now())}
            onRecordVideo={handleRecordVideo} isRecording={isRecording}
            dpi={dpi} setDpi={setDpi} isExporting={isExporting}
            exportFramingMode={exportFramingMode}
            setExportFramingMode={setExportFramingMode}
            recordingDurationMode={recordingDurationMode}
            setRecordingDurationMode={setRecordingDurationMode}
            recordingLoops={recordingLoops}
            setRecordingLoops={setRecordingLoops}
            canUseTimedRecording={canUseTimedRecording}
            sourceVideoDuration={sourceVideoDuration}
            gifFps={gifFps}
            setGifFps={setGifFps}
            gifQuality={gifQuality}
            setGifQuality={setGifQuality}
            gifSourceLoops={gifSourceLoops}
            setGifSourceLoops={setGifSourceLoops}
            gifRepeatCount={gifRepeatCount}
            setGifRepeatCount={setGifRepeatCount}
        />
        </div>
    </div>
  );
}

