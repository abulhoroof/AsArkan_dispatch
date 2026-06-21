import { Badge } from "@/components/ui/badge";

interface TarpStatusBadgeProps {
  status: "Tarped" | "Untarped";
}

export const TarpStatusBadge = ({ status }: TarpStatusBadgeProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "Tarped":
        return "bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30 border-blue-500/50";
      case "Untarped":
        return "bg-gray-500/20 text-gray-700 dark:text-gray-300 hover:bg-gray-500/30 border-gray-500/50";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "Tarped":
        return "Tarped";
      case "Untarped":
        return "Untarped";
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
