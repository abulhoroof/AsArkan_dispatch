import { useState } from "react";
import { format, subDays } from "date-fns";
import { CalendarIcon, Search, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LocationSearchInput } from "@/components/LocationSearchInput";

interface DriverSearchPanelProps {
  onDateChange: (pickupDate: Date | undefined) => void;
  onLocationSearch: (pickupLocation: string) => void;
  onClear: () => void;
  isSearching: boolean;
  matchCount?: number;
  totalCount?: number;
  selectedDate?: Date;
}

export const DriverSearchPanel = ({
  onDateChange,
  onLocationSearch,
  onClear,
  isSearching,
  matchCount,
  totalCount,
  selectedDate,
}: DriverSearchPanelProps) => {
  const [pickupLocation, setPickupLocation] = useState("");
  const [isValidLocation, setIsValidLocation] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    onDateChange(date);
  };

  const handleLocationChange = (value: string, isValid: boolean) => {
    setPickupLocation(value);
    setIsValidLocation(isValid);
  };

  const handleLocationSelect = (location: string) => {
    onLocationSearch(location);
  };

  const handleClear = () => {
    setPickupLocation("");
    setIsValidLocation(false);
    onClear();
  };

  const canSearchDistance = selectedDate && isValidLocation;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
        {/* Title */}
        <div className="flex-shrink-0 sm:pt-7">
          <h2 className="text-lg font-semibold text-foreground whitespace-nowrap">Find Available Drivers</h2>
        </div>

        {/* Pickup Date */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-muted-foreground mb-1 block">Pickup Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {selectedDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Showing drivers available {format(subDays(selectedDate, 2), "MMM d")} - {format(selectedDate, "MMM d")}
            </p>
          )}
        </div>

        {/* Pickup Location */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-muted-foreground mb-1 block">Pickup Location</label>
          <LocationSearchInput
            value={pickupLocation}
            onChange={handleLocationChange}
            onSelect={handleLocationSelect}
            placeholder="Type city or zip code..."
          />
          {pickupLocation && !isValidLocation && (
            <p className="text-xs text-amber-600 mt-1">Select a location from the list</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0">
          <label className="text-sm text-transparent mb-1 block sm:block hidden">Action</label>
          <div className="flex gap-2">
            <Button
              onClick={() => isValidLocation && onLocationSearch(pickupLocation)}
              disabled={!canSearchDistance || isSearching}
              className="min-w-[120px]"
            >
              {isSearching ? (
                <>Calculating...</>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1" />
                  Calculate DH
                </>
              )}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleClear} className="h-9 w-9">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset search</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Results count */}
      {matchCount !== undefined && totalCount !== undefined && (
        <div className="mt-3 text-sm">
          <span className="text-primary font-medium">{matchCount}</span>
          <span className="text-muted-foreground"> of {totalCount} drivers match your criteria</span>
        </div>
      )}
    </div>
  );
};
