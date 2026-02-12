import React, { useEffect, useRef } from 'react';

interface LandingAsciiBackgroundProps {
  className?: string;
  seed?: string;
}

interface GridState {
  cols: number;
  rows: number;
  noise: Float32Array;
  pulse: Float32Array;
  drift: Float32Array;
}

interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

const CHAR_RAMP = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];
const CELL_W = 10;
const CELL_H = 15;
const STEP_MS = 1000 / 24;

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createLcg = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const createGridState = (cols: number, rows: number, seed: number): GridState => {
  const total = cols * rows;
  const noise = new Float32Array(total);
  const pulse = new Float32Array(total);
  const drift = new Float32Array(total);
  const rand = createLcg(seed ^ (cols * 131) ^ (rows * 977));

  for (let i = 0; i < total; i += 1) {
    noise[i] = rand();
    pulse[i] = rand() * Math.PI * 2;
    drift[i] = rand() * 0.9 + 0.1;
  }

  return { cols, rows, noise, pulse, drift };
};

export const LandingAsciiBackground: React.FC<LandingAsciiBackgroundProps> = ({
  className = '',
  seed = 'astrit-landing-v1'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const gridRef = useRef<GridState | null>(null);
  const seedRef = useRef(hashSeed(seed));
  const pointerTargetRef = useRef<PointerState>({ x: 0.5, y: 0.5, active: false });
  const pointerCurrentRef = useRef<PointerState>({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    seedRef.current = hashSeed(seed);
  }, [seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const setPointer = (clientX: number, clientY: number, active: boolean) => {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      pointerTargetRef.current.x = clamp01(clientX / width);
      pointerTargetRef.current.y = clamp01(clientY / height);
      pointerTargetRef.current.active = active;
    };

    const handleMouseMove = (event: MouseEvent) => {
      setPointer(event.clientX, event.clientY, true);
    };
    const handleTouchMove = (event: TouchEvent) => {
      const firstTouch = event.touches[0];
      if (!firstTouch) return;
      setPointer(firstTouch.clientX, firstTouch.clientY, true);
    };
    const handlePointerLeave = () => {
      pointerTargetRef.current.active = false;
    };

    const resize = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const width = Math.floor(window.innerWidth);
      const height = Math.floor(window.innerHeight);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = 'top';
      ctx.font = '12px "JetBrains Mono", "Courier New", monospace';

      const cols = Math.max(24, Math.floor(width / CELL_W));
      const rows = Math.max(14, Math.floor(height / CELL_H));
      gridRef.current = createGridState(cols, rows, seedRef.current);
    };

    const renderStep = (frameIndex: number) => {
      const grid = gridRef.current;
      if (!grid) return;

      const { cols, rows, noise, pulse, drift } = grid;
      const width = Math.floor(window.innerWidth);
      const height = Math.floor(window.innerHeight);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(2, 6, 15, 0.28)';
      ctx.fillRect(0, 0, width, height);

      const t = frameIndex * (1 / 24);
      const pointerTarget = pointerTargetRef.current;
      const pointerCurrent = pointerCurrentRef.current;
      const targetX = pointerTarget.active ? pointerTarget.x : 0.5;
      const targetY = pointerTarget.active ? pointerTarget.y : 0.5;
      pointerCurrent.x += (targetX - pointerCurrent.x) * 0.08;
      pointerCurrent.y += (targetY - pointerCurrent.y) * 0.08;
      pointerCurrent.active = pointerTarget.active;

      const mouseX = pointerCurrent.x - 0.5;
      const mouseY = pointerCurrent.y - 0.5;

      const orbX = 0.5 + Math.sin(t * 0.9) * 0.28 + mouseX * 0.24;
      const orbY = 0.5 + Math.cos(t * 0.66) * 0.22 + mouseY * 0.2;
      const orb2X = 0.5 + Math.cos(t * 0.47 + 1.3) * 0.34 - mouseX * 0.16;
      const orb2Y = 0.5 + Math.sin(t * 0.58 + 0.7) * 0.24 - mouseY * 0.14;

      for (let y = 0; y < rows; y += 1) {
        const ny = rows > 1 ? y / (rows - 1) : 0;
        for (let x = 0; x < cols; x += 1) {
          const idx = y * cols + x;
          const nx = cols > 1 ? x / (cols - 1) : 0;

          const dx1 = nx - orbX;
          const dy1 = ny - orbY;
          const dx2 = nx - orb2X;
          const dy2 = ny - orb2Y;
          const pointerDx = nx - pointerCurrent.x;
          const pointerDy = ny - pointerCurrent.y;

          const orb = Math.exp(-((dx1 * dx1 + dy1 * dy1) * 9.5));
          const orb2 = Math.exp(-((dx2 * dx2 + dy2 * dy2) * 12.0));
          const pointerFocus = pointerCurrent.active
            ? Math.exp(-((pointerDx * pointerDx + pointerDy * pointerDy) * 28.0))
            : 0;
          const wave =
            Math.sin((nx * 8.8 + t * (0.8 + drift[idx] * 0.2) + mouseX * 2.6) + pulse[idx]) * 0.24 +
            Math.cos((ny * 9.6 - t * (0.7 + drift[idx] * 0.25) + mouseY * 2.1) + pulse[idx] * 0.65) * 0.19;

          const base = noise[idx] * 0.36 + wave + orb * 0.7 + orb2 * 0.48 + pointerFocus * 0.42;
          const luma = clamp01(base);
          const rampIndex = Math.min(CHAR_RAMP.length - 1, Math.floor(luma * CHAR_RAMP.length));
          const char = CHAR_RAMP[rampIndex];

          if (luma > 0.72) {
            ctx.fillStyle = 'rgba(255, 0, 77, 0.42)';
          } else if (luma > 0.48) {
            ctx.fillStyle = 'rgba(41, 173, 255, 0.40)';
          } else {
            ctx.fillStyle = 'rgba(95, 87, 79, 0.34)';
          }

          ctx.fillText(char, x * CELL_W, y * CELL_H);
        }
      }
    };

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }

      const delta = Math.min(100, now - (lastTimeRef.current ?? now));
      lastTimeRef.current = now;
      accumulatorRef.current += delta;

      while (accumulatorRef.current >= STEP_MS) {
        frameRef.current += 1;
        accumulatorRef.current -= STEP_MS;
      }

      renderStep(frameRef.current);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('touchend', handlePointerLeave);
    window.addEventListener('touchcancel', handlePointerLeave);
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('touchend', handlePointerLeave);
      window.removeEventListener('touchcancel', handlePointerLeave);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};
