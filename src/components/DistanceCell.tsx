import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface DistanceCellProps {
  pickupLocation: string | null;
  deliveryLocation: string | null;
}

// Cache for storing calculated distances
const distanceCache = new Map<string, number>();

export const DistanceCell = ({ pickupLocation, deliveryLocation }: DistanceCellProps) => {
  const [distance, setDistance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const calculateDistance = async () => {
      // Reset states
      setError(false);
      setDistance(null);

      // If either location is missing, don't calculate
      if (!pickupLocation || !deliveryLocation) {
        return;
      }

      // Create cache key
      const cacheKey = `${pickupLocation}|${deliveryLocation}`;

      // Check cache first
      if (distanceCache.has(cacheKey)) {
        setDistance(distanceCache.get(cacheKey)!);
        return;
      }

      // Calculate distance
      setIsLoading(true);

      try {
        const { data, error: functionError } = await supabase.functions.invoke('calculate-distance', {
          body: {
            fromPlace: pickupLocation,
            toPlace: deliveryLocation,
          },
        });

        if (functionError) {
          console.error('Error calling calculate-distance function:', functionError);
          setError(true);
          return;
        }

        if (data?.success && typeof data.distance === 'number') {
          // Cache the result
          distanceCache.set(cacheKey, data.distance);
          setDistance(data.distance);
        } else {
          console.error('Invalid response from calculate-distance:', data);
          setError(true);
        }
      } catch (err) {
        console.error('Error calculating distance:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the calculation slightly to avoid excessive calls
    const timeoutId = setTimeout(calculateDistance, 300);
    return () => clearTimeout(timeoutId);
  }, [pickupLocation, deliveryLocation]);

  if (!pickupLocation || !deliveryLocation) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || distance === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="font-medium">
      {Math.round(distance)} mi
    </span>
  );
};
