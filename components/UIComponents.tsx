
import React from 'react';
import { PICO_COLORS } from '../engineTypes';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'hardware';
  label: string;
  icon?: React.ReactNode;
}

export const PixelButton: React.FC<ButtonProps> = ({ variant = 'primary', label, icon, className = '', ...props }) => {
  const baseStyle = "font-mono text-sm uppercase px-4 py-2 transition-all active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 relative";
  
  let variantStyle = "";
  // Use CSS vars for standard interactive elements, but keep specific semantic colors (like danger) unless theme overrides deeply.
  // We map 'primary' to the theme's accent color.
  if (variant === 'primary') variantStyle = `bg-[var(--accent)] text-[var(--text-on-accent)] hover:opacity-90 shadow-[4px_4px_0_var(--shadow-color)]`;
  if (variant === 'secondary') variantStyle = `bg-[var(--bg-module)] text-[var(--text-primary)] border-2 border-[var(--border-module)] hover:bg-[var(--bg-panel)] shadow-[4px_4px_0_var(--shadow-color)]`;
  if (variant === 'danger') variantStyle = `bg-[${PICO_COLORS.darkPurple}] text-[${PICO_COLORS.peach}] shadow-[4px_4px_0_#ff004d]`;
  if (variant === 'ghost') variantStyle = "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-module)]";
  if (variant === 'hardware') variantStyle = `bg-[var(--border-module)] text-[var(--bg-module)] border-2 border-[var(--border-panel)] shadow-[2px_2px_0_var(--shadow-color)] active:translate-y-1 hover:text-[var(--text-primary)]`;

  return (
    <button className={`${baseStyle} ${variantStyle} ${className}`} {...props}>
      {icon}
      <span>{label}</span>
    </button>
  );
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

export const PixelSlider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange }) => {
  return (
    <div className="flex flex-col gap-2 mb-5">
      <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-bold tracking-wider">
        <span className="uppercase">{label}</span>
        <span className="font-mono text-[var(--bg-app)] bg-[var(--highlight)] px-1">{value}</span>
      </div>
      <div className="relative h-6 flex items-center">
        {/* Track */}
        <div className="absolute w-full h-2 bg-[var(--bg-app)] border border-[var(--border-module)] shadow-[inset_0_2px_4px_var(--shadow-color)]"></div>
        {/* Input */}
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-full appearance-none bg-transparent cursor-pointer z-10 opacity-0"
        />
        {/* Custom Thumb visual based on position */}
        <div 
            className="absolute h-6 w-3 bg-[var(--text-muted)] border-t-2 border-l-2 border-[var(--text-primary)] border-b-2 border-r-2 border-[var(--border-module)] shadow-[2px_2px_5px_var(--shadow-color)] pointer-events-none"
            style={{ 
                left: `calc(${((value - min) / (max - min)) * 100}% - 6px)` 
            }}
        >
            <div className="w-full h-[2px] bg-[var(--border-module)] mt-2"></div>
        </div>
      </div>
    </div>
  );
};

// New Hardware Module Style
export const PanelModule: React.FC<{ title: string; children: React.ReactNode, className?: string, headerColor?: string }> = ({ 
    title, children, className, headerColor = 'var(--border-module)' 
}) => (
  <div className={`bg-[var(--bg-module)] border-2 border-[var(--border-module)] relative ${className} shadow-[4px_4px_0_var(--shadow-color)]`}>
    {/* Screws */}
    <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[var(--border-panel)] shadow-[inset_1px_1px_1px_rgba(0,0,0,1)] flex items-center justify-center"><div className="w-full h-[1px] bg-[var(--text-secondary)] rotate-45"></div></div>
    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--border-panel)] shadow-[inset_1px_1px_1px_rgba(0,0,0,1)] flex items-center justify-center"><div className="w-full h-[1px] bg-[var(--text-secondary)] rotate-45"></div></div>
    <div className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-[var(--border-panel)] shadow-[inset_1px_1px_1px_rgba(0,0,0,1)] flex items-center justify-center"><div className="w-full h-[1px] bg-[var(--text-secondary)] rotate-45"></div></div>
    <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--border-panel)] shadow-[inset_1px_1px_1px_rgba(0,0,0,1)] flex items-center justify-center"><div className="w-full h-[1px] bg-[var(--text-secondary)] rotate-45"></div></div>

    {/* Header */}
    <div className="bg-[var(--bg-module)] border-b-2 border-[var(--border-module)] px-4 py-1 mb-2 mx-1 mt-1 flex justify-between items-center">
        <h3 className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{title}</h3>
        <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: headerColor }}></div>
    </div>
    
    <div className="p-3 pt-1">
        {children}
    </div>
  </div>
);

export const PixelCard: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <PanelModule title={title} className={className}>{children}</PanelModule>
);

