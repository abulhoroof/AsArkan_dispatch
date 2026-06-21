import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RotateCcw } from "lucide-react";
import { EditableCell } from "./EditableCell";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface MileageCellProps {
  loadId?: string;
  pickupLocation: string | null;
  deliveryLocation: string | null;
  previousDeliveryLocation: string | null;
  tripMiles: number | null;
  dhMiles: number | null;
  onTripMilesChange: (value: number | null) => void;
  onDhMilesChange: (value: number | null) => void;
  disabled?: boolean;
}

// Global cache for storing calculated distances (survives re-mounts)
const distanceCache = new Map<string, number>();

// Persist location-key tracking by load ID so remounts don't lose "did location change?" context
const lastSavedTripLocByLoad = new Map<string, string>();
const lastSavedDHLocByLoad = new Map<string, string>();

// Request queue to serialize OSRM API calls (max ~1 req/sec)
let requestQueue: Promise<void> = Promise.resolve();
const enqueueRequest = (fn: () => Promise<void>): Promise<void> => {
  requestQueue = requestQueue.then(fn, fn);
  return requestQueue;
};

const calculateDistanceAPI = async (
  from: string,
  to: string
): Promise<number | null> => {
  const cacheKey = `${from}|${to}`;
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey)!;
  }

  return new Promise<number | null>((resolve) => {
    enqueueRequest(async () => {
      // Double-check cache after waiting in queue
      if (distanceCache.has(cacheKey)) {
        resolve(distanceCache.get(cacheKey)!);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke('calculate-distance', {
          body: { fromPlace: from, toPlace: to },
        });
        if (!error && data?.success && typeof data.distance === 'number') {
          distanceCache.set(cacheKey, data.distance);
          resolve(data.distance);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
};

export const MileageCell = ({
  loadId,
  pickupLocation,
  deliveryLocation,
  previousDeliveryLocation,
  tripMiles,
  dhMiles,
  onTripMilesChange,
  onDhMilesChange,
  disabled = false,
}: MileageCellProps) => {
  const [calculatedTrip, setCalculatedTrip] = useState<number | null>(null);
  const [calculatedDH, setCalculatedDH] = useState<number | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [dhLoading, setDhLoading] = useState(false);

  // Track the locations that the current DB-saved miles correspond to
  // so we know when a location change invalidates the saved value
  const lastSavedTripLocRef = useRef<string | null>(
    loadId ? (lastSavedTripLocByLoad.get(loadId) ?? null) : null
  );
  const lastSavedDHLocRef = useRef<string | null>(
    loadId ? (lastSavedDHLocByLoad.get(loadId) ?? null) : null
  );

  // Keep refs in sync when row identity changes
  useEffect(() => {
    lastSavedTripLocRef.current = loadId ? (lastSavedTripLocByLoad.get(loadId) ?? null) : null;
    lastSavedDHLocRef.current = loadId ? (lastSavedDHLocByLoad.get(loadId) ?? null) : null;
  }, [loadId]);

  const setLastSavedTripLoc = useCallback(
    (key: string | null) => {
      lastSavedTripLocRef.current = key;
      if (!loadId) return;
      if (key === null) {
        lastSavedTripLocByLoad.delete(loadId);
      } else {
        lastSavedTripLocByLoad.set(loadId, key);
      }
    },
    [loadId]
  );

  const setLastSavedDHLoc = useCallback(
    (key: string | null) => {
      lastSavedDHLocRef.current = key;
      if (!loadId) return;
      if (key === null) {
        lastSavedDHLocByLoad.delete(loadId);
      } else {
        lastSavedDHLocByLoad.set(loadId, key);
      }
    },
    [loadId]
  );

  // Build location keys for comparison
  const tripLocKey = pickupLocation && deliveryLocation
    ? `${pickupLocation}|${deliveryLocation}` : null;
  const dhLocKey = previousDeliveryLocation && pickupLocation
    ? `${previousDeliveryLocation}|${pickupLocation}` : null;

  // Calculate Trip distance (pickup → delivery)
  useEffect(() => {
    if (!pickupLocation || !deliveryLocation) {
      setCalculatedTrip(null);
      return;
    }

    const key = `${pickupLocation}|${deliveryLocation}`;

    // If we already have a DB-saved value AND the locations haven't changed since we last saved, use it
    if (tripMiles !== null && lastSavedTripLocRef.current === key) {
      setCalculatedTrip(tripMiles);
      return;
    }

    // Check in-memory cache (instant, no API call)
    if (distanceCache.has(key)) {
      setCalculatedTrip(distanceCache.get(key)!);
      return;
    }

    // Need to call API
    setTripLoading(true);
    let cancelled = false;

    calculateDistanceAPI(pickupLocation, deliveryLocation).then((dist) => {
      if (!cancelled) {
        setCalculatedTrip(dist);
        setTripLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [pickupLocation, deliveryLocation]);

  // Calculate DH distance (previous delivery → current pickup)
  useEffect(() => {
    if (!previousDeliveryLocation || !pickupLocation) {
      setCalculatedDH(null);
      return;
    }

    const key = `${previousDeliveryLocation}|${pickupLocation}`;

    if (dhMiles !== null && lastSavedDHLocRef.current === key) {
      setCalculatedDH(dhMiles);
      return;
    }

    if (distanceCache.has(key)) {
      setCalculatedDH(distanceCache.get(key)!);
      return;
    }

    setDhLoading(true);
    let cancelled = false;

    calculateDistanceAPI(previousDeliveryLocation, pickupLocation).then((dist) => {
      if (!cancelled) {
        setCalculatedDH(dist);
        setDhLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [previousDeliveryLocation, pickupLocation]);

  // Auto-save trip miles to DB when calculated value arrives or locations change
  useEffect(() => {
    if (calculatedTrip === null || tripLoading) return;

    const rounded = Math.round(calculatedTrip);
    const locChanged = lastSavedTripLocRef.current !== null && lastSavedTripLocRef.current !== tripLocKey;
    const firstRenderMismatch =
      lastSavedTripLocRef.current === null &&
      tripMiles !== null &&
      tripLocKey !== null &&
      tripMiles !== rounded;

    if (tripMiles === null || locChanged || firstRenderMismatch) {
      onTripMilesChange(rounded);
      setLastSavedTripLoc(tripLocKey);

      if (locChanged && tripMiles !== null) {
        toast({
          title: "Trip mileage recalculated",
          description: `Updated to ${rounded} mi based on new location`,
        });
      } else if (firstRenderMismatch) {
        toast({
          title: "Trip mileage synced",
          description: `Updated stale value to ${rounded} mi for current route`,
        });
      }
    } else if (lastSavedTripLocRef.current === null) {
      // First render with an existing DB value — record which location pair it belongs to
      setLastSavedTripLoc(tripLocKey);
    }
  }, [calculatedTrip, tripLoading, tripLocKey, tripMiles, onTripMilesChange, setLastSavedTripLoc]);

  // Auto-save DH miles to DB when calculated value arrives or locations change
  useEffect(() => {
    if (calculatedDH === null || dhLoading) return;

    const rounded = Math.round(calculatedDH);
    const locChanged = lastSavedDHLocRef.current !== null && lastSavedDHLocRef.current !== dhLocKey;
    const firstRenderMismatch =
      lastSavedDHLocRef.current === null &&
      dhMiles !== null &&
      dhLocKey !== null &&
      dhMiles !== rounded;

    if (dhMiles === null || locChanged || firstRenderMismatch) {
      onDhMilesChange(rounded);
      setLastSavedDHLoc(dhLocKey);

      if (locChanged && dhMiles !== null) {
        toast({
          title: "DH mileage recalculated",
          description: `Updated to ${rounded} mi based on location change`,
        });
      } else if (firstRenderMismatch) {
        toast({
          title: "DH mileage synced",
          description: `Updated stale value to ${rounded} mi for current route`,
        });
      }
    } else if (lastSavedDHLocRef.current === null) {
      setLastSavedDHLoc(dhLocKey);
    }
  }, [calculatedDH, dhLoading, dhLocKey, dhMiles, onDhMilesChange, setLastSavedDHLoc]);

  // Display values: use saved value if exists, otherwise use calculated
  const displayTrip = tripMiles ?? calculatedTrip;
  const displayDH = dhMiles ?? calculatedDH;

  // Check if values are manually overridden
  const isTripOverridden = tripMiles !== null && calculatedTrip !== null && tripMiles !== Math.round(calculatedTrip);
  const isDHOverridden = dhMiles !== null && calculatedDH !== null && dhMiles !== Math.round(calculatedDH);

  const handleTripEdit = (value: number | null) => {
    onTripMilesChange(value);
  };

  const handleDHEdit = (value: number | null) => {
    onDhMilesChange(value);
  };

  const handleResetTrip = () => {
    if (calculatedTrip !== null) {
      onTripMilesChange(Math.round(calculatedTrip));
      setLastSavedTripLoc(tripLocKey);
    }
  };

  const handleResetDH = () => {
    if (calculatedDH !== null) {
      onDhMilesChange(Math.round(calculatedDH));
      setLastSavedDHLoc(dhLocKey);
    }
  };

  // Calculate total from displayed values
  const totalMiles = (displayTrip ?? 0) + (displayDH ?? 0);

  return (
    <div className="space-y-0.5 text-xs">
      {/* Trip Row */}
      <div className="flex items-center gap-1 min-h-[20px]">
        <span className="text-muted-foreground">Trip:</span>
        {tripLoading && tripMiles === null ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : displayTrip !== null ? (
          <>
            <span className="font-medium">
              <EditableCell
                value={displayTrip}
                onSave={(value) => handleTripEdit(value as number | null)}
                type="number"
                disabled={disabled}
              />
            </span>
            <span className="text-muted-foreground">mi</span>
            {isTripOverridden && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleResetTrip}
                    className="p-0.5 hover:bg-muted rounded text-amber-500 hover:text-amber-600"
                    disabled={disabled}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset to calculated {Math.round(calculatedTrip!)} mi</p>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* DH Row */}
      <div className="flex items-center gap-1 min-h-[20px]">
        <span className="text-muted-foreground">DH:</span>
        {dhLoading && dhMiles === null ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span className="font-medium text-orange-600 dark:text-orange-400">
              <EditableCell
                value={displayDH}
                onSave={(value) => handleDHEdit(value as number | null)}
                type="number"
                disabled={disabled}
              />
            </span>
            {displayDH !== null && <span className="text-muted-foreground">mi</span>}
            {isDHOverridden && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleResetDH}
                    className="p-0.5 hover:bg-muted rounded text-amber-500 hover:text-amber-600"
                    disabled={disabled}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset to calculated {Math.round(calculatedDH!)} mi</p>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Total Row (read-only, auto-calculated) */}
      <div className="flex items-center gap-1 min-h-[20px]">
        <span className="text-muted-foreground">Total:</span>
        <span className="font-semibold">{totalMiles > 0 ? `${totalMiles} mi` : '—'}</span>
      </div>
    </div>
  );
};
