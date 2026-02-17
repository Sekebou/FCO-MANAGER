import React, { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NativeDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

const NativeDatePicker = ({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  className,
  icon,
}: NativeDatePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleTapWrapper = () => {
    inputRef.current?.showPicker?.();
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'relative w-full cursor-pointer',
        className
      )}
      onClick={handleTapWrapper}
    >
      {/* Visible styled layer */}
      <div
        className={cn(
          'flex items-center gap-3 w-full px-4 py-3.5 bg-secondary border border-border rounded-xl transition-all',
          'active:scale-[0.98] active:bg-secondary/80',
          value
            ? 'text-foreground'
            : 'text-muted-foreground'
        )}
      >
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          {icon || <CalendarDays size={18} className="text-accent" />}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Date
          </span>
          <span className="text-[15px] font-medium truncate leading-tight mt-0.5">
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>
        <div className="text-muted-foreground/40 text-xs shrink-0">▼</div>
      </div>

      {/* Hidden native input (triggers OS date picker on mobile) */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{ fontSize: '16px' }}
      />
    </div>
  );
};

export default NativeDatePicker;
