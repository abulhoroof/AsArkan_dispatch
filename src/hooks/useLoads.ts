import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Load } from "@/types/load";
import { useToast } from "@/hooks/use-toast";
import { extractZipFromLocation, suggestDeliveryDate } from "@/utils/zipCodeLookup";
import { validatePickupDateForDriver } from "@/utils/validation";
import { useOrganization } from "@/hooks/useOrganization";
import { parseDate } from "@/utils/date";
import { useActingAs } from "@/contexts/ActingAsContext";

type DriverEntry = { driver_id: string; name: string; phone: string; contractType: string; truckNumber: number | null; trailerNumber: string | null; lastDeliveryLocation: string | null; lastDeliveryDate: string | null; fuelEnabled: boolean; assignedDispatcherId: string | null; isHistoricalOnly?: boolean; currentLocationOverride?: string | null; currentLocationOverrideSetAt?: string | null };

export function useLoads() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [driverStatuses, setDriverStatuses] = useState<Record<string, Load["Status"]>>({});
  const [allDrivers, setAllDrivers] = useState<DriverEntry[]>([]);
  const [driverAssignments, setDriverAssignments] = useState<Record<string, string | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const { actingAs } = useActingAs();
  // Keep latest actingAs in a ref so memoised callbacks don't go stale.
  const actingAsRef = useRef(actingAs);
  useEffect(() => { actingAsRef.current = actingAs; }, [actingAs]);

  // Request counter to prevent stale responses from overwriting fresh data
  const driverFetchCounter = useRef(0);

  useEffect(() => {
    // Only fetch when we have an organization ID
    if (!organizationId) return;
    
    fetchLoads();
    fetchDriverStatuses();
    fetchAllDrivers();
    fetchDriverAssignments();
    fetchCurrentUser();

    // Subscribe to real-time updates - scoped to current organization
    const loadsChannel = supabase
      .channel(`loads-changes-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loads',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          console.log('Loads change detected:', payload.eventType);
          fetchLoads();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to loads changes for org:', organizationId);
        }
      });

    const statusesChannel = supabase
      .channel(`statuses-changes-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_statuses',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchDriverStatuses();
        }
      )
      .subscribe();

    const driversChannel = supabase
      .channel(`drivers-changes-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchAllDrivers();
        }
      )
      .subscribe();

    return () => {
      loadsChannel.unsubscribe();
      statusesChannel.unsubscribe();
      driversChannel.unsubscribe();
      supabase.removeChannel(loadsChannel);
      supabase.removeChannel(statusesChannel);
      supabase.removeChannel(driversChannel);
    };
  }, [organizationId]);

  const fetchLoads = async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('organization_id', organizationId)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformedLoads: Load[] = data.map((load) => {
        // Calculate RPM (RPM = LOAD $ / Total Miles where Total Miles = Trip + DH)
        const loadAmount = load.load_amount ?? null;
        const tripMiles = load.trip_miles ?? 0;
        const dhMiles = load.dh_miles ?? 0;
        const actualTotalMiles = tripMiles + dhMiles;
        const calculatedRpm = (loadAmount !== null && actualTotalMiles > 0)
          ? loadAmount / actualTotalMiles
          : (load.rpm ?? null);

        return {
          id: load.id,
          user_id: load.user_id,
          NR: load.nr,
          driver_id: load.driver_id,
          "DRIVER NAME": load.driver_name,
          "DRIVER PHONE": load.driver_phone || "",
          "CONTRACT TYPE": load.contract_type as Load["CONTRACT TYPE"],
          "TRUCK #": load.truck_number || 0,
          "Trailer number": load.trailer_number || "",
          "TRAILER TYPE": load.trailer_type as Load["TRAILER TYPE"] || null,
          "PICK UP CITY/STATE/ZIP": load.pick_up_location || "",
          Status: load.status as Load["Status"],
          "DELIVERY CITY/STATE/ZIP": load.delivery_location || "",
          "PICK UP DATE": load.pick_up_date || "",
          "DELIVERY DATE": load.delivery_date || "",
          "LOAD #": load.load_number || "",
          "LOAD  $": load.load_amount ?? null,
          "DRIVER PAY ": load.driver_pay ?? null,
          "DRIVER PAY MANUALLY EDITED": (load as any).driver_pay_manually_edited ?? false,
          "TOTAL MILES": load.total_miles || 0,
          "TRIP MILES": (load as any).trip_miles ?? null,
          "DH MILES": (load as any).dh_miles ?? null,
          RPM: calculatedRpm,
          VERIFIED: load.verified,
          "TARP STATUS": load.tarp_status as Load["TARP STATUS"],
          INVOICED: load.invoiced as Load["INVOICED"],
          "ACCOUNTING NOTES": load.accounting_notes,
          "ADMIN ACCOUNTING NOTES": (load as any).accounting_notes_admin ?? null,
          "ZIP CODE": load.zip_code || null,
          "AVAILABLE ON": load.available_on || null,
          "EXTRA STOPS": (load as any).extra_stops_count ?? 0,
          "PAY STATUS": (load as any).pay_status ?? "Unpaid",
          "PAID AT": (load as any).paid_at ?? null,
          isArchived: load.is_archived,
        };
      });

      setLoads(transformedLoads);
    } catch (error: any) {
      toast({
        title: "Error fetching loads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDriverStatuses = async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('driver_statuses')
        .select('*')
        .eq('organization_id', organizationId);

      if (error) throw error;

      const statusMap: Record<string, Load["Status"]> = {};
      data.forEach((status) => {
        statusMap[status.driver_id] = status.status as Load["Status"];
      });

      setDriverStatuses(statusMap);
    } catch (error: any) {
      // Silent fail - driver statuses are non-critical
    }
  };

  const fetchAllDrivers = useCallback(async () => {
    if (!organizationId) return;
    
    // Increment counter and capture this request's ID
    const requestId = ++driverFetchCounter.current;
    
    try {
      // Get current user to filter drivers by assignment
      const { data: { user } } = await supabase.auth.getUser();

      // Admins see every driver in the org (so they can create loads on
      // behalf of any dispatcher). Dispatchers are restricted to their own
      // assigned drivers + unassigned ones.
      let isAdmin = false;
      if (user) {
        const { data: adminCheck } = await supabase.rpc('is_admin_of_org', { org_id: organizationId });
        isAdmin = adminCheck === true;
      }

      // Build query - filter by organization and assigned_dispatcher_id for the current user
      let query = supabase
        .from('drivers')
        .select('id, driver_name, driver_phone, contract_type, assigned_dispatcher_id, truck_number, trailer_number, fuel_enabled, current_location_override, current_location_override_set_at')
        .eq('organization_id', organizationId)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('driver_name', { ascending: true });

      // If user is a non-admin dispatcher, only show drivers assigned to them or unassigned.
      // Admins skip this filter and see the full org roster.
      if (user && !isAdmin) {
        query = query.or(`assigned_dispatcher_id.eq.${user.id},assigned_dispatcher_id.is.null`);
      }

      const { data: driversData, error } = await query;

      if (error) throw error;

      // Stale response check - if a newer request started, discard this response
      if (requestId !== driverFetchCounter.current) {
        console.log('Discarding stale fetchAllDrivers response');
        return;
      }

      // Step 2: Fetch historical driver IDs - drivers for whom the current user has loads
      // This allows original dispatchers to see reassigned drivers with their historical loads
      let historicalDriverIds: string[] = [];
      if (user) {
        const { data: historicalLoads } = await supabase
          .from('loads')
          .select('driver_id')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .or('is_deleted.is.null,is_deleted.eq.false');
        
        if (historicalLoads) {
          // Get unique driver IDs from user's loads that aren't already in driversData
          const currentDriverIds = new Set((driversData || []).map(d => d.id));
          historicalDriverIds = [...new Set(historicalLoads.map(l => l.driver_id))]
            .filter(id => !currentDriverIds.has(id));
        }
      }

      // Step 3: Fetch driver details for historical drivers not in the primary set
      let historicalDriversData: typeof driversData = [];
      if (historicalDriverIds.length > 0) {
        const { data: histDrivers } = await supabase
          .from('drivers')
          .select('id, driver_name, driver_phone, contract_type, assigned_dispatcher_id, truck_number, trailer_number, fuel_enabled, current_location_override, current_location_override_set_at')
          .in('id', historicalDriverIds)
          .or('is_deleted.is.null,is_deleted.eq.false');
        
        historicalDriversData = histDrivers || [];
      }

      // Combine all driver IDs for delivery location lookup
      const allDriverIds = [
        ...(driversData || []).map((d) => d.id),
        ...historicalDriversData.map((d) => d.id)
      ];
      let lastDeliveryMap: Record<string, { location: string | null; date: string | null }> = {};

      if (allDriverIds.length > 0) {
        // "Last drop-off" must be the most recent ACTUALLY-DELIVERED load,
        // not a future-dated in-progress load. Previously we ordered all
        // loads by delivery_date DESC, which surfaced tomorrow's in-progress
        // delivery as the "last drop-off" (e.g. Franklin, NY shown instead of
        // the just-delivered Hooksett, NH). Restrict to deliveries that have
        // already happened by today's date.
        const todayIso = new Date().toISOString().slice(0, 10);
        const { data: loadsData } = await supabase
          .from('loads')
          .select('driver_id, delivery_location, delivery_date')
          .in('driver_id', allDriverIds)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .not('delivery_date', 'is', null)
          .neq('delivery_date', '')
          .order('delivery_date', { ascending: false, nullsFirst: false });

        // Get the most recent delivery location and date per driver.
        // NOTE: delivery_date is stored as text and may be ISO (YYYY-MM-DD) OR
        // legacy MM/DD/YY. Lexical .lte against an ISO `todayIso` would let
        // every legacy MDY string through (they start with "0"-"9" < "2"),
        // surfacing future-dated MDY rows as "last drop-off". So we filter
        // by parsed date in JS and drop anything dated after today.
        if (loadsData) {
          // Use END of local "today" so a delivery dated today (parsed at local
          // midnight) is NOT excluded in non-UTC timezones. Previously we
          // compared against UTC midnight via new Date(todayIso).getTime(),
          // which dropped today's deliveries for users west of UTC.
          const now = new Date();
          const endOfTodayMs = new Date(
            now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999
          ).getTime();
          const seenDrivers = new Set<string>();
            for (const load of loadsData) {
              if (seenDrivers.has(load.driver_id) || !load.delivery_location) continue;
              const parsed = parseDate(load.delivery_date as string);
              if (!parsed || parsed.getTime() > endOfTodayMs) continue;
              {
                // Keep city, state, and zip (required for calculate-distance)
                // delivery_location is typically formatted like "City, ST 12345".
                // If it doesn't include a zip, we still keep the full string.
                const fullLocation = String(load.delivery_location).trim();
                lastDeliveryMap[load.driver_id] = {
                  location: fullLocation,
                  date: load.delivery_date || null
                };
                seenDrivers.add(load.driver_id);
              }
            }
        }
      }

      // Final stale check after queries
      if (requestId !== driverFetchCounter.current) {
        console.log('Discarding stale fetchAllDrivers response (after loads query)');
        return;
      }

      // Map primary drivers (assigned to current user or unassigned)
      const fetchedDrivers: DriverEntry[] = (driversData || []).map((driver) => ({
        driver_id: driver.id,
        name: driver.driver_name || '',
        phone: driver.driver_phone || '',
        contractType: driver.contract_type || 'LP GOLD',
        truckNumber: driver.truck_number || null,
        trailerNumber: driver.trailer_number || null,
        lastDeliveryLocation: lastDeliveryMap[driver.id]?.location || null,
        lastDeliveryDate: lastDeliveryMap[driver.id]?.date || null,
        fuelEnabled: driver.fuel_enabled ?? true,
        assignedDispatcherId: driver.assigned_dispatcher_id || null,
        isHistoricalOnly: false,
        currentLocationOverride: (driver as any).current_location_override || null,
        currentLocationOverrideSetAt: (driver as any).current_location_override_set_at || null,
      }));

      // Map historical drivers (reassigned to another dispatcher, but user has historical loads)
      const historicalDrivers: DriverEntry[] = historicalDriversData.map((driver) => ({
        driver_id: driver.id,
        name: driver.driver_name || '',
        phone: driver.driver_phone || '',
        contractType: driver.contract_type || 'LP GOLD',
        truckNumber: driver.truck_number || null,
        trailerNumber: driver.trailer_number || null,
        lastDeliveryLocation: lastDeliveryMap[driver.id]?.location || null,
        lastDeliveryDate: lastDeliveryMap[driver.id]?.date || null,
        fuelEnabled: driver.fuel_enabled ?? true,
        assignedDispatcherId: driver.assigned_dispatcher_id || null,
        isHistoricalOnly: true, // Flag to indicate this driver is only visible due to historical loads
        currentLocationOverride: (driver as any).current_location_override || null,
        currentLocationOverrideSetAt: (driver as any).current_location_override_set_at || null,
      }));

      // Merge strategy: keep any optimistically-added drivers that aren't in the fetched list yet
      // Also preserve lastDeliveryLocation for drivers that don't yet have loads (new drivers)
      setAllDrivers((prev) => {
        const allFetchedDrivers = [...fetchedDrivers, ...historicalDrivers];
        const fetchedIds = new Set(allFetchedDrivers.map(d => d.driver_id));
        // Keep drivers from prev that are NOT in fetched (they may be optimistically added)
        const optimisticDrivers = prev.filter(d => !fetchedIds.has(d.driver_id));
        
        // For fetched drivers, preserve lastDeliveryLocation from prev if fetched has null
        // This prevents background refresh from clearing new driver locations before they have loads
        const mergedFetchedDrivers = allFetchedDrivers.map(fetched => {
          const prevDriver = prev.find(p => p.driver_id === fetched.driver_id);
          if (!fetched.lastDeliveryLocation && prevDriver?.lastDeliveryLocation) {
            return { ...fetched, lastDeliveryLocation: prevDriver.lastDeliveryLocation };
          }
          return fetched;
        });
        
        // Combine: merged fetched first (authoritative), then optimistic ones
        return [...mergedFetchedDrivers, ...optimisticDrivers];
      });
    } catch (error: any) {
      // Silent fail - driver list is non-critical
    }
  }, [organizationId]);

  const fetchDriverAssignments = async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, assigned_dispatcher_id')
        .eq('organization_id', organizationId);

      if (error) throw error;

      const assignments: Record<string, string | null> = {};
      (data || []).forEach((driver) => {
        assignments[driver.id] = driver.assigned_dispatcher_id;
      });

      setDriverAssignments(assignments);
    } catch (error: any) {
      // Silent fail - driver assignments are non-critical
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    } catch (error: any) {
      // Silent fail
    }
  };

  const updateDriverStatus = async (driverId: string, status: Load["Status"]) => {
    // Optimistically update local state immediately
    setDriverStatuses((prev) => ({ ...prev, [driverId]: status }));

    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to update driver status",
          variant: "destructive",
        });
        return;
      }

      // Get the driver's NR (row number) from loads
      const { data: driverLoad } = await supabase
        .from('loads')
        .select('nr')
        .eq('driver_id', driverId)
        .limit(1)
        .maybeSingle();

      const nr = driverLoad?.nr || 0;

      // Attribute the status change to the driver's owner when an admin is
      // acting on a driver owned by another dispatcher (mirrors load
      // attribution so audit fields stay consistent).
      const { data: driverRow } = await supabase
        .from('drivers')
        .select('assigned_dispatcher_id')
        .eq('id', driverId)
        .maybeSingle();
      const actingAsTarget = actingAsRef.current;
      const attributedUserId =
        actingAsTarget && actingAsTarget.userId !== user.id
          ? actingAsTarget.userId
          : driverRow?.assigned_dispatcher_id && driverRow.assigned_dispatcher_id !== user.id
            ? driverRow.assigned_dispatcher_id
            : user.id;

      const { error } = await supabase
        .from('driver_statuses')
        .upsert({
          driver_id: driverId,
          user_id: attributedUserId,
          organization_id: organizationId,
          nr: nr,
          status,
        }, {
          onConflict: 'driver_id',
          ignoreDuplicates: false
        });

      if (error) throw error;
    } catch (error: any) {
      // Revert optimistic update on error
      fetchDriverStatuses();
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createDriver = async (data: {
    name: string;
    phone: string;
    contractType: Load["CONTRACT TYPE"];
    truckNumber?: number;
    trailerNumber?: string;
    trailerType?: Load["TRAILER TYPE"];
    location?: string;
  }): Promise<DriverEntry> => {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");
    if (!organizationId) throw new Error("Organization required");

    const { data: created, error } = await supabase
      .from("drivers")
      .insert({
        driver_name: data.name,
        driver_phone: data.phone,
        contract_type: data.contractType,
        truck_number: data.truckNumber ?? null,
        trailer_number: data.trailerNumber ?? null,
        trailer_type: data.trailerType ?? null,
        assigned_dispatcher_id: user.id,
        organization_id: organizationId,
      })
      .select("id, driver_name, driver_phone, contract_type, truck_number, trailer_number, trailer_type, fuel_enabled")
      .single();

    if (error) throw error;

    const driverForState: DriverEntry = {
      driver_id: created.id,
      name: created.driver_name || "",
      phone: created.driver_phone || "",
      contractType: created.contract_type || "LP GOLD",
      truckNumber: created.truck_number ?? null,
      trailerNumber: created.trailer_number ?? null,
      lastDeliveryLocation: data.location || null,
      lastDeliveryDate: null,
      fuelEnabled: created.fuel_enabled ?? true,
      assignedDispatcherId: user.id,
    };

    // Update local state immediately so it shows up without refresh
    setAllDrivers((prev) => {
      // Avoid duplicates if it somehow already exists
      if (prev.some(d => d.driver_id === driverForState.driver_id)) return prev;
      return [driverForState, ...prev];
    });

    // Trigger a background refresh to sync with DB (won't overwrite thanks to merge strategy)
    fetchAllDrivers();

    return driverForState;
  };

  const addLoad = async (newLoad: Partial<Load>): Promise<string | null> => {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to add a load",
          variant: "destructive",
        });
        return null;
      }

      // Check if driver already exists in the drivers table
      let driverId = newLoad.driver_id;

      // Determine admin status once for the rest of the flow
      const { data: adminCheck } = await supabase.rpc('is_admin_of_org', { org_id: organizationId });
      const isAdmin = adminCheck === true;

      // attributedUserId is the dispatcher the load (and any new driver) should
      // be credited to. Defaults to the caller; for admins acting on a driver
      // owned by someone else, we attribute to that driver's owner so KPI
      // reporting and ownership stay correct.
      let attributedUserId = user.id;

      // Explicit "Acting as <dispatcher>" mode (admin-only) takes precedence
      // over the driver-owner-derived attribution below.
      const actingAsTarget = actingAsRef.current;
      if (isAdmin && actingAsTarget && actingAsTarget.userId !== user.id) {
        attributedUserId = actingAsTarget.userId;
      }

      // For existing drivers, verify ownership (skip for admins) and resolve
      // attribution.
      if (driverId) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('assigned_dispatcher_id')
          .eq('id', driverId)
          .maybeSingle();

        if (driverData?.assigned_dispatcher_id &&
            driverData.assigned_dispatcher_id !== user.id &&
            !isAdmin) {
          toast({
            title: "Cannot add load",
            description: "This driver is assigned to another dispatcher",
            variant: "destructive",
          });
          return null;
        }

        // Admin acting on a driver owned by another dispatcher: credit that
        // dispatcher instead of the admin (only if no explicit Acting As mode
        // is already overriding attribution).
        if (isAdmin &&
            !(actingAsTarget && actingAsTarget.userId !== user.id) &&
            driverData?.assigned_dispatcher_id &&
            driverData.assigned_dispatcher_id !== user.id) {
          attributedUserId = driverData.assigned_dispatcher_id;
        }
      }

      if (!driverId && newLoad["DRIVER NAME"]) {
        // Check if driver already exists by name
        const { data: existingDriver } = await supabase
          .from('drivers')
          .select('id')
          .eq('driver_name', newLoad["DRIVER NAME"])
          .maybeSingle();

        if (existingDriver) {
          driverId = existingDriver.id;
        } else {
          // Create new driver in drivers table. Assigned to whoever the load
          // is being attributed to (admins attributing to themselves get the
          // driver too; admins acting under another dispatcher's roster — not
          // currently a UX path for new-driver creation — would attribute
          // there as well).
          const { data: newDriver, error: driverError } = await supabase
            .from('drivers')
            .insert({
              driver_name: newLoad["DRIVER NAME"],
              driver_phone: newLoad["DRIVER PHONE"],
              contract_type: newLoad["CONTRACT TYPE"],
              truck_number: newLoad["TRUCK #"],
              trailer_number: newLoad["Trailer number"],
              assigned_dispatcher_id: attributedUserId,
              organization_id: organizationId,
            })
            .select()
            .single();

          if (driverError) throw driverError;
          driverId = newDriver.id;
        }
      }

      const { data, error } = await supabase
        .from('loads')
        .insert({
          user_id: attributedUserId,
          organization_id: organizationId,
          driver_id: driverId,
          nr: newLoad.NR || 0,
          driver_name: newLoad["DRIVER NAME"],
          driver_phone: newLoad["DRIVER PHONE"],
          contract_type: newLoad["CONTRACT TYPE"],
          truck_number: newLoad["TRUCK #"],
          trailer_number: newLoad["Trailer number"],
          pick_up_location: newLoad["PICK UP CITY/STATE/ZIP"],
          delivery_location: newLoad["DELIVERY CITY/STATE/ZIP"],
          pick_up_date: newLoad["PICK UP DATE"],
          delivery_date: newLoad["DELIVERY DATE"],
          load_number: newLoad["LOAD #"],
          load_amount: newLoad["LOAD  $"],
          driver_pay: newLoad["DRIVER PAY "],
          total_miles: newLoad["TOTAL MILES"],
          trip_miles: newLoad["TRIP MILES"],
          dh_miles: newLoad["DH MILES"],
          rpm: newLoad.RPM,
          verified: newLoad.VERIFIED,
          tarp_status: newLoad["TARP STATUS"],
          invoiced: newLoad.INVOICED,
          accounting_notes: newLoad["ACCOUNTING NOTES"],
          zip_code: newLoad["ZIP CODE"],
          available_on: newLoad["AVAILABLE ON"],
          is_archived: newLoad.isArchived,
          status: newLoad.Status,
          extra_stops_count: newLoad["EXTRA STOPS"] ?? 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Immediately add the new load with its database ID to local state
      if (data) {
        const transformedLoad: Load = {
          id: data.id,
          user_id: data.user_id,
          NR: data.nr,
          driver_id: data.driver_id,
          "DRIVER NAME": data.driver_name,
          "DRIVER PHONE": data.driver_phone || "",
          "CONTRACT TYPE": data.contract_type as Load["CONTRACT TYPE"],
          "TRUCK #": data.truck_number || 0,
          "Trailer number": data.trailer_number || "",
          "TRAILER TYPE": data.trailer_type as Load["TRAILER TYPE"] || null,
          "PICK UP CITY/STATE/ZIP": data.pick_up_location || "",
          Status: data.status as Load["Status"],
          "DELIVERY CITY/STATE/ZIP": data.delivery_location || "",
          "PICK UP DATE": data.pick_up_date || "",
          "DELIVERY DATE": data.delivery_date || "",
          "LOAD #": data.load_number || "",
          "LOAD  $": data.load_amount ?? null,
          "DRIVER PAY ": data.driver_pay ?? null,
          "DRIVER PAY MANUALLY EDITED": (data as any).driver_pay_manually_edited ?? false,
          "TOTAL MILES": data.total_miles || 0,
          "TRIP MILES": (data as any).trip_miles ?? null,
          "DH MILES": (data as any).dh_miles ?? null,
          RPM: data.rpm ?? null,
          VERIFIED: data.verified,
          "TARP STATUS": data.tarp_status as Load["TARP STATUS"],
          INVOICED: data.invoiced as Load["INVOICED"],
          "ACCOUNTING NOTES": data.accounting_notes,
          "ADMIN ACCOUNTING NOTES": (data as any).accounting_notes_admin ?? null,
          "ZIP CODE": data.zip_code || null,
          "AVAILABLE ON": data.available_on || null,
          "EXTRA STOPS": (data as any).extra_stops_count ?? 0,
          "PAY STATUS": (data as any).pay_status ?? "Unpaid",
          "PAID AT": (data as any).paid_at ?? null,
          isArchived: data.is_archived,
        };
        setLoads(prev => [...prev, transformedLoad]);
      }

      // Update AVAILABLE ON for this driver
      if (data?.driver_id) {
        await updateAvailableOnForDriver(data.driver_id);
      }

      toast({
        title: "Load added successfully",
      });

      return data?.id || null;
    } catch (error: any) {
      toast({
        title: "Error adding load",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateAvailableOnForDriver = async (driverId: string) => {
    try {
      // Fetch all non-archived loads for this driver
      const { data: driverLoads, error } = await supabase
        .from('loads')
        .select('id, delivery_date, is_archived')
        .eq('driver_id', driverId)
        .eq('organization_id', organizationId)
        .eq('is_archived', false);

      if (error) throw error;

      // Find the latest delivery date
      let latestDeliveryDate: string | null = null;
      if (driverLoads && driverLoads.length > 0) {
        const validDates = driverLoads
          .map(load => load.delivery_date)
          .filter((date): date is string => !!date && date.trim() !== '');

        if (validDates.length > 0) {
          // Sort dates and get the latest
          validDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          latestDeliveryDate = validDates[0];
        }
      }

      // Update all loads for this driver with the latest delivery date as AVAILABLE ON
      if (driverLoads && driverLoads.length > 0) {
        const { error: updateError } = await supabase
          .from('loads')
          .update({ available_on: latestDeliveryDate })
          .eq('driver_id', driverId)
          .eq('organization_id', organizationId);

        if (updateError) throw updateError;

        // Update local state
        setLoads(prevLoads =>
          prevLoads.map(load =>
            load.driver_id === driverId
              ? { ...load, "AVAILABLE ON": latestDeliveryDate }
              : load
          )
        );
      }
    } catch (error: any) {
      // Silent fail - AVAILABLE ON is calculated field, non-critical
    }
  };

  const updateLoad = async (loadId: string, field: keyof Load, value: any): Promise<boolean> => {
    // Find the load by ID
    const loadIndex = loads.findIndex(l => l.id === loadId);
    if (loadIndex === -1) {
      toast({
        title: "Error updating load",
        description: "Load not found",
        variant: "destructive",
      });
      return false;
    }

    const load = loads[loadIndex];
    let updatedLoadData: Partial<Load> = { [field]: value };
    const dbUpdates: Record<string, any> = {};

    // Prevent updates to archived loads (except restoring them)
    if (load.isArchived && field !== "isArchived") {
      toast({
        title: "Cannot edit archived load",
        description: "Please restore the load first to make changes.",
        variant: "destructive",
      });
      return false;
    }

    // Validate delivery date is not before pick-up date
    if (field === "DELIVERY DATE" && value) {
      const pickUpDate = load["PICK UP DATE"];
      if (pickUpDate) {
        const pickUp = new Date(pickUpDate);
        const delivery = new Date(value);
        if (!isNaN(pickUp.getTime()) && !isNaN(delivery.getTime()) && delivery < pickUp) {
          toast({
            title: "Invalid delivery date",
            description: "Delivery date cannot be before pick-up date.",
            variant: "destructive",
          });
          return false;
        }
      }
    }

    // Validate pick-up date is not after delivery date
    if (field === "PICK UP DATE" && value) {
      const deliveryDate = load["DELIVERY DATE"];
      if (deliveryDate) {
        const pickUp = new Date(value);
        const delivery = new Date(deliveryDate);
        if (!isNaN(pickUp.getTime()) && !isNaN(delivery.getTime()) && pickUp > delivery) {
          toast({
            title: "Invalid pick-up date",
            description: "Pick-up date cannot be after delivery date.",
            variant: "destructive",
          });
          return false;
        }
      }
    }

    // Extract zip for the dedicated ZIP CODE field if it's the delivery location
    if (field === "DELIVERY CITY/STATE/ZIP" && typeof value === "string") {
      const extractedZip = extractZipFromLocation(value);
      if (extractedZip) {
        updatedLoadData["ZIP CODE"] = extractedZip;
      }
    }

    // Handle RPM update if amount or miles change
    if (field === "LOAD  $" || field === "TOTAL MILES" || field === "TRIP MILES" || field === "DH MILES") {
      const amount = field === "LOAD  $" ? value : load["LOAD  $"];
      const totalMiles = (field === "TOTAL MILES" ? value :
        (field === "TRIP MILES" ? (value + (load["DH MILES"] || 0)) :
          (field === "DH MILES" ? ((load["TRIP MILES"] || 0) + value) : load["TOTAL MILES"])));

      if (amount && totalMiles && totalMiles > 0) {
        updatedLoadData["RPM"] = amount / totalMiles;
      }
    }

    // Optimistically update local state
    setLoads(prevLoads => {
      const newLoads = [...prevLoads];
      newLoads[loadIndex] = { ...newLoads[loadIndex], ...updatedLoadData };
      return newLoads;
    });

    // Map fields to DB columns
    const fieldMap: Record<string, string> = {
      "NR": "nr",
      "DRIVER NAME": "driver_name",
      "DRIVER PHONE": "driver_phone",
      "CONTRACT TYPE": "contract_type",
      "TRUCK #": "truck_number",
      "Trailer number": "trailer_number",
      "TRAILER TYPE": "trailer_type",
      "PICK UP CITY/STATE/ZIP": "pick_up_location",
      "DELIVERY CITY/STATE/ZIP": "delivery_location",
      "PICK UP DATE": "pick_up_date",
      "DELIVERY DATE": "delivery_date",
      "LOAD #": "load_number",
      "LOAD  $": "load_amount",
      "DRIVER PAY ": "driver_pay",
      "DRIVER PAY MANUALLY EDITED": "driver_pay_manually_edited",
      "TOTAL MILES": "total_miles",
      "TRIP MILES": "trip_miles",
      "DH MILES": "dh_miles",
      "RPM": "rpm",
      "VERIFIED": "verified",
      "TARP STATUS": "tarp_status",
      "INVOICED": "invoiced",
      "ACCOUNTING NOTES": "accounting_notes",
      "ADMIN ACCOUNTING NOTES": "accounting_notes_admin",
      "ZIP CODE": "zip_code",
      "AVAILABLE ON": "available_on",
      "Status": "status",
      "isArchived": "is_archived",
      "PAY STATUS": "pay_status",
      "PAID AT": "paid_at",
    };

    // Prepare all updates for the DB
    Object.keys(updatedLoadData).forEach(key => {
      const dbKey = fieldMap[key];
      if (dbKey) {
        dbUpdates[dbKey] = (updatedLoadData as any)[key];
      }
    });

    try {
      const { error, data } = await supabase
        .from('loads')
        .update(dbUpdates)
        .eq('id', loadId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("You don't have permission to edit this load");
      }

      // Secondary updates
      if (field === "DELIVERY DATE" || updatedLoadData["DELIVERY DATE"]) {
        await updateAvailableOnForDriver(load.driver_id);
      }

      // Sync CONTRACT TYPE to drivers table when changed on a load
      if (field === "CONTRACT TYPE" && load.driver_id) {
        await supabase
          .from('drivers')
          .update({ contract_type: value, updated_at: new Date().toISOString() })
          .eq('id', load.driver_id);
      }

      if ((field === "PICK UP DATE" || updatedLoadData["PICK UP DATE"]) && load.driver_id) {
        const pickupDate = (updatedLoadData["PICK UP DATE"] || value) as string;
        if (pickupDate) {
          const { warning } = validatePickupDateForDriver(load.driver_id, loadId, pickupDate, loads);
          if (warning) {
            toast({
              title: "Scheduling Warning",
              description: warning,
              variant: "destructive",
            });
          }
        }
      }

      return true;
    } catch (error: any) {
      fetchLoads();
      toast({
        title: "Error updating load",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteLoad = async (loadId: string) => {
    // Find the load by ID
    const loadIndex = loads.findIndex(l => l.id === loadId);
    if (loadIndex === -1) {
      toast({
        title: "Error",
        description: "Load not found",
        variant: "destructive",
      });
      return;
    }

    const load = loads[loadIndex];
    const driverId = load.driver_id;

    try {
      // Soft delete by setting is_deleted = true
      const { error } = await supabase
        .from('loads')
        .update({ is_deleted: true })
        .eq('id', loadId);

      if (error) throw error;

      // Update AVAILABLE ON for this driver since a load was deleted
      await updateAvailableOnForDriver(driverId);

      toast({
        title: "Load deleted",
        description: "The load has been deleted. It can be recovered if needed.",
      });
      // Refresh to ensure UI is in sync
      await fetchLoads();
    } catch (error: any) {
      toast({
        title: "Error deleting load",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const restoreLoad = async (loadId: string) => {
    // Find the load by ID
    const loadIndex = loads.findIndex(l => l.id === loadId);
    if (loadIndex === -1) {
      toast({
        title: "Error",
        description: "Load not found",
        variant: "destructive",
      });
      return;
    }

    const load = loads[loadIndex];
    const driverId = load.driver_id;
    console.log("Restoring load:", { loadId, driverName: load["DRIVER NAME"] });
    const success = await updateLoad(loadId, "isArchived" as keyof Load, false);
    if (success) {
      // Update AVAILABLE ON for this driver since a load was restored
      await updateAvailableOnForDriver(driverId);

      toast({
        title: "Load restored",
        description: "The load has been restored and saved to the database. You can now edit it.",
      });
      // Refresh to ensure UI is in sync
      await fetchLoads();
    } else {
      console.error("Failed to restore load:", loadId);
    }
    // Error handling is done in updateLoad
  };

  const permanentlyDeleteLoad = async (loadId: string) => {
    if (!loadId) {
      toast({
        title: "Error",
        description: "Load ID is required",
        variant: "destructive",
      });
      return false;
    }

    // Get driver ID before deletion
    const loadToDelete = loads.find(l => l.id === loadId);
    const driverId = loadToDelete?.driver_id;

    try {
      const { error } = await supabase
        .from('loads')
        .delete()
        .eq('id', loadId);

      if (error) throw error;

      // Remove from local state immediately by ID
      setLoads(prevLoads => prevLoads.filter(l => l.id !== loadId));

      // Update AVAILABLE ON for this driver since a load was deleted
      if (driverId) {
        await updateAvailableOnForDriver(driverId);
      }

      toast({
        title: "Load permanently deleted",
        description: "The load has been permanently removed from the database.",
      });

      // Refresh to ensure UI is in sync
      await fetchLoads();
      return true;
    } catch (error: any) {
      toast({
        title: "Error deleting load",
        description: error.message,
        variant: "destructive",
      });
      // Revert optimistic update on error
      await fetchLoads();
      return false;
    }
  };

  const refreshLoads = async () => {
    setIsLoading(true);
    await fetchLoads();
    await fetchDriverStatuses();
    await fetchAllDrivers();
  };

  return {
    loads,
    driverStatuses,
    allDrivers,
    driverAssignments,
    currentUserId,
    isLoading,
    updateDriverStatus,
    createDriver,
    addLoad,
    updateLoad,
    deleteLoad,
    restoreLoad,
    permanentlyDeleteLoad,
    refreshLoads,
  };
}
