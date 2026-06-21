import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Download, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  InvoiceLineItem, 
  getContractProfile,
} from '@/config/contractProfiles';
import { useSettings } from '@/contexts/SettingsContext';
import { SettlementAdjustment } from '@/components/DriverFinance/SettlementAdjustments';
import { 
  formatCurrency, 
  calculateNetPay,
  generateLineItemId,
} from '@/utils/settlementCalculations';
import { generateSettlementPdf } from '@/utils/settlementPdfGenerator';
import { SettlementHistory } from './SettlementHistory';

interface SettlementGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  driverName: string;
  driverContractType: string;
  startDate: Date;
  endDate: Date;
}

// Parse date strings in various formats
function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  
  const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortMatch) {
    const [, month, day, year] = shortMatch;
    const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }
  
  const longMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (longMatch) {
    const [, month, day, year] = longMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return null;
}

export function SettlementGenerator({
  open,
  onOpenChange,
  driverId,
  driverName,
  driverContractType,
  startDate,
  endDate,
}: SettlementGeneratorProps) {
  const { organizationId } = useOrganization();
  const { contractProfiles } = useSettings();
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [deductions, setDeductions] = useState<SettlementAdjustment[]>([]);
  const [reimbursements, setReimbursements] = useState<SettlementAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Selection state
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [selectedDeductionIds, setSelectedDeductionIds] = useState<Set<string>>(new Set());
  const [selectedReimbursementIds, setSelectedReimbursementIds] = useState<Set<string>>(new Set());

  const contractProfile = useMemo(() => 
    getContractProfile(driverContractType, contractProfiles),
    [driverContractType, contractProfiles]
  );

  // Selected items (filtered by selection)
  const selectedLineItems = useMemo(() => 
    lineItems.filter(item => selectedLoadIds.has(item.id)),
    [lineItems, selectedLoadIds]
  );

  // Detect if settlement has mixed rates
  const hasMixedRates = useMemo(() => {
    const rates = new Set(lineItems.map(item => `${item.payLogic}-${item.rate}`));
    return rates.size > 1;
  }, [lineItems]);

  const selectedDeductions = useMemo(() => 
    deductions.filter(item => selectedDeductionIds.has(item.id)),
    [deductions, selectedDeductionIds]
  );

  const selectedReimbursements = useMemo(() => 
    reimbursements.filter(item => selectedReimbursementIds.has(item.id)),
    [reimbursements, selectedReimbursementIds]
  );

  // Totals (based on selected items only)
  const totalNetPay = useMemo(() => 
    selectedLineItems.reduce((sum, item) => sum + item.netPay, 0),
    [selectedLineItems]
  );
  
  const totalDeductions = useMemo(() => 
    selectedDeductions.reduce((sum, item) => sum + (item.amount || 0), 0),
    [selectedDeductions]
  );
  
  const totalReimbursements = useMemo(() => 
    selectedReimbursements.reduce((sum, item) => sum + (item.amount || 0), 0),
    [selectedReimbursements]
  );
  
  const grandTotal = useMemo(() => 
    totalNetPay + totalReimbursements - totalDeductions,
    [totalNetPay, totalReimbursements, totalDeductions]
  );

  // Toggle functions
  const toggleLoad = useCallback((id: string) => {
    setSelectedLoadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleDeduction = useCallback((id: string) => {
    setSelectedDeductionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleReimbursement = useCallback((id: string) => {
    setSelectedReimbursementIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllLoads = useCallback(() => {
    if (selectedLoadIds.size === lineItems.length) {
      setSelectedLoadIds(new Set());
    } else {
      setSelectedLoadIds(new Set(lineItems.map(i => i.id)));
    }
  }, [lineItems, selectedLoadIds.size]);

  const toggleAllDeductions = useCallback(() => {
    if (selectedDeductionIds.size === deductions.length) {
      setSelectedDeductionIds(new Set());
    } else {
      setSelectedDeductionIds(new Set(deductions.map(d => d.id)));
    }
  }, [deductions, selectedDeductionIds.size]);

  const toggleAllReimbursements = useCallback(() => {
    if (selectedReimbursementIds.size === reimbursements.length) {
      setSelectedReimbursementIds(new Set());
    } else {
      setSelectedReimbursementIds(new Set(reimbursements.map(r => r.id)));
    }
  }, [reimbursements, selectedReimbursementIds.size]);

  // Recalculate net pay
  const recalculateItem = useCallback((item: InvoiceLineItem): InvoiceLineItem => {
    const netPay = calculateNetPay(item.payLogic, item.rate, item.grossAmount, item.milesDriven);
    return { ...item, netPay };
  }, []);

  // Load data from database
  const loadData = useCallback(async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch loads
      const { data: loads, error: loadsError } = await supabase
        .from('loads')
        .select('id, load_number, load_amount, total_miles, trip_miles, pick_up_date, delivery_date, contract_type')
        .eq('driver_id', driverId)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('pick_up_date', { ascending: true });

      if (loadsError) throw loadsError;

      // Filter loads by date range
      const startNorm = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endNorm = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      const filteredLoads = (loads || []).filter(load => {
        const pickupDate = parseDateString(load.pick_up_date);
        if (!pickupDate) return false;
        const pickupNorm = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate());
        return pickupNorm >= startNorm && pickupNorm <= endNorm;
      });

      const newItems: InvoiceLineItem[] = filteredLoads.map((load) => {
        const loadContractType = load.contract_type || driverContractType;
        const profile = getContractProfile(loadContractType, contractProfiles);
        
        // Format the rate for display
        const appliedRate = profile.defaultPayLogic === 'PERCENTAGE' 
          ? `${profile.defaultRate}%` 
          : `$${profile.defaultRate.toFixed(2)}/mi`;
        
        const item: InvoiceLineItem = {
          id: generateLineItemId(),
          description: load.load_number ? `Load #${load.load_number}` : 'Load',
          loadId: load.id,
          loadNumber: load.load_number || undefined,
          deliveryDate: load.delivery_date || undefined,
          payLogic: profile.defaultPayLogic,
          rate: profile.defaultRate,
          isOverridden: false,
          grossAmount: profile.defaultPayLogic === 'PERCENTAGE' ? (load.load_amount || 0) : undefined,
          milesDriven: profile.defaultPayLogic === 'MILEAGE' ? (load.trip_miles || load.total_miles || 0) : undefined,
          netPay: 0,
          appliedRate,
        };
        
        return recalculateItem(item);
      });

      setLineItems(newItems);
      // Auto-select all loads
      setSelectedLoadIds(new Set(newItems.map(item => item.id)));

      // Fetch transactions
      const { data: transactions, error: txError } = await supabase
        .from('driver_transactions')
        .select('id, description, amount, transaction_type, category')
        .eq('driver_id', driverId)
        .eq('organization_id', organizationId)
        .gte('transaction_date', startStr)
        .lte('transaction_date', endStr)
        .order('transaction_date', { ascending: true });

      if (txError) throw txError;

      const deductionsData = (transactions || [])
        .filter(tx => tx.transaction_type === 'deduction')
        .map(tx => ({
          id: tx.id,
          description: tx.description || tx.category,
          amount: Math.abs(tx.amount),
        }));
      
      const reimbursementsData = (transactions || [])
        .filter(tx => tx.transaction_type === 'reimbursement')
        .map(tx => ({
          id: tx.id,
          description: tx.description || tx.category,
          amount: Math.abs(tx.amount),
        }));

      setDeductions(deductionsData);
      setReimbursements(reimbursementsData);
      // Auto-select all deductions and reimbursements
      setSelectedDeductionIds(new Set(deductionsData.map(d => d.id)));
      setSelectedReimbursementIds(new Set(reimbursementsData.map(r => r.id)));

    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [driverId, organizationId, startDate, endDate, driverContractType, recalculateItem]);

  // Load data when drawer opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // Generate and save settlement
  const handleGenerate = async () => {
    if (!organizationId) return;
    
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate PDF with selected items only
      const invoiceNumber = `SET-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      generateSettlementPdf({
        driverName,
        driverContractType,
        invoiceNumber,
        startDate,
        endDate,
        lineItems: selectedLineItems,
        deductions: selectedDeductions,
        reimbursements: selectedReimbursements,
        totalNetPay,
        totalDeductions,
        totalReimbursements,
        grandTotal,
        payLogic: contractProfile.defaultPayLogic,
        rate: contractProfile.defaultRate,
      });

      // Save to history with selected items only
      const { error: insertError } = await supabase.from('settlement_history').insert([{
        driver_id: driverId,
        organization_id: organizationId,
        period_start: format(startDate, 'yyyy-MM-dd'),
        period_end: format(endDate, 'yyyy-MM-dd'),
        driver_name: driverName,
        driver_contract_type: driverContractType,
        line_items: JSON.parse(JSON.stringify(selectedLineItems)),
        deductions: JSON.parse(JSON.stringify(selectedDeductions)),
        reimbursements: JSON.parse(JSON.stringify(selectedReimbursements)),
        total_loads: totalNetPay,
        total_deductions: totalDeductions,
        total_reimbursements: totalReimbursements,
        grand_total: grandTotal,
        generated_by: user.id,
      }]);
      
      if (insertError) throw insertError;

      // Keep only last 5 settlements per driver
      const { data: allHistory } = await supabase
        .from('settlement_history')
        .select('id')
        .eq('driver_id', driverId)
        .eq('organization_id', organizationId)
        .order('generated_at', { ascending: false });

      if (allHistory && allHistory.length > 5) {
        const idsToDelete = allHistory.slice(5).map(h => h.id);
        await supabase.from('settlement_history').delete().in('id', idsToDelete);
      }

      toast.success('Settlement generated and saved');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to generate: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const periodLabel = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-screen !max-w-none sm:!w-[85vw] sm:!max-w-[85vw] md:!w-[480px] md:!max-w-[480px] overflow-y-auto flex flex-col p-4 sm:p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            Settlement for {driverName}
            <Badge variant="outline">{driverContractType}</Badge>
          </SheetTitle>
          <p className="text-sm text-muted-foreground">Period: {periodLabel}</p>
        </SheetHeader>

        <div className="mt-4">
          
            <ScrollArea className="flex-1 mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Loads Section */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 bg-slate-700 text-white px-3 py-2 rounded-t">
                      LOADS ({selectedLoadIds.size}/{lineItems.length} selected)
                    </h3>
                    {lineItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 border rounded-b">No loads found for this period.</p>
                    ) : (
                      <div className="border rounded-b overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="p-2 w-8">
                                <Checkbox 
                                  checked={selectedLoadIds.size === lineItems.length && lineItems.length > 0}
                                  onCheckedChange={toggleAllLoads}
                                />
                              </th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-center p-2">Rate</th>
                              <th className="text-right p-2">
                                {contractProfile.defaultPayLogic === 'PERCENTAGE' ? 'Total ($)' : 'Miles'}
                              </th>
                              <th className="text-right p-2">Net Pay</th>
                            </tr>
                          </thead>
                          {hasMixedRates && (
                            <tbody>
                              <tr>
                                <td colSpan={5} className="p-0">
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-xs text-amber-700">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Multiple rates applied in this period
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          )}
                          <tbody>
                            {lineItems.map(item => (
                              <tr key={item.id} className={`border-t ${!selectedLoadIds.has(item.id) ? 'opacity-40' : ''}`}>
                                <td className="p-2">
                                  <Checkbox 
                                    checked={selectedLoadIds.has(item.id)}
                                    onCheckedChange={() => toggleLoad(item.id)}
                                  />
                                </td>
                                <td className="p-2">
                                  <span className="text-sm">{item.description}</span>
                                </td>
                                <td className="p-2 text-center">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {item.appliedRate || (item.payLogic === 'PERCENTAGE' ? `${item.rate}%` : `$${item.rate.toFixed(2)}/mi`)}
                                  </Badge>
                                </td>
                                <td className="p-2 text-right">
                                  <span className="text-sm">
                                    {item.payLogic === 'PERCENTAGE' 
                                      ? formatCurrency(item.grossAmount || 0) 
                                      : (item.milesDriven || 0).toLocaleString()}
                                  </span>
                                </td>
                                <td className="p-2 text-right font-medium">
                                  {formatCurrency(item.netPay)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Deductions Section */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 bg-red-700 text-white px-3 py-2 rounded-t">
                      DEDUCTIONS ({selectedDeductionIds.size}/{deductions.length} selected)
                    </h3>
                    {deductions.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 border rounded-b">No deductions.</p>
                    ) : (
                      <div className="border rounded-b overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="p-2 w-8">
                                <Checkbox 
                                  checked={selectedDeductionIds.size === deductions.length && deductions.length > 0}
                                  onCheckedChange={toggleAllDeductions}
                                />
                              </th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2 w-28">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deductions.map(item => (
                              <tr key={item.id} className={`border-t first:border-t-0 ${!selectedDeductionIds.has(item.id) ? 'opacity-40' : ''}`}>
                                <td className="p-2">
                                  <Checkbox 
                                    checked={selectedDeductionIds.has(item.id)}
                                    onCheckedChange={() => toggleDeduction(item.id)}
                                  />
                                </td>
                                <td className="p-2">
                                  <span className="text-sm">{item.description}</span>
                                </td>
                                <td className="p-2 w-28 text-right">
                                  <span className="text-sm text-red-600">-{formatCurrency(item.amount || 0)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Reimbursements Section */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 bg-green-700 text-white px-3 py-2 rounded-t">
                      REIMBURSEMENTS ({selectedReimbursementIds.size}/{reimbursements.length} selected)
                    </h3>
                    {reimbursements.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 border rounded-b">No reimbursements.</p>
                    ) : (
                      <div className="border rounded-b overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="p-2 w-8">
                                <Checkbox 
                                  checked={selectedReimbursementIds.size === reimbursements.length && reimbursements.length > 0}
                                  onCheckedChange={toggleAllReimbursements}
                                />
                              </th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2 w-28">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reimbursements.map(item => (
                              <tr key={item.id} className={`border-t first:border-t-0 ${!selectedReimbursementIds.has(item.id) ? 'opacity-40' : ''}`}>
                                <td className="p-2">
                                  <Checkbox 
                                    checked={selectedReimbursementIds.has(item.id)}
                                    onCheckedChange={() => toggleReimbursement(item.id)}
                                  />
                                </td>
                                <td className="p-2">
                                  <span className="text-sm">{item.description}</span>
                                </td>
                                <td className="p-2 w-28 text-right">
                                  <span className="text-sm text-green-600">+{formatCurrency(item.amount || 0)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Loads:</span>
                      <span className="font-medium">{formatCurrency(totalNetPay)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Reimbursements:</span>
                      <span className="font-medium text-green-600">+{formatCurrency(totalReimbursements)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Deductions:</span>
                      <span className="font-medium text-red-600">−{formatCurrency(totalDeductions)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="font-bold">GRAND TOTAL:</span>
                      <span className={`font-bold text-xl ${grandTotal >= 0 ? 'text-primary' : 'text-red-600'}`}>
                        {formatCurrency(grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible History Section */}
                  <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                        <span>Recent Settlements (Last 5)</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isHistoryOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <SettlementHistory 
                        driverId={driverId} 
                        driverName={driverName}
                        driverContractType={driverContractType}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Generate PDF</>
                )}
              </Button>
            </div>
          </div>
      </SheetContent>
    </Sheet>
  );
}
