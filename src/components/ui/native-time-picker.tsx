import React, { useRef } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NativeTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const NativeTimePicker = ({
  value,
  onChange,
  placeholder = 'Sélectionner une heure',
  className,
}: NativeTimePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    return `${h}h${m}`;
  };

  const handleTap = () => {
    if (inputRef.current) {
      try { inputRef.current.showPicker(); } catch {}
      inputRef.current.click();
      inputRef.current.focus();
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Styled visible layer (hidden on desktop, shown on mobile) */}
      <div
        className="flex items-center gap-3 w-full px-4 py-3.5 bg-secondary border border-border rounded-xl transition-all cursor-pointer md:hidden"
        onClick={handleTap}
      >
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Clock size={18} className="text-accent" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Heure
          </span>
          <span className={cn("text-[15px] font-medium truncate leading-tight mt-0.5", value ? 'text-foreground' : 'text-muted-foreground')}>
            {value ? formatDisplayTime(value) : placeholder}
          </span>
        </div>
        <div className="text-muted-foreground/40 text-xs shrink-0">▼</div>
      </div>

      {/* Hidden native input for mobile (overlays the styled layer) */}
      <input
        ref={inputRef}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer md:hidden"
        style={{ fontSize: '16px' }}
      />

      {/* Desktop: visible native input with custom styling */}
      <div className="hidden md:flex items-center gap-3 w-full px-4 py-3.5 bg-secondary border border-border rounded-xl transition-all focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/50">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Clock size={18} className="text-accent" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Heure
          </span>
          <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent text-[15px] font-medium text-foreground outline-none w-full mt-0.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            placeholder={placeholder}
          />
        </div>
      </div>
    </div>
  );
};

export default NativeTimePicker;
