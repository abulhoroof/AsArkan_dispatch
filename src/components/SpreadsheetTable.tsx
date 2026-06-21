import React, { useState, useEffect, useRef, useCallback } from "react";
import { format, startOfDay, parse, startOfMonth, endOfMonth, addMonths, differenceInDays } from "date-fns";
import { getDeliveryWeekRange } from "@/utils/date";
import { parseDate } from "@/utils/date";
import { Load } from "@/types/load";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditableCell } from "./EditableCell";
import { DatePickerCell } from "./DatePickerCell";
import { LocationCell } from "./LocationCell";
import { MileageCell } from "./MileageCell";
import { TruncatedNotesCell } from "./TruncatedNotesCell";
import { StatusBadge } from "./StatusBadge";
import { InvoicedBadge } from "./InvoicedBadge";
import { DriverInfoCard } from "./DriverInfoCard";
import { ContractTypeBadge } from "./ContractTypeBadge";
import { PayStatusBadge } from "./PayStatusBadge";
import { AvailableFleetTable } from "./AvailableFleetTable";
import { Trash2, Filter, X, Calendar, ChevronLeft, ChevronRight, UserMinus, Eye, AlertTriangle, ChevronDown, ChevronRight as ChevronRightIcon, ChevronsDownUp, ChevronsUpDown, Truck, Plus, Clock, ArrowLeftFromLine, SlidersHorizontal, MoreVertical, Search, UserX, CalendarClock } from "lucide-react";
import { IncomingDriver } from "@/hooks/useSunsetState";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useSettings } from "@/contexts/SettingsContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";

interface DispatcherInfo {
  load_id: string;
  dispatcher_id: string;
  dispatcher_email: string;
  dispatcher_name: string;
}

interface DriverEntry {
  driver_id: string;
  name: string;
  phone: string;
  contractType: string;
  truckNumber: number | null;
  trailerNumber: string | null;
  lastDeliveryLocation: string | null;
  lastDeliveryDate: string | null;
  fuelEnabled: boolean;
  isHistoricalOnly?: boolean;
}

interface SpreadsheetTableProps {
  data: Load[];
  driverStatuses: Record<string, Load["Status"]>;
  driverFuelStatus?: Record<string, boolean>;
  onUpdateCell: (loadId: string, field: keyof Load, value: any) => void;
  onUpdateDriverStatus: (driverId: string, status: Load["Status"]) => void;
  onDeleteLoad: (loadId: string) => void;
  highlightedLoadId?: string | null;
  selectedDriverIds: string[];
  onSelectedDriverIdsChange: (ids: string[]) => void;
  dateFilter: "all" | "week" | "month";
  onDateFilterChange: (filter: "all" | "week" | "month") => void;
  dateOffset: number;
  onDateOffsetChange: (offset: number) => void;
  isAdmin?: boolean;
  dispatcherData?: DispatcherInfo[];
  selectedDispatcherIds?: string[];
  onSelectedDispatcherIdsChange?: (ids: string[]) => void;
  dispatchers?: { id: string; name: string; email: string }[];
  driverAssignments?: Record<string, string | null>;
  currentUserId?: string | null;
  viewingAsDispatcherId?: string | null;
  onViewingAsDispatcherChange?: (id: string | null) => void;
  // Collapsible row props
  expandedDriverIds?: Set<string>;
  onToggleDriverExpanded?: (driverId: string) => void;
  onToggleAllDrivers?: () => void;
  allDriversExpanded?: boolean;
  // Empty drivers feature
  allDrivers?: DriverEntry[];
  onAddLoadForDriver?: (driverId: string) => void;
  // Contextual add load with pre-fill
  onAddLoadForDriverWithContext?: (driverId: string, pickupLocation?: string, pickupDate?: string) => void;
  // Callback to report available drivers count to parent
  onAvailableDriversCountChange?: (count: number) => void;
  // Incoming drivers (for sunset transfer - shows external loads info in Available Fleet)
  incomingDrivers?: IncomingDriver[];
}

export const SpreadsheetTable = ({ 
  data, 
  driverStatuses, 
  driverFuelStatus = {},
  onUpdateCell, 
  onUpdateDriverStatus, 
  onDeleteLoad, 
  highlightedLoadId,
  selectedDriverIds,
  onSelectedDriverIdsChange,
  dateFilter,
  onDateFilterChange,
  dateOffset,
  onDateOffsetChange,
  isAdmin = false,
  dispatcherData = [],
  selectedDispatcherIds = [],
  onSelectedDispatcherIdsChange,
  dispatchers = [],
  driverAssignments = {},
  currentUserId = null,
  viewingAsDispatcherId = null,
  onViewingAsDispatcherChange,
  expandedDriverIds,
  onToggleDriverExpanded,
  onToggleAllDrivers,
  allDriversExpanded,
  allDrivers = [],
  onAddLoadForDriver,
  onAddLoadForDriverWithContext,
  onAvailableDriversCountChange,
  incomingDrivers = [],
}: SpreadsheetTableProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadToDelete, setLoadToDelete] = useState<{ loadId: string; driverName: string } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [showOnlyActiveDrivers, setShowOnlyActiveDrivers] = useState(true);
  // Tier-1 quick filters
  const [quickSearch, setQuickSearch] = useState("");
  const [emptyDriversOnly, setEmptyDriversOnly] = useState(false);
  const [deliveryWhen, setDeliveryWhen] = useState<"any" | "today" | "tomorrow">("any");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<Load["Status"]>>(new Set());

  const STATUS_OPTIONS: Array<{ value: Load["Status"]; label: string }> = [
    { value: "Searching_for_load", label: "Searching" },
    { value: "Covered", label: "Covered" },
    { value: "In transit", label: "In Transit" },
    { value: "Empty_34hr_reset", label: "34hr Reset" },
    { value: "Broke Down", label: "Broke Down" },
  ];

  const todayLocalMidnight = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const tomorrowLocalMidnight = React.useMemo(() => {
    const d = new Date(todayLocalMidnight);
    d.setDate(d.getDate() + 1);
    return d;
  }, [todayLocalMidnight]);

  const toggleStatus = (s: Load["Status"]) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const activeQuickFilterCount =
    (quickSearch.trim() ? 1 : 0) +
    (emptyDriversOnly ? 1 : 0) +
    (deliveryWhen !== "any" ? 1 : 0) +
    (selectedStatuses.size > 0 ? 1 : 0);

  const clearQuickFilters = () => {
    setQuickSearch("");
    setEmptyDriversOnly(false);
    setDeliveryWhen("any");
    setSelectedStatuses(new Set());
  };
  const { dropdownConfig } = useSettings();
  const { toast } = useToast();
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  
  // Check if collapsible mode is enabled
  const isCollapsibleEnabled = expandedDriverIds !== undefined && onToggleDriverExpanded !== undefined;
  
  // Track loads that have been moved out of current date range but should remain visible (ghosted)
  const [outOfRangeLoadIds, setOutOfRangeLoadIds] = useState<Set<string>>(new Set());

  // Column visibility
  const COL_VISIBILITY_KEY = 'asarkan_tms_col_visibility';
  const COLUMN_DEFS = [
    { key: 'pickup', label: 'Pick Up' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'pay', label: 'Pay' },
    { key: 'loadNumber', label: 'Load #' },
    { key: 'tarp', label: 'Tarp' },
    { key: 'verified', label: 'Verified' },
    { key: 'notes', label: 'Notes' },
    { key: 'condition', label: 'Condition' },
    { key: 'payStatus', label: 'Pay Status' },
    { key: 'accounting', label: 'Accounting' },
    ...(isAdmin ? [{ key: 'dispatcher', label: 'Dispatcher' }] : []),
  ];

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COL_VISIBILITY_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });

  const toggleColumnVisibility = useCallback((key: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(COL_VISIBILITY_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const resetColumnVisibility = useCallback(() => {
    setHiddenColumns(new Set());
    localStorage.removeItem(COL_VISIBILITY_KEY);
  }, []);

  const isColVisible = useCallback((key: string) => !hiddenColumns.has(key), [hiddenColumns]);

  const visibleColCount = (isCollapsibleEnabled ? 1 : 0) + 1 + ['pickup','delivery','mileage','pay','loadNumber','tarp','verified','notes','condition','payStatus','accounting'].filter(k => isColVisible(k)).length + (isAdmin && isColVisible('dispatcher') ? 1 : 0) + 1;
  
  // Uncheck "My active Drivers only" when viewing as a dispatcher
  useEffect(() => {
    if (viewingAsDispatcherId) {
      setShowOnlyActiveDrivers(false);
    }
  }, [viewingAsDispatcherId]);

  // Scroll to and highlight newly added load
  useEffect(() => {
    if (highlightedLoadId && rowRefs.current[highlightedLoadId]) {
      const rowElement = rowRefs.current[highlightedLoadId];
      rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedLoadId]);
  
  // Get unique drivers for filter
  const uniqueDrivers = Array.from(
    new Map(
      data.map(load => [
        load.driver_id,
        { 
          driver_id: load.driver_id,
          name: load["DRIVER NAME"], 
          phone: load["DRIVER PHONE"] 
        }
      ])
    ).values()
  );
  
  // Clear out-of-range loads when filter or offset changes
  useEffect(() => {
    setOutOfRangeLoadIds(new Set());
  }, [dateFilter, dateOffset]);

  // Reset offset when changing filter type
  const handleDateFilterChange = (value: "all" | "week" | "month") => {
    onDateFilterChange(value);
    onDateOffsetChange(0);
  };
  
  // Helper to check if a date is within the current filter range
  const checkIfDateInCurrentRange = useCallback((date: Date): boolean => {
    if (dateFilter === "all") return true;
    
    const now = new Date();
    
    if (dateFilter === "week") {
      const { start: weekStart, end: weekEnd } = getDeliveryWeekRange(now, dateOffset);
      return date >= weekStart && date <= weekEnd;
    } else { // month
      const targetDate = addMonths(now, dateOffset);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);
      return date >= monthStart && date <= monthEnd;
    }
  }, [dateFilter, dateOffset]);
  
  // Helper to get a description of which date range a load moved to
  const getDateRangeDescription = useCallback((date: Date): string => {
    if (dateFilter === "week") {
      const { start: weekStart } = getDeliveryWeekRange(date, 0);
      return `Week of ${format(weekStart, "MMM d")}`;
    } else {
      return format(date, "MMMM yyyy");
    }
  }, [dateFilter]);
  
  // Wrapper for pickup date changes that tracks out-of-range loads
  const handlePickupDateChange = useCallback((loadId: string, newDateValue: string) => {
    // Save the change first
    onUpdateCell(loadId, "PICK UP DATE", newDateValue);
    
    // Show toast for pickup date change
    if (newDateValue && newDateValue.trim() !== "") {
      toast({
        title: "Pickup date updated",
        description: `Pickup date set to ${newDateValue}`,
      });
    }
    
    // Only track if we're in a filtered view (not "all")
    if (dateFilter !== "all") {
      // If date is cleared, treat it as out of range
      if (!newDateValue || newDateValue.trim() === "") {
        setOutOfRangeLoadIds(prev => new Set(prev).add(loadId));
        toast({
          title: "Date cleared",
          description: "Load will remain visible until you change filters.",
        });
        return;
      }
      
      // Check if new date is outside current filter
      try {
        const newDate = parse(newDateValue, "MM/dd/yy", new Date());
        if (!isNaN(newDate.getTime())) {
          const isInRange = checkIfDateInCurrentRange(newDate);
          
          if (!isInRange) {
            // Add to out-of-range set
            setOutOfRangeLoadIds(prev => new Set(prev).add(loadId));
            
            // Show toast with destination info
            const destination = getDateRangeDescription(newDate);
            toast({
              title: "Load moved",
              description: `Load moved to ${destination}. Row will remain visible until you change filters.`,
            });
          } else {
            // If edited back into range, remove from out-of-range set
            setOutOfRangeLoadIds(prev => {
              const next = new Set(prev);
              next.delete(loadId);
              return next;
            });
          }
        }
      } catch {
        // If date parsing fails, treat as out of range to keep visible
        setOutOfRangeLoadIds(prev => new Set(prev).add(loadId));
      }
    }
  }, [dateFilter, checkIfDateInCurrentRange, getDateRangeDescription, onUpdateCell, toast]);

  // Handler for delivery date changes with toast
  const handleDeliveryDateChange = useCallback((loadId: string, newDateValue: string) => {
    onUpdateCell(loadId, "DELIVERY DATE", newDateValue);
    if (newDateValue) {
      toast({
        title: "Delivery date updated",
        description: `Delivery date set to ${newDateValue}`,
      });
    }
  }, [onUpdateCell, toast]);

  // Handler for Load $ (Rate) changes with toast
  const handleRateChange = useCallback((loadId: string, value: any) => {
    onUpdateCell(loadId, "LOAD  $", value);
    toast({
      title: "Rate updated",
      description: `Load rate set to $${Number(value).toFixed(2)}`,
    });
  }, [onUpdateCell, toast]);

  // Handler for Driver Pay changes with toast
  const handleDriverPayChange = useCallback((loadId: string, value: any) => {
    onUpdateCell(loadId, "DRIVER PAY ", value);
    onUpdateCell(loadId, "DRIVER PAY MANUALLY EDITED", true);
    toast({
      title: "Driver pay updated",
      description: `Driver pay set to $${Number(value).toFixed(2)}`,
    });
  }, [onUpdateCell, toast]);

  // Handler for Load # changes with toast
  const handleLoadNumberChange = useCallback((loadId: string, value: any) => {
    onUpdateCell(loadId, "LOAD #", value);
    toast({
      title: "Load number updated",
      description: value ? `Load # set to ${value}` : "Load # cleared",
    });
  }, [onUpdateCell, toast]);

  // Handler for Condition (INVOICED) changes with toast
  const handleConditionChange = useCallback((loadId: string, value: "Missing BOL" | "Invoiced" | "Not Invoiced") => {
    onUpdateCell(loadId, "INVOICED", value);
    toast({
      title: "Condition updated",
      description: `Status changed to "${value}"`,
    });
  }, [onUpdateCell, toast]);
  
  // Get formatted date range for display
  const getDateRangeLabel = () => {
    if (dateFilter === "all") return "All Dates";

    const now = new Date();
    if (dateFilter === "week") {
      const { start: weekStart, end: weekEnd } = getDeliveryWeekRange(now, dateOffset);
      return `Week: ${format(weekStart, "M/d")} - ${format(weekEnd, "M/d")}`;
    } else { // month
      const targetDate = addMonths(now, dateOffset);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
    }
  };


  const handleDeleteClick = (loadId: string, driverName: string) => {
    setLoadToDelete({ loadId, driverName });
    setConfirmName("");
    setDeleteDialogOpen(true);
  };


  const handleConfirmDelete = () => {
    if (loadToDelete && confirmName === loadToDelete.driverName) {
      onDeleteLoad(loadToDelete.loadId);
      setDeleteDialogOpen(false);
      setLoadToDelete(null);
      setConfirmName("");
      toast({
        title: "Load archived",
        description: `Load for driver ${loadToDelete.driverName} has been archived.`,
      });
    } else {
      toast({
        title: "Invalid driver name",
        description: "The driver name you entered does not match. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Filter data by selected dispatcher IDs (admin only)
  let filteredData = data;
  
  if (isAdmin && selectedDispatcherIds.length > 0) {
    const dispatcherLoadIds = new Set(
      dispatcherData
        .filter(d => selectedDispatcherIds.includes(d.dispatcher_id))
        .map(d => d.load_id)
    );
    filteredData = filteredData.filter(load => load.id && dispatcherLoadIds.has(load.id));
  }

  // Filter to show only active (non-reassigned) drivers
  // When checked, hide loads for historical-only drivers (reassigned to another dispatcher)
  if (showOnlyActiveDrivers && currentUserId) {
    filteredData = filteredData.filter(load => {
      const assignedDispatcherId = driverAssignments[load.driver_id];
      const driver = allDrivers.find(d => d.driver_id === load.driver_id);
      // Hide if this is a historical-only driver
      if (driver?.isHistoricalOnly) return false;
      // Show if driver is assigned to current user or has no assignment
      return !assignedDispatcherId || assignedDispatcherId === currentUserId;
    });
  }

  // Filter data by selected driver IDs
  if (selectedDriverIds.length > 0) {
    filteredData = filteredData.filter(load => selectedDriverIds.includes(load.driver_id));
  }

  // Apply date filter using simple date comparisons with offset
  if (dateFilter !== "all") {
    const now = new Date();
    
    filteredData = filteredData.filter(load => {
      // Always include out-of-range loads (they'll be dimmed/ghosted)
      if (load.id && outOfRangeLoadIds.has(load.id)) {
        return true;
      }
      
      const deliveryDate = load["DELIVERY DATE"];
      if (!deliveryDate) return false;
      
      try {
        const loadDate = new Date(deliveryDate);
        if (isNaN(loadDate.getTime())) return false;
        
        if (dateFilter === "week") {
          const { start: weekStart, end: weekEnd } = getDeliveryWeekRange(now, dateOffset);
          return loadDate >= weekStart && loadDate <= weekEnd;
        } else { // month
          // Get target month based on offset
          const targetDate = addMonths(now, dateOffset);
          return loadDate.getMonth() === targetDate.getMonth() && 
                 loadDate.getFullYear() === targetDate.getFullYear();
        }
      } catch {
        return false;
      }
    });
  }

  // Quick search across loads (driver, truck, trailer, load #, locations)
  const searchTerm = quickSearch.trim().toLowerCase();
  if (searchTerm) {
    filteredData = filteredData.filter(load => {
      const hay = [
        load["DRIVER NAME"],
        load["DRIVER PHONE"] ?? "",
        String(load["TRUCK #"] ?? ""),
        load["Trailer number"] ?? "",
        load["LOAD #"] ?? "",
        load["PICK UP CITY/STATE/ZIP"] ?? "",
        load["DELIVERY CITY/STATE/ZIP"] ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(searchTerm);
    });
  }

  // Status filter (multi-select). Uses the live driver status when available.
  if (selectedStatuses.size > 0) {
    filteredData = filteredData.filter(load => {
      const liveStatus = (driverStatuses[load.driver_id] ?? load.Status) as Load["Status"];
      return selectedStatuses.has(liveStatus);
    });
  }

  // Delivery-when chip (Today / Tomorrow) — narrows on top of any date filter.
  if (deliveryWhen !== "any") {
    filteredData = filteredData.filter(load => {
      const d = parseDate(load["DELIVERY DATE"] || "");
      if (!d) return false;
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      const target = deliveryWhen === "today" ? todayLocalMidnight : tomorrowLocalMidnight;
      return day.getTime() === target.getTime();
    });
  }

  // Get driver order based on earliest load creation time from original data (sorted by created_at from DB)
  const driverFirstAppearance = new Map<string, number>();
  data.forEach((load, index) => {
    if (!driverFirstAppearance.has(load.driver_id)) {
      driverFirstAppearance.set(load.driver_id, index);
    }
  });

  // Sort by driver creation order first (oldest drivers at top), then by PICK UP DATE within each driver
  const sortedData = [...filteredData].sort((a, b) => {
    if (a.driver_id !== b.driver_id) {
      const orderA = driverFirstAppearance.get(a.driver_id) ?? Infinity;
      const orderB = driverFirstAppearance.get(b.driver_id) ?? Infinity;
      return orderA - orderB;
    }
    
    // Sort loads within same driver by PICK UP DATE (chronological order)
    const dateA = a["PICK UP DATE"];
    const dateB = b["PICK UP DATE"];
    
    // Handle empty/null dates - push them to the end
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1; // Empty dates go to end
    if (!dateB) return -1;
    
    // Parse dates for proper chronological comparison
    const parsedA = new Date(dateA);
    const parsedB = new Date(dateB);
    
    // Handle invalid dates
    const validA = !isNaN(parsedA.getTime());
    const validB = !isNaN(parsedB.getTime());
    
    if (!validA && !validB) return 0;
    if (!validA) return 1;
    if (!validB) return -1;
    
    return parsedA.getTime() - parsedB.getTime();
  });

  // Group by driver_id for subtotals
  // For historical-only drivers (reassigned to another dispatcher), only show loads owned by current user
  const groupedByDriverBase = sortedData.reduce((acc, load) => {
    const driverId = load.driver_id;
    
    // Check if this is a historical-only driver (reassigned to someone else)
    const driver = allDrivers.find(d => d.driver_id === driverId);
    const isHistoricalDriver = driver?.isHistoricalOnly === true;
    
    // For historical drivers, only include loads owned by the current user
    // This prevents original dispatchers from seeing future loads created by the new dispatcher
    if (isHistoricalDriver && currentUserId && load.user_id !== currentUserId) {
      return acc; // Skip this load - it belongs to another dispatcher
    }
    
    if (!acc[driverId]) {
      acc[driverId] = [];
    }
    acc[driverId].push({ load });
    return acc;
  }, {} as Record<string, Array<{ load: Load }>>);

  // Merge empty drivers (drivers with no loads in current date range) into the grouped structure
  const groupedByDriver = { ...groupedByDriverBase };
  
  // Add empty drivers who aren't already in the grouped data
  allDrivers.forEach((driver) => {
    // Skip if this driver already has loads in the current view
    if (groupedByDriver[driver.driver_id]) return;
    
    // Apply same filters as loads:
    // 1. Filter by selected driver IDs (if any)
    if (selectedDriverIds.length > 0 && !selectedDriverIds.includes(driver.driver_id)) return;
    
    // 2. Filter by "My active drivers only" checkbox
    // Historical-only drivers should be hidden when this is checked
    if (showOnlyActiveDrivers && currentUserId) {
      const assignedDispatcherId = driverAssignments[driver.driver_id];
      // Hide if driver is assigned to someone else (including historical-only drivers)
      if (assignedDispatcherId && assignedDispatcherId !== currentUserId) return;
      // Also hide historical-only drivers when "My active drivers only" is checked
      if (driver.isHistoricalOnly) return;
    }
    
    // 3. When viewing as a specific dispatcher, only show their drivers
    if (viewingAsDispatcherId) {
      const assignedDispatcherId = driverAssignments[driver.driver_id];
      if (assignedDispatcherId !== viewingAsDispatcherId) return;
    }

    // 4. Quick search — match driver/truck/trailer
    if (searchTerm) {
      const hay = [
        driver.name,
        driver.phone ?? "",
        String(driver.truckNumber ?? ""),
        driver.trailerNumber ?? "",
      ].join(" ").toLowerCase();
      if (!hay.includes(searchTerm)) return;
    }

    // 5. Status filter — empty drivers only match if their live status is selected
    if (selectedStatuses.size > 0) {
      const s = driverStatuses[driver.driver_id];
      if (!s || !selectedStatuses.has(s)) return;
    }

    // 6. Delivery-when chip — empty drivers have no delivery date, so hide them
    if (deliveryWhen !== "any") return;

    // Add empty driver entry (empty array means no loads)
    groupedByDriver[driver.driver_id] = [];
  });

  // Ensure each driver's loads are sorted by pickup date (chronological order)
  Object.values(groupedByDriver).forEach(driverLoads => {
    if (driverLoads.length === 0) return; // Skip empty drivers
    driverLoads.sort((a, b) => {
      const dateA = a.load["PICK UP DATE"];
      const dateB = b.load["PICK UP DATE"];
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      const parsedA = new Date(dateA);
      const parsedB = new Date(dateB);
      if (isNaN(parsedA.getTime())) return 1;
      if (isNaN(parsedB.getTime())) return -1;
      return parsedA.getTime() - parsedB.getTime();
    });
  });

  // TWO-TIER DASHBOARD: Separate drivers into Zone A (with loads) and Zone B (without loads)
  // Zone A: Active Operations - drivers with loads in the current period
  // Zone B: Available Fleet - drivers without loads (rendered separately below)
  
  const activeDriverEntries = Object.entries(groupedByDriver)
    .filter(([_, loads]) => loads.length > 0);
  
  const emptyDriverEntries = Object.entries(groupedByDriver)
    .filter(([_, loads]) => loads.length === 0)
    .map(([driverId]) => {
      const driver = allDrivers.find(d => d.driver_id === driverId);
      if (!driver) return undefined;
      
      // Enrich with incoming driver data if available (sunset transfer scenario)
      // This provides the delivery location and date from their external loads
      const incomingInfo = incomingDrivers?.find(d => d.driverId === driverId);
      if (incomingInfo) {
        return {
          ...driver,
          // Override with external load's delivery info so new dispatcher can see it
          lastDeliveryLocation: incomingInfo.currentLocation || driver.lastDeliveryLocation,
          lastDeliveryDate: incomingInfo.estimatedAvailableDate || driver.lastDeliveryDate,
        };
      }
      
      return driver;
    })
    .filter((d): d is DriverEntry => d !== undefined);
  
  // Report available drivers count to parent
  useEffect(() => {
    onAvailableDriversCountChange?.(emptyDriverEntries.length);
  }, [emptyDriverEntries.length, onAvailableDriversCountChange]);
  
  // Stable driver order: sort purely by first-appearance (load creation) order.
  // We intentionally do NOT sort by status here — that caused rows to jump
  // around whenever a dispatcher changed a driver's status (e.g. In Transit
  // → Covered), breaking visual continuity for the user editing the row.
  let sortedGroupEntries = activeDriverEntries.sort(([driverIdA], [driverIdB]) => {
    const orderA = driverFirstAppearance.get(driverIdA) ?? Infinity;
    const orderB = driverFirstAppearance.get(driverIdB) ?? Infinity;
    return orderA - orderB;
  });

  // "Empty drivers only" chip: hide the active operations zone entirely.
  if (emptyDriversOnly) {
    sortedGroupEntries = [];
  }
  
  // Ref for scrolling to Available Fleet section
  const availableFleetRef = useRef<HTMLDivElement>(null);
  
  // Scroll to Available Fleet section
  const scrollToAvailableFleet = () => {
    availableFleetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const calculateDriverSubtotal = (loads: Array<{ load: Load }>) => {
    const totalRevenue = loads.reduce((sum, { load }) => {
      const amount = load["LOAD  $"] ?? 0;
      return sum + amount;
    }, 0);
    
    const totalDriverPay = loads.reduce((sum, { load }) => {
      const amount = load["DRIVER PAY "] ?? 0;
      return sum + amount;
    }, 0);
    
    // Calculate total miles as sum of (Trip + DH) for each load
    const totalMiles = loads.reduce((sum, { load }) => {
      const tripMiles = load["TRIP MILES"] ?? 0;
      const dhMiles = load["DH MILES"] ?? 0;
      return sum + tripMiles + dhMiles;
    }, 0);
    
    // Calculate RPM as total revenue / total miles
    const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    
    return { totalRevenue, totalDriverPay, totalMiles, avgRpm };
  };

  // Helper to get the best load for displaying driver info (prioritize complete truck/trailer data)
  const getBestDriverInfoLoad = (loads: Array<{ load: Load }>): Load => {
    // Try to find a load with complete truck and trailer information
    const completeLoad = loads.find(({ load }) => 
      load["TRUCK #"] && load["TRUCK #"] > 0 && load["Trailer number"] && load["Trailer number"].trim() !== ""
    );
    
    // If found, use it; otherwise use the first load
    return completeLoad ? completeLoad.load : loads[0].load;
  };


  const toggleDriverFilter = (driverId: string) => {
    const newIds = selectedDriverIds.includes(driverId) 
      ? selectedDriverIds.filter(id => id !== driverId)
      : [...selectedDriverIds, driverId];
    onSelectedDriverIdsChange(newIds);
  };

  const clearDriverFilters = () => {
    onSelectedDriverIdsChange([]);
  };

  const toggleDispatcherFilter = (dispatcherId: string) => {
    if (!onSelectedDispatcherIdsChange) return;
    const newIds = selectedDispatcherIds.includes(dispatcherId)
      ? selectedDispatcherIds.filter(id => id !== dispatcherId)
      : [...selectedDispatcherIds, dispatcherId];
    onSelectedDispatcherIdsChange(newIds);
  };

  const clearDispatcherFilters = () => {
    if (onSelectedDispatcherIdsChange) {
      onSelectedDispatcherIdsChange([]);
    }
  };

  // Helper to get dispatcher info for a load
  const getDispatcherForLoad = (loadId: string | undefined): DispatcherInfo | undefined => {
    if (!loadId) return undefined;
    return dispatcherData.find(d => d.load_id === loadId);
  };

  return (
    <>
      {/* Quick filters + date controls — single row */}
      <div className="mb-4 flex items-center gap-2 flex-wrap text-sm">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Search driver, truck #, load #…"
            className="h-8 sm:h-9 pl-8 w-[200px] sm:w-[260px] text-xs sm:text-sm"
          />
          {quickSearch && (
            <button
              type="button"
              onClick={() => setQuickSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button
          variant={emptyDriversOnly ? "default" : "outline"}
          size="sm"
          className="h-8 sm:h-9 text-xs sm:text-sm"
          onClick={() => setEmptyDriversOnly(v => !v)}
        >
          <UserX className="h-4 w-4 mr-1.5" />
          Empty drivers
        </Button>

        <div className="inline-flex rounded-md border border-input overflow-hidden">
          <Button
            variant={deliveryWhen === "today" ? "default" : "ghost"}
            size="sm"
            className="h-8 sm:h-9 rounded-none text-xs sm:text-sm px-2.5"
            onClick={() => setDeliveryWhen(deliveryWhen === "today" ? "any" : "today")}
          >
            <CalendarClock className="h-4 w-4 mr-1.5" />
            Today
          </Button>
          <Button
            variant={deliveryWhen === "tomorrow" ? "default" : "ghost"}
            size="sm"
            className="h-8 sm:h-9 rounded-none text-xs sm:text-sm px-2.5 border-l border-input"
            onClick={() => setDeliveryWhen(deliveryWhen === "tomorrow" ? "any" : "tomorrow")}
          >
            Tomorrow
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm">
              <Filter className="h-4 w-4 mr-1.5" />
              Status
              {selectedStatuses.size > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0">{selectedStatuses.size}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 bg-popover z-50" align="start">
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 border-b">
                <h4 className="font-medium text-sm">Filter by Status</h4>
                {selectedStatuses.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStatuses(new Set())}
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {STATUS_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-2 py-1.5">
                  <Checkbox
                    id={`status-${opt.value}`}
                    checked={selectedStatuses.has(opt.value)}
                    onCheckedChange={() => toggleStatus(opt.value)}
                  />
                  <label htmlFor={`status-${opt.value}`} className="text-sm cursor-pointer flex-1">
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {activeQuickFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearQuickFilters}
            className="h-8 sm:h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear filters
          </Button>
        )}
        {/* Date Filter */}
        <div className="flex items-center gap-1">
          <Select value={dateFilter} onValueChange={handleDateFilterChange}>
            <SelectTrigger className="w-[110px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50" side="bottom">
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="all">All Dates</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Date navigation controls */}
          {dateFilter !== "all" && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => onDateOffsetChange(dateOffset - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium bg-muted rounded-md min-w-[100px] sm:min-w-[140px] text-center">
                {getDateRangeLabel()}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => onDateOffsetChange(dateOffset + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              {dateOffset !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => onDateOffsetChange(0)}
                >
                  Today
                </Button>
              )}
            </>
          )}
        </div>

        {/* Driver Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm">
              <Filter className="h-4 w-4 mr-2" />
              Driver
              {(selectedDriverIds.length > 0 || showOnlyActiveDrivers) && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0">
                  {showOnlyActiveDrivers ? '✓' : selectedDriverIds.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-popover z-50" align="start">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b">
                <h4 className="font-medium text-sm">Filter Drivers</h4>
                {selectedDriverIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearDriverFilters}
                    className="h-6 px-2 text-xs"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
              
              {/* My Active Drivers Only Toggle */}
              {(() => {
                // Calculate hidden reassigned drivers count
                const reassignedDriversCount = currentUserId ? uniqueDrivers.filter(driver => {
                  const assignedId = driverAssignments[driver.driver_id];
                  return assignedId && assignedId !== currentUserId;
                }).length : 0;
                
                return (
                  <div className="flex items-center gap-2 py-2 px-2 rounded-md bg-primary/5 border border-primary/20">
                    <Checkbox
                      id="active-drivers-only"
                      checked={showOnlyActiveDrivers}
                      onCheckedChange={(checked) => setShowOnlyActiveDrivers(checked === true)}
                    />
                    <label 
                      htmlFor="active-drivers-only" 
                      className="text-sm font-medium cursor-pointer select-none flex-1"
                    >
                      My Active Drivers Only
                      {showOnlyActiveDrivers && reassignedDriversCount > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({reassignedDriversCount} hidden)
                        </span>
                      )}
                    </label>
                  </div>
                );
              })()}
              
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground mb-2">Or select specific drivers:</p>
                <div className="max-h-[250px] overflow-y-auto space-y-1">
                  {uniqueDrivers.map((driver) => {
                    // When viewing as a dispatcher, use their ID for reassignment checks
                    const effectiveUserIdForFilter = viewingAsDispatcherId || currentUserId;
                    const isReassignedDriver = effectiveUserIdForFilter && driverAssignments[driver.driver_id] && driverAssignments[driver.driver_id] !== effectiveUserIdForFilter;
                    return (
                      <div key={driver.driver_id} className={`flex items-center space-x-2 py-1 ${isReassignedDriver ? 'opacity-60' : ''}`}>
                        <Checkbox
                          id={`driver-${driver.driver_id}`}
                          checked={selectedDriverIds.includes(driver.driver_id)}
                          onCheckedChange={() => toggleDriverFilter(driver.driver_id)}
                        />
                        <label
                          htmlFor={`driver-${driver.driver_id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="text-sm font-medium leading-tight flex items-center gap-1.5">
                            {driver.name}
                            {isReassignedDriver && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                Reassigned
                              </span>
                            )}
                          </div>
                          {driver.phone && (
                            <div className="text-xs text-muted-foreground">
                              {driver.phone}
                            </div>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>


        {/* View as Dispatcher - Admin Only */}
        {isAdmin && onViewingAsDispatcherChange && (
          <Select
            value={viewingAsDispatcherId || "my-loads"}
            onValueChange={(value) => onViewingAsDispatcherChange(value === "my-loads" ? null : value)}
          >
            <SelectTrigger className="w-auto h-9 gap-2">
              <Eye className="h-4 w-4" />
              <SelectValue placeholder="View as..." />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="my-loads">My Loads</SelectItem>
              {dispatchers.map((dispatcher) => (
                <SelectItem key={dispatcher.id} value={dispatcher.id}>
                  {dispatcher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Active filters display */}
        {selectedDriverIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedDriverIds.map((driverId) => {
              const driver = uniqueDrivers.find(d => d.driver_id === driverId);
              return (
                <Badge key={driverId} variant="secondary" className="gap-1">
                  {driver?.name || 'Unknown Driver'}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => toggleDriverFilter(driverId)}
                  />
                </Badge>
              );
            })}
          </div>
        )}
        {/* Bulk Expand/Collapse Toggle */}
        {isCollapsibleEnabled && onToggleAllDrivers && (
          <div className="ml-auto">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={onToggleAllDrivers}
              title={allDriversExpanded ? "Collapse All" : "Expand All"}
            >
              {allDriversExpanded ? (
                <ChevronsDownUp className="h-4 w-4" />
              ) : (
                <ChevronsUpDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {/* 3-dot table options menu */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className={cn("h-9 w-9 relative", !isCollapsibleEnabled && "ml-auto")}>
              <MoreVertical className="h-4 w-4" />
              {hiddenColumns.size > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {hiddenColumns.size}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 bg-popover z-50 p-0" align="end">
            {/* Column Visibility Section */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-sm font-medium">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Columns
                  {hiddenColumns.size > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {hiddenColumns.size} hidden
                    </Badge>
                  )}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-1 border-b">
                  <div className="flex items-center space-x-2 py-1 opacity-50">
                    <Checkbox checked={true} disabled />
                    <label className="text-sm">Driver Info</label>
                  </div>
                  {COLUMN_DEFS.map(col => (
                    <div key={col.key} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={isColVisible(col.key)}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                      />
                      <label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer select-none">
                        {col.label}
                      </label>
                    </div>
                  ))}
                  {hiddenColumns.size > 0 && (
                    <button
                      onClick={resetColumnVisibility}
                      className="text-xs text-primary hover:underline pt-2 w-full text-left"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Future menu items can be added here as additional sections */}
          </PopoverContent>
        </Popover>
      </div>
      {/* Viewing as Dispatcher indicator */}
      {viewingAsDispatcherId && (
        <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">
              Viewing as {dispatchers.find(d => d.id === viewingAsDispatcherId)?.name || 'Dispatcher'} 
              <span className="text-xs ml-1 opacity-75">({dispatchers.find(d => d.id === viewingAsDispatcherId)?.email})</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
            onClick={() => onViewingAsDispatcherChange?.(null)}
          >
            <X className="h-3 w-3 mr-1" />
            Exit
          </Button>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              To delete this load, please enter the driver name <strong>{loadToDelete?.driverName}</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="Enter driver name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmName("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="rounded-lg border-2 border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-primary/20 hover:bg-primary/20 border-b-2 border-primary/30">
              {isCollapsibleEnabled && <TableHead className="w-10"></TableHead>}
              <TableHead className="min-w-[180px]">Driver Info</TableHead>
              {isColVisible('pickup') && <TableHead className="min-w-[115px]">PICK UP</TableHead>}
              {isColVisible('delivery') && <TableHead className="min-w-[115px]">DELIVERY</TableHead>}
              {isColVisible('mileage') && <TableHead className="min-w-[90px]">Mileage</TableHead>}
              {isColVisible('pay') && <TableHead className="min-w-[100px]">Pay</TableHead>}
              {isColVisible('loadNumber') && <TableHead className="min-w-[60px]">Load #</TableHead>}
              {isColVisible('tarp') && <TableHead className="min-w-[40px] text-center">Tarp</TableHead>}
              {isColVisible('verified') && <TableHead className="min-w-[45px] text-center">Ver.</TableHead>}
              {isColVisible('notes') && <TableHead className="min-w-[100px]">Notes</TableHead>}
              {isColVisible('condition') && <TableHead className="min-w-[90px]">Condition</TableHead>}
              {isColVisible('payStatus') && <TableHead className="min-w-[90px]">Pay Status</TableHead>}
              {isColVisible('accounting') && <TableHead className="min-w-[100px]">Accounting</TableHead>}
              {isAdmin && isColVisible('dispatcher') && <TableHead className="min-w-[80px]">Dispatcher</TableHead>}
              <TableHead className="min-w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGroupEntries.map(([driverId, driverLoads]) => {
              // Zone A only contains drivers with loads - empty drivers are in Zone B
              
              const { totalRevenue, totalDriverPay, totalMiles, avgRpm } = calculateDriverSubtotal(driverLoads);
              const firstLoad = getBestDriverInfoLoad(driverLoads);
              
              // Calculate date warnings for this driver's loads
              const dateWarnings = driverLoads.reduce((count, { load }, idx) => {
                const pickUpRaw = load["PICK UP DATE"] ? parse(load["PICK UP DATE"], "MM/dd/yy", new Date()) : null;
                const deliveryRaw = load["DELIVERY DATE"] ? parse(load["DELIVERY DATE"], "MM/dd/yy", new Date()) : null;
                
                // Normalize to start of day for date-only comparison
                const pickUp = pickUpRaw && !isNaN(pickUpRaw.getTime()) ? startOfDay(pickUpRaw) : null;
                const delivery = deliveryRaw && !isNaN(deliveryRaw.getTime()) ? startOfDay(deliveryRaw) : null;
                
                // Same-load warning: delivery before pickup
                if (pickUp && delivery && delivery < pickUp) {
                  count++;
                }
                
                // Cross-load: current pickup before previous delivery
                if (idx > 0) {
                  const prevLoad = driverLoads[idx - 1].load;
                  const prevDeliveryRaw = prevLoad["DELIVERY DATE"] ? parse(prevLoad["DELIVERY DATE"], "MM/dd/yy", new Date()) : null;
                  const prevDelivery = prevDeliveryRaw && !isNaN(prevDeliveryRaw.getTime()) ? startOfDay(prevDeliveryRaw) : null;
                  if (prevDelivery && pickUp && pickUp < prevDelivery) {
                    count++;
                  }
                }
                
                return count;
              }, 0);
              
              // Check if driver is reassigned to a different dispatcher
              // When viewing as a dispatcher, use their ID for reassignment checks
              const assignedDispatcherId = driverAssignments[driverId];
              const effectiveUserId = viewingAsDispatcherId || currentUserId;
              // Check if this is a historical-only driver (driver was reassigned but user has historical loads)
              const driverEntry = allDrivers.find(d => d.driver_id === driverId);
              const isHistoricalOnly = driverEntry?.isHistoricalOnly === true;
              // Mark as reassigned if: assigned to someone else OR it's a historical-only driver
              const isReassigned = isHistoricalOnly || !!(effectiveUserId && assignedDispatcherId && assignedDispatcherId !== effectiveUserId);
              
              // Check if this driver is collapsed (only when collapsible mode is enabled)
              const isCollapsed = isCollapsibleEnabled && expandedDriverIds && !expandedDriverIds.has(driverId);
              
              // Get the last load's delivery location for display
              const lastDeliveryLocation = driverLoads[driverLoads.length - 1]?.load["DELIVERY CITY/STATE/ZIP"];
              
              // Handle toggle click
              const handleToggleClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onToggleDriverExpanded) {
                  onToggleDriverExpanded(driverId);
                }
              };
              
              // If collapsed, render a summary row showing LAST LOAD info
              if (isCollapsed) {
                // Get the last load for display (most recent load info)
                const lastLoad = driverLoads[driverLoads.length - 1]?.load;
                const pickupLocation = lastLoad?.["PICK UP CITY/STATE/ZIP"] || '-';
                const deliveryLocation = lastLoad?.["DELIVERY CITY/STATE/ZIP"] || '-';
                const lastLoadMiles = lastLoad?.["TOTAL MILES"] || 0;
                const lastLoadRevenue = lastLoad?.["LOAD  $"] || 0;
                const lastLoadNumber = lastLoad?.["LOAD #"] || '-';
                const lastLoadTarp = lastLoad?.["TARP STATUS"] || 'Untarped';
                const lastLoadVerified = lastLoad?.VERIFIED || false;
                const lastLoadNotes = lastLoad?.["ACCOUNTING NOTES"] || '-';
                const lastLoadCondition = lastLoad?.INVOICED || 'Not Invoiced';
                
                return (
                  <TableRow 
                    key={driverId}
                    className="h-12 cursor-pointer hover:bg-muted/50 border-b border-border"
                    onClick={handleToggleClick}
                  >
                    {/* Toggle Column */}
                    <TableCell className="w-10 p-2">
                      <button
                        onClick={handleToggleClick}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        aria-expanded={false}
                        aria-label="Expand driver details"
                      >
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                    </TableCell>
                    
                    {/* Driver Info - Name + Contract Type + Load Count + Status */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate max-w-[100px]">{firstLoad["DRIVER NAME"]}</span>
                        <ContractTypeBadge type={firstLoad["CONTRACT TYPE"]} />
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {driverLoads.length} load{driverLoads.length !== 1 ? 's' : ''}
                        </Badge>
                        <StatusBadge status={driverStatuses[driverId] || "Searching_for_load"} />
                      </div>
                    </TableCell>
                    
                    {/* PICK UP - Last load pickup location */}
                    {isColVisible('pickup') && (
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[115px]">
                      {pickupLocation}
                    </TableCell>
                    )}
                    
                    {/* DELIVERY - Last load delivery location + extra stops badge */}
                    {isColVisible('delivery') && (
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[115px]">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{deliveryLocation}</span>
                        {(lastLoad?.["EXTRA STOPS"] ?? 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                            +{lastLoad?.["EXTRA STOPS"]}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    )}
                    
                    {/* Mileage - Last load miles */}
                    {isColVisible('mileage') && (
                    <TableCell className="text-sm">
                      {lastLoadMiles.toLocaleString()} mi
                    </TableCell>
                    )}
                    
                    {/* Financial - Last load revenue */}
                    {isColVisible('pay') && (
                    <TableCell className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      ${lastLoadRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    )}
                    
                    {/* Load # - Last load number */}
                    {isColVisible('loadNumber') && (
                    <TableCell className="text-sm text-muted-foreground">
                      {lastLoadNumber}
                    </TableCell>
                    )}
                    
                    {/* Tarp - Last load tarp status */}
                    {isColVisible('tarp') && (
                    <TableCell className="text-center">
                      <Badge variant={lastLoadTarp === 'Tarped' ? 'default' : 'secondary'} className="text-[10px]">
                        {lastLoadTarp === 'Tarped' ? 'T' : 'U'}
                      </Badge>
                    </TableCell>
                    )}
                    
                    {/* Verified - Last load verified status */}
                    {isColVisible('verified') && (
                    <TableCell className="text-center">
                      {lastLoadVerified ? '✓' : '-'}
                    </TableCell>
                    )}
                    
                    {/* Notes - Last load notes (truncated) */}
                    {isColVisible('notes') && (
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[80px]">
                      {lastLoadNotes !== '-' ? lastLoadNotes : '-'}
                    </TableCell>
                    )}
                    
                    {/* Condition - Last load invoiced status */}
                    {isColVisible('condition') && (
                    <TableCell>
                      <InvoicedBadge status={lastLoadCondition as "Missing BOL" | "Invoiced" | "Not Invoiced"} />
                    </TableCell>
                    )}
                    
                    {/* Pay Status - Last load pay status */}
                    {isColVisible('payStatus') && (
                    <TableCell>
                      <PayStatusBadge
                        status={lastLoad?.["PAY STATUS"] || "Unpaid"}
                        paidAt={lastLoad?.["PAID AT"] || null}
                        onTogglePaid={() => {}}
                        onUpdatePaidAt={() => {}}
                        disabled={true}
                      />
                    </TableCell>
                    )}
                    
                    {/* Accounting - Last load accounting notes */}
                    {isColVisible('accounting') && (
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[80px]">
                      {lastLoad?.["ADMIN ACCOUNTING NOTES"] || '-'}
                    </TableCell>
                    )}
                    
                    {isAdmin && isColVisible('dispatcher') && <TableCell className="text-muted-foreground">-</TableCell>}
                    {/* Actions: Ghost quick-add button */}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          const lastDelivery = lastLoad?.["DELIVERY CITY/STATE/ZIP"] || null;
                          const lastDeliveryDateRaw = lastLoad?.["DELIVERY DATE"] || null;
                          // Calculate next pickup date (day after last delivery)
                          let nextPickupDate: string | undefined;
                          if (lastDeliveryDateRaw) {
                            try {
                              const parsed = parseDate(lastDeliveryDateRaw);
                              if (parsed && !isNaN(parsed.getTime())) {
                                const nextDay = new Date(parsed);
                                nextDay.setDate(nextDay.getDate() + 1);
                                const mm = String(nextDay.getMonth() + 1).padStart(2, "0");
                                const dd = String(nextDay.getDate()).padStart(2, "0");
                                const yy = String(nextDay.getFullYear()).slice(-2);
                                nextPickupDate = `${mm}/${dd}/${yy}`;
                              }
                            } catch {
                              // Fall back to no pre-fill
                            }
                          }
                          if (onAddLoadForDriverWithContext) {
                            onAddLoadForDriverWithContext(driverId, lastDelivery || undefined, nextPickupDate);
                          } else if (onAddLoadForDriver) {
                            onAddLoadForDriver(driverId);
                          }
                        }}
                        className="h-8 w-8 border border-border hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/50 dark:hover:border-blue-600"
                        title="Add next load for this driver"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }
              
              return (
                <React.Fragment key={driverId}>
                  {/* Load Rows - driver info spans all rows */}
                  {driverLoads.map(({ load }, loadIndex) => {
                    // External load detection: load owned by another dispatcher (visible via new RLS policy)
                    // These should be read-only for the current dispatcher
                    const isExternalLoad = !isAdmin && currentUserId && load.user_id !== currentUserId;
                    
                    // Get owner info for external loads
                    const externalOwnerInfo = isExternalLoad 
                      ? dispatcherData.find(d => d.load_id === load.id)
                      : null;
                    const externalOwnerName = externalOwnerInfo?.dispatcher_name || 'another dispatcher';
                    
                    // Disable editing for archived loads, reassigned drivers, OR external loads
                    // Admins can always edit, even when viewing as a dispatcher
                    const isDisabled = load.isArchived || (!isAdmin && (isReassigned || isExternalLoad));
                    
                    // Check if this load is out of range (ghosted)
                    const isOutOfRange = load.id ? outOfRangeLoadIds.has(load.id) : false;
                    
                    // Check for date warnings on this load
                    const pickUpRaw = load["PICK UP DATE"] ? parse(load["PICK UP DATE"], "MM/dd/yy", new Date()) : null;
                    const deliveryRaw = load["DELIVERY DATE"] ? parse(load["DELIVERY DATE"], "MM/dd/yy", new Date()) : null;
                    const pickUp = pickUpRaw && !isNaN(pickUpRaw.getTime()) ? startOfDay(pickUpRaw) : null;
                    const delivery = deliveryRaw && !isNaN(deliveryRaw.getTime()) ? startOfDay(deliveryRaw) : null;
                    
                    // Same-load warning: delivery before pickup OR pickup after delivery
                    const hasSameLoadWarning = pickUp && delivery && pickUp > delivery;
                    
                    // Cross-load warning: current pickup before previous delivery
                    const prevLoad = loadIndex > 0 ? driverLoads[loadIndex - 1].load : null;
                    const prevDeliveryRaw = prevLoad?.["DELIVERY DATE"] ? parse(prevLoad["DELIVERY DATE"], "MM/dd/yy", new Date()) : null;
                    const prevDelivery = prevDeliveryRaw && !isNaN(prevDeliveryRaw.getTime()) ? startOfDay(prevDeliveryRaw) : null;
                    const hasCrossLoadWarning = prevDelivery && pickUp && pickUp < prevDelivery;
                    
                    const hasDateWarning = hasSameLoadWarning || hasCrossLoadWarning;
                    
                    // Build row className with out-of-range (ghosted) styling
                    const getRowClassName = () => {
                      let base = 'hover:bg-accent/20 transition-colors border-b-4 border-solid border-border';
                      
                      // External loads get subtle muted styling
                      if (isExternalLoad) {
                        base += ' opacity-70 bg-slate-50/50 dark:bg-slate-900/30';
                      } else if (isOutOfRange) {
                        // Out-of-range loads get dimmed
                        base += ' opacity-50 bg-blue-50/30 dark:bg-blue-950/20';
                      } else if (hasDateWarning) {
                        base += ' bg-warning-bg dark:bg-warning-bg-dark';
                      } else if (load.isArchived) {
                        base += ' opacity-50 bg-muted/30';
                      } else if (isReassigned) {
                        base += ' bg-amber-50/30 dark:bg-amber-950/10';
                      } else if (loadIndex % 2 === 1) {
                        base += ' bg-muted/50';
                      } else {
                        base += ' bg-background';
                      }
                      
                      if (loadIndex === 0) base += ' border-t-2 border-primary/40';
                      if (highlightedLoadId === load.id) base += ' animate-highlight';
                      
                      return base;
                    };
                    
                    return (
                    <TableRow 
                      key={load.id || `${driverId}-${loadIndex}`}
                      ref={(el) => {
                        if (load.id) {
                          rowRefs.current[load.id] = el;
                        }
                      }}
                      className={getRowClassName()}
                    >
                      {/* Toggle column - only show on first row when collapsible mode is enabled */}
                      {isCollapsibleEnabled && loadIndex === 0 && (
                        <TableCell 
                          rowSpan={driverLoads.length} 
                          className="w-10 p-2 align-top"
                        >
                          <button
                            onClick={handleToggleClick}
                            className="p-1 hover:bg-accent rounded transition-colors"
                            aria-expanded={true}
                            aria-label="Collapse driver details"
                          >
                            <ChevronDown className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </button>
                        </TableCell>
                      )}
                      
                      {/* Driver info column - only show on first row, spans all loads */}
                      {loadIndex === 0 && (() => {
                        
                        return (
                        <TableCell 
                          rowSpan={driverLoads.length} 
                          className={`align-top p-2 border-r border-border w-fit ${isReassigned ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'bg-muted/30'}`}
                        >
                          <div className="space-y-1.5">
                            {/* Reassigned indicator with new dispatcher name */}
                            {isReassigned && (() => {
                              const newDispatcher = dispatchers.find(d => d.id === assignedDispatcherId);
                              const newDispatcherName = newDispatcher?.name || newDispatcher?.email?.split('@')[0] || 'Unknown';
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex flex-col gap-0.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium mb-1">
                                        <div className="flex items-center gap-1.5">
                                          <UserMinus className="h-3.5 w-3.5" />
                                          <span>Reassigned</span>
                                        </div>
                                        <div className="text-[10px] opacity-80">
                                          Now with: {newDispatcherName}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>This driver has been reassigned to {newDispatcherName}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                            {/* Driver Info Card */}
                            <DriverInfoCard
                              driverName={firstLoad["DRIVER NAME"]}
                              driverPhone={firstLoad["DRIVER PHONE"]}
                              contractType={firstLoad["CONTRACT TYPE"]}
                              truckNumber={firstLoad["TRUCK #"]}
                              trailerNumber={firstLoad["Trailer number"]}
                              trailerType={firstLoad["TRAILER TYPE"]}
                              status={driverStatuses[driverId] || "Searching_for_load"}
                              lastDeliveryLocation={driverLoads[driverLoads.length - 1]?.load["DELIVERY CITY/STATE/ZIP"] || null}
                              loadCount={driverLoads.length}
                              totalMiles={totalMiles}
                              totalRevenue={totalRevenue}
                              totalDriverPay={totalDriverPay}
                              avgRpm={avgRpm}
                              dateWarnings={dateWarnings}
                              fuelEnabled={driverFuelStatus[driverId] ?? true}
                              onUpdateName={(value) => {
                                driverLoads.forEach(({ load }) => 
                                  onUpdateCell(load.id!, "DRIVER NAME", value)
                                );
                              }}
                              onUpdatePhone={(value) => {
                                driverLoads.forEach(({ load }) => 
                                  onUpdateCell(load.id!, "DRIVER PHONE", value)
                                );
                              }}
                              onUpdateContractType={(value) => {
                                driverLoads.forEach(({ load }) => 
                                  onUpdateCell(load.id!, "CONTRACT TYPE", value)
                                );
                              }}
                              onUpdateTruck={(value) => {
                                driverLoads.forEach(({ load }) => 
                                  onUpdateCell(load.id!, "TRUCK #", value)
                                );
                              }}
                              onUpdateTrailer={(value) => {
                                driverLoads.forEach(({ load }) => 
                                  onUpdateCell(load.id!, "Trailer number", value)
                                );
                              }}
                              onUpdateTrailerType={(value) => {
                                driverLoads.forEach(({ load }) => 
                                  onUpdateCell(load.id!, "TRAILER TYPE", value)
                                );
                              }}
                              onUpdateStatus={(value) => onUpdateDriverStatus(driverId, value)}
                              disabled={isReassigned || firstLoad.isArchived}
                              isAdmin={isAdmin}
                              onAddNextLeg={() => {
                                const lastLoad = driverLoads[driverLoads.length - 1]?.load;
                                const lastDelivery = lastLoad?.["DELIVERY CITY/STATE/ZIP"] || undefined;
                                const lastDeliveryDateRaw = lastLoad?.["DELIVERY DATE"] || null;
                                // Calculate next pickup date (day after last delivery)
                                let nextPickupDate: string | undefined;
                                if (lastDeliveryDateRaw) {
                                  try {
                                    const parsed = parseDate(lastDeliveryDateRaw);
                                    if (parsed && !isNaN(parsed.getTime())) {
                                      const nextDay = new Date(parsed);
                                      nextDay.setDate(nextDay.getDate() + 1);
                                      const mm = String(nextDay.getMonth() + 1).padStart(2, "0");
                                      const dd = String(nextDay.getDate()).padStart(2, "0");
                                      const yy = String(nextDay.getFullYear()).slice(-2);
                                      nextPickupDate = `${mm}/${dd}/${yy}`;
                                    }
                                  } catch {
                                    // Fall back to no pre-fill
                                  }
                                }
                                if (onAddLoadForDriverWithContext) {
                                  onAddLoadForDriverWithContext(driverId, lastDelivery, nextPickupDate);
                                } else if (onAddLoadForDriver) {
                                  onAddLoadForDriver(driverId);
                                }
                              }}
                            />
                          </div>
                        </TableCell>
                        );
                      })()}
                      
                      {/* PICK UP Column - Location + Date stacked */}
                      {isColVisible('pickup') && (
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <LocationCell
                            value={load["PICK UP CITY/STATE/ZIP"]}
                            onSave={(value) => onUpdateCell(load.id!, "PICK UP CITY/STATE/ZIP", value)}
                            disabled={isDisabled}
                          />
                          <div className="border-t border-border/30 pt-1">
                            {(() => {
                              // Rule: load_(t-1).Delivery <= load_(t).Pickup (same-day OK)
                              const prevLoad = loadIndex > 0 ? driverLoads[loadIndex - 1].load : null;

                              const prevDeliveryRaw = prevLoad?.["DELIVERY DATE"]
                                ? parse(prevLoad["DELIVERY DATE"], "MM/dd/yy", new Date())
                                : null;
                              const currentPickupRaw = load["PICK UP DATE"]
                                ? parse(load["PICK UP DATE"], "MM/dd/yy", new Date())
                                : null;
                              const currentDeliveryRaw = load["DELIVERY DATE"]
                                ? parse(load["DELIVERY DATE"], "MM/dd/yy", new Date())
                                : null;

                              const prevDelivery =
                                prevDeliveryRaw && !isNaN(prevDeliveryRaw.getTime()) ? startOfDay(prevDeliveryRaw) : null;
                              const currentPickup =
                                currentPickupRaw && !isNaN(currentPickupRaw.getTime()) ? startOfDay(currentPickupRaw) : null;
                              const currentDelivery =
                                currentDeliveryRaw && !isNaN(currentDeliveryRaw.getTime()) ? startOfDay(currentDeliveryRaw) : null;

                              // Cross-load warning: pickup before previous delivery
                              const hasSequenceWarning =
                                prevDelivery && currentPickup && currentPickup < prevDelivery;

                              // Same-load warning: pickup after delivery
                              const hasSameLoadWarning =
                                currentPickup && currentDelivery && currentPickup > currentDelivery;

                              return (
                                <DatePickerCell
                                  value={load["PICK UP DATE"]}
                                  onSave={(value) => handlePickupDateChange(load.id!, value)}
                                  disabled={isDisabled}
                                  variant="pickup"
                                  hasWarning={hasSequenceWarning || hasSameLoadWarning}
                                  isOutOfRange={isOutOfRange}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </TableCell>
                      )}
                      {/* DELIVERY Column - Location + Extra Stops Badge + Date stacked */}
                      {isColVisible('delivery') && (
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <LocationCell
                              value={load["DELIVERY CITY/STATE/ZIP"]}
                              onSave={(value) => onUpdateCell(load.id!, "DELIVERY CITY/STATE/ZIP", value)}
                              disabled={isDisabled}
                            />
                            {(load["EXTRA STOPS"] ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                                +{load["EXTRA STOPS"]}
                              </Badge>
                            )}
                          </div>
                          <div className="border-t border-border/30 pt-1">
                            {(() => {
                              const pickUpRaw = parseDate(load["PICK UP DATE"]);
                              const deliveryRaw = parseDate(load["DELIVERY DATE"]);
                              
                              // Normalize to start of day for date-only comparison
                              const pickUp = pickUpRaw ? startOfDay(pickUpRaw) : null;
                              const delivery = deliveryRaw ? startOfDay(deliveryRaw) : null;
                              
                              // Same-load warning: delivery < pickup (can't deliver before picking up)
                              const hasWarning = pickUp && delivery && delivery < pickUp;
                              
                              const noPickupDate = !load["PICK UP DATE"];
                              
                              return (
                                <DatePickerCell
                                  value={load["DELIVERY DATE"]}
                                  onSave={(value) => handleDeliveryDateChange(load.id!, value)}
                                  disabled={isDisabled || noPickupDate}
                                  disabledMessage={noPickupDate ? "Enter pickup first" : undefined}
                                  variant="delivery"
                                  hasWarning={hasWarning}
                                  minDate={pickUp || undefined}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </TableCell>
                      )}
                      {isColVisible('mileage') && (
                      <TableCell>
                        <MileageCell
                          loadId={load.id ?? undefined}
                          pickupLocation={load["PICK UP CITY/STATE/ZIP"]}
                          deliveryLocation={load["DELIVERY CITY/STATE/ZIP"]}
                          previousDeliveryLocation={loadIndex > 0 ? driverLoads[loadIndex - 1].load["DELIVERY CITY/STATE/ZIP"] : null}
                          tripMiles={load["TRIP MILES"]}
                          dhMiles={load["DH MILES"]}
                          onTripMilesChange={(value) => onUpdateCell(load.id!, "TRIP MILES", value)}
                          onDhMilesChange={(value) => onUpdateCell(load.id!, "DH MILES", value)}
                          disabled={isDisabled}
                        />
                      </TableCell>
                      )}
                      {isColVisible('pay') && (
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1 min-h-[20px]">
                            <span className="text-muted-foreground">Rate:</span>
                            <span className="font-semibold text-revenue">
                              <EditableCell
                                value={load["LOAD  $"]}
                                onSave={(value) => handleRateChange(load.id!, value)}
                                type="currency"
                                disabled={isDisabled}
                              />
                            </span>
                          </div>
                          <div className="flex items-center gap-1 min-h-[20px]">
                            <span className="text-muted-foreground">Driver:</span>
                            <span className={`font-semibold ${
                              (() => {
                                const driverPay = Number(load["DRIVER PAY "] ?? 0);
                                const loadPay = Number(load["LOAD  $"] ?? 0);
                                if (Math.abs(driverPay - loadPay) < 0.01) return 'text-revenue';
                                if (driverPay > loadPay) return 'text-red-500';
                                return 'text-orange-500';
                              })()
                            }`}>
                              <EditableCell
                                value={load["DRIVER PAY "]}
                                onSave={(value) => handleDriverPayChange(load.id!, value)}
                                type="currency"
                                disabled={isDisabled}
                              />
                            </span>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 min-h-[20px] cursor-help">
                                  <span className="text-muted-foreground">RPM:</span>
                                  <span className="text-foreground">
                                    {load.RPM != null ? `$${load.RPM.toFixed(2)}` : '-'}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Rate Per Mile = Load $ ÷ (Trip Miles + DH Miles)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                      )}
                      {isColVisible('loadNumber') && (
                      <TableCell>
                        <EditableCell
                          value={load["LOAD #"]}
                          onSave={(value) => handleLoadNumberChange(load.id!, value)}
                          disabled={isDisabled}
                        />
                      </TableCell>
                      )}
                      {isColVisible('tarp') && (
                      <TableCell className="text-center">
                        <Checkbox
                          checked={load["TARP STATUS"] === "Tarped"}
                          onCheckedChange={(checked) => 
                            onUpdateCell(load.id!, "TARP STATUS", checked ? "Tarped" : "Untarped")
                          }
                          disabled={isDisabled}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </TableCell>
                      )}
                      {isColVisible('verified') && (
                      <TableCell className="text-center">
                        <Checkbox
                          checked={load.VERIFIED === true}
                          onCheckedChange={(checked) => 
                            onUpdateCell(load.id!, "VERIFIED", checked === true)
                          }
                          disabled={isDisabled}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </TableCell>
                      )}
                      {isColVisible('notes') && (
                      <TableCell className="max-w-[160px] overflow-hidden">
                        <TruncatedNotesCell
                          value={load["ACCOUNTING NOTES"]}
                          onSave={(value) => onUpdateCell(load.id!, "ACCOUNTING NOTES", value)}
                          disabled={isDisabled}
                        />
                      </TableCell>
                      )}
                      {isColVisible('condition') && (
                      <TableCell className="pl-0">
                        <Select
                          value={load.INVOICED}
                          onValueChange={(value) => handleConditionChange(load.id!, value as "Missing BOL" | "Invoiced" | "Not Invoiced")}
                          disabled={isDisabled || !isAdmin}
                        >
                          <SelectTrigger className={`h-9 border-none bg-transparent shadow-none p-0 w-fit ${(isDisabled || !isAdmin) ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent/5'}`}>
                            <InvoicedBadge status={load.INVOICED} />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {dropdownConfig.invoiced.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <InvoicedBadge status={option.value as "Missing BOL" | "Invoiced" | "Not Invoiced"} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      )}
                      {/* Pay Status */}
                      {isColVisible('payStatus') && (
                      <TableCell>
                        <PayStatusBadge
                          status={load["PAY STATUS"]}
                          paidAt={load["PAID AT"]}
                          onTogglePaid={() => {
                            if (load["PAY STATUS"] === "Paid") {
                              onUpdateCell(load.id!, "PAY STATUS", "Unpaid");
                              onUpdateCell(load.id!, "PAID AT", null);
                            } else {
                              onUpdateCell(load.id!, "PAY STATUS", "Paid");
                              onUpdateCell(load.id!, "PAID AT", new Date().toISOString());
                            }
                          }}
                          onUpdatePaidAt={(dateTime) => {
                            onUpdateCell(load.id!, "PAID AT", dateTime);
                          }}
                          disabled={isDisabled || !isAdmin}
                        />
                      </TableCell>
                      )}
                      {/* Accounting Notes (Admin only) */}
                      {isColVisible('accounting') && (
                      <TableCell className="max-w-[160px] overflow-hidden">
                        <TruncatedNotesCell
                          value={load["ADMIN ACCOUNTING NOTES"]}
                          onSave={(value) => onUpdateCell(load.id!, "ADMIN ACCOUNTING NOTES", value)}
                          disabled={isDisabled || !isAdmin}
                        />
                      </TableCell>
                      )}
                      {/* Dispatcher column (Admin only) */}
                      {isAdmin && isColVisible('dispatcher') && (
                        <TableCell className="text-xs">
                          {(() => {
                            const dispatcherInfo = getDispatcherForLoad(load.id);
                            return dispatcherInfo ? (
                              <span className="text-muted-foreground">
                                {dispatcherInfo.dispatcher_name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">-</span>
                            );
                          })()}
                        </TableCell>
                      )}
                      <TableCell>
                        {/* Hide delete button for external loads - show owner badge instead */}
                        {isExternalLoad ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs">
                                  <ArrowLeftFromLine className="h-3 w-3" />
                                  <span className="truncate max-w-[50px]">{externalOwnerName}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This load is managed by {externalOwnerName}.<br/>You can view it while the driver finishes their handoff.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(load.id!, load["DRIVER NAME"])}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={isDisabled}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  
                  {/* Separator line between drivers */}
                  <TableRow className="h-2 bg-primary/30 hover:bg-primary/30">
                    <TableCell colSpan={visibleColCount} className="p-0 border-y-2 border-primary/50"></TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
    
    {/* Zone B: Available Fleet Table */}
    <AvailableFleetTable
      emptyDrivers={emptyDriverEntries}
      onAddLoadForDriver={onAddLoadForDriver}
      isAdmin={isAdmin}
      driverAssignments={driverAssignments}
      dispatchers={dispatchers}
      fleetRef={availableFleetRef}
      incomingDrivers={incomingDrivers}
    />
    </>
  );
};
