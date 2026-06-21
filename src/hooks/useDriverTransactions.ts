import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export interface DriverTransaction {
  id: string;
  driver_id: string;
  transaction_date: string;
  transaction_type: "deduction" | "reimbursement";
  category: string;
  description: string | null;
  amount: number;
  load_id: string | null;
  created_by: string;
  created_at: string;
}

export interface DriverStatement {
  driver_id: string;
  driver_name: string;
  truck_number: number | null;
  contract_type: string;
  total_loads: number;
  total_load_amount: number;
  total_driver_pay: number;
  total_reimbursements: number;
  total_deductions: number;
  net_payment: number;
}

export interface NewTransaction {
  transaction_date: string;
  transaction_type: "deduction" | "reimbursement";
  category: string;
  description?: string;
  amount: number;
  load_id?: string;
}

export const TRANSACTION_CATEGORIES = {
  deduction: [
    { value: "fuel_expense", label: "Fuel Expense" },
    { value: "tolls", label: "Tolls" },
    { value: "advance", label: "Advance" },
    { value: "equipment", label: "Equipment" },
    { value: "insurance", label: "Insurance" },
    { value: "other", label: "Other" },
  ],
  reimbursement: [
    { value: "fuel_rebates", label: "Fuel Rebates" },
    { value: "detention", label: "Detention Pay" },
    { value: "layover", label: "Layover Pay" },
    { value: "bonus", label: "Bonus" },
    { value: "other", label: "Other" },
  ],
};

export function useDriverTransactions(driverId: string | null) {
  const { organizationId } = useOrganization();
  const [transactions, setTransactions] = useState<DriverTransaction[]>([]);
  const [statement, setStatement] = useState<DriverStatement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStatement, setIsLoadingStatement] = useState(false);

  const fetchTransactions = useCallback(
    async (startDate?: Date, endDate?: Date) => {
      if (!driverId || !organizationId) return;

      setIsLoading(true);
      try {
        let query = supabase
          .from("driver_transactions")
          .select("*")
          .eq("driver_id", driverId)
          .eq("organization_id", organizationId)
          .order("transaction_date", { ascending: false });

        if (startDate) {
          query = query.gte("transaction_date", startDate.toISOString().split("T")[0]);
        }
        if (endDate) {
          query = query.lte("transaction_date", endDate.toISOString().split("T")[0]);
        }

        const { data, error } = await query;

        if (error) throw error;
        setTransactions(data as DriverTransaction[]);
      } catch (error: any) {
        toast.error("Failed to fetch transactions: " + error.message);
      } finally {
        setIsLoading(false);
      }
    },
    [driverId, organizationId]
  );

  const fetchStatement = useCallback(
    async (startDate: Date, endDate: Date) => {
      if (!driverId || !organizationId) return;

      setIsLoadingStatement(true);
      try {
        const { data, error } = await supabase.rpc("get_driver_statement", {
          p_driver_id: driverId,
          p_start_date: startDate.toISOString().split("T")[0],
          p_end_date: endDate.toISOString().split("T")[0],
          p_org_id: organizationId,
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const row = data[0];
          setStatement({
            driver_id: row.driver_id,
            driver_name: row.driver_name,
            truck_number: row.truck_number,
            contract_type: row.contract_type,
            total_loads: Number(row.total_loads),
            total_load_amount: Number(row.total_load_amount),
            total_driver_pay: Number(row.total_driver_pay),
            total_reimbursements: Number(row.total_reimbursements),
            total_deductions: Number(row.total_deductions),
            net_payment: Number(row.net_payment),
          });
        } else {
          setStatement(null);
        }
      } catch (error: any) {
        toast.error("Failed to fetch statement: " + error.message);
      } finally {
        setIsLoadingStatement(false);
      }
    },
    [driverId, organizationId]
  );

  const addTransaction = useCallback(
    async (transaction: NewTransaction) => {
      if (!driverId || !organizationId) return false;

      // Generate optimistic ID
      const optimisticId = `optimistic-${Date.now()}`;
      
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");

        // Optimistic update - add to local state immediately
        const optimisticTransaction: DriverTransaction = {
          id: optimisticId,
          driver_id: driverId,
          transaction_date: transaction.transaction_date,
          transaction_type: transaction.transaction_type,
          category: transaction.category,
          description: transaction.description || null,
          amount: transaction.amount,
          load_id: transaction.load_id || null,
          created_by: userData.user.id,
          created_at: new Date().toISOString(),
        };

        // Add optimistically (at the beginning since we sort by date desc)
        setTransactions((prev) => [optimisticTransaction, ...prev]);

        const { data, error } = await supabase
          .from("driver_transactions")
          .insert({
            driver_id: driverId,
            organization_id: organizationId,
            transaction_date: transaction.transaction_date,
            transaction_type: transaction.transaction_type,
            category: transaction.category,
            description: transaction.description || null,
            amount: transaction.amount,
            load_id: transaction.load_id || null,
            created_by: userData.user.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Replace optimistic transaction with real one
        if (data) {
          setTransactions((prev) =>
            prev.map((t) => (t.id === optimisticId ? (data as DriverTransaction) : t))
          );
        }

        toast.success("Transaction added successfully");
        return true;
      } catch (error: any) {
        // Rollback optimistic update on error
        setTransactions((prev) => prev.filter((t) => t.id !== optimisticId));
        toast.error("Failed to add transaction: " + error.message);
        return false;
      }
    },
    [driverId, organizationId]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      try {
        const { error } = await supabase
          .from("driver_transactions")
          .delete()
          .eq("id", transactionId);

        if (error) throw error;

        setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
        toast.success("Transaction deleted");
        return true;
      } catch (error: any) {
        toast.error("Failed to delete transaction: " + error.message);
        return false;
      }
    },
    []
  );

  return {
    transactions,
    statement,
    isLoading,
    isLoadingStatement,
    fetchTransactions,
    fetchStatement,
    addTransaction,
    deleteTransaction,
  };
}
