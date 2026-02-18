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
  name?: string;
  class?: string;
  type?: string;
}

const LocationAutocomplete = ({ value, onChange, placeholder = "Rechercher un lieu, une ville..." }: LocationAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<{ label: string; id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      // Two parallel searches: one for the exact query, one for the city/town name
      // This helps find small municipal stadiums that aren't in OSM
      const queries = [
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=fr&accept-language=fr`,
          { headers: { 'User-Agent': 'BluePitchDash/1.0' } }
        ),
      ];

      // If the query looks like "Stade X" or "Terrain X", also search for the city
      const locationMatch = q.match(/^(?:stade|terrain|gymnase|salle|complexe)\s+(?:de\s+|d'|du\s+|des\s+)?(.+)/i);
      if (locationMatch) {
        const cityName = locationMatch[1].trim();
        if (cityName.length >= 2) {
          queries.push(
            fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=3&countrycodes=fr&accept-language=fr&featuretype=city`,
              { headers: { 'User-Agent': 'BluePitchDash/1.0' } }
            )
          );
        }
      }

      const responses = await Promise.all(queries);
      const allData = await Promise.all(responses.map(r => r.json()));

      const seen = new Set<string>();
      const combined: { label: string; id: string }[] = [];

      // Add direct results
      for (const item of (allData[0] as NominatimResult[])) {
        // Shorten display_name: keep first 3-4 parts
        const parts = item.display_name.split(', ');
        const short = parts.slice(0, 4).join(', ');
        if (!seen.has(short)) {
          seen.add(short);
          combined.push({ label: short, id: `nom-${item.place_id}` });
        }
      }

      // If we searched for a city, add "Stade de [city]" as a suggestion
      if (allData[1]) {
        const prefix = q.match(/^(stade|terrain|gymnase|salle|complexe)/i)?.[1] || 'Stade';
        for (const item of (allData[1] as NominatimResult[])) {
          const cityParts = item.display_name.split(', ');
          const cityLabel = `${prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()} de ${cityParts[0]}`;
          const fullLabel = `${cityLabel}, ${cityParts.slice(0, 3).join(', ')}`;
          if (!seen.has(fullLabel)) {
            seen.add(fullLabel);
            combined.unshift({ label: fullLabel, id: `city-${item.place_id}` });
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
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (result: { label: string }) => {
    setQuery(result.label);
    onChange(result.label);
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
    </div>
  );
};

export default LocationAutocomplete;
