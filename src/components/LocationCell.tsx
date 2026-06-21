import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { searchByZipOrCity, ZipCodeData } from "@/utils/zipCodeLookup";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface LocationCellProps {
  value: string | null;
  onSave: (value: string) => void;
  disabled?: boolean;
}

export function LocationCell({ value, onSave, disabled = false }: LocationCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ZipCodeData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
  }, [disabled]);

  const handleTouchStart = () => {
    if (disabled) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      startEdit();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Extract city from existing value when editing
  useEffect(() => {
    if (isEditing && value) {
      const cityMatch = value.match(/^([^,]+)/);
      if (cityMatch) {
        setCityInput(cityMatch[1].trim());
      }
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Search for cities as user types
  useEffect(() => {
    const searchCities = async () => {
      if (cityInput.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchByZipOrCity(cityInput, 20);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error searching cities:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchCities, 300);
    return () => clearTimeout(debounceTimer);
  }, [cityInput]);

  const selectLocation = (zipData: ZipCodeData) => {
    const formattedLocation = `${zipData.city}, ${zipData.state_id} ${zipData.zip}`;
    onSave(formattedLocation);
    
    // Close the editor
    setIsEditing(false);
    setCityInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    toast({
      title: "Location updated",
      description: `Set to ${formattedLocation}`,
    });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCityInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setCityInput("");
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === "Enter" && selectedIndex >= 0 && suggestions[selectedIndex]) {
      e.preventDefault();
      selectLocation(suggestions[selectedIndex]);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only close if clicking outside both input and suggestions
    if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
      setTimeout(() => {
        setIsEditing(false);
        setCityInput("");
        setSuggestions([]);
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }, 200);
    }
  };

  if (isEditing && !disabled) {
    return (
      <div className="relative w-full">
        <div className="relative">
          <Input
            ref={inputRef}
            value={cityInput}
            onChange={handleCityChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-8 w-full pr-8"
            placeholder="Type city or zip..."
            autoComplete="off"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
        
        {showSuggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
          >
            <div className="max-h-[180px] overflow-y-auto p-1">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.zip}-${index}`}
                  className={`px-3 py-2 cursor-pointer rounded-sm text-sm hover:bg-accent hover:text-accent-foreground ${
                    index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
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

  return (
    <div
      onClick={() => {
        if (disabled || isLongPress.current) return;
        setIsEditing(true);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={`px-2 py-1 rounded min-h-[32px] flex items-center whitespace-nowrap ${
        disabled 
          ? "cursor-not-allowed opacity-50" 
          : "cursor-pointer hover:bg-muted/50 active:bg-muted"
      }`}
      title={disabled ? "Cannot edit archived load" : "Double-click or long-press to edit"}
    >
      {value !== null && value !== undefined && value !== "" ? (
        value
      ) : (
        <span className="text-muted-foreground">{disabled ? "" : "Tap to edit"}</span>
      )}
    </div>
  );
}
