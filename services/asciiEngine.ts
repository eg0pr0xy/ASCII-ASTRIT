import { AsciiMode, EngineConfig, ColorMode, DistortionMode, RenderMetrics, DitheringMode } from '../engineTypes';
import { ASCII_RAMPS, BAYER_MATRIX_4x4 } from '../constants';

type RGB = { r: number; g: number; b: number };

const SOBEL_MAX_MAGNITUDE = 4 * Math.sqrt(2);

/**
 * Fast coordinate-based hash for deterministic noise.
 * Returns a float between 0 and 1.
 */
const hash3 = (x: number, y: number, z: number): number => {
  let h = (x * 12345) ^ (y * 67890) ^ (z * 13579);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

export class AsciiEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private compositionBuffer: HTMLCanvasElement;
  private compCtx: CanvasRenderingContext2D;

  private gradedBuffer = new Float32Array(0);
  private lumaBuffer = new Float32Array(0);
  private edgeMagnitude = new Float32Array(0);
  private edgeAngle = new Float32Array(0);
  private prevLumaBuffer = new Float32Array(0);
  private prevEdgeMagnitude = new Float32Array(0);
  private prevCharGrid: string[] = [];

  private hexCache = new Map<string, RGB>();
  private paletteCache = new Map<string, RGB[]>();
  private gradientLutCache = new Map<string, string[]>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;

    this.offscreen = document.createElement('canvas');
    const offContext = this.offscreen.getContext('2d', { willReadFrequently: true });
    if (!offContext) throw new Error('Could not get offscreen context');
    this.offCtx = offContext;

    this.compositionBuffer = document.createElement('canvas');
    const compCtx = this.compositionBuffer.getContext('2d', { alpha: true });
    if (!compCtx) throw new Error('Could not get composition context');
    this.compCtx = compCtx;
  }

  private ensureFloatBuffer(current: Float32Array, length: number): Float32Array {
    return current.length === length ? current : new Float32Array(length);
  }

  private paletteKey(palette: string[]): string {
    return palette.join('|');
  }

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const rr = Math.max(0, Math.min(255, Math.round(r)));
    const gg = Math.max(0, Math.min(255, Math.round(g)));
    const bb = Math.max(0, Math.min(255, Math.round(b)));
    return `#${((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
  }

  private hexToRgb(hex: string): RGB {
    const key = hex.toLowerCase();
    const cached = this.hexCache.get(key);
    if (cached) return cached;

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(key);
    const rgb = result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 0, g: 0, b: 0 };
    this.hexCache.set(key, rgb);
    return rgb;
  }

  private getPaletteRgb(palette: string[]): RGB[] {
    const key = this.paletteKey(palette);
    const cached = this.paletteCache.get(key);
    if (cached) return cached;
    const rgbPalette = palette.map((hex) => this.hexToRgb(hex));
    this.paletteCache.set(key, rgbPalette);
    return rgbPalette;
  }

  private getGradientLut(palette: string[]): string[] {
    const key = this.paletteKey(palette);
    const cached = this.gradientLutCache.get(key);
    if (cached) return cached;

    const lut = new Array<string>(256);
    if (!palette.length) {
      lut.fill('#ffffff');
      this.gradientLutCache.set(key, lut);
      return lut;
    }

    if (palette.length === 1) {
      lut.fill(palette[0]);
      this.gradientLutCache.set(key, lut);
      return lut;
    }

    const rgbPalette = this.getPaletteRgb(palette);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const scaled = t * (rgbPalette.length - 1);
      const idx = Math.floor(scaled);
      const factor = scaled - idx;
      const c1 = rgbPalette[idx];
      const c2 = rgbPalette[Math.min(idx + 1, rgbPalette.length - 1)];
      const r = c1.r + (c2.r - c1.r) * factor;
      const g = c1.g + (c2.g - c1.g) * factor;
      const b = c1.b + (c2.b - c1.b) * factor;
      lut[i] = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    }

    this.gradientLutCache.set(key, lut);
    return lut;
  }

  private findNearestColor(r: number, g: number, b: number, palette: string[], paletteRgb: RGB[]): string {
    let minDist = Infinity;
    let nearest = palette[0] || '#000000';
    for (let i = 0; i < paletteRgb.length; i++) {
      const c = paletteRgb[i];
      const dr = r - c.r;
      const dg = g - c.g;
      const db = b - c.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        nearest = palette[i];
      }
    }
    return nearest;
  }

  private getRamp(mode: AsciiMode): string {
    const ramp = ASCII_RAMPS[mode.toLowerCase() as keyof typeof ASCII_RAMPS];
    return ramp || ASCII_RAMPS.standard;
  }

  private getCustomRampEntries(config: EngineConfig): Array<{ char: string; brightness: number; semanticValue: string }> {
    if (!config.customRampEnabled || !Array.isArray(config.customRampEntries)) return [];
    return config.customRampEntries
      .filter((entry) => entry && typeof entry.char === 'string' && entry.char.length > 0)
      .map((entry) => ({
        char: entry.char.slice(0, 1),
        brightness: this.clamp01(typeof entry.brightness === 'number' ? entry.brightness : 0),
        semanticValue: typeof entry.semanticValue === 'string' ? entry.semanticValue : ''
      }))
      .sort((a, b) => a.brightness - b.brightness);
  }

  private getCharFromCustomRamp(
    brightness: number,
    entries: Array<{ char: string; brightness: number; semanticValue: string }>,
    inverted: boolean
  ): string {
    if (!entries.length) return ' ';

    const target = inverted ? 1 - brightness : brightness;
    const b = this.clamp01(target);
    let best = entries[0];
    let minDist = Math.abs(entries[0].brightness - b);
    for (let i = 1; i < entries.length; i++) {
      const dist = Math.abs(entries[i].brightness - b);
      if (dist < minDist) {
        minDist = dist;
        best = entries[i];
      }
    }
    return best.char;
  }

  private parseSemanticTokens(input: string): string[] {
    const normalized = (input || '').trim();
    if (!normalized) return [];

    if (/[,\s]/.test(normalized)) {
      const tokens = normalized
        .split(/[,\s]+/)
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean);
      if (tokens.length > 0) return tokens;
    }

    return normalized.split('').map((token) => token.toLowerCase());
  }

  private getSemanticMappedChar(
    brightness: number,
    x: number,
    y: number,
    entries: Array<{ char: string; brightness: number; semanticValue: string }>,
    tokens: string[],
    semanticRamp: boolean,
    inverted: boolean
  ): string | null {
    if (!entries.length) return null;
    if (!tokens.length) return null;

    const tokenIndex = semanticRamp
      ? Math.floor(this.clamp01(inverted ? 1 - brightness : brightness) * (tokens.length - 1))
      : (x + y) % tokens.length;
    const token = tokens[Math.max(0, Math.min(tokenIndex, tokens.length - 1))];

    const matched = entries.find((entry) => (entry.semanticValue || '').trim().toLowerCase() === token);
    if (matched) return matched.char;
    return null;
  }

  private applyTemporalBlend(current: Float32Array, previous: Float32Array, blend: number): void {
    const amount = this.clamp01(blend);
    if (amount <= 0 || current.length !== previous.length) return;
    const keepCurrent = 1 - amount;
    for (let i = 0; i < current.length; i++) {
      current[i] = current[i] * keepCurrent + previous[i] * amount;
    }
  }

  private applyGrading(data: Uint8ClampedArray, target: Float32Array, config: EngineConfig): void {
    const pixelCount = data.length / 4;
    const { brightness, contrast, hue, saturation, lightness, gamma } = config;
    const invGamma = 1 / Math.max(0.0001, gamma);

    const cosH = Math.cos((hue * Math.PI) / 180);
    const sinH = Math.sin((hue * Math.PI) / 180);
    const s = Math.sqrt(1.0 / 3.0);
    const mat = [
      cosH + (1.0 - cosH) / 3.0,
      ((1.0 - cosH) / 3.0) - s * sinH,
      ((1.0 - cosH) / 3.0) + s * sinH,
      ((1.0 - cosH) / 3.0) + s * sinH,
      cosH + ((1.0 - cosH) / 3.0),
      ((1.0 - cosH) / 3.0) - s * sinH,
      ((1.0 - cosH) / 3.0) - s * sinH,
      ((1.0 - cosH) / 3.0) + s * sinH,
      cosH + ((1.0 - cosH) / 3.0)
    ];

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      let r = data[idx] / 255;
      let g = data[idx + 1] / 255;
      let b = data[idx + 2] / 255;

      r = (r - 0.5) * contrast + 0.5 + (brightness - 1);
      g = (g - 0.5) * contrast + 0.5 + (brightness - 1);
      b = (b - 0.5) * contrast + 0.5 + (brightness - 1);

      const tr = r * mat[0] + g * mat[1] + b * mat[2];
      const tg = r * mat[3] + g * mat[4] + b * mat[5];
      const tb = r * mat[6] + g * mat[7] + b * mat[8];
      r = tr;
      g = tg;
      b = tb;

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;

      r *= lightness;
      g *= lightness;
      b *= lightness;

      r = Math.pow(Math.max(0, r), invGamma);
      g = Math.pow(Math.max(0, g), invGamma);
      b = Math.pow(Math.max(0, b), invGamma);

      target[idx] = this.clamp01(r);
      target[idx + 1] = this.clamp01(g);
      target[idx + 2] = this.clamp01(b);
      target[idx + 3] = data[idx + 3] / 255;
    }
  }

  private applyFloydSteinbergRGB(
    buffer: Float32Array,
    cols: number,
    rows: number,
    strength: number,
    quantizeBaseBuffer: boolean,
    palette: string[],
    paletteRgb: RGB[]
  ): void {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 4;
        const r = buffer[idx];
        const g = buffer[idx + 1];
        const b = buffer[idx + 2];

        const hex = this.findNearestColor(r * 255, g * 255, b * 255, palette, paletteRgb);
        const rgb = this.hexToRgb(hex);
        const nr = rgb.r / 255;
        const ng = rgb.g / 255;
        const nb = rgb.b / 255;

        const er = (r - nr) * strength;
        const eg = (g - ng) * strength;
        const eb = (b - nb) * strength;

        if (quantizeBaseBuffer) {
          buffer[idx] = nr;
          buffer[idx + 1] = ng;
          buffer[idx + 2] = nb;
        }

        if (x + 1 < cols) {
          const n = idx + 4;
          buffer[n] += er * (7 / 16);
          buffer[n + 1] += eg * (7 / 16);
          buffer[n + 2] += eb * (7 / 16);
        }
        if (y + 1 < rows) {
          const rowOffset = cols * 4;
          if (x > 0) {
            const n = idx + rowOffset - 4;
            buffer[n] += er * (3 / 16);
            buffer[n + 1] += eg * (3 / 16);
            buffer[n + 2] += eb * (3 / 16);
          }
          {
            const n = idx + rowOffset;
            buffer[n] += er * (5 / 16);
            buffer[n + 1] += eg * (5 / 16);
            buffer[n + 2] += eb * (5 / 16);
          }
          if (x + 1 < cols) {
            const n = idx + rowOffset + 4;
            buffer[n] += er * (1 / 16);
            buffer[n + 1] += eg * (1 / 16);
            buffer[n + 2] += eb * (1 / 16);
          }
        }
      }
    }
  }

  private applyFloydSteinbergLuma(buffer: Float32Array, cols: number, rows: number, strength: number): void {
    const steps = 8;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const oldVal = buffer[idx];
        const newVal = Math.round(oldVal * steps) / steps;
        const err = (oldVal - newVal) * strength;
        buffer[idx] = newVal;

        if (x + 1 < cols) buffer[idx + 1] += err * (7 / 16);
        if (y + 1 < rows) {
          const nextRow = idx + cols;
          if (x > 0) buffer[nextRow - 1] += err * (3 / 16);
          buffer[nextRow] += err * (5 / 16);
          if (x + 1 < cols) buffer[nextRow + 1] += err * (1 / 16);
        }
      }
    }
  }

  private computeEdgeData(buf: Float32Array, cols: number, rows: number): { magnitude: Float32Array; angle: Float32Array } {
    const len = cols * rows;
    this.edgeMagnitude = this.ensureFloatBuffer(this.edgeMagnitude, len);
    this.edgeAngle = this.ensureFloatBuffer(this.edgeAngle, len);

    this.edgeMagnitude.fill(0);
    this.edgeAngle.fill(0);

    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const idx = y * cols + x;
        const gx =
          -buf[(y - 1) * cols + (x - 1)] +
          buf[(y - 1) * cols + (x + 1)] +
          -2 * buf[y * cols + (x - 1)] +
          2 * buf[y * cols + (x + 1)] +
          -buf[(y + 1) * cols + (x - 1)] +
          buf[(y + 1) * cols + (x + 1)];
        const gy =
          -buf[(y - 1) * cols + (x - 1)] +
          -2 * buf[(y - 1) * cols + x] +
          -buf[(y - 1) * cols + (x + 1)] +
          buf[(y + 1) * cols + (x - 1)] +
          2 * buf[(y + 1) * cols + x] +
          buf[(y + 1) * cols + (x + 1)];
        this.edgeMagnitude[idx] = Math.sqrt(gx * gx + gy * gy);
        this.edgeAngle[idx] = Math.atan2(gy, gx);
      }
    }
    return { magnitude: this.edgeMagnitude, angle: this.edgeAngle };
  }

  private getChar(
    brightness: number,
    config: EngineConfig,
    x: number,
    y: number,
    frameIndex: number,
    customRampEntries: Array<{ char: string; brightness: number; semanticValue: string }>,
    semanticTokens: string[]
  ): string {
    const mode = config.mode;
    const hasCustomRamp = customRampEntries.length > 0;

    if (mode === AsciiMode.SEMANTIC) {
      if (hasCustomRamp) {
        const semanticChar = config.customSemanticMapping
          ? this.getSemanticMappedChar(
              brightness,
              x,
              y,
              customRampEntries,
              semanticTokens,
              config.semanticRamp,
              config.inverted
            )
          : null;
        if (semanticChar) return semanticChar;
        return this.getCharFromCustomRamp(brightness, customRampEntries, config.inverted);
      }

      const word = config.semanticWord || 'ASTRIT';
      if (word.length === 0) return ' ';

      if (config.semanticRamp) {
        const b = config.inverted ? 1.0 - brightness : brightness;
        const index = Math.floor(b * (word.length - 1));
        return word[Math.max(0, Math.min(index, word.length - 1))];
      }

      const threshold = 0.4;
      if (config.inverted ? brightness > 1 - threshold : brightness < threshold) return ' ';
      return word[(x + y) % word.length];
    }

    if (mode === AsciiMode.MATRIX) {
      if (brightness < 0.1) return ' ';
      const ramp = ASCII_RAMPS.katakana;
      const pxHash = hash3(x, y, config.seed);
      const columnSpeed = hash3(x, 0, config.seed) * 0.5 + 0.2;
      const signal = Math.sin(y * 0.1 - frameIndex * (0.08 * columnSpeed) + config.seed);
      if (pxHash > 0.1 + brightness * 0.6 + signal * 0.1) return ' ';
      const charIndex = Math.floor(pxHash * ramp.length);
      return ramp[charIndex % ramp.length];
    }

    if (mode === AsciiMode.ANSI_BLOCK) {
      if (hasCustomRamp) {
        return this.getCharFromCustomRamp(brightness, customRampEntries, config.inverted);
      }
      let b = brightness;
      if (!config.inverted) b = Math.pow(b, 0.8);
      b = this.clamp01((b - 0.5) * 1.15 + 0.5);
      const ramp = ASCII_RAMPS.blocks;
      const index = Math.floor(b * (ramp.length - 1));
      return ramp[Math.max(0, Math.min(index, ramp.length - 1))];
    }

    if (hasCustomRamp) {
      return this.getCharFromCustomRamp(brightness, customRampEntries, config.inverted);
    }

    const ramp = this.getRamp(mode);
    const b = config.inverted ? 1.0 - brightness : brightness;
    const index = Math.floor(b * (ramp.length - 1));
    return ramp[Math.max(0, Math.min(index, ramp.length - 1))];
  }

  public render(
    source: CanvasImageSource | null,
    config: EngineConfig,
    width: number,
    height: number,
    frameIndex: number,
    brushCanvas?: HTMLCanvasElement,
    shockProgress?: number
  ): { charCounts: Record<string, number>; metrics: RenderMetrics } {
    if (!source && !brushCanvas) {
      return { charCounts: {}, metrics: { averageLuminance: 0, density: 0, entropy: 0, dominantColor: '#000000' } };
    }

    const shockDecay = shockProgress !== undefined && shockProgress >= 0 ? Math.max(0, 1 - shockProgress) : 0;
    const shockIntensity = shockDecay * shockDecay;

    const MAX_DIM = 8192;
    const renderW = Math.max(1, Math.min(Math.floor(width), MAX_DIM));
    const renderH = Math.max(1, Math.min(Math.floor(height), MAX_DIM));

    if (this.canvas.width !== renderW || this.canvas.height !== renderH) {
      this.canvas.width = renderW;
      this.canvas.height = renderH;
    }

    const pixelFactor = Math.max(1, Math.floor(config.postProcess.pixelate || 1));
    const cw = Math.max(1, Math.floor(renderW / pixelFactor));
    const ch = Math.max(1, Math.floor(renderH / pixelFactor));
    if (this.compositionBuffer.width !== cw || this.compositionBuffer.height !== ch) {
      this.compositionBuffer.width = cw;
      this.compositionBuffer.height = ch;
    }

    if (config.transparentBackground) {
      this.compCtx.clearRect(0, 0, cw, ch);
    } else {
      this.compCtx.fillStyle = config.palette[0] || '#000000';
      this.compCtx.fillRect(0, 0, cw, ch);
    }

    const resolution = Math.max(1, Math.floor(config.resolution));
    const cols = Math.max(1, Math.floor(cw / resolution));
    const rows = Math.max(1, Math.floor(ch / resolution));
    if (this.offscreen.width !== cols || this.offscreen.height !== rows) {
      this.offscreen.width = cols;
      this.offscreen.height = rows;
    }

    this.offCtx.imageSmoothingEnabled = true;
    this.offCtx.imageSmoothingQuality = 'high';
    this.offCtx.clearRect(0, 0, cols, rows);
    if (source) this.offCtx.drawImage(source, 0, 0, cols, rows);
    if (brushCanvas) this.offCtx.drawImage(brushCanvas, 0, 0, cols, rows);

    const rawData = this.offCtx.getImageData(0, 0, cols, rows).data;
    const pixelStrideLen = cols * rows * 4;
    const sampleLen = cols * rows;
    const temporalEnabled = Boolean(config.temporalEnabled);
    const temporalBlend = this.clamp01(config.temporalBlend || 0);
    const characterInertia = this.clamp01(config.characterInertia || 0);
    const edgeTemporalBlend = this.clamp01(config.edgeTemporalStability || 0);

    const hasTemporalHistory =
      temporalEnabled &&
      this.prevLumaBuffer.length === sampleLen &&
      this.prevCharGrid.length === sampleLen;

    this.gradedBuffer = this.ensureFloatBuffer(this.gradedBuffer, pixelStrideLen);
    this.lumaBuffer = this.ensureFloatBuffer(this.lumaBuffer, sampleLen);
    this.applyGrading(rawData, this.gradedBuffer, config);

    const palette = config.palette.length ? config.palette : ['#000000', '#ffffff'];
    const paletteRgb = this.getPaletteRgb(palette);

    if (config.dithering > 0 && config.ditheringMode === DitheringMode.FLOYD && config.colorizeDither) {
      this.applyFloydSteinbergRGB(
        this.gradedBuffer,
        cols,
        rows,
        config.dithering,
        config.colorMode === ColorMode.QUANTIZED,
        palette,
        paletteRgb
      );
    }

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let i = 0; i < sampleLen; i++) {
      const idx = i * 4;
      const r = this.gradedBuffer[idx];
      const g = this.gradedBuffer[idx + 1];
      const b = this.gradedBuffer[idx + 2];
      sumR += r;
      sumG += g;
      sumB += b;
      this.lumaBuffer[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    if (hasTemporalHistory && temporalBlend > 0) {
      this.applyTemporalBlend(this.lumaBuffer, this.prevLumaBuffer, temporalBlend);
    }

    if (config.dithering > 0 && config.ditheringMode === DitheringMode.FLOYD && !config.colorizeDither) {
      this.applyFloydSteinbergLuma(this.lumaBuffer, cols, rows, config.dithering);
    }

    const edgeData = config.outlineEnabled ? this.computeEdgeData(this.lumaBuffer, cols, rows) : null;
    if (edgeData && hasTemporalHistory && edgeTemporalBlend > 0 && this.prevEdgeMagnitude.length === sampleLen) {
      this.applyTemporalBlend(edgeData.magnitude, this.prevEdgeMagnitude, edgeTemporalBlend);
    }
    const edgeThreshold = this.clamp01(1 - config.outlineSensitivity) * SOBEL_MAX_MAGNITUDE;
    const gradientLut = this.getGradientLut(palette);
    const customRampEntries = this.getCustomRampEntries(config);
    const semanticTokens = config.customSemanticMapping
      ? this.parseSemanticTokens(config.semanticWord || 'ASTRIT')
      : [];
    const currentCharGrid = temporalEnabled ? new Array<string>(sampleLen).fill(' ') : null;

    this.compCtx.font = `${resolution}px ${config.font}, monospace`;
    this.compCtx.textBaseline = 'top';

    const charCounts: Record<string, number> = {};
    let lastFillStyle = '';
    let nonSpaceChars = 0;

    for (let y = 0; y < rows; y++) {
      let rowOffset = 0;
      if (shockIntensity > 0) {
        const rowSeed = hash3(0, y, config.seed);
        if (rowSeed < shockIntensity * 0.4) {
          rowOffset = (hash3(1, y, config.seed) - 0.5) * shockIntensity * 80;
        }
      }

      for (let x = 0; x < cols; x++) {
        const gridIdx = y * cols + x;
        let lookupX = x + rowOffset;
        let lookupY = y;
        const strength = config.distortionStrength;

        if (config.distortion === DistortionMode.NOISE) {
          lookupX += (hash3(x, y, config.seed) - 0.5) * strength * 20;
          lookupY += (hash3(x, y, config.seed + 1) - 0.5) * strength * 20;
        } else if (config.distortion === DistortionMode.WAVE) {
          lookupX += Math.sin(y * 0.1 + frameIndex * 0.15) * strength * 10;
        } else if (config.distortion === DistortionMode.TWIST) {
          const cx = cols * 0.5;
          const cy = rows * 0.5;
          const dx = x - cx;
          const dy = y - cy;
          const radius = Math.sqrt(dx * dx + dy * dy);
          const maxRadius = Math.max(1, Math.sqrt(cx * cx + cy * cy));
          const twist = (1 - Math.min(1, radius / maxRadius)) * strength * 0.08;
          const sinT = Math.sin(twist);
          const cosT = Math.cos(twist);
          lookupX = cx + dx * cosT - dy * sinT;
          lookupY = cy + dx * sinT + dy * cosT;
        } else if (config.distortion === DistortionMode.VHS) {
          const band = Math.sin(y * 0.18 + frameIndex * 0.04 + config.seed);
          lookupX += band * strength * 6;
          const tearSeed = hash3(Math.floor(x / 3), y, config.seed + frameIndex);
          if (tearSeed < 0.02 * strength) {
            lookupX += (hash3(x, y, config.seed + 17) - 0.5) * strength * 50;
          }
        }

        const sampleX = Math.max(0, Math.min(cols - 1, Math.floor(lookupX)));
        const sampleY = Math.max(0, Math.min(rows - 1, Math.floor(lookupY)));
        const lIdx = sampleY * cols + sampleX;

        let luminance = this.lumaBuffer[lIdx];
        if (config.ditheringMode === DitheringMode.BAYER && config.dithering > 0) {
          const bayer = (BAYER_MATRIX_4x4[y % 4][x % 4] / 16.0 - 0.5) * config.dithering;
          luminance = this.clamp01(luminance + bayer);
        }

        let char = ' ';
        let isEdge = false;
        if (edgeData && edgeData.magnitude[lIdx] > edgeThreshold) {
          isEdge = true;
          const angle = ((edgeData.angle[lIdx] * 180) / Math.PI + 180) % 180;
          if (angle < 22.5 || angle >= 157.5) char = '|';
          else if (angle < 67.5) char = '/';
          else if (angle < 112.5) char = '-';
          else char = '\\';
        } else {
          char = this.getChar(luminance, config, x, y, frameIndex, customRampEntries, semanticTokens);
        }

        if (hasTemporalHistory && characterInertia > 0 && shockIntensity === 0) {
          const previousChar = this.prevCharGrid[gridIdx] || ' ';
          if (previousChar !== char) {
            const prevLum = this.prevLumaBuffer[gridIdx] ?? luminance;
            const lumDelta = Math.abs(luminance - prevLum);
            const inertiaThreshold = 0.02 + characterInertia * 0.25;
            if (lumDelta < inertiaThreshold) {
              char = previousChar;
            }
          }
        }

        if (currentCharGrid) {
          currentCharGrid[gridIdx] = char;
        }

        if (char === ' ') continue;
        nonSpaceChars++;
        charCounts[char] = (charCounts[char] || 0) + 1;

        let fillStyle = config.outlineColor;
        if (!isEdge) {
          if (config.colorMode === ColorMode.MONO) {
            fillStyle = palette[1] || '#00ff00';
          } else if (config.colorMode === ColorMode.GRADIENT) {
            fillStyle = gradientLut[Math.max(0, Math.min(255, Math.round(luminance * 255)))];
          } else {
            const cIdx = lIdx * 4;
            let r = this.gradedBuffer[cIdx];
            let g = this.gradedBuffer[cIdx + 1];
            let b = this.gradedBuffer[cIdx + 2];

            if (config.colorizeDither && config.ditheringMode === DitheringMode.BAYER && config.dithering > 0) {
              const bayer = (BAYER_MATRIX_4x4[y % 4][x % 4] / 16.0 - 0.5) * config.dithering;
              r = this.clamp01(r + bayer);
              g = this.clamp01(g + bayer);
              b = this.clamp01(b + bayer);
            }

            if (shockIntensity > 0) {
              r = this.clamp01(r + shockIntensity * 0.4);
              g = this.clamp01(g - shockIntensity * 0.1);
              b = this.clamp01(b + shockIntensity * 0.1);
            }

            if (config.colorMode === ColorMode.QUANTIZED) {
              fillStyle = this.findNearestColor(r * 255, g * 255, b * 255, palette, paletteRgb);
            } else {
              fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
            }
          }
        }

        if (fillStyle !== lastFillStyle) {
          this.compCtx.fillStyle = fillStyle;
          lastFillStyle = fillStyle;
        }
        this.compCtx.fillText(char, x * resolution, y * resolution);
      }
    }

    if (temporalEnabled) {
      this.prevLumaBuffer = this.ensureFloatBuffer(this.prevLumaBuffer, sampleLen);
      this.prevLumaBuffer.set(this.lumaBuffer);

      this.prevEdgeMagnitude = this.ensureFloatBuffer(this.prevEdgeMagnitude, sampleLen);
      if (edgeData) {
        this.prevEdgeMagnitude.set(edgeData.magnitude);
      } else {
        this.prevEdgeMagnitude.fill(0);
      }

      this.prevCharGrid = currentCharGrid || [];
    } else {
      this.prevLumaBuffer = new Float32Array(0);
      this.prevEdgeMagnitude = new Float32Array(0);
      this.prevCharGrid = [];
    }

    this.ctx.clearRect(0, 0, renderW, renderH);

    const baseFilters: string[] = [];
    if (config.postProcess.invert > 0) baseFilters.push(`invert(${config.postProcess.invert})`);
    if (config.postProcess.saturation !== 1) baseFilters.push(`saturate(${config.postProcess.saturation})`);
    if (config.postProcess.blur > 0) baseFilters.push(`blur(${config.postProcess.blur}px)`);
    const baseFilter = baseFilters.length ? baseFilters.join(' ') : 'none';

    this.ctx.save();
    if (config.postProcess.glow > 0) {
      this.ctx.save();
      const bloomSize = config.postProcess.glow * 15;
      const bloomFilters = baseFilter === 'none' ? '' : `${baseFilter} `;
      this.ctx.filter = `${bloomFilters}blur(${bloomSize}px) brightness(1.8)`;
      this.ctx.globalAlpha = Math.min(1, config.postProcess.glow * 0.8);
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.drawImage(this.compositionBuffer, 0, 0, renderW, renderH);
      this.ctx.restore();
    }

    this.ctx.filter = baseFilter;
    this.ctx.drawImage(this.compositionBuffer, 0, 0, renderW, renderH);
    this.ctx.restore();

    let lumSum = 0;
    for (let i = 0; i < this.lumaBuffer.length; i++) lumSum += this.lumaBuffer[i];
    const sampleCount = cols * rows;
    const avgLum = lumSum / sampleCount;
    const density = nonSpaceChars / sampleCount;

    const uniqueChars = Object.keys(charCounts);
    let entropy = 0;
    if (nonSpaceChars > 0) {
      for (const key of uniqueChars) {
        const p = charCounts[key] / nonSpaceChars;
        entropy -= p * Math.log2(p);
      }
      const maxEntropy = Math.log2(Math.max(1, uniqueChars.length));
      entropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
    }

    const avgR = (sumR / sampleCount) * 255;
    const avgG = (sumG / sampleCount) * 255;
    const avgB = (sumB / sampleCount) * 255;
    const dominantColor = this.rgbToHex(avgR, avgG, avgB);

    return { charCounts, metrics: { averageLuminance: avgLum, density, entropy, dominantColor } };
  }

  public async triggerStaticRender(source: any, config: EngineConfig, w: number, h: number, brush?: any): Promise<Blob | null> {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const engine = new AsciiEngine(tempCanvas);
    engine.render(source, config, w, h, 0, brush);
    return new Promise<Blob | null>((resolve) => {
      tempCanvas.toBlob(resolve, 'image/png', 1.0);
    });
  }

  public async generateSVG(source: any, config: EngineConfig, w: number, h: number): Promise<null> {
    void source;
    void config;
    void w;
    void h;
    return null;
  }
}

