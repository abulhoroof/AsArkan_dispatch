import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContractTypeBadge } from "@/components/ContractTypeBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useDriverTransactions, DriverStatement } from "@/hooks/useDriverTransactions";
import { parseDate, formatDateForDisplay } from "@/utils/date";
import { DEFAULT_CONTRACT_PROFILES } from "@/config/contractProfiles";
import { 
  Loader2, CalendarIcon, RefreshCw, TrendingUp, TrendingDown, 
  Truck, DollarSign, Package, Minus, Plus, FileText, ArrowRight,
  Pencil, Save, X, Phone, Hash, RectangleHorizontal
} from "lucide-react";
import { FuelStatusBadge } from "@/components/FuelStatusBadge";
import { format, startOfMonth, endOfMonth, subDays, startOfYear } from "date-fns";
import { getDeliveryWeekRange } from "@/utils/date";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DriverInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string | null;
  driverName: string;
  driverContractType?: string;
  driverFuelEnabled?: boolean;
  isAdmin?: boolean;
  onToggleFuel?: (driverId: string, enabled: boolean) => void;
  onDriverUpdated?: () => void;
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
}

type DatePreset = "This Week" | "Last Week" | "This Month" | "Last Month" | "Last 30" | "Custom";

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
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "Last 30":
      return { start: subDays(now, 30), end: now };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

interface DriverDetails {
  driver_name: string;
  driver_phone: string | null;
  truck_number: number | null;
  trailer_number: string | null;
  trailer_type: string | null;
  contract_type: string;
}

export function DriverInfoSheet({
  open,
  onOpenChange,
  driverId,
  driverName,
  driverContractType,
  driverFuelEnabled = true,
  isAdmin = false,
  onToggleFuel,
  onDriverUpdated,
}: DriverInfoSheetProps) {
  const { organizationId } = useOrganization();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"loads" | "summary">("summary");
  
  // Driver info edit state
  const [driverDetails, setDriverDetails] = useState<DriverDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<DriverDetails | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localFuelEnabled, setLocalFuelEnabled] = useState(driverFuelEnabled);

  // Sync prop to local state when sheet opens or prop changes
  useEffect(() => {
    setLocalFuelEnabled(driverFuelEnabled);
  }, [driverFuelEnabled, open]);
  
  // Loads state
  const [loads, setLoads] = useState<DriverLoad[]>([]);
  const [isLoadingLoads, setIsLoadingLoads] = useState(false);
  
  // Summary state
  const [activePreset, setActivePreset] = useState<DatePreset>("This Month");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  
  const { statement, isLoadingStatement, fetchStatement } = useDriverTransactions(driverId);

  // Fetch loads for the driver
  const fetchLoads = useCallback(async () => {
    if (!driverId || !organizationId) return;
    
    setIsLoadingLoads(true);
    try {
      const { data, error } = await supabase
        .from('loads')
        .select('id, load_number, pick_up_date, pick_up_location, delivery_location, load_amount, driver_pay, status')
        .eq('driver_id', driverId)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('pick_up_date', { ascending: false });
      
      if (error) throw error;
      setLoads(data || []);
    } catch (error) {
      console.error('Error fetching driver loads:', error);
      setLoads([]);
    } finally {
      setIsLoadingLoads(false);
    }
  }, [driverId, organizationId]);

  // Fetch driver details
  const fetchDriverDetails = useCallback(async () => {
    if (!driverId) return;
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('driver_name, driver_phone, truck_number, trailer_number, trailer_type, contract_type')
        .eq('id', driverId)
        .single();
      if (error) throw error;
      setDriverDetails(data);
    } catch (error) {
      console.error('Error fetching driver details:', error);
    }
  }, [driverId]);

  // Save driver details
  const handleSaveDriver = async () => {
    if (!driverId || !editForm) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          driver_name: editForm.driver_name,
          driver_phone: editForm.driver_phone || null,
          truck_number: editForm.truck_number,
          trailer_number: editForm.trailer_number || null,
          trailer_type: editForm.trailer_type || null,
          contract_type: editForm.contract_type,
        })
        .eq('id', driverId);
      if (error) throw error;
      setDriverDetails(editForm);
      setIsEditing(false);
      toast.success('Driver info updated');
      onDriverUpdated?.();
    } catch (error) {
      console.error('Error updating driver:', error);
      toast.error('Failed to update driver');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch summary data
  const fetchSummary = useCallback(() => {
    if (driverId && organizationId) {
      fetchStatement(startDate, endDate);
    }
  }, [driverId, organizationId, startDate, endDate, fetchStatement]);

  // Fetch data when sheet opens
  useEffect(() => {
    if (open && driverId) {
      fetchLoads();
      fetchSummary();
      fetchDriverDetails();
      setIsEditing(false);
    }
  }, [open, driverId, fetchLoads, fetchSummary, fetchDriverDetails]);

  // Handle preset change
  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset !== "Custom") {
      const { start, end } = getPresetDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Refresh summary when dates change
  useEffect(() => {
    if (open && driverId && activeTab === "summary") {
      fetchSummary();
    }
  }, [startDate, endDate, open, driverId, activeTab, fetchSummary]);

  const presets: DatePreset[] = ["This Week", "Last Week", "This Month", "Last Month", "Last 30"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">{driverName}</SheetTitle>
                <div className="mt-1 flex items-center gap-2">
                  <ContractTypeBadge type={driverContractType as any} />
                  <FuelStatusBadge
                    enabled={localFuelEnabled}
                    showToggle={isAdmin && !!onToggleFuel}
                    onToggle={isAdmin && onToggleFuel && driverId ? (enabled) => {
                      setLocalFuelEnabled(enabled);
                      onToggleFuel(driverId, enabled);
                    } : undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Driver Info Section */}
        {driverDetails && (
          <div className="mt-4 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Driver Information</span>
              {isEditing ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={handleSaveDriver} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { setEditForm({ ...driverDetails }); setIsEditing(true); }}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>

            {isEditing && editForm ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={editForm.driver_name}
                    onChange={(e) => setEditForm({ ...editForm, driver_name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone</label>
                  <Input
                    value={editForm.driver_phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, driver_phone: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Contract Type</label>
                  <Select value={editForm.contract_type} onValueChange={(v) => setEditForm({ ...editForm, contract_type: v })}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(DEFAULT_CONTRACT_PROFILES).map((ct) => (
                        <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Truck #</label>
                  <Input
                    type="number"
                    value={editForm.truck_number ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, truck_number: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Trailer #</label>
                  <Input
                    value={editForm.trailer_number || ''}
                    onChange={(e) => setEditForm({ ...editForm, trailer_number: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Trailer Type</label>
                  <Select value={editForm.trailer_type || ''} onValueChange={(v) => setEditForm({ ...editForm, trailer_type: v })}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Flat Bed', 'Van', 'Reefer', 'Step Deck', 'Power Only'].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{driverDetails.driver_phone || 'No phone'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  <span>Truck #{driverDetails.truck_number ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  <span>Trailer {driverDetails.trailer_number || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RectangleHorizontal className="h-3.5 w-3.5" />
                  <span>{driverDetails.trailer_type || '—'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "loads" | "summary")} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="loads" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Loads
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Loads Tab */}
          <TabsContent value="loads" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {loads.length} load{loads.length !== 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLoads}
                disabled={isLoadingLoads}
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingLoads && "animate-spin")} />
              </Button>
            </div>

            {isLoadingLoads ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : loads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No loads found for this driver.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Load #</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loads.map((load) => (
                      <TableRow key={load.id}>
                        <TableCell className="font-medium">
                          {load.load_number || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateForDisplay(parseDate(load.pick_up_date)) || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span className="truncate max-w-[80px]" title={load.pick_up_location || ''}>
                              {load.pick_up_location?.split(',')[0] || '-'}
                            </span>
                            <ArrowRight className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[80px]" title={load.delivery_location || ''}>
                              {load.delivery_location?.split(',')[0] || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm">
                            {load.load_amount ? formatCurrency(load.load_amount) : '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Pay: {load.driver_pay ? formatCurrency(load.driver_pay) : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={load.status as any} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-4 space-y-4">
            {/* Date Range Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Date Range</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchSummary}
                  disabled={isLoadingStatement}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoadingStatement && "animate-spin")} />
                </Button>
              </div>
              
              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <Button
                    key={preset}
                    variant={activePreset === preset ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => handlePresetChange(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>

              {/* Custom Date Pickers */}
              <div className="flex gap-2">
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-xs">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {format(startDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(date);
                          setActivePreset("Custom");
                        }
                        setStartOpen(false);
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover open={endOpen} onOpenChange={setEndOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-xs">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {format(endDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(date);
                          setActivePreset("Custom");
                        }
                        setEndOpen(false);
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Statement Summary */}
            <SummaryContent statement={statement} isLoading={isLoadingStatement} />

            {/* Link to Transactions Page */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/transactions', { state: { selectedDriverId: driverId } });
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                View/Edit Transactions
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// Extracted summary content component
function SummaryContent({ statement, isLoading }: { statement: DriverStatement | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for this period.
      </div>
    );
  }

  const stats = [
    {
      label: "Total Loads",
      value: statement.total_loads.toString(),
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Load Revenue",
      value: formatCurrency(statement.total_load_amount),
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Driver Pay",
      value: formatCurrency(statement.total_driver_pay),
      icon: DollarSign,
      color: "text-foreground",
    },
    {
      label: "Reimbursements",
      value: formatCurrency(statement.total_reimbursements),
      icon: Plus,
      color: "text-emerald-600 dark:text-emerald-400",
      subtext: "+",
    },
    {
      label: "Deductions",
      value: formatCurrency(statement.total_deductions),
      icon: Minus,
      color: "text-red-600 dark:text-red-400",
      subtext: "−",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <stat.icon className="h-3 w-3" />
                {stat.label}
              </div>
              <div className={`font-semibold ${stat.color}`}>
                {stat.subtext && <span>{stat.subtext}</span>}
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Net Payment - Highlighted */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {statement.net_payment >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <span className="font-medium">Net Payment</span>
            </div>
            <div
              className={`text-xl font-bold ${
                statement.net_payment >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(statement.net_payment)}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Driver Pay + Reimbursements − Deductions
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
