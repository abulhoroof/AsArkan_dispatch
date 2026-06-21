import { useEffect, useState, useCallback } from "react";
import { SpreadsheetHeader } from "@/components/SpreadsheetHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Load } from "@/types/load";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Plus, X } from "lucide-react";
import { FuelStatusBadge } from "@/components/FuelStatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppFooter } from "@/components/AppFooter";
import { StatusBadge } from "@/components/StatusBadge";
import { ContractTypeBadge } from "@/components/ContractTypeBadge";
import { DriverSearchPanel } from "@/components/DriverSearchPanel";
import { DHDistanceCell } from "@/components/DHDistanceCell";
import { AddDriverSheet } from "@/components/AddDriverSheet";
import { ReassignDriverDialog } from "@/components/ReassignDriverDialog";
import { DriverInfoSheet } from "@/components/DriverInfoSheet";
import { clearSubdomainCache } from "@/hooks/useSubdomain";

import { Button } from "@/components/ui/button";
import { parse, isAfter, isBefore, isToday, startOfDay, subDays, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";

interface Driver {
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  location: string | null;
  contract_type: Load["CONTRACT TYPE"];
  truck_number: number | null;
  trailer_number: string | null;
  trailer_type: Load["TRAILER TYPE"];
  status: Load["Status"];
  available_on: string | null;
  dispatcher_email: string | null;
  assigned_dispatcher_id: string | null;
  fuel_enabled: boolean;
}

// Cache for distance calculations
const distanceCache = new Map<string, number>();

function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<'available_on' | 'dispatcher'>('available_on');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [showAddDriverSheet, setShowAddDriverSheet] = useState(() => {
    return localStorage.getItem('form-open:add-driver') === 'true';
  });
  const [selectedDriverForFinance, setSelectedDriverForFinance] = useState<{id: string; name: string; contractType: string; fuelEnabled: boolean} | null>(null);
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { organizationId } = useOrganization();

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchPickupDate, setSearchPickupDate] = useState<Date | null>(null);
  const [searchPickupLocation, setSearchPickupLocation] = useState("");
  const [driverDistances, setDriverDistances] = useState<Record<string, number | null>>({});
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [calculatingDriverIds, setCalculatingDriverIds] = useState<Set<string>>(new Set());

  // Text filter state
  const [nameFilter, setNameFilter] = useState("");
  const [truckNumberFilter, setTruckNumberFilter] = useState("");
  const [trailerNumberFilter, setTrailerNumberFilter] = useState("");
  // Dropdown filter state
  const [statusFilter, setStatusFilter] = useState("all");
  const [contractTypeFilter, setContractTypeFilter] = useState("all");
  const [dispatcherFilter, setDispatcherFilter] = useState("all");

  // Fetch user info on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? undefined);
    });
  }, []);

  const parseDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    try {
      if (dateStr.includes('/')) {
        return parse(dateStr, 'MM/dd/yy', new Date());
      } else if (dateStr.includes('-')) {
        return new Date(dateStr);
      }
      return null;
    } catch {
      return null;
    }
  };

  const getDateStatus = (dateStr: string | null): 'past' | 'today' | 'future' | null => {
    const date = parseDate(dateStr);
    if (!date) return null;

    const today = startOfDay(new Date());
    const compareDate = startOfDay(date);

    if (isToday(compareDate)) return 'today';
    if (isBefore(compareDate, today)) return 'past';
    if (isAfter(compareDate, today)) return 'future';
    return null;
  };

  const getDateColorClass = (dateStr: string | null) => {
    const status = getDateStatus(dateStr);
    switch (status) {
      case 'past':
        return 'text-red-600 dark:text-red-400 font-medium';
      case 'today':
        return 'text-amber-600 dark:text-amber-400 font-semibold';
      case 'future':
        return 'text-emerald-600 dark:text-emerald-400 font-medium';
      default:
        return '';
    }
  };

  // Check if driver's available_on date is within range (pickup date - 2 days to pickup date)
  const isDriverAvailableInRange = (availableOn: string | null, pickupDate: Date): boolean => {
    const available = parseDate(availableOn);
    if (!available) return false;

    const minDate = startOfDay(subDays(pickupDate, 2));
    const maxDate = startOfDay(pickupDate);
    const availableDay = startOfDay(available);

    return isWithinInterval(availableDay, { start: minDate, end: maxDate });
  };

  // Filter drivers by date
  const dateFilteredDrivers = isSearchActive && searchPickupDate
    ? drivers.filter(d => isDriverAvailableInRange(d.available_on, searchPickupDate))
    : drivers;

  // Filter drivers by text filters and dropdown filters
  const textFilteredDrivers = dateFilteredDrivers.filter(driver => {
    const matchesName = !nameFilter || 
      driver.driver_name.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesTruck = !truckNumberFilter || 
      driver.truck_number?.toString().includes(truckNumberFilter);
    const matchesTrailer = !trailerNumberFilter || 
      driver.trailer_number?.toLowerCase().includes(trailerNumberFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || driver.status === statusFilter;
    const matchesContract = contractTypeFilter === "all" || driver.contract_type === contractTypeFilter;
    const matchesDispatcher = dispatcherFilter === "all" || 
      (dispatcherFilter === "unassigned" ? !driver.dispatcher_email : driver.dispatcher_email === dispatcherFilter);
    return matchesName && matchesTruck && matchesTrailer && matchesStatus && matchesContract && matchesDispatcher;
  });

  const hasTextFilters = nameFilter || truckNumberFilter || trailerNumberFilter || 
    statusFilter !== "all" || contractTypeFilter !== "all" || dispatcherFilter !== "all";

  const clearTextFilters = () => {
    setNameFilter("");
    setTruckNumberFilter("");
    setTrailerNumberFilter("");
    setStatusFilter("all");
    setContractTypeFilter("all");
    setDispatcherFilter("all");
  };

  // Derive unique values for dropdown filters
  const uniqueStatuses = [...new Set(drivers.map(d => d.status).filter(Boolean))].sort();
  const uniqueContractTypes = [...new Set(drivers.map(d => d.contract_type).filter(Boolean))].sort();
  const uniqueDispatchers = [...new Set(drivers.map(d => d.dispatcher_email).filter(Boolean))].sort() as string[];

  // Sort drivers - by distance when searching, otherwise by selected field
  const sortedDrivers = [...textFilteredDrivers].sort((a, b) => {
    // When search is active, sort by distance first
    if (isSearchActive && Object.keys(driverDistances).length > 0) {
      const distA = driverDistances[a.driver_id];
      const distB = driverDistances[b.driver_id];

      // Put drivers with no distance at the end
      if (distA === null && distB === null) return 0;
      if (distA === null) return 1;
      if (distB === null) return -1;

      return distA - distB; // Nearest first
    }

    // Sort by selected field
    if (sortField === 'dispatcher') {
      const dispA = (a.dispatcher_email || '').toLowerCase();
      const dispB = (b.dispatcher_email || '').toLowerCase();

      if (!dispA && !dispB) return 0;
      if (!dispA) return 1;
      if (!dispB) return -1;

      const comparison = dispA.localeCompare(dispB);
      return sortOrder === 'asc' ? comparison : -comparison;
    }

    // Sort by available_on date
    const dateA = parseDate(a.available_on);
    const dateB = parseDate(b.available_on);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    const comparison = dateA.getTime() - dateB.getTime();
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'available_on' | 'dispatcher') => {
    if (sortField === field) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const calculateDistance = async (fromLocation: string, toLocation: string): Promise<number | null> => {
    const cacheKey = `${fromLocation}|${toLocation}`;

    if (distanceCache.has(cacheKey)) {
      return distanceCache.get(cacheKey)!;
    }

    try {
      const { data, error } = await supabase.functions.invoke('calculate-distance', {
        body: { fromPlace: fromLocation, toPlace: toLocation }
      });

      if (error) {
        console.error('Distance calculation error:', error);
        return null;
      }

      const distance = data?.distance ?? null;
      if (distance !== null) {
        distanceCache.set(cacheKey, distance);
      }
      return distance;
    } catch (err) {
      console.error('Failed to calculate distance:', err);
      return null;
    }
  };

  // Handle date selection - immediately filters drivers
  const handleDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      setSearchPickupDate(date);
      setIsSearchActive(true);
      setDriverDistances({});
      setSearchPickupLocation("");

      // Check if any drivers match
      const filteredCount = drivers.filter(d => isDriverAvailableInRange(d.available_on, date)).length;
      if (filteredCount === 0) {
        toast.info("No drivers available in the selected date range");
      }
    } else {
      setSearchPickupDate(null);
      setIsSearchActive(false);
    }
  }, [drivers]);

  // Handle location search - calculates distances for filtered drivers (or all if no date filter)
  const handleLocationSearch = useCallback(async (pickupLocation: string) => {
    setSearchPickupLocation(pickupLocation);
    setIsSearchActive(true);
    setIsCalculatingDistances(true);
    setDriverDistances({});

    // Use date-filtered drivers if date is set, otherwise all drivers
    const filteredDrivers = searchPickupDate
      ? drivers.filter(d => isDriverAvailableInRange(d.available_on, searchPickupDate))
      : drivers;

    if (filteredDrivers.length === 0) {
      setIsCalculatingDistances(false);
      return;
    }

    // Track which drivers are being calculated
    const calculatingIds = new Set(filteredDrivers.map(d => d.driver_id));
    setCalculatingDriverIds(calculatingIds);

    // Calculate distances for filtered drivers
    const batchSize = 5;
    for (let i = 0; i < filteredDrivers.length; i += batchSize) {
      const batch = filteredDrivers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (driver) => {
          if (driver.location) {
            const distance = await calculateDistance(driver.location, pickupLocation);

            setDriverDistances(prev => ({
              ...prev,
              [driver.driver_id]: distance
            }));
          } else {
            setDriverDistances(prev => ({
              ...prev,
              [driver.driver_id]: null
            }));
          }

          setCalculatingDriverIds(prev => {
            const next = new Set(prev);
            next.delete(driver.driver_id);
            return next;
          });
        })
      );

      if (i + batchSize < filteredDrivers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setIsCalculatingDistances(false);
    toast.success(`Calculated distances for ${filteredDrivers.length} drivers`);
  }, [drivers, searchPickupDate]);

  const handleClearSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchPickupDate(null);
    setSearchPickupLocation("");
    setDriverDistances({});
    setCalculatingDriverIds(new Set());
  }, []);

  const fetchDrivers = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_drivers_with_dispatchers', {
        p_org_id: organizationId
      });

      if (error) throw error;

      const driversList: Driver[] = (data || []).map((d: any) => ({
        driver_id: d.driver_id,
        driver_name: d.driver_name || '',
        driver_phone: d.driver_phone || '',
        location: d.delivery_location || null,
        contract_type: d.contract_type as Load["CONTRACT TYPE"],
        truck_number: d.truck_number,
        trailer_number: d.trailer_number,
        trailer_type: d.trailer_type as Load["TRAILER TYPE"],
        status: (d.status as Load["Status"]) || "Searching_for_load",
        available_on: d.available_on,
        dispatcher_email: d.dispatcher_email,
        assigned_dispatcher_id: d.assigned_dispatcher_id || null,
        fuel_enabled: d.fuel_enabled ?? true,
      }));

      setDrivers(driversList);
    } catch (error: any) {
      toast.error("Error fetching drivers: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!organizationId) return;
    
    fetchDrivers();

    // Subscribe to real-time updates - scoped to current organization
    const loadsChannel = supabase
      .channel(`drivers-page-loads-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loads',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchDrivers();
        }
      )
      .subscribe();

    const driversChannel = supabase
      .channel(`drivers-page-drivers-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(loadsChannel);
      supabase.removeChannel(driversChannel);
    };
  }, [organizationId]);

  const handleSignOut = async () => {
    clearSubdomainCache();
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRefresh = async () => {
    await fetchDrivers();
    toast.success("Drivers refreshed");
  };

  const handleToggleFuel = async (driverId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ fuel_enabled: enabled })
        .eq('id', driverId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      // Optimistically update local state
      setDrivers(prev => prev.map(d => 
        d.driver_id === driverId ? { ...d, fuel_enabled: enabled } : d
      ));

      toast.success(enabled ? "Fuel enabled for driver" : "Fuel disabled for driver");
    } catch (error: any) {
      toast.error("Failed to update fuel status: " + error.message);
    }
  };

  const handleAddDriver = async (driver: {
    name: string;
    phone: string;
    contractType: Load["CONTRACT TYPE"];
    truckNumber?: number;
    trailerNumber?: string;
    trailerType?: Load["TRAILER TYPE"];
    location?: string;
  }) => {
    try {
      // Get current user to auto-assign as dispatcher
      const { data: { user } } = await supabase.auth.getUser();

      const { data: newDriver, error } = await supabase
        .from('drivers')
        .insert({
          driver_name: driver.name,
          driver_phone: driver.phone || null,
          contract_type: driver.contractType,
          truck_number: driver.truckNumber || null,
          trailer_number: driver.trailerNumber || null,
          trailer_type: driver.trailerType || null,
          assigned_dispatcher_id: user?.id || null,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;

      // Always create an initial load entry to track the driver with available_on date
      if (newDriver) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get the next NR number for this user
          const { data: maxNrData } = await supabase
            .from('loads')
            .select('nr')
            .eq('user_id', user.id)
            .eq('organization_id', organizationId)
            .order('nr', { ascending: false })
            .limit(1);

          const nextNr = (maxNrData?.[0]?.nr || 0) + 1;

          // Format today's date as MM/DD/YY for available_on
          const today = new Date();
          const availableOn = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;

          await supabase
            .from('loads')
            .insert({
              user_id: user.id,
              organization_id: organizationId,
              driver_id: newDriver.id,
              driver_name: driver.name,
              driver_phone: driver.phone || null,
              contract_type: driver.contractType,
              truck_number: driver.truckNumber || null,
              trailer_number: driver.trailerNumber || null,
              trailer_type: driver.trailerType || null,
              nr: nextNr,
              delivery_location: driver.location || null,
              status: 'Searching_for_load',
              available_on: availableOn,
            });
        }
      }

      toast.success(`Driver "${driver.name}" added successfully`);
      await fetchDrivers();
    } catch (error: any) {
      toast.error("Failed to add driver: " + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Calculate driver-specific KPIs
  const pastDueCount = drivers.filter(d => getDateStatus(d.available_on) === 'past').length;
  const availableTodayCount = drivers.filter(d => getDateStatus(d.available_on) === 'today').length;
  const searchingCount = drivers.filter(d => d.status === 'Searching_for_load').length;
  const onLoadCount = drivers.filter(d => d.status === 'In transit' || d.status === 'Covered').length;

  return (
    <div className="min-h-screen bg-background">
      <SpreadsheetHeader
        onAddRow={() => { }}
        onOpenAddDialog={() => { setShowAddDriverSheet(true); localStorage.setItem('form-open:add-driver', 'true'); }}
        totalLoads={0}
        assignedDrivers={drivers.length}
        totalRevenue="$0.00"
        totalMiles={0}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
        isRefreshing={isLoading}
        currentTab="trucks"
        onNavigate={(path) => navigate(path)}
        userEmail={userEmail}
        isAdmin={isAdmin}
        pastDueCount={pastDueCount}
        availableTodayCount={availableTodayCount}
        searchingCount={searchingCount}
        onLoadCount={onLoadCount}
      />
      <main className="p-2 sm:p-4 md:p-6">
        <DriverSearchPanel
          onDateChange={handleDateChange}
          onLocationSearch={handleLocationSearch}
          onClear={handleClearSearch}
          isSearching={isCalculatingDistances}
          matchCount={isSearchActive ? dateFilteredDrivers.length : undefined}
          totalCount={isSearchActive ? drivers.length : undefined}
          selectedDate={searchPickupDate || undefined}
        />

        {/* Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-2 md:gap-3 mb-4 items-center">
          <Input
            placeholder="Filter by name..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="col-span-2 sm:col-span-1 md:max-w-[180px]"
          />
          <Input
            placeholder="Truck #..."
            value={truckNumberFilter}
            onChange={(e) => setTruckNumberFilter(e.target.value)}
            className="md:max-w-[100px]"
          />
          <Input
            placeholder="Trailer #..."
            value={trailerNumberFilter}
            onChange={(e) => setTrailerNumberFilter(e.target.value)}
            className="md:max-w-[100px]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:max-w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={contractTypeFilter} onValueChange={setContractTypeFilter}>
            <SelectTrigger className="md:max-w-[160px]">
              <SelectValue placeholder="All Contracts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contracts</SelectItem>
              {uniqueContractTypes.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dispatcherFilter} onValueChange={setDispatcherFilter}>
            <SelectTrigger className="md:max-w-[180px]">
              <SelectValue placeholder="All Dispatchers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dispatchers</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {uniqueDispatchers.map(d => (
                <SelectItem key={d} value={d}>{d.split('@')[0]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasTextFilters && (
            <Button variant="ghost" size="sm" onClick={clearTextFilters} className="col-span-2 sm:col-span-1">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Driver Name</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Last Drop-off</TableHead>
                {isSearchActive && <TableHead>DH Miles</TableHead>}
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('available_on')}
                >
                  <div className="flex items-center gap-1">
                    Available On
                    {sortField === 'available_on' && sortOrder === 'asc' && <ArrowUp className="h-4 w-4 text-primary" />}
                    {sortField === 'available_on' && sortOrder === 'desc' && <ArrowDown className="h-4 w-4 text-primary" />}
                    {sortField !== 'available_on' && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead>Truck #</TableHead>
                <TableHead>Trailer #</TableHead>
                <TableHead>Trailer Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('dispatcher')}
                >
                  <div className="flex items-center gap-1">
                    Dispatcher
                    {sortField === 'dispatcher' && sortOrder === 'asc' && <ArrowUp className="h-4 w-4 text-primary" />}
                    {sortField === 'dispatcher' && sortOrder === 'desc' && <ArrowDown className="h-4 w-4 text-primary" />}
                    {sortField !== 'dispatcher' && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSearchActive ? 12 : 11} className="text-center text-muted-foreground">
                    {isSearchActive
                      ? "No drivers available for the selected date range"
                      : "No drivers found"}
                  </TableCell>
                </TableRow>
              ) : (
                sortedDrivers.map((driver) => (
                  <TableRow
                    key={driver.driver_id}
                    onClick={() => setSelectedDriverForFinance({
                      id: driver.driver_id,
                      name: driver.driver_name,
                      contractType: driver.contract_type || 'LP GOLD',
                      fuelEnabled: driver.fuel_enabled
                    })}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">{driver.driver_name}</TableCell>
                    <TableCell>
                      <ContractTypeBadge type={driver.contract_type} />
                    </TableCell>
                    <TableCell>{driver.location || '-'}</TableCell>
                    {isSearchActive && (
                      <TableCell>
                        <DHDistanceCell
                          distance={driverDistances[driver.driver_id]}
                          isCalculating={calculatingDriverIds.has(driver.driver_id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className={cn(getDateColorClass(driver.available_on))}>
                      {driver.available_on || '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={driver.status} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <FuelStatusBadge
                        enabled={driver.fuel_enabled}
                        showToggle={isAdmin}
                        onToggle={isAdmin ? (enabled) => handleToggleFuel(driver.driver_id, enabled) : undefined}
                        compact={!isAdmin}
                      />
                    </TableCell>
                    <TableCell>{driver.truck_number || '-'}</TableCell>
                    <TableCell>{driver.trailer_number || '-'}</TableCell>
                    <TableCell>{driver.trailer_type || '-'}</TableCell>
                    <TableCell>{driver.driver_phone}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <ReassignDriverDialog
                          driverId={driver.driver_id}
                          driverName={driver.driver_name}
                          currentDispatcherEmail={driver.dispatcher_email}
                          currentDispatcherId={driver.assigned_dispatcher_id}
                          onReassigned={fetchDrivers}
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {driver.dispatcher_email ? driver.dispatcher_email.split('@')[0] : '-'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </main>
      <AppFooter />

      <AddDriverSheet
        open={showAddDriverSheet}
        onOpenChange={(open) => { setShowAddDriverSheet(open); if (open) localStorage.setItem('form-open:add-driver', 'true'); else localStorage.removeItem('form-open:add-driver'); }}
        onAddDriver={handleAddDriver}
        isAdmin={isAdmin}
      />

      <DriverInfoSheet
        open={!!selectedDriverForFinance}
        onOpenChange={(open) => !open && setSelectedDriverForFinance(null)}
        driverId={selectedDriverForFinance?.id || null}
        driverName={selectedDriverForFinance?.name || ""}
        driverContractType={selectedDriverForFinance?.contractType || "LP GOLD"}
        driverFuelEnabled={selectedDriverForFinance?.fuelEnabled ?? true}
        isAdmin={isAdmin}
        onToggleFuel={handleToggleFuel}
        onDriverUpdated={fetchDrivers}
      />
    </div>
  );
}

export default Drivers;
