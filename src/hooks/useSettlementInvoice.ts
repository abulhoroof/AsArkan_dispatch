import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/contexts/OrganizationContext';
import { 
  InvoiceLineItem, 
  ContractProfile,
  ContractProfilesMap,
  getContractProfile,
} from '@/config/contractProfiles';
import { calculateNetPay, generateLineItemId } from '@/utils/settlementCalculations';
import { format } from 'date-fns';
import { SettlementAdjustment } from '@/components/DriverFinance/SettlementAdjustments';

// Parse date strings in various formats (MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD)
function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  
  // Try MM/DD/YY format (e.g., "01/21/26")
  const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortMatch) {
    const [, month, day, year] = shortMatch;
    const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }
  
  // Try MM/DD/YYYY format (e.g., "01/21/2026")
  const longMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (longMatch) {
    const [, month, day, year] = longMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try ISO format YYYY-MM-DD (e.g., "2026-01-21")
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return null;
}

interface UseSettlementInvoiceProps {
  driverId: string | null;
  driverContractType: string;
  startDate: Date;
  endDate: Date;
  contractProfiles?: ContractProfilesMap;
}

interface UseSettlementInvoiceReturn {
  lineItems: InvoiceLineItem[];
  totalNetPay: number;
  totalGross: number;
  totalMiles: number;
  deductions: SettlementAdjustment[];
  reimbursements: SettlementAdjustment[];
  totalDeductions: number;
  totalReimbursements: number;
  grandTotal: number;
  isLoading: boolean;
  addLineItem: () => void;
  updateLineItem: (id: string, updates: Partial<InvoiceLineItem>) => void;
  deleteLineItem: (id: string) => void;
  toggleOverride: (id: string) => void;
  resetToDefault: (id: string) => void;
  importLoads: () => Promise<void>;
  addDeduction: () => void;
  addReimbursement: () => void;
  updateDeduction: (id: string, updates: Partial<SettlementAdjustment>) => void;
  updateReimbursement: (id: string, updates: Partial<SettlementAdjustment>) => void;
  deleteDeduction: (id: string) => void;
  deleteReimbursement: (id: string) => void;
  contractProfile: ContractProfile;
  // Draft restoration setters
  setLineItemsFromDraft: (items: InvoiceLineItem[]) => void;
  setDeductionsFromDraft: (items: SettlementAdjustment[]) => void;
  setReimbursementsFromDraft: (items: SettlementAdjustment[]) => void;
}

export function useSettlementInvoice({
  driverId,
  driverContractType,
  startDate,
  endDate,
  contractProfiles,
}: UseSettlementInvoiceProps): UseSettlementInvoiceReturn {
  const { organization } = useOrganizationContext();
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [deductions, setDeductions] = useState<SettlementAdjustment[]>([]);
  const [reimbursements, setReimbursements] = useState<SettlementAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get the contract profile for this driver
  const contractProfile = useMemo(() => {
    return getContractProfile(driverContractType, contractProfiles);
  }, [driverContractType, contractProfiles]);

  // Calculate totals for loads
  const totalNetPay = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.netPay, 0);
  }, [lineItems]);

  const totalGross = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.grossAmount || 0), 0);
  }, [lineItems]);

  const totalMiles = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.milesDriven || 0), 0);
  }, [lineItems]);

  // Calculate totals for adjustments
  const totalDeductions = useMemo(() => {
    return deductions.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [deductions]);

  const totalReimbursements = useMemo(() => {
    return reimbursements.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [reimbursements]);

  // Grand total: loads + reimbursements - deductions
  const grandTotal = useMemo(() => {
    return totalNetPay + totalReimbursements - totalDeductions;
  }, [totalNetPay, totalReimbursements, totalDeductions]);

  // Helper to recalculate net pay for an item
  const recalculateItem = useCallback((item: InvoiceLineItem): InvoiceLineItem => {
    const netPay = calculateNetPay(
      item.payLogic,
      item.rate,
      item.grossAmount,
      item.milesDriven
    );
    return { ...item, netPay };
  }, []);

  // Generate adjustment ID
  const generateAdjustmentId = () => `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Import loads and adjustments from database
  const importLoads = useCallback(async () => {
    if (!driverId || !organization) return;

    setIsLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch all loads for driver (no date filter - we'll filter client-side due to inconsistent date formats)
      const { data: loads, error: loadsError } = await supabase
        .from('loads')
        .select('id, load_number, load_amount, total_miles, trip_miles, pick_up_date, delivery_date, contract_type')
        .eq('driver_id', driverId)
        .eq('organization_id', organization.id)
        .eq('is_deleted', false)
        .order('pick_up_date', { ascending: true });

      if (loadsError) {
        console.error('Error fetching loads for settlement:', loadsError);
      } else {
        // Filter loads client-side using proper date parsing (handles MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD)
        const startNorm = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endNorm = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        
        const filteredLoads = (loads || []).filter(load => {
          const pickupDate = parseDateString(load.pick_up_date);
          if (!pickupDate) return false;
          const pickupNorm = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate());
          return pickupNorm >= startNorm && pickupNorm <= endNorm;
        });

        if (filteredLoads.length > 0) {
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
        } else {
          setLineItems([]);
        }
      }

      // Fetch driver transactions (deductions and reimbursements)
      const { data: transactions, error: txError } = await supabase
        .from('driver_transactions')
        .select('id, description, amount, transaction_type, category')
        .eq('driver_id', driverId)
        .eq('organization_id', organization.id)
        .gte('transaction_date', startStr)
        .lte('transaction_date', endStr)
        .order('transaction_date', { ascending: true });

      if (txError) {
        console.error('Error fetching transactions for settlement:', txError);
      } else if (transactions) {
        const fetchedDeductions: SettlementAdjustment[] = transactions
          .filter(tx => tx.transaction_type === 'deduction')
          .map(tx => ({
            id: tx.id,
            description: tx.description || tx.category,
            amount: Math.abs(tx.amount),
            note: tx.category !== tx.description ? tx.category : undefined,
          }));
        
        const fetchedReimbursements: SettlementAdjustment[] = transactions
          .filter(tx => tx.transaction_type === 'reimbursement')
          .map(tx => ({
            id: tx.id,
            description: tx.description || tx.category,
            amount: Math.abs(tx.amount),
            note: tx.category !== tx.description ? tx.category : undefined,
          }));

        setDeductions(fetchedDeductions);
        setReimbursements(fetchedReimbursements);
      }
    } finally {
      setIsLoading(false);
    }
  }, [driverId, organization, startDate, endDate, driverContractType, contractProfiles, recalculateItem]);

  // Add a new empty line item
  const addLineItem = useCallback(() => {
    const newItem: InvoiceLineItem = {
      id: generateLineItemId(),
      description: '',
      payLogic: contractProfile.defaultPayLogic,
      rate: contractProfile.defaultRate,
      isOverridden: false,
      grossAmount: contractProfile.defaultPayLogic === 'PERCENTAGE' ? 0 : undefined,
      milesDriven: contractProfile.defaultPayLogic === 'MILEAGE' ? 0 : undefined,
      netPay: 0,
    };
    setLineItems(prev => [...prev, newItem]);
  }, [contractProfile]);

  // Update a line item
  const updateLineItem = useCallback((id: string, updates: Partial<InvoiceLineItem>) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      return recalculateItem(updated);
    }));
  }, [recalculateItem]);

  // Delete a line item
  const deleteLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Toggle override mode for an item
  const toggleOverride = useCallback((id: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, isOverridden: !item.isOverridden };
    }));
  }, []);

  // Reset an item to default contract profile settings
  const resetToDefault = useCallback((id: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated: InvoiceLineItem = {
        ...item,
        payLogic: contractProfile.defaultPayLogic,
        rate: contractProfile.defaultRate,
        isOverridden: false,
        grossAmount: contractProfile.defaultPayLogic === 'PERCENTAGE' 
          ? (item.grossAmount || item.milesDriven || 0) 
          : undefined,
        milesDriven: contractProfile.defaultPayLogic === 'MILEAGE' 
          ? (item.milesDriven || item.grossAmount || 0) 
          : undefined,
      };
      
      return recalculateItem(updated);
    }));
  }, [contractProfile, recalculateItem]);

  // Adjustment CRUD operations
  const addDeduction = useCallback(() => {
    const newItem: SettlementAdjustment = {
      id: generateAdjustmentId(),
      description: '',
      amount: 0,
    };
    setDeductions(prev => [...prev, newItem]);
  }, []);

  const addReimbursement = useCallback(() => {
    const newItem: SettlementAdjustment = {
      id: generateAdjustmentId(),
      description: '',
      amount: 0,
    };
    setReimbursements(prev => [...prev, newItem]);
  }, []);

  const updateDeduction = useCallback((id: string, updates: Partial<SettlementAdjustment>) => {
    setDeductions(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const updateReimbursement = useCallback((id: string, updates: Partial<SettlementAdjustment>) => {
    setReimbursements(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const deleteDeduction = useCallback((id: string) => {
    setDeductions(prev => prev.filter(item => item.id !== id));
  }, []);

  const deleteReimbursement = useCallback((id: string) => {
    setReimbursements(prev => prev.filter(item => item.id !== id));
  }, []);

  // Draft restoration setters - allow external code to set state from loaded draft
  const setLineItemsFromDraft = useCallback((items: InvoiceLineItem[]) => {
    setLineItems(items);
  }, []);

  const setDeductionsFromDraft = useCallback((items: SettlementAdjustment[]) => {
    setDeductions(items);
  }, []);

  const setReimbursementsFromDraft = useCallback((items: SettlementAdjustment[]) => {
    setReimbursements(items);
  }, []);

  return {
    lineItems,
    totalNetPay,
    totalGross,
    totalMiles,
    deductions,
    reimbursements,
    totalDeductions,
    totalReimbursements,
    grandTotal,
    isLoading,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    toggleOverride,
    resetToDefault,
    importLoads,
    addDeduction,
    addReimbursement,
    updateDeduction,
    updateReimbursement,
    deleteDeduction,
    deleteReimbursement,
    contractProfile,
    setLineItemsFromDraft,
    setDeductionsFromDraft,
    setReimbursementsFromDraft,
  };
}
