import { DriverStatement } from "@/hooks/useDriverTransactions";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Truck, DollarSign, Package, Minus, Plus, Database } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StatementSummaryProps {
  statement: DriverStatement | null;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function StatementSummary({ statement, isLoading }: StatementSummaryProps) {
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
      {/* Data Source Note */}
      <Alert variant="default" className="bg-muted/50 border-border/50">
        <Database className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          This shows <strong>database actuals</strong> from recorded loads and transactions. 
          Use the <strong>Settlement</strong> tab to build and edit payment statements.
        </AlertDescription>
      </Alert>

      {/* Driver Info Header */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-semibold">{statement.driver_name}</div>
          <div className="text-sm text-muted-foreground">
            Truck #{statement.truck_number || "N/A"} • {statement.contract_type}
          </div>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-muted-foreground">Gross: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(statement.total_load_amount)}</strong></span>
            <span className="text-muted-foreground">Driver Pay: <strong className="text-foreground">{formatCurrency(statement.total_driver_pay)}</strong></span>
          </div>
        </div>
      </div>

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
