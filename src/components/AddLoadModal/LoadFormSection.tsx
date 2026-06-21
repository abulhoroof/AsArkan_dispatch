import { useState, useEffect } from "react";
import { EnrichedDriver } from "@/types/enrichedDriver";
import { Load } from "@/types/load";
import { ContractTypeBadge } from "@/components/ContractTypeBadge";
import { LocationSearchInput } from "@/components/LocationSearchInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Truck, X, MapPin, Navigation, Loader2, Route, CalendarIcon, DollarSign, TrendingUp, Sparkles, RotateCcw, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

interface LoadFormSectionProps {
  selectedDriver: EnrichedDriver | null;
  onClearDriver: () => void;
  pickupLocation: string;
  onPickupLocationChange: (location: string) => void;
  calculatedDH: number | null;
  onDHCalculated: (dh: number | null) => void;
  // New props for expanded form
  deliveryLocation: string;
  onDeliveryLocationChange: (location: string) => void;
  tripMiles: number | null;
  onTripMilesChange: (miles: number | null) => void;
  pickupDate: string;
  onPickupDateChange: (date: string) => void;
  deliveryDate: string;
  onDeliveryDateChange: (date: string) => void;
  loadNumber: string;
  onLoadNumberChange: (value: string) => void;
  loadAmount: number | null;
  onLoadAmountChange: (value: number | null) => void;
  tarpStatus: Load["TARP STATUS"];
  onTarpStatusChange: (value: Load["TARP STATUS"]) => void;
  extraStops: number | null;
  onExtraStopsChange: (value: number | null) => void;
}

// Bounded caches for distance calculations
const dhCache: Record<string, number> = {};
const tripCache: Record<string, number> = {};
const CACHE_MAX_SIZE = 500;

function boundedCacheSet(cache: Record<string, number>, key: string, value: number) {
  const keys = Object.keys(cache);
  if (keys.length >= CACHE_MAX_SIZE) {
    delete cache[keys[0]];
  }
  cache[key] = value;
}

// Check if location string contains a valid zip code (5 digits)
const hasValidZip = (location: string): boolean => {
  const zipMatch = location.match(/\b\d{5}\b/);
  return !!zipMatch;
};

export const LoadFormSection = ({
  selectedDriver,
  onClearDriver,
  pickupLocation,
  onPickupLocationChange,
  calculatedDH,
  onDHCalculated,
  deliveryLocation,
  onDeliveryLocationChange,
  tripMiles,
  onTripMilesChange,
  pickupDate,
  onPickupDateChange,
  deliveryDate,
  onDeliveryDateChange,
  loadNumber,
  onLoadNumberChange,
  loadAmount,
  onLoadAmountChange,
  tarpStatus,
  onTarpStatusChange,
  extraStops,
  onExtraStopsChange,
}: LoadFormSectionProps) => {
  const { dropdownConfig } = useSettings();
  const [isCalculatingDH, setIsCalculatingDH] = useState(false);
  const [isCalculatingTrip, setIsCalculatingTrip] = useState(false);
  const [isValidPickup, setIsValidPickup] = useState(false);
  const [isValidDelivery, setIsValidDelivery] = useState(false);
  const [pickupDateOpen, setPickupDateOpen] = useState(false);

  // Sync validity when locations are pre-filled from parent (e.g. driver's last drop-off)
  useEffect(() => {
    if (pickupLocation && hasValidZip(pickupLocation)) {
      setIsValidPickup(true);
    }
  }, [pickupLocation]);

  useEffect(() => {
    if (deliveryLocation && hasValidZip(deliveryLocation)) {
      setIsValidDelivery(true);
    }
  }, [deliveryLocation]);
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);
  
  // Smart Delivery Date states
  const [isDeliveryDateAutoCalculated, setIsDeliveryDateAutoCalculated] = useState(false);
  const [userOverrodeDeliveryDate, setUserOverrodeDeliveryDate] = useState(false);
  
  // DH manual edit states
  const [lastCalculatedDH, setLastCalculatedDH] = useState<number | null>(null);
  const [isDHManuallyEdited, setIsDHManuallyEdited] = useState(false);
  
  // Trip manual edit states
  const [lastCalculatedTrip, setLastCalculatedTrip] = useState<number | null>(null);
  const [isTripManuallyEdited, setIsTripManuallyEdited] = useState(false);

  // Manual override state. The driver's "effective" starting location for DH
  // calculations is: override (if set) || persisted DB override || last delivery.
  // Editing here both updates the local state and persists to drivers.current_location_override.
  const persistedOverride = selectedDriver?.currentLocationOverride || null;
  const [overrideEditing, setOverrideEditing] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState<string>("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Reset override-editor state whenever the selected driver changes
  useEffect(() => {
    setOverrideEditing(false);
    setOverrideDraft(persistedOverride || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriver?.driver_id]);

  const effectiveStartingLocation =
    persistedOverride || selectedDriver?.lastDeliveryLocation || null;

  const driverHasValidLocation =
    !!effectiveStartingLocation && hasValidZip(effectiveStartingLocation);

  // Calculate DH only when driver location and pickup are valid
  useEffect(() => {
    const calculateDH = async () => {
      // Early exit if conditions aren't met
      if (!driverHasValidLocation || !isValidPickup) {
        if (!pickupLocation) onDHCalculated(null);
        return;
      }

      const fromPlace = effectiveStartingLocation;
      const toPlace = pickupLocation;

      // Guard: ensure both values are non-empty strings
      if (!fromPlace || !toPlace || fromPlace.trim() === '' || toPlace.trim() === '') {
        return;
      }

      const cacheKey = `${fromPlace}|${toPlace}`;
      if (dhCache[cacheKey] !== undefined) {
        const cachedValue = dhCache[cacheKey];
        setLastCalculatedDH(cachedValue);
        onDHCalculated(cachedValue);
        setIsDHManuallyEdited(false);
        return;
      }

      setIsCalculatingDH(true);
      try {
        const { data, error } = await supabase.functions.invoke("calculate-distance", {
          body: { fromPlace, toPlace },
        });

        if (error || data?.success === false) {
          onDHCalculated(null);
          setLastCalculatedDH(null);
          return;
        }

        const distance = data?.distance ?? null;
        if (distance !== null) {
          boundedCacheSet(dhCache, cacheKey, distance);
          setLastCalculatedDH(distance);
          setIsDHManuallyEdited(false);
        }
        onDHCalculated(distance);
      } catch (error) {
        console.error("Failed to calculate DH:", error);
        onDHCalculated(null);
        setLastCalculatedDH(null);
      } finally {
        setIsCalculatingDH(false);
      }
    };

    calculateDH();
  }, [driverHasValidLocation, isValidPickup, pickupLocation, selectedDriver, effectiveStartingLocation, onDHCalculated]);

  // Calculate Trip Miles when both pickup and delivery are valid
  useEffect(() => {
    const calculateTrip = async () => {
      // Early exit if conditions aren't met
      if (!isValidPickup || !isValidDelivery) {
        if (!deliveryLocation) onTripMilesChange(null);
        return;
      }

      const fromPlace = pickupLocation;
      const toPlace = deliveryLocation;

      // Guard: ensure both values are non-empty strings
      if (!fromPlace || !toPlace || fromPlace.trim() === '' || toPlace.trim() === '') {
        return;
      }

      const cacheKey = `${fromPlace}|${toPlace}`;
      if (tripCache[cacheKey] !== undefined) {
        const cachedValue = tripCache[cacheKey];
        setLastCalculatedTrip(cachedValue);
        onTripMilesChange(cachedValue);
        setIsTripManuallyEdited(false);
        return;
      }

      setIsCalculatingTrip(true);
      try {
        const { data, error } = await supabase.functions.invoke("calculate-distance", {
          body: { fromPlace, toPlace },
        });

        if (error || data?.success === false) {
          onTripMilesChange(null);
          setLastCalculatedTrip(null);
          return;
        }

        const distance = data?.distance ?? null;
        if (distance !== null) {
          boundedCacheSet(tripCache, cacheKey, distance);
          setLastCalculatedTrip(distance);
          setIsTripManuallyEdited(false);
        }
        onTripMilesChange(distance);
      } catch (error) {
        console.error("Failed to calculate Trip Miles:", error);
        onTripMilesChange(null);
        setLastCalculatedTrip(null);
      } finally {
        setIsCalculatingTrip(false);
      }
    };

    calculateTrip();
  }, [isValidPickup, isValidDelivery, pickupLocation, deliveryLocation, onTripMilesChange]);

  // Calculate total miles and RPM
  const totalMiles = (calculatedDH ?? 0) + (tripMiles ?? 0);
  const rpm = totalMiles > 0 && loadAmount ? loadAmount / totalMiles : null;

  // Parse date from multiple formats (ISO, MM/DD/YYYY, MM/DD/YY)
  const parseDateLocal = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    
    // ISO format: YYYY-MM-DD (primary storage format)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Legacy: MM/DD/YY format
    try {
      return parse(dateStr, "MM/dd/yy", new Date());
    } catch {
      return undefined;
    }
  };

  // Format date to ISO for storage (YYYY-MM-DD)
  const formatDateString = (date: Date): string => {
    return format(date, "yyyy-MM-dd");
  };

  // Smart Delivery Date: Auto-calculate based on trip miles
  useEffect(() => {
    // Guard 1: User already picked a date manually - respect their choice
    if (userOverrodeDeliveryDate) return;
    
    // Guard 2: No pickup date yet
    if (!pickupDate) return;
    
    // Guard 3: Invalid or missing miles (API failure protection)
    if (!tripMiles || tripMiles <= 0 || isNaN(tripMiles)) return;
    
    const pickupDateObj = parseDateLocal(pickupDate);
    if (!pickupDateObj) return;
    
    // Short haul threshold: same-day delivery for trips under 450 miles
    const daysNeeded = tripMiles < 450 ? 0 : Math.ceil(tripMiles / 550);
    
    const estimatedDelivery = new Date(pickupDateObj);
    estimatedDelivery.setDate(estimatedDelivery.getDate() + daysNeeded);
    
    // Extra safety: Validate the calculated date isn't Invalid Date
    if (isNaN(estimatedDelivery.getTime())) return;
    
    onDeliveryDateChange(formatDateString(estimatedDelivery));
    setIsDeliveryDateAutoCalculated(true);
  }, [tripMiles, pickupDate, userOverrodeDeliveryDate, onDeliveryDateChange]);

  // Reset auto-calculation states when driver changes or form resets
  useEffect(() => {
    if (!selectedDriver) {
      setUserOverrodeDeliveryDate(false);
      setIsDeliveryDateAutoCalculated(false);
      setLastCalculatedDH(null);
      setIsDHManuallyEdited(false);
      setLastCalculatedTrip(null);
      setIsTripManuallyEdited(false);
    }
  }, [selectedDriver]);

  // DH manual edit handlers
  const handleDHManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const numValue = val === "" ? null : parseFloat(val);
    onDHCalculated(numValue);
    setIsDHManuallyEdited(true);
  };

  const handleRefreshDH = () => {
    if (lastCalculatedDH !== null) {
      onDHCalculated(lastCalculatedDH);
      setIsDHManuallyEdited(false);
    }
  };

  // Trip manual edit handlers
  const handleTripManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const numValue = val === "" ? null : parseFloat(val);
    onTripMilesChange(numValue);
    setIsTripManuallyEdited(true);
  };

  const handleRefreshTrip = () => {
    if (lastCalculatedTrip !== null) {
      onTripMilesChange(lastCalculatedTrip);
      setIsTripManuallyEdited(false);
    }
  };

  // (parseDate and formatDateString moved above for useEffect usage)

  if (!selectedDriver) {
    return (
      <div className="flex items-center justify-center h-[60px] border-t border-dashed">
        <p className="text-sm text-muted-foreground">Select a driver above to add a load</p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4 space-y-4">
      {/* Selected driver chip */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-sm text-foreground truncate">{selectedDriver.name}</span>
          {selectedDriver.truckNumber && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Truck className="h-3 w-3" />
              #{selectedDriver.truckNumber}
            </span>
          )}
          <ContractTypeBadge type={selectedDriver.contractType} />
        </div>
        <button
          type="button"
          onClick={onClearDriver}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Driver's current starting location (with manual override) */}
      {(selectedDriver.lastDeliveryLocation || persistedOverride || overrideEditing) && (
        <div className="px-3 py-2 bg-accent/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              {persistedOverride ? "Starting from (manual):" : "Last drop-off:"}
            </span>
            <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
              {effectiveStartingLocation || "—"}
            </span>
            {!overrideEditing && (
              <button
                type="button"
                onClick={() => {
                  setOverrideDraft(persistedOverride || "");
                  setOverrideEditing(true);
                }}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                title="Override the driver's current starting location for this load's DH miles"
              >
                <Pencil className="h-3 w-3" />
                {persistedOverride ? "Change" : "Override"}
              </button>
            )}
            {!overrideEditing && persistedOverride && (
              <button
                type="button"
                disabled={overrideSaving}
                onClick={async () => {
                  if (!selectedDriver?.driver_id) return;
                  setOverrideSaving(true);
                  const { error } = await supabase
                    .from('drivers')
                    .update({
                      current_location_override: null,
                      current_location_override_set_at: null,
                    })
                    .eq('id', selectedDriver.driver_id);
                  setOverrideSaving(false);
                  if (error) {
                    console.error('Failed to clear override:', error);
                  } else if (selectedDriver) {
                    // Mutate the local view; the next driver refetch will sync DB state.
                    (selectedDriver as any).currentLocationOverride = null;
                    (selectedDriver as any).currentLocationOverrideSetAt = null;
                    setOverrideDraft("");
                  }
                }}
                className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                title="Revert to the driver's last actual delivery location"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
          {overrideEditing && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <LocationSearchInput
                  value={overrideDraft}
                  onChange={(val) => setOverrideDraft(val)}
                  onSelect={(val) => setOverrideDraft(val)}
                  placeholder="Enter city/state or 5-digit zip..."
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={overrideSaving || !hasValidZip(overrideDraft)}
                onClick={async () => {
                  if (!selectedDriver?.driver_id) return;
                  setOverrideSaving(true);
                  const trimmed = overrideDraft.trim();
                  const { error } = await supabase
                    .from('drivers')
                    .update({
                      current_location_override: trimmed,
                      current_location_override_set_at: new Date().toISOString(),
                    })
                    .eq('id', selectedDriver.driver_id);
                  setOverrideSaving(false);
                  if (error) {
                    console.error('Failed to set override:', error);
                    return;
                  }
                  // Reflect locally so DH recalculates immediately
                  (selectedDriver as any).currentLocationOverride = trimmed;
                  (selectedDriver as any).currentLocationOverrideSetAt = new Date().toISOString();
                  setOverrideEditing(false);
                }}
              >
                {overrideSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={overrideSaving}
                onClick={() => {
                  setOverrideEditing(false);
                  setOverrideDraft(persistedOverride || "");
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {persistedOverride && selectedDriver.lastDeliveryLocation && !overrideEditing && (
            <div className="text-xs text-muted-foreground pl-6">
              Actual last drop-off: {selectedDriver.lastDeliveryLocation}
            </div>
          )}
        </div>
      )}

      {/* Pickup location input */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Pickup Location <span className="text-destructive">*</span></Label>
        <LocationSearchInput
          value={pickupLocation}
          onChange={(val, isValidSelection) => {
            onPickupLocationChange(val);
            setIsValidPickup(isValidSelection || hasValidZip(val));
          }}
          onSelect={(val) => {
            onPickupLocationChange(val);
            setIsValidPickup(true);
          }}
          placeholder="Enter pickup city/state or 5-digit zip..."
        />
      </div>

      {/* Delivery location + Extra Stops row */}
      <div className="grid grid-cols-[3fr_1fr] gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Delivery Location <span className="text-destructive">*</span></Label>
          <LocationSearchInput
            value={deliveryLocation}
            onChange={(val, isValidSelection) => {
              onDeliveryLocationChange(val);
              setIsValidDelivery(isValidSelection || hasValidZip(val));
            }}
            onSelect={(val) => {
              onDeliveryLocationChange(val);
              setIsValidDelivery(true);
            }}
            placeholder="Enter delivery city/state or 5-digit zip..."
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Extra Stops</Label>
          <Input
            type="number"
            min={0}
            value={extraStops ?? ""}
            onChange={(e) => onExtraStopsChange(e.target.value === "" ? null : parseInt(e.target.value))}
            placeholder="0"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Miles display - DH, Trip, Total */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1 px-2 py-2 bg-muted/50 rounded-lg">
          <span className="text-xs text-muted-foreground">DH:</span>
          {isCalculatingDH ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : calculatedDH !== null ? (
            <div className="flex items-center gap-0.5">
              <Input
                type="number"
                value={Math.round(calculatedDH)}
                onChange={handleDHManualChange}
                className="w-12 h-6 px-1 text-sm font-semibold text-primary text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-muted-foreground">mi</span>
              {isDHManuallyEdited && lastCalculatedDH !== null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleRefreshDH}
                        className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset to calculated {Math.round(lastCalculatedDH)} mi</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center gap-1 px-2 py-2 bg-muted/50 rounded-lg">
          <span className="text-xs text-muted-foreground">Trip:</span>
          {isCalculatingTrip ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : tripMiles !== null ? (
            <div className="flex items-center gap-0.5">
              <Input
                type="number"
                value={Math.round(tripMiles)}
                onChange={handleTripManualChange}
                className="w-12 h-6 px-1 text-sm font-semibold text-primary text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-muted-foreground">mi</span>
              {isTripManuallyEdited && lastCalculatedTrip !== null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleRefreshTrip}
                        className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset to calculated {Math.round(lastCalculatedTrip)} mi</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center gap-1 px-2 py-2 bg-primary/10 rounded-lg">
          <span className="text-xs text-muted-foreground">Total:</span>
          {isCalculatingDH || isCalculatingTrip ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : calculatedDH !== null && tripMiles !== null ? (
            <span className="text-sm font-semibold text-primary">{Math.round(calculatedDH + tripMiles)} mi</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Date pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Pickup Date <span className="text-destructive">*</span></Label>
          <Popover open={pickupDateOpen} onOpenChange={setPickupDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !pickupDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {pickupDate || "Select..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDateLocal(pickupDate)}
                onSelect={(date) => {
                  if (date) {
                    onPickupDateChange(formatDateString(date));
                    setPickupDateOpen(false);
                  }
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Delivery Date <span className="text-destructive">*</span></Label>
          <Popover open={deliveryDateOpen} onOpenChange={setDeliveryDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !deliveryDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deliveryDate || "Select..."}
                
                {/* Visual indicator for auto-calculated date */}
                {isDeliveryDateAutoCalculated && deliveryDate && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-auto flex items-center gap-1 text-amber-500">
                          <Sparkles className="h-3 w-3" />
                          <span className="text-xs font-medium">Est.</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Estimated for Solo Driver</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDateLocal(deliveryDate)}
                onSelect={(date) => {
                  if (date) {
                    onDeliveryDateChange(formatDateString(date));
                    setDeliveryDateOpen(false);
                    // Mark as user override and remove auto-calculation indicator
                    setUserOverrodeDeliveryDate(true);
                    setIsDeliveryDateAutoCalculated(false);
                  }
                }}
                disabled={(calendarDate) => {
                  const pickupDateObj = parseDateLocal(pickupDate);
                  return pickupDateObj ? calendarDate < pickupDateObj : false;
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Load # and Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Load # <span className="text-destructive">*</span></Label>
          <Input
            value={loadNumber}
            onChange={(e) => onLoadNumberChange(e.target.value)}
            placeholder="Enter load number"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Rate <span className="text-destructive">*</span></Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={loadAmount ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                onLoadAmountChange(val === "" ? null : parseFloat(val));
              }}
              placeholder="0.00"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Tarp Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Tarp Status</Label>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="untarped"
              checked={tarpStatus === "Untarped"}
              onCheckedChange={() => onTarpStatusChange("Untarped")}
            />
            <Label htmlFor="untarped" className="text-sm text-foreground cursor-pointer">
              Untarped
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="tarped"
              checked={tarpStatus === "Tarped"}
              onCheckedChange={() => onTarpStatusChange("Tarped")}
            />
            <Label htmlFor="tarped" className="text-sm text-foreground cursor-pointer">
              Tarped
            </Label>
          </div>
        </div>
      </div>

      {/* RPM Summary */}
      {(totalMiles > 0 || loadAmount) && (
        <div className="flex items-center gap-3 px-3 py-2 bg-accent rounded-lg">
          <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex items-center gap-4 text-sm">
            {totalMiles > 0 && (
              <span className="text-muted-foreground">
                Total: <span className="font-medium text-foreground">{Math.round(totalMiles)} mi</span>
              </span>
            )}
            {rpm !== null && (
              <span className="text-muted-foreground">
                RPM: <span className="font-semibold text-primary">${rpm.toFixed(2)}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
