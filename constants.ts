
import { PICO_COLORS, FontType, ThemeMode, ColorMode, DistortionMode, DitheringMode, CustomRampEntry, TemporalDiagnosticsMode, RenderEngine } from './engineTypes';
import type { PostProcessConfig } from './engineTypes';

export const ENGINE_VERSION = "3.5.0";
export const SERIALIZATION_SCHEMA_VERSION = 1;

export const ASCII_RAMPS = {
  standard: " .:-=+*#%@",
  dense: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
  blocks: " ░▒▓█",
  wire: " .`'-,|/_\\",
  emoji: " 😶😐🙂😊😀😄😁😆😂🤣",
  ultra: " ⚡️★✦❂❉❄︎☻☹☯⚙⚔⚓︎",
  // Tech
  matrix: " 0123456789abcdefghijklmnopqrstuvwxyz", 
  binary: " 01",
  hex: " 0123456789ABCDEF",
  braille: " ⠀⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿",
  morse: "  . -",
  katakana: " ｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ",
  circuit: " ╸╹╺╻┏┓┗┛┣┫┳┻╋",
  runic: " ᚠᚡᚢᚣᚤᚥᚦᚧᚨᚩᚪᚫᚬᚭᚮᚯᚰᚱᚲᚳᚴᚵᚶᚷᚸᚹᚺᚻᚼᚽᚾᚿᛀ",
  crystal: " ✧✶✴✸✹✺✻✼✽✾✿❀❁",
  fluid: " ░▒▓█▓▒░ ",
  glitch: " ▂▃▄▅▆▇█▀▄▌▐",
  // Creative
  math: " ·−+×÷=≈≠≤≥∞∫∑∏∂√∆∇",
  music: "  ♩♪♫♭♮♯",
  arrows: "  ←↑→↓↔↕↖↗↘↙",
  bubble: "  ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ",
  c64: " ♠♣♥♦○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼",
  nature: " .`',~-≈^v\\/|Y()*+xoO0#%@░▒▓█",
  faces: "  ☺☻☹",
  weather: "  ☀☁☂☃☄★☆",
  shade: " ░▒▓█",
  // New V4
  seismic: "  _.-~^~-.",
  dna: "  ATGC",
  shapes: "  ▲▼◄►■●",
  architect: "  └┴┐┤│─┼",
  // New V5
  astro: " .`*+oO@★☆☾☽☀☼🪐☄🌌",
  hands: "  👇👆👉👈👌👍👊✋👋🖖🤘🤙🙌👐👐🤲🙏",
  devil: " .:;+=*xX#@†‡ψ☽☉☠",
  // New V6 (Refined Cultural Ramps)
  arabic: "  .٫٬،ـله؏؎۩۞",
  hebrew: "  .'`יוןךדלרחבהגקםתסעאפמטשצ",
  zeus: " .·ιΙτγυνορπζεκδλθψφξΔΛΓΠΣΩΘΨΦΞ",
  // New V7
  cyberpunk: "  _.-=+<{}[];:/|!@#$%\^&*",
  quadrants: " ▖▗▘▙▚▛▜▝▞▟█",
  tiles: "  ▄▀█",
  circles: "  ○◔◑◕●",
  lines: "  │║",
  pipes: "  ═║╔╗╚╝╠╣╦╩╬"
};

export const BAYER_MATRIX_4x4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

export const PICO_PALETTE_ARRAY = Object.values(PICO_COLORS);

export const COLOR_PALETTES: Record<string, string[]> = {
    PICO_8: PICO_PALETTE_ARRAY,
    GAMEBOY: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    CGA: ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
    MACINTOSH: ['#000000', '#ffffff'],
    VAPORWAVE: ['#2e2157', '#912788', '#f52e92', '#58d9ea', '#e8f3a9'],
    THERMAL: ['#000000', '#0000ff', '#8800ff', '#ff0000', '#ffff00', '#ffffff'],
    CYBERPUNK: ['#0d0221', '#2de2e6', '#fd3a69', '#f6019d', '#ff0055', '#791e94'],
    MATRIX: ['#000000', '#003b00', '#008f11', '#00ff41', '#ccffcc'],
    PAPER: ['#282828', '#ebdbb2', '#cc241d', '#98971a', '#d79921', '#458588'],
    AMBER: ['#000000', '#331a00', '#663300', '#cc6600', '#ffb000', '#ffcc00'],
    SUNSET: ['#2d1b33', '#7c3f58', '#eb6a24', '#fdaa69', '#ffccaa'],
    FOREST: ['#061a12', '#1b4d2e', '#408040', '#90b060', '#e0f0b0'],
    NEON: ['#0a001a', '#400080', '#c000c0', '#ff0080', '#ff80c0'],
    NIGHT: ['#000020', '#101040', '#303080', '#6060c0', '#a0a0ff'],
    DESERT: ['#3e2723', '#5d4037', '#8d6e63', '#d7ccc8', '#efebe9']
};

export const DEFAULT_SEMANTIC_WORD = "ASTRIT";

export const DEFAULT_CUSTOM_RAMP: CustomRampEntry[] = [
  { id: 'default-space', char: ' ', brightness: 0, semanticValue: 'void' },
  { id: 'default-dot', char: '.', brightness: 0.2, semanticValue: 'soft' },
  { id: 'default-colon', char: ':', brightness: 0.4, semanticValue: 'mid' },
  { id: 'default-star', char: '*', brightness: 0.6, semanticValue: 'edge' },
  { id: 'default-hash', char: '#', brightness: 0.8, semanticValue: 'solid' },
  { id: 'default-at', char: '@', brightness: 1, semanticValue: 'ink' }
];

export const DEFAULT_POST_PROCESS: PostProcessConfig = {
    blur: 0,
    pixelate: 1,
    invert: 0,
    glow: 0,
    saturation: 1
};

export const PRESETS = {
  DEFAULT: {
    renderEngine: RenderEngine.NATIVE,
    seed: 42,
    mode: 'PICO_ASCII',
    resolution: 12,
    density: 1,
    brightness: 1.0,
    contrast: 1.0,
    hue: 0,
    saturation: 1.0,
    lightness: 1.0,
    gamma: 1.0,
    dithering: 0,
    ditheringMode: DitheringMode.BAYER,
    colorizeDither: false,
    outlineEnabled: false,
    outlineSensitivity: 0.2,
    outlineColor: '#29adff',
    colorMode: ColorMode.FULL,
    paletteName: 'PICO_8',
    palette: PICO_PALETTE_ARRAY,
    distortion: DistortionMode.NONE,
    distortionStrength: 0,
    inverted: false,
    semanticWord: DEFAULT_SEMANTIC_WORD,
    customRampEnabled: false,
    customSemanticMapping: false,
    customRampName: 'DEFAULT_CUSTOM',
    customRampEntries: DEFAULT_CUSTOM_RAMP,
    temporalEnabled: false,
    temporalBlend: 0.35,
    characterInertia: 0.35,
    edgeTemporalStability: 0.2,
    temporalDiagnosticsEnabled: false,
    temporalDiagnosticsMode: TemporalDiagnosticsMode.LUMA_DELTA,
    temporalDiagnosticsOpacity: 0.35,
    adaptiveInertiaEnabled: true,
    adaptiveInertiaStrength: 0.55,
    temporalGhostClamp: 0.45,
    font: FontType.JETBRAINS,
    postProcess: { ...DEFAULT_POST_PROCESS },
    transparentBackground: false,
    frameRate: 30
  }
};

export const THEMES: Record<string, Record<string, string>> = {
  [ThemeMode.PICO]: {
    '--bg-app': '#050505',
    '--bg-panel': '#1d2b53',
    '--bg-module': '#000000',
    '--border-panel': '#ab5236',
    '--border-module': '#5f574f',
    '--text-primary': '#fff1e8',
    '--text-secondary': '#c2c3c7',
    '--text-muted': '#83769c',
    '--accent': '#ff004d',
    '--accent-hover': '#ff77a8',
    '--text-on-accent': '#fff1e8',
    '--highlight': '#ffec27',
    '--shadow-color': 'rgba(0,0,0,0.6)',
  },
  [ThemeMode.LIGHT]: {
    '--bg-app': '#e0e0e0',
    '--bg-panel': '#f5f5f5',
    '--bg-module': '#ffffff',
    '--border-panel': '#999999',
    '--border-module': '#cccccc',
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#4a4a4a',
    '--text-muted': '#888888',
    '--accent': '#000000',
    '--accent-hover': '#333333',
    '--text-on-accent': '#ffffff',
    '--highlight': '#007aff',
    '--shadow-color': 'rgba(0,0,0,0.1)',
  },
  [ThemeMode.DARK]: {
    '--bg-app': '#000000',
    '--bg-panel': '#0a0a0a',
    '--bg-module': '#141414',
    '--border-panel': '#222222',
    '--border-module': '#333333',
    '--text-primary': '#ffffff',
    '--text-secondary': '#999999',
    '--text-muted': '#666666',
    '--accent': '#ffffff',
    '--accent-hover': '#dddddd',
    '--text-on-accent': '#000000',
    '--highlight': '#ff004d',
    '--shadow-color': 'rgba(0,0,0,0.8)',
  },
  [ThemeMode.TERMINAL]: {
    '--bg-app': '#000000',
    '--bg-panel': '#001a00',
    '--bg-module': '#000800',
    '--border-panel': '#00ff41',
    '--border-module': '#008f11',
    '--text-primary': '#00ff41',
    '--text-secondary': '#008f11',
    '--text-muted': '#003b00',
    '--accent': '#00ff41',
    '--accent-hover': '#ccffcc',
    '--text-on-accent': '#000000',
    '--highlight': '#00ff41',
    '--shadow-color': 'rgba(0,255,65,0.2)',
  }
};

export const PAPER_DIMENSIONS: Record<string, { w: number, h: number }> = {
  SOURCE: { w: 0, h: 0 },
  A4: { w: 2480, h: 3508 },
  A3: { w: 3508, h: 4961 },
  A2: { w: 4961, h: 7016 },
  INSTAGRAM: { w: 1080, h: 1080 }
};

export const DPI_MULTIPLIERS = {
  SCREEN: 1,
  PRINT: 2
};

export const MASCOT_FRAMES = {
  IDLE: ["(•‿•)", "(o‿o)"],
  HAPPY: "(^‿^)",
  SURPRISED: "(o_o)",
  ANGRY: "(>_<)",
  SLEEP: ["(u_u)", "(z_z)"]
};

