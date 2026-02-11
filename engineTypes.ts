
export enum AsciiMode {
  PICO_ASCII = 'PICO_ASCII',
  ANSI_BLOCK = 'ANSI_BLOCK',
  ULTRA_GLYPH = 'ULTRA_GLYPH',
  SEMANTIC = 'SEMANTIC',
  WIRE = 'WIRE',
  EMOJI = 'EMOJI',
  MATRIX = 'MATRIX',
  BINARY = 'BINARY',
  HEX = 'HEX',
  BRAILLE = 'BRAILLE',
  MORSE = 'MORSE',
  KATAKANA = 'KATAKANA',
  CIRCUIT = 'CIRCUIT',
  RUNIC = 'RUNIC',
  CRYSTAL = 'CRYSTAL',
  FLUID = 'FLUID',
  GLITCH = 'GLITCH',
  MATH = 'MATH',
  MUSIC = 'MUSIC',
  ARROWS = 'ARROWS',
  BUBBLE = 'BUBBLE',
  C64 = 'C64',
  NATURE = 'NATURE',
  FACES = 'FACES',
  WEATHER = 'WEATHER',
  SHADE = 'SHADE',
  SEISMIC = 'SEISMIC',
  DNA = 'DNA',
  SHAPES = 'SHAPES',
  ARCHITECT = 'ARCHITECT',
  ASTRO = 'ASTRO',
  HANDS = 'HANDS',
  DEVIL = 'DEVIL',
  ARABIC = 'ARABIC',
  HEBREW = 'HEBREW',
  ZEUS = 'ZEUS',
  CYBERPUNK = 'CYBERPUNK',
  QUADRANTS = 'QUADRANTS',
  TILES = 'TILES',
  CIRCLES = 'CIRCLES',
  LINES = 'LINES',
  PIPES = 'PIPES'
}

export enum BrushType {
  NONE = 'NONE',
  FLOWFIELD = 'FLOWFIELD',
  PULSE = 'PULSE',
  NOISE = 'NOISE',
  ERASER = 'ERASER',
  TEXT = 'TEXT',
  GLITCH = 'GLITCH',
  PIXELATE = 'PIXELATE'
}

export enum FontType {
  JETBRAINS = 'JetBrains Mono',
  IBM_PLEX = '"IBM Plex Mono"',
  SPACE_MONO = '"Space Mono"',
  GEIST = '"Geist Mono"',
  VT323 = 'VT323',
  DEC_TERMINAL = '"Share Tech Mono"',
  GLASS_TTY = '"Cousine"',
  TOPAZ_AMIGA = '"Anonymous Pro"',
  M5X7 = '"Micro 5"',
  GOHU_FONT = '"DotGothic16"',
  PIXEL_OP = '"Pixelify Sans"',
  PRESS_START = '"Press Start 2P"',
  SILKSCREEN = '"Silkscreen"',
  RUBIK_GLITCH = '"Rubik Glitch"',
  FUTURE = '"Audiowide"'
}

export enum AppState {
  LANDING = 'LANDING',
  STUDIO = 'STUDIO',
  HELP = 'HELP'
}

export enum ThemeMode {
  PICO = 'PICO',
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  TERMINAL = 'TERMINAL'
}

export enum ColorMode {
  MONO = 'MONO',
  GRADIENT = 'GRADIENT',
  FULL = 'FULL',
  QUANTIZED = 'QUANTIZED'
}

export enum DistortionMode {
  NONE = 'NONE',
  WAVE = 'WAVE',
  TWIST = 'TWIST',
  NOISE = 'NOISE',
  VHS = 'VHS'
}

export enum RenderEngine {
  NATIVE = 'NATIVE',
  TEXTMODE = 'TEXTMODE'
}

export enum DitheringMode {
  NONE = 'NONE',
  BAYER = 'BAYER',
  FLOYD = 'FLOYD'
}

export enum TemporalDiagnosticsMode {
  LUMA_DELTA = 'LUMA_DELTA',
  CHAR_LOCK = 'CHAR_LOCK',
  EDGE_STABILITY = 'EDGE_STABILITY',
  MOTION = 'MOTION'
}

export enum PrintDPI {
  SCREEN = 'SCREEN',
  PRINT = 'PRINT'
}

export enum PaperSize {
  SOURCE = 'SOURCE',
  A4 = 'A4',
  A3 = 'A3',
  A2 = 'A2',
  INSTAGRAM = 'INSTAGRAM'
}

export interface PostProcessConfig {
  blur: number;
  pixelate: number;
  invert: number;
  glow: number;
  saturation: number;
}

export interface CustomRampEntry {
  id: string;
  char: string;
  brightness: number;
  semanticValue: string;
}

export interface EngineConfig {
  renderEngine: RenderEngine;
  seed: number;
  resolution: number;
  density: number;
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
  lightness: number;
  gamma: number;
  dithering: number;
  ditheringMode: DitheringMode;
  colorizeDither: boolean;
  outlineEnabled: boolean;
  outlineSensitivity: number; 
  outlineColor: string;
  mode: AsciiMode;
  font: FontType;
  semanticWord: string;
  semanticRamp: boolean; 
  customRampEnabled: boolean;
  customSemanticMapping: boolean;
  customRampName: string;
  customRampEntries: CustomRampEntry[];
  temporalEnabled: boolean;
  temporalBlend: number;
  characterInertia: number;
  edgeTemporalStability: number;
  temporalDiagnosticsEnabled: boolean;
  temporalDiagnosticsMode: TemporalDiagnosticsMode;
  temporalDiagnosticsOpacity: number;
  adaptiveInertiaEnabled: boolean;
  adaptiveInertiaStrength: number;
  temporalGhostClamp: number;
  colorMode: ColorMode;
  paletteName: string;
  palette: string[];
  distortion: DistortionMode;
  distortionStrength: number;
  postProcess: PostProcessConfig;
  inverted: boolean;
  frameRate: number;
  transparentBackground: boolean;
}

export interface TemporalMetrics {
  lockRatio: number;
  meanLumaDelta: number;
  meanEdgeDelta: number;
  meanMotion: number;
}

export interface RenderMetrics {
  averageLuminance: number;
  density: number;
  entropy: number;
  dominantColor: string;
  temporal?: TemporalMetrics;
}

export interface AsciiCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  triggerStaticRender: (width: number, height: number, customConfig?: EngineConfig) => Promise<Blob | null>;
  generateSVG: (width: number, height: number) => Promise<Blob | null>;
  exportText: (width: number, height: number, customConfig?: EngineConfig) => Promise<string | null>;
}

export interface ProjectFile {
  version: string;
  schemaVersion?: number;
  config: EngineConfig;
  theme: ThemeMode;
  sourceImage?: string; // Base64
  timestamp: number;
}

export interface PresetFile {
  name: string;
  version: string;
  schemaVersion?: number;
  config: EngineConfig;
}

export const PICO_COLORS = {
  black: '#000000',
  darkBlue: '#1d2b53',
  darkPurple: '#7e2553',
  darkGreen: '#008751',
  brown: '#ab5236',
  darkGray: '#5f574f',
  lightGray: '#c2c3c7',
  white: '#fff1e8',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  green: '#00e436',
  blue: '#29adff',
  indigo: '#83769c',
  pink: '#ff77a8',
  peach: '#ffccaa',
};
