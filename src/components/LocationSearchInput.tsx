import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { searchByZipOrCity, ZipCodeData } from "@/utils/zipCodeLookup";
import { Loader2, MapPin } from "lucide-react";

interface LocationSearchInputProps {
  value: string;
  onChange: (value: string, isValidSelection: boolean) => void;
  onSelect: (location: string) => void;
  placeholder?: string;
  className?: string;
}

export function LocationSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = "Type city or zip code...",
  className,
}: LocationSearchInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ZipCodeData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Search for cities as user types
  useEffect(() => {
    const searchCities = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchByZipOrCity(value, 20);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Error searching cities:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchCities, 300);
    return () => clearTimeout(debounceTimer);
  }, [value]);

  const selectLocation = (zipData: ZipCodeData) => {
    const formattedLocation = `${zipData.city}, ${zipData.state_id} ${zipData.zip}`;
    onChange(formattedLocation, true);
    onSelect(formattedLocation);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && suggestions[selectedIndex]) {
      e.preventDefault();
      selectLocation(suggestions[selectedIndex]);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
      setTimeout(() => {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }, 200);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value, false)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`pl-9 pr-8 ${className}`}
          placeholder={placeholder}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-[9999] w-full mt-1 rounded-md shadow-xl border border-border bg-white dark:bg-gray-800"
          style={{ position: 'absolute' }}
        >
          <div className="max-h-[200px] overflow-y-auto p-1 bg-white dark:bg-gray-800 rounded-md">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.zip}-${index}`}
                className={`px-3 py-2 cursor-pointer rounded-sm text-sm hover:bg-accent hover:text-accent-foreground ${
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : ""
                }`}
                onClick={() => selectLocation(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-medium">
                  {suggestion.city}, {suggestion.state_id}
                </div>
                <div className="text-xs text-muted-foreground">
                  {suggestion.zip} • {suggestion.county_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
