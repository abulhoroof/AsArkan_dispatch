import { useState, useEffect, useMemo } from "react";
import { Load } from "@/types/load";
import { SpreadsheetHeader } from "@/components/SpreadsheetHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, History, ChevronLeft, ChevronRight, X, Filter, Search, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppFooter } from "@/components/AppFooter";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { StatusBadge } from "@/components/StatusBadge";
import { InvoicedBadge } from "@/components/InvoicedBadge";
import { ContractTypeBadge } from "@/components/ContractTypeBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { startOfMonth, endOfMonth, addMonths, format, isWithinInterval, parse } from "date-fns";
import { getDeliveryWeekRange } from "@/utils/date";
import { parseDate, formatDateForDisplay } from "@/utils/date";

interface LoadWithDispatcher {
  id: string;
  nr: number;
  driver_id: string;
  driver_name: string;
  driver_phone: string | null;
  contract_type: string;
  truck_number: number | null;
  trailer_number: string | null;
  pick_up_location: string | null;
  delivery_location: string | null;
  pick_up_date: string | null;
  delivery_date: string | null;
  load_number: string | null;
  load_amount: number | null;
  driver_pay: number | null;
  total_miles: number | null;
  trip_miles: number | null;
  dh_miles: number | null;
  rpm: number | null;
  status: string | null;
  invoiced: string | null;
  verified: boolean | null;
  user_id: string;
  dispatcher_email?: string;
  dispatcher_name?: string;
  current_dispatcher_id?: string | null;
  current_dispatcher_name?: string;
}

interface Dispatcher {
  id: string;
  email: string;
  name: string;
}

type DateFilter = "week" | "month";

const STATUS_OPTIONS = [
  "Searching_for_load",
  "Covered",
  "In transit",
  "Broke Down",
  "Delivered",
];

const INVOICED_OPTIONS = ["Invoiced", "Not Invoiced", "Missing BOL"];

const DATE_STORAGE_KEY_PREFIX = 'asarkan_tms_date_allloads_';

const AllLoads = () => {
  const [loads, setLoads] = useState<LoadWithDispatcher[]>([]);
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  const { organizationId } = useOrganization();

  // Filter states with localStorage persistence
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [dateOffset, setDateOffset] = useState(0);
  const [dateStateLoaded, setDateStateLoaded] = useState(false);
  const [selectedDispatcherIds, setSelectedDispatcherIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedInvoicedStatuses, setSelectedInvoicedStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    if (!isRoleLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isRoleLoading, navigate]);

  useEffect(() => {
    if (isAdmin && organizationId) {
      fetchAllLoads();
    }
  }, [isAdmin, organizationId]);

  const fetchAllLoads = async () => {
    if (!organizationId) return;
    
    try {
      setIsLoading(true);
      
      // Fetch all loads with dispatcher info using the RPC function
      const { data: loadsData, error: loadsError } = await supabase
        .from('loads')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (loadsError) throw loadsError;

      // Fetch dispatcher info for all loads
      const { data: dispatcherData, error: dispatcherError } = await (supabase.rpc as any)('get_loads_with_dispatcher', {
        p_org_id: organizationId
      });
      
      if (dispatcherError) throw dispatcherError;

      // Fetch driver assignments to get current dispatcher
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('id, assigned_dispatcher_id')
        .eq('organization_id', organizationId);
      
      if (driversError) throw driversError;

      // Fetch all dispatchers for name lookup
      const { data: allDispatchers, error: dispatchersError } = await (supabase.rpc as any)('get_all_dispatchers', {
        p_org_id: organizationId
      });
      
      if (dispatchersError) throw dispatchersError;

      // Store dispatchers for filter dropdown
      setDispatchers(allDispatchers || []);

      // Create maps for lookups
      const dispatcherMap = new Map<string, { email: string; name: string }>(
        (dispatcherData || []).map((d: any) => [d.load_id, { email: d.dispatcher_email, name: d.dispatcher_name }])
      );
      
      const driverAssignmentMap = new Map(
        (driversData || []).map((d: any) => [d.id, d.assigned_dispatcher_id])
      );
      
      const dispatcherNameMap = new Map(
        (allDispatchers || []).map((d: any) => [d.id, d.name])
      );

      const loadsWithDispatcher = (loadsData || []).map((load: any) => {
        const dispatcher = dispatcherMap.get(load.id);
        const currentDispatcherId = driverAssignmentMap.get(load.driver_id);
        const currentDispatcherName = currentDispatcherId ? dispatcherNameMap.get(currentDispatcherId) : null;
        
        return {
          ...load,
          dispatcher_email: dispatcher?.email,
          dispatcher_name: dispatcher?.name,
          current_dispatcher_id: currentDispatcherId,
          current_dispatcher_name: currentDispatcherName,
        };
      });

      setLoads(loadsWithDispatcher);
    } catch (error) {
      console.error("Failed to fetch loads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    // Clear date filter state from localStorage on logout
    if (userId) {
      try {
        localStorage.removeItem(`${DATE_STORAGE_KEY_PREFIX}${userId}`);
      } catch (e) {
        console.warn('Failed to clear date filter state from localStorage:', e);
      }
    }
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Get date range label
  const getDateRangeLabel = () => {
    const now = new Date();
    if (dateFilter === "week") {
      const { start, end } = getDeliveryWeekRange(now, dateOffset);
      return `Week: ${format(start, "M/d")} - ${format(end, "M/d")}`;
    } else if (dateFilter === "month") {
      const targetDate = addMonths(now, dateOffset);
      return format(targetDate, "MMMM yyyy");
    }
    return "All Dates";
  };

  // Parse date with multiple format support
  const parseLoadDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    
    // Try different formats
    const formats = [
      "MM/dd/yy",      // 12/03/25
      "MM/dd/yyyy",    // 12/03/2025
      "yyyy-MM-dd",    // 2025-12-07
    ];
    
    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
    return null;
  };

  // Filter loads
  const filteredLoads = useMemo(() => {
    let result = loads;

    // Date filter - always active now
    const now = new Date();
    let start: Date, end: Date;

    if (dateFilter === "week") {
      ({ start, end } = getDeliveryWeekRange(now, dateOffset));
    } else {
      const targetDate = addMonths(now, dateOffset);
      start = startOfMonth(targetDate);
      end = endOfMonth(targetDate);
    }

    result = result.filter((load) => {
      const loadDate = parseLoadDate(load.pick_up_date);
      if (!loadDate) return false;
      return isWithinInterval(loadDate, { start, end });
    });

    // Dispatcher filter
    if (selectedDispatcherIds.length > 0) {
      result = result.filter((load) => selectedDispatcherIds.includes(load.user_id));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      result = result.filter((load) => selectedStatuses.includes(load.status || "Searching_for_load"));
    }

    // Invoiced filter
    if (selectedInvoicedStatuses.length > 0) {
      result = result.filter((load) => selectedInvoicedStatuses.includes(load.invoiced || "Not Invoiced"));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((load) => {
        const driverName = (load.driver_name || "").toLowerCase();
        const loadNumber = (load.load_number || "").toLowerCase();
        const pickupLocation = (load.pick_up_location || "").toLowerCase();
        const deliveryLocation = (load.delivery_location || "").toLowerCase();
        return (
          driverName.includes(query) ||
          loadNumber.includes(query) ||
          pickupLocation.includes(query) ||
          deliveryLocation.includes(query)
        );
      });
    }

    return result;
  }, [loads, dateFilter, dateOffset, selectedDispatcherIds, selectedStatuses, selectedInvoicedStatuses, searchQuery]);

  // Calculate totals from filtered loads
  const totalRevenue = filteredLoads.reduce((sum, load) => sum + (load.load_amount ?? 0), 0);
  const totalDriverPay = filteredLoads.reduce((sum, load) => sum + (load.driver_pay ?? 0), 0);
  const totalMiles = filteredLoads.reduce((sum, load) => {
    const tripMiles = load.trip_miles ?? 0;
    const dhMiles = load.dh_miles ?? 0;
    return sum + tripMiles + dhMiles;
  }, 0);
  const activeDrivers = new Set(filteredLoads.map(load => load.driver_name)).size;
  const activeDispatchers = new Set(filteredLoads.map(load => load.user_id)).size;
  const averageRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

  // Calculate pending invoice KPI
  const pendingInvoiceLoads = filteredLoads.filter(
    load => load.invoiced === 'Not Invoiced' || load.invoiced === 'Missing BOL'
  );
  const pendingInvoiceAmount = pendingInvoiceLoads.reduce(
    (sum, load) => sum + (load.load_amount ?? 0), 0
  );
  const pendingInvoiceCount = pendingInvoiceLoads.length;

  // Calculate incomplete loads KPI
  const incompleteLoadsCount = filteredLoads.filter(
    load => (load.load_amount ?? 0) === 0 || load.invoiced === 'Missing BOL'
  ).length;

  const hasActiveFilters = selectedDispatcherIds.length > 0 || selectedStatuses.length > 0 || selectedInvoicedStatuses.length > 0 || searchQuery.trim() !== "";

  const clearAllFilters = () => {
    setDateFilter("week");
    setDateOffset(0);
    setSelectedDispatcherIds([]);
    setSelectedStatuses([]);
    setSelectedInvoicedStatuses([]);
    setSearchQuery("");
  };

  const toggleDispatcher = (id: string) => {
    setSelectedDispatcherIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleInvoiced = (status: string) => {
    setSelectedInvoicedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  if (isLoading || isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <SpreadsheetHeader
        onAddRow={() => {}}
        onOpenAddDialog={() => {}}
        totalLoads={filteredLoads.length}
        assignedDrivers={activeDrivers}
        totalDispatchers={activeDispatchers}
        totalRevenue={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        totalDriverPay={`$${totalDriverPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        totalMiles={totalMiles}
        averageRpm={`$${averageRpm.toFixed(2)}`}
        pendingInvoiceAmount={pendingInvoiceAmount}
        pendingInvoiceCount={pendingInvoiceCount}
        incompleteLoadsCount={incompleteLoadsCount}
        onRefresh={fetchAllLoads}
        onSignOut={handleSignOut}
        isRefreshing={isLoading}
        currentTab="all-loads"
        onNavigate={(path) => navigate(path)}
        userEmail={userEmail}
        isAdmin={isAdmin}
      />
      
      <main className="p-2 sm:p-4 md:p-6 overflow-x-hidden">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <Lock className="h-3.5 w-3.5" />
              Read-Only View - All Dispatchers' Loads
            </Badge>
            {hasActiveFilters && (
              <Badge variant="outline" className="gap-1 text-xs">
                Showing {filteredLoads.length} of {loads.length} loads
              </Badge>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 bg-muted/50 p-2 sm:p-3 rounded-lg border">
            {/* Search Input - full width on mobile */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search driver, load #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 w-full sm:w-[200px] bg-background text-sm"
              />
            </div>

            <div className="hidden sm:block h-6 w-px bg-border" />

            {/* Date Filter - scrollable row on mobile */}
            <div className="flex items-center gap-1 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <Filter className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setDateOffset(0); }}>
                <SelectTrigger className="w-[100px] sm:w-[120px] h-8 text-xs sm:text-sm shrink-0">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50">
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDateOffset((prev) => prev - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="px-2 py-1.5 text-xs sm:text-sm font-medium bg-muted rounded-md min-w-[100px] sm:min-w-[140px] text-center shrink-0">
                {getDateRangeLabel()}
              </div>
              
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDateOffset((prev) => prev + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              {dateOffset !== 0 && (
                <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={() => setDateOffset(0)}>
                  Today
                </Button>
              )}
            </div>

            {/* Filter buttons - scrollable on mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Dispatcher Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-background text-xs sm:text-sm shrink-0">
                    Dispatcher
                    {selectedDispatcherIds.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                        {selectedDispatcherIds.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-background border z-50" align="start">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {dispatchers.map((dispatcher) => (
                      <label
                        key={dispatcher.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                      >
                        <Checkbox
                          checked={selectedDispatcherIds.includes(dispatcher.id)}
                          onCheckedChange={() => toggleDispatcher(dispatcher.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{dispatcher.name || dispatcher.email}</div>
                          {dispatcher.name && (
                            <div className="text-xs text-muted-foreground truncate">{dispatcher.email}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedDispatcherIds.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setSelectedDispatcherIds([])}>
                      Clear
                    </Button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Status Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-background text-xs sm:text-sm shrink-0">
                    Status
                    {selectedStatuses.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                        {selectedStatuses.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3 bg-background border z-50" align="start">
                  <div className="space-y-2">
                    {STATUS_OPTIONS.map((status) => (
                      <label
                        key={status}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                      >
                        <Checkbox
                          checked={selectedStatuses.includes(status)}
                          onCheckedChange={() => toggleStatus(status)}
                        />
                        <StatusBadge status={status as any} />
                      </label>
                    ))}
                  </div>
                  {selectedStatuses.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setSelectedStatuses([])}>
                      Clear
                    </Button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Invoiced Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-background text-xs sm:text-sm shrink-0">
                    Invoiced
                    {selectedInvoicedStatuses.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                        {selectedInvoicedStatuses.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3 bg-background border z-50" align="start">
                  <div className="space-y-2">
                    {INVOICED_OPTIONS.map((status) => (
                      <label
                        key={status}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                      >
                        <Checkbox
                          checked={selectedInvoicedStatuses.includes(status)}
                          onCheckedChange={() => toggleInvoiced(status)}
                        />
                        <InvoicedBadge status={status as any} />
                      </label>
                    ))}
                  </div>
                  {selectedInvoicedStatuses.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setSelectedInvoicedStatuses([])}>
                      Clear
                    </Button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Clear All Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground text-xs shrink-0" onClick={clearAllFilters}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto w-full max-w-full">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-primary/20 hover:bg-primary/20 border-b-2 border-primary/30">
                  <TableHead className="font-semibold text-foreground">Dispatcher</TableHead>
                  <TableHead className="font-semibold text-foreground">Driver</TableHead>
                  <TableHead className="font-semibold text-foreground">Contract</TableHead>
                  <TableHead className="font-semibold text-foreground">Truck #</TableHead>
                  <TableHead className="font-semibold text-foreground">Pick Up</TableHead>
                  <TableHead className="font-semibold text-foreground">Delivery</TableHead>
                  <TableHead className="font-semibold text-foreground">Load #</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Rate</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Driver $</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Miles</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">RPM</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Invoiced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters ? "No loads match the selected filters" : "No loads found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoads.map((load, index) => (
                    <TableRow 
                      key={load.id} 
                      className={`hover:bg-accent/20 transition-colors ${index % 2 === 1 ? 'bg-muted/30' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{load.dispatcher_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{load.dispatcher_email}</div>
                          </div>
                          {load.user_id && load.current_dispatcher_id && load.user_id !== load.current_dispatcher_id && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className="shrink-0 gap-1 text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                  >
                                    <History className="h-3 w-3" />
                                    Historical
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Driver now with: <span className="font-medium">{load.current_dispatcher_name || 'Unknown'}</span>
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{load.driver_name}</div>
                        {load.driver_phone && (
                          <div className="text-xs text-muted-foreground">{load.driver_phone}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ContractTypeBadge type={load.contract_type as any} />
                      </TableCell>
                      <TableCell className="text-sm">{load.truck_number || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">{load.pick_up_location || '-'}</div>
                        <div className="text-xs text-muted-foreground">{formatDateForDisplay(parseDate(load.pick_up_date)) || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{load.delivery_location || '-'}</div>
                        <div className="text-xs text-muted-foreground">{formatDateForDisplay(parseDate(load.delivery_date)) || ''}</div>
                      </TableCell>
                      <TableCell className="text-sm">{load.load_number || '-'}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-revenue">
                        {load.load_amount !== null ? `$${load.load_amount.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${
                        load.driver_pay !== null && load.load_amount !== null
                          ? Math.abs(load.driver_pay - load.load_amount) < 0.01
                            ? 'text-revenue'
                            : load.driver_pay > load.load_amount 
                              ? 'text-red-500' 
                              : 'text-orange-500'
                          : 'text-muted-foreground'
                      }`}>
                        {load.driver_pay !== null ? `$${load.driver_pay.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {((load.trip_miles ?? 0) + (load.dh_miles ?? 0)).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {load.rpm !== null ? `$${load.rpm.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={load.status as any || "Searching_for_load"} />
                      </TableCell>
                      <TableCell>
                        <InvoicedBadge status={load.invoiced as any || "Not Invoiced"} />
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
    </div>
  );
};

export default AllLoads;