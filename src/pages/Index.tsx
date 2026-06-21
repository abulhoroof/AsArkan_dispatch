import { useState, useEffect, useMemo, useCallback } from "react";
import { Load } from "@/types/load";
import { getDeliveryWeekRange, parseDate } from "@/utils/date";
import { SpreadsheetHeader } from "@/components/SpreadsheetHeader";
import { SpreadsheetTable } from "@/components/SpreadsheetTable";
import { AddLoadModal } from "@/components/AddLoadModal";
import { toast } from "sonner";
import { useLoads } from "@/hooks/useLoads";
import { useSunsetState } from "@/hooks/useSunsetState";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { clearSubdomainCache } from "@/hooks/useSubdomain";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { extractZipFromLocation } from "@/utils/zipCodeLookup";
import { AppFooter } from "@/components/AppFooter";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { EnrichedDriver } from "@/types/enrichedDriver";
import { useSettings } from "@/contexts/SettingsContext";
import { computeDriverPay } from "@/utils/driverPay";

interface DispatcherInfo {
  load_id: string;
  dispatcher_id: string;
  dispatcher_email: string;
  dispatcher_name: string;
}

interface Dispatcher {
  id: string;
  name: string;
  email: string;
}

const STORAGE_KEY_PREFIX = 'asarkan_tms_loads_row_state_';
const DATE_STORAGE_KEY_PREFIX = 'asarkan_tms_date_loads_';

const Index = () => {
  const [addLoadDialogOpen, setAddLoadDialogOpen] = useState(() => {
    return localStorage.getItem('form-open:add-load') === 'true';
  });
  const [highlightedLoadId, setHighlightedLoadId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [selectedDispatcherIds, setSelectedDispatcherIds] = useState<string[]>([]);
  const [preSelectedDriverId, setPreSelectedDriverId] = useState<string | null>(null);
  const [prefilledPickupLocation, setPrefilledPickupLocation] = useState<string | undefined>(undefined);
  const [prefilledPickupDate, setPrefilledPickupDate] = useState<string | undefined>(undefined);
  
  // Date filter state with localStorage persistence (loaded after userId is set)
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month">("week");
  const [dateOffset, setDateOffset] = useState(0);
  const [dateStateLoaded, setDateStateLoaded] = useState(false);
  const [dispatcherData, setDispatcherData] = useState<DispatcherInfo[]>([]);
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [viewingAsDispatcherId, setViewingAsDispatcherId] = useState<string | null>(null);
  const [availableDriversCount, setAvailableDriversCount] = useState(0);
  const { loads, driverStatuses, allDrivers, driverAssignments, currentUserId, isLoading, updateDriverStatus, addLoad: addLoadToDb, createDriver, updateLoad, deleteLoad, permanentlyDeleteLoad, refreshLoads } = useLoads();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { organizationId } = useOrganization();
  const { contractProfiles } = useSettings();
  
  // Sunset transfer state (for handling driver reassignment mid-load)
  const { incomingDrivers, refetch: refetchSunsetState } = useSunsetState(userId);

  // Row expansion state for collapsible rows with localStorage persistence
  const getStorageKey = useCallback(() => userId ? `${STORAGE_KEY_PREFIX}${userId}` : null, [userId]);

  const loadExpandedState = useCallback(() => {
    const key = getStorageKey();
    if (!key) return new Set<string>();
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set<string>(parsed);
      }
    } catch (e) {
      console.warn('Failed to load expanded state from localStorage:', e);
    }
    return new Set<string>();
  }, [getStorageKey]);

  const saveExpandedState = useCallback((expandedIds: Set<string>) => {
    const key = getStorageKey();
    if (!key) return;
    
    try {
      localStorage.setItem(key, JSON.stringify([...expandedIds]));
    } catch (e) {
      console.warn('Failed to save expanded state to localStorage:', e);
    }
  }, [getStorageKey]);

  const [expandedDriverIds, setExpandedDriverIds] = useState<Set<string>>(new Set());

  // Load expanded state from localStorage when userId is available
  useEffect(() => {
    if (userId) {
      const savedState = loadExpandedState();
      setExpandedDriverIds(savedState);
    }
  }, [userId, loadExpandedState]);

  // Save to localStorage whenever expanded state changes
  useEffect(() => {
    if (userId && expandedDriverIds.size >= 0) {
      saveExpandedState(expandedDriverIds);
    }
  }, [expandedDriverIds, userId, saveExpandedState]);

  const toggleDriverExpanded = useCallback((driverId: string) => {
    setExpandedDriverIds(prev => {
      const next = new Set(prev);
      if (next.has(driverId)) {
        next.delete(driverId);
      } else {
        next.add(driverId);
      }
      return next;
    });
  }, []);

  // Get all unique driver IDs from displayed loads for expand all
  const allDriverIdsInView = useMemo(() => {
    const driverIds = new Set<string>();
    loads.filter(load => !load.isArchived).forEach(load => driverIds.add(load.driver_id));
    return driverIds;
  }, [loads]);

  const allDriversExpanded = useMemo(() => {
    return allDriverIdsInView.size > 0 && allDriverIdsInView.size === expandedDriverIds.size;
  }, [allDriverIdsInView, expandedDriverIds]);

  const toggleAllDrivers = useCallback(() => {
    if (allDriversExpanded) {
      setExpandedDriverIds(new Set());
    } else {
      setExpandedDriverIds(new Set(allDriverIdsInView));
    }
  }, [allDriversExpanded, allDriverIdsInView]);

  // Handle adding load for a specific driver (from empty driver row or basic context)
  // Helper to sync form-open state with localStorage
  const setAddLoadOpen = useCallback((open: boolean) => {
    setAddLoadDialogOpen(open);
    if (open) localStorage.setItem('form-open:add-load', 'true');
    else localStorage.removeItem('form-open:add-load');
  }, []);

  // IMPORTANT: This must be defined before any early returns to maintain consistent hook order
  const handleAddLoadForDriver = useCallback((driverId: string) => {
    setPreSelectedDriverId(driverId);
    setPrefilledPickupLocation(undefined);
    setPrefilledPickupDate(undefined);
    setAddLoadOpen(true);
  }, [setAddLoadOpen]);

  // Handle adding load for a driver with pre-filled context (from collapsed row ghost button or expanded card)
  const handleAddLoadForDriverWithContext = useCallback((driverId: string, pickupLocation?: string, pickupDate?: string) => {
    setPreSelectedDriverId(driverId);
    setPrefilledPickupLocation(pickupLocation);
    setPrefilledPickupDate(pickupDate);
    setAddLoadOpen(true);
  }, [setAddLoadOpen]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? undefined);
      setUserId(user?.id ?? null);
    });
  }, []);

  // Load date filter state from localStorage when userId becomes available
  useEffect(() => {
    if (userId && !dateStateLoaded) {
      const key = `${DATE_STORAGE_KEY_PREFIX}${userId}`;
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.dateFilter) setDateFilter(parsed.dateFilter);
          if (typeof parsed.dateOffset === 'number') setDateOffset(parsed.dateOffset);
        }
      } catch (e) {
        console.warn('Failed to load date filter state from localStorage:', e);
      }
      setDateStateLoaded(true);
    }
  }, [userId, dateStateLoaded]);

  // Save date filter state to localStorage whenever it changes
  useEffect(() => {
    if (userId && dateStateLoaded) {
      const key = `${DATE_STORAGE_KEY_PREFIX}${userId}`;
      try {
        localStorage.setItem(key, JSON.stringify({ dateFilter, dateOffset }));
      } catch (e) {
        console.warn('Failed to save date filter state to localStorage:', e);
      }
    }
  }, [dateFilter, dateOffset, userId, dateStateLoaded]);

  // Fetch dispatcher data for admin view
  useEffect(() => {
    if (isAdmin && organizationId) {
      fetchDispatcherData();
      fetchDispatchers();
    }
  }, [isAdmin, organizationId]);

  const fetchDispatcherData = async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await (supabase.rpc as any)('get_loads_with_dispatcher', {
        p_org_id: organizationId
      });
      if (error) throw error;
      setDispatcherData(data || []);
    } catch (error) {
      console.error("Failed to fetch dispatcher data:", error);
    }
  };

  const fetchDispatchers = async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await (supabase.rpc as any)('get_all_dispatchers', {
        p_org_id: organizationId
      });
      if (error) throw error;
      setDispatchers(data || []);
    } catch (error) {
      console.error("Failed to fetch dispatchers:", error);
    }
  };

  const handleSignOut = async () => {
    // Clear row expansion state from localStorage on logout
    const key = getStorageKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Failed to clear expanded state from localStorage:', e);
      }
    }
    // Clear date filter state from localStorage on logout
    if (userId) {
      try {
        localStorage.removeItem(`${DATE_STORAGE_KEY_PREFIX}${userId}`);
      } catch (e) {
        console.warn('Failed to clear date filter state from localStorage:', e);
      }
    }
    clearSubdomainCache();
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleUpdateDriverStatus = (driverId: string, status: Load["Status"]) => {
    updateDriverStatus(driverId, status);
    toast.success("Driver status updated");
  };

  const handleUpdateCell = async (loadId: string, field: keyof Load, value: any) => {
    const load = loads.find(l => l.id === loadId);
    if (!load || !load.id) return;

    const oldDriverName = load["DRIVER NAME"];

    // Handle driver name changes - check if switching to existing driver
    if (field === "DRIVER NAME" && value !== oldDriverName) {
      const existingDriver = loads.find(l => l["DRIVER NAME"] === value && !l.isArchived);
      if (existingDriver) {
        updateLoad(load.id, "driver_id", existingDriver.driver_id);
      }
    }

    // Auto-extract and validate zip code when delivery location changes
    if (field === "DELIVERY CITY/STATE/ZIP" && typeof value === "string") {
      const extractedZip = extractZipFromLocation(value);
      if (extractedZip) {
        updateLoad(load.id, "ZIP CODE", extractedZip);
      }
    }

    // Update the main field first
    await updateLoad(load.id, field, value);

    // Set Driver Pay to Load$ by default when Load$ changes
    if (field === "LOAD  $") {
      await updateLoad(load.id, "DRIVER PAY ", value);

      // Recalculate RPM (RPM = LOAD $ / (TRIP MILES + DH MILES))
      const loadAmount = typeof value === 'number' ? value : 0;
      const tripMiles = load["TRIP MILES"] ?? 0;
      const dhMiles = load["DH MILES"] ?? 0;
      const totalMiles = tripMiles + dhMiles;
      if (totalMiles > 0 && loadAmount > 0) {
        const rpm = loadAmount / totalMiles;
        await updateLoad(load.id, "RPM", rpm);
      } else {
        await updateLoad(load.id, "RPM", null);
      }
    }

    // Auto-calculate RPM when Trip Miles changes
    if (field === "TRIP MILES") {
      const loadAmount = load["LOAD  $"] ?? 0;
      const tripMiles = typeof value === 'number' ? value : 0;
      const dhMiles = load["DH MILES"] ?? 0;
      const totalMiles = tripMiles + dhMiles;
      if (totalMiles > 0 && loadAmount > 0) {
        const rpm = loadAmount / totalMiles;
        await updateLoad(load.id, "RPM", rpm);
      } else {
        await updateLoad(load.id, "RPM", null);
      }
    }

    // Auto-calculate RPM when DH Miles changes
    if (field === "DH MILES") {
      const loadAmount = load["LOAD  $"] ?? 0;
      const tripMiles = load["TRIP MILES"] ?? 0;
      const dhMiles = typeof value === 'number' ? value : 0;
      const totalMiles = tripMiles + dhMiles;
      if (totalMiles > 0 && loadAmount > 0) {
        const rpm = loadAmount / totalMiles;
        await updateLoad(load.id, "RPM", rpm);
      } else {
        await updateLoad(load.id, "RPM", null);
      }
    }
  };

  const handleDeleteLoad = async (loadId: string) => {
    await deleteLoad(loadId);
  };

  const handlePermanentlyDeleteLoad = async (loadId: string) => {
    if (permanentlyDeleteLoad) {
      return await permanentlyDeleteLoad(loadId);
    }
    return false;
  };

  const handleAddLoad = async (driverInfo: {
    driver_id?: string;
    name: string;
    phone: string;
    contractType: Load["CONTRACT TYPE"];
    truckNumber?: number;
    trailerNumber?: string;
    origin?: string;
    destination?: string;
    pickUpDate?: string;
    deliveryDate?: string;
    loadNumber?: string;
    rate?: number;
    dhMiles?: number;
    tripMiles?: number;
    trailerType?: Load["TRAILER TYPE"];
    tarpStatus?: Load["TARP STATUS"];
    extraStops?: number;
  }) => {
    // Calculate total miles and RPM
    const dhMiles = driverInfo.dhMiles != null ? Math.round(driverInfo.dhMiles) : null;
    const tripMiles = driverInfo.tripMiles != null ? Math.round(driverInfo.tripMiles) : null;
    const totalMiles = (dhMiles ?? 0) + (tripMiles ?? 0);
    const rpm = totalMiles > 0 && driverInfo.rate ? driverInfo.rate / totalMiles : null;

    // Compute driver pay from org contract profile (PERCENTAGE or MILEAGE).
    // Falls back to load_amount only if computation is impossible (e.g. mileage
    // contract with zero trip miles).
    const computedPay =
      computeDriverPay(driverInfo.contractType, driverInfo.rate ?? null, tripMiles, contractProfiles) ??
      (driverInfo.rate ?? null);

    // Extract ZIP from delivery location
    const deliveryZip = driverInfo.destination ? extractZipFromLocation(driverInfo.destination) : null;

    const newLoad: Load = {
      NR: 0, // No longer used
      driver_id: driverInfo.driver_id || '', // Will be set by addLoadToDb if empty
      "DRIVER NAME": driverInfo.name,
      "DRIVER PHONE": driverInfo.phone,
      "CONTRACT TYPE": driverInfo.contractType,
      "TRUCK #": driverInfo.truckNumber || 0,
      "Trailer number": driverInfo.trailerNumber || "",
      "TRAILER TYPE": driverInfo.trailerType ?? null,
      "PICK UP CITY/STATE/ZIP": driverInfo.origin || "",
      "DELIVERY CITY/STATE/ZIP": driverInfo.destination || "",
      "PICK UP DATE": driverInfo.pickUpDate || (() => {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const yy = String(now.getFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
      })(),
      "DELIVERY DATE": driverInfo.deliveryDate || "",
      "LOAD #": driverInfo.loadNumber || "",
      "LOAD  $": driverInfo.rate ?? null,
      "DRIVER PAY ": computedPay,
      "DRIVER PAY MANUALLY EDITED": false,
      "TOTAL MILES": totalMiles,
      "TRIP MILES": tripMiles,
      "DH MILES": dhMiles,
      RPM: rpm,
      VERIFIED: false,
      Status: driverInfo.driver_id ? (driverStatuses[driverInfo.driver_id] || "Searching_for_load") : "Searching_for_load",
      "TARP STATUS": driverInfo.tarpStatus || "Untarped",
      INVOICED: "Not Invoiced",
      "ACCOUNTING NOTES": null,
      "ADMIN ACCOUNTING NOTES": null,
      "ZIP CODE": deliveryZip,
      "AVAILABLE ON": null,
      "EXTRA STOPS": driverInfo.extraStops ?? 0,
      "PAY STATUS": "Unpaid",
      "PAID AT": null,
      isArchived: false,
    };

    const newLoadId = await addLoadToDb(newLoad);
    setAddLoadDialogOpen(false);
    toast.success("Load added successfully");


    // Highlight the newly added load
    if (newLoadId) {
      setHighlightedLoadId(newLoadId);
      // Clear the highlight after 3 seconds
      setTimeout(() => {
        setHighlightedLoadId(null);
      }, 3000);
    }
  };

  // Transform allDrivers to EnrichedDriver format for the modal
  const enrichedDrivers: EnrichedDriver[] = useMemo(() => {
    return allDrivers.map((driver) => {
      // Check if this driver has an external active load (incoming driver scenario)
      const incomingInfo = incomingDrivers.find(d => d.driverId === driver.driver_id);
      
      return {
        driver_id: driver.driver_id,
        name: driver.name,
        phone: driver.phone,
        contractType: driver.contractType as Load["CONTRACT TYPE"],
        truckNumber: driver.truckNumber,
        trailerNumber: driver.trailerNumber,
        currentStatus: driverStatuses[driver.driver_id] || null,
        lastDeliveryLocation: driver.lastDeliveryLocation,
        lastDeliveryDate: driver.lastDeliveryDate,
        fuelEnabled: driver.fuelEnabled,
        // Driver ownership
        assignedDispatcherId: driver.assignedDispatcherId || null,
        // Sunset transfer fields
        hasExternalActiveLoad: !!incomingInfo,
        externalLoadOwner: incomingInfo?.oldDispatcherName || null,
        estimatedAvailableDate: incomingInfo?.estimatedAvailableDate || null,
        externalLoadLocation: incomingInfo?.currentLocation || null,
        // Manual current-location override
        currentLocationOverride: driver.currentLocationOverride ?? null,
        currentLocationOverrideSetAt: driver.currentLocationOverrideSetAt ?? null,
      };
    });
  }, [allDrivers, driverStatuses, incomingDrivers]);

  // Always hide archived loads, and filter by dispatcher when viewing as another dispatcher
  const displayedLoads = loads.filter((load) => {
    if (load.isArchived) return false;

    // When viewing as a specific dispatcher, filter to show only their loads (by user_id)
    // OR loads where the driver is assigned to them
    if (viewingAsDispatcherId) {
      const assignedDispatcherId = driverAssignments[load.driver_id];
      return load.user_id === viewingAsDispatcherId || assignedDispatcherId === viewingAsDispatcherId;
    }

    return true;
  });

  // Apply filters for KPI calculation (should match SpreadsheetTable internal filters)
  const getFilteredLoads = () => {
    let filtered = displayedLoads;

    // Filter by selected drivers
    if (selectedDriverIds.length > 0) {
      filtered = filtered.filter(load => selectedDriverIds.includes(load.driver_id));
    }
    
    // Filter to only active (my assigned) drivers - matches table's default behavior
    // This ensures KPIs show metrics for drivers visible in the table
    if (currentUserId && !viewingAsDispatcherId) {
      filtered = filtered.filter(load => {
        const assignedDispatcherId = driverAssignments[load.driver_id];
        // Show if driver is assigned to current user or has no assignment
        return !assignedDispatcherId || assignedDispatcherId === currentUserId;
      });
    }

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(load => {
        const deliveryDate = load["DELIVERY DATE"];
        if (!deliveryDate) return false;

        try {
          // Use parseDate to avoid UTC-shift bugs with ISO YYYY-MM-DD strings.
          const loadDate = parseDate(deliveryDate);
          if (!loadDate) return false;

          if (dateFilter === "week") {
            const { start: weekStart, end: weekEnd } = getDeliveryWeekRange(now, dateOffset);
            return loadDate >= weekStart && loadDate <= weekEnd;
          } else {
            const targetDate = new Date(now);
            targetDate.setMonth(targetDate.getMonth() + dateOffset);

            return loadDate.getMonth() === targetDate.getMonth() &&
              loadDate.getFullYear() === targetDate.getFullYear();
          }
        } catch {
          return false;
        }
      });
    }

    return filtered;
  };

  const filteredLoads = getFilteredLoads();

  // Calculate totals based on filtered loads
  const totalRevenue = filteredLoads.reduce((sum, load) => {
    const amount = load["LOAD  $"] ?? 0;
    return sum + amount;
  }, 0);

  const totalDriverPay = filteredLoads.reduce((sum, load) => {
    return sum + (load["DRIVER PAY "] ?? 0);
  }, 0);

  const totalMiles = filteredLoads.reduce((sum, load) => {
    const tripMiles = load["TRIP MILES"] ?? 0;
    const dhMiles = load["DH MILES"] ?? 0;
    return sum + tripMiles + dhMiles;
  }, 0);

  const activeDrivers = new Set(
    filteredLoads.map((load) => load.driver_id)
  ).size;

  const averageRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleRefresh = async () => {
    await refreshLoads();
    toast.success("Data refreshed");
  };

  return (
    <div className="min-h-screen bg-background">
      <SpreadsheetHeader
        onAddRow={() => { }}
        onOpenAddDialog={() => setAddLoadOpen(true)}
        totalLoads={filteredLoads.length}
        assignedDrivers={activeDrivers}
        totalRevenue={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        totalDriverPay={`$${totalDriverPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        totalMiles={totalMiles}
        averageRpm={`$${averageRpm.toFixed(2)}`}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
        isRefreshing={isLoading}
        currentTab="loads"
        onNavigate={(path) => navigate(path)}
        userEmail={userEmail}
        isAdmin={isAdmin}
        availableDriversCount={availableDriversCount}
      />
      <AddLoadModal
        open={addLoadDialogOpen}
        onOpenChange={(open) => {
          setAddLoadOpen(open);
          if (!open) {
            setPreSelectedDriverId(null);
            setPrefilledPickupLocation(undefined);
            setPrefilledPickupDate(undefined);
          }
        }}
        enrichedDrivers={enrichedDrivers}
        driverStatuses={driverStatuses}
        preSelectedDriverId={preSelectedDriverId}
        prefilledPickupLocation={prefilledPickupLocation}
        prefilledPickupDate={prefilledPickupDate}
        onAddLoad={handleAddLoad}
        onCreateDriver={async (data) => {
          const created = await createDriver(data);
          // Update the modal selection immediately
          return {
            driver_id: created.driver_id,
            name: created.name,
            phone: created.phone,
            contractType: created.contractType as Load["CONTRACT TYPE"],
            truckNumber: created.truckNumber,
            trailerNumber: created.trailerNumber,
            currentStatus: null,
            lastDeliveryLocation: created.lastDeliveryLocation,
            fuelEnabled: created.fuelEnabled,
          } as EnrichedDriver;
        }}
      />
      <main className="p-2 sm:p-4 md:p-6 overflow-x-hidden">
        <div className="w-full max-w-full overflow-hidden">
          <SpreadsheetTable
            data={displayedLoads}
            driverStatuses={driverStatuses}
            driverFuelStatus={Object.fromEntries(
              allDrivers.map((d) => [d.driver_id, d.fuelEnabled])
            )}
            onUpdateCell={handleUpdateCell}
            onUpdateDriverStatus={handleUpdateDriverStatus}
            onDeleteLoad={handleDeleteLoad}
            highlightedLoadId={highlightedLoadId}
            selectedDriverIds={selectedDriverIds}
            onSelectedDriverIdsChange={setSelectedDriverIds}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            dateOffset={dateOffset}
            onDateOffsetChange={setDateOffset}
            isAdmin={isAdmin}
            dispatcherData={dispatcherData}
            selectedDispatcherIds={selectedDispatcherIds}
            onSelectedDispatcherIdsChange={setSelectedDispatcherIds}
            dispatchers={dispatchers}
            driverAssignments={driverAssignments}
            currentUserId={currentUserId}
            viewingAsDispatcherId={viewingAsDispatcherId}
            onViewingAsDispatcherChange={setViewingAsDispatcherId}
            expandedDriverIds={expandedDriverIds}
            onToggleDriverExpanded={toggleDriverExpanded}
            onToggleAllDrivers={toggleAllDrivers}
            allDriversExpanded={allDriversExpanded}
            allDrivers={allDrivers}
            onAddLoadForDriver={handleAddLoadForDriver}
            onAddLoadForDriverWithContext={handleAddLoadForDriverWithContext}
            onAvailableDriversCountChange={setAvailableDriversCount}
            incomingDrivers={incomingDrivers}
          />
        </div>
      </main>
      <AppFooter />
    </div>
  );
};

export default Index;
