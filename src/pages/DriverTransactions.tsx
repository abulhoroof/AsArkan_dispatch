import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MinusCircle, PlusCircle, RefreshCw, Loader2, FileText, ChevronDown, ChevronRight, Package, CalendarIcon, User } from 'lucide-react';
import { useDriverTransactions, NewTransaction, DriverTransaction } from '@/hooks/useDriverTransactions';
import { AnimatedSummaryCard } from '@/components/AnimatedSummaryCard';
import { useOrganization } from '@/hooks/useOrganization';
import { useUserRole } from '@/hooks/useUserRole';
import { useSettings } from '@/contexts/SettingsContext';
import { getContractProfile } from '@/config/contractProfiles';
import { TransactionTable } from '@/components/TransactionTable';
import { SpreadsheetHeader } from '@/components/SpreadsheetHeader';
import { SettlementGenerator } from '@/components/SettlementGenerator';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, subMonths, subDays, format } from 'date-fns';
import { getDeliveryWeekRange } from '@/utils/date';
import { parseDate, formatDateForDisplay } from '@/utils/date';
import { cn } from '@/lib/utils';

interface Driver {
  id: string;
  driver_name: string;
  contract_type: string;
}

interface DriverLoad {
  id: string;
  load_number: string | null;
  pick_up_date: string | null;
  pick_up_location: string | null;
  delivery_location: string | null;
  load_amount: number | null;
  driver_pay: number | null;
  status: string | null;
  trip_miles: number | null;
  contract_type: string | null;
}

type DatePreset = "This Week" | "Last Week" | "This Month" | "Last Month" | "Last 30" | "Custom";

const DATE_STORAGE_KEY_PREFIX = 'asarkan_tms_date_transactions_';

function getPresetDates(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "This Week":
      return getDeliveryWeekRange(now, 0);
    case "Last Week":
      return getDeliveryWeekRange(now, -1);
    case "This Month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "Last Month":
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "Last 30":
      return { start: subDays(now, 30), end: now };
    case "Custom":
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default function DriverTransactions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationId } = useOrganization();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  const { contractProfiles } = useSettings();
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("This Month");
  const [startDate, setStartDate] = useState<Date>(() => getPresetDates("This Month").start);
  const [endDate, setEndDate] = useState<Date>(() => getPresetDates("This Month").end);
  const [dateStateLoaded, setDateStateLoaded] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [newRowType, setNewRowType] = useState<'deduction' | 'reimbursement' | null>(null);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(true);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | null>(null);
  const [showSettlementGenerator, setShowSettlementGenerator] = useState(false);
  const [loads, setLoads] = useState<DriverLoad[]>([]);
  const [isLoadingLoads, setIsLoadingLoads] = useState(false);
  const [loadsExpanded, setLoadsExpanded] = useState(true);

  const {
    transactions,
    isLoading,
    fetchTransactions,
    addTransaction,
    deleteTransaction,
  } = useDriverTransactions(selectedDriverId);

  // Redirect non-admins
  useEffect(() => {
    if (!isRoleLoading && !isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
    }
  }, [isAdmin, isRoleLoading, navigate]);

  // Get pre-selected driver from navigation state (if any)
  const preSelectedDriverId = location.state?.selectedDriverId as string | undefined;

  // Get user email and ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? undefined);
      setUserId(user?.id ?? null);
    });
  }, []);

  // Load page state (driver + dates) from localStorage when userId becomes available
  useEffect(() => {
    if (userId && !dateStateLoaded) {
      const key = `${DATE_STORAGE_KEY_PREFIX}${userId}`;
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.datePreset) setDatePreset(parsed.datePreset);
          if (parsed.startDate) setStartDate(new Date(parsed.startDate));
          if (parsed.endDate) setEndDate(new Date(parsed.endDate));
          // Restore selected driver (will be validated once drivers are loaded)
          if (parsed.selectedDriverId) setSelectedDriverId(parsed.selectedDriverId);
        }
      } catch (e) {
        console.warn('Failed to load page state from localStorage:', e);
      }
      setDateStateLoaded(true);
    }
  }, [userId, dateStateLoaded]);

  // Save page state (driver + dates) to localStorage whenever it changes
  useEffect(() => {
    if (userId && dateStateLoaded) {
      const key = `${DATE_STORAGE_KEY_PREFIX}${userId}`;
      try {
        localStorage.setItem(key, JSON.stringify({ 
          datePreset, 
          startDate: startDate.toISOString(), 
          endDate: endDate.toISOString(),
          selectedDriverId 
        }));
      } catch (e) {
        console.warn('Failed to save page state to localStorage:', e);
      }
    }
  }, [datePreset, startDate, endDate, selectedDriverId, userId, dateStateLoaded]);

  // Fetch drivers on mount - wait for localStorage state to be loaded first
  useEffect(() => {
    const loadDrivers = async () => {
      // Wait for both organizationId AND dateStateLoaded before auto-selecting
      if (!organizationId || !dateStateLoaded) return;
      
      setIsLoadingDrivers(true);
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('id, driver_name, contract_type')
          .eq('organization_id', organizationId)
          .eq('is_deleted', false)
          .order('driver_name');

        if (error) throw error;
        setDrivers(data || []);
        
        // Auto-select driver: prioritize navigation state, then persisted driver, then first driver
        if (data && data.length > 0) {
          if (preSelectedDriverId && data.some(d => d.id === preSelectedDriverId)) {
            // Navigation state takes priority (deep link from Trucks page)
            setSelectedDriverId(preSelectedDriverId);
          } else if (selectedDriverId && data.some(d => d.id === selectedDriverId)) {
            // Persisted driver is valid, keep it
          } else if (!selectedDriverId) {
            // No valid selection, default to first driver
            setSelectedDriverId(data[0].id);
          }
        }
      } catch (error: any) {
        toast.error('Failed to load drivers: ' + error.message);
      } finally {
        setIsLoadingDrivers(false);
      }
    };

    loadDrivers();
  }, [organizationId, preSelectedDriverId, dateStateLoaded, selectedDriverId]);

  // Handle preset change
  const handlePresetChange = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "Custom") {
      const dates = getPresetDates(preset);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, []);

  // Calculate date range - now uses stored dates
  const getDateRange = useCallback((): { start: Date; end: Date } => {
    return { start: startDate, end: endDate };
  }, [startDate, endDate]);

  // Parse date strings in various formats (handles MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD)
  const parseDateString = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const trimmed = dateStr.trim();
    
    // MM/DD/YY format
    const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (shortMatch) {
      const [, month, day, year] = shortMatch;
      const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year);
      return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    }
    
    // MM/DD/YYYY format
    const longMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (longMatch) {
      const [, month, day, year] = longMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // YYYY-MM-DD format (ISO)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    return null;
  };

  // Fetch loads for selected driver and period
  const fetchLoads = useCallback(async () => {
    if (!selectedDriverId || !organizationId) return;
    
    setIsLoadingLoads(true);
    try {
      // Fetch ALL loads first, then filter in JavaScript to handle inconsistent date formats
      const { data, error } = await supabase
        .from('loads')
        .select('id, load_number, pick_up_date, pick_up_location, delivery_location, load_amount, driver_pay, status, trip_miles, contract_type')
        .eq('driver_id', selectedDriverId)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('pick_up_date', { ascending: false });

      if (error) throw error;

      const range = getDateRange();
      if (range && data) {
        // Normalize date range to remove time component
        const startNorm = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
        const endNorm = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
        
        // Filter in JavaScript to correctly handle all date formats
        const filteredLoads = data.filter(load => {
          const pickupDate = parseDateString(load.pick_up_date);
          if (!pickupDate) return false;
          const pickupNorm = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate());
          return pickupNorm >= startNorm && pickupNorm <= endNorm;
        });
        setLoads(filteredLoads);
      } else {
        setLoads(data || []);
      }
    } catch (error: any) {
      toast.error('Failed to load loads: ' + error.message);
      setLoads([]);
    } finally {
      setIsLoadingLoads(false);
    }
  }, [selectedDriverId, organizationId, getDateRange]);

  // Fetch transactions and loads when driver or date range changes
  useEffect(() => {
    if (selectedDriverId) {
      const range = getDateRange();
      fetchTransactions(range.start, range.end);
      fetchLoads();
    }
  }, [selectedDriverId, startDate, endDate, fetchTransactions, getDateRange, fetchLoads]);

  const handleAddTransaction = async (transaction: NewTransaction): Promise<boolean> => {
    // Optimistic update is handled in the hook - no need to refetch
    return await addTransaction(transaction);
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<DriverTransaction>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('driver_transactions')
        .update({
          description: updates.description,
          amount: updates.amount,
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Transaction updated');
      const range = getDateRange();
      fetchTransactions(range.start, range.end);
      return true;
    } catch (error: any) {
      toast.error('Failed to update: ' + error.message);
      return false;
    }
  };

  const handleDeleteTransaction = async (id: string): Promise<boolean> => {
    const success = await deleteTransaction(id);
    return success;
  };

  const handleRefresh = () => {
    const range = getDateRange();
    fetchTransactions(range.start, range.end);
    fetchLoads();
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


  // Calculate totals
  const totalDeductions = transactions
    .filter((t) => t.transaction_type === 'deduction')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalReimbursements = transactions
    .filter((t) => t.transaction_type === 'reimbursement')
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculate total driver pay from loads
  const totalDriverPay = loads.reduce((sum, load) => {
    const loadContractType = load.contract_type || selectedDriver?.contract_type || '';
    const profile = getContractProfile(loadContractType, contractProfiles);
    if (profile.defaultPayLogic === 'MILEAGE') {
      return sum + (load.trip_miles != null ? profile.defaultRate * load.trip_miles : 0);
    }
    return sum + (load.load_amount != null ? (profile.defaultRate / 100) * load.load_amount : 0);
  }, 0);

  const grandTotal = totalDriverPay + totalReimbursements - totalDeductions;

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  // Loading state for role check
  if (isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Non-admin redirect handled by useEffect
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <SpreadsheetHeader
        onAddRow={() => {}}
        onOpenAddDialog={() => setNewRowType('deduction')}
        totalLoads={0}
        assignedDrivers={drivers.length}
        totalRevenue="$0"
        totalMiles={0}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
        isRefreshing={isLoading}
        currentTab="transactions"
        onNavigate={(path) => navigate(path)}
        userEmail={userEmail}
        isAdmin={isAdmin}
        showKPIs={false}
      />

      <main className="container max-w-6xl mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-4 sm:space-y-6">
        {/* Filters & Actions - Modern 2-Row Layout */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            {/* Row 1: Context (Who & When) + Primary Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-between">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {/* Rich Driver Select */}
                <Select
                  value={selectedDriverId || ''}
                  onValueChange={setSelectedDriverId}
                  disabled={isLoadingDrivers}
                >
                  <SelectTrigger className="w-full sm:w-auto sm:min-w-[280px] sm:max-w-[400px]">
                    {selectedDriver ? (
                      <div className="flex items-center gap-2 overflow-hidden">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium truncate">{selectedDriver.driver_name}</span>
                        <span className="text-muted-foreground shrink-0">•</span>
                        <Badge variant="outline" className="text-xs shrink-0">{selectedDriver.contract_type}</Badge>
                        <span className="text-muted-foreground shrink-0">•</span>
                        <span className="text-sm text-muted-foreground shrink-0">
                          {(() => {
                            const profile = getContractProfile(selectedDriver.contract_type, contractProfiles);
                            if (profile.defaultPayLogic === 'MILEAGE') {
                              return `$${profile.defaultRate.toFixed(2)}/mi`;
                            }
                            return `${profile.defaultRate}%`;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select driver...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => {
                      const profile = getContractProfile(driver.contract_type, contractProfiles);
                      const rateDisplay = profile.defaultPayLogic === 'MILEAGE' 
                        ? `$${profile.defaultRate.toFixed(2)}/mi`
                        : `${profile.defaultRate}%`;
                      return (
                        <SelectItem key={driver.id} value={driver.id}>
                          <div className="flex items-center gap-2">
                            <span>{driver.driver_name}</span>
                            <Badge variant="outline" className="text-xs">{driver.contract_type}</Badge>
                            <span className="text-xs text-muted-foreground">{rateDisplay}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Collapsed Date Range Picker */}
                <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="min-w-[200px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, "MMM d")} – {format(endDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-[95vw] max-h-[80vh] overflow-auto p-0" align="start">
                    <div className="flex flex-col sm:flex-row">
                      {/* Presets - horizontal scroll on mobile, vertical sidebar on desktop */}
                      <div className="border-b sm:border-b-0 sm:border-r p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible bg-muted/30">
                        {(["This Week", "Last Week", "This Month", "Last Month", "Last 30"] as DatePreset[]).map((preset) => (
                          <Button
                            key={preset}
                            variant={datePreset === preset ? "secondary" : "ghost"}
                            size="sm"
                            className="whitespace-nowrap justify-start text-sm"
                            onClick={() => {
                              handlePresetChange(preset);
                              setDateRangeOpen(false);
                            }}
                          >
                            {preset}
                          </Button>
                        ))}
                      </div>
                      {/* Calendar Range - 1 month on mobile, 2 on desktop */}
                      <div className="p-2">
                        <Calendar
                          mode="range"
                          selected={{ from: startDate, to: endDate }}
                          onSelect={(range) => {
                            if (range?.from) {
                              setStartDate(range.from);
                              setDatePreset("Custom");
                            }
                            if (range?.to) {
                              setEndDate(range.to);
                            }
                          }}
                          numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 2}
                          className="pointer-events-auto"
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Refresh Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleRefresh} 
                        disabled={isLoading}
                        className="shrink-0"
                      >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh Data</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Generate Settlement - Top Right */}
              <Button
                onClick={() => setShowSettlementGenerator(true)}
                disabled={!selectedDriverId}
                className="px-6"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Settlement
              </Button>
            </div>

            {/* Row 2: Adjustment Actions */}
            <div className="flex gap-2 pt-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewRowType('deduction')}
                disabled={!selectedDriverId || newRowType !== null}
                className="bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full"
              >
                <MinusCircle className="h-4 w-4 mr-1.5 text-destructive" />
                Deduction
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewRowType('reimbursement')}
                disabled={!selectedDriverId || newRowType !== null}
                className="bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full"
              >
                <PlusCircle className="h-4 w-4 mr-1.5 text-green-600" />
                Reimbursement
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loads Section (Read-Only) */}
        {selectedDriverId && (
          <Card>
            <Collapsible open={loadsExpanded} onOpenChange={setLoadsExpanded}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Loads ({loads.length})
                    </CardTitle>
                    {loadsExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {isLoadingLoads ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : loads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No loads found for this period
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Load #</TableHead>
                            <TableHead>Pick Up</TableHead>
                            <TableHead>Route</TableHead>
                            <TableHead className="text-center">Rate</TableHead>
                            <TableHead className="text-right">Miles</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Driver Pay</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loads.map((load) => {
                            const loadContractType = load.contract_type || selectedDriver?.contract_type || '';
                            const profile = getContractProfile(loadContractType, contractProfiles);
                            const isMileageBased = profile.defaultPayLogic === 'MILEAGE';
                            const rateDisplay = isMileageBased 
                              ? `$${profile.defaultRate.toFixed(2)}/mi`
                              : `${profile.defaultRate}%`;
                            
                            // Calculate driver pay based on pay logic
                            let calculatedDriverPay: number | null = null;
                            if (isMileageBased) {
                              // Mileage: rate × miles
                              if (load.trip_miles != null) {
                                calculatedDriverPay = profile.defaultRate * load.trip_miles;
                              }
                            } else {
                              // Percentage: rate% × load amount
                              if (load.load_amount != null) {
                                calculatedDriverPay = (profile.defaultRate / 100) * load.load_amount;
                              }
                            }
                            
                            return (
                              <TableRow key={load.id}>
                                <TableCell className="font-medium">
                                  {load.load_number || '—'}
                                </TableCell>
                                <TableCell>
                                  {formatDateForDisplay(parseDate(load.pick_up_date)) || '—'}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {load.pick_up_location || '?'} → {load.delivery_location || '?'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {rateDisplay}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {isMileageBased && load.trip_miles != null
                                    ? load.trip_miles.toLocaleString()
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {load.load_amount != null 
                                    ? `$${load.load_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {calculatedDriverPay != null
                                    ? `$${calculatedDriverPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Transactions Table */}
        {selectedDriverId ? (
          <TransactionTable
            transactions={transactions}
            onDelete={handleDeleteTransaction}
            onUpdate={handleUpdateTransaction}
            onAdd={handleAddTransaction}
            isLoading={isLoading}
            newRowType={newRowType}
            onCancelNewRow={() => setNewRowType(null)}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a driver to view their transactions
            </CardContent>
          </Card>
        )}

        {/* Summary Cards - Always visible when driver selected */}
        {selectedDriverId && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatedSummaryCard
              title="Total Loads"
              value={totalDriverPay}
              variant="neutral"
            />
            <AnimatedSummaryCard
              title="Total Deductions"
              value={totalDeductions}
              variant="deduction"
            />
            <AnimatedSummaryCard
              title="Total Reimbursements"
              value={totalReimbursements}
              variant="reimbursement"
            />
            <AnimatedSummaryCard
              title="Grand Total"
              value={grandTotal}
              variant="neutral"
            />
          </div>
        )}
      </main>

      {/* Settlement Generator */}
      {selectedDriver && (
        <SettlementGenerator
          open={showSettlementGenerator}
          onOpenChange={setShowSettlementGenerator}
          driverId={selectedDriver.id}
          driverName={selectedDriver.driver_name}
          driverContractType={selectedDriver.contract_type}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
}
