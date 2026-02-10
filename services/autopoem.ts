
import { RenderMetrics, AsciiMode } from '../engineTypes';

const createPRNG = (seed: number) => {
    return () => {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
};

const NOUNS = {
  base: ["VOID", "SIGNAL", "GHOST", "ECHO", "DATA", "FLUX", "GRID", "NODE", "PULSE", "CORE", "ENTITY", "SYSTEM"],
  organic: ["ROOT", "BLOOM", "VEIN", "SPORE", "MOSS", "TIDE", "WIND", "CELL", "LEAF", "BARK", "FOREST", "RIVER"],
  tech: ["MAINFRAME", "CIRCUIT", "PROXY", "DAEMON", "GLITCH", "VECTOR", "PIXEL", "BUFFER", "LINK", "CODE", "NET", "SERVER"],
  light: ["FLARE", "STAR", "DAWN", "WHITE", "RAY", "BEAM", "FLASH", "AURA", "PRISM", "PHOTON"],
  dark: ["ABYSS", "SHADOW", "NIGHT", "SILENCE", "DEPTH", "HOLE", "CAVE", "TOMB", "DREAD", "ONYX"],
  astro: ["ORBIT", "COMET", "NEBULA", "VOID", "STAR", "PLANET", "MOON", "GALAXY", "QUASAR", "EVENT_HORIZON"],
  occult: ["RITUAL", "SIGIL", "BLOOD", "BONE", "CURSE", "SPELL", "DEMON", "SPIRIT", "OMEN", "ALTAR"]
};

const VERBS = {
  base: ["HUMS", "DRIFTS", "FADES", "SHIFTS", "WAITS", "LOOPS", "GLOWS", "HOLDS", "TURNS", "BREATHES"],
  active: ["SCREAMS", "BREAKS", "BURNS", "TEARS", "RUNS", "FIGHTS", "SPIKES", "WARPS", "CRASHES", "HUNTS"],
  passive: ["SLEEPS", "FLOATS", "RESTS", "SINKS", "DREAMS", "STAYS", "HIDES", "NUMBS", "WATCHES", "LISTENS"]
};

const ADJECTIVES = {
  chaos: ["BROKEN", "JAGGED", "NOISY", "WILD", "SHARP", "CRASHED", "FRACTURED", "VIOLENT", "RAW", "UNSTABLE"],
  order: ["CALM", "STILL", "ALIGNED", "CLEAN", "PURE", "SMOOTH", "FIXED", "SILENT", "PERFECT", "SYNCED"],
  dark: ["DEEP", "HOLLOW", "LOST", "COLD", "EMPTY", "BLIND", "UNKNOWN", "DEAD", "FORGOTTEN"],
  light: ["BLINDING", "LUCID", "WARM", "SHARP", "VIVID", "CLEAR", "RADIANT", "HOLY", "ELECTRIC"]
};

const TEMPLATES = [
  "THE [ADJ] [NOUN] [VERB].",
  "[NOUN] [VERB] IN THE [ADJ] [NOUN].",
  "[ADJ] [NOUN]. [ADJ] [NOUN].",
  "WHEN THE [NOUN] [VERB], THE [NOUN] [VERB].",
  "[VERB] THE [NOUN].",
  "A [ADJ] [NOUN] OF [NOUN].",
  "BEYOND THE [NOUN], [NOUN] [VERB].",
  "SYSTEM DETECTED: [ADJ] [NOUN].",
  "[NOUN] IS [ADJ]. [NOUN] IS [ADJ]."
];

export class AutopoemService {
    
    private static getRandom(arr: string[], rng: () => number): string {
        if (!arr || arr.length === 0) return "DATA";
        return arr[Math.floor(rng() * arr.length)];
    }

    public static generate(metrics: RenderMetrics, mode: AsciiMode, seed: number): string {
        if (!metrics) return "SCANNING...";
        
        const rng = createPRNG(seed);
        const isBright = metrics.averageLuminance > 0.5;
        const isDark = metrics.averageLuminance < 0.2;
        const isChaotic = metrics.entropy > 0.15;
        
        let nouns = [...NOUNS.base];
        let verbs = [...VERBS.base];
        let adjs = isChaotic ? [...ADJECTIVES.chaos] : [...ADJECTIVES.order];

        if ([AsciiMode.NATURE, AsciiMode.FLUID, AsciiMode.CRYSTAL, AsciiMode.WEATHER].includes(mode)) {
            nouns = [...nouns, ...NOUNS.organic];
        } else if ([AsciiMode.MATRIX, AsciiMode.BINARY, AsciiMode.HEX, AsciiMode.CIRCUIT, AsciiMode.GLITCH].includes(mode)) {
            nouns = [...nouns, ...NOUNS.tech];
        } else if (mode === AsciiMode.ASTRO) {
            nouns = [...nouns, ...NOUNS.astro];
            adjs = [...adjs, ...ADJECTIVES.light];
        } else if (mode === AsciiMode.DEVIL) {
            nouns = [...nouns, ...NOUNS.occult];
            adjs = [...adjs, ...ADJECTIVES.dark, ...ADJECTIVES.chaos];
        }

        if (isBright) {
            nouns = [...nouns, ...NOUNS.light];
            adjs = [...adjs, ...ADJECTIVES.light];
        } else if (isDark) {
            nouns = [...nouns, ...NOUNS.dark];
            adjs = [...adjs, ...ADJECTIVES.dark];
        }

        if (metrics.entropy > 0.1) {
             verbs = [...verbs, ...VERBS.active];
        } else {
             verbs = [...verbs, ...VERBS.passive];
        }

        const template = this.getRandom(TEMPLATES, rng);
        
        return template.replace(/\[(\w+)\]/g, (match, type) => {
            switch(type) {
                case 'NOUN': return this.getRandom(nouns, rng);
                case 'VERB': return this.getRandom(verbs, rng);
                case 'ADJ': return this.getRandom(adjs, rng);
                default: return "DATA";
            }
        });
    }
}

