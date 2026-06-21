import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SpreadsheetHeader } from "@/components/SpreadsheetHeader";
import { AppFooter } from "@/components/AppFooter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Truck, DollarSign, Gauge, Map, ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { clearSubdomainCache } from "@/hooks/useSubdomain";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, addMonths, format } from "date-fns";
import { getDeliveryWeekRange } from "@/utils/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type DateFilter = "week" | "month";

const DATE_STORAGE_KEY_PREFIX = 'asarkan_tms_date_analytics_';

interface DispatcherPerformance {
  dispatcher_email: string;
  dispatcher_name: string;
  total_loads: number;
  total_revenue: number;
  total_miles: number;
  avg_rpm: number;
  invoiced_loads: number;
  verified_loads: number;
  avg_turnaround_days: number;
  total_driver_pay: number;
  profit: number;
  profit_margin: number;
}

interface PeriodTotals {
  totalRevenue: number;
  totalMiles: number;
  totalLoads: number;
  totalDriverPay: number;
  totalDHMiles: number;
  avgRpm: number;
}

const AdminAnalytics = () => {
  const [performance, setPerformance] = useState<DispatcherPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | null>(null);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [dateOffset, setDateOffset] = useState(0);
  const [dateStateLoaded, setDateStateLoaded] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState(0);
  const [totalDHMiles, setTotalDHMiles] = useState(0);
  const [previousPeriodTotals, setPreviousPeriodTotals] = useState<PeriodTotals | null>(null);
  const navigate = useNavigate();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  const { organizationId } = useOrganization();

  const getDateRange = (offset: number = dateOffset) => {
    const today = new Date();
    if (dateFilter === "week") {
      return getDeliveryWeekRange(today, offset);
    } else {
      const monthStart = startOfMonth(addMonths(today, offset));
      const monthEnd = endOfMonth(addMonths(today, offset));
      return { start: monthStart, end: monthEnd };
    }
  };

  const getPreviousDateRange = () => {
    if (dateFilter === "week") {
      return getDateRange(dateOffset - 1);
    } else {
      return getDateRange(dateOffset - 1);
    }
  };

  const getDateRangeLabel = () => {
    const { start, end } = getDateRange();
    if (dateFilter === "week") {
      return `Week: ${format(start, "M/d")} - ${format(end, "M/d")}`;
    } else {
      return format(start, "MMMM yyyy");
    }
  };

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
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
    }
  }, [isAdmin, isRoleLoading, navigate]);

  const fetchPerformance = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();
      const startDate = format(start, "yyyy-MM-dd");
      const endDate = format(end, "yyyy-MM-dd");

      // Use a raw RPC call with type casting since the function isn't in generated types yet
      const { data, error } = await (supabase.rpc as any)('get_dispatcher_performance', {
        p_org_id: organizationId,
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) throw error;

      setPerformance((data as DispatcherPerformance[]) || []);
      
      // Fetch unique drivers who had loads in the date range AND DH miles
      const { data: loadsData } = await supabase
        .from('loads')
        .select('driver_id, dh_miles')
        .eq('organization_id', organizationId)
        .gte('pick_up_date', startDate)
        .lte('pick_up_date', endDate)
        .not('driver_id', 'is', null);

      const uniqueDriverIds = new Set(loadsData?.map(l => l.driver_id) || []);
      setTotalDrivers(uniqueDriverIds.size);
      
      // Calculate total DH miles
      const dhMilesTotal = loadsData?.reduce((sum, l) => sum + (l.dh_miles || 0), 0) || 0;
      setTotalDHMiles(dhMilesTotal);

      // Fetch available drivers (sitting) - org-scoped approach
      const { data: orgDrivers } = await supabase
        .from('drivers')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false);

      if (orgDrivers && orgDrivers.length > 0) {
        const orgDriverIds = orgDrivers.map(d => d.id);
        const { data: statusData } = await supabase
          .from('driver_statuses')
          .select('driver_id, status')
          .in('status', ['Empty_34hr_reset', 'Searching_for_load'])
          .in('driver_id', orgDriverIds);
        setAvailableDrivers(statusData?.length || 0);
      } else {
        setAvailableDrivers(0);
      }

      // Fetch previous period data for comparison
      const { start: prevStart, end: prevEnd } = getPreviousDateRange();
      const prevStartDate = format(prevStart, "yyyy-MM-dd");
      const prevEndDate = format(prevEnd, "yyyy-MM-dd");

      const { data: prevData } = await (supabase.rpc as any)('get_dispatcher_performance', {
        p_org_id: organizationId,
        p_start_date: prevStartDate,
        p_end_date: prevEndDate
      });

      const { data: prevLoadsData } = await supabase
        .from('loads')
        .select('driver_id, dh_miles')
        .eq('organization_id', organizationId)
        .gte('pick_up_date', prevStartDate)
        .lte('pick_up_date', prevEndDate)
        .not('driver_id', 'is', null);

      const prevPerformance = (prevData as DispatcherPerformance[]) || [];
      const prevTotals = prevPerformance.reduce(
        (acc, p) => ({
          totalRevenue: acc.totalRevenue + (p.total_revenue || 0),
          totalMiles: acc.totalMiles + (p.total_miles || 0),
          totalLoads: acc.totalLoads + (p.total_loads || 0),
          totalDriverPay: acc.totalDriverPay + (p.total_driver_pay || 0),
          totalDHMiles: acc.totalDHMiles,
          avgRpm: 0, // will be calculated below
        }),
        { totalRevenue: 0, totalMiles: 0, totalLoads: 0, totalDriverPay: 0, totalDHMiles: 0, avgRpm: 0 }
      );
      prevTotals.totalDHMiles = prevLoadsData?.reduce((sum, l) => sum + (l.dh_miles || 0), 0) || 0;
      prevTotals.avgRpm = prevTotals.totalMiles > 0 
        ? prevTotals.totalRevenue / prevTotals.totalMiles 
        : 0;
      
      setPreviousPeriodTotals(prevTotals);
    } catch (error: any) {
      console.error("Error fetching performance:", error.message);
      toast.error("Failed to load performance data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && organizationId) {
      fetchPerformance();
    }
  }, [isAdmin, organizationId, dateFilter, dateOffset]);

  const handleSignOut = async () => {
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

  const handleRefresh = async () => {
    await fetchPerformance();
    toast.success("Data refreshed");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "$0.00";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return "0";
    return value.toLocaleString();
  };

  // Calculate totals
  const totals = performance.reduce(
    (acc, p) => ({
      totalLoads: acc.totalLoads + (p.total_loads || 0),
      totalRevenue: acc.totalRevenue + (p.total_revenue || 0),
      totalMiles: acc.totalMiles + (p.total_miles || 0),
      invoicedLoads: acc.invoicedLoads + (p.invoiced_loads || 0),
      verifiedLoads: acc.verifiedLoads + (p.verified_loads || 0),
      totalDriverPay: acc.totalDriverPay + (p.total_driver_pay || 0),
    }),
    { totalLoads: 0, totalRevenue: 0, totalMiles: 0, invoicedLoads: 0, verifiedLoads: 0, totalDriverPay: 0 }
  );

  const avgRpm = totals.totalMiles > 0 
    ? (totals.totalRevenue / totals.totalMiles).toFixed(2) 
    : '0.00';

  const getRpmColorClass = (rpm: number) => {
    if (rpm >= 3) return 'text-green-600 dark:text-green-400';
    if (rpm >= 2) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const ComparisonBadge = ({ current, previous, invertColor = false }: { 
    current: number; 
    previous: number; 
    invertColor?: boolean;
  }) => {
    const change = getPercentageChange(current, previous);
    const isPositive = change >= 0;
    const periodLabel = dateFilter === "week" ? "vs last week" : "vs last month";
    
    // For metrics where lower is better (like DH miles), invert the color
    const colorClass = invertColor 
      ? (isPositive ? "text-red-500" : "text-green-500")
      : (isPositive ? "text-green-500" : "text-red-500");
    
    if (previousPeriodTotals === null) return null;
    
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
        <span className={`flex items-center gap-0.5 ${colorClass}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(change).toFixed(1)}%
        </span>
        <span>{periodLabel}</span>
      </p>
    );
  };

  if (isRoleLoading || isLoading) {
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
        totalLoads={totals.totalLoads}
        assignedDrivers={performance.length}
        totalRevenue={formatCurrency(totals.totalRevenue)}
        totalMiles={totals.totalMiles}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
        isRefreshing={isLoading}
        currentTab="analytics"
        onNavigate={(path) => navigate(path)}
        userEmail={userEmail}
        isAdmin={isAdmin}
      />

      <main className="p-2 sm:p-4 md:p-6">
        {/* Date Filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setDateOffset(0); }}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDateOffset(dateOffset - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md min-w-[140px] justify-center">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{getDateRangeLabel()}</span>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDateOffset(dateOffset + 1)}
              disabled={dateOffset >= 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {dateOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateOffset(0)}
            >
              Today
            </Button>
          )}
        </div>

        {/* Primary KPI Cards - Important Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-revenue">{formatCurrency(totals.totalRevenue)}</div>
              <ComparisonBadge 
                current={totals.totalRevenue} 
                previous={previousPeriodTotals?.totalRevenue || 0} 
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg RPM</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getRpmColorClass(parseFloat(avgRpm))}`}>
                ${avgRpm}
              </div>
              <ComparisonBadge 
                current={parseFloat(avgRpm)} 
                previous={previousPeriodTotals?.avgRpm || 0} 
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Miles</CardTitle>
              <Map className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totals.totalMiles)}</div>
              <ComparisonBadge 
                current={totals.totalMiles} 
                previous={previousPeriodTotals?.totalMiles || 0} 
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Driver Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{formatCurrency(totals.totalDriverPay)}</div>
              <ComparisonBadge 
                current={totals.totalDriverPay} 
                previous={previousPeriodTotals?.totalDriverPay || 0} 
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total DH Miles</CardTitle>
              <Map className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{formatNumber(totalDHMiles)}</div>
              <ComparisonBadge 
                current={totalDHMiles} 
                previous={previousPeriodTotals?.totalDHMiles || 0}
                invertColor={true}
              />
            </CardContent>
          </Card>
        </div>

        {/* Secondary KPI Cards - Nice to Have */}
        <div className="flex flex-wrap items-center gap-4 mb-6 px-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span><span className="font-semibold text-foreground">{performance.length}</span> Dispatchers</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span><span className="font-semibold text-foreground">{totalDrivers}</span> Drivers</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-amber-500 cursor-help">
                  <AlertCircle className="h-4 w-4" />
                  <span><span className="font-semibold">{availableDrivers}</span> Sitting</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Drivers with status "Empty 34hr Reset" or "Searching for Load"</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span><span className="font-semibold text-foreground">{formatNumber(totals.totalLoads)}</span> Loads</span>
          </div>
        </div>

        {/* Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Dispatcher Performance</CardTitle>
            <CardDescription>Performance metrics for each dispatcher</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispatcher</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Gauge className="h-4 w-4" />
                        <span className="font-bold">Avg RPM</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Loads</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Miles</TableHead>
                    <TableHead className="text-right">Driver Pay</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No performance data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    performance.map((p) => (
                      <TableRow key={p.dispatcher_email}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{p.dispatcher_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{p.dispatcher_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end gap-1.5 font-bold text-base ${getRpmColorClass(p.avg_rpm || 0)}`}>
                            <Gauge className="h-4 w-4" />
                            ${(p.avg_rpm || 0).toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(p.total_loads)}</TableCell>
                        <TableCell className="text-right text-revenue">{formatCurrency(p.total_revenue)}</TableCell>
                        <TableCell className="text-right">{formatNumber(p.total_miles)}</TableCell>
                        <TableCell className="text-right text-orange-500">{formatCurrency(p.total_driver_pay)}</TableCell>
                        <TableCell className="text-right">{formatNumber(p.invoiced_loads)}</TableCell>
                        <TableCell className="text-right">{formatNumber(p.verified_loads)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <AppFooter />
    </div>
  );
};

export default AdminAnalytics;
