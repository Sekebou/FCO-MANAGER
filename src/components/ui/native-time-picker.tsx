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
    inputRef.current?.showPicker?.();
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn('relative w-full cursor-pointer', className)}
      onClick={handleTap}
    >
      {/* Visible styled layer */}
      <div
        className={cn(
          'flex items-center gap-3 w-full px-4 py-3.5 bg-secondary border border-border rounded-xl transition-all',
          'active:scale-[0.98] active:bg-secondary/80',
          value ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Clock size={18} className="text-accent" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Heure
          </span>
          <span className="text-[15px] font-medium truncate leading-tight mt-0.5">
            {value ? formatDisplayTime(value) : placeholder}
          </span>
        </div>
        <div className="text-muted-foreground/40 text-xs shrink-0">▼</div>
      </div>

      {/* Hidden native input (triggers OS time picker on mobile) */}
      <input
        ref={inputRef}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{ fontSize: '16px' }}
      />
    </div>
  );
};

export default NativeTimePicker;
