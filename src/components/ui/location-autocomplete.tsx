import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, X, Check } from 'lucide-react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onValidSelection: (isValid: boolean) => void;
  placeholder?: string;
}

interface NominatimResult {
  display_name: string;
  place_id: number;
}

const LocationAutocomplete = ({ value, onChange, onValidSelection, placeholder = "Rechercher une adresse, un stade..." }: LocationAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<{ label: string; id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(value || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedLabel !== '' && query === selectedLabel;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      // Search with addressdetails for better results
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&countrycodes=fr&accept-language=fr&addressdetails=1`,
        { headers: { 'User-Agent': 'BluePitchDash/1.0' } }
      );
      const data: NominatimResult[] = await res.json();

      const seen = new Set<string>();
      const combined: { label: string; id: string }[] = [];

      for (const item of data) {
        const parts = item.display_name.split(', ');
        const short = parts.slice(0, 4).join(', ');
        if (!seen.has(short)) {
          seen.add(short);
          combined.push({ label: short, id: `nom-${item.place_id}` });
        }
      }

      // If query looks like "Stade/Terrain X", also search for the city to generate a suggestion
      const locationMatch = q.match(/^(?:stade|terrain|gymnase|salle|complexe)\s+(?:de\s+|d'|du\s+|des\s+|municipal\s+)?(.+)/i);
      if (locationMatch && combined.length < 3) {
        const cityName = locationMatch[1].trim();
        if (cityName.length >= 2) {
          const cityRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=3&countrycodes=fr&accept-language=fr&featuretype=city`,
            { headers: { 'User-Agent': 'BluePitchDash/1.0' } }
          );
          const cityData: NominatimResult[] = await cityRes.json();
          for (const item of cityData) {
            const cityParts = item.display_name.split(', ');
            // Use the user's original text + city context
            const fullLabel = `${q}, ${cityParts.slice(0, 3).join(', ')}`;
            if (!seen.has(fullLabel)) {
              seen.add(fullLabel);
              combined.unshift({ label: fullLabel, id: `city-${item.place_id}` });
            }
          }
        }
      }

      setResults(combined.slice(0, 6));
      setShowDropdown(combined.length > 0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    // If user modifies text after selecting, invalidate
    if (val !== selectedLabel) {
      setSelectedLabel('');
      onValidSelection(false);
      onChange('');
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (result: { label: string }) => {
    setQuery(result.label);
    setSelectedLabel(result.label);
    onChange(result.label);
    onValidSelection(true);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedLabel('');
    onChange('');
    onValidSelection(false);
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
      <input
        type="text"
        placeholder={placeholder}
        className={`w-full pl-10 pr-10 py-3 bg-secondary border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all ${
          isSelected ? 'border-green-500/50 bg-green-500/5' : 'border-border'
        }`}
        value={query}
        onChange={handleInputChange}
        onFocus={() => results.length > 0 && !isSelected && setShowDropdown(true)}
      />
      {isLoading && (
        <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
      )}
      {!isLoading && isSelected && (
        <Check size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-green-500" />
      )}
      {!isLoading && query && !isSelected && (
        <button onClick={handleClear} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      )}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors first:rounded-t-xl last:rounded-b-xl flex items-start gap-2"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-accent" />
              <span className="line-clamp-2">{r.label}</span>
            </button>
          ))}
        </div>
      )}
      {!isSelected && query.length >= 3 && !isLoading && results.length === 0 && !showDropdown && (
        <p className="text-[11px] text-destructive mt-1">Aucun résultat. Essaie avec le nom de la ville.</p>
      )}
    </div>
  );
};

export default LocationAutocomplete;
