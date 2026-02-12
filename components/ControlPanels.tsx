
import React, { useState } from 'react';
import { PixelButton, PanelModule, PixelSlider } from './UIComponents';
import { EngineConfig, AsciiMode, BrushType, FontType, ColorMode, DistortionMode, PrintDPI, DitheringMode, PaperSize, CustomRampEntry, TemporalDiagnosticsMode, RenderEngine } from '../engineTypes';
import { COLOR_PALETTES } from '../constants';
import {
  Image as ImageIcon, 
  Camera,
  Activity,
  Zap,
  Download,
  Trash2,
  Loader2,
  PenTool,
  Grid,
  Type,
  Binary,
  FileDigit,
  LayoutGrid,
  Video,
  Plus,
  Sparkles,
  Wand2,
  X,
  Type as TypeIcon,
  Layers,
  Wind,
  FolderOpen,
  Save,
  FileJson,
  Cpu,
  Square,
  Pipette,
  ArrowUp,
  ArrowDown,
  Film
} from 'lucide-react';

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

interface LeftPanelProps {
  config: EngineConfig;
  setConfig: React.Dispatch<React.SetStateAction<EngineConfig>>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onWebcam: () => void;
  charStats: Record<string, number>;
  customPalettes: Record<string, string[]>;
  customRamps: Record<string, CustomRampEntry[]>;
  onSavePalette: (name: string, colors: string[]) => void;
  onDeletePalette: (name: string) => void;
  onSaveRamp: (name: string, entries: CustomRampEntry[]) => void;
  onLoadRamp: (name: string) => void;
  onDeleteRamp: (name: string) => void;
  onGenerateFromImage: () => void;
  onSaveProject: () => void;
  onLoadProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSavePreset: () => void;
  onLoadPreset: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEyeDropper: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ 
    config, setConfig, onUpload, onWebcam, charStats, 
    customPalettes, customRamps, onSavePalette, onDeletePalette,
    onSaveRamp, onLoadRamp, onDeleteRamp,
    onGenerateFromImage, onSaveProject, onLoadProject, onSavePreset, onLoadPreset,
    onEyeDropper
}) => {
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newRampName, setNewRampName] = useState('');

  void charStats;

  const createRampEntry = (fallbackBrightness: number): CustomRampEntry => ({
    id: `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    char: '#',
    brightness: Math.max(0, Math.min(1, fallbackBrightness)),
    semanticValue: ''
  });

  const handleAddStop = () => {
      const lastColor = config.palette[config.palette.length - 1] || "#ffffff";
      setConfig(p => ({ ...p, palette: [...p.palette, lastColor] }));
  };

  const handleRemoveStop = (index: number) => {
      if (config.palette.length <= 2) return;
      const newPalette = [...config.palette];
      newPalette.splice(index, 1);
      setConfig(p => ({ ...p, palette: newPalette }));
  };

  const handleUpdateStop = (index: number, color: string) => {
      const newPalette = [...config.palette];
      newPalette[index] = color;
      setConfig(p => ({ ...p, palette: newPalette }));
  };

  const handleSavePalettePreset = () => {
      const name = newPaletteName.trim();
      if (!name) return;
      onSavePalette(name, [...config.palette]);
      setNewPaletteName('');
  };

  const handleLoadPalettePreset = (name: string) => {
      if (!name) return;
      if (COLOR_PALETTES[name]) {
          setConfig((prev) => ({ ...prev, paletteName: name, palette: [...COLOR_PALETTES[name]] }));
          return;
      }
      if (customPalettes[name]) {
          setConfig((prev) => ({ ...prev, paletteName: name, palette: [...customPalettes[name]] }));
      }
  };

  const moveRampEntry = (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= config.customRampEntries.length) return;
      const updated = [...config.customRampEntries];
      const current = updated[index];
      updated[index] = updated[target];
      updated[target] = current;
      setConfig((prev) => ({ ...prev, customRampEntries: updated }));
  };

  const addRampEntry = () => {
      const len = config.customRampEntries.length;
      const fallbackBrightness = len ? config.customRampEntries[len - 1].brightness : 1;
      setConfig((prev) => ({
        ...prev,
        customRampEnabled: true,
        customRampEntries: [...prev.customRampEntries, createRampEntry(fallbackBrightness)]
      }));
  };

  const removeRampEntry = (id: string) => {
      if (config.customRampEntries.length <= 1) return;
      setConfig((prev) => ({
        ...prev,
        customRampEntries: prev.customRampEntries.filter((entry) => entry.id !== id)
      }));
  };

  const updateRampEntry = (id: string, patch: Partial<CustomRampEntry>) => {
      setConfig((prev) => ({
        ...prev,
        customRampEntries: prev.customRampEntries.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry
        )
      }));
  };

  const handleSaveRampPreset = () => {
      const name = newRampName.trim();
      if (!name) return;
      onSaveRamp(name, config.customRampEntries);
      setConfig((prev) => ({ ...prev, customRampName: name }));
      setNewRampName('');
  };

  return (
    <div className="w-full lg:w-72 xl:w-80 h-full bg-[var(--bg-panel)] border-r-4 border-[var(--border-panel)] p-3 flex flex-col gap-4 overflow-y-auto z-20">
      <div className="bg-[var(--bg-module)] border-2 border-[var(--border-module)] p-3 text-center mb-2 shadow-[4px_4px_0_var(--shadow-color)] relative">
        <h1 className="text-3xl font-['JetBrains_Mono'] font-bold tracking-[0.18em] text-[var(--accent)] leading-none">ASTRIT</h1>
      </div>

      <PanelModule title="Project Management" headerColor="var(--accent)">
        <div className="grid grid-cols-2 gap-2">
           <label className="cursor-pointer group">
             <input type="file" onChange={onLoadProject} accept=".astrit" className="hidden"/>
             <div className="bg-[var(--bg-module)] group-hover:bg-[var(--bg-panel)] h-10 flex items-center justify-center gap-2 text-[8px] border-2 border-[var(--border-module)] transition-colors">
                <FolderOpen size={12} className="text-[var(--accent)]"/>LOAD PROJECT
             </div>
           </label>
           <button onClick={onSaveProject} className="bg-[var(--bg-module)] hover:bg-[var(--bg-panel)] h-10 flex items-center justify-center gap-2 text-[8px] border-2 border-[var(--border-module)] transition-colors">
             <Save size={12} className="text-[var(--accent)]"/>SAVE PROJECT
           </button>
           <label className="cursor-pointer group">
             <input type="file" onChange={onLoadPreset} accept=".json" className="hidden"/>
             <div className="bg-[var(--bg-module)] group-hover:bg-[var(--bg-panel)] h-10 flex items-center justify-center gap-2 text-[8px] border-2 border-[var(--border-module)] transition-colors">
                <FileJson size={12} className="text-[var(--highlight)]"/>LOAD PRESET
             </div>
           </label>
           <button onClick={onSavePreset} className="bg-[var(--bg-module)] hover:bg-[var(--bg-panel)] h-10 flex items-center justify-center gap-2 text-[8px] border-2 border-[var(--border-module)] transition-colors">
             <Sparkles size={12} className="text-[var(--highlight)]"/>SAVE PRESET
           </button>
        </div>
      </PanelModule>

      <PanelModule title="Source" headerColor="var(--highlight)">
        <div className="grid grid-cols-2 gap-2">
           <label className="cursor-pointer group">
             <input type="file" onChange={onUpload} accept="image/*,video/*" className="hidden"/>
             <div className="bg-[var(--bg-module)] group-hover:bg-[var(--bg-panel)] h-12 flex flex-col items-center justify-center text-[10px] border-2 border-[var(--border-module)] transition-colors">
                <ImageIcon className="mb-1 w-4 h-4 text-[var(--accent)]"/>UPLOAD
             </div>
           </label>
           <button onClick={onWebcam} className="bg-[var(--bg-module)] hover:bg-[var(--bg-panel)] h-12 flex flex-col items-center justify-center text-[10px] border-2 border-[var(--border-module)] transition-colors">
             <Camera className="mb-1 w-4 h-4 text-[var(--accent)]"/>WEBCAM
           </button>
        </div>
      </PanelModule>

      <PanelModule title="Color Grade" headerColor="#00e436">
          <div className="flex flex-col gap-1">
              <div className="grid grid-cols-2 gap-2 mb-4">
                  <PixelButton label="SAMPLE SOURCE" onClick={onGenerateFromImage} variant="hardware" className="text-[8px] h-10 px-1" icon={<Sparkles size={10} />} />
                  <PixelButton label="EYEDROPPER" onClick={onEyeDropper} variant="hardware" className="text-[8px] h-10 px-1" icon={<Pipette size={10} />} />
              </div>
              
              <div className="relative group mb-4">
                <select 
                    value={config.paletteName}
                    onChange={(e) => handleLoadPalettePreset(e.target.value)}
                    className="w-full h-10 bg-black border border-[var(--border-module)] text-[var(--text-primary)] text-[9px] p-1 uppercase appearance-none"
                >
                    {Object.keys(COLOR_PALETTES).map(k => <option key={k} value={k}>{k}</option>)}
                    {Object.keys(customPalettes).map((k) => (
                      <option key={k} value={k}>{k} (CUSTOM)</option>
                    ))}
                </select>
                <Wand2 className="absolute right-2 top-3 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
              </div>

              <div className="flex gap-2 items-center mb-3">
                  <button 
                    onClick={() => setConfig(p => ({ ...p, colorMode: p.colorMode === ColorMode.QUANTIZED ? ColorMode.FULL : ColorMode.QUANTIZED }))}
                    className={`flex-1 border text-[8px] py-1 uppercase transition-all ${config.colorMode === ColorMode.QUANTIZED ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                  >
                    PALETTE LOCK: {config.colorMode === ColorMode.QUANTIZED ? 'ON' : 'OFF'}
                  </button>
                  <button 
                    onClick={() => setConfig(p => ({ ...p, colorMode: ColorMode.MONO }))}
                    className={`flex-1 border text-[8px] py-1 uppercase transition-all ${config.colorMode === ColorMode.MONO ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                  >
                    MONO MODE
                  </button>
              </div>

              <PixelSlider label="Hue" value={config.hue} min={-180} max={180} step={1} onChange={v => setConfig(p => ({...p, hue: v}))} />
              <PixelSlider label="Sat" value={config.saturation} min={0} max={2} step={0.05} onChange={v => setConfig(p => ({...p, saturation: v}))} />
              <PixelSlider label="Lume" value={config.lightness} min={0} max={2} step={0.05} onChange={v => setConfig(p => ({...p, lightness: v}))} />

              <div className="bg-black/40 border border-[var(--border-module)] p-2 mt-2">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Swatches ({config.palette?.length || 0})</span>
                      <button onClick={handleAddStop} className="p-1 hover:text-[var(--highlight)] text-[var(--text-secondary)]"><Plus size={14}/></button>
                  </div>
                  <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto pr-1 py-1">
                      {config.palette?.map((color, i) => (
                          <div key={i} className="relative group/stop flex flex-col items-center">
                              <input 
                                type="color" 
                                value={color} 
                                onChange={(e) => handleUpdateStop(i, e.target.value)}
                                className="w-full h-8 p-0 border-0 bg-transparent cursor-pointer"
                              />
                              <button 
                                onClick={() => handleRemoveStop(i)}
                                className="absolute -top-1 -right-1 bg-black text-white rounded-full p-0.5 opacity-0 group-hover/stop:opacity-100 transition-opacity"
                              >
                                  <X size={8} />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </PanelModule>

      <PanelModule title="Typography" headerColor="var(--accent)">
         <div className="flex flex-col gap-3">
             <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1">
                 {Object.entries(FontType).map(([key, val]) => (
                     <button 
                        key={key} 
                        onClick={() => setConfig(p => ({...p, font: val}))} 
                        className={`text-[9px] h-8 flex flex-col items-center justify-center border-2 transition-all ${config.font === val ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-[var(--text-primary)]' : 'bg-[var(--bg-module)] border-[var(--border-module)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'}`}
                     >
                         <span className="text-[7px] opacity-70 truncate w-full text-center">{key}</span>
                         <span style={{ fontFamily: val.replace(/"/g, '') }} className="text-[10px]">Ag</span>
                     </button>
                 ))}
             </div>

             <div className="bg-black/40 border border-[var(--border-module)] p-2">
                 <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase mb-2">Semantic Text</div>
                 <div className="flex flex-col gap-2 mb-3">
                   <input
                     type="text"
                     value={config.semanticWord}
                     maxLength={64}
                     onChange={(e) =>
                       setConfig((prev) => ({
                         ...prev,
                         semanticWord: e.target.value.slice(0, 64) || 'ASTRIT'
                       }))
                     }
                     placeholder="Word used in semantic mode"
                     className="h-8 bg-black border border-[var(--border-module)] text-[9px] px-2"
                   />
                   <div className="grid grid-cols-2 gap-1">
                     <button
                       onClick={() => setConfig((prev) => ({ ...prev, mode: AsciiMode.SEMANTIC }))}
                       className={`text-[8px] py-1 border uppercase transition-all ${config.mode === AsciiMode.SEMANTIC ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black text-[var(--text-secondary)] border-[var(--border-module)]'}`}
                     >
                       Use Semantic Mode
                     </button>
                     <button
                       onClick={() => setConfig((prev) => ({ ...prev, semanticRamp: !prev.semanticRamp }))}
                       className={`text-[8px] py-1 border uppercase transition-all ${config.semanticRamp ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black text-[var(--text-secondary)] border-[var(--border-module)]'}`}
                     >
                       Ramp: {config.semanticRamp ? 'Luma' : 'Pattern'}
                     </button>
                   </div>
                 </div>

                 <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase mb-2">Character Set Editor</div>
                 <div className="grid grid-cols-2 gap-2 mb-2">
                    <label className="flex items-center gap-2 text-[8px] uppercase text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={config.customRampEnabled}
                        onChange={(e) => setConfig((prev) => ({ ...prev, customRampEnabled: e.target.checked }))}
                      />
                      Use Custom Ramp
                    </label>
                    <label className="flex items-center gap-2 text-[8px] uppercase text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={config.customSemanticMapping}
                        onChange={(e) => setConfig((prev) => ({ ...prev, customSemanticMapping: e.target.checked }))}
                      />
                      Semantic Map
                    </label>
                 </div>

                 <div className="grid grid-cols-[1fr_auto_auto] gap-1 mb-2">
                    <select
                      value={customRamps[config.customRampName] ? config.customRampName : ''}
                      onChange={(e) => {
                        const name = e.target.value;
                        if (!name) return;
                        setConfig((prev) => ({ ...prev, customRampName: name }));
                        onLoadRamp(name);
                      }}
                      className="h-8 bg-black border border-[var(--border-module)] text-[9px] px-1 uppercase"
                    >
                      <option value="">UNSAVED</option>
                      {Object.keys(customRamps).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => customRamps[config.customRampName] && onLoadRamp(config.customRampName)}
                      disabled={!customRamps[config.customRampName]}
                      className="h-8 px-2 text-[8px] border border-[var(--border-module)] bg-black disabled:opacity-40"
                    >
                      LOAD
                    </button>
                    <button
                      onClick={() => customRamps[config.customRampName] && onDeleteRamp(config.customRampName)}
                      disabled={!customRamps[config.customRampName]}
                      className="h-8 px-2 text-[8px] border border-red-700 bg-black text-red-300 disabled:opacity-40"
                    >
                      DEL
                    </button>
                 </div>

                 <div className="grid grid-cols-[1fr_auto] gap-1 mb-2">
                    <input
                      type="text"
                      value={newRampName}
                      onChange={(e) => setNewRampName(e.target.value)}
                      placeholder="Ramp name"
                      className="h-8 bg-black border border-[var(--border-module)] text-[9px] px-2 uppercase"
                    />
                    <button
                      onClick={handleSaveRampPreset}
                      className="h-8 px-2 text-[8px] border border-[var(--border-module)] bg-[var(--accent)] text-[var(--text-on-accent)]"
                    >
                      SAVE
                    </button>
                 </div>

                 <div className="max-h-52 overflow-y-auto pr-1 flex flex-col gap-2">
                    {config.customRampEntries.map((entry, index) => (
                      <div key={entry.id || `entry-${index}`} className="border border-[var(--border-module)] p-1 bg-black/60">
                        <div className="grid grid-cols-[2.5rem_1fr_auto_auto_auto] gap-1 items-center mb-1">
                          <input
                            type="text"
                            value={entry.char}
                            maxLength={8}
                            onChange={(e) => updateRampEntry(entry.id, { char: firstGrapheme(e.target.value || ' ', ' ') })}
                            className="h-7 bg-black border border-[var(--border-module)] text-[11px] text-center"
                            title="Character"
                          />
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={entry.brightness}
                            onChange={(e) => updateRampEntry(entry.id, { brightness: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
                            title="Brightness map"
                          />
                          <button onClick={() => moveRampEntry(index, -1)} className="h-7 w-7 border border-[var(--border-module)] bg-black text-[var(--text-secondary)]">
                            <ArrowUp size={12} className="mx-auto" />
                          </button>
                          <button onClick={() => moveRampEntry(index, 1)} className="h-7 w-7 border border-[var(--border-module)] bg-black text-[var(--text-secondary)]">
                            <ArrowDown size={12} className="mx-auto" />
                          </button>
                          <button onClick={() => removeRampEntry(entry.id)} className="h-7 w-7 border border-red-700 bg-black text-red-300">
                            <X size={12} className="mx-auto" />
                          </button>
                        </div>
                        <div className="grid grid-cols-[auto_1fr_auto] gap-1 items-center">
                          <span className="text-[8px] text-[var(--text-muted)] uppercase">Sem</span>
                          <input
                            type="text"
                            value={entry.semanticValue}
                            onChange={(e) => updateRampEntry(entry.id, { semanticValue: e.target.value })}
                            placeholder="semantic token"
                            className="h-6 bg-black border border-[var(--border-module)] text-[8px] px-1 uppercase"
                          />
                          <span className="text-[8px] text-[var(--text-muted)] min-w-[3.25rem] text-right">{entry.brightness.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                 </div>
                 <button
                    onClick={addRampEntry}
                    className="mt-2 w-full h-8 text-[8px] border border-[var(--border-module)] bg-black text-[var(--text-primary)] uppercase"
                 >
                   + Add Character
                 </button>
             </div>

             <div className="bg-black/40 border border-[var(--border-module)] p-2">
                <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase mb-2">Palette Library</div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-1 mb-2">
                  <select
                    value={customPalettes[config.paletteName] ? config.paletteName : ''}
                    onChange={(e) => handleLoadPalettePreset(e.target.value)}
                    className="h-8 bg-black border border-[var(--border-module)] text-[9px] px-1 uppercase"
                  >
                    <option value="">CUSTOM PALETTES</option>
                    {Object.keys(customPalettes).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => customPalettes[config.paletteName] && handleLoadPalettePreset(config.paletteName)}
                    disabled={!customPalettes[config.paletteName]}
                    className="h-8 px-2 text-[8px] border border-[var(--border-module)] bg-black disabled:opacity-40"
                  >
                    LOAD
                  </button>
                  <button
                    onClick={() => customPalettes[config.paletteName] && onDeletePalette(config.paletteName)}
                    disabled={!customPalettes[config.paletteName]}
                    className="h-8 px-2 text-[8px] border border-red-700 bg-black text-red-300 disabled:opacity-40"
                  >
                    DEL
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-1">
                  <input
                    type="text"
                    value={newPaletteName}
                    onChange={(e) => setNewPaletteName(e.target.value)}
                    placeholder="Palette name"
                    className="h-8 bg-black border border-[var(--border-module)] text-[9px] px-2 uppercase"
                  />
                  <button
                    onClick={handleSavePalettePreset}
                    className="h-8 px-2 text-[8px] border border-[var(--border-module)] bg-[var(--highlight)] text-black"
                  >
                    SAVE
                  </button>
                </div>
             </div>
         </div>
      </PanelModule>
    </div>
  );
};

interface RightPanelProps {
  config: EngineConfig;
  setConfig: React.Dispatch<React.SetStateAction<EngineConfig>>;
  brush: BrushType;
  setBrush: (b: BrushType) => void;
  onExport: () => void;
  onExportHD: (size: string) => void;
  onExportGIF: (size: string) => void;
  onExportText: (size: string) => void;
  onExportAnsi: (size: string) => void;
  onExportTextBatch: (size: string) => void;
  onSocialCard: () => void;
  onContactSheet: () => void;
  onExportSVG: () => void;
  onShock: () => void;
  onClearBrush: () => void;
  onRecordVideo: () => void;
  isRecording: boolean;
  dpi: PrintDPI;
  setDpi: (d: PrintDPI) => void;
  isExporting: boolean;
  exportFramingMode: 'CONTAIN' | 'COVER';
  setExportFramingMode: (mode: 'CONTAIN' | 'COVER') => void;
  recordingDurationMode: 'INFINITE' | 'ORIGINAL' | 'LOOPS';
  setRecordingDurationMode: (mode: 'INFINITE' | 'ORIGINAL' | 'LOOPS') => void;
  recordingLoops: number;
  setRecordingLoops: (loops: number) => void;
  canUseTimedRecording: boolean;
  sourceVideoDuration: number | null;
  gifFps: number;
  setGifFps: (value: number) => void;
  gifQuality: number;
  setGifQuality: (value: number) => void;
  gifSourceLoops: number;
  setGifSourceLoops: (value: number) => void;
  gifRepeatCount: number;
  setGifRepeatCount: (value: number) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  config, setConfig, brush, setBrush,
  onExport, onExportHD, onExportGIF, onExportText, onExportAnsi, onExportTextBatch, onSocialCard, onContactSheet,
  onExportSVG, onShock, onClearBrush, onRecordVideo,
  isRecording, dpi, setDpi, isExporting, exportFramingMode, setExportFramingMode,
  recordingDurationMode, setRecordingDurationMode, recordingLoops, setRecordingLoops,
  canUseTimedRecording, sourceVideoDuration,
  gifFps, setGifFps, gifQuality, setGifQuality, gifSourceLoops, setGifSourceLoops, gifRepeatCount, setGifRepeatCount
}) => {
  const [exportSize, setExportSize] = useState<string>("SOURCE");
  const [primaryExportFormat, setPrimaryExportFormat] = useState<'WEBM' | 'PNG' | 'GIF' | 'TXT' | 'ANS'>('WEBM');
  const isMainBusy = primaryExportFormat === 'WEBM' ? false : isExporting;

  const handlePrimaryExport = () => {
    if (primaryExportFormat === 'WEBM') {
      onRecordVideo();
      return;
    }
    if (primaryExportFormat === 'PNG') {
      onExportHD(exportSize);
      return;
    }
    if (primaryExportFormat === 'TXT') {
      onExportText(exportSize);
      return;
    }
    if (primaryExportFormat === 'ANS') {
      onExportAnsi(exportSize);
      return;
    }
    onExportGIF(exportSize);
  };

  const primaryExportLabel =
    primaryExportFormat === 'WEBM'
      ? (isRecording ? 'STOP WEBM' : 'EXPORT WEBM')
      : primaryExportFormat === 'PNG'
        ? (isExporting ? 'BUSY...' : 'EXPORT PNG')
        : primaryExportFormat === 'GIF'
          ? (isExporting ? 'BUSY...' : 'EXPORT GIF')
          : primaryExportFormat === 'TXT'
            ? (isExporting ? 'BUSY...' : 'EXPORT TXT')
            : (isExporting ? 'BUSY...' : 'EXPORT ANS');

  return (
    <div className="w-full lg:w-72 xl:w-80 h-full bg-[var(--bg-panel)] border-l-4 border-[var(--border-panel)] p-3 flex flex-col gap-4 overflow-y-auto z-20">
      <PanelModule title="Renderer" headerColor="var(--highlight)">
         <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfig((p) => ({ ...p, renderEngine: RenderEngine.NATIVE }))}
              className={`text-[8px] py-2 border uppercase transition-all ${config.renderEngine === RenderEngine.NATIVE ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black text-[var(--text-secondary)] border-[var(--border-module)]'}`}
            >
              Native
            </button>
            <button
              onClick={() => setConfig((p) => ({ ...p, renderEngine: RenderEngine.TEXTMODE }))}
              className={`text-[8px] py-2 border uppercase transition-all ${config.renderEngine === RenderEngine.TEXTMODE ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black text-[var(--text-secondary)] border-[var(--border-module)]'}`}
            >
              Textmode
            </button>
         </div>
         <div className="mt-2 text-[8px] text-[var(--text-muted)] leading-relaxed space-y-1">
           <p><span className="uppercase text-[var(--highlight)]">Native:</span> full deterministic pipeline (temporal, sobel, distortion, brush).</p>
           <p><span className="uppercase text-[var(--accent)]">Textmode:</span> WebGL2 accelerated style path with reduced feature parity and automatic native fallback.</p>
         </div>
      </PanelModule>

      <PanelModule title="Engine Mode" headerColor="var(--accent)">
         <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-1">
            {Object.values(AsciiMode).map(m => (
                <button 
                  key={m} 
                  onClick={() => setConfig(p => ({ ...p, mode: m }))}
                  className={`text-[8px] py-2 border flex items-center justify-center gap-1 transition-all ${config.mode === m ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white font-bold' : 'bg-black text-[var(--text-secondary)] border-[var(--border-module)] hover:border-[var(--text-muted)]'}`}
                >
                   {m.replace(/_/g, ' ')}
                </button>
            ))}
         </div>
      </PanelModule>

      <PanelModule title="Sobel Edges" headerColor="#29adff">
            <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                        type="checkbox" 
                        checked={config.outlineEnabled} 
                        onChange={e => setConfig(p => ({...p, outlineEnabled: e.target.checked}))} 
                        className="hidden" 
                    />
                    <div className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${config.outlineEnabled ? 'bg-[var(--highlight)] border-white' : 'bg-black border-[var(--border-module)]'}`}>
                        {config.outlineEnabled && <div className="w-2 h-2 bg-black" />}
                    </div>
                    <span className="text-[10px] font-bold uppercase text-[var(--text-primary)]">Enable Detection</span>
                </label>
                {config.outlineEnabled && (
                    <div className="animate-fadeIn">
                        <PixelSlider label="Sens" value={config.outlineSensitivity} min={0} max={0.99} step={0.01} onChange={v => setConfig(p => ({...p, outlineSensitivity: v}))} />
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Color</span>
                            <input type="color" value={config.outlineColor} onChange={e => setConfig(p => ({...p, outlineColor: e.target.value}))} className="w-8 h-4 p-0 border-0 bg-transparent cursor-pointer" />
                        </div>
                    </div>
                )}
            </div>
        </PanelModule>

      <PanelModule title="Parameters" headerColor="#29adff">
        <PixelSlider label="Res" value={config.resolution} min={4} max={48} step={1} onChange={v => setConfig(p => ({...p, resolution: v}))} />
        <PixelSlider label="Brit" value={config.brightness} min={0} max={2} step={0.05} onChange={v => setConfig(p => ({...p, brightness: v}))} />
        <PixelSlider label="Dith" value={config.dithering} min={0} max={1} step={0.05} onChange={v => setConfig(p => ({...p, dithering: v}))} />
        
        <div className="flex gap-2 items-center mb-3">
          <button 
            onClick={() => setConfig(p => ({ ...p, ditheringMode: p.ditheringMode === DitheringMode.BAYER ? DitheringMode.FLOYD : DitheringMode.BAYER }))}
            className="flex-1 bg-black border border-[var(--border-module)] text-[8px] py-1 text-[var(--text-muted)] uppercase"
          >
            {config.ditheringMode}
          </button>
          <button 
            onClick={() => setConfig(p => ({ ...p, colorizeDither: !p.colorizeDither }))}
            className={`flex-1 border text-[8px] py-1 uppercase ${config.colorizeDither ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
          >
            Color: {config.colorizeDither ? 'ON' : 'OFF'}
          </button>
        </div>
      </PanelModule>

      <PanelModule title="Temporal Cohesion" headerColor="#00e436">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={config.temporalEnabled}
              onChange={e => setConfig(p => ({ ...p, temporalEnabled: e.target.checked }))}
              className="hidden"
            />
            <div className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${config.temporalEnabled ? 'bg-[var(--highlight)] border-white' : 'bg-black border-[var(--border-module)]'}`}>
              {config.temporalEnabled && <div className="w-2 h-2 bg-black" />}
            </div>
            <span className="text-[10px] font-bold uppercase text-[var(--text-primary)]">Enable Temporal Model</span>
          </label>

          {config.temporalEnabled && (
            <div className="animate-fadeIn">
              <PixelSlider label="Blend" value={config.temporalBlend} min={0} max={0.95} step={0.01} onChange={v => setConfig(p => ({ ...p, temporalBlend: v }))} />
              <PixelSlider label="Inertia" value={config.characterInertia} min={0} max={1} step={0.01} onChange={v => setConfig(p => ({ ...p, characterInertia: v }))} />
              <PixelSlider label="Edge Mem" value={config.edgeTemporalStability} min={0} max={1} step={0.01} onChange={v => setConfig(p => ({ ...p, edgeTemporalStability: v }))} />

              <div className="mt-2 bg-black/40 border border-[var(--border-module)] p-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.adaptiveInertiaEnabled}
                    onChange={e => setConfig(p => ({ ...p, adaptiveInertiaEnabled: e.target.checked }))}
                  />
                  <span className="text-[9px] uppercase text-[var(--text-secondary)]">Adaptive Inertia</span>
                </label>
                {config.adaptiveInertiaEnabled && (
                  <div className="mt-1">
                    <PixelSlider label="Adapt" value={config.adaptiveInertiaStrength} min={0} max={1} step={0.01} onChange={v => setConfig(p => ({ ...p, adaptiveInertiaStrength: v }))} />
                    <PixelSlider label="Clamp" value={config.temporalGhostClamp} min={0} max={1} step={0.01} onChange={v => setConfig(p => ({ ...p, temporalGhostClamp: v }))} />
                  </div>
                )}
              </div>

              <div className="mt-2 bg-black/40 border border-[var(--border-module)] p-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.temporalDiagnosticsEnabled}
                    onChange={e => setConfig(p => ({ ...p, temporalDiagnosticsEnabled: e.target.checked }))}
                  />
                  <span className="text-[9px] uppercase text-[var(--text-secondary)]">Diagnostics Overlay</span>
                </label>

                {config.temporalDiagnosticsEnabled && (
                  <div className="mt-2">
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      {Object.values(TemporalDiagnosticsMode).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setConfig(p => ({ ...p, temporalDiagnosticsMode: mode }))}
                          className={`text-[8px] py-1 border transition-all ${config.temporalDiagnosticsMode === mode ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black text-[var(--text-secondary)] border-[var(--border-module)]'}`}
                        >
                          {mode.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                    <PixelSlider label="DBG Op" value={config.temporalDiagnosticsOpacity} min={0.05} max={0.95} step={0.01} onChange={v => setConfig(p => ({ ...p, temporalDiagnosticsOpacity: v }))} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </PanelModule>

      <PanelModule title="Post-Processing" headerColor="#ff004d">
         <PixelSlider label="Glow" value={config.postProcess.glow} min={0} max={1} step={0.05} onChange={v => setConfig(p => ({...p, postProcess: { ...p.postProcess, glow: v }}))} />
         <PixelSlider label="Blur" value={config.postProcess.blur} min={0} max={10} step={0.5} onChange={v => setConfig(p => ({...p, postProcess: { ...p.postProcess, blur: v }}))} />
         <PixelSlider label="Sat" value={config.postProcess.saturation} min={0} max={4} step={0.1} onChange={v => setConfig(p => ({...p, postProcess: { ...p.postProcess, saturation: v }}))} />
         <PixelSlider label="Invert" value={config.postProcess.invert} min={0} max={1} step={0.1} onChange={v => setConfig(p => ({...p, postProcess: { ...p.postProcess, invert: v }}))} />
      </PanelModule>

      <PanelModule title="Distortion" headerColor="#00e436">
         <div className="grid grid-cols-2 gap-1 mb-4">
            {Object.values(DistortionMode).map(m => (
               <button 
                 key={m} 
                 onClick={() => setConfig(p => ({ ...p, distortion: m }))}
                 className={`text-[8px] py-2 border transition-all ${config.distortion === m ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black text-[var(--text-secondary)] border-[var(--border-module)]'}`}
               >
                 {m}
               </button>
            ))}
         </div>
         <PixelSlider label="Str" value={config.distortionStrength} min={0} max={10} step={0.1} onChange={v => setConfig(p => ({...p, distortionStrength: v}))} />
         <PixelButton label="SHOCK" onClick={onShock} variant="primary" className="w-full h-10 mt-2" icon={<Zap size={14}/>}/>
      </PanelModule>

      <PanelModule title="Export Studio" headerColor="var(--highlight)">
         <div className="flex flex-col gap-2">
            <PixelButton label="SNAP PNG" onClick={onExport} variant="primary" className="w-full" icon={<Download size={14}/>}/>
            
            <div className="bg-black border border-[var(--border-module)] p-2 flex flex-col gap-2 mt-2">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-[9px] text-[var(--text-muted)] uppercase">Master Output</span>
                 <div className="flex gap-1">
                    <button onClick={() => setDpi(PrintDPI.SCREEN)} className={`px-2 py-0.5 text-[8px] border ${dpi === PrintDPI.SCREEN ? 'bg-[var(--accent)]' : 'bg-black'}`}>SCRN</button>
                    <button onClick={() => setDpi(PrintDPI.PRINT)} className={`px-2 py-0.5 text-[8px] border ${dpi === PrintDPI.PRINT ? 'bg-[var(--accent)]' : 'bg-black'}`}>PRNT</button>
                 </div>
               </div>
               
               <select value={exportSize} onChange={(e) => setExportSize(e.target.value)} className="w-full bg-black border border-[var(--border-module)] text-[var(--text-primary)] text-[10px] p-2 uppercase appearance-none">
                 {Object.keys(PaperSize).map(s => <option key={s} value={s}>{s}</option>)}
               </select>

               {exportSize !== 'SOURCE' && (
                 <div className="flex gap-1">
                    <button
                      onClick={() => setExportFramingMode('CONTAIN')}
                      className={`flex-1 px-2 py-1 text-[8px] border uppercase ${exportFramingMode === 'CONTAIN' ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                    >
                      Contain
                    </button>
                    <button
                      onClick={() => setExportFramingMode('COVER')}
                      className={`flex-1 px-2 py-1 text-[8px] border uppercase ${exportFramingMode === 'COVER' ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                    >
                      Cover
                    </button>
                 </div>
               )}

               <div className="grid grid-cols-5 gap-1">
                  <button
                    onClick={() => setPrimaryExportFormat('WEBM')}
                    className={`px-2 py-1 text-[8px] border uppercase ${primaryExportFormat === 'WEBM' ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                  >
                    WebM
                  </button>
                  <button
                    onClick={() => setPrimaryExportFormat('PNG')}
                    className={`px-2 py-1 text-[8px] border uppercase ${primaryExportFormat === 'PNG' ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => setPrimaryExportFormat('GIF')}
                    className={`px-2 py-1 text-[8px] border uppercase ${primaryExportFormat === 'GIF' ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                  >
                    GIF
                  </button>
                  <button
                    onClick={() => setPrimaryExportFormat('TXT')}
                    className={`px-2 py-1 text-[8px] border uppercase ${primaryExportFormat === 'TXT' ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                  >
                    TXT
                  </button>
                  <button
                    onClick={() => setPrimaryExportFormat('ANS')}
                    className={`px-2 py-1 text-[8px] border uppercase ${primaryExportFormat === 'ANS' ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                  >
                    ANS
                  </button>
               </div>
               
               <PixelButton 
                label={primaryExportLabel}
                onClick={handlePrimaryExport}
                variant="hardware" 
                className="w-full" 
                disabled={isMainBusy || (primaryExportFormat !== 'WEBM' && isRecording)}
                icon={
                  primaryExportFormat === 'WEBM'
                    ? (isRecording ? <Square size={14} className="fill-current" /> : <Video size={14}/>)
                    : primaryExportFormat === 'PNG'
                      ? (isExporting ? <Loader2 className="animate-spin" size={14}/> : <Cpu size={14}/>)
                      : primaryExportFormat === 'GIF'
                        ? (isExporting ? <Loader2 className="animate-spin" size={14}/> : <Film size={14}/>)
                        : (isExporting ? <Loader2 className="animate-spin" size={14}/> : <Binary size={14}/>)
                }
               />
               <PixelButton
                label="EXPORT TXT BATCH"
                onClick={() => onExportTextBatch(exportSize)}
                variant="hardware"
                className="w-full"
                disabled={isExporting || isRecording || !canUseTimedRecording}
                icon={isExporting ? <Loader2 className="animate-spin" size={14}/> : <Layers size={14}/>}
               />

               <div className="bg-black/40 border border-[var(--border-module)] p-2 flex flex-col gap-2">
                 <div className="text-[8px] uppercase text-[var(--text-muted)]">GIF Export</div>
                 <div className="grid grid-cols-2 gap-1">
                    <div className="flex items-center justify-between border border-[var(--border-module)] px-2 py-1">
                      <span className="text-[8px] uppercase text-[var(--text-secondary)]">FPS</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={gifFps}
                        onChange={(e) => setGifFps(Math.max(1, Math.min(30, parseInt(e.target.value || '12', 10))))}
                        className="w-12 bg-black text-right text-[9px] border border-[var(--border-module)] px-1"
                      />
                    </div>
                    <div className="flex items-center justify-between border border-[var(--border-module)] px-2 py-1">
                      <span className="text-[8px] uppercase text-[var(--text-secondary)]">Quality</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={gifQuality}
                        onChange={(e) => setGifQuality(Math.max(1, Math.min(30, parseInt(e.target.value || '10', 10))))}
                        className="w-12 bg-black text-right text-[9px] border border-[var(--border-module)] px-1"
                      />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-1">
                    <div className="flex items-center justify-between border border-[var(--border-module)] px-2 py-1">
                      <span className="text-[8px] uppercase text-[var(--text-secondary)]">Src Loops</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={gifSourceLoops}
                        onChange={(e) => setGifSourceLoops(Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))))}
                        className="w-12 bg-black text-right text-[9px] border border-[var(--border-module)] px-1"
                      />
                    </div>
                    <div className="flex items-center justify-between border border-[var(--border-module)] px-2 py-1">
                      <span className="text-[8px] uppercase text-[var(--text-secondary)]">Repeat</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={gifRepeatCount}
                        onChange={(e) => setGifRepeatCount(Math.max(0, Math.min(20, parseInt(e.target.value || '0', 10))))}
                        className="w-12 bg-black text-right text-[9px] border border-[var(--border-module)] px-1"
                      />
                    </div>
                 </div>
                 <div className="text-[8px] text-[var(--text-muted)] uppercase">
                   Repeat 0 = Infinite playback
                 </div>
                 <div className="text-[8px] text-[var(--text-muted)] uppercase">
                   Use format selector above and press main export button.
                 </div>
               </div>

               <div className="bg-black/40 border border-[var(--border-module)] p-2 flex flex-col gap-2">
                 <div className="text-[8px] uppercase text-[var(--text-muted)]">Record Length</div>
                 <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setRecordingDurationMode('INFINITE')}
                      className={`px-2 py-1 text-[8px] border uppercase ${recordingDurationMode === 'INFINITE' ? 'bg-[var(--highlight)] text-black border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                    >
                      Infinity
                    </button>
                    <button
                      onClick={() => canUseTimedRecording && setRecordingDurationMode('ORIGINAL')}
                      disabled={!canUseTimedRecording}
                      className={`px-2 py-1 text-[8px] border uppercase disabled:opacity-40 disabled:cursor-not-allowed ${recordingDurationMode === 'ORIGINAL' ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => canUseTimedRecording && setRecordingDurationMode('LOOPS')}
                      disabled={!canUseTimedRecording}
                      className={`px-2 py-1 text-[8px] border uppercase disabled:opacity-40 disabled:cursor-not-allowed ${recordingDurationMode === 'LOOPS' ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-white' : 'bg-black border-[var(--border-module)] text-[var(--text-muted)]'}`}
                    >
                      Loops
                    </button>
                 </div>

                 {recordingDurationMode === 'LOOPS' && (
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-[8px] uppercase text-[var(--text-secondary)]">Loop Count</span>
                     <div className="flex items-center gap-1">
                       <button
                         onClick={() => setRecordingLoops(Math.max(1, recordingLoops - 1))}
                         className="px-2 py-0.5 text-[10px] border border-[var(--border-module)] bg-black"
                       >
                         -
                       </button>
                       <span className="min-w-[2ch] text-center text-[10px]">{recordingLoops}</span>
                       <button
                         onClick={() => setRecordingLoops(Math.min(99, recordingLoops + 1))}
                         className="px-2 py-0.5 text-[10px] border border-[var(--border-module)] bg-black"
                       >
                         +
                       </button>
                     </div>
                   </div>
                 )}

                 {!canUseTimedRecording && (
                   <div className="text-[8px] text-[var(--text-muted)] uppercase">Timed modes require an imported video file.</div>
                 )}
                 {canUseTimedRecording && sourceVideoDuration && (
                   <div className="text-[8px] text-[var(--text-muted)] uppercase">
                     Source: {sourceVideoDuration.toFixed(2)}s
                   </div>
                 )}
               </div>
               
            </div>
         </div>
      </PanelModule>
    </div>
  );
};

