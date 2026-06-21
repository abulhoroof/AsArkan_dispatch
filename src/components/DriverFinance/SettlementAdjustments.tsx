import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/utils/settlementCalculations';
import { cn } from '@/lib/utils';

export interface SettlementAdjustment {
  id: string;
  description: string;
  amount: number;
  note?: string;
}

interface SettlementAdjustmentsProps {
  deductions: SettlementAdjustment[];
  reimbursements: SettlementAdjustment[];
  onAddDeduction: () => void;
  onAddReimbursement: () => void;
  onUpdateDeduction: (id: string, updates: Partial<SettlementAdjustment>) => void;
  onUpdateReimbursement: (id: string, updates: Partial<SettlementAdjustment>) => void;
  onDeleteDeduction: (id: string) => void;
  onDeleteReimbursement: (id: string) => void;
  isAdmin: boolean;
  isSyncing?: boolean;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

export function SettlementAdjustments({
  deductions,
  reimbursements,
  onAddDeduction,
  onAddReimbursement,
  onUpdateDeduction,
  onUpdateReimbursement,
  onDeleteDeduction,
  onDeleteReimbursement,
  isAdmin,
  isSyncing,
  syncStatus,
}: SettlementAdjustmentsProps) {
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="bg-slate-700 text-white px-3 py-2 font-semibold text-sm rounded-t">
        3. ADJUSTMENTS
      </div>
      
      {/* Stacked vertical layout */}
      <div className="space-y-6">
        {/* Deductions Block */}
        <div className="space-y-2">
          <div className="font-medium text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            DEDUCTIONS (−)
          </div>
          
          <div className="border-2 border-red-300 dark:border-red-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-100 dark:bg-red-950/50">
                <tr>
                  <th className="p-2 text-left font-medium text-xs">Description</th>
                  <th className="p-2 text-right font-medium text-xs w-32">Amount</th>
                  {isAdmin && <th className="p-2 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {deductions.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="p-4 text-center text-muted-foreground text-xs">
                      No deductions
                    </td>
                  </tr>
                ) : (
                  deductions.map((item) => (
                    <AdjustmentRow
                      key={item.id}
                      item={item}
                      type="deduction"
                      isAdmin={isAdmin}
                      onUpdate={onUpdateDeduction}
                      onDelete={onDeleteDeduction}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddDeduction}
              className="w-full text-xs border-red-300 text-red-700 hover:bg-red-100 hover:text-red-900 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-200"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Deduction
            </Button>
          )}
        </div>
        
        {/* Reimbursements Block */}
        <div className="space-y-2">
          <div className="font-medium text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            REIMBURSEMENTS (+)
          </div>
          
          <div className="border-2 border-green-300 dark:border-green-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-green-100 dark:bg-green-950/50">
                <tr>
                  <th className="p-2 text-left font-medium text-xs">Description</th>
                  <th className="p-2 text-right font-medium text-xs w-32">Amount</th>
                  {isAdmin && <th className="p-2 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {reimbursements.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="p-4 text-center text-muted-foreground text-xs">
                      No reimbursements
                    </td>
                  </tr>
                ) : (
                  reimbursements.map((item) => (
                    <AdjustmentRow
                      key={item.id}
                      item={item}
                      type="reimbursement"
                      isAdmin={isAdmin}
                      onUpdate={onUpdateReimbursement}
                      onDelete={onDeleteReimbursement}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddReimbursement}
              className="w-full text-xs border-green-300 text-green-700 hover:bg-green-100 hover:text-green-900 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/50 dark:hover:text-green-200"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Reimbursement
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdjustmentRowProps {
  item: SettlementAdjustment;
  type: 'deduction' | 'reimbursement';
  isAdmin: boolean;
  onUpdate: (id: string, updates: Partial<SettlementAdjustment>) => void;
  onDelete: (id: string) => void;
}

function AdjustmentRow({ item, type, isAdmin, onUpdate, onDelete }: AdjustmentRowProps) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/50">
      <td className="p-2">
        <div className="space-y-0.5">
          <Input
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            placeholder="Description"
            className="h-7 text-xs"
            disabled={!isAdmin}
          />
          {item.note && (
            <span className="text-xs text-muted-foreground italic">{item.note}</span>
          )}
        </div>
      </td>
      <td className="p-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <span className={cn(
            "text-xs",
            type === 'deduction' ? "text-red-600" : "text-green-600"
          )}>
            {type === 'deduction' ? '−' : '+'}$
          </span>
          <Input
            type="number"
            value={item.amount || ''}
            onChange={(e) => onUpdate(item.id, { amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="h-7 text-xs w-20 text-right"
            min={0}
            step={0.01}
            disabled={!isAdmin}
          />
        </div>
      </td>
      {isAdmin && (
        <td className="p-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </td>
      )}
    </tr>
  );
}
