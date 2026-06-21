import { Badge } from "@/components/ui/badge";

interface InvoicedBadgeProps {
  status: "Missing BOL" | "Invoiced" | "Not Invoiced";
}

export const InvoicedBadge = ({ status }: InvoicedBadgeProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "Invoiced":
        return "bg-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/30 border-green-500/50";
      case "Not Invoiced":
        return "bg-orange-500/20 text-orange-700 dark:text-orange-300 hover:bg-orange-500/30 border-orange-500/50";
      case "Missing BOL":
        return "bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-500/30 border-red-500/50";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "Invoiced":
        return "Invoiced";
      case "Not Invoiced":
        return "Not Invoiced";
      case "Missing BOL":
        return "Missing BOL";
      default:
        return status;
    }
  };

  return (
    <Badge variant="outline" className={`${getStatusColor()} font-medium border`}>
      {getStatusLabel()}
    </Badge>
  );
};
