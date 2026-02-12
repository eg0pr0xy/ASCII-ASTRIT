import React from 'react';
import { ArrowLeft, BookOpen, Cpu, Download, Layers, Monitor, Zap } from 'lucide-react';
import { PixelButton, PanelModule } from './UIComponents';

interface HelpPageProps {
  onBackToLanding: () => void;
  onOpenStudio: () => void;
  initialAnchor?: 'overview' | 'troubleshooting';
}

const Section: React.FC<{ title: string; anchor?: string; children: React.ReactNode }> = ({ title, anchor, children }) => (
  <section id={anchor}>
    <PanelModule title={title} headerColor="var(--highlight)">
      <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed space-y-2">{children}</div>
    </PanelModule>
  </section>
);

export const HelpPage: React.FC<HelpPageProps> = ({ onBackToLanding, onOpenStudio, initialAnchor = 'overview' }) => {
  React.useEffect(() => {
    if (initialAnchor === 'overview') return;
    const section = document.getElementById(initialAnchor);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialAnchor]);

  return (
    <div className="w-full h-screen bg-[var(--bg-app)] text-[var(--text-primary)] relative overflow-hidden font-mono">
      <div className="absolute inset-0 scanline opacity-20 pointer-events-none"></div>
      <div className="absolute inset-0 vignette pointer-events-none"></div>
      <div className="absolute inset-0 crt-flicker opacity-5 pointer-events-none"></div>

      <header className="relative z-10 border-b-4 border-[var(--border-panel)] bg-[var(--bg-panel)] p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-[var(--highlight)]" />
          <div>
            <h1 className="text-xl font-['Rubik_Glitch'] text-[var(--accent)]">ASTRIT MANUAL</h1>
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              Complete operator documentation
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <PixelButton label="Back" onClick={onBackToLanding} variant="ghost" icon={<ArrowLeft size={14} />} />
          <PixelButton label="Open Studio" onClick={onOpenStudio} variant="primary" icon={<Monitor size={14} />} />
        </div>
      </header>

      <main className="relative z-10 h-[calc(100vh-86px)] overflow-y-auto p-3 lg:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="1. System Overview" anchor="overview">
            <p>
              ASCII ASTRIT is a deterministic media-to-text rendering engine. It transforms image/video input into a
              glyph grid and then composites that grid into styled visual output.
            </p>
            <p>
              Rendering target: same source + same configuration + same seed + same frame order = same output sequence.
              This is the baseline for reproducible creative experiments.
            </p>
          </Section>

          <Section title="2. Core Render Pipeline">
            <p>Per-frame pipeline (native renderer):</p>
            <p>
              Source sampling {'->'} color grading {'->'} optional dithering {'->'} luma/edge analysis {'->'} glyph
              selection {'->'} color write {'->'} post-process {'->'} optional diagnostics overlay.
            </p>
            <p>
              Temporal cohesion uses previous luma, previous edge magnitude, and previous character grid to reduce
              flicker and stabilize symbol decisions over time.
            </p>
          </Section>

          <Section title="3. Quick Start (30 Seconds)">
            <p>1) Open Studio, then load an image/video via `Source {'->'} UPLOAD`.</p>
            <p>2) Set `Engine Mode`, `Res`, `Brightness`, and optional `Sobel` edges.</p>
            <p>3) Toggle `Temporal Cohesion` for videos (Blend/Inertia as needed).</p>
            <p>4) Export with `PNG`, `GIF`, `WEBM`, or `TXT` in Export Studio.</p>
          </Section>

          <Section title="4. Left Panel Modules">
            <p>`Project Management`:</p>
            <p>`LOAD/SAVE PROJECT` for full `.astrit` sessions, `LOAD/SAVE PRESET` for reusable JSON settings.</p>
            <p>`Source`:</p>
            <p>`UPLOAD` accepts image/video. `WEBCAM` enables live input (useful for exploration, less strict reproducibility).</p>
            <p>`Color Grade`:</p>
            <p>
              `SAMPLE SOURCE` derives palette hints from current frame. `EYEDROPPER` reads precise colors. Palette Lock
              (`QUANTIZED`) constrains output colors to active swatches.
            </p>
            <p>`Typography`:</p>
            <p>
              Font family, semantic word input, semantic ramp mode, custom ramp editor, semantic-map toggles, and ramp
              preset persistence.
            </p>
          </Section>

          <Section title="5. Typography Deep Reference">
            <p>`Semantic Text`:</p>
            <p>
              Enter any word (up to 64 chars). In semantic mode, glyph choice derives from this token sequence. Useful
              for branded visuals and typographic motifs.
            </p>
            <p>`Character Set Editor`:</p>
            <p>
              Build custom entries with glyph + brightness stop + optional semantic token. Enable `Use Custom Ramp` to
              override default mode ramps.
            </p>
            <p>
              If you see warning squares/triangles, your current font does not support one or more selected Unicode
              glyphs. Use safer symbols or switch fonts.
            </p>
          </Section>

          <Section title="6. Right Panel Modules">
            <p>`Renderer`:</p>
            <p>`NATIVE` is the deterministic baseline path and runs the full in-house engine.</p>
            <p>`TEXTMODE` is a WebGL2 accelerated style path (`textmode.js`) and focuses on fast stylized playback.</p>
            <p>
              Practical difference:
            </p>
            <p>`NATIVE`: full temporal controls, Sobel overlays, distortion stack, brush compositing, diagnostics overlays.</p>
            <p>`TEXTMODE`: reduced feature parity, depends on WebGL2 support, and auto-falls back to Native if unavailable.</p>
            <p>`Engine Mode`:</p>
            <p>Defines how luminance maps to glyphs (`PICO_ASCII`, `SEMANTIC`, `MATRIX`, `DEVIL`, etc.).</p>
            <p>`Sobel Edges` + `Parameters`:</p>
            <p>
              Edge overlay uses directional glyphs. Core controls include resolution, brightness, dithering amount and
              dithering method.
            </p>
          </Section>

          <Section title="7. Temporal Cohesion (Video Focus)">
            <p>`Enable Temporal Model` activates frame-to-frame stabilization.</p>
            <p>`Blend`:</p>
            <p>Blends current and previous luminance. Higher = less flicker, but stronger lag risk.</p>
            <p>`Inertia`:</p>
            <p>Character persistence threshold. Higher = symbol lock, but can ghost if motion is fast.</p>
            <p>`Edge Mem`:</p>
            <p>Stabilizes edge magnitude used for Sobel overlays.</p>
            <p>`Adaptive Inertia` + `Clamp`:</p>
            <p>
              Reduces persistence in high-motion/high-edge-change zones to limit ghosting while preserving static-area
              stability.
            </p>
            <p>`Diagnostics Overlay`:</p>
            <p>Real-time debug layers for luma delta, lock map, edge stability, and motion field.</p>
          </Section>

          <Section title="8. Distortion and Post-Process">
            <p>`Distortion` shifts sample coordinates before glyph choice.</p>
            <p>`WAVE` = sinusoidal drift, `TWIST` = radial warp, `NOISE` = stochastic displacement, `VHS` = analog glitch-like bands/tears.</p>
            <p>`Post-Processing` applies finishing filters after glyph composition: Glow, Blur, Saturation, Invert.</p>
          </Section>

          <Section title="9. Export Matrix">
            <p>`SNAP PNG`:</p>
            <p>Quick viewport image.</p>
            <p>`MASTER PNG`:</p>
            <p>High-res frame export with framing mode (`CONTAIN`/`COVER`) and output size presets.</p>
            <p>`GIF`:</p>
            <p>Frame-sequence export with FPS, quality, and repeat controls.</p>
            <p>`WEBM`:</p>
            <p>Canvas stream recording (infinite or timed via source duration/loops).</p>
            <p>`TXT`:</p>
            <p>Exports rendered glyph matrix as plain text preserving the frame's ASCII structure.</p>
            <p>`ANS`:</p>
            <p>Exports ANSI truecolor text (`.ans`) with per-glyph foreground color escape codes.</p>
            <p>`TXT BATCH`:</p>
            <p>For imported video files, captures frame-sequence ASCII text into one batch `.txt` file.</p>
          </Section>

          <Section title="10. TXT Export Guide">
            <p>
              TXT export writes one line per render row and one glyph per render cell. Open the file in a monospaced
              editor or print pipeline to keep alignment intact.
            </p>
            <p>
              ANSI `.ans` export keeps the same grid and adds per-glyph foreground color escape codes for terminal-style
              playback.
            </p>
            <p>
              For print-like output: choose stable glyph sets, reduce resolution until line lengths match target paper
              width, and use a monospace font in the final target environment.
            </p>
            <p>
              Best fidelity comes from modes with clear contrast ramps and low blur/post-effects.
            </p>
          </Section>

          <Section title="11. File Formats and Persistence">
            <p>Project `.astrit`: includes config, theme, and optional embedded image snapshot.</p>
            <p>Preset `.json`: reusable configuration payload for style transfer between projects.</p>
            <p>
              Custom ramps and palettes are stored locally and loaded at startup. Schema normalization keeps older files
              compatible when possible.
            </p>
          </Section>

          <Section title="12. Determinism Protocol">
            <p>Use file sources instead of webcam for strict reproducibility.</p>
            <p>Keep seed, mode, resolution, temporal values, and playback progression fixed.</p>
            <p>Do not switch renderer mid-benchmark.</p>
            <p>
              For sequence comparisons, ensure the same frame index progression and identical export dimensions across
              runs.
            </p>
          </Section>

          <Section title="13. Performance and Stability">
            <p>Lower `Res` (bigger glyph cells) for faster rendering and longer exports.</p>
            <p>High blur/glow and high-resolution GIF jobs increase compute and memory load.</p>
            <p>
              If browser memory pressure appears during GIF export, reduce loops/FPS/output size first.
            </p>
          </Section>

          <Section title="14. Troubleshooting" anchor="troubleshooting">
            <p>`Textmode initialization failed`:</p>
            <p>WebGL2 is unavailable in current context. ASTRIT falls back to Native renderer automatically.</p>
            <p>`play() interrupted by new load request`:</p>
            <p>Source changed while playback was starting. Re-select source and let metadata load before export.</p>
            <p>`Styles/UI look broken`:</p>
            <p>Restart dev server and hard refresh to clear stale hot-reload/client cache state.</p>
            <p>`Unknown replacement glyphs`:</p>
            <p>Current font lacks selected glyphs. Choose a compatible font or adjust custom ramp characters.</p>
          </Section>

          <Section title="15. Known Status / Roadmap Notes">
            <p>Temporal diagnostics and adaptive inertia are integrated and tunable in the right panel.</p>
            <p>SVG text export is currently a placeholder path and not active for production use yet.</p>
            <p>
              Deterministic behavior remains the core policy for all future rendering changes.
            </p>
          </Section>

          <Section title="16. Key Terms">
            <p>`Lock Ratio`: fraction of changed cells held by inertia.</p>
            <p>`Mean Luma Delta`: average per-cell luminance change versus previous frame.</p>
            <p>`Mean Motion`: composite motion score from luma and edge deltas.</p>
            <p>`Ghost Clamp`: adaptive threshold that suppresses stale character persistence in high motion.</p>
          </Section>
        </div>

        <div className="mt-5 border-2 border-[var(--border-module)] bg-[var(--bg-module)] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-2 mr-4"><Cpu size={12} /> Deterministic rendering</span>
            <span className="inline-flex items-center gap-2 mr-4"><Layers size={12} /> Artist-grade controls</span>
            <span className="inline-flex items-center gap-2 mr-4"><Zap size={12} /> Temporal diagnostics</span>
            <span className="inline-flex items-center gap-2"><Download size={12} /> Production exports</span>
          </div>
          <PixelButton label="ENTER STUDIO" onClick={onOpenStudio} variant="primary" icon={<Monitor size={14} />} />
        </div>
      </main>
    </div>
  );
};
