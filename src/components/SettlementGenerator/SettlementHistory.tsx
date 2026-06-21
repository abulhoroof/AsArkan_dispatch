import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { InvoiceLineItem } from '@/config/contractProfiles';
import { SettlementAdjustment } from '@/components/DriverFinance/SettlementAdjustments';
import { formatCurrency } from '@/utils/settlementCalculations';
import { generateSettlementPdf } from '@/utils/settlementPdfGenerator';
import { getContractProfile } from '@/config/contractProfiles';
import { useSettings } from '@/contexts/SettingsContext';

interface SettlementHistoryEntry {
  id: string;
  period_start: string;
  period_end: string;
  driver_name: string;
  driver_contract_type: string;
  line_items: InvoiceLineItem[];
  deductions: SettlementAdjustment[];
  reimbursements: SettlementAdjustment[];
  total_loads: number;
  total_deductions: number;
  total_reimbursements: number;
  grand_total: number;
  generated_at: string;
}

interface SettlementHistoryProps {
  driverId: string;
  driverName: string;
  driverContractType: string;
}

export function SettlementHistory({ driverId, driverName, driverContractType }: SettlementHistoryProps) {
  const { organizationId } = useOrganization();
  const { contractProfiles } = useSettings();
  const [history, setHistory] = useState<SettlementHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!organizationId) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('settlement_history')
          .select('*')
          .eq('driver_id', driverId)
          .eq('organization_id', organizationId)
          .order('generated_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        
        // Parse JSON fields properly with proper type casting
        const parsed = (data || []).map(entry => ({
          ...entry,
          line_items: (Array.isArray(entry.line_items) ? entry.line_items : []) as unknown as InvoiceLineItem[],
          deductions: (Array.isArray(entry.deductions) ? entry.deductions : []) as unknown as SettlementAdjustment[],
          reimbursements: (Array.isArray(entry.reimbursements) ? entry.reimbursements : []) as unknown as SettlementAdjustment[],
        }));
        
        setHistory(parsed);
      } catch (error: any) {
        toast.error('Failed to load history: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [driverId, organizationId]);

  const handleRedownload = (entry: SettlementHistoryEntry) => {
    setDownloadingId(entry.id);
    
    try {
      const contractProfile = getContractProfile(entry.driver_contract_type, contractProfiles);
      const invoiceNumber = `SET-${format(parseISO(entry.generated_at), 'yyyyMMdd')}-REPRINT`;
      
      generateSettlementPdf({
        driverName: entry.driver_name,
        driverContractType: entry.driver_contract_type,
        invoiceNumber,
        startDate: parseISO(entry.period_start),
        endDate: parseISO(entry.period_end),
        lineItems: entry.line_items,
        deductions: entry.deductions,
        reimbursements: entry.reimbursements,
        totalNetPay: entry.total_loads,
        totalDeductions: entry.total_deductions,
        totalReimbursements: entry.total_reimbursements,
        grandTotal: entry.grand_total,
        payLogic: contractProfile.defaultPayLogic,
        rate: contractProfile.defaultRate,
      });
      
      toast.success('PDF downloaded');
    } catch (error: any) {
      toast.error('Failed to download: ' + error.message);
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No settlement history found for this driver.</p>
        <p className="text-sm mt-1">Generate a settlement to see it here.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pr-4">
      <div className="space-y-4">
        {history.map(entry => (
          <div key={entry.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">
                  {format(parseISO(entry.period_start), 'MMM d')} - {format(parseISO(entry.period_end), 'MMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  Generated {format(parseISO(entry.generated_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRedownload(entry)}
                disabled={downloadingId === entry.id}
              >
                {downloadingId === entry.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </>
                )}
              </Button>
            </div>
            
            <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Loads:</span>
                <p className="font-medium">{formatCurrency(entry.total_loads)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Deductions:</span>
                <p className="font-medium text-red-600">−{formatCurrency(entry.total_deductions)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Reimbursements:</span>
                <p className="font-medium text-green-600">+{formatCurrency(entry.total_reimbursements)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Grand Total:</span>
                <p className={`font-bold ${entry.grand_total >= 0 ? 'text-primary' : 'text-red-600'}`}>
                  {formatCurrency(entry.grand_total)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
