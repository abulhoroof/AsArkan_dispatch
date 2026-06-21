import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface IncomingDriver {
  driverId: string;
  driverName: string;
  externalLoadCount: number;
  estimatedAvailableDate: string | null;
  currentLocation: string | null;
  oldDispatcherName: string | null;
  oldDispatcherId: string | null;
}

export interface SunsetState {
  incomingDrivers: IncomingDriver[];
  hasIncomingDrivers: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch "incoming drivers" for sunset transfer scenarios.
 * 
 * Incoming drivers are drivers newly assigned to the current user who still have
 * active loads owned by their previous dispatcher. This data is used to enrich
 * the Available Fleet table with external load info (location, date).
 * 
 * Note: Since the RLS policy now allows dispatchers to see loads for their assigned
 * drivers, the actual external loads appear directly in the main table as read-only.
 * This hook provides summary info for the Available Fleet section.
 */
export const useSunsetState = (userId: string | null): SunsetState => {
  const [incomingDrivers, setIncomingDrivers] = useState<IncomingDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { organizationId } = useOrganization();

  const fetchSunsetState = async () => {
    if (!userId || !organizationId) {
      setIncomingDrivers([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch incoming drivers (drivers assigned to me with external loads)
      const { data: incomingData, error: incomingError } = await supabase.rpc(
        'get_incoming_drivers',
        { p_user_id: userId, p_org_id: organizationId }
      );

      if (incomingError) {
        console.error('Error fetching incoming drivers:', incomingError);
      } else {
        const mappedIncomingDrivers: IncomingDriver[] = (incomingData || []).map((row: any) => ({
          driverId: row.driver_id,
          driverName: row.driver_name,
          externalLoadCount: Number(row.external_load_count) || 0,
          estimatedAvailableDate: row.estimated_available_date,
          currentLocation: row.current_location,
          oldDispatcherName: row.old_dispatcher_name,
          oldDispatcherId: row.old_dispatcher_id,
        }));
        setIncomingDrivers(mappedIncomingDrivers);
      }
    } catch (error) {
      console.error('Error in useSunsetState:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSunsetState();
  }, [userId, organizationId]);

  return useMemo(() => ({
    incomingDrivers,
    hasIncomingDrivers: incomingDrivers.length > 0,
    isLoading,
    refetch: fetchSunsetState,
  }), [incomingDrivers, isLoading]);
};
