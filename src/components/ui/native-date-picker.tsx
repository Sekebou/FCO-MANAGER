import React, { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NativeDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  min?: string;
}

const NativeDatePicker = ({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  className,
  icon,
  min,
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
    try { inputRef.current?.showPicker?.(); } catch {}
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Mobile: styled overlay with hidden native input */}
      <div
        className="flex items-center gap-3 w-full px-4 py-3.5 bg-secondary border border-border rounded-xl transition-all cursor-pointer md:hidden"
        onClick={handleTapWrapper}
      >
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          {icon || <CalendarDays size={18} className="text-accent" />}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Date
          </span>
          <span className={cn("text-[15px] font-medium truncate leading-tight mt-0.5", value ? 'text-foreground' : 'text-muted-foreground')}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>
        <div className="text-muted-foreground/40 text-xs shrink-0">▼</div>
      </div>

      {/* Hidden native input for mobile */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer md:hidden"
        style={{ fontSize: '16px' }}
      />

      {/* Desktop: visible native input with custom styling — works on Windows */}
      <div className="hidden md:flex items-center gap-3 w-full px-4 py-3.5 bg-secondary border border-border rounded-xl transition-all focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/50">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          {icon || <CalendarDays size={18} className="text-accent" />}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Date
          </span>
          <input
            type="date"
            value={value}
            min={min}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent text-[15px] font-medium text-foreground outline-none w-full mt-0.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            placeholder={placeholder}
          />
        </div>
      </div>
    </div>
  );
};

export default NativeDatePicker;
