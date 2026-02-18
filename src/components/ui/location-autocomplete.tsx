import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface NominatimResult {
  display_name: string;
  place_id: number;
}

const LocationAutocomplete = ({ value, onChange, placeholder = "Rechercher un stade, une adresse..." }: LocationAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=fr&accept-language=fr`,
        { headers: { 'User-Agent': 'BluePitchDash/1.0' } }
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setShowDropdown(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (result: NominatimResult) => {
    const name = result.display_name;
    setQuery(name);
    onChange(name);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
      <input
        type="text"
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all"
        value={query}
        onChange={handleInputChange}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
      />
      {isLoading && (
        <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
      )}
      {!isLoading && query && (
        <button onClick={handleClear} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      )}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors first:rounded-t-xl last:rounded-b-xl flex items-start gap-2"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-accent" />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
