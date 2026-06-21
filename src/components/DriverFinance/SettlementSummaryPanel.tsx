import { formatCurrency } from '@/utils/settlementCalculations';
import { cn } from '@/lib/utils';

interface SettlementSummaryPanelProps {
  totalLoads: number;
  totalReimbursements: number;
  totalDeductions: number;
  grandTotal: number;
}

export function SettlementSummaryPanel({
  totalLoads,
  totalReimbursements,
  totalDeductions,
  grandTotal,
}: SettlementSummaryPanelProps) {
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="bg-slate-700 text-white px-3 py-2 font-semibold text-sm rounded-t">
        4. SUMMARY
      </div>
      
      <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
        {/* Total Loads */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Loads:</span>
          <span className="font-medium">{formatCurrency(totalLoads)}</span>
        </div>
        
        {/* Total Reimbursements */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Reimbursements:</span>
          <span className="font-medium text-green-600">
            +{formatCurrency(totalReimbursements)}
          </span>
        </div>
        
        {/* Total Deductions */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Deductions:</span>
          <span className="font-medium text-red-600">
            −{formatCurrency(totalDeductions)}
          </span>
        </div>
        
        {/* Divider */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-base">GRAND TOTAL:</span>
            <span className={cn(
              "font-bold text-xl",
              grandTotal >= 0 ? "text-primary" : "text-red-600"
            )}>
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
